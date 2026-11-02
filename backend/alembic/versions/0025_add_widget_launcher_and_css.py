"""let teams hide the default launcher and style the widget with their own CSS

Revision ID: 0025
Revises: 0024
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = '0025'
down_revision = '0024'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('widget_launcher', sa.String(10), nullable=False, server_default='always'))
    op.add_column('organizations', sa.Column('widget_custom_css', sa.Text(), nullable=False, server_default=''))


def downgrade() -> None:
    op.drop_column('organizations', 'widget_custom_css')
    op.drop_column('organizations', 'widget_launcher')
