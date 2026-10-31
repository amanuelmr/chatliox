import uuid

from httpx import AsyncClient

FORM = {
    "pre_chat_name": "required",
    "pre_chat_email": "optional",
    "pre_chat_fields": [
        {"label": "Order number", "type": "text", "required": True},
        {"label": "Topic", "type": "select", "options": ["Billing", "Shipping"]},
    ],
}


async def _save_form(client: AsyncClient, admin: dict, form: dict = FORM) -> list[dict]:
    res = await client.put("/organizations/pre-chat-form", headers=admin["headers"], json=form)
    assert res.status_code == 200, res.text
    return res.json()["pre_chat_fields"]


def _start(admin: dict, **body) -> dict:
    return {
        "visitor_id": str(uuid.uuid4()),
        "widget_key": admin["me"]["organization"]["widget_key"],
        **body,
    }


async def test_form_is_published_to_the_widget(client: AsyncClient, admin: dict):
    fields = await _save_form(client, admin)
    assert all(f["id"] for f in fields)

    widget_key = admin["me"]["organization"]["widget_key"]
    config = (await client.get(f"/organizations/widget/{widget_key}")).json()
    assert config["pre_chat_name"] == "required"
    assert [f["label"] for f in config["pre_chat_fields"]] == ["Order number", "Topic"]


async def test_saving_again_keeps_question_ids(client: AsyncClient, admin: dict):
    fields = await _save_form(client, admin)
    resaved = await _save_form(client, admin, {**FORM, "pre_chat_fields": fields})
    assert [f["id"] for f in resaved] == [f["id"] for f in fields]


async def test_answers_are_validated_and_stored(client: AsyncClient, admin: dict):
    order, topic = (f["id"] for f in await _save_form(client, admin))

    res = await client.post("/conversations", json=_start(admin, pre_chat_answers={order: "A-1"}))
    assert res.status_code == 422
    assert res.json()["detail"] == "Please enter your name"

    res = await client.post("/conversations", json=_start(admin, visitor_name="Vi"))
    assert res.status_code == 422
    assert res.json()["detail"] == 'Please answer "Order number"'

    bad_choice = _start(admin, visitor_name="Vi", pre_chat_answers={order: "A-1", topic: "Refunds"})
    res = await client.post("/conversations", json=bad_choice)
    assert res.status_code == 422

    good = _start(admin, visitor_name="Vi", pre_chat_answers={order: " A-1 ", topic: "Billing"})
    res = await client.post("/conversations", json=good)
    assert res.status_code == 201, res.text
    assert res.json()["pre_chat_answers"] == [
        {"label": "Order number", "value": "A-1"},
        {"label": "Topic", "value": "Billing"},
    ]


async def test_unknown_question_is_rejected(client: AsyncClient, admin: dict):
    await _save_form(client, admin)
    body = _start(admin, visitor_name="Vi", pre_chat_answers={"stale": "x"})
    res = await client.post("/conversations", json=body)
    assert res.status_code == 422


async def test_required_email(client: AsyncClient, admin: dict):
    await _save_form(client, admin, {"pre_chat_name": "hidden", "pre_chat_email": "required"})
    res = await client.post("/conversations", json=_start(admin))
    assert res.status_code == 422
    res = await client.post("/conversations", json=_start(admin, visitor_email="v@example.com"))
    assert res.status_code == 201


async def test_invalid_forms_are_rejected(client: AsyncClient, admin: dict):
    one_option = {"label": "Topic", "type": "select", "options": ["Billing"]}
    duplicate = [{"label": "Topic", "type": "text"}, {"label": "topic", "type": "text"}]
    too_many = [{"label": f"Q{i}", "type": "text"} for i in range(6)]
    for fields in ([one_option], duplicate, too_many):
        res = await client.put(
            "/organizations/pre-chat-form",
            headers=admin["headers"],
            json={"pre_chat_name": "optional", "pre_chat_email": "optional", "pre_chat_fields": fields},
        )
        assert res.status_code == 422, fields
