"""Add Super System Administrator role

Revision ID: add_super_admin_role
Revises: 6b1060537f9a
Create Date: 2026-07-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.models.user import UserRole


# revision identifiers, used by Alembic.
revision: str = 'add_super_admin_role'
down_revision: Union[str, Sequence[str], None] = '6b1060537f9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add SUPER_SYSTEM_ADMINISTRATOR to user_role enum."""
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('users', schema=None) as batch_op:
        # SQLite doesn't support ALTER TYPE directly, so we need to recreate the column
        # First, get the current enum values
        batch_op.alter_column(
            'role',
            existing_type=sa.Enum(
                UserRole.ASSET_MANAGER,
                UserRole.ASSET_CUSTODIAN,
                UserRole.EMPLOYEE,
                UserRole.SYSTEM_ADMINISTRATOR,
                name='userrole',
                native_enum=False,
                length=50
            ),
            type_=sa.Enum(
                UserRole.SUPER_SYSTEM_ADMINISTRATOR,
                UserRole.ASSET_MANAGER,
                UserRole.ASSET_CUSTODIAN,
                UserRole.EMPLOYEE,
                UserRole.SYSTEM_ADMINISTRATOR,
                name='userrole',
                native_enum=False,
                length=50
            ),
            existing_nullable=True
        )


def downgrade() -> None:
    """Downgrade schema: Remove SUPER_SYSTEM_ADMINISTRATOR from user_role enum.
    
    Note: Any existing SUPER_SYSTEM_ADMINISTRATOR users will be converted to 
    SYSTEM_ADMINISTRATOR before removing the enum value to prevent data loss.
    """
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('users', schema=None) as batch_op:
        # First, convert any SUPER_SYSTEM_ADMINISTRATOR users to SYSTEM_ADMINISTRATOR
        # This is done via raw SQL since we're in a migration
        op.execute(
            "UPDATE users SET role = 'System Administrator' WHERE role = 'Super System Administrator'"
        )
        
        # Then remove the enum value
        batch_op.alter_column(
            'role',
            existing_type=sa.Enum(
                UserRole.SUPER_SYSTEM_ADMINISTRATOR,
                UserRole.ASSET_MANAGER,
                UserRole.ASSET_CUSTODIAN,
                UserRole.EMPLOYEE,
                UserRole.SYSTEM_ADMINISTRATOR,
                name='userrole',
                native_enum=False,
                length=50
            ),
            type_=sa.Enum(
                UserRole.ASSET_MANAGER,
                UserRole.ASSET_CUSTODIAN,
                UserRole.EMPLOYEE,
                UserRole.SYSTEM_ADMINISTRATOR,
                name='userrole',
                native_enum=False,
                length=50
            ),
            existing_nullable=True
        )
