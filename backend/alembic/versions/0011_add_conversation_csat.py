"""add conversation csat rating

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('conversations', sa.Column('csat_rating', sa.Integer(), nullable=True))
    op.create_check_constraint(
        'ck_conversations_csat_rating_range',
        'conversations',
        'csat_rating IS NULL OR (csat_rating >= 1 AND csat_rating <= 5)',
    )


def downgrade() -> None:
    op.drop_constraint('ck_conversations_csat_rating_range', 'conversations', type_='check')
    op.drop_column('conversations', 'csat_rating')
