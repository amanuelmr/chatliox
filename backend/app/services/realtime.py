"""Pushes conversation changes to the dashboard and the open chat windows."""
from app.core.ws_manager import manager
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.conversation import ConversationResponse
from app.schemas.message import MessageResponse
from app.websockets.router import org_room


async def publish_message(message: Message) -> None:
    """Send a new message to the chat window. Internal notes only reach agents."""
    event = {"type": "message", **MessageResponse.model_validate(message).model_dump(mode="json")}
    if message.is_internal:
        await manager.broadcast_to_agents(str(message.conversation_id), event)
    else:
        await manager.broadcast(str(message.conversation_id), event)


async def publish_status(conversation: Conversation) -> None:
    """Tell the visitor's widget the chat was resolved or reopened."""
    await manager.broadcast(str(conversation.id), {"type": "status", "status": conversation.status.value})


async def publish_conversation(conversation: Conversation) -> None:
    """Refresh the conversation in every teammate's inbox. Needs the assignee loaded."""
    await manager.broadcast(
        org_room(conversation.organization_id),
        {"type": "conversation_updated", **ConversationResponse.model_validate(conversation).model_dump(mode="json")},
    )
