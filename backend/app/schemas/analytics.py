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
    volume_by_day: list[DailyVolume]
    per_agent: list[AgentStat]
