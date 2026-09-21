import os
import shutil
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, File, UploadFile, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from prisma import Prisma
from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Load secrets from .env
load_dotenv()

app = FastAPI(title="Medicine Tracker API")
db = Prisma()

# --- EMAIL NOTIFICATION SERVICE ---
def send_alert_email(patient_name: str, medicine_name: str):
    sender = os.getenv("EMAIL_SENDER")
    password = os.getenv("EMAIL_PASSWORD")
    receiver = sender  # Sends directly to your configured email

    if not sender or not password:
        print("⚠️ Email credentials missing in Render Environment Variables! Skipping email dispatch.")
        return

    msg = MIMEMultipart()
    msg['From'] = sender
    msg['To'] = receiver
    msg['Subject'] = f"🚨 URGENT: Missed Medication for {patient_name}"

    body = (
        f"Hello,\n\n"
        f"Patient {patient_name} is more than 10 minutes late taking their scheduled dose of {medicine_name}.\n\n"
        f"Please verify their status and ensure they take their medication as soon as possible."
    )
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        print(f"📧 Alert email successfully sent for {patient_name} ({medicine_name})!")
    except smtplib.SMTPAuthenticationError:
        print("❌ SMTP Auth Error: Google blocked the login. You MUST use a 16-character App Password, not your normal Gmail password.")
    except Exception as e:
        print(f"❌ Failed to send email alert: {e}")

# --- BACKGROUND SCHEDULER ---
scheduler = AsyncIOScheduler()

async def check_missed_doses():
    """Runs in the background to detect doses missed by 10+ minutes."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking for missed doses...")
    
    # 10 minutes threshold for production
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    
    try:
        late_medicines = await db.medicine.find_many(
            where={
                "nextDoseTime": {
                    "lte": cutoff_time
                }
            },
            include={
                "familyMember": True
            }
        )
        
        print(f"Total missed doses found in DB: {len(late_medicines)}")
        if not late_medicines:
            print(f"Search cutoff time was (UTC): {cutoff_time}")
        
        for med in late_medicines:
            patient_name = med.familyMember.name if med.familyMember else "Unknown Patient"
            print(f"🚨 ESCALATION ALERT: {patient_name} missed scheduled dose for {med.name}!")
            
            # Dispatch email notification
            send_alert_email(patient_name, med.name)
            
            # Clear nextDoseTime so it doesn't repeatedly spam your inbox
            await db.medicine.update(
                where={"id": med.id},
                data={"nextDoseTime": None}
            )
            
    except Exception as e:
        print(f"Error checking missed doses: {e}")

# --- MIDDLEWARE & CONFIGURATION ---
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "fallback_secret"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://vitals-sand.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- OAUTH SETUP ---
oauth = OAuth()
oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# --- PYDANTIC SCHEMAS ---
class FamilyMemberCreate(BaseModel):
    name: str
    userId: str

class MedicineCreate(BaseModel):
    name: str
    totalStock: int
    intervalHours: int
    dosesPerDay: int

# --- LIFECYCLE EVENTS ---
@app.on_event("startup")
async def startup():
    await db.connect()
    scheduler.add_job(check_missed_doses, 'interval', minutes=1)
    scheduler.start()
    print("⏳ Background scheduler started!")

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    await db.disconnect()

# --- AUTH ROUTES ---
@app.get("/auth/login")
async def login(request: Request):
    return await oauth.google.authorize_redirect(
        request, 
        redirect_uri="https://vitals-bget.onrender.com/auth/callback"
    )

@app.get("/auth/callback")
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        email = user_info.get("email")
        name = user_info.get("name")
        
        user = await db.user.find_unique(where={"email": email})
        
        if not user:
            user = await db.user.create(
                data={
                    "name": name,
                    "email": email
                }
            )
            
        return RedirectResponse(url=f"https://vitals-sand.vercel.app?userId={user.id}")
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")

# --- PATIENT & MEDICINE ROUTES ---
@app.post("/family/")
async def create_family_member(member: FamilyMemberCreate):
    new_member = await db.familymember.create(
        data={
            "name": member.name,
            "userId": member.userId
        }
    )
    return new_member

@app.get("/family/")
async def get_all_family(user_id: str):
    family_members = await db.familymember.find_many(
        where={
            "userId": user_id
        },
        include={
            "medicines": True,
            "reports": True
        }
    )
    return {"family": family_members}

@app.post("/family/{member_id}/medicine")
async def add_medicine(member_id: str, medicine: MedicineCreate):
    new_med = await db.medicine.create(
        data={
            "name": medicine.name,
            "stockAvailable": medicine.totalStock,
            "intervalHours": medicine.intervalHours,
            "dosesPerDay": medicine.dosesPerDay,
            "familyMemberId": member_id,
            "nextDoseTime": datetime.now(timezone.utc)
        }
    )
    return new_med

@app.put("/medicine/{medicine_id}/take")
async def take_dose(medicine_id: str):
    medicine = await db.medicine.find_unique(where={"id": medicine_id})
    if not medicine or medicine.stockAvailable <= 0:
        raise HTTPException(status_code=400, detail="Out of stock")
        
    interval = medicine.intervalHours if medicine.intervalHours else 8
    next_dose = datetime.now(timezone.utc) + timedelta(hours=interval)
        
    updated_med = await db.medicine.update(
        where={"id": medicine_id},
        data={
            "stockAvailable": medicine.stockAvailable - 1,
            "nextDoseTime": next_dose
        }
    )
    return updated_med

@app.post("/family/{member_id}/report")
async def upload_report(member_id: str, file: UploadFile = File(...)):
    file_location = f"uploads/{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    report = await db.medicalreport.create(
        data={
            "fileName": file.filename,
            "fileUrl": file_location,
            "familyMemberId": member_id
        }
    )
    return report