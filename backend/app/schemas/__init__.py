# Auth schemas
from app.schemas.auth import (
    AuthStatusResponse,
    LoginRequest,
    LoginResponse,
    SignupRequest,
)

# Asset schemas
from app.schemas.asset import (
    AssetBase,
    AssetCreate,
    AssetListResponse,
    AssetResponse,
    AssetStatus,
    AssetUpdate,
)

# Assignment schemas
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentHistoryResponse,
    AssignmentResponse,
)

# Transfer schemas
from app.schemas.transfer import TransferCreate, TransferResponse

# Maintenance schemas
from app.schemas.maintenance import (
    MaintenanceCompleteRequest,
    MaintenanceCreate,
    MaintenanceResponse,
)

# Disposal schemas
from app.schemas.disposal import DisposalCreate, DisposalResponse

# Request schemas
from app.schemas.request import (
    AssetRequestCreate,
    AssetRequestResponse,
    AssetRequestUpdate,
)

# User schemas
from app.schemas.user import UserCreate, UserResponse, UserUpdate

# Notification schemas
from app.schemas.notification import NotificationResponse

__all__ = [
    # Auth
    "AuthStatusResponse",
    "LoginRequest",
    "LoginResponse",
    "SignupRequest",
    # Asset
    "AssetBase",
    "AssetCreate",
    "AssetListResponse",
    "AssetResponse",
    "AssetStatus",
    "AssetUpdate",
    # Assignment
    "AssignmentCreate",
    "AssignmentHistoryResponse",
    "AssignmentResponse",
    # Transfer
    "TransferCreate",
    "TransferResponse",
    # Maintenance
    "MaintenanceCompleteRequest",
    "MaintenanceCreate",
    "MaintenanceResponse",
    # Disposal
    "DisposalCreate",
    "DisposalResponse",
    # Request
    "AssetRequestCreate",
    "AssetRequestResponse",
    "AssetRequestUpdate",
    # User
    "UserCreate",
    "UserResponse",
    "UserUpdate",
    # Notification
    "NotificationResponse",
]
