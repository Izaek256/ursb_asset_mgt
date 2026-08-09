"""Add return request workflow fields to assignments

Revision ID: add_return_request_workflow
Revises: add_handover_workflow
Create Date: 2026-07-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_return_request_workflow'
down_revision = 'add_handover_workflow'
branch_labels = None
depends_on = None


def upgrade():
    # Add new statuses to enum
    op.execute("ALTER TYPE assignmentstatus ADD VALUE 'Return Requested' IF NOT EXISTS")
    op.execute("ALTER TYPE assignmentstatus ADD VALUE 'Return Approved' IF NOT EXISTS")
    op.execute("ALTER TYPE assignmentstatus ADD VALUE 'Return Rejected' IF NOT EXISTS")
    
    # Add return workflow columns
    op.add_column('assignments', sa.Column('return_requested_by', sa.String(36), nullable=True))
    op.add_column('assignments', sa.Column('return_requested_at', sa.DateTime(), nullable=True))
    op.add_column('assignments', sa.Column('return_approved_by', sa.String(36), nullable=True))
    op.add_column('assignments', sa.Column('return_approved_at', sa.DateTime(), nullable=True))


def downgrade():
    # Remove return workflow columns
    op.drop_column('assignments', 'return_approved_at')
    op.drop_column('assignments', 'return_approved_by')
    op.drop_column('assignments', 'return_requested_at')
    op.drop_column('assignments', 'return_requested_by')
    
    # Note: Removing enum values is not directly supported in PostgreSQL
    # You would need to create a new type without the value and migrate data
