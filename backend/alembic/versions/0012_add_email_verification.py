"""add verification tokens and users.is_verified

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )

    op.create_table(
        'verification_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False, unique=True),
        sa.Column('purpose', sa.Enum('email_verify', name='verification_purpose'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_verification_tokens_user_id', 'verification_tokens', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_verification_tokens_user_id', table_name='verification_tokens')
    op.drop_table('verification_tokens')
    op.execute("DROP TYPE verification_purpose")
    op.drop_column('users', 'is_verified')
