from fastapi.testclient import TestClient
from main import app
from app.db import engine
from app.db import Base

from app.db import SessionLocal
from app.models.user import User

Base.metadata.create_all(engine)

# Cleanup test user if exists to ensure test is reproducible
with SessionLocal() as db:
    existing = db.query(User).filter(User.email == 'testuser@example.com').first()
    if existing:
        db.delete(existing)
        db.commit()

client = TestClient(app)

print('Testing /api/v1/login and /api/v1/signup')

signup_payload = {
    'full_name': 'Test User',
    'email': 'testuser@example.com',
    'department': 'it',
    'password': 'Password123!',
    'confirm_password': 'Password123!'
}
res = client.post('/api/v1/signup', json=signup_payload)
print('signup status', res.status_code, res.json())

login_payload = {'email': 'testuser@example.com', 'password': 'Password123!'}
res = client.post('/api/v1/login', json=login_payload)
print('login status', res.status_code, res.json())
print('cookies', res.cookies)

res2 = client.get('/api/v1/protected')
print('/protected without cookie', res2.status_code, res2.json())

client.cookies = res.cookies
res3 = client.get('/api/v1/protected')
print('/protected with cookie', res3.status_code, res3.json())

res4 = client.post('/api/v1/logout')
print('logout', res4.status_code, res4.json())

res5 = client.get('/api/v1/protected')
print('/protected after logout', res5.status_code, res5.json())
