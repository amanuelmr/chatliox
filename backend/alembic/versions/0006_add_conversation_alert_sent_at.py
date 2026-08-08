"""add conversation waiting alert sent at

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column('waiting_alert_sent_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('conversations', 'waiting_alert_sent_at')
