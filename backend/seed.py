"""
seed.py — URSB Asset Management System
Seed Script: populates the database with realistic sample data.

Usage:
    python seed.py                        # uses DATABASE_URL from .env or defaults to SQLite
    DATABASE_URL=sqlite:///./ursb_asset.db python seed.py

Features:
  - Idempotent: safe to run multiple times -- existing records are skipped, not duplicated
  - Covers all user roles, asset types, statuses, and required related records
  - All passwords are securely hashed with pbkdf2_hmac (sha256)
"""

import os
import sys
import uuid
from datetime import date, datetime, timedelta

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from dotenv import load_dotenv
load_dotenv()

from app.services.auth import create_password_hash as _create_password_hash
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models import (
    Asset, AssetCondition, AssetStatus, AssetType,
    Assignment, AssignmentStatus,
    AuditLog,
    DisposalMethod, DisposalRecord,
    MaintenanceRecord,
    SourceType, Transfer,
    User, UserRole,
)

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ursb_asset.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)

if DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
def hash_password(plain: str):
    """Returns (salt, password_hash) tuple using the same algorithm as the auth service."""
    salt, hashed = _create_password_hash(plain)
    return salt, hashed


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------
def uid(user) -> str:
    """Cast user.user_id (int PK) to str for String FK columns in related tables."""
    return str(user.user_id)


def get_or_create_user(db, *, email: str, first_name: str, last_name: str,
                        username: str, role: UserRole, department: str,
                        password: str, phone_number: str = None) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    salt, hashed = hash_password(password)
    user = User(
        # No user_id= here: let the Integer auto-increment PK be assigned by SQLite
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
        password_hash=hashed,
        password_salt=salt,
        role=role,
        department=department,
        is_active=True,
        failed_login_attempts=0,
    )
    db.add(user)
    db.flush()
    return user


def get_or_create_asset(db, *, asset_id: str, **kwargs) -> Asset:
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if asset:
        return asset
    asset = Asset(asset_id=asset_id, **kwargs)
    db.add(asset)
    db.flush()
    return asset


# ---------------------------------------------------------------------------
# Main seed function
# ---------------------------------------------------------------------------
def seed():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("  URSB Asset Management System - Database Seeder")
        print("=" * 60)

        # ----------------------------------------------------------------
        # 1. USERS
        # ----------------------------------------------------------------
        print("\n[1/6] Seeding users...")

        super_admin = get_or_create_user(
            db,
            email="superadmin@ursb.go.ug",
            first_name="James", last_name="Mugisha",
            username="james.mugisha",
            role=UserRole.SUPER_SYSTEM_ADMINISTRATOR,
            department="ICT",
            phone_number="+256701000000",
            password="SuperAdmin@1234",
        )
        admin = get_or_create_user(
            db,
            email="admin@ursb.go.ug",
            first_name="Robert", last_name="Ssekandi",
            username="robert.ssekandi",
            role=UserRole.SYSTEM_ADMINISTRATOR,
            department="ICT",
            phone_number="+256701000001",
            password="Admin@1234",
        )
        manager = get_or_create_user(
            db,
            email="asset.manager@ursb.go.ug",
            first_name="Grace", last_name="Nakato",
            username="grace.nakato",
            role=UserRole.ASSET_MANAGER,
            department="Finance & Administration",
            phone_number="+256701000002",
            password="Manager@1234",
        )
        custodian1 = get_or_create_user(
            db,
            email="custodian.ict@ursb.go.ug",
            first_name="Daniel", last_name="Ochieng",
            username="daniel.ochieng",
            role=UserRole.ASSET_CUSTODIAN,
            department="ICT",
            phone_number="+256701000003",
            password="Custodian@1234",
        )
        custodian2 = get_or_create_user(
            db,
            email="custodian.admin@ursb.go.ug",
            first_name="Patricia", last_name="Auma",
            username="patricia.auma",
            role=UserRole.ASSET_CUSTODIAN,
            department="Administration",
            phone_number="+256701000004",
            password="Custodian@1234",
        )
        employee1 = get_or_create_user(
            db,
            email="john.mukasa@ursb.go.ug",
            first_name="John", last_name="Mukasa",
            username="john.mukasa",
            role=UserRole.EMPLOYEE,
            department="Legal",
            phone_number="+256701000005",
            password="Employee@1234",
        )
        employee2 = get_or_create_user(
            db,
            email="sarah.namuli@ursb.go.ug",
            first_name="Sarah", last_name="Namuli",
            username="sarah.namuli",
            role=UserRole.EMPLOYEE,
            department="Registry",
            phone_number="+256701000006",
            password="Employee@1234",
        )
        employee3 = get_or_create_user(
            db,
            email="peter.opio@ursb.go.ug",
            first_name="Peter", last_name="Opio",
            username="peter.opio",
            role=UserRole.EMPLOYEE,
            department="Finance & Administration",
            phone_number="+256701000007",
            password="Employee@1234",
        )

        db.commit()
        print(f"   [OK] {db.query(User).count()} users in database")

        # ----------------------------------------------------------------
        # 2. ASSETS -- 22 assets across all types and statuses
        # ----------------------------------------------------------------
        print("\n[2/6] Seeding assets...")

        assets_data = [
            # --- ICT Equipment (Active / Assigned) ---
            {
                "asset_id": "AST-ICT00001", "asset_name": "Dell Latitude 5540 Laptop",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Laptops",
                "serial_number": "DL5540-UG-001", "condition": AssetCondition.NEW,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2024/ICT/001", "cost": 3_200_000,
                "acquisition_date": date(2024, 3, 10), "supplier": "Dawa Technologies Uganda Ltd",
                "current_custodian_id": uid(custodian1), "department": "ICT",
            },
            {
                "asset_id": "AST-ICT00002", "asset_name": "HP LaserJet Pro M404dn Printer",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Printers",
                "serial_number": "HPLJ-M404-002", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2023/ICT/012", "cost": 1_450_000,
                "acquisition_date": date(2023, 7, 15), "supplier": "Dawa Technologies Uganda Ltd",
                "current_custodian_id": uid(custodian1), "department": "ICT",
            },
            {
                "asset_id": "AST-ICT00003", "asset_name": "Cisco Catalyst 2960 Network Switch",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Networking",
                "serial_number": "CSCO-2960-UG-003", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2023/ICT/008", "cost": 4_800_000,
                "acquisition_date": date(2023, 1, 20), "supplier": "Infocom Networks Uganda",
                "current_custodian_id": uid(custodian1), "department": "ICT",
            },
            {
                "asset_id": "AST-ICT00004", "asset_name": "Samsung 55\" LED Conference Room Display",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Displays",
                "serial_number": "SAM-LED55-004", "condition": AssetCondition.NEW,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2024/ICT/005", "cost": 2_100_000,
                "acquisition_date": date(2024, 5, 2), "supplier": "Dawa Technologies Uganda Ltd",
                "current_custodian_id": uid(custodian1), "department": "Administration",
            },
            {
                "asset_id": "AST-ICT00005", "asset_name": "APC Smart-UPS 1500VA",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Power Equipment",
                "serial_number": "APC-1500-UG-005", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2022/ICT/019", "cost": 1_200_000,
                "acquisition_date": date(2022, 11, 8), "supplier": "PowerTech Uganda",
                "current_custodian_id": uid(custodian1), "department": "ICT",
            },
            {
                "asset_id": "AST-ICT00006", "asset_name": "Lenovo ThinkCentre Desktop",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Desktop Computers",
                "serial_number": "LNV-TC-006", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2023/ICT/022", "cost": 2_500_000,
                "acquisition_date": date(2023, 4, 18), "supplier": "Dawa Technologies Uganda Ltd",
                "current_custodian_id": uid(employee1), "department": "Legal",
            },
            {
                "asset_id": "AST-ICT00007", "asset_name": "Logitech MeetUp Conference Camera",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Conferencing Equipment",
                "serial_number": "LGT-MTUP-007", "condition": AssetCondition.NEW,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2024/ICT/009", "cost": 1_800_000,
                "acquisition_date": date(2024, 2, 14), "supplier": "Infocom Networks Uganda",
                "current_custodian_id": uid(custodian2), "department": "Administration",
            },
            # --- Furniture (Active / Assigned) ---
            {
                "asset_id": "AST-FRN00001", "asset_name": "Executive Office Desk (Mahogany)",
                "asset_type": AssetType.FURNITURE, "category": "Desks",
                "serial_number": "FRN-DESK-008", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2022/ADM/003", "cost": 850_000,
                "acquisition_date": date(2022, 6, 1), "supplier": "Quality Furniture Uganda",
                "current_custodian_id": uid(custodian2), "department": "Administration",
            },
            {
                "asset_id": "AST-FRN00002", "asset_name": "Ergonomic Office Chair (Set of 10)",
                "asset_type": AssetType.FURNITURE, "category": "Chairs",
                "serial_number": "FRN-CHAIR-009", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2022/ADM/004", "cost": 3_500_000,
                "acquisition_date": date(2022, 6, 1), "supplier": "Quality Furniture Uganda",
                "current_custodian_id": uid(custodian2), "department": "Administration",
            },
            {
                "asset_id": "AST-FRN00003", "asset_name": "6-Seater Conference Table",
                "asset_type": AssetType.FURNITURE, "category": "Tables",
                "serial_number": "FRN-TABLE-010", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2021/ADM/007", "cost": 1_200_000,
                "acquisition_date": date(2021, 9, 14), "supplier": "Quality Furniture Uganda",
                "current_custodian_id": uid(custodian2), "department": "Registry",
            },
            # --- Vehicles (Active / Assigned) ---
            {
                "asset_id": "AST-VEH00001", "asset_name": "Toyota Land Cruiser Prado (UAG 001A)",
                "asset_type": AssetType.VEHICLE, "category": "SUVs",
                "serial_number": "TLC-PRADO-UAG001A", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2021/VEH/001", "cost": 120_000_000,
                "acquisition_date": date(2021, 3, 5), "supplier": "CFAO Motors Uganda",
                "current_custodian_id": uid(manager), "department": "Finance & Administration",
            },
            {
                "asset_id": "AST-VEH00002", "asset_name": "Toyota Hilux Double Cab (UAG 002B)",
                "asset_type": AssetType.VEHICLE, "category": "Pick-Up Trucks",
                "serial_number": "TYT-HLUX-UAG002B", "condition": AssetCondition.GOOD,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2022/VEH/002", "cost": 95_000_000,
                "acquisition_date": date(2022, 8, 22), "supplier": "CFAO Motors Uganda",
                "current_custodian_id": uid(employee3), "department": "Finance & Administration",
            },
            # --- Software (Active / Assigned) ---
            {
                "asset_id": "AST-SFT00001", "asset_name": "Microsoft Office 365 Business Premium (25 Seats)",
                "asset_type": AssetType.SOFTWARE, "category": "Productivity Software",
                "serial_number": "MS-O365-URSB-2024", "condition": AssetCondition.NEW,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2024/SFT/001", "cost": 8_750_000,
                "acquisition_date": date(2024, 1, 1), "supplier": "Microsoft East Africa",
                "current_custodian_id": uid(admin), "department": "ICT",
            },
            {
                "asset_id": "AST-SFT00002", "asset_name": "Kaspersky Endpoint Security (50 Licenses)",
                "asset_type": AssetType.SOFTWARE, "category": "Security Software",
                "serial_number": "KSP-ES-URSB-2024", "condition": AssetCondition.NEW,
                "status": AssetStatus.ASSIGNED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2024/SFT/002", "cost": 5_600_000,
                "acquisition_date": date(2024, 1, 15), "supplier": "Infocom Networks Uganda",
                "current_custodian_id": uid(admin), "department": "ICT",
            },
            # --- Available (In Storage) ---
            {
                "asset_id": "AST-ICT00008", "asset_name": "HP EliteBook 840 G5 Laptop",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Laptops",
                "serial_number": "HP-EB840-015", "condition": AssetCondition.REFURBISHED,
                "status": AssetStatus.AVAILABLE, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2020/ICT/031", "cost": 2_800_000,
                "acquisition_date": date(2020, 5, 10), "supplier": "Dawa Technologies Uganda Ltd",
                "current_custodian_id": None, "department": None,
            },
            {
                "asset_id": "AST-FRN00004", "asset_name": "Steel Filing Cabinet (4-Drawer)",
                "asset_type": AssetType.FURNITURE, "category": "Storage",
                "serial_number": "FRN-CABINET-016", "condition": AssetCondition.GOOD,
                "status": AssetStatus.AVAILABLE, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2021/ADM/012", "cost": 450_000,
                "acquisition_date": date(2021, 11, 3), "supplier": "Quality Furniture Uganda",
                "current_custodian_id": None, "department": None,
            },
            {
                "asset_id": "AST-ICT00009", "asset_name": "Epson EcoTank L3150 Printer",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Printers",
                "serial_number": "EPS-L3150-017", "condition": AssetCondition.GOOD,
                "status": AssetStatus.AVAILABLE, "source_type": SourceType.DONATION,
                "procurement_ref": None, "cost": 680_000,
                "acquisition_date": date(2022, 3, 8), "supplier": "USAID Uganda Programme",
                "current_custodian_id": None, "department": None,
            },
            # --- Under Maintenance ---
            {
                "asset_id": "AST-VEH00003", "asset_name": "Isuzu NPR Box Truck (UAG 003C)",
                "asset_type": AssetType.VEHICLE, "category": "Trucks",
                "serial_number": "ISZ-NPR-UAG003C", "condition": AssetCondition.DAMAGED,
                "status": AssetStatus.UNDER_MAINTENANCE, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2019/VEH/003", "cost": 75_000_000,
                "acquisition_date": date(2019, 6, 20), "supplier": "CFAO Motors Uganda",
                "current_custodian_id": None, "department": "Finance & Administration",
            },
            {
                "asset_id": "AST-ICT00010", "asset_name": "Dell PowerEdge T440 Server",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Servers",
                "serial_number": "DEL-T440-SRV-019", "condition": AssetCondition.DAMAGED,
                "status": AssetStatus.UNDER_MAINTENANCE, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2020/ICT/007", "cost": 18_500_000,
                "acquisition_date": date(2020, 2, 14), "supplier": "Infocom Networks Uganda",
                "current_custodian_id": custodian1.user_id, "department": "ICT",
            },
            # --- Disposed ---
            {
                "asset_id": "AST-ICT00011", "asset_name": "Dell OptiPlex 390 Desktop (EOL)",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Desktop Computers",
                "serial_number": "DEL-OPX390-020", "condition": AssetCondition.DAMAGED,
                "status": AssetStatus.DISPOSED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2015/ICT/003", "cost": 1_100_000,
                "acquisition_date": date(2015, 4, 5), "supplier": "Dawa Technologies Uganda Ltd",
                "current_custodian_id": None, "department": None,
            },
            {
                "asset_id": "AST-FRN00005", "asset_name": "Wooden Reception Desk (Old Design)",
                "asset_type": AssetType.FURNITURE, "category": "Desks",
                "serial_number": "FRN-RDESK-021", "condition": AssetCondition.DAMAGED,
                "status": AssetStatus.DISPOSED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2012/ADM/001", "cost": 600_000,
                "acquisition_date": date(2012, 1, 15), "supplier": "Quality Furniture Uganda",
                "current_custodian_id": None, "department": None,
            },
            {
                "asset_id": "AST-ICT00012", "asset_name": "Compaq Presario Desktop PC",
                "asset_type": AssetType.ICT_EQUIPMENT, "category": "Desktop Computers",
                "serial_number": "CPQ-PRES-022", "condition": AssetCondition.DAMAGED,
                "status": AssetStatus.DISPOSED, "source_type": SourceType.PROCUREMENT,
                "procurement_ref": "PROC/2011/ICT/009", "cost": 800_000,
                "acquisition_date": date(2011, 7, 20), "supplier": "Dawa Technologies Uganda Ltd",
                "current_custodian_id": None, "department": None,
            },
        ]

        for data in assets_data:
            get_or_create_asset(db, **data)

        db.commit()
        print(f"   [OK] {db.query(Asset).count()} assets in database")

        # ----------------------------------------------------------------
        # 3. ASSIGNMENTS
        # ----------------------------------------------------------------
        print("\n[3/6] Seeding assignments...")

        assignments_data = [
            {
                "asset_id": "AST-ICT00001", "assigned_to": uid(custodian1),
                "assigned_by": uid(manager), "assignment_date": date(2024, 3, 12),
                "status": AssignmentStatus.ACTIVE, "notes": "Primary ICT custodian laptop.",
            },
            {
                "asset_id": "AST-ICT00006", "assigned_to": uid(employee1),
                "assigned_by": uid(manager), "assignment_date": date(2023, 4, 20),
                "status": AssignmentStatus.ACTIVE, "notes": "Assigned for Legal department use.",
            },
            {
                "asset_id": "AST-VEH00002", "assigned_to": uid(employee3),
                "assigned_by": uid(manager), "assignment_date": date(2022, 9, 1),
                "status": AssignmentStatus.ACTIVE,
                "notes": "Assigned for Finance & Administration field operations.",
            },
            {
                "asset_id": "AST-ICT00008", "assigned_to": uid(employee2),
                "assigned_by": uid(manager), "assignment_date": date(2021, 6, 1),
                "return_date": date(2023, 12, 31), "status": AssignmentStatus.RETURNED,
                "notes": "Returned after upgrade cycle; asset sent to storage.",
            },
        ]

        for a in assignments_data:
            existing = db.query(Assignment).filter(
                Assignment.asset_id == a["asset_id"],
                Assignment.assigned_to == a["assigned_to"],
                Assignment.status == a["status"],
            ).first()
            if not existing:
                db.add(Assignment(**a))

        db.commit()
        print(f"   [OK] {db.query(Assignment).count()} assignments in database")

        # ----------------------------------------------------------------
        # 4. MAINTENANCE RECORDS
        # ----------------------------------------------------------------
        print("\n[4/6] Seeding maintenance records...")

        maintenance_data = [
            {
                "asset_id": "AST-VEH00003", "service_date": date(2024, 4, 10),
                "service_provider": "Uganda Motors Limited",
                "description": (
                    "Engine overhaul following coolant leak and overheating. "
                    "Replaced radiator, thermostat, and water pump. "
                    "Full service including oil and filter change."
                ),
                "cost": 4_800_000, "next_service_date": date(2024, 10, 10),
                "recorded_by": uid(manager),
            },
            {
                "asset_id": "AST-VEH00001", "service_date": date(2024, 1, 15),
                "service_provider": "CFAO Motors Uganda",
                "description": "Routine 40,000 km service. Oil, air and fuel filters replaced. Brake pads inspected and cleared.",
                "cost": 1_200_000, "next_service_date": date(2024, 7, 15),
                "recorded_by": uid(manager),
            },
            {
                "asset_id": "AST-ICT00010", "service_date": date(2024, 5, 20),
                "service_provider": "Dell Technologies Uganda Support",
                "description": (
                    "RAID controller failure diagnosis and replacement. "
                    "Two failed HDDs replaced under extended warranty. "
                    "Server firmware updated to latest version."
                ),
                "cost": 2_500_000, "next_service_date": date(2025, 5, 20),
                "recorded_by": uid(custodian1),
            },
            {
                "asset_id": "AST-ICT00002", "service_date": date(2024, 2, 28),
                "service_provider": "PrintSolutions Uganda",
                "description": "Fuser unit replaced. Paper feed rollers cleaned and lubricated. Test pages confirmed print quality.",
                "cost": 320_000, "next_service_date": date(2025, 2, 28),
                "recorded_by": uid(custodian1),
            },
        ]

        for m in maintenance_data:
            existing = db.query(MaintenanceRecord).filter(
                MaintenanceRecord.asset_id == m["asset_id"],
                MaintenanceRecord.service_date == m["service_date"],
                MaintenanceRecord.service_provider == m["service_provider"],
            ).first()
            if not existing:
                db.add(MaintenanceRecord(**m))

        db.commit()
        print(f"   [OK] {db.query(MaintenanceRecord).count()} maintenance records in database")

        # ----------------------------------------------------------------
        # 5. DISPOSAL RECORDS
        # ----------------------------------------------------------------
        print("\n[5/6] Seeding disposal and audit records...")

        disposal_data = [
            {
                "asset_id": "AST-ICT00011", "disposal_date": date(2024, 3, 1),
                "disposal_method": DisposalMethod.WRITE_OFF,
                "reason": (
                    "Asset reached end of useful life after 9 years of service. "
                    "Motherboard failure; repair cost exceeds replacement value. "
                    "Board resolution ref: URSB/BD/2024/RES/003 approved write-off."
                ),
                "authorised_by": uid(manager),
            },
            {
                "asset_id": "AST-FRN00005", "disposal_date": date(2023, 11, 30),
                "disposal_method": DisposalMethod.DESTRUCTION,
                "reason": (
                    "Wooden reception desk severely damaged by water ingress during "
                    "office renovation. Structurally unsafe for use. Disposed per "
                    "Public Finance Management Act guidelines."
                ),
                "authorised_by": uid(manager),
            },
            {
                "asset_id": "AST-ICT00012", "disposal_date": date(2023, 6, 15),
                "disposal_method": DisposalMethod.DONATION,
                "reason": (
                    "Obsolete desktop PC donated to Nakasero Primary School under "
                    "URSB community outreach programme. Asset fully functional but "
                    "no longer meets minimum specifications for office use."
                ),
                "authorised_by": uid(admin),
            },
        ]

        for d in disposal_data:
            existing = db.query(DisposalRecord).filter(
                DisposalRecord.asset_id == d["asset_id"],
                DisposalRecord.disposal_date == d["disposal_date"],
            ).first()
            if not existing:
                db.add(DisposalRecord(**d))

        db.commit()
        print(f"   [OK] {db.query(DisposalRecord).count()} disposal records in database")

        # ----------------------------------------------------------------
        # 6. AUDIT LOGS
        # ----------------------------------------------------------------
        now = datetime(2024, 6, 1, 8, 0, 0)

        audit_data = [
            {
                "user_id": uid(admin), "action": "LOGIN",
                "table_affected": "users", "record_id": uid(admin),
                "details": "System Administrator logged in from IP 196.43.12.5.",
                "timestamp": now,
            },
            {
                "user_id": uid(admin), "action": "CREATE",
                "table_affected": "users", "record_id": uid(custodian1),
                "details": f"Created new user account for {custodian1.first_name} {custodian1.last_name} "
                           f"with role '{custodian1.role}' in department '{custodian1.department}'.",
                "timestamp": now + timedelta(minutes=5),
            },
            {
                "user_id": uid(manager), "action": "CREATE",
                "table_affected": "assets", "record_id": "AST-ICT00001",
                "details": "Registered new asset 'Dell Latitude 5540 Laptop' (SN: DL5540-UG-001). "
                           "Procurement ref: PROC/2024/ICT/001. Value: UGX 3,200,000.",
                "timestamp": now + timedelta(minutes=30),
            },
            {
                "user_id": uid(manager), "action": "UPDATE",
                "table_affected": "assets", "record_id": "AST-VEH00003",
                "details": "Asset status changed from 'Active' to 'Under Maintenance'. "
                           "Reason: Engine overhaul required. Sent to Uganda Motors Limited.",
                "timestamp": now + timedelta(hours=1),
            },
            {
                "user_id": uid(manager), "action": "CREATE",
                "table_affected": "disposal_records", "record_id": "AST-ICT00011",
                "details": "Disposal record created for 'Dell OptiPlex 390 Desktop'. "
                           "Method: Write-off. Board resolution ref: URSB/BD/2024/RES/003.",
                "timestamp": now + timedelta(hours=2),
            },
            {
                "user_id": uid(admin), "action": "UPDATE",
                "table_affected": "users", "record_id": uid(employee2),
                "details": f"User account for {employee2.first_name} {employee2.last_name} password reset by System Administrator.",
                "timestamp": now + timedelta(hours=3),
            },
            {
                "user_id": uid(custodian1), "action": "CREATE",
                "table_affected": "maintenance_records", "record_id": "AST-ICT00010",
                "details": "Maintenance record created for 'Dell PowerEdge T440 Server'. "
                           "Provider: Dell Technologies Uganda Support. Cost: UGX 2,500,000.",
                "timestamp": now + timedelta(hours=4),
            },
            {
                "user_id": uid(manager), "action": "CREATE",
                "table_affected": "assignments", "record_id": "AST-VEH00002",
                "details": f"Asset 'Toyota Hilux Double Cab' assigned to {employee3.first_name} {employee3.last_name} "
                           f"(Finance & Administration) effective 2022-09-01.",
                "timestamp": now + timedelta(hours=5),
            },
        ]

        for entry in audit_data:
            existing = db.query(AuditLog).filter(
                AuditLog.user_id == entry["user_id"],
                AuditLog.action == entry["action"],
                AuditLog.table_affected == entry["table_affected"],
                AuditLog.record_id == entry["record_id"],
            ).first()
            if not existing:
                db.add(AuditLog(**entry))

        db.commit()
        print(f"   [OK] {db.query(AuditLog).count()} audit log entries in database")

        # ----------------------------------------------------------------
        # Summary
        # ----------------------------------------------------------------
        print("\n" + "=" * 60)
        print("  Seeding complete! Summary:")
        print("=" * 60)
        print(f"  Users              : {db.query(User).count()}")
        print(f"  Assets             : {db.query(Asset).count()}")
        print(f"    Assigned         : {db.query(Asset).filter(Asset.status == AssetStatus.ASSIGNED).count()}")
        print(f"    Available        : {db.query(Asset).filter(Asset.status == AssetStatus.AVAILABLE).count()}")
        print(f"    Under Maintenance: {db.query(Asset).filter(Asset.status == AssetStatus.UNDER_MAINTENANCE).count()}")
        print(f"    Disposed         : {db.query(Asset).filter(Asset.status == AssetStatus.DISPOSED).count()}")
        print(f"  Assignments        : {db.query(Assignment).count()}")
        print(f"  Maintenance Records: {db.query(MaintenanceRecord).count()}")
        print(f"  Disposal Records   : {db.query(DisposalRecord).count()}")
        print(f"  Audit Log Entries  : {db.query(AuditLog).count()}")
        print("=" * 60)
        print("\n  Default Credentials:")
        print("  +--------------------------------------------------------------------------+")
        print("  | Role                      | Email                    | Password       |")
        print("  +--------------------------------------------------------------------------+")
        print("  | Super System Administrator| superadmin@ursb.go.ug    | SuperAdmin@1234|")
        print("  | System Administrator      | admin@ursb.go.ug         | Admin@1234     |")
        print("  | Asset Manager             | asset.manager@ursb.go.ug | Manager@1234   |")
        print("  | Asset Custodian (ICT)     | custodian.ict@ursb.go.ug | Custodian@1234 |")
        print("  | Asset Custodian (Adm)     | custodian.admin@ursb.go.ug| Custodian@1234 |")
        print("  | Employee                  | john.mukasa@ursb.go.ug   | Employee@1234  |")
        print("  +--------------------------------------------------------------------------+")
        print("")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()