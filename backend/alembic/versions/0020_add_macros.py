"""turn saved replies into macros: a slash shortcut, follow-up actions and a use count

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('canned_responses', sa.Column('shortcut', sa.String(32), nullable=True))
    op.add_column(
        'canned_responses',
        sa.Column('actions', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column('canned_responses', sa.Column('use_count', sa.Integer(), nullable=False, server_default='0'))
    op.alter_column('canned_responses', 'content', existing_type=sa.Text(), nullable=False, server_default='')
    op.create_index(
        'uq_canned_responses_org_shortcut',
        'canned_responses',
        ['organization_id', 'shortcut'],
        unique=True,
        postgresql_where=sa.text('shortcut IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_canned_responses_org_shortcut', table_name='canned_responses')
    op.alter_column('canned_responses', 'content', existing_type=sa.Text(), nullable=False, server_default=None)
    op.drop_column('canned_responses', 'use_count')
    op.drop_column('canned_responses', 'actions')
    op.drop_column('canned_responses', 'shortcut')
