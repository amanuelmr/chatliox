from pydantic import BaseModel


class DailyVolume(BaseModel):
    date: str
    count: int


class AgentStat(BaseModel):
    agent_name: str
    resolved_count: int


class AnalyticsSummaryResponse(BaseModel):
    total_conversations: int
    waiting_count: int
    open_count: int
    closed_count: int
    avg_first_response_minutes: float | None
    first_response_target_minutes: int | None
    # Share of answered chats whose first reply came within the target, 0-100.
    first_response_within_target_pct: float | None
    avg_csat: float | None
    csat_response_count: int
    volume_by_day: list[DailyVolume]
    per_agent: list[AgentStat]
