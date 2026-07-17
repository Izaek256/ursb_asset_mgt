"""Inventory routes: category-based asset grouping with expandable asset lists."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, distinct
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.asset import Asset, AssetStatus, AssetType
from app.models.assignment import Assignment, AssignmentStatus
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


class AssetStub(BaseModel):
    asset_id: str
    asset_name: str
    status: str
    serial_number: str
    current_custodian_id: Optional[str]
    department: Optional[str]

    class Config:
        from_attributes = True


class InventoryCategoryResponse(BaseModel):
    asset_type: str
    category: str
    total: int
    available: int
    assigned: int
    under_maintenance: int
    pending: int
    disposed: int
    other: int
    assets: List[AssetStub]

    class Config:
        from_attributes = True


class PaginatedInventoryResponse(BaseModel):
    categories: List[InventoryCategoryResponse]
    total_categories: int
    page: int
    page_size: int
    total_assets: int
    # Summary counters across the full filtered set (not just current page)
    summary_available: int
    summary_assigned: int
    summary_under_maintenance: int
    summary_pending: int
    summary_disposed: int


@router.get("/categories", response_model=PaginatedInventoryResponse)
def get_inventory_categories(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    asset_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    Get inventory grouped by asset_type + category with live status counts.
    Supports filtering by asset_type. All authenticated users may view.
    """
    # ── Base asset query (apply type filter here so ALL derived counts respect it) ──
    base_q = db.query(Asset).filter(Asset.is_active == True)

    if asset_type and asset_type != "All":
        try:
            type_enum = AssetType(asset_type)
            base_q = base_q.filter(Asset.asset_type == type_enum)
        except ValueError:
            pass  # Unknown type — return empty

    # ── System-wide summary counters (across entire filtered set, not paginated) ──
    # These drive the dynamic Available/Assigned numbers shown in the header.
    PENDING_STATUSES = {
        AssetStatus.PENDING_ACCEPTANCE,
        AssetStatus.PENDING_PICKUP,
        AssetStatus.PENDING_APPROVAL,
        AssetStatus.RESERVED,
        AssetStatus.UNDER_TRANSFER,
    }

    def _summary_count(q, *statuses):
        return q.filter(Asset.status.in_(statuses)).count()

    summary_available      = _summary_count(base_q, AssetStatus.AVAILABLE)
    summary_assigned       = _summary_count(base_q, AssetStatus.ASSIGNED)
    summary_under_maint    = _summary_count(base_q, AssetStatus.UNDER_MAINTENANCE)
    summary_pending        = base_q.filter(Asset.status.in_(list(PENDING_STATUSES))).count()
    summary_disposed       = _summary_count(base_q, AssetStatus.DISPOSED)
    total_assets           = base_q.count()

    # ── Group by asset_type + category for pagination ──
    groups_q = (
        db.query(
            Asset.asset_type,
            Asset.category,
        )
        .filter(Asset.is_active == True)
    )
    if asset_type and asset_type != "All":
        try:
            type_enum = AssetType(asset_type)
            groups_q = groups_q.filter(Asset.asset_type == type_enum)
        except ValueError:
            pass

    groups_q = groups_q.group_by(Asset.asset_type, Asset.category).order_by(Asset.asset_type, Asset.category)

    total_categories = groups_q.count()
    groups = groups_q.offset((page - 1) * page_size).limit(page_size).all()

    # ── Build each category response ──
    response = []
    for group in groups:
        grp_type = group.asset_type
        grp_cat  = group.category

        # All assets in this type+category group
        assets_in_group = (
            base_q
            .filter(Asset.asset_type == grp_type, Asset.category == grp_cat)
            .order_by(Asset.asset_name, Asset.asset_id)
            .all()
        )

        # Count by status
        available_count  = sum(1 for a in assets_in_group if a.status == AssetStatus.AVAILABLE)
        assigned_count   = sum(1 for a in assets_in_group if a.status == AssetStatus.ASSIGNED)
        maint_count      = sum(1 for a in assets_in_group if a.status == AssetStatus.UNDER_MAINTENANCE)
        disposed_count   = sum(1 for a in assets_in_group if a.status == AssetStatus.DISPOSED)
        pending_count    = sum(1 for a in assets_in_group if a.status in PENDING_STATUSES)
        other_count      = sum(1 for a in assets_in_group if a.status == AssetStatus.RETURNED)
        total            = len(assets_in_group)

        # Build asset stubs — use the real asset status directly (no lookup needed)
        asset_stubs = []
        for asset in assets_in_group:
            status_val = asset.status.value if hasattr(asset.status, "value") else str(asset.status)
            asset_stubs.append(AssetStub(
                asset_id=asset.asset_id,
                asset_name=asset.asset_name,
                status=status_val,
                serial_number=asset.serial_number,
                current_custodian_id=str(asset.current_custodian_id) if asset.current_custodian_id else None,
                department=asset.department,
            ))

        asset_type_val = grp_type.value if hasattr(grp_type, "value") else str(grp_type)

        response.append(InventoryCategoryResponse(
            asset_type=asset_type_val,
            category=grp_cat,
            total=total,
            available=available_count,
            assigned=assigned_count,
            under_maintenance=maint_count,
            pending=pending_count,
            disposed=disposed_count,
            other=other_count,
            assets=asset_stubs,
        ))

    return PaginatedInventoryResponse(
        categories=response,
        total_categories=total_categories,
        page=page,
        page_size=page_size,
        total_assets=total_assets,
        summary_available=summary_available,
        summary_assigned=summary_assigned,
        summary_under_maintenance=summary_under_maint,
        summary_pending=summary_pending,
        summary_disposed=summary_disposed,
    )
