"""change_assignment_date_to_datetime

Revision ID: d1e2f3a4b5c6
Revises: c2d3e4f5a6b7
Create Date: 2026-07-23 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Change assignment_date from Date to DateTime
    # SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
    op.execute("""
        CREATE TABLE assignments_new (
            assignment_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            asset_id VARCHAR(100) NOT NULL,
            assigned_to VARCHAR(36) NOT NULL,
            assigned_by VARCHAR(36) NOT NULL,
            assignment_date DATETIME NOT NULL,
            return_date DATE,
            status VARCHAR(50) NOT NULL,
            notes TEXT,
            acknowledged_at DATETIME,
            return_requested_by VARCHAR(36),
            return_requested_at DATETIME,
            return_approved_by VARCHAR(36),
            return_approved_at DATETIME,
            return_rejection_reason TEXT,
            FOREIGN KEY(asset_id) REFERENCES assets (asset_id),
            FOREIGN KEY(assigned_to) REFERENCES users (id),
            FOREIGN KEY(assigned_by) REFERENCES users (id),
            FOREIGN KEY(return_requested_by) REFERENCES users (id),
            FOREIGN KEY(return_approved_by) REFERENCES users (id)
        )
    """)
    
    # Copy data from old table to new table
    op.execute("""
        INSERT INTO assignments_new (
            assignment_id, asset_id, assigned_to, assigned_by, 
            assignment_date, return_date, status, notes,
            acknowledged_at, return_requested_by, return_requested_at,
            return_approved_by, return_approved_at, return_rejection_reason
        )
        SELECT 
            assignment_id, asset_id, assigned_to, assigned_by,
            assignment_date || ' 00:00:00', return_date, status, notes,
            acknowledged_at, return_requested_by, return_requested_at,
            return_approved_by, return_approved_at, return_rejection_reason
        FROM assignments
    """)
    
    # Drop old table and rename new table
    op.execute("DROP TABLE assignments")
    op.execute("ALTER TABLE assignments_new RENAME TO assignments")


def downgrade() -> None:
    # Revert back to Date type
    op.execute("""
        CREATE TABLE assignments_new (
            assignment_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            asset_id VARCHAR(100) NOT NULL,
            assigned_to VARCHAR(36) NOT NULL,
            assigned_by VARCHAR(36) NOT NULL,
            assignment_date DATE NOT NULL,
            return_date DATE,
            status VARCHAR(50) NOT NULL,
            notes TEXT,
            acknowledged_at DATETIME,
            return_requested_by VARCHAR(36),
            return_requested_at DATETIME,
            return_approved_by VARCHAR(36),
            return_approved_at DATETIME,
            return_rejection_reason TEXT,
            FOREIGN KEY(asset_id) REFERENCES assets (asset_id),
            FOREIGN KEY(assigned_to) REFERENCES users (id),
            FOREIGN KEY(assigned_by) REFERENCES users (id),
            FOREIGN KEY(return_requested_by) REFERENCES users (id),
            FOREIGN KEY(return_approved_by) REFERENCES users (id)
        )
    """)
    
    # Copy data back, stripping time from assignment_date
    op.execute("""
        INSERT INTO assignments_new (
            assignment_id, asset_id, assigned_to, assigned_by,
            assignment_date, return_date, status, notes,
            acknowledged_at, return_requested_by, return_requested_at,
            return_approved_by, return_approved_at, return_rejection_reason
        )
        SELECT 
            assignment_id, asset_id, assigned_to, assigned_by,
            DATE(assignment_date), return_date, status, notes,
            acknowledged_at, return_requested_by, return_requested_at,
            return_approved_by, return_approved_at, return_rejection_reason
        FROM assignments
    """)
    
    # Drop old table and rename new table
    op.execute("DROP TABLE assignments")
    op.execute("ALTER TABLE assignments_new RENAME TO assignments")
