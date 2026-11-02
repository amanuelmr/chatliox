"""add a first-response target to organizations and track how long chats have waited

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('first_response_minutes', sa.Integer(), nullable=True))
    op.add_column('conversations', sa.Column('waiting_since', sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "UPDATE conversations SET waiting_since = coalesce(last_message_at, created_at) "
        "WHERE status = 'waiting'"
    )


def downgrade() -> None:
    op.drop_column('conversations', 'waiting_since')
    op.drop_column('organizations', 'first_response_minutes')
