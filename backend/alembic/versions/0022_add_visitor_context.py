"""record the pages, browser and referrer of the visitor behind each chat

Revision ID: 0022
Revises: 0021
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0022'
down_revision = '0021'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column('visitor_pages', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column('conversations', sa.Column('visitor_user_agent', sa.String(512), nullable=True))
    op.add_column('conversations', sa.Column('visitor_referrer', sa.String(2048), nullable=True))


def downgrade() -> None:
    op.drop_column('conversations', 'visitor_referrer')
    op.drop_column('conversations', 'visitor_user_agent')
    op.drop_column('conversations', 'visitor_pages')
