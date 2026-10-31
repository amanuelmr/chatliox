"""add pre-chat form settings to organizations and answers to conversations

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column('pre_chat_name', sa.String(10), nullable=False, server_default='optional'),
    )
    op.add_column(
        'organizations',
        sa.Column('pre_chat_email', sa.String(10), nullable=False, server_default='optional'),
    )
    op.add_column(
        'organizations',
        sa.Column(
            'pre_chat_fields',
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        'conversations',
        sa.Column(
            'pre_chat_answers',
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column('conversations', 'pre_chat_answers')
    op.drop_column('organizations', 'pre_chat_fields')
    op.drop_column('organizations', 'pre_chat_email')
    op.drop_column('organizations', 'pre_chat_name')
