"""remove_plaintext_password_from_temporary_passwords

Revision ID: remove_plaintext_password
Revises: c2d3e4f5a6b7
Create Date: 2026-07-15 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_plaintext_password'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # First, drop the password column from temporary_passwords table
    with op.batch_alter_table('temporary_passwords', schema=None) as batch_op:
        batch_op.drop_column('password')
    
    # Then add the viewed column
    with op.batch_alter_table('temporary_passwords', schema=None) as batch_op:
        batch_op.add_column(sa.Column('viewed', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Revert changes: first remove viewed column
    with op.batch_alter_table('temporary_passwords', schema=None) as batch_op:
        batch_op.drop_column('viewed')
    
    # Then add back password column
    with op.batch_alter_table('temporary_passwords', schema=None) as batch_op:
        batch_op.add_column(sa.Column('password', sa.String(length=128), nullable=False))
