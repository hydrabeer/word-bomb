# Observing Backend Logs

All backend logs are single-line JSON objects. Use standard tooling like `jq` to filter or aggregate.

- Filter by game: `jq -c 'select(.gameId=="$G")' server.log`
- p95 round time: `jq -r 'select(.event=="round_ended") | .duration_ms' server.log | datamash perc:95`
- Count errors by event: `jq -r 'select(.level=="error") | .event' server.log | sort | uniq -c`

Example log:

```json
{
  "ts": "2025-01-01T12:00:00.000Z",
  "level": "info",
  "service": "backend",
  "event": "game_started",
  "gameId": "ABCD",
  "pid": 12345,
  "msg": "Game started"
}
```

Fields:

- `service`, `version`, `pid`: process metadata
- `event`: stable event identifier
- `ts`: ISO-8601 timestamp
- Correlation keys (`connId`, `gameId`, `playerId`) appear when available
- Errors include `err.type`, `err.message`, and `err.stack`
