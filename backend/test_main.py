import pytest
from fastapi.testclient import TestClient
import sqlite3
import os
from contextlib import contextmanager

# Test database
TEST_DATABASE = "test_job_tracker.db"

# Override database connection for tests
@contextmanager
def get_test_db():
    conn = sqlite3.connect(TEST_DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# Import and patch main module
import main as app_module
original_database = app_module.DATABASE
app_module.DATABASE = TEST_DATABASE
original_get_db = app_module.get_db
app_module.get_db = get_test_db

# Import app after patching
from main import app

# Test client
client = TestClient(app)

def setup_module(module):
    """Setup for entire test module"""
    pass

def teardown_module(module):
    """Cleanup after all tests"""
    if os.path.exists(TEST_DATABASE):
        os.remove(TEST_DATABASE)
    # Restore original values
    app_module.DATABASE = original_database
    app_module.get_db = original_get_db

@pytest.fixture(autouse=True)
def setup_test_db():
    """Setup test database before each test"""
    # Remove old test database if exists
    if os.path.exists(TEST_DATABASE):
        os.remove(TEST_DATABASE)
    
    # Initialize test database
    with get_test_db() as conn:
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
    
    yield
    
    # Cleanup after test
    if os.path.exists(TEST_DATABASE):
        os.remove(TEST_DATABASE)


class TestAuth:
    """Test authentication endpoints"""
    
    def test_register_success(self):
        """Test successful user registration"""
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "password123",
                "user_type": "job_seeker"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user_type"] == "job_seeker"
    
    def test_register_duplicate_email(self):
        """Test registration with duplicate email"""
        client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "password123",
                "user_type": "job_seeker"
            }
        )
        
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "password456",
                "user_type": "employer"
            }
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Email already registered"
    
    def test_register_invalid_password(self):
        """Test registration with short password"""
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "123",
                "user_type": "job_seeker"
            }
        )
        assert response.status_code == 422
    
    def test_login_success(self):
        """Test successful login"""
        client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "password123",
                "user_type": "job_seeker"
            }
        )
        
        response = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "password123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
    
    def test_login_wrong_password(self):
        """Test login with wrong password"""
        client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "password123",
                "user_type": "job_seeker"
            }
        )
        
        response = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
    
    def test_get_user_info(self):
        """Test getting current user info"""
        reg_response = client.post(
            "/auth/register",
            json={
                "email": "testuser@example.com",
                "password": "password123",
                "user_type": "job_seeker"
            }
        )
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"
        assert data["user_type"] == "job_seeker"


class TestJobs:
    """Test job management endpoints"""
    
    def get_auth_token(self, email="testjob@example.com"):
        """Helper to get auth token"""
        response = client.post(
            "/auth/register",
            json={
                "email": email,
                "password": "password123",
                "user_type": "job_seeker"
            }
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_create_job(self):
        """Test creating a new job"""
        token = self.get_auth_token()
        
        response = client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Google",
                "position": "Python Developer",
                "status": "Applied",
                "salary": "150000",
                "link": "https://careers.google.com/job123",
                "notes": "Applied via LinkedIn"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["company_name"] == "Google"
        assert data["position"] == "Python Developer"
        assert data["status"] == "Applied"
    
    def test_get_jobs(self):
        """Test getting all jobs"""
        token = self.get_auth_token()
        
        client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Google",
                "position": "Python Developer",
                "status": "Applied"
            }
        )
        
        response = client.get(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["company_name"] == "Google"
    
    def test_get_job_by_id(self):
        """Test getting a specific job"""
        token = self.get_auth_token()
        
        create_response = client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Google",
                "position": "Python Developer",
                "status": "Applied"
            }
        )
        job_id = create_response.json()["id"]
        
        response = client.get(
            f"/jobs/{job_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["id"] == job_id
    
    def test_update_job(self):
        """Test updating a job"""
        token = self.get_auth_token()
        
        create_response = client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Google",
                "position": "Python Developer",
                "status": "Applied"
            }
        )
        job_id = create_response.json()["id"]
        
        response = client.put(
            f"/jobs/{job_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "status": "Interview",
                "notes": "Passed first round"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Interview"
        assert data["notes"] == "Passed first round"
    
    def test_delete_job(self):
        """Test deleting a job"""
        token = self.get_auth_token()
        
        create_response = client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Google",
                "position": "Python Developer",
                "status": "Applied"
            }
        )
        job_id = create_response.json()["id"]
        
        response = client.delete(
            f"/jobs/{job_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 204
        
        get_response = client.get(
            f"/jobs/{job_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 404
    
    def test_filter_jobs_by_status(self):
        """Test filtering jobs by status"""
        token = self.get_auth_token()
        
        client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Google",
                "position": "Python Developer",
                "status": "Applied"
            }
        )
        client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Microsoft",
                "position": "Backend Developer",
                "status": "Interview"
            }
        )
        
        response = client.get(
            "/jobs?status=Interview",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["company_name"] == "Microsoft"
    
    def test_search_jobs_by_company(self):
        """Test searching jobs by company name"""
        token = self.get_auth_token()
        
        client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Google",
                "position": "Python Developer",
                "status": "Applied"
            }
        )
        client.post(
            "/jobs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "company_name": "Microsoft",
                "position": "Backend Developer",
                "status": "Applied"
            }
        )
        
        response = client.get(
            "/jobs?company=Google",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["company_name"] == "Google"
    
    def test_unauthorized_access(self):
        """Test accessing jobs without token"""
        response = client.get("/jobs")
        assert response.status_code == 403


class TestAnalytics:
    """Test analytics endpoints"""
    
    def get_auth_token(self, email="analytics@example.com"):
        """Helper to get auth token"""
        response = client.post(
            "/auth/register",
            json={
                "email": email,
                "password": "password123",
                "user_type": "job_seeker"
            }
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_analytics_summary(self):
        """Test getting analytics summary"""
        token = self.get_auth_token()
        
        statuses = ["Applied", "Applied", "Interview", "Offer", "Rejected"]
        for i, status in enumerate(statuses):
            client.post(
                "/jobs",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "company_name": f"Company{i}",
                    "position": "Developer",
                    "status": status
                }
            )
        
        response = client.get(
            "/analytics/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_jobs"] == 5
        assert data["applied"] == 2
        assert data["interview"] == 1
        assert data["offer"] == 1
        assert data["rejected"] == 1
        assert data["interview_rate"] == 20.0
        assert data["offer_rate"] == 20.0