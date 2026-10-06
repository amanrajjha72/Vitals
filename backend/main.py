import os
import shutil
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List

from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from prisma import Prisma
from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import bcrypt

load_dotenv()

app = FastAPI(title="Vitals API")
db = Prisma()
IST = ZoneInfo("Asia/Kolkata")

os.makedirs("uploads/reports", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- HELPER: GET NEXT DOSE TIME ---
def get_next_dose(times_list: List[str], current_ist: datetime) -> datetime:
    if not times_list:
        return current_ist + timedelta(days=1)
        
    sorted_times = sorted(times_list)
    
    for t in sorted_times:
        h, m = map(int, t.split(":"))
        candidate = current_ist.replace(hour=h, minute=m, second=0, microsecond=0)
        if candidate > current_ist:
            return candidate
            
    h, m = map(int, sorted_times[0].split(":"))
    return current_ist.replace(hour=h, minute=m, second=0, microsecond=0) + timedelta(days=1)

# --- PASSWORD HASHING SETUP ---
def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# --- PYDANTIC SCHEMAS ---
class SetupCredentials(BaseModel):
    user_db_id: str
    username: str
    password: str

class CustomLogin(BaseModel):
    username: str
    password: str

class FamilyMemberCreate(BaseModel):
    userId: str
    name: str

class MedicineCreate(BaseModel):
    familyMemberId: str
    name: str
    stockAvailable: int
    scheduledTimes: List[str]

class MedicineUpdate(BaseModel):
    stockAvailable: int
    scheduledTimes: List[str]

# --- MEMORY CACHE FOR ALERTS ---
alerted_doses = {} 

def send_alert_email(patient_name: str, medicine_name: str):
    api_key = os.getenv("RESEND_API_KEY")
    receiver_email = os.getenv("EMAIL_SENDER") 
    
    if not api_key or not receiver_email: return
        
    try:
        data = json.dumps({
            "from": "Acme <onboarding@resend.dev>",
            "to": [receiver_email],
            "subject": f"🚨 URGENT: Missed Medication for {patient_name}",
            "text": f"Patient {patient_name} is late taking their scheduled dose of {medicine_name}."
        }).encode("utf-8")
        
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=data,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "User-Agent": "Python-Vitals-App"}
        )
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"Failed to send HTTP email: {e}")

# --- BACKGROUND SCHEDULER ---
scheduler = AsyncIOScheduler()
async def check_missed_doses():
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=2)
    try:
        late_medicines = await db.medicine.find_many(where={"nextDoseTime": {"lte": cutoff_time}}, include={"familyMember": True})
        for med in late_medicines:
            last_alert = alerted_doses.get(med.id)
            if last_alert == med.nextDoseTime:
                continue 
                
            patient_name = med.familyMember.name if med.familyMember else "Unknown"
            send_alert_email(patient_name, med.name)
            
            alerted_doses[med.id] = med.nextDoseTime
            
    except Exception as e: print(f"Scheduler error: {e}")

# --- MIDDLEWARE & OAUTH ---
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "fallback-key"))
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
oauth = OAuth()
oauth.register(name='google', server_metadata_url='https://accounts.google.com/.well-known/openid-configuration', client_id=os.getenv("GOOGLE_CLIENT_ID"), client_secret=os.getenv("GOOGLE_CLIENT_SECRET"), client_kwargs={'scope': 'openid email profile'})

@app.on_event("startup")
async def startup():
    await db.connect()
    scheduler.add_job(check_missed_doses, 'interval', minutes=1)
    scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    await db.disconnect()

@app.get("/auth/login")
async def login(request: Request): return await oauth.google.authorize_redirect(request, redirect_uri="https://vitals-bget.onrender.com/auth/callback")

@app.get("/auth/callback")
async def auth_callback(request: Request):
    user_info = (await oauth.google.authorize_access_token(request)).get('userinfo')
    user = await db.user.find_unique(where={"email": user_info.get("email")})
    if not user: user = await db.user.create(data={"name": user_info.get("name"), "email": user_info.get("email")})
    return RedirectResponse(url=f"https://vitals-sand.vercel.app?userId={user.id}")

@app.post("/auth/setup-credentials")
async def setup_credentials(data: SetupCredentials):
    if await db.user.find_unique(where={"username": data.username}): raise HTTPException(400, "Username exists.")
    return {"userId": (await db.user.update(where={"id": data.user_db_id}, data={"username": data.username, "passwordHash": get_password_hash(data.password)})).id}

@app.post("/auth/login/custom")
async def custom_login(data: CustomLogin):
    user = await db.user.find_unique(where={"username": data.username})
    if not user or not verify_password(data.password, user.passwordHash): raise HTTPException(401, "Invalid login")
    return {"userId": user.id}

@app.get("/user/{user_id}/family")
async def get_dashboard_data(user_id: str):
    return await db.familymember.find_many(where={"userId": user_id}, include={"medicines": True, "reports": True})

@app.get("/user/{user_id}/rhythm")
async def get_weekly_rhythm(user_id: str):
    family_members = await db.familymember.find_many(
        where={"userId": user_id},
        include={"medicines": True}
    )
    
    medicines = []
    for fm in family_members:
        if fm.medicines:
            medicines.extend(fm.medicines)
            
    daily_expected = sum(len(m.scheduledTimes) for m in medicines if m.scheduledTimes)
    if daily_expected == 0:
        return [0, 0, 0, 0, 0, 0, 0]
        
    medicine_ids = [m.id for m in medicines]
    
    now_ist = datetime.now(IST)
    start_of_week = (now_ist - timedelta(days=now_ist.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    
    logs = await db.doselog.find_many(
        where={
            "medicineId": {"in": medicine_ids},
            "takenAt": {"gte": start_of_week.astimezone(timezone.utc)}
        }
    )
    
    daily_counts = {i: 0 for i in range(7)}
    for log in logs:
        log_ist = log.takenAt.astimezone(IST)
        day_index = log_ist.weekday() 
        daily_counts[day_index] += 1
        
    rhythm = []
    for i in range(7):
        if i > now_ist.weekday():
            rhythm.append(0) 
        else:
            pct = min(100, int((daily_counts[i] / daily_expected) * 100))
            rhythm.append(pct)
            
    return rhythm

@app.post("/family")
async def add_family_member(data: FamilyMemberCreate):
    return await db.familymember.create(data={"name": data.name, "userId": data.userId})

@app.post("/medicine")
async def add_medicine(data: MedicineCreate):
    existing = next((m for m in await db.medicine.find_many(where={"familyMemberId": data.familyMemberId}) if m.name.lower() == data.name.strip().lower()), None)
    
    if existing: 
        return await db.medicine.update(
            where={"id": existing.id}, 
            data={"stockAvailable": existing.stockAvailable + data.stockAvailable}
        )
        
    now_ist = datetime.now(IST)
    next_dose_ist = get_next_dose(data.scheduledTimes, now_ist)
    return await db.medicine.create(
        data={
            "name": data.name.strip(), 
            "stockAvailable": data.stockAvailable, 
            "scheduledTimes": {"set": data.scheduledTimes}, 
            "nextDoseTime": next_dose_ist.astimezone(timezone.utc), 
            "familyMemberId": data.familyMemberId
        }
    )

@app.put("/medicine/{medicine_id}")
async def edit_medicine(medicine_id: str, data: MedicineUpdate):
    medicine = await db.medicine.find_unique(where={"id": medicine_id})
    if not medicine: raise HTTPException(404, "Medicine not found")

    now_ist = datetime.now(IST)
    next_dose_ist = get_next_dose(data.scheduledTimes, now_ist)
    
    return await db.medicine.update(
        where={"id": medicine_id},
        data={
            "stockAvailable": data.stockAvailable,
            "scheduledTimes": {"set": data.scheduledTimes}, 
            "nextDoseTime": next_dose_ist.astimezone(timezone.utc)
        }
    )

@app.put("/medicine/{medicine_id}/take")
async def take_dose(medicine_id: str):
    medicine = await db.medicine.find_unique(where={"id": medicine_id})
    if not medicine: raise HTTPException(404, "Medicine not found")
    if medicine.stockAvailable <= 0: raise HTTPException(400, "Out of stock")

    now_ist = datetime.now(IST)
    next_dose_ist = get_next_dose(medicine.scheduledTimes, now_ist)
    
    await db.doselog.create(
        data={
            "medicineId": medicine_id, 
            "takenAt": datetime.now(timezone.utc)
        }
    )
    
    return await db.medicine.update(
        where={"id": medicine_id}, 
        data={
            "stockAvailable": medicine.stockAvailable - 1, 
            "nextDoseTime": next_dose_ist.astimezone(timezone.utc)
        }
    )

# --- NEW REPORT UPLOAD ENDPOINT ---
@app.post("/family/{member_id}/report")
async def upload_report(member_id: str, report: UploadFile = File(...)):
    try:
        file_path = f"uploads/reports/{report.filename}"
        with open(file_path, "wb") as buffer: 
            shutil.copyfileobj(report.file, buffer)
            
        await db.report.create(data={
            "filename": report.filename, 
            "fileUrl": f"/uploads/reports/{report.filename}", 
            "familyMemberId": member_id
        })
        return {"message": "Success"}
    except Exception as e: 
        raise HTTPException(500, str(e))

# --- NEW REPORT VIEW ENDPOINT ---
@app.get("/family/{member_id}/report")
async def get_report(member_id: str):
    reports = await db.report.find_many(where={"familyMemberId": member_id})
    if not reports:
        raise HTTPException(404, "No reports found for this member.")
        
    # Get the most recently uploaded report
    latest_report = reports[-1]
    
    # Redirect to the static file path which FastAPI serves automatically
    return RedirectResponse(url=latest_report.fileUrl)

@app.api_route("/admin/wipe-database", methods=["GET", "POST", "DELETE"])
async def wipe_database():
    try:
        await db.doselog.delete_many()
        await db.report.delete_many()
        await db.medicine.delete_many()
        await db.familymember.delete_many()
        await db.user.delete_many()
        return {"status": "success", "message": "All database records have been completely wiped."}
    except Exception as e: return {"status": "failed", "reason": str(e)}