"""let agents see what a visitor is typing before they send it

Revision ID: 0021
Revises: 0020
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column('typing_preview', sa.Boolean(), nullable=False, server_default='true'),
    )


def downgrade() -> None:
    op.drop_column('organizations', 'typing_preview')
