from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timedelta
from enum import Enum
import jwt
from passlib.context import CryptContext
import sqlite3
from contextlib import contextmanager

# Configuration
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Database setup
DATABASE = "job_tracker.db"

@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                user_type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                company_name TEXT NOT NULL,
                position TEXT NOT NULL,
                status TEXT NOT NULL,
                salary TEXT,
                link TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        conn.commit()

# Models
class UserType(str, Enum):
    JOB_SEEKER = "job_seeker"
    EMPLOYER = "employer"

class JobStatus(str, Enum):
    APPLIED = "Applied"
    INTERVIEW = "Interview"
    OFFER = "Offer"
    REJECTED = "Rejected"

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    user_type: UserType

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_type: str

class UserInfo(BaseModel):
    id: int
    email: str
    user_type: str

class JobCreate(BaseModel):
    company_name: str = Field(min_length=1)
    position: str = Field(min_length=1)
    status: JobStatus = JobStatus.APPLIED
    salary: Optional[str] = None
    link: Optional[str] = None
    notes: Optional[str] = None

class JobUpdate(BaseModel):
    company_name: Optional[str] = None
    position: Optional[str] = None
    status: Optional[JobStatus] = None
    salary: Optional[str] = None
    link: Optional[str] = None
    notes: Optional[str] = None

class JobResponse(BaseModel):
    id: int
    company_name: str
    position: str
    status: str
    salary: Optional[str]
    link: Optional[str]
    notes: Optional[str]
    created_at: str
    updated_at: str

class AnalyticsSummary(BaseModel):
    total_jobs: int
    applied: int
    interview: int
    offer: int
    rejected: int
    interview_rate: float
    offer_rate: float

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    return int(user_id)

# FastAPI app
app = FastAPI(
    title="Job Tracker API",
    description="API для отслеживания откликов на вакансии",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

# Auth endpoints
@app.post("/auth/register", response_model=Token, tags=["Auth"])
def register(user: UserCreate):
    """Регистрация нового пользователя"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = get_password_hash(user.password)
        cursor.execute(
            "INSERT INTO users (email, hashed_password, user_type) VALUES (?, ?, ?)",
            (user.email, hashed_password, user.user_type.value)
        )
        conn.commit()
        user_id = cursor.lastrowid
    
    access_token = create_access_token(data={"sub": str(user_id)})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_type": user.user_type.value
    }

@app.post("/auth/login", response_model=Token, tags=["Auth"])
def login(user: UserLogin):
    """Вход в систему"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, hashed_password, user_type FROM users WHERE email = ?", (user.email,))
        db_user = cursor.fetchone()
        
        if not db_user or not verify_password(user.password, db_user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": str(db_user["id"])})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_type": db_user["user_type"]
    }

@app.get("/auth/me", response_model=UserInfo, tags=["Auth"])
def get_user_info(current_user: int = Depends(get_current_user)):
    """Получить информацию о текущем пользователе"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, user_type FROM users WHERE id = ?", (current_user,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
    
    return dict(user)

# Job endpoints
@app.get("/jobs", response_model=List[JobResponse], tags=["Jobs"])
def get_jobs(
    status: Optional[JobStatus] = None,
    company: Optional[str] = None,
    current_user: int = Depends(get_current_user)
):
    """Получить список вакансий с фильтрацией"""
    query = "SELECT * FROM jobs WHERE user_id = ?"
    params = [current_user]
    
    if status:
        query += " AND status = ?"
        params.append(status.value)
    
    if company:
        query += " AND company_name LIKE ?"
        params.append(f"%{company}%")
    
    query += " ORDER BY created_at DESC"
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        jobs = cursor.fetchall()
    
    return [dict(job) for job in jobs]

@app.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED, tags=["Jobs"])
def create_job(job: JobCreate, current_user: int = Depends(get_current_user)):
    """Добавить новую вакансию"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO jobs (user_id, company_name, position, status, salary, link, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (current_user, job.company_name, job.position, job.status.value, 
             job.salary, job.link, job.notes)
        )
        conn.commit()
        job_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        created_job = cursor.fetchone()
    
    return dict(created_job)

@app.get("/jobs/{job_id}", response_model=JobResponse, tags=["Jobs"])
def get_job(job_id: int, current_user: int = Depends(get_current_user)):
    """Получить вакансию по ID"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM jobs WHERE id = ? AND user_id = ?", (job_id, current_user))
        job = cursor.fetchone()
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
    
    return dict(job)

@app.put("/jobs/{job_id}", response_model=JobResponse, tags=["Jobs"])
def update_job(job_id: int, job_update: JobUpdate, current_user: int = Depends(get_current_user)):
    """Обновить вакансию"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM jobs WHERE id = ? AND user_id = ?", (job_id, current_user))
        existing_job = cursor.fetchone()
        
        if not existing_job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        update_data = job_update.dict(exclude_unset=True)
        if update_data:
            # Convert enum to value if status is being updated
            if 'status' in update_data and update_data['status']:
                update_data['status'] = update_data['status'].value
            
            set_clause = ", ".join([f"{k} = ?" for k in update_data.keys()])
            set_clause += ", updated_at = CURRENT_TIMESTAMP"
            values = list(update_data.values()) + [job_id, current_user]
            cursor.execute(
                f"UPDATE jobs SET {set_clause} WHERE id = ? AND user_id = ?",
                values
            )
            conn.commit()
        
        cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        updated_job = cursor.fetchone()
    
    return dict(updated_job)

@app.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Jobs"])
def delete_job(job_id: int, current_user: int = Depends(get_current_user)):
    """Удалить вакансию"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM jobs WHERE id = ? AND user_id = ?", (job_id, current_user))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Job not found")
        
        cursor.execute("DELETE FROM jobs WHERE id = ? AND user_id = ?", (job_id, current_user))
        conn.commit()

# Analytics endpoint
@app.get("/analytics/summary", response_model=AnalyticsSummary, tags=["Analytics"])
def get_analytics(current_user: int = Depends(get_current_user)):
    """Получить аналитику по вакансиям"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT status, COUNT(*) as count FROM jobs WHERE user_id = ? GROUP BY status", (current_user,))
        stats = {row["status"]: row["count"] for row in cursor.fetchall()}
    
    total = sum(stats.values())
    applied = stats.get("Applied", 0)
    interview = stats.get("Interview", 0)
    offer = stats.get("Offer", 0)
    rejected = stats.get("Rejected", 0)
    
    interview_rate = (interview / total * 100) if total > 0 else 0
    offer_rate = (offer / total * 100) if total > 0 else 0
    
    return {
        "total_jobs": total,
        "applied": applied,
        "interview": interview,
        "offer": offer,
        "rejected": rejected,
        "interview_rate": round(interview_rate, 2),
        "offer_rate": round(offer_rate, 2)
    }

@app.get("/", tags=["Root"])
def root():
    """Корневой эндпоинт"""
    return {
        "message": "Job Tracker API",
        "docs": "/docs",
        "version": "2.0.0"
    }