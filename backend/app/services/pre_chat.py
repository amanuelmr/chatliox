import secrets

from app.models.organization import Organization
from app.schemas.conversation import CreateConversationRequest
from app.schemas.widget import PreChatField


class PreChatError(ValueError):
    """The visitor's pre-chat answers don't satisfy the org's form."""


def assign_field_ids(fields: list[PreChatField]) -> list[dict]:
    """Keep existing question ids so stored answers stay linked, and give new ones a fresh id."""
    taken = {f.id for f in fields if f.id}
    used: set[str] = set()
    result = []
    for field in fields:
        field_id = field.id
        while field_id is None or field_id in used or (field.id is None and field_id in taken):
            field_id = secrets.token_hex(4)
        used.add(field_id)
        result.append({**field.model_dump(), "id": field_id})
    return result


def collect_pre_chat_answers(org: Organization, body: CreateConversationRequest) -> list[dict]:
    """Check the request against the org's form and return the answers as
    [{"label", "value"}], in the form's order, skipping blank optional ones."""
    if org.pre_chat_name == "required" and not (body.visitor_name or "").strip():
        raise PreChatError("Please enter your name")
    if org.pre_chat_email == "required" and not body.visitor_email:
        raise PreChatError("Please enter your email")

    known = {field["id"] for field in org.pre_chat_fields}
    if set(body.pre_chat_answers) - known:
        raise PreChatError("This form has changed, please reload and try again")

    answers = []
    for field in org.pre_chat_fields:
        value = body.pre_chat_answers.get(field["id"], "").strip()
        if not value:
            if field.get("required"):
                raise PreChatError(f"Please answer \"{field['label']}\"")
            continue
        if field["type"] == "select" and value not in field.get("options", []):
            raise PreChatError(f"Please choose an option for \"{field['label']}\"")
        answers.append({"label": field["label"], "value": value})
    return answers
