"""Add handover workflow to asset requests

Revision ID: add_handover_workflow
Revises: edb54c64fdb9
Create Date: 2026-07-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_handover_workflow'
down_revision = 'edb54c64fdb9'
branch_labels = None
depends_on = None


def upgrade():
    # Add new status to enum
    op.execute("ALTER TYPE requeststatus ADD VALUE 'ReadyForPickup' IF NOT EXISTS")
    
    # Add handed_over_at column
    op.add_column('asset_requests', sa.Column('handed_over_at', sa.DateTime(), nullable=True))


def downgrade():
    # Remove handed_over_at column
    op.drop_column('asset_requests', 'handed_over_at')
    
    # Note: Removing enum values is not directly supported in PostgreSQL
    # You would need to create a new type without the value and migrate data
