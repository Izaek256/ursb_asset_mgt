"""Dashboard routes: aggregated stats for the main dashboard view."""

from datetime import datetime, date
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User, UserRole
from app.models.asset import Asset, AssetStatus, AssetType
from app.models.assignment import Assignment
from app.models.maintenance_record import MaintenanceRecord
from app.models.disposal_record import DisposalRecord
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# ── Schemas ──────────────────────────────────────────────────────────────────────
class StatCard(BaseModel):
    label: str
    value: int
    icon: str
    color: str


class RecentAsset(BaseModel):
    id: str
    name: str
    category: str
    value: str
    color: str
    date: str


class CategoryBreakdown(BaseModel):
    name: str
    count: int
    total: str
    pct: int


class MonthlyAcquisition(BaseModel):
    month: str
    count: int


class DepartmentAllocation(BaseModel):
    dept: str
    assets: int
    color: str


class DashboardData(BaseModel):
    stats: List[StatCard]
    recent_assets: List[RecentAsset]
    categories: List[CategoryBreakdown]
    monthly_acquisitions: List[MonthlyAcquisition]
    departments: List[DepartmentAllocation]
    maintenance_due: int


# ── Helpers ──────────────────────────────────────────────────────────────────────
def _fmt_cost(val: float) -> str:
    """Format cost as UGX string."""
    if val >= 1_000_000:
        return f"UGX {val:,.0f}"
    return f"UGX {val:,.0f}"


_TYPE_COLORS = {
    "ICT Equipment": "#8b5cf6",
    "Furniture": "#2563eb",
    "Vehicle": "#f59e0b",
    "Software": "#0d9488",
    "Other": "#6b7280",
}

_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ── Endpoint ─────────────────────────────────────────────────────────────────────
@router.get("/stats", response_model=DashboardData)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return aggregated dashboard statistics."""

    # --- Stat cards ---
    total_assets = db.query(func.count(Asset.asset_id)).scalar() or 0
    active_assets = db.query(func.count(Asset.asset_id)).filter(Asset.status == AssetStatus.ACTIVE).scalar() or 0
    maintenance_assets = db.query(func.count(Asset.asset_id)).filter(Asset.status == AssetStatus.UNDER_MAINTENANCE).scalar() or 0
    disposed_assets = db.query(func.count(Asset.asset_id)).filter(Asset.status == AssetStatus.DISPOSED).scalar() or 0
    in_storage = db.query(func.count(Asset.asset_id)).filter(Asset.status == AssetStatus.IN_STORAGE).scalar() or 0

    stats = [
        StatCard(label="Total Assets", value=total_assets, icon="📦", color="#8b5cf6"),
        StatCard(label="Active / Assigned", value=active_assets, icon="✅", color="#2563eb"),
        StatCard(label="In Maintenance", value=maintenance_assets, icon="🔧", color="#f59e0b"),
        StatCard(label="Disposed", value=disposed_assets, icon="🗑️", color="#ef4444"),
    ]

    # --- Recent assets (last 8 by created_at) ---
    recent_rows = (
        db.query(Asset)
        .order_by(Asset.created_at.desc())
        .limit(8)
        .all()
    )
    recent_assets = []
    for a in recent_rows:
        color = _TYPE_COLORS.get(a.asset_type.value, "#6b7280")
        days_ago = (datetime.now() - a.created_at).days if a.created_at else 0
        if days_ago == 0:
            date_str = "Today"
        elif days_ago == 1:
            date_str = "Yesterday"
        else:
            date_str = f"{days_ago} days ago"
        recent_assets.append(RecentAsset(
            id=a.asset_id,
            name=a.asset_name,
            category=a.asset_type.value,
            value=_fmt_cost(float(a.cost)),
            color=color,
            date=date_str,
        ))

    # --- Category breakdown ---
    cat_rows = (
        db.query(Asset.asset_type, func.count(Asset.asset_id), func.sum(Asset.cost))
        .group_by(Asset.asset_type)
        .all()
    )
    total_cost = sum(float(r[2] or 0) for r in cat_rows) or 1
    categories = []
    for asset_type, count, total_val in cat_rows:
        val = float(total_val or 0)
        pct = int((val / total_cost) * 100) if total_cost > 0 else 0
        categories.append(CategoryBreakdown(
            name=asset_type.value,
            count=count,
            total=_fmt_cost(val),
            pct=pct,
        ))
    categories.sort(key=lambda c: c.pct, reverse=True)

    # --- Monthly acquisitions (current year) ---
    current_year = datetime.now().year
    month_rows = (
        db.query(
            func.extract("month", Asset.acquisition_date).label("m"),
            func.count(Asset.asset_id),
        )
        .filter(func.extract("year", Asset.acquisition_date) == current_year)
        .group_by(func.extract("month", Asset.acquisition_date))
        .all()
    )
    month_map = {int(r[0]): r[1] for r in month_rows if r[0]}
    monthly_acquisitions = [
        MonthlyAcquisition(month=_MONTH_NAMES[i - 1], count=month_map.get(i, 0))
        for i in range(1, 13)
    ]

    # --- Department allocation ---
    dept_rows = (
        db.query(Asset.department, func.count(Asset.asset_id))
        .filter(Asset.department.isnot(None))
        .group_by(Asset.department)
        .all()
    )
    dept_colors = ["#2563eb", "#f59e0b", "#8b5cf6", "#0d9488", "#ef4444", "#6b7280", "#ec4899"]
    departments = [
        DepartmentAllocation(dept=r[0] or "Unassigned", assets=r[1], color=dept_colors[i % len(dept_colors)])
        for i, r in enumerate(dept_rows)
    ]

    # --- Maintenance due count ---
    maintenance_due = db.query(func.count(MaintenanceRecord.asset_id)).filter(
        MaintenanceRecord.next_service_date <= date.today()
    ).scalar() or 0

    return DashboardData(
        stats=stats,
        recent_assets=recent_assets,
        categories=categories,
        monthly_acquisitions=monthly_acquisitions,
        departments=departments,
        maintenance_due=maintenance_due,
    )
