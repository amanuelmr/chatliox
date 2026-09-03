"""add password_reset value to verification_purpose enum

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-03
"""
from alembic import op

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE verification_purpose ADD VALUE IF NOT EXISTS 'password_reset'")


def downgrade() -> None:
    # Postgres doesn't support dropping a value from an enum type; left in place.
    pass
