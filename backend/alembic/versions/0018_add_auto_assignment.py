"""add auto-assignment to organizations and the last assignment time to users

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-01
"""
from alembic import op
import sqlalchemy as sa

revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column('auto_assign', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column('users', sa.Column('last_assigned_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'last_assigned_at')
    op.drop_column('organizations', 'auto_assign')
