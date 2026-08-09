import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole


class UserCreate(BaseModel):
    """Schema for creating a new user account.
    
    Used by: POST /api/users
    Permitted roles: System Administrator
    Auto-generated fields: id, created_at (excluded from this schema)
    Caller-provided fields: email, username, first_name, last_name, phone_number, department, role, password, confirm_password
    Validation rules: password must meet complexity requirements, email must be unique, username must be unique
    """
    email: EmailStr
    username: str = Field(min_length=3, max_length=128)
    first_name: str = Field(max_length=128)
    last_name: str = Field(max_length=128)
    phone_number: str = Field(max_length=64)
    department: str = Field(max_length=128)
    role: UserRole
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        """Validate password complexity requirements."""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class UserUpdate(BaseModel):
    """Schema for partial user profile updates.
    
    Used by: PUT /api/users/{user_id}, PUT /api/users/me
    Permitted roles: All authenticated users (for own profile), System Administrator (for any user)
    Auto-generated fields: None (all fields optional for partial updates)
    Caller-provided fields: All profile fields optional (password changes handled separately)
    Validation rules: None for profile fields
    """
    email: EmailStr | None = None
    username: str | None = Field(None, min_length=3, max_length=128)
    first_name: str | None = Field(None, max_length=128)
    last_name: str | None = Field(None, max_length=128)
    phone_number: str | None = Field(None, max_length=64)
    department: str | None = Field(None, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    """Safe user representation returned to the client.
    
    Used by: GET /api/users, GET /api/users/{user_id}, GET /api/users/me, POST /api/users, PUT /api/users/{user_id}
    Permitted roles: All authenticated users
    Auto-generated fields: id, created_at (included from ORM instance)
    Caller-provided fields: None (this is a response schema)
    Validation rules: Never includes password_hash or password_salt for security
    """
    id: int
    email: str
    username: str | None
    first_name: str | None
    last_name: str | None
    phone_number: str | None
    department: str | None
    role: UserRole | None
    is_active: bool
    failed_login_attempts: int
    locked_until: datetime | None
    created_at: datetime
    full_name: str | None

    model_config = {"from_attributes": True}
