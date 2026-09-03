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
- Email verification for new accounts, sent via Resend

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
| `UNANSWERED_ALERT_POLL_SECONDS` | How often the backend checks for unanswered conversations |

### Frontend

Set these in `frontend/.env`:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API used by the frontend |

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
