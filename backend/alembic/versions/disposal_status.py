"""Add status, recommended_by, recommendation_reason to disposal_records

Revision ID: a1b2c3d4e5f6
Revises: b1f2c3d4e5f6
Create Date: 2026-07-08

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'b1f2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('disposal_records') as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(20), nullable=False, server_default='Approved'))
        batch_op.add_column(sa.Column('recommended_by', sa.String(36), nullable=True))
        batch_op.add_column(sa.Column('recommendation_reason', sa.Text(), nullable=True))
    # Existing records default to Approved because they were created through
    # direct disposal before the recommendation workflow existed


def downgrade() -> None:
    # WARNING: removing status column loses workflow state data permanently
    with op.batch_alter_table('disposal_records') as batch_op:
        batch_op.drop_column('recommendation_reason')
        batch_op.drop_column('recommended_by')
        batch_op.drop_column('status')