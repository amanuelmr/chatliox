"""keep a short preview of each chat's latest message for the inbox list

Revision ID: 0024
Revises: 0023
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('conversations', sa.Column('last_message_preview', sa.String(200), nullable=True))
    op.add_column('conversations', sa.Column('last_message_sender', sa.String(10), nullable=True))
    # Fill in existing chats from their latest message the visitor could see.
    op.execute(
        """
        UPDATE conversations AS c
        SET last_message_preview = left(latest.preview, 200),
            last_message_sender = latest.sender
        FROM (
            SELECT DISTINCT ON (conversation_id)
                conversation_id,
                sender_type::text AS sender,
                CASE WHEN content <> '' THEN content ELSE 'Sent a file: ' || coalesce(attachment_name, '') END AS preview
            FROM messages
            WHERE NOT is_internal
            ORDER BY conversation_id, created_at DESC
        ) AS latest
        WHERE c.id = latest.conversation_id
        """
    )


def downgrade() -> None:
    op.drop_column('conversations', 'last_message_sender')
    op.drop_column('conversations', 'last_message_preview')
