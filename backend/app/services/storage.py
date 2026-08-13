import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

# Vercel's serverless filesystem is read-only except for /tmp, so local
# attachment storage has to live there in production.
MEDIA_ROOT = (
    Path("/tmp/media")
    if os.environ.get("VERCEL")
    else Path(__file__).resolve().parent.parent.parent / "media"
)
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# Deliberately narrow allowlist — attachments are user-uploaded and served
# back out over HTTP, so anything executable or script-bearing (svg, html) is excluded.
EXTENSION_BY_MIME = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
}


async def save_attachment(conversation_id: str, file: UploadFile) -> tuple[str, str, str]:
    """Validates and persists an uploaded file. Returns (url, original_name, mime)."""
    mime = file.content_type or ""
    ext = EXTENSION_BY_MIME.get(mime)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Allowed: images, PDF, plain text.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 10MB)",
        )

    # conversation_id already validated as a UUID by the caller's path/form
    # parameter — safe to use directly as a directory segment.
    conv_dir = MEDIA_ROOT / str(conversation_id)
    conv_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4()}{ext}"
    (conv_dir / stored_name).write_bytes(data)

    url = f"/media/{conversation_id}/{stored_name}"
    original_name = file.filename or stored_name
    return url, original_name, mime
