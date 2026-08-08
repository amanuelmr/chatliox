"""add message attachment fields

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('attachment_url', sa.String(length=1024), nullable=True))
    op.add_column('messages', sa.Column('attachment_name', sa.String(length=255), nullable=True))
    op.add_column('messages', sa.Column('attachment_mime', sa.String(length=127), nullable=True))


def downgrade() -> None:
    op.drop_column('messages', 'attachment_mime')
    op.drop_column('messages', 'attachment_name')
    op.drop_column('messages', 'attachment_url')
