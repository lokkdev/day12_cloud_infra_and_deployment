# Lab 12 — BaSau Production Agent (Final Project)

Production-ready AI agent kết hợp **tất cả Day 12 concepts** + **Day06 Hackathon** (Gemini agent, tools, customer UI).

**Live demo:** http://202.92.7.140:8000/?order=ORD-001

---

## Deliverable Checklist

- [x] Multi-stage Dockerfile (< 500 MB)
- [x] docker-compose.yml (agent + Redis)
- [x] Health (`GET /health`) + Readiness (`GET /ready`)
- [x] API Key authentication (`POST /ask`)
- [x] Rate limiting (in-memory, per API key)
- [x] Cost guard (daily budget USD)
- [x] 12-factor config (`.env.local`)
- [x] Structured JSON logging
- [x] Graceful shutdown (SIGTERM)
- [x] BaSau Gemini agent + 8 tools (Day06)
- [x] Customer web UI (Day06 hackathon)
- [x] CI/CD (GitHub Actions → VPS)
- [x] pytest + ruff

---

## Project Structure

```
06-lab-complete/
├── app/
│   ├── main.py           # FastAPI entry — API + static UI
│   ├── config.py         # 12-factor settings
│   ├── chat_api.py       # /api/chat/* for web UI
│   ├── chat_store.py     # In-memory chat sync/escalate
│   └── basau/
│       ├── agent.py      # Gemini + tool-calling loop
│       ├── tools.py      # 8 agent tools
│       ├── domain.py     # Order status, cancel flow
│       └── data_store.py
├── web/                  # Day06 customer UI (HTML/CSS/JS)
├── ai-model/             # SYSTEM_PROMPT, rules, tools docs
├── data/data.json        # Demo orders
├── utils/mock_llm.py     # Fallback when no GEMINI_API_KEY
├── scripts/deploy-remote.sh
├── tests/                # pytest (13 tests)
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── railway.toml
└── render.yaml
```

---

## Quick Start (Local)

```bash
cd 06-lab-complete

# 1. Environment
cp .env.example .env.local
# Edit .env.local — set GEMINI_API_KEY, AGENT_API_KEY, JWT_SECRET

# 2. Run with Docker
docker compose up -d --build

# 3. Open UI
open http://localhost:8000/?order=ORD-001

# 4. Test API
API_KEY=$(grep AGENT_API_KEY .env.local | cut -d= -f2)
curl http://localhost:8000/health
curl -X POST http://localhost:8000/ask \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "Đơn ORD-001 sao rồi?", "order_id": "ORD-001"}'
```

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | — | Customer UI (order + chat) |
| `GET` | `/policies` | — | Policies page |
| `GET` | `/api` | — | API metadata (JSON) |
| `GET` | `/health` | — | Liveness probe |
| `GET` | `/ready` | — | Readiness probe |
| `POST` | `/ask` | `X-API-Key` | Agent API |
| `GET` | `/api/chat/status` | — | UI: AI enabled? |
| `POST` | `/api/chat/init` | — | UI: start chat session |
| `POST` | `/api/chat/message` | — | UI: send message |
| `GET` | `/metrics` | `X-API-Key` | Usage metrics |

---

## Development

```bash
pip install -r requirements-dev.txt
ruff check app tests
ruff format app tests
pytest tests -v
python check_production_ready.py
```

---

## VPS Deploy

See root [DEPLOYMENT.md](../DEPLOYMENT.md) for full details.

```bash
ssh -p 24700 root@YOUR_VPS_IP
cd /opt/basau-agent/06-lab-complete
cp .env.example .env.local && nano .env.local
docker-compose down --remove-orphans
docker-compose up -d --build --force-recreate
```

**docker-compose v1 note:** If you see `KeyError: 'ContainerConfig'`, run `docker-compose down` and remove old containers before `up`. See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md).

---

## CI/CD

- **CI** (`.github/workflows/ci.yml`): ruff + pytest on every push to `06-lab-complete/**`
- **CD** (`.github/workflows/cd.yml`): SSH deploy to VPS after CI passes

GitHub Secrets: `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_REPO_DIR`

---

## Railway / Render (alternative)

```bash
# Railway
cd 06-lab-complete
railway login && railway init && railway up

# Render — connect repo, uses render.yaml
```

Set `GEMINI_API_KEY`, `AGENT_API_KEY`, `JWT_SECRET` in platform dashboard.

---

## Production Readiness

```bash
python check_production_ready.py
```
