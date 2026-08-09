"""Merge all branch heads into a single linear history

Revision ID: merge_all_heads
Revises: c1f2c3d4e5f6, remove_plaintext_password, add_return_request_workflow
Create Date: 2026-07-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'merge_all_heads'
down_revision: Union[str, Sequence[str], None] = (
    'c1f2c3d4e5f6',
    'remove_plaintext_password',
    'add_return_request_workflow',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
