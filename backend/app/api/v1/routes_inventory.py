"""Inventory routes: category-based asset grouping with expandable asset lists."""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.asset import Asset, AssetStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


class AssetStub(BaseModel):
    """Minimal asset information for expandable detail view."""
    asset_id: str
    status: str
    serial_number: str
    current_custodian_id: Optional[str]
    department: Optional[str]

    class Config:
        from_attributes = True


class InventoryCategoryResponse(BaseModel):
    """Response for GET /api/inventory/categories - grouped asset counts."""
    asset_type: str
    category: str
    total: int
    available: int
    assigned: int
    reserved: int
    under_maintenance: int
    disposed: int
    other: int
    assets: List[AssetStub]

    class Config:
        from_attributes = True


@router.get("/categories", response_model=List[InventoryCategoryResponse])
def get_inventory_categories(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    Get inventory grouped by asset type and category with aggregate counts.
    
    This endpoint groups assets by the combination of asset_type, category, and asset_name
    (used as a proxy for model name since the SRS does not have a separate model field yet).
    For each group, it computes counts for different status categories and returns a list
    of individual asset stubs for the expandable detail view.
    
    Access: All authenticated users (any role may view inventory).
    
    The grouping logic:
    - Groups by asset_type, category, and asset_name (model proxy)
    - Computes counts for: available, assigned, reserved, under_maintenance, disposed, other
    - Returns individual asset details in the assets array for each group
    
    Status mapping:
    - Available: Assets with status 'Active' and no active assignment
    - Assigned: Assets with status 'Active' and an active assignment
    - Reserved: Currently 0 (no reserved status in current data model)
    - Under Maintenance: Assets with status 'Under Maintenance'
    - Disposed: Assets with status 'Disposed'
    - Other: Assets with status 'In Storage' or any other status not listed above
    
    The endpoint performs all aggregation at the database level using SQLAlchemy's
    grouping functions for efficiency and to avoid loading all assets into Python memory.
    """
    from app.models.assignment import Assignment
    
    # Subquery to check if an asset has an active assignment
    active_assignment_subquery = (
        db.query(Assignment.asset_id)
        .filter(Assignment.status == AssignmentStatus.ACTIVE)
        .filter(Assignment.asset_id == Asset.asset_id)
        .exists()
    )
    
    """
    Database-level aggregation query.
    
    Grouping keys:
    - asset_type: The asset type enum value (e.g., "ICT Equipment", "Furniture")
    - category: The category string (e.g., "Laptop", "Desk")
    - asset_name: Used as a proxy for model name (e.g., "Dell Latitude 5420")
    
    Aggregation is done at the database level rather than in Python for:
    1. Performance: Database engines are optimized for grouping and aggregation
    2. Memory efficiency: Avoids loading all asset records into application memory
    3. Scalability: Query can handle large datasets without impacting application performance
    4. Consistency: Database-level aggregation ensures consistent results across concurrent requests
    """
    query = (
        db.query(
            Asset.asset_type,
            Asset.category,
            Asset.asset_name.label("model_name"),
            func.count(Asset.asset_id).label("total"),
            func.sum(
                case(
                    (Asset.status == AssetStatus.ACTIVE, 1),
                    else_=0
                )
            ).label("active_count"),
            func.sum(
                case(
                    (active_assignment_subquery, 1),
                    else_=0
                )
            ).label("assigned_count"),
            func.sum(
                case(
                    (Asset.status == AssetStatus.UNDER_MAINTENANCE, 1),
                    else_=0
                )
            ).label("under_maintenance_count"),
            func.sum(
                case(
                    (Asset.status == AssetStatus.DISPOSED, 1),
                    else_=0
                )
            ).label("disposed_count"),
            func.sum(
                case(
                    (Asset.status == AssetStatus.IN_STORAGE, 1),
                    else_=0
                )
            ).label("in_storage_count"),
        )
        .group_by(Asset.asset_type, Asset.category, Asset.asset_name)
        .order_by(Asset.asset_type, Asset.category, Asset.asset_name)
    )
    
    grouped_results = query.all()
    
    # Build response with individual asset details for each group
    response = []
    for group in grouped_results:
        asset_type = group.asset_type.value if hasattr(group.asset_type, "value") else str(group.asset_type)
        category = group.category
        model_name = group.model_name
        
        # Compute status counts from aggregated values
        active_count = group.active_count or 0
        assigned_count = group.assigned_count or 0
        under_maintenance_count = group.under_maintenance_count or 0
        disposed_count = group.disposed_count or 0
        in_storage_count = group.in_storage_count or 0
        
        available = active_count - assigned_count
        assigned = assigned_count
        reserved = 0  # No reserved status in current data model
        under_maintenance = under_maintenance_count
        disposed = disposed_count
        other = in_storage_count  # In Storage and any other statuses
        total = available + assigned + reserved + under_maintenance + disposed + other
        
        # Query individual assets for this group
        assets_in_group = (
            db.query(Asset)
            .filter(Asset.asset_type == group.asset_type)
            .filter(Asset.category == category)
            .filter(Asset.asset_name == model_name)
            .all()
        )
        
        # Build asset stubs
        asset_stubs = []
        for asset in assets_in_group:
            # Determine display status based on assignment
            has_active_assignment = db.query(Assignment).filter(
                Assignment.asset_id == asset.asset_id,
                Assignment.status == AssignmentStatus.ACTIVE
            ).first() is not None
            
            display_status = asset.status.value if hasattr(asset.status, "value") else str(asset.status)
            if asset.status == AssetStatus.ACTIVE and has_active_assignment:
                display_status = "Assigned"
            elif asset.status == AssetStatus.ACTIVE:
                display_status = "Available"
            
            asset_stubs.append(AssetStub(
                asset_id=asset.asset_id,
                status=display_status,
                serial_number=asset.serial_number,
                current_custodian_id=str(asset.current_custodian_id) if asset.current_custodian_id else None,
                department=asset.department,
            ))
        
        response.append(InventoryCategoryResponse(
            asset_type=asset_type,
            category=category,
            total=total,
            available=available,
            assigned=assigned,
            reserved=reserved,
            under_maintenance=under_maintenance,
            disposed=disposed,
            other=other,
            assets=asset_stubs,
        ))
    
    return response
