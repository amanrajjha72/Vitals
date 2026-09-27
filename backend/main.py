import os
import smtplib
import shutil
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
import socket

old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(*args, **kwargs):
    responses = old_getaddrinfo(*args, **kwargs)
    return [response for response in responses if response[0] == socket.AF_INET]
socket.getaddrinfo = new_getaddrinfo

load_dotenv()

app = FastAPI(title="Vitals API")
db = Prisma()
IST = ZoneInfo("Asia/Kolkata")

os.makedirs("uploads/reports", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- HELPER: GET NEXT DOSE TIME ---
def get_next_dose(times_list: List[str], current_ist: datetime) -> datetime:
    """Finds the next chronologically upcoming time from a list of times."""
    sorted_times = sorted(times_list)
    
    # Check if any scheduled times are later today
    for t in sorted_times:
        h, m = map(int, t.split(":"))
        candidate = current_ist.replace(hour=h, minute=m, second=0, microsecond=0)
        if candidate > current_ist:
            return candidate
            
    # If all times today have passed, pick the first scheduled time tomorrow
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
    scheduledTimes: List[str] # Now accepts a list like ["08:00", "16:00", "00:00"]

# --- EMAIL NOTIFICATION SERVICE ---
# --- EMAIL NOTIFICATION SERVICE ---
def send_alert_email(patient_name: str, medicine_name: str):
    sender = os.getenv("EMAIL_SENDER")
    password = os.getenv("EMAIL_PASSWORD")
    if not sender or not password: return
    msg = MIMEMultipart()
    msg['From'] = sender
    msg['To'] = sender 
    msg['Subject'] = f"🚨 URGENT: Missed Medication for {patient_name}"
    msg.attach(MIMEText(f"Patient {patient_name} is more than 10 minutes late taking their scheduled dose of {medicine_name}.", 'plain'))
    try:
        # Use SMTP_SSL on port 465 with a 10-second timeout
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=10)
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
    except Exception as e:
        print(f"Failed to send email: {e}")

# --- BACKGROUND SCHEDULER ---
# --- BACKGROUND SCHEDULER ---
scheduler = AsyncIOScheduler()
async def check_missed_doses():
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=2)
    try:
        late_medicines = await db.medicine.find_many(where={"nextDoseTime": {"lte": cutoff_time}}, include={"familyMember": True})
        for med in late_medicines:
            # 1. Send the email
            patient_name = med.familyMember.name if med.familyMember else "Unknown"
            send_alert_email(patient_name, med.name)
            
            # 2. Skip to the NEXT scheduled dose instead of clearing it to None
            now_ist = datetime.now(IST)
            next_dose_ist = get_next_dose(med.scheduledTimes, now_ist)
            
            await db.medicine.update(
                where={"id": med.id}, 
                data={"nextDoseTime": next_dose_ist.astimezone(timezone.utc)}
            )
    except Exception as e:
        print(f"Scheduler error: {e}")

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

@app.post("/family")
async def add_family_member(data: FamilyMemberCreate):
    return await db.familymember.create(data={"name": data.name, "userId": data.userId})

@app.post("/medicine")
async def add_medicine(data: MedicineCreate):
    existing = next((m for m in await db.medicine.find_many(where={"familyMemberId": data.familyMemberId}) if m.name.lower() == data.name.strip().lower()), None)
    
    now_ist = datetime.now(IST)
    next_dose_ist = get_next_dose(data.scheduledTimes, now_ist)
    next_dose_utc = next_dose_ist.astimezone(timezone.utc)

    if existing: 
        return await db.medicine.update(
            where={"id": existing.id}, 
            data={"stockAvailable": existing.stockAvailable + data.stockAvailable, "scheduledTimes": data.scheduledTimes, "nextDoseTime": next_dose_utc}
        )
    return await db.medicine.create(data={"name": data.name.strip(), "stockAvailable": data.stockAvailable, "scheduledTimes": data.scheduledTimes, "nextDoseTime": next_dose_utc, "familyMemberId": data.familyMemberId})

@app.put("/medicine/{medicine_id}/take")
async def take_dose(medicine_id: str):
    medicine = await db.medicine.find_unique(where={"id": medicine_id})
    if not medicine: raise HTTPException(404, "Medicine not found")
    if medicine.stockAvailable <= 0: raise HTTPException(400, "Out of stock")

    if medicine.nextDoseTime and medicine.nextDoseTime > datetime.now(timezone.utc):
        time_left = medicine.nextDoseTime - datetime.now(timezone.utc)
        raise HTTPException(400, f"Too early. Next dose in {int(time_left.total_seconds()) // 3600}h {(int(time_left.total_seconds()) % 3600) // 60}m.")
        
    now_ist = datetime.now(IST)
    next_dose_ist = get_next_dose(medicine.scheduledTimes, now_ist)
    
    return await db.medicine.update(where={"id": medicine_id}, data={"stockAvailable": medicine.stockAvailable - 1, "nextDoseTime": next_dose_ist.astimezone(timezone.utc)})

@app.get("/test-email")
def force_test_email():
    sender = os.getenv("EMAIL_SENDER")
    password = os.getenv("EMAIL_PASSWORD")
    
    if not sender or not password:
        return {"status": "failed", "reason": "EMAIL_SENDER or EMAIL_PASSWORD environment variables are missing or empty on Render."}
        
    try:
        msg = MIMEMultipart()
        msg['From'] = sender
        msg['To'] = sender 
        msg['Subject'] = "Vitals Connection Test"
        msg.attach(MIMEText("Your FastAPI server successfully connected to Gmail!", 'plain'))
        
        # ---> THIS IS THE CRUCIAL FIX FOR THE LOADING ISSUE <---
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=10)
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        return {"status": "success", "message": f"Email sent to {sender}"}
    except Exception as e:
        return {"status": "failed", "reason": f"Gmail blocked the request: {str(e)}"}
    
@app.post("/report")
async def upload_report(familyMemberId: str = Form(...), file: UploadFile = File(...)):
    try:
        file_path = f"uploads/reports/{file.filename}"
        with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        await db.report.create(data={"filename": file.filename, "fileUrl": f"/uploads/reports/{file.filename}", "familyMemberId": familyMemberId})
        return {"message": "Success"}
    except Exception as e: raise HTTPException(500, str(e))