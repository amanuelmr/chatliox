from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # { conversation_id: set of active WebSocket connections }
        self._rooms: dict[str, set[WebSocket]] = {}
        # { conversation_id: number of open visitor connections }
        self._visitors: dict[str, int] = {}
        # { user_id: number of open dashboard connections }
        self._agents: dict[str, int] = {}
        # { conversation_id: { user_id: (name, that agent's sockets on the conversation) } }
        self._viewers: dict[str, dict[str, tuple[str, set[WebSocket]]]] = {}

    async def connect(self, conversation_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms.setdefault(conversation_id, set()).add(websocket)

    def add_connection(self, conversation_id: str, websocket: WebSocket) -> None:
        """Register an already-accepted websocket into a room."""
        self._rooms.setdefault(conversation_id, set()).add(websocket)

    def disconnect(self, conversation_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(conversation_id)
        if room:
            room.discard(websocket)
            if not room:
                del self._rooms[conversation_id]

    def visitor_connected(self, conversation_id: str) -> None:
        self._visitors[conversation_id] = self._visitors.get(conversation_id, 0) + 1

    def visitor_disconnected(self, conversation_id: str) -> None:
        remaining = self._visitors.get(conversation_id, 0) - 1
        if remaining > 0:
            self._visitors[conversation_id] = remaining
        else:
            self._visitors.pop(conversation_id, None)

    def is_visitor_connected(self, conversation_id: str) -> bool:
        return conversation_id in self._visitors

    def agent_connected(self, user_id: str) -> None:
        self._agents[user_id] = self._agents.get(user_id, 0) + 1

    def agent_disconnected(self, user_id: str) -> None:
        remaining = self._agents.get(user_id, 0) - 1
        if remaining > 0:
            self._agents[user_id] = remaining
        else:
            self._agents.pop(user_id, None)

    def online_agent_ids(self) -> set[str]:
        return set(self._agents)

    def viewer_joined(self, conversation_id: str, user_id: str, name: str, websocket: WebSocket) -> None:
        viewers = self._viewers.setdefault(conversation_id, {})
        viewers.setdefault(user_id, (name, set()))[1].add(websocket)

    def viewer_left(self, conversation_id: str, user_id: str, websocket: WebSocket) -> None:
        viewers = self._viewers.get(conversation_id, {})
        entry = viewers.get(user_id)
        if entry is None:
            return
        entry[1].discard(websocket)
        if not entry[1]:
            del viewers[user_id]
        if not viewers:
            self._viewers.pop(conversation_id, None)

    def viewers(self, conversation_id: str) -> list[dict]:
        return [
            {"user_id": user_id, "name": name}
            for user_id, (name, _) in self._viewers.get(conversation_id, {}).items()
        ]

    async def broadcast_viewers(self, conversation_id: str) -> None:
        """Tell every agent on the conversation who else has it open. Visitors aren't told."""
        event = {"type": "viewers", "agents": self.viewers(conversation_id)}
        for _, sockets in list(self._viewers.get(conversation_id, {}).values()):
            for ws in sockets.copy():
                try:
                    await ws.send_json(event)
                except Exception:
                    pass

    async def broadcast(self, conversation_id: str, data: dict) -> None:
        await self._send_to_room(conversation_id, data, exclude=None)

    async def broadcast_except(
        self, conversation_id: str, data: dict, exclude: WebSocket
    ) -> None:
        await self._send_to_room(conversation_id, data, exclude=exclude)

    async def _send_to_room(
        self,
        conversation_id: str,
        data: dict,
        exclude: WebSocket | None,
    ) -> None:
        room = self._rooms.get(conversation_id)
        if not room:
            return
        dead: set[WebSocket] = set()
        for ws in room.copy():
            if ws is exclude:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(conversation_id, ws)


manager = ConnectionManager()
