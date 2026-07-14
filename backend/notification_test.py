import sys
from datetime import date, datetime
from fastapi.testclient import TestClient
from main import app
from app.db import SessionLocal
from app.models.user import User, UserRole
from app.models.asset import Asset, AssetStatus, AssetType, AssetCondition, SourceType
from app.models.assignment import Assignment, AssignmentStatus
from app.models.notification import Notification
from app.models.asset_request import AssetRequest, RequestPriority, RequestStatus

client = TestClient(app)

def login(email, password):
    res = client.post('/api/v1/login', json={'email': email, 'password': password})
    if res.status_code != 200:
        raise Exception(f"Login failed for {email}: {res.json()}")
    return res.cookies

def test_notification_flow():
    print("=== STARTING TICKET S3-08 NOTIFICATION TESTS ===")
    
    # Set up sessions
    admin_cookies = login("admin@ursb.go.ug", "Admin@1234")
    employee_cookies = login("john.mukasa@ursb.go.ug", "Employee@1234")
    custodian_cookies = login("custodian.ict@ursb.go.ug", "Custodian@1234")
    
    # Read user IDs
    db = SessionLocal()
    try:
        employee = db.query(User).filter(User.email == "john.mukasa@ursb.go.ug").first()
        employee_id = employee.id
        admin = db.query(User).filter(User.email == "admin@ursb.go.ug").first()
        admin_id = admin.id
        custodian = db.query(User).filter(User.email == "custodian.ict@ursb.go.ug").first()
        custodian_id = custodian.id
    finally:
        db.close()

    # 1. Clean up old notifications
    db = SessionLocal()
    try:
        db.query(Notification).delete()
        db.commit()
    finally:
        db.close()

    # 2. Test unread count starts at 0
    res = client.get("/api/v1/notifications/unread-count", cookies=employee_cookies)
    print(f"[TEST 1] Initial unread count for employee: {res.json()}")
    assert res.status_code == 200
    assert res.json()["count"] == 0

    # 3. Trigger Request Submitted event (Employee submits a request)
    # This should notify all Asset Managers (active)
    # The seeded Asset Manager is Grace Nakato (user id 2)
    res = client.post(
        "/api/v1/requests",
        json={"asset_type": "ICT Equipment", "priority": "Normal", "reason": "Test notification request"},
        cookies=employee_cookies
    )
    print(f"[TEST 2] Employee submitted request: status={res.status_code}")
    assert res.status_code == 201
    request_id = res.json()["request_id"]

    # Log in as Asset Manager (Grace Nakato, email: asset.manager@ursb.go.ug)
    manager_cookies = login("asset.manager@ursb.go.ug", "Manager@1234")
    res = client.get("/api/v1/notifications/unread-count", cookies=manager_cookies)
    print(f"[TEST 3] Manager unread count after employee request: {res.json()}")
    assert res.status_code == 200
    assert res.json()["count"] > 0

    # Fetch manager's notifications
    res = client.get("/api/v1/notifications", cookies=manager_cookies)
    notifs = res.json()
    print(f"[TEST 4] Manager notifications list count: {len(notifs)}, first: {notifs[0]['title']}")
    assert res.status_code == 200
    assert len(notifs) > 0
    assert notifs[0]["notification_type"] == "REQUEST_SUBMITTED"

    # 4. Trigger Request Approved event (Admin approves the request)
    # This should notify the requesting employee (john.mukasa)
    res = client.put(
        f"/api/v1/requests/{request_id}/approve",
        json={"assigned_asset_id": "AST-ICT00001"},
        cookies=admin_cookies
    )
    print(f"[TEST 5] Admin approved request: status={res.status_code}")
    assert res.status_code == 200

    # Check employee's unread count
    res = client.get("/api/v1/notifications/unread-count", cookies=employee_cookies)
    print(f"[TEST 6] Employee unread count after approval: {res.json()}")
    assert res.status_code == 200
    assert res.json()["count"] == 1

    # Fetch employee's notifications
    res = client.get("/api/v1/notifications", cookies=employee_cookies)
    emp_notifs = res.json()
    print(f"[TEST 7] Employee first notification: {emp_notifs[0]['title']}, is_read={emp_notifs[0]['is_read']}")
    assert res.status_code == 200
    assert emp_notifs[0]["notification_type"] == "REQUEST_APPROVED"

    # 5. Trigger Assignment Sent event (Admin assigns an asset)
    # This should notify the assigned employee (john.mukasa)
    res = client.post(
        "/api/v1/assignments",
        json={"asset_id": "AST-ICT00005", "assigned_to": employee_id, "notes": "Test assignment notify"},
        cookies=admin_cookies
    )
    print(f"[TEST 8] Admin created assignment: status={res.status_code}")
    assert res.status_code == 201
    assignment_id = res.json()["assignment_id"]

    # Check employee's unread count (should now be 2)
    res = client.get("/api/v1/notifications/unread-count", cookies=employee_cookies)
    print(f"[TEST 9] Employee unread count after assignment: {res.json()}")
    assert res.status_code == 200
    assert res.json()["count"] == 2

    # 6. Test PATCH /{id}/read (Mark one notification as read)
    res = client.get("/api/v1/notifications", cookies=employee_cookies)
    emp_notifs = res.json()
    notif_id = emp_notifs[0]["notification_id"]

    # Custodian trying to read Employee's notification should fail with 403
    res = client.patch(f"/api/v1/notifications/{notif_id}/read", cookies=custodian_cookies)
    print(f"[TEST 10] Unauthorized read access returns status: {res.status_code}")
    assert res.status_code == 403

    # Employee marks own notification read
    res = client.patch(f"/api/v1/notifications/{notif_id}/read", cookies=employee_cookies)
    print(f"[TEST 11] Employee read notification returns status: {res.status_code}")
    assert res.status_code == 200
    assert res.json()["is_read"] == True

    # Unread count should decrement to 1
    res = client.get("/api/v1/notifications/unread-count", cookies=employee_cookies)
    print(f"[TEST 12] Employee unread count after single read: {res.json()}")
    assert res.json()["count"] == 1

    # 7. Test PATCH /read-all (Mark all as read)
    res = client.patch("/api/v1/notifications/read-all", cookies=employee_cookies)
    print(f"[TEST 13] Mark all read returns status: {res.status_code}")
    assert res.status_code == 200

    # Unread count should become 0
    res = client.get("/api/v1/notifications/unread-count", cookies=employee_cookies)
    print(f"[TEST 14] Employee unread count after read-all: {res.json()}")
    assert res.json()["count"] == 0

    # 8. Test Silent-Failure of Notification writes
    # We will test this by calling create_notification directly with a mock db that fails during writes,
    # and verifying it doesn't raise any exception.
    from app.services.notification_service import create_notification
    class FaultySession:
        def query(self, *args, **kwargs):
            raise Exception("Mock query database failure")
        def add(self, *args, **kwargs):
            raise Exception("Mock add database failure")
        def begin_nested(self):
            class DummyNested:
                def __enter__(self): pass
                def __exit__(self, exc_type, exc_val, exc_tb): pass
            return DummyNested()
    
    print("[TEST 15] Running silent-failure check with database exception...")
    # This call should succeed silently without throwing any errors
    create_notification(
        db=FaultySession(),
        user_id="Asset Manager",
        title="Failure Test",
        message="This should fail silently",
        notification_type="TEST_FAIL"
    )
    print("Silent-failure test passed: no exception raised.")

    # Clean up test assignment
    db = SessionLocal()
    try:
        db.query(Assignment).filter(Assignment.assignment_id == assignment_id).delete()
        db.commit()
    finally:
        db.close()

    print("=== ALL NOTIFICATION TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    test_notification_flow()
