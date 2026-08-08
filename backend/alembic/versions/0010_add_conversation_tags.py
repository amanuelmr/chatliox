"""add conversation tags

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column(
            'tags',
            postgresql.ARRAY(sa.String(length=50)),
            nullable=False,
            server_default='{}',
        ),
    )
    op.create_index('ix_conversations_tags', 'conversations', ['tags'], postgresql_using='gin')


def downgrade() -> None:
    op.drop_index('ix_conversations_tags', table_name='conversations')
    op.drop_column('conversations', 'tags')
