# Chatliox

Chatliox is a live chat tool for websites.

It helps a team answer visitor questions in real time through a website chat widget and a shared inbox. Instead of missing questions, losing leads, or handling support through scattered email threads, Chatliox gives visitors one simple place to start a conversation and gives the team one place to manage replies.

## What It Does

Chatliox is built for this flow:

1. A business adds the chat widget to its website.
2. A visitor opens the widget and sends a message.
3. The conversation appears in the admin dashboard instantly.
4. A team member replies from the dashboard.
5. Both sides continue the conversation live.

The project includes:

- A website chat widget for visitors
- A dashboard for support or sales teams
- Real-time messaging with live updates
- Conversation states such as waiting, open, and closed
- Internal notes that stay visible only to the team
- Team invites and role-based access
- Saved canned responses agents can insert into replies
- Conversation tags and full-text search across the inbox
- Customizable widget branding (color, greeting, launcher icon, position, panel size and edge offsets)
- An analytics view with volume, first response time, and per-agent stats
- Visitor CSAT ratings on resolved conversations
- Missed-reply emails: if a visitor who left their email closes the chat before an agent answers, the replies are emailed to them
- Business hours with an away mode: outside the weekly schedule the widget shows an away message and asks visitors for an email
- A pre-chat form: choose whether name and email are asked for or required, and add up to five custom questions whose answers show beside the conversation
- Chat transcripts: visitors can email themselves a copy from the widget, and agents can send one from the inbox. Internal notes are never included
- Email verification for new accounts, sent via Resend
- Self-service password reset via an emailed, expiring link

## What Problem It Solves

Many websites make it hard for visitors to ask questions at the right moment. Contact forms feel slow, email replies get delayed, and teams often lack a shared place to follow conversations.

Chatliox solves that by:

- letting visitors ask for help without leaving the page
- showing new conversations to the team right away
- keeping all replies in one organized inbox
- helping teams see which conversations still need attention
- making it easier to respond before a visitor leaves

## Project Structure

### Backend

The backend provides:

- authentication
- conversation and message APIs
- team and invite management
- WebSocket connections for real-time chat
- database migrations

Main tools used:

- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic

### Frontend

The frontend provides:

- the public chat widget
- the login and registration screens
- the admin dashboard
- the conversation inbox and reply interface

Main tools used:

- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- TanStack Query

## Getting Started

### With Docker (recommended)

```bash
docker compose up --build
```

This starts a local Postgres, the API with hot reload on http://localhost:8000 (migrations run on startup), and the dashboard on http://localhost:5173. Nothing touches your hosted database, and no `.env` files are needed. If those ports are taken, override them: `API_PORT=8010 WEB_PORT=5174 docker compose up --build`. Open a database shell with `docker compose exec db psql -U chatliox`.

Sign-up, password reset and invites send email through Resend, so export `RESEND_API_KEY` before running the command. Without it the API reports the missing key at startup and those requests fail with a clear error instead of silently doing nothing.

To run the services without Docker instead:

### Backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# set DATABASE_URL and SECRET_KEY

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Tests

The backend tests run against a real Postgres. Point `DATABASE_URL` at an empty database, then:

```bash
cd backend
pip install -r requirements-dev.txt
alembic upgrade head
pytest
```

Frontend tests use Vitest and Testing Library, with the API mocked:

```bash
cd frontend
npm test
```

CI runs both suites, the frontend build and the API Docker build on every pull request.

## Environment Variables

### Backend

Set these in `backend/.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Secret used to sign login tokens |
| `ENVIRONMENT` | `development` or `production` |
| `ALLOWED_ORIGINS` | Frontend origins allowed to call the API |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Login token lifetime in minutes |
| `RESEND_API_KEY` | API key for [Resend](https://resend.com), used to send verification, invite, and alert emails |
| `EMAIL_FROM` | Sender address for outgoing email, e.g. `Chatliox <notifications@yourdomain.com>` — the domain must be verified in Resend |
| `UNANSWERED_ALERT_MINUTES` | Minutes a conversation can sit unanswered before the team gets an email alert |
| `UNANSWERED_ALERT_POLL_SECONDS` | How often the backend checks for unanswered conversations and missed replies |
| `MISSED_REPLY_EMAIL_MINUTES` | Minutes an agent reply can go unseen before it's emailed to a visitor who left their email |

### Frontend

Set these in `frontend/.env`:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API used by the frontend |

## Deploying the API

The API runs on Render's free plan from `render.yaml`. In Render, choose **New → Blueprint**, pick this repository, and fill in the prompted values:

- `DATABASE_URL`: the Supabase **session pooler** connection string (Render can't reach Supabase's IPv6-only direct host), with the scheme changed to `postgresql+asyncpg://`
- `ALLOWED_ORIGINS`: the frontend URL, e.g. `https://chatliox.vercel.app`
- `RESEND_API_KEY`: your Resend key

Migrations run on every start, and a deploy only goes out once the CI checks on that commit have passed. Point the frontend's `VITE_API_URL` at the Render URL.

Free instances sleep after 15 minutes without traffic and take about a minute to wake. To keep the API awake, have a free uptime monitor (e.g. UptimeRobot) request `/health` every 10 minutes. Uploaded files are stored on the instance's disk, which is wiped on every deploy or restart.

## Embedding the Widget

After creating an account, copy the widget key from the dashboard and add one script tag to the target website, right before `</body>`:

```html
<script
  src="https://your-frontend-domain.com/widget.js"
  data-widget-key="YOUR_WIDGET_KEY"
  async>
</script>
```

That's it — no cloning this repo, no iframe sizing to get right by hand. The script injects a launcher bubble and a chat panel that stay out of the way of the rest of the page, shows a badge when a reply arrives while the panel is closed, and cleans up after itself if you remove the tag.

Business hours live under Settings → Business hours: pick a timezone, set opening times per weekday and write an away message. While the team is outside those hours the widget shows the away message, requires an email before a visitor can start a conversation, and flips back to normal on its own when the schedule opens again.

The pre-chat form lives under Settings → Pre-chat form. Name and email can each be left out, optional or required, and you can add up to five questions as short answers or dropdowns. Email is still required outside business hours whatever the setting.

Launcher position, icon, brand color, panel size and edge offsets are all controlled from Settings → Widget appearance in the dashboard — no snippet changes needed when they change. The one script-tag override available is:

- `data-position="left"` — pins the launcher to the bottom-left regardless of the dashboard setting (useful if a specific page needs to differ from the org default).
- `window.chatliox.open()` / `.close()` / `.toggle()` — control the widget programmatically from the host page's own JavaScript.

If you'd rather host the chat panel yourself inside a fixed-size box you control (e.g. inside an existing support page), the old direct iframe embed still works — note it always renders the panel itself, so position/size/icon settings from the dashboard don't apply; you control that layout with your own CSS:

```html
<iframe
  src="https://your-frontend-domain.com/widget?key=YOUR_WIDGET_KEY"
  style="position:fixed;bottom:24px;right:24px;width:380px;height:560px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:9999"
  allow="clipboard-write">
</iframe>
```

## License

MIT
