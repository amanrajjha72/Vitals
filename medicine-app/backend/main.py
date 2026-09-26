import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
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

# --- PASSWORD HASHING SETUP ---
def get_password_hash(password: str) -> str:
    # Hash a password for the first time
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Check if the provided password matches the hash
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password=password_byte_enc, hashed_password=hashed_password_byte_enc)

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
    intervalHours: int

# --- EMAIL NOTIFICATION SERVICE ---
def send_alert_email(patient_name: str, medicine_name: str):
    sender = os.getenv("EMAIL_SENDER")
    password = os.getenv("EMAIL_PASSWORD")
    
    if not sender or not password:
        print("⚠️ Email credentials missing in Environment Variables!")
        return

    msg = MIMEMultipart()
    msg['From'] = sender
    msg['To'] = sender 
    msg['Subject'] = f"🚨 URGENT: Missed Medication for {patient_name}"
    body = f"Patient {patient_name} is more than 10 minutes late taking their scheduled dose of {medicine_name}."
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        print(f"📧 Alert email successfully sent for {patient_name}!")
    except smtplib.SMTPAuthenticationError:
        print("❌ SMTP Auth Error: Invalid App Password.")
    except Exception as e:
        print(f"❌ Failed to send email alert: {e}")

# --- BACKGROUND SCHEDULER ---
scheduler = AsyncIOScheduler()

async def check_missed_doses():
    """Runs in the background to detect doses missed by 10+ minutes."""
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    
    try:
        late_medicines = await db.medicine.find_many(
            where={"nextDoseTime": {"lte": cutoff_time}},
            include={"familyMember": True}
        )
        
        for med in late_medicines:
            patient_name = med.familyMember.name if med.familyMember else "Unknown"
            send_alert_email(patient_name, med.name)
            
            # Clear nextDoseTime to prevent duplicate emails
            await db.medicine.update(
                where={"id": med.id},
                data={"nextDoseTime": None}
            )
    except Exception as e:
        print(f"Error checking missed doses: {e}")

# --- MIDDLEWARE & OAUTH ---
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "fallback-secret-key"))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "https://vitals-sand.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth = OAuth()
oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    client_kwargs={'scope': 'openid email profile'}
)

@app.on_event("startup")
async def startup():
    await db.connect()
    scheduler.add_job(check_missed_doses, 'interval', minutes=1)
    scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    await db.disconnect()

# --- GOOGLE OAUTH ROUTES ---
@app.get("/auth/login")
async def login(request: Request):
    return await oauth.google.authorize_redirect(
        request, redirect_uri="https://vitals-bget.onrender.com/auth/callback"
    )

@app.get("/auth/callback")
async def auth_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    
    user = await db.user.find_unique(where={"email": user_info.get("email")})
    if not user:
        user = await db.user.create(data={"name": user_info.get("name"), "email": user_info.get("email")})
        
    return RedirectResponse(url=f"https://vitals-sand.vercel.app?userId={user.id}")

# --- CUSTOM CREDENTIAL ROUTES ---
@app.post("/auth/setup-credentials")
async def setup_credentials(data: SetupCredentials):
    existing_user = await db.user.find_unique(where={"username": data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose another.")
    
    hashed_pw = get_password_hash(data.password)
    
    updated_user = await db.user.update(
        where={"id": data.user_db_id},
        data={
            "username": data.username,
            "passwordHash": hashed_pw
        }
    )
    return {"message": "Credentials successfully set!", "userId": updated_user.id}

@app.post("/auth/login/custom")
async def custom_login(data: CustomLogin):
    user = await db.user.find_unique(where={"username": data.username})
    if not user or not user.passwordHash:
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    if not verify_password(data.password, user.passwordHash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    return {"message": "Login successful", "userId": user.id}

# --- DASHBOARD & FAMILY ROUTES ---
@app.get("/user/{user_id}/family")
async def get_dashboard_data(user_id: str):
    """Fetches all family members and their tracked medicines for the dashboard."""
    family_members = await db.familymember.find_many(
        where={"userId": user_id},
        include={"medicines": True}
    )
    return family_members

@app.post("/family")
async def add_family_member(data: FamilyMemberCreate):
    """Creates a new family member linked to the user."""
    member = await db.familymember.create(
        data={
            "name": data.name,
            "userId": data.userId
        }
    )
    return member

@app.post("/medicine")
async def add_medicine(data: MedicineCreate):
    """Adds a new medicine to a specific family member."""
    
    # Calculate how many doses are taken per day to satisfy the Prisma schema requirement
    calculated_doses = 24 // data.intervalHours if data.intervalHours > 0 else 1

    medicine = await db.medicine.create(
        data={
            "name": data.name,
            "stockAvailable": data.stockAvailable,
            "intervalHours": data.intervalHours,
            "dosesPerDay": calculated_doses,  # This new field fixes the Prisma crash
            "familyMemberId": data.familyMemberId
        }
    )
    return medicine

# --- MEDICINE ROUTES ---
@app.put("/medicine/{medicine_id}/take")
async def take_dose(medicine_id: str):
    medicine = await db.medicine.find_unique(where={"id": medicine_id})
    if not medicine or medicine.stockAvailable <= 0:
        raise HTTPException(status_code=400, detail="Out of stock")
        
    next_dose = datetime.now(timezone.utc) + timedelta(hours=medicine.intervalHours)
    return await db.medicine.update(
        where={"id": medicine_id},
        data={"stockAvailable": medicine.stockAvailable - 1, "nextDoseTime": next_dose}
    )