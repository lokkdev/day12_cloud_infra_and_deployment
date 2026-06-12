# Deployment Information — Day 12 Final Submission

> **Repo:** [lokkdev/day12_cloud_infra_and_deployment](https://github.com/lokkdev/day12_cloud_infra_and_deployment)  
> **Final project:** `06-lab-complete/` (BaSau Food AI Agent + Customer UI)

---

## Public URLs

### Primary — VPS (Lab 06 Production)

| Service | URL |
|---------|-----|
| **Customer UI** | http://202.92.7.140:8000/?order=ORD-001 |
| **Policies page** | http://202.92.7.140:8000/policies |
| **Health** | http://202.92.7.140:8000/health |
| **API info** | http://202.92.7.140:8000/api |

### Secondary — Railway (Part 3 Exercise)

| Service | URL |
|---------|-----|
| Basic agent (Part 3) | https://learning-production-42c8.up.railway.app |

> Lab 06 final submission uses **VPS** with full security, BaSau agent, and web UI.

---

## Platform

| Component | Technology |
|-----------|------------|
| **Compute** | VPS Linux (`202.92.7.140`, SSH port `24700`) |
| **Runtime** | Docker + docker-compose |
| **Stack** | FastAPI agent + Redis + Day06 web UI |
| **LLM** | Google Gemini (`gemini-2.0-flash`) |
| **CI** | GitHub Actions — lint (ruff) + pytest |
| **CD** | GitHub Actions — SSH deploy to VPS |

---

## Test Commands

### 1. Health check (no auth)

```bash
curl http://202.92.7.140:8000/health
```

**Expected:**

```json
{
  "status": "ok",
  "checks": { "llm": "gemini", "agent": "basau-food" },
  "environment": "staging"
}
```

### 2. Readiness probe

```bash
curl http://202.92.7.140:8000/ready
# → {"ready": true}
```

### 3. Customer UI (browser)

Open in browser:

```
http://202.92.7.140:8000/?order=ORD-001
```

**Expected:** BaSau order page with chat widget (Trợ lý BaSau).

### 4. Chat API status (UI backend)

```bash
curl http://202.92.7.140:8000/api/chat/status
# → {"aiEnabled": true, "provider": "gemini", "model": "gemini-2.0-flash"}
```

### 5. Agent API — requires API key

```bash
curl -X POST http://202.92.7.140:8000/ask \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_AGENT_API_KEY" \
  -d '{"question": "Đơn ORD-001 sao rồi?", "order_id": "ORD-001"}'
```

**Expected:** `200` with `answer`, `session_id`, `provider`.

### 6. Authentication required

```bash
curl -X POST http://202.92.7.140:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
# → 401 Unauthorized
```

### 7. Rate limiting

Send more than `RATE_LIMIT_PER_MINUTE` requests (default 20) within 60 seconds:

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://202.92.7.140:8000/ask \
    -H "X-API-Key: YOUR_AGENT_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"question\": \"test $i\"}"
done
# Eventually → 429
```

---

## Environment Variables (VPS `.env.local`)

Secrets are stored **only on the server** — never in GitHub.

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (for AI) | Google AI Studio API key |
| `AGENT_API_KEY` | Yes | API key for `POST /ask` (`X-API-Key` header) |
| `JWT_SECRET` | Yes | JWT signing secret |
| `ENVIRONMENT` | Yes | `staging` or `production` |
| `REDIS_URL` | Auto | `redis://redis:6379/0` (via docker-compose) |
| `RATE_LIMIT_PER_MINUTE` | Optional | Default `20` |
| `DAILY_BUDGET_USD` | Optional | Default `5.0` |

**Setup on VPS:**

```bash
cd /opt/basau-agent/06-lab-complete
cp .env.example .env.local
nano .env.local   # fill GEMINI_API_KEY, AGENT_API_KEY, JWT_SECRET
```

---

## GitHub Actions Secrets (CD only)

| Secret | Example |
|--------|---------|
| `VPS_HOST` | `202.92.7.140` |
| `VPS_PORT` | `24700` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Private SSH key (full PEM) |
| `VPS_REPO_DIR` | `/opt/basau-agent` (optional) |

---

## Manual Deploy (VPS)

```bash
ssh -p 24700 root@202.92.7.140
cd /opt/basau-agent/06-lab-complete

# If docker-compose v1 ContainerConfig error:
docker-compose down --remove-orphans
docker ps -aq --filter "name=06-lab-complete" | xargs -r docker rm -f

git pull origin main
docker-compose up -d --build --force-recreate
curl http://127.0.0.1:8000/health
```

Or use the deploy script:

```bash
bash /opt/basau-agent/06-lab-complete/scripts/deploy-remote.sh
```

---

## CI/CD Workflows

| Workflow | File | Trigger |
|----------|------|---------|
| CI — BaSau Agent | `.github/workflows/ci.yml` | Push/PR to `main` (paths: `06-lab-complete/**`) |
| CD — Deploy BaSau Agent | `.github/workflows/cd.yml` | After CI succeeds on `main` |

**CI steps:** ruff lint → pytest (13 tests) → `check_production_ready.py`

---

## Architecture

```
Browser ──► http://VPS:8000/
              ├── /              → Customer UI (Day06 web)
              ├── /api/chat/*    → Chat API (Python bridge)
              ├── /ask           → Agent API (X-API-Key)
              ├── /health        → Liveness
              └── /ready         → Readiness

Docker Compose:
  agent (FastAPI :8000) ──► redis:6379
```

---

## Screenshots

Add screenshots to `screenshots/` before final grading:

- [ ] `screenshots/ui-order-page.png` — Customer UI at `/?order=ORD-001`
- [ ] `screenshots/ui-chat.png` — Chat with Trợ lý BaSau
- [ ] `screenshots/health.png` — `/health` response
- [ ] `screenshots/github-actions-ci.png` — CI passing
- [ ] `screenshots/github-actions-cd.png` — CD deploy (optional)

---

## Railway (Part 3 reference)

```bash
curl https://learning-production-42c8.up.railway.app/health
curl https://learning-production-42c8.up.railway.app/
```

Config: `03-cloud-deployment/railway/railway.toml`
