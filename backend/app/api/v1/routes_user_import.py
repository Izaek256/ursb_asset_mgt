"""Bulk user import routes for CSV and XLSX file processing."""

import secrets
import string
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.models.temporary_password import TemporaryPassword
from app.api.v1.auth import get_current_user, require_roles
from app.services.auth import create_password_hash, validate_ursb_email

router = APIRouter(prefix="/api/v1/users", tags=["user-import"])


def generate_secure_password() -> str:
    """
    Generate a cryptographically random secure password.

    Requirements:
    - Minimum 12 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one digit (0-9)
    - At least one special character from !@#$%^&*

    Uses Python's secrets module for cryptographic randomness.
    The generated value is returned once and never stored.
    """
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*"

    # Ensure at least one character from each required set
    password = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    # Fill the rest with random characters from all sets
    all_chars = uppercase + lowercase + digits + special
    for _ in range(8):  # 8 more characters to reach minimum 12
        password.append(secrets.choice(all_chars))

    # Shuffle to avoid predictable pattern
    secrets.SystemRandom().shuffle(password)

    return ''.join(password)


class BulkImportError(BaseModel):
    row: int
    email: Optional[str]
    reason: str


class BulkImportAccount(BaseModel):
    full_name: str
    email: str
    role: str
    generated_password: str


class BulkImportResponse(BaseModel):
    total_rows: int
    created: int
    skipped: int
    errors: List[BulkImportError]
    accounts: List[BulkImportAccount]


@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("System Administrator")),
):
    """
    Bulk import users from CSV or XLSX file.

    Per-row validation order:
    1. Email format validation
    2. Duplicate email check
    3. Role validity check

    All valid rows are inserted in a single transaction. If the transaction fails,
    no rows are inserted.

    The accounts array in the response contains credentials for all successfully
    created accounts. This is the only time these passwords are available.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_ext = file.filename.lower().split('.')[-1]
    if file_ext not in ['csv', 'xlsx']:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are accepted")
    
    # Validate file size (2 MB max)
    MAX_SIZE = 2 * 1024 * 1024  # 2 MB
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 2 MB limit")
    
    # Parse file based on extension
    rows = []
    if file_ext == 'csv':
        import io
        import csv
        csv_file = io.StringIO(content.decode('utf-8'))
        reader = csv.DictReader(csv_file)
        rows = list(reader)
    else:  # xlsx
        import io
        import openpyxl
        xlsx_file = io.BytesIO(content)
        workbook = openpyxl.load_workbook(xlsx_file)
        sheet = workbook.active
        headers = [cell.value for cell in sheet[1]]
        rows = []
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if any(cell is not None for cell in row):
                rows.append(dict(zip(headers, row)))
    
    total_rows = len(rows)
    errors = []
    accounts_to_create = []
    
    # Per-row validation
    for idx, row in enumerate(rows, start=2):  # Start at 2 (1-based index after header)
        email = row.get('email', '').strip()
        full_name = row.get('full_name', '').strip()
        role = row.get('role', '').strip()
        department = row.get('department', '').strip()
        
        # Skip if required fields missing
        if not email or not full_name or not role:
            errors.append(BulkImportError(
                row=idx,
                email=email or None,
                reason="Missing required field (full_name, email, or role)"
            ))
            continue
        
        # Validate email format
        if '@' not in email or '.' not in email:
            errors.append(BulkImportError(
                row=idx,
                email=email,
                reason="Invalid email format"
            ))
            continue
        
        # Validate email domain (URSB)
        try:
            validate_ursb_email(email)
        except HTTPException:
            errors.append(BulkImportError(
                row=idx,
                email=email,
                reason="Invalid email domain (must be @ursb.go.ug)"
            ))
            continue
        
        # Check for duplicate email
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            errors.append(BulkImportError(
                row=idx,
                email=email,
                reason="Email already exists"
            ))
            continue
        
        # Validate role
        try:
            UserRole(role)
        except ValueError:
            errors.append(BulkImportError(
                row=idx,
                email=email,
                reason=f"Invalid role: {role}"
            ))
            continue
        
        # Row is valid, add to creation list
        accounts_to_create.append({
            'full_name': full_name,
            'email': email.strip().lower(),
            'role': role,
            'department': department,
            'row_idx': idx
        })
    
    # Insert valid rows in a single transaction
    created_accounts = []
    try:
        for account_data in accounts_to_create:
            generated_password = generate_secure_password()
            salt, p_hash = create_password_hash(generated_password)

            new_user = User(
                full_name=account_data['full_name'],
                email=account_data['email'],
                password_hash=p_hash,
                password_salt=salt,
                role=UserRole(account_data['role']),
                department=account_data['department'] or None,
                is_active=True,
            )
            db.add(new_user)
            db.flush()  # Get the user_id before creating temp password

            # Store temporary password for admin viewing (expires in 7 days)
            temp_password = TemporaryPassword(
                user_id=new_user.user_id,
                password=generated_password,
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=7),
            )
            db.add(temp_password)

            created_accounts.append(BulkImportAccount(
                full_name=account_data['full_name'],
                email=account_data['email'],
                role=account_data['role'],
                generated_password=generated_password
            ))
        
        # Write single audit log for the entire batch
        if created_accounts:
            audit = AuditLog(
                user_id=current_user.user_id,
                action="BULK_USER_IMPORT",
                table_affected="users",
                record_id="bulk",
                details=f"Bulk import created {len(created_accounts)} user accounts by admin {current_user.email}",
                timestamp=datetime.utcnow(),
            )
            db.add(audit)
        
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")
    
    return BulkImportResponse(
        total_rows=total_rows,
        created=len(created_accounts),
        skipped=len(errors),
        errors=errors,
        accounts=created_accounts
    )
