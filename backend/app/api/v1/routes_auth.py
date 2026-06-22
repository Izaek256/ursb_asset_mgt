"""Auth routes: login, logout, and current-user endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.api.v1.auth import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────────
class UserInfo(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    department: str
    is_active: bool

    class Config:
        from_attributes = True


class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    department: str


class SignupResponse(BaseModel):
    message: str
    user: UserInfo


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class MeResponse(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    department: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────────────────────────
@router.post("/signup", response_model=SignupResponse)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    """Create a new user account (defaults to Employee role)."""
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters.",
        )

    from app.models.user import UserRole

    new_user = User(
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.EMPLOYEE,
        department=body.department,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return SignupResponse(
        message="Account created successfully. You can now sign in.",
        user=UserInfo(
            user_id=new_user.user_id,
            full_name=new_user.full_name,
            email=new_user.email,
            role=new_user.role.value,
            department=new_user.department,
            is_active=new_user.is_active,
        ),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact the system administrator.",
        )

    token = create_access_token(user_id=user.user_id, role=user.role.value)

    return TokenResponse(
        access_token=token,
        user=UserInfo(
            user_id=user.user_id,
            full_name=user.full_name,
            email=user.email,
            role=user.role.value,
            department=user.department,
            is_active=user.is_active,
        ),
    )


@router.post("/logout")
def logout():
    """Logout is handled client-side by removing the token.
    This endpoint exists for symmetry and future server-side token revocation."""
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return MeResponse(
        user_id=current_user.user_id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role.value,
        department=current_user.department,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
    )
