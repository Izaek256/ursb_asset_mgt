from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db import get_db
from app.models.user import User, UserRole
from app.schemas.asset import AssetCreate, AssetResponse
from app.services.asset import create_asset, get_all_assets

router = APIRouter()


@router.post(
    "/assets",
    response_model=AssetResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.ASSET_MANAGER))],
)
def register_asset(
    payload: AssetCreate,
    current_user: User = Depends(require_role(UserRole.ASSET_MANAGER)),
    db: Session = Depends(get_db),
) -> AssetResponse:
    asset = create_asset(db, payload, current_user)
    return AssetResponse.model_validate(asset)


@router.get("/assets", response_model=list[AssetResponse])
def list_assets(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssetResponse]:
    assets = get_all_assets(db)
    return [AssetResponse.model_validate(a) for a in assets]
