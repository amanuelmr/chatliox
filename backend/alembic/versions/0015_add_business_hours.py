"""add business hours schedule and away message to organizations

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-30
"""
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None

DEFAULT_SCHEDULE = json.dumps(
    [{"enabled": day < 5, "start": "09:00", "end": "17:00"} for day in range(7)]
)


def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column('business_hours_enabled', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'organizations',
        sa.Column('business_hours_timezone', sa.String(length=64), nullable=False, server_default='UTC'),
    )
    op.add_column(
        'organizations',
        sa.Column(
            'business_hours',
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text(f"'{DEFAULT_SCHEDULE}'::jsonb"),
        ),
    )
    op.add_column(
        'organizations',
        sa.Column(
            'away_message',
            sa.String(length=280),
            nullable=False,
            server_default="We're away right now. Leave a message and we'll get back to you by email.",
        ),
    )


def downgrade() -> None:
    op.drop_column('organizations', 'away_message')
    op.drop_column('organizations', 'business_hours')
    op.drop_column('organizations', 'business_hours_timezone')
    op.drop_column('organizations', 'business_hours_enabled')
