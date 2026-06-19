from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class SignupRequest(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    username: str = Field(min_length=3)
    email: EmailStr
    phone_number: str = Field(min_length=7)
    department: str = Field(min_length=1)
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)


class LoginResponse(BaseModel):
    message: str


class AuthStatusResponse(BaseModel):
    authenticated: bool
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    phone_number: str | None = None
    department: str | None = None
    role: str | None = None
