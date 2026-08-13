from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/chatliox"
    SECRET_KEY: str = "change-me"
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Chatliox <notifications@notify.amanuel.work>"

    # How long a conversation can sit unanswered before the team gets an
    # email nudge, and how often the sweep checks for that.
    UNANSWERED_ALERT_MINUTES: int = 5
    UNANSWERED_ALERT_POLL_SECONDS: int = 60

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
