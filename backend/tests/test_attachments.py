import pytest
from httpx import AsyncClient


@pytest.fixture(autouse=True)
def _media_in_tmp(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.storage.MEDIA_ROOT", tmp_path)
    return tmp_path


def _upload(conv: dict, name: str, mime: str, data: bytes, sender_type: str = "visitor"):
    data_fields = {"conversation_id": conv["id"], "sender_type": sender_type}
    if sender_type == "visitor":
        data_fields["visitor_id"] = conv["visitor_id"]
    return {
        "data": data_fields,
        "files": {"file": (name, data, mime)},
    }


async def test_visitor_uploads_an_image(client: AsyncClient, admin: dict, start_chat, _media_in_tmp):
    conv = await start_chat(admin)
    res = await client.post("/messages/attachments", **_upload(conv, "photo.png", "image/png", b"\x89PNG..."))
    assert res.status_code == 201, res.text
    message = res.json()
    assert message["attachment_name"] == "photo.png"
    assert message["attachment_mime"] == "image/png"
    stored = _media_in_tmp / conv["id"] / message["attachment_url"].rsplit("/", 1)[-1]
    assert stored.read_bytes() == b"\x89PNG..."


async def test_rejects_unsafe_empty_and_huge_files(client: AsyncClient, admin: dict, start_chat, monkeypatch):
    conv = await start_chat(admin)
    res = await client.post("/messages/attachments", **_upload(conv, "x.svg", "image/svg+xml", b"<svg/>"))
    assert res.status_code == 415
    res = await client.post("/messages/attachments", **_upload(conv, "x.txt", "text/plain", b""))
    assert res.status_code == 400

    monkeypatch.setattr("app.services.storage.MAX_UPLOAD_BYTES", 4)
    res = await client.post("/messages/attachments", **_upload(conv, "x.txt", "text/plain", b"12345"))
    assert res.status_code == 413


async def test_uploading_as_an_agent_needs_a_login(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin)
    upload = _upload(conv, "a.txt", "text/plain", b"hi", sender_type="admin")
    assert (await client.post("/messages/attachments", **upload)).status_code == 401
    res = await client.post("/messages/attachments", headers=admin["headers"], **upload)
    assert res.status_code == 201
    assert res.json()["sender_name"] == "Ada Admin"


async def test_another_visitor_cannot_upload(client: AsyncClient, admin: dict, start_chat):
    conv = await start_chat(admin)
    upload = _upload({**conv, "visitor_id": "someone-else"}, "a.txt", "text/plain", b"hi")
    assert (await client.post("/messages/attachments", **upload)).status_code == 404
