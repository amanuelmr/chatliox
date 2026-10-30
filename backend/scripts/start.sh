#!/bin/sh
set -e

# Apply pending migrations before serving so a deploy never runs new code
# against an old schema.
alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
