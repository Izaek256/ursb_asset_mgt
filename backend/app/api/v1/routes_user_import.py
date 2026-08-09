"""Bulk user import routes for CSV and XLSX file processing."""

import asyncio
import json
import secrets
import string
from datetime import datetime, timedelta, timezone
from app.utils.time import utcnow
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db, SessionLocal
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.models.temporary_password import TemporaryPassword
from app.api.v1.auth import get_current_user, require_role
from app.services.auth import create_password_hash, validate_ursb_email, get_session, SESSION_COOKIE_NAME

router = APIRouter(prefix="/api/v1/users", tags=["user-import"])

# Thread pool for CPU-intensive operations (password hashing)
_thread_pool = ThreadPoolExecutor(max_workers=4)

# ── In-memory short-lived WebSocket auth tokens ───────────────────────────────
# Maps one-time token -> {"user_id": str, "email": str, "expires_at": datetime}
_ws_tokens: dict[str, dict] = {}
_WS_TOKEN_TTL_SECONDS = 30


def _cleanup_ws_tokens():
    """Remove expired tokens from the in-memory store."""
    now = utcnow()
    expired = [t for t, v in _ws_tokens.items() if v["expires_at"] < now]
    for t in expired:
        del _ws_tokens[t]


@router.post("/ws-auth-token")
async def get_ws_auth_token(
    current_user: User = Depends(require_role(UserRole.SYSTEM_ADMINISTRATOR, UserRole.SUPER_SYSTEM_ADMINISTRATOR)),
):
    """
    Issue a short-lived one-time token for the bulk-import WebSocket.
    The token expires in 30 seconds and is consumed on first use.
    """
    _cleanup_ws_tokens()
    token = secrets.token_urlsafe(32)
    _ws_tokens[token] = {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "expires_at": utcnow() + timedelta(seconds=_WS_TOKEN_TTL_SECONDS),
    }
    return {"token": token}


# ── Schemas ───────────────────────────────────────────────────────────────────

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


# ── Helpers ───────────────────────────────────────────────────────────────────

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
    """
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*"

    password = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    all_chars = uppercase + lowercase + digits + special
    for _ in range(8):
        password.append(secrets.choice(all_chars))

    secrets.SystemRandom().shuffle(password)
    return ''.join(password)


# ── Role normalisation map ────────────────────────────────────────────────────
# Accepts the enum key (upper-snake), display names, and common abbreviations.
_ROLE_ALIASES: dict[str, UserRole] = {
    # Canonical enum keys
    "EMPLOYEE": UserRole.EMPLOYEE,
    "ASSET_CUSTODIAN": UserRole.ASSET_CUSTODIAN,
    "ASSET_MANAGER": UserRole.ASSET_MANAGER,
    "SYSTEM_ADMINISTRATOR": UserRole.SYSTEM_ADMINISTRATOR,
    "SUPER_SYSTEM_ADMINISTRATOR": UserRole.SUPER_SYSTEM_ADMINISTRATOR,
    # Human-readable display names
    "Employee": UserRole.EMPLOYEE,
    "Asset Custodian": UserRole.ASSET_CUSTODIAN,
    "Asset Manager": UserRole.ASSET_MANAGER,
    "System Administrator": UserRole.SYSTEM_ADMINISTRATOR,
    "Super System Administrator": UserRole.SUPER_SYSTEM_ADMINISTRATOR,
    # Common abbreviations / shorthand
    "admin": UserRole.SYSTEM_ADMINISTRATOR,
    "sysadmin": UserRole.SYSTEM_ADMINISTRATOR,
    "manager": UserRole.ASSET_MANAGER,
    "custodian": UserRole.ASSET_CUSTODIAN,
    "staff": UserRole.EMPLOYEE,
    "user": UserRole.EMPLOYEE,
}


def _normalise_role(raw: str) -> Optional[UserRole]:
    """
    Return the matching UserRole for *raw*, accepting:
    - The exact enum key (e.g. EMPLOYEE)
    - The enum value string (e.g. EMPLOYEE — same here since it's a str enum)
    - Any entry in _ROLE_ALIASES (case-insensitive fallback)
    Returns None if no match is found.
    """
    stripped = raw.strip()

    # 1. Try exact alias lookup (preserves original casing for known display names)
    if stripped in _ROLE_ALIASES:
        return _ROLE_ALIASES[stripped]

    # 2. Try case-insensitive alias lookup
    lower = stripped.lower()
    for alias, role in _ROLE_ALIASES.items():
        if alias.lower() == lower:
            return role

    # 3. Try constructing the enum directly (handles any future additions)
    try:
        return UserRole(stripped.upper())
    except ValueError:
        pass

    return None


def _validate_rows(rows: list, db: Session) -> tuple[list, list]:
    """
    Validate all rows and return (accounts_to_create, errors).
    accounts_to_create is a list of dicts with validated fields.
    errors is a list of dicts with row, email, reason.
    """
    errors = []
    accounts_to_create = []

    for idx, row in enumerate(rows, start=2):
        email = str(row.get('email', '')).strip()
        full_name = str(row.get('full_name', '')).strip()
        role_raw = str(row.get('role', '')).strip()
        department = str(row.get('department', '')).strip() if row.get('department') else ''

        if not email or not full_name or not role_raw:
            errors.append({"row": idx, "email": email or None, "reason": "Missing required field (full_name, email, or role)"})
            continue

        if '@' not in email or '.' not in email:
            errors.append({"row": idx, "email": email, "reason": "Invalid email format"})
            continue

        try:
            validate_ursb_email(email)
        except HTTPException:
            errors.append({"row": idx, "email": email, "reason": "Invalid email domain (must be @ursb.go.ug)"})
            continue

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            errors.append({"row": idx, "email": email, "reason": "Email already exists"})
            continue

        role = _normalise_role(role_raw)
        if role is None:
            valid = ", ".join(r.value for r in UserRole)
            errors.append({"row": idx, "email": email, "reason": f"Invalid role '{role_raw}'. Valid values: {valid}"})
            continue

        accounts_to_create.append({
            'full_name': full_name,
            'email': email.strip().lower(),
            'role': role.value,
            'department': department or None,
        })

    return accounts_to_create, errors


# ── HTTP bulk import (non-streaming) ─────────────────────────────────────────

@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SYSTEM_ADMINISTRATOR, UserRole.SUPER_SYSTEM_ADMINISTRATOR)),
):
    """
    Bulk import users from CSV or XLSX file.

    All valid rows are inserted in a single transaction. If the transaction fails,
    no rows are inserted. The accounts array contains credentials for all
    successfully created accounts — this is the only time these passwords are shown.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_ext = file.filename.lower().split('.')[-1]
    if file_ext not in ['csv', 'xlsx']:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are accepted")

    MAX_SIZE = 2 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 2 MB limit")

    rows = []
    if file_ext == 'csv':
        import io, csv
        reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
        rows = list(reader)
    else:
        import io, openpyxl
        workbook = openpyxl.load_workbook(io.BytesIO(content))
        sheet = workbook.active
        headers = [cell.value for cell in sheet[1]]
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if any(cell is not None for cell in row):
                rows.append(dict(zip(headers, row)))

    total_rows = len(rows)
    accounts_to_create, errors = _validate_rows(rows, db)

    created_accounts = []
    try:
        for account_data in accounts_to_create:
            password = generate_secure_password()
            salt, password_hash = create_password_hash(password)

            name_parts = account_data['full_name'].split(' ', 1)
            new_user = User(
                first_name=name_parts[0],
                last_name=name_parts[1] if len(name_parts) > 1 else '',
                full_name=account_data['full_name'],
                email=account_data['email'],
                username=account_data['email'].split('@')[0],
                role=UserRole(account_data['role']),
                department=account_data['department'],
                password_salt=salt,
                password_hash=password_hash,
                is_active=True,
            )
            db.add(new_user)
            db.flush()

            db.add(TemporaryPassword(
                user_id=new_user.user_id,
                expires_at=utcnow() + timedelta(days=7),
            ))

            created_accounts.append(BulkImportAccount(
                full_name=account_data['full_name'],
                email=account_data['email'],
                role=account_data['role'],
                generated_password=password,
            ))

        if created_accounts:
            db.add(AuditLog(
                user_id=current_user.user_id,
                action="BULK_USER_IMPORT",
                table_affected="users",
                record_id="bulk",
                details=f"Bulk import created {len(created_accounts)} user accounts by admin {current_user.email}",
                timestamp=utcnow(),
            ))

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")

    return BulkImportResponse(
        total_rows=total_rows,
        created=len(created_accounts),
        skipped=len(errors),
        errors=[BulkImportError(**e) for e in errors],
        accounts=created_accounts,
    )


# ── WebSocket bulk import (streaming progress) ────────────────────────────────

@router.websocket("/bulk-import-ws")
async def bulk_import_ws(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time bulk user import with progress reporting.

    Protocol:
    - Client first calls POST /api/v1/users/ws-auth-token to obtain a short-lived token.
    - Client connects to this endpoint with ?token=<token> in the URL.
    - Client sends a JSON array of row objects after the connection is established.
    - Server validates each row, then creates accounts one at a time.
    - Progress: {"type": "progress", "progress": 0-100, "processed": n, "total": n}
    - Complete: {"type": "complete", "total_rows": n, "created": n, "skipped": n, "errors": [...], "accounts": [...]}
    - On client disconnect mid-import, the DB transaction is rolled back.
    """
    await websocket.accept()

    # Authenticate via one-time query-param token (avoids cross-origin cookie issues)
    _cleanup_ws_tokens()
    token_data = _ws_tokens.pop(token, None)
    if token_data is None or token_data["expires_at"] < utcnow():
        await websocket.close(code=4001, reason="Not authenticated")
        return

    admin_user_id = token_data["user_id"]
    admin_email = token_data["email"]

    # Receive rows payload
    try:
        raw = await websocket.receive_text()
        rows = json.loads(raw)
    except Exception:
        await websocket.close(code=4400, reason="Invalid payload")
        return

    total_rows = len(rows)

    with SessionLocal() as db:
        accounts_to_create, errors = _validate_rows(rows, db)

    total_to_create = len(accounts_to_create)
    created_accounts = []

    # ── Phase 1: send progress updates while building objects in memory ───────
    # We deliberately do NOT open a DB session here — password hashing is the
    # expensive CPU work, and we want to stream progress without holding any
    # write lock while that happens.
    # Use thread pool for CPU-intensive password hashing to avoid blocking event loop
    prepared = []  # list of (User, TemporaryPassword, account_dict)

    def generate_and_hash_password():
        """Generate password and hash it in a thread pool to avoid blocking event loop"""
        password = generate_secure_password()
        salt, password_hash = create_password_hash(password)
        return password, salt, password_hash

    for i, account_data in enumerate(accounts_to_create):
        # Offload password generation and hashing to thread pool
        loop = asyncio.get_event_loop()
        password, salt, password_hash = await loop.run_in_executor(
            _thread_pool,
            generate_and_hash_password
        )

        name_parts = account_data['full_name'].split(' ', 1)
        new_user = User(
            first_name=name_parts[0],
            last_name=name_parts[1] if len(name_parts) > 1 else '',
            full_name=account_data['full_name'],
            email=account_data['email'],
            username=account_data['email'].split('@')[0],
            role=UserRole(account_data['role']),
            department=account_data['department'],
            password_salt=salt,
            password_hash=password_hash,
            is_active=True,
        )
        temp_pw = TemporaryPassword(
            expires_at=utcnow() + timedelta(days=7),
        )
        prepared.append((new_user, temp_pw, {
            'full_name': account_data['full_name'],
            'email': account_data['email'],
            'role': account_data['role'],
            'generated_password': password,
        }))

        progress = round(((i + 1) / total_to_create) * 100) if total_to_create > 0 else 100
        await websocket.send_json({
            "type": "progress",
            "progress": progress,
            "processed": i + 1,
            "total": total_to_create,
        })

    # ── Phase 2: single short-lived write transaction ─────────────────────────
    if prepared:
        with SessionLocal() as db:
            try:
                for new_user, temp_pw, account_dict in prepared:
                    db.add(new_user)
                    db.flush()  # get the auto-generated user_id
                    temp_pw.user_id = new_user.user_id
                    db.add(temp_pw)
                    created_accounts.append(account_dict)

                if created_accounts:
                    db.add(AuditLog(
                        user_id=admin_user_id,
                        action="BULK_USER_IMPORT",
                        table_affected="users",
                        record_id="bulk",
                        details=f"Bulk import created {len(created_accounts)} user accounts by admin {admin_email}",
                        timestamp=utcnow(),
                    ))

                db.commit()

            except WebSocketDisconnect:
                db.rollback()
                return
            except Exception as e:
                db.rollback()
                try:
                    await websocket.send_json({"type": "error", "message": str(e)})
                except Exception:
                    pass
                return

    await websocket.send_json({
        "type": "complete",
        "total_rows": total_rows,
        "created": len(created_accounts),
        "skipped": len(errors),
        "errors": errors,
        "accounts": created_accounts,
    })

    await websocket.close()
