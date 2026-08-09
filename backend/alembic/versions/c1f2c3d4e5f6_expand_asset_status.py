"""expand_asset_status

Revision ID: c1f2c3d4e5f6
Revises: b1f2c3d4e5f6
Create Date: 2026-07-13 00:00:00.000000

Mapping Strategy:
- Upgrade:
  - 'Active' -> 'Available'
  - 'In Storage' -> 'Available'
  - 'Under Maintenance' -> 'Under Maintenance'
  - 'Disposed' -> 'Disposed'
- Downgrade:
  - 'Available' with a custodian (current_custodian_id is not null) -> 'Active'
  - 'Available' without a custodian (current_custodian_id is null) -> 'In Storage'
  - Any transitional status (Reserved, Pending Acceptance, Pending Pickup, Assigned, Under Transfer, Returned)
    with a custodian -> 'Active'
  - Any transitional status without a custodian -> 'In Storage'
  - 'Deactivated' -> 'In Storage' (since it was deactivated and has no custodian)
  - 'Under Maintenance' -> 'Under Maintenance'
  - 'Disposed' -> 'Disposed'
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c1f2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'b1f2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update ACTIVE with a custodian to ASSIGNED
    op.execute(
        "UPDATE assets SET status = 'ASSIGNED' "
        "WHERE status = 'ACTIVE' AND current_custodian_id IS NOT NULL"
    )
    # 2. Update ACTIVE without a custodian to AVAILABLE
    op.execute(
        "UPDATE assets SET status = 'AVAILABLE' "
        "WHERE status = 'ACTIVE' AND current_custodian_id IS NULL"
    )
    # 3. Update IN_STORAGE to AVAILABLE
    op.execute(
        "UPDATE assets SET status = 'AVAILABLE' "
        "WHERE status = 'IN_STORAGE'"
    )


def downgrade() -> None:
    # Restore original 4 statuses cleanly based on custodian presence
    
    # 1. Update assets with a custodian to 'ACTIVE'
    op.execute(
        "UPDATE assets SET status = 'ACTIVE' "
        "WHERE status IN ('AVAILABLE', 'RESERVED', 'PENDING_ACCEPTANCE', 'PENDING_PICKUP', 'ASSIGNED', 'UNDER_TRANSFER', 'RETURNED') "
        "AND current_custodian_id IS NOT NULL"
    )
    
    # 2. Update assets without a custodian to 'IN_STORAGE'
    op.execute(
        "UPDATE assets SET status = 'IN_STORAGE' "
        "WHERE status IN ('AVAILABLE', 'RESERVED', 'PENDING_ACCEPTANCE', 'PENDING_PICKUP', 'ASSIGNED', 'UNDER_TRANSFER', 'RETURNED', 'DEACTIVATED') "
        "AND current_custodian_id IS NULL"
    )

