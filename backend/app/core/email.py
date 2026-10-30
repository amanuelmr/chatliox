import logging
import re
from html import escape

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def _send(to_email: str, subject: str, html_body: str) -> None:
    # Local stacks usually have no Resend key; log the email (and its links, e.g.
    # the verification URL) so sign-up still works end to end.
    if not settings.RESEND_API_KEY and settings.ENVIRONMENT == "development":
        links = sorted(set(re.findall(r'href="([^"]+)"', html_body)))
        logger.warning("Email not sent (no RESEND_API_KEY) to=%s subject=%r links=%s", to_email, subject, links)
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.EMAIL_FROM,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            },
        )
        response.raise_for_status()


async def send_invite_email(to_email: str, org_name: str, invite_url: str) -> None:
    subject = f"You're invited to join {org_name} on Chatliox"
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:20px;font-weight:600;color:#111827;margin:0 0 8px">
        You've been invited to {org_name}
      </h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6">
        A teammate has invited you to join <strong>{org_name}</strong> on Chatliox.
        Click the button below to create your account and get started.
      </p>
      <a href="{invite_url}"
         style="display:inline-block;background:#4f6ef7;color:#fff;font-size:14px;
                font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px">
        Accept invitation →
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;line-height:1.6">
        Or copy this link: <a href="{invite_url}" style="color:#4f6ef7">{invite_url}</a>
      </p>
    </div>
    """
    await _send(to_email, subject, html_body)


async def send_verification_email(to_email: str, full_name: str, verify_url: str) -> None:
    subject = "Verify your email for Chatliox"
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:20px;font-weight:600;color:#111827;margin:0 0 8px">
        Verify your email
      </h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6">
        Hi {full_name}, confirm this is your email address to finish setting up your
        Chatliox account.
      </p>
      <a href="{verify_url}"
         style="display:inline-block;background:#4f6ef7;color:#fff;font-size:14px;
                font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px">
        Verify email →
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;line-height:1.6">
        Or copy this link: <a href="{verify_url}" style="color:#4f6ef7">{verify_url}</a>
        This link expires in 24 hours.
      </p>
    </div>
    """
    await _send(to_email, subject, html_body)


async def send_password_reset_email(to_email: str, full_name: str, reset_url: str) -> None:
    subject = "Reset your Chatliox password"
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:20px;font-weight:600;color:#111827;margin:0 0 8px">
        Reset your password
      </h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6">
        Hi {full_name}, we received a request to reset your Chatliox password. Click the
        button below to choose a new one. If you didn't request this, you can ignore this email.
      </p>
      <a href="{reset_url}"
         style="display:inline-block;background:#4f6ef7;color:#fff;font-size:14px;
                font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px">
        Reset password →
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;line-height:1.6">
        Or copy this link: <a href="{reset_url}" style="color:#4f6ef7">{reset_url}</a>
        This link expires in 1 hour.
      </p>
    </div>
    """
    await _send(to_email, subject, html_body)


async def send_unanswered_alert_email(
    to_email: str, visitor_label: str, minutes: int, conversation_url: str
) -> None:
    subject = f"{visitor_label} has been waiting {minutes} min for a reply"
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:20px;font-weight:600;color:#111827;margin:0 0 8px">
        A conversation needs a reply
      </h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6">
        <strong>{visitor_label}</strong> has been waiting more than {minutes} minutes
        without a response on Chatliox.
      </p>
      <a href="{conversation_url}"
         style="display:inline-block;background:#4f6ef7;color:#fff;font-size:14px;
                font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px">
        Open conversation →
      </a>
    </div>
    """
    await _send(to_email, subject, html_body)


async def send_missed_replies_email(
    to_email: str, org_name: str, replies: list[tuple[str, str]]
) -> None:
    """replies: (sender name, message text) pairs, oldest first. Message text is
    untrusted, so everything interpolated here is HTML-escaped."""
    org = escape(org_name)
    subject = f"New reply from {org_name}"
    items = "".join(
        f"""
      <div style="border-left:3px solid #4f6ef7;padding:4px 0 4px 12px;margin:0 0 16px">
        <p style="font-size:12px;font-weight:600;color:#374151;margin:0 0 4px">{escape(sender)}</p>
        <p style="font-size:14px;color:#111827;margin:0;line-height:1.6;white-space:pre-wrap">{escape(text)}</p>
      </div>"""
        for sender, text in replies
    )
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:20px;font-weight:600;color:#111827;margin:0 0 8px">
        {org} replied to your message
      </h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6">
        You'd left the chat by the time they answered, so here's what they said.
      </p>
      {items}
      <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;line-height:1.6">
        To continue the conversation, open the chat on {org}'s website.
      </p>
    </div>
    """
    await _send(to_email, subject, html_body)
