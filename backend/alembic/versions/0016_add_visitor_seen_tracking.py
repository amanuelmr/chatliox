"""add visitor last-seen and notified timestamps to conversations

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-30
"""
from alembic import op
import sqlalchemy as sa

revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column('visitor_last_seen_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'conversations',
        sa.Column('visitor_notified_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('conversations', 'visitor_notified_at')
    op.drop_column('conversations', 'visitor_last_seen_at')
