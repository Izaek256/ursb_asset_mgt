import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session as DbSession

from app.models import User, Session as SessionModel, UserRole

SESSION_COOKIE_NAME = "ursb_session"
SESSION_DURATION = timedelta(days=1)
HASH_ITERATIONS = 200_000
SALT_SIZE = 32
HASH_ALGORITHM = "sha256"


def validate_ursb_email(email: str) -> None:
    """
    Validate that the email address ends with @ursb.go.ug.
    This enforces the institutional email restriction for URSB employees.
    Raises HTTPException if the domain does not match.
    """
    if not email.lower().endswith("@ursb.go.ug"):
        raise HTTPException(
            status_code=400,
            detail="Only @ursb.go.ug email addresses are permitted"
        )


def hash_password(password: str, salt: str) -> str:
    password_bytes = password.encode("utf-8")
    salt_bytes = salt.encode("utf-8")
    derived = hashlib.pbkdf2_hmac(
        HASH_ALGORITHM,
        password_bytes,
        salt_bytes,
        HASH_ITERATIONS,
    )
    return derived.hex()


def create_password_hash(password: str) -> tuple[str, str]:
    salt = secrets.token_hex(SALT_SIZE)
    password_hash = hash_password(password, salt)
    return salt, password_hash


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    candidate = hash_password(password, salt)
    return hmac.compare_digest(candidate, password_hash)


def get_user_by_email(db: DbSession, email: str) -> Optional[User]:
    return (
        db.query(User)
        .filter(User.email == email.strip().lower())
        .first()
    )


def get_user_by_username(db: DbSession, username: str) -> Optional[User]:
    return (
        db.query(User)
        .filter(User.username == username.strip().lower())
        .first()
    )


LOCKOUT_THRESHOLD = 3
LOCKOUT_DURATION = timedelta(minutes=15)


def is_account_locked(user: User) -> bool:
    return bool(user.locked_until and user.locked_until > datetime.utcnow())


def reset_failed_login_attempts(db: DbSession, user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    db.add(user)
    db.commit()
    db.refresh(user)


def register_failed_login_attempt(db: DbSession, user: User) -> None:
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    if user.failed_login_attempts >= LOCKOUT_THRESHOLD:
        user.locked_until = datetime.utcnow() + LOCKOUT_DURATION
    db.add(user)
    db.commit()
    db.refresh(user)


def create_user(
    db: DbSession,
    email: str,
    password: str,
    first_name: str | None = None,
    last_name: str | None = None,
    phone_number: str | None = None,
    department: str | None = None,
    username: str | None = None,
    role: UserRole | None = UserRole.EMPLOYEE,
    full_name: str | None = None,
) -> User:
    salt, password_hash = create_password_hash(password)
    user = User(
        email=email.strip().lower(),
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
        department=department,
        username=username.strip().lower() if username else None,
        role=role,
        password_hash=password_hash,
        password_salt=salt,
        full_name=full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: DbSession, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if verify_password(password, user.password_salt, user.password_hash):
        return user
    return None


def create_session(db: DbSession, user: User) -> SessionModel:
    token = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    session = SessionModel(
        session_token=token,
        user_id=user.user_id,
        created_at=now,
        expires_at=now + SESSION_DURATION,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session(db: DbSession, token: str) -> Optional[SessionModel]:
    if not token:
        return None
    session = (
        db.query(SessionModel)
        .filter(SessionModel.session_token == token)
        .first()
    )
    if not session:
        return None
    
    now = datetime.utcnow()
    if session.expires_at < now:
        db.delete(session)
        db.commit()
        return None

    # Only extend the session when more than half its lifetime has elapsed.
    # This avoids a DB write on every single request (which was causing
    # "database is locked" contention with the bulk-import WebSocket).
    half_duration = SESSION_DURATION / 2
    if (session.expires_at - now) < half_duration:
        session.expires_at = now + SESSION_DURATION
        db.add(session)
        db.commit()

    return session


def delete_session(db: DbSession, token: str) -> None:
    session = (
        db.query(SessionModel)
        .filter(SessionModel.session_token == token)
        .first()
    )
    if session:
        db.delete(session)
        db.commit()
