import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _make_ssl_context() -> ssl.SSLContext:
    import certifi
    return ssl.create_default_context(cafile=certifi.where())


def _send_sync(to_email: str, subject: str, html_body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    ctx = _make_ssl_context()

    if settings.SMTP_TLS:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ctx)
            smtp.ehlo()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(msg["From"], to_email, msg.as_string())
    else:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=ctx) as smtp:
            smtp.ehlo()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(msg["From"], to_email, msg.as_string())


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
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_sync, to_email, subject, html_body)


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
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_sync, to_email, subject, html_body)
