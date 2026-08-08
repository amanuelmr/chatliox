"""add widget appearance fields

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column('widget_color', sa.String(length=7), nullable=False, server_default='#4f6ef7'),
    )
    op.add_column(
        'organizations',
        sa.Column(
            'widget_greeting',
            sa.String(length=280),
            nullable=False,
            server_default="Send us a message and we'll get back to you shortly.",
        ),
    )


def downgrade() -> None:
    op.drop_column('organizations', 'widget_greeting')
    op.drop_column('organizations', 'widget_color')
