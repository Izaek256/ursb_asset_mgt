"""merge heads

Revision ID: 5516ed61fa80
Revises: 8c5ee59fb187, baabdb2c45a3
Create Date: 2026-06-19 11:52:53.163989

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5516ed61fa80'
down_revision: Union[str, Sequence[str], None] = ('8c5ee59fb187', 'baabdb2c45a3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
