"""welcome messages, quick replies, proactive messages and widget display rules

Revision ID: 0023
Revises: 0022
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None

_EMPTY = sa.text("'[]'::jsonb")


def upgrade() -> None:
    for column in ('welcome_messages', 'quick_replies', 'proactive_messages', 'widget_hidden_paths', 'widget_allowed_domains'):
        op.add_column('organizations', sa.Column(column, postgresql.JSONB(), nullable=False, server_default=_EMPTY))
    op.add_column('organizations', sa.Column('widget_devices', sa.String(10), nullable=False, server_default='all'))
    op.add_column('conversations', sa.Column('proactive_message_id', sa.String(8), nullable=True))


def downgrade() -> None:
    op.drop_column('conversations', 'proactive_message_id')
    op.drop_column('organizations', 'widget_devices')
    for column in ('widget_allowed_domains', 'widget_hidden_paths', 'proactive_messages', 'quick_replies', 'welcome_messages'):
        op.drop_column('organizations', column)
