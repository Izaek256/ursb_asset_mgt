import sys
from datetime import date, datetime
from fastapi.testclient import TestClient
from main import app
from app.db import SessionLocal
from app.models.user import User, UserRole
from app.models.asset import Asset, AssetStatus, AssetType, AssetCondition, SourceType
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit_log import AuditLog

client = TestClient(app)

def login(email, password):
    res = client.post('/api/v1/login', json={'email': email, 'password': password})
    if res.status_code != 200:
        raise Exception(f"Login failed for {email}: {res.json()}")
    return res.cookies

def setup_test_records():
    db = SessionLocal()
    try:
        # Get users from seed data
        employee1 = db.query(User).filter(User.email == "john.mukasa@ursb.go.ug").first()
        employee2 = db.query(User).filter(User.email == "sarah.namuli@ursb.go.ug").first()
        custodian = db.query(User).filter(User.email == "custodian.ict@ursb.go.ug").first()
        manager = db.query(User).filter(User.email == "asset.manager@ursb.go.ug").first()
        
        # Create a test asset
        asset1 = Asset(
            asset_id="AST-TEST0001",
            asset_name="Test Developer Laptop",
            asset_type=AssetType.ICT_EQUIPMENT,
            category="Laptops",
            serial_number="TEST-SN-0001",
            condition=AssetCondition.NEW,
            status=AssetStatus.ACTIVE,
            source_type=SourceType.PROCUREMENT,
            cost=2500000.0,
            acquisition_date=date.today(),
            supplier="Test Supplier Ltd",
            current_custodian_id=str(employee1.id)
        )
        
        asset2 = Asset(
            asset_id="AST-TEST0002",
            asset_name="Test Second Laptop",
            asset_type=AssetType.ICT_EQUIPMENT,
            category="Laptops",
            serial_number="TEST-SN-0002",
            condition=AssetCondition.NEW,
            status=AssetStatus.ACTIVE,
            source_type=SourceType.PROCUREMENT,
            cost=2500000.0,
            acquisition_date=date.today(),
            supplier="Test Supplier Ltd",
            current_custodian_id=str(employee1.id)
        )
        
        # Clean up any existing test records if run previously
        db.query(Assignment).filter(Assignment.asset_id.in_(["AST-TEST0001", "AST-TEST0002"])).delete()
        db.query(Asset).filter(Asset.asset_id.in_(["AST-TEST0001", "AST-TEST0002"])).delete()
        db.commit()
        
        db.add(asset1)
        db.add(asset2)
        db.flush()
        
        # Create a pending acceptance assignment
        assignment1 = Assignment(
            asset_id=asset1.asset_id,
            assigned_to=str(employee1.id),
            assigned_by=str(manager.id),
            assignment_date=date.today(),
            status=AssignmentStatus.PENDING_ACCEPTANCE,
            notes="Pending acceptance test"
        )
        
        # Create another pending acceptance assignment for testing decline
        assignment2 = Assignment(
            asset_id=asset2.asset_id,
            assigned_to=str(employee1.id),
            assigned_by=str(manager.id),
            assignment_date=date.today(),
            status=AssignmentStatus.PENDING_ACCEPTANCE,
            notes="Pending decline test"
        )
        
        db.add(assignment1)
        db.add(assignment2)
        db.commit()
        
        db.refresh(assignment1)
        db.refresh(assignment2)
        
        return assignment1.assignment_id, assignment2.assignment_id, employee1.id, employee2.id, custodian.id
    finally:
        db.close()

def main():
    print("=== STARTING TICKET S3-05 ENDPOINT TESTS ===")
    
    # 1. Setup test database records
    asg1_id, asg2_id, emp1_id, emp2_id, custodian_id = setup_test_records()
    print(f"Test records created. Assignment 1 ID: {asg1_id}, Assignment 2 ID: {asg2_id}")
    
    # Login cookies
    cookies_emp1 = login("john.mukasa@ursb.go.ug", "Employee@1234")
    cookies_emp2 = login("sarah.namuli@ursb.go.ug", "Employee@1234")
    cookies_custodian = login("custodian.ict@ursb.go.ug", "Custodian@1234")
    cookies_admin = login("admin@ursb.go.ug", "Admin@1234")
    
    # TEST 1: Role guard for /accept (Only Employee role allowed)
    print("\n[TEST 1] Role guard for /accept (Non-Employee Admin role should fail with 403)")
    client.cookies = cookies_admin
    res = client.post(f"/api/v1/assignments/{asg1_id}/accept")
    print(f"Response status: {res.status_code}, detail: {res.json().get('detail')}")
    assert res.status_code == 403, "Admin should be forbidden to accept"
    
    print("[TEST 1b] Role guard for /accept (Non-Employee Custodian role should fail with 403)")
    client.cookies = cookies_custodian
    res = client.post(f"/api/v1/assignments/{asg1_id}/accept")
    print(f"Response status: {res.status_code}, detail: {res.json().get('detail')}")
    assert res.status_code == 403, "Custodian should be forbidden to accept"

    # TEST 2: Ownership guard for /accept (Must belong to current employee)
    print("\n[TEST 2] Ownership guard for /accept (Wrong employee should fail with 403)")
    client.cookies = cookies_emp2
    res = client.post(f"/api/v1/assignments/{asg1_id}/accept")
    print(f"Response status: {res.status_code}, detail: {res.json().get('detail')}")
    assert res.status_code == 403, "Wrong employee should be forbidden to accept"

    # TEST 3: Status guard for /accept (Must be in Pending Acceptance)
    print("\n[TEST 3] Status guard for /accept (Status ACTIVE assignment should fail with 422)")
    # Get an active assignment from seed
    db = SessionLocal()
    active_asg = db.query(Assignment).filter(Assignment.status == AssignmentStatus.ACTIVE).first()
    db.close()
    if active_asg:
        client.cookies = cookies_emp1
        # Set assigned_to temporarily to employee1 for this test case
        db = SessionLocal()
        orig_assigned_to = active_asg.assigned_to
        active_asg.assigned_to = str(emp1_id)
        db.add(active_asg)
        db.commit()
        
        res = client.post(f"/api/v1/assignments/{active_asg.assignment_id}/accept")
        print(f"Response status: {res.status_code}, detail: {res.json().get('detail')}")
        assert res.status_code == 422, "Active assignment acceptance should fail with 422"
        
        # Restore assigned_to
        active_asg.assigned_to = orig_assigned_to
        db.add(active_asg)
        db.commit()
        db.close()
    else:
        print("Skipped: no active assignments found")

    # TEST 4: Successful Acceptance
    print("\n[TEST 4] Successful acceptance (Employee accepts own pending assignment)")
    client.cookies = cookies_emp1
    res = client.post(f"/api/v1/assignments/{asg1_id}/accept")
    print(f"Response status: {res.status_code}")
    assert res.status_code == 200, "Should successfully accept"
    res_data = res.json()
    assert res_data["status"] == "Accepted", f"Assignment status should be Accepted, got {res_data['status']}"
    
    # Assert DB State
    db = SessionLocal()
    db_asg = db.query(Assignment).filter(Assignment.assignment_id == asg1_id).first()
    db_asset = db.query(Asset).filter(Asset.asset_id == db_asg.asset_id).first()
    print(f"DB Assignment Status: {db_asg.status.value}, DB Asset Status: {db_asset.status.value}")
    assert db_asg.status == AssignmentStatus.ACCEPTED
    assert db_asset.status == AssetStatus.PENDING_PICKUP
    
    # Verify Audit Log
    audit = db.query(AuditLog).filter(AuditLog.record_id == str(asg1_id), AuditLog.action == "ASSIGNMENT_ACCEPTED").first()
    assert audit is not None, "Audit log entry ASSIGNMENT_ACCEPTED should be written"
    print(f"Audit log verified: user_id={audit.user_id}, action={audit.action}, record_id={audit.record_id}")
    db.close()

    # TEST 5: Successful Decline
    print("\n[TEST 5] Successful decline (Employee declines own pending assignment)")
    client.cookies = cookies_emp1
    res = client.post(f"/api/v1/assignments/{asg2_id}/decline")
    print(f"Response status: {res.status_code}")
    assert res.status_code == 200, "Should successfully decline"
    res_data = res.json()
    assert res_data["status"] == "Declined", f"Assignment status should be Declined, got {res_data['status']}"
    
    # Assert DB State
    db = SessionLocal()
    db_asg2 = db.query(Assignment).filter(Assignment.assignment_id == asg2_id).first()
    db_asset2 = db.query(Asset).filter(Asset.asset_id == db_asg2.asset_id).first()
    print(f"DB Assignment Status: {db_asg2.status.value}, DB Asset Status: {db_asset2.status.value}, Current Custodian: {db_asset2.current_custodian_id}")
    assert db_asg2.status == AssignmentStatus.DECLINED
    assert db_asset2.status == AssetStatus.AVAILABLE
    assert db_asset2.current_custodian_id is None, "Custodian should be cleared on decline"
    
    # Verify Audit Log
    audit2 = db.query(AuditLog).filter(AuditLog.record_id == str(asg2_id), AuditLog.action == "ASSIGNMENT_DECLINED").first()
    assert audit2 is not None, "Audit log entry ASSIGNMENT_DECLINED should be written"
    db.close()

    # TEST 6: Handover Role Guards (Only Custodian allowed)
    print("\n[TEST 6] Handover role guards (Employee trying to confirm handover should fail with 403)")
    client.cookies = cookies_emp1
    res = client.post(f"/api/v1/assignments/{asg1_id}/confirm-handover")
    print(f"Response status: {res.status_code}, detail: {res.json().get('detail')}")
    assert res.status_code == 403, "Employee role should be forbidden to confirm handover"

    # TEST 7: Handover Status Guards (Must be in Accepted status)
    print("\n[TEST 7] Handover status guards (Declined assignment handover should fail with 422)")
    client.cookies = cookies_custodian
    res = client.post(f"/api/v1/assignments/{asg2_id}/confirm-handover")
    print(f"Response status: {res.status_code}, detail: {res.json().get('detail')}")
    assert res.status_code == 422, "Declined assignment handover should fail with 422"

    # TEST 8: Successful Handover Confirmation (Custodian confirm handover)
    print("\n[TEST 8] Successful Handover Confirmation (Custodian confirms handover)")
    client.cookies = cookies_custodian
    res = client.post(f"/api/v1/assignments/{asg1_id}/confirm-handover")
    print(f"Response status: {res.status_code}")
    assert res.status_code == 200, "Should successfully confirm handover"
    res_data = res.json()
    assert res_data["status"] == "Active", f"Assignment status should be Active, got {res_data['status']}"
    assert res_data["acknowledged_at"] is not None, "acknowledged_at should be populated"
    print(f"Handover result acknowledged_at: {res_data['acknowledged_at']}")
    
    # Assert DB State
    db = SessionLocal()
    db_asg = db.query(Assignment).filter(Assignment.assignment_id == asg1_id).first()
    db_asset = db.query(Asset).filter(Asset.asset_id == db_asg.asset_id).first()
    print(f"DB Assignment Status: {db_asg.status.value}, DB Asset Status: {db_asset.status.value}, Acknowledged: {db_asg.acknowledged_at}")
    assert db_asg.status == AssignmentStatus.ACTIVE
    assert db_asset.status == AssetStatus.ASSIGNED
    assert db_asg.acknowledged_at is not None
    
    # Verify Audit Log
    audit3 = db.query(AuditLog).filter(AuditLog.record_id == str(asg1_id), AuditLog.action == "HANDOVER_CONFIRMED").first()
    assert audit3 is not None, "Audit log entry HANDOVER_CONFIRMED should be written"
    print(f"Audit log verified: user_id={audit3.user_id}, action={audit3.action}")
    db.close()

    # Clean up test assets and assignments
    db = SessionLocal()
    db.query(Assignment).filter(Assignment.asset_id.in_(["AST-TEST0001", "AST-TEST0002"])).delete()
    db.query(Asset).filter(Asset.asset_id.in_(["AST-TEST0001", "AST-TEST0002"])).delete()
    db.commit()
    db.close()
    
    print("\n=== ALL TESTS PASSED SUCCESSFULLY ===")

if __name__ == '__main__':
    main()
