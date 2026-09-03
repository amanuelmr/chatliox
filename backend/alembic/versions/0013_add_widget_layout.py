"""add widget position, icon, size and offset fields

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column('widget_position', sa.String(length=10), nullable=False, server_default='right'),
    )
    op.add_column(
        'organizations',
        sa.Column('widget_icon_url', sa.String(length=500), nullable=True),
    )
    op.add_column(
        'organizations',
        sa.Column('widget_width', sa.Integer(), nullable=False, server_default='376'),
    )
    op.add_column(
        'organizations',
        sa.Column('widget_height', sa.Integer(), nullable=False, server_default='600'),
    )
    op.add_column(
        'organizations',
        sa.Column('widget_offset_x', sa.Integer(), nullable=False, server_default='20'),
    )
    op.add_column(
        'organizations',
        sa.Column('widget_offset_y', sa.Integer(), nullable=False, server_default='20'),
    )


def downgrade() -> None:
    op.drop_column('organizations', 'widget_offset_y')
    op.drop_column('organizations', 'widget_offset_x')
    op.drop_column('organizations', 'widget_height')
    op.drop_column('organizations', 'widget_width')
    op.drop_column('organizations', 'widget_icon_url')
    op.drop_column('organizations', 'widget_position')
