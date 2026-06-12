# Day 12 Lab - Mission Answers

## Part 1: Localhost vs Production

### Exercise 1.1: Anti-patterns found

Đọc file `01-localhost-vs-production/develop/app.py` và liệt kê các vấn đề:

1. **Hardcode secrets trong source code**
   - `OPENAI_API_KEY` và `DATABASE_URL` (kèm username/password) được ghi thẳng trong file.
   - Nếu push lên GitHub hoặc share repo → credentials bị lộ vĩnh viễn trong git history.
   - Production nên dùng environment variables hoặc secret manager.

2. **Không có config management (12-Factor)**
   - `DEBUG = True`, `MAX_TOKENS = 500` cố định trong code.
   - Không thể đổi config theo môi trường (dev/staging/prod) mà không sửa code và redeploy.

3. **Dùng `print()` thay vì logging chuẩn — và log ra secret**
   - `print(f"[DEBUG] Using key: {OPENAI_API_KEY}")` in API key ra console.
   - Log không có cấu trúc (JSON), khó tích hợp với Datadog/CloudWatch.
   - Không có log level (INFO/WARN/ERROR).

4. **Không có health check endpoint**
   - Không có `/health` hoặc `/ready`.
   - Cloud platform (Railway, K8s) không biết app còn sống hay đã crash → không tự restart hoặc routing traffic đúng.

5. **Port cố định, không đọc từ `PORT` env var**
   - `port=8000` hardcode trong `uvicorn.run()`.
   - Railway/Render inject `PORT` động — app sẽ không bind đúng port trên cloud.

6. **Bind `host="localhost"` thay vì `0.0.0.0`**
   - Chỉ accept connection từ cùng máy.
   - Trong Docker container hoặc cloud VM, traffic từ bên ngoài không vào được.

7. **`reload=True` — chế độ development**
   - Auto-reload khi file thay đổi, chỉ dùng khi dev local.
   - Production: tốn tài nguyên, không ổn định, có thể restart giữa request.

8. **Không có API authentication**
   - Endpoint `/ask` mở hoàn toàn, ai cũng gọi được.
   - Dễ bị abuse → tốn tiền API LLM thật nếu thay mock bằng OpenAI.

9. **API design không chuẩn REST**
   - `POST /ask` nhận `question` qua **query parameter** (`?question=...`) thay vì JSON body.
   - Gây nhầm lẫn (doc lab dùng JSON body nhưng code không đọc body) → lỗi 422 khi client gửi đúng chuẩn REST.

10. **Không có graceful shutdown**
    - Không xử lý signal SIGTERM/SIGINT.
    - Khi platform restart container, request đang xử lý có thể bị cắt đột ngột.

### Exercise 1.3: Comparison table (Basic vs Advanced)

So sánh `01-localhost-vs-production/develop/app.py` và `production/app.py`:

| Feature | Basic (develop) | Advanced (production) | Tại sao quan trọng? |
|---------|-----------------|---------------------|---------------------|
| **Config** | Hardcode trong code (`OPENAI_API_KEY`, `DATABASE_URL`, `DEBUG=True`) | `config.py` đọc từ env vars (`.env` / `PORT`, `HOST`, `LLM_MODEL`...) | Đổi môi trường dev/staging/prod không cần sửa code; secrets không lộ trên Git |
| **Health check** | Không có | `GET /health` (liveness) + `GET /ready` (readiness) | Cloud platform biết khi nào restart container hoặc ngừng route traffic |
| **Logging** | `print()` debug, log cả API key | Structured JSON logging (`logger.info`), không log secrets | Dễ search/monitor trên Datadog/CloudWatch; tránh lộ credential |
| **Shutdown** | Tắt đột ngột (`Ctrl+C`) | `lifespan` hook + xử lý `SIGTERM` | Request đang xử lý hoàn thành trước khi container tắt |
| **Host binding** | `host="localhost"` | `HOST=0.0.0.0` (default) | Container/cloud nhận traffic từ bên ngoài |
| **Port** | Cố định `8000` | Đọc `PORT` env var | Railway/Render inject port động — app bind đúng port |
| **Reload** | `reload=True` luôn bật | `reload=settings.debug` (chỉ khi `DEBUG=true`) | Tránh auto-reload không ổn định trên production |
| **API input** | `question` qua query param | `question` qua JSON body (`POST /ask`) | Chuẩn REST; client gửi JSON nhất quán |
| **CORS** | Không có | `CORSMiddleware` + `ALLOWED_ORIGINS` | Kiểm soát frontend nào được gọi API |
| **Metrics** | Không có | `GET /metrics` (uptime, version) | Có thể scrape bởi Prometheus/Grafana |
| **Lifecycle** | Không có | FastAPI `lifespan` (startup/shutdown hooks) | Khởi tạo/đóng DB, model, connections đúng cách |

**Kết quả test production** (chạy local `PORT=8001`):

```bash
# Health — 200 OK
curl http://localhost:8001/health
# → {"status":"ok","uptime_seconds":6.8,"version":"1.0.0","environment":"development",...}

# Readiness — 200 OK
curl http://localhost:8001/ready
# → {"ready":true}

# Ask với JSON body — 200 OK
curl -X POST http://localhost:8001/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
# → {"question":"Hello","answer":"...","model":"gpt-4o-mini"}
```

**Quan sát:** Production version chạy ổn với JSON body (đúng như doc lab). Basic version cần `?question=...` — đây là khác biệt thực tế gây lỗi 422 khi làm theo `QUICK_START.md` Step 2.

---

## Part 2: Docker Containerization

### Exercise 2.1: Dockerfile questions

Đọc `02-docker/develop/Dockerfile`:

1. **Base image là gì?**
   - `python:3.11` — full Python official image trên Docker Hub.
   - Bao gồm cả OS (Debian), Python runtime, pip và nhiều system libraries → image lớn (~1 GB+).

2. **Working directory là gì?**
   - `/app` — thư mục làm việc mặc định trong container (đặt bằng `WORKDIR /app`).
   - Mọi lệnh `COPY`, `RUN`, `CMD` sau đó chạy relative tới `/app`.

3. **Tại sao COPY requirements.txt trước?**
   - Tận dụng **Docker layer cache**.
   - Dependencies (`pip install`) ít thay đổi hơn source code (`app.py`).
   - Khi chỉ sửa code, Docker **không cần cài lại** pip packages → build nhanh hơn nhiều.

4. **CMD vs ENTRYPOINT khác nhau thế nào?**
   - **ENTRYPOINT** — lệnh chính container **luôn chạy**; khó ghi đè hoàn toàn (chỉ append args).
   - **CMD** — lệnh mặc định khi start container; **dễ bị ghi đè** bằng args sau `docker run`.
   - Ví dụ Dockerfile này: `CMD ["python", "app.py"]` → có thể override: `docker run my-agent:develop uvicorn main:app`.
   - Best practice: `ENTRYPOINT` cho binary cố định, `CMD` cho default arguments.

### Exercise 2.2: Build và run

**Lệnh build** (từ project root):

```bash
docker build -f 02-docker/develop/Dockerfile -t my-agent:develop .
docker run -p 8000:8000 my-agent:develop
```

**Image size:**

```bash
docker images my-agent:develop
# REPOSITORY:TAG     SIZE
# my-agent:develop   1.67GB
```

**Quan sát:** Image ~**1.67 GB** vì dùng `python:3.11` full image (không phải slim), chứa OS + build tools không cần thiết lúc runtime.

**Test đúng** (develop app nhận query param, không phải JSON body):

```bash
curl -X POST "http://localhost:8000/ask?question=What%20is%20Docker?"
# → {"answer":"Container là cách đóng gói app..."}
curl http://localhost:8000/health
# → {"status":"ok","container":true,...}
```

### Exercise 2.3: Multi-stage build

Đọc `02-docker/production/Dockerfile`:

**Stage 1 (`builder`) làm gì?**
- Base: `python:3.11-slim`
- Cài build tools (`gcc`, `libpq-dev`) để compile native dependencies.
- `pip install --user -r requirements.txt` → packages vào `/root/.local`.
- Stage này **không deploy** — chỉ dùng để build.

**Stage 2 (`runtime`) làm gì?**
- Base: `python:3.11-slim` (image sạch, không có gcc).
- Tạo non-root user `appuser` (security).
- `COPY --from=builder` — chỉ copy installed packages, không copy build tools.
- Copy `main.py`, `utils/mock_llm.py`, set `USER appuser`.
- `HEALTHCHECK` + `CMD uvicorn` với 2 workers.

**Tại sao image nhỏ hơn?**
- Không chứa gcc, apt cache, build dependencies.
- Dùng `python:3.11-slim` thay vì full `python:3.11`.
- Multi-stage: chỉ artifact cần thiết (site-packages + code) vào image cuối.

**So sánh size:**

| Image | Size |
|-------|------|
| `my-agent:develop` (single-stage) | **1.67 GB** |
| `my-agent:advanced` (multi-stage) | **262 MB** |
| Chênh lệch | **~84% nhỏ hơn** (tiết kiệm ~1.4 GB) |

```bash
docker build -f 02-docker/production/Dockerfile -t my-agent:advanced .
docker images my-agent
```

### Exercise 2.4: Docker Compose stack

Đọc `02-docker/production/docker-compose.yml`:

**Services được start:**

| Service | Image / Build | Vai trò |
|---------|---------------|---------|
| `agent` | Build từ production Dockerfile | FastAPI AI agent |
| `redis` | `redis:7-alpine` | Cache, session, rate limiting |
| `qdrant` | `qdrant/qdrant:v1.9.0` | Vector DB cho RAG |
| `nginx` | `nginx:alpine` | Reverse proxy, load balancer |

**Architecture diagram:**

```
                    Internet
                        │
                        ▼
              ┌─────────────────┐
              │  nginx :80/443  │  ← public entry point
              └────────┬────────┘
                       │ proxy_pass
                       ▼
              ┌─────────────────┐
              │  agent :8000    │  ← FastAPI (internal network)
              └────────┬────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
   ┌──────────────┐        ┌──────────────┐
   │ redis :6379  │        │ qdrant :6333 │
   │ cache/rate   │        │ vector DB    │
   └──────────────┘        └──────────────┘

Network: internal (bridge) — agent/redis/qdrant không expose ra ngoài
```

**Cách communicate:**
- Client → **nginx** (port 80) → **agent** (internal)
- **agent** → `REDIS_URL=redis://redis:6379/0` (Docker DNS resolve tên service)
- **agent** → `QDRANT_URL=http://qdrant:6333`
- `depends_on` + `healthcheck`: agent chỉ start sau khi redis và qdrant healthy

**Chạy stack:**

```bash
cd 02-docker/production
docker compose up
```

**Test:**

```bash
curl http://localhost/health
curl -X POST http://localhost/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain microservices"}'
```

---

## Part 3: Cloud Deployment

### Exercise 3.1: Railway deployment

**Platform:** Railway  
**Public URL:** `https://learning-production-42c8.up.railway.app`  
**Project:** `learning` (Railway dashboard)

**Các bước đã thực hiện:**

```bash
cd 03-cloud-deployment/railway
brew install railway          # thay npm i -g (tránh lỗi EACCES)
railway login
railway init
railway up
railway domain
```

**Cấu hình (`railway.toml`):**
- Builder: `NIXPACKS` (auto-detect Python)
- Start: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Health check: `/health` (timeout 30s)
- Restart policy: `ON_FAILURE`, max 3 retries

**Điểm quan trọng trong `app.py`:**
- Đọc `PORT` từ env (`os.getenv("PORT", 8000)`) — Railway inject tự động
- Bind `0.0.0.0` — nhận traffic từ bên ngoài container
- `GET /health` — Railway dùng để biết service còn sống

**Kết quả test public URL:**

```bash
# Health — 200 OK
curl https://learning-production-42c8.up.railway.app/health
# → {"status":"ok","uptime_seconds":3540.4,"platform":"Railway",...}

# Root — 200 OK
curl https://learning-production-42c8.up.railway.app/
# → {"message":"AI Agent running on Railway!","docs":"/docs","health":"/health"}

# Ask với JSON body — 200 OK
curl -X POST https://learning-production-42c8.up.railway.app/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Am I on the cloud?"}'
# → {"question":"Am I on the cloud?","answer":"...","platform":"Railway"}

# Ask với question rỗng — 422
curl -X POST https://learning-production-42c8.up.railway.app/ask \
  -H "Content-Type: application/json" \
  -d '{"question": ""}'
# → {"detail":"question required"}
```

**Lỗi đã gặp và cách fix:**
| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `?question=Hello` → 500 | Railway app đọc JSON body, không query param | Dùng `-d '{"question":"..."}'` |
| URL có space `app/ /ask` | Typo trong curl | Bỏ khoảng trắng |
| `No public domain yet` | Chưa tạo domain | Chạy `railway domain` |

**Xem logs:**

```bash
railway logs
# hoặc Railway Dashboard → Service → Deployments → Logs
```

### Exercise 3.2: So sánh `render.yaml` vs `railway.toml`

| Tiêu chí | Railway (`railway.toml`) | Render (`render.yaml`) |
|----------|--------------------------|------------------------|
| **Format** | TOML, config-as-code | YAML Blueprint spec |
| **Deploy trigger** | CLI `railway up` hoặc Git connect | Push GitHub → auto deploy (`autoDeploy: true`) |
| **Build** | Nixpacks auto-detect (hoặc Dockerfile) | `buildCommand: pip install -r requirements.txt` |
| **Start command** | `startCommand` trong `[deploy]` | `startCommand` trong service block |
| **Health check** | `healthcheckPath = "/health"` | `healthCheckPath: /health` |
| **Env vars** | `railway variables set KEY=val` | `envVars` trong YAML + Dashboard |
| **Secrets** | Railway Dashboard / CLI | `sync: false` hoặc `generateValue: true` |
| **Multi-service** | Mỗi service riêng trong project | Blueprint định nghĩa nhiều services (web + redis) |
| **Free tier** | $5 credit/tháng | 750 giờ/tháng |
| **Region** | Auto | Chọn rõ (`singapore`) |

**Khác biệt chính:**
- **Render** mạnh về IaC Blueprint — một file YAML định nghĩa cả web service + Redis add-on.
- **Railway** đơn giản hơn cho prototype — CLI deploy nhanh, ít config hơn.
- Cả hai đều inject `$PORT` và cần app bind `0.0.0.0`.

*Ghi chú: Render chưa deploy thực tế — so sánh dựa trên đọc config files.*

### Exercise 3.3: GCP Cloud Run (Optional — đọc code)

**`cloudbuild.yaml` — CI/CD pipeline 4 bước:**

```
git push main
    │
    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. pytest   │ →  │ 2. docker   │ →  │ 3. push     │ →  │ 4. deploy   │
│    tests/   │    │    build    │    │  gcr.io/... │    │  Cloud Run  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

- **Step 1 (test):** Chạy `pytest` — fail thì không build.
- **Step 2 (build):** Docker image tag theo `$COMMIT_SHA` + `latest`, dùng layer cache.
- **Step 3 (push):** Push image lên Google Container Registry.
- **Step 4 (deploy):** `gcloud run deploy` region `asia-southeast1`.

**`service.yaml` — Cloud Run service definition:**
- `minScale: 1` — giữ 1 instance, tránh cold start
- `maxScale: 10` — scale tối đa 10 instances
- `containerConcurrency: 80` — mỗi instance xử lý 80 requests đồng thời
- Resources: CPU 0.5–1, Memory 256–512Mi
- Liveness/readiness probes trỏ `/health`, `/ready`

**So với Railway:**
- Cloud Run phù hợp **production** — auto-scaling, pay-per-request, CI/CD đầy đủ.
- Railway phù hợp **prototype** — setup nhanh, ít config hơn.

### Checkpoint 3

- [x] Deploy thành công lên Railway
- [x] Public URL hoạt động (`https://learning-production-42c8.up.railway.app`)
- [x] Hiểu cách Railway inject `PORT` env var
- [x] Biết xem logs qua `railway logs` / Dashboard
- [ ] Deploy Render (optional — chưa làm)
- [ ] Deploy Cloud Run (optional — chưa làm)

---

## Part 4: API Security

### Exercise 4.1: API Key authentication (`04-api-gateway/develop`)

**API key được check ở đâu?**
- Hàm `verify_api_key()` — FastAPI **dependency** inject vào endpoint `/ask` qua `Depends(verify_api_key)`.
- Đọc header `X-API-Key` bằng `APIKeyHeader(name="X-API-Key")`.
- So sánh với `API_KEY = os.getenv("AGENT_API_KEY", "demo-key-change-in-production")`.

**Điều gì xảy ra nếu sai key?**

| Trường hợp | HTTP | Response |
|------------|------|----------|
| Không gửi header | **401** | `Missing API key. Include header: X-API-Key: <your-key>` |
| Key sai | **403** | `Invalid API key.` |
| Key đúng | **200** | Trả answer |

**Làm sao rotate key?**
1. Tạo key mới: `export AGENT_API_KEY="new-secret-key"`
2. Restart app (hoặc redeploy trên cloud).
3. Cập nhật key ở tất cả clients.
4. Trên production: dùng secret manager (Railway Variables, AWS Secrets Manager) — không hardcode.
5. Hỗ trợ 2 keys song song trong thời gian chuyển đổi (advanced pattern).

**Kết quả test** (`04-api-gateway/develop`, port 8000):

```bash
export AGENT_API_KEY="my-secret-key"
python app.py

# Không key → 401
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
# → {"detail":"Missing API key..."}

# Key sai → 403
curl -X POST http://localhost:8000/ask \
  -H "X-API-Key: wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
# → {"detail":"Invalid API key."}

# Key đúng → 200
curl -X POST http://localhost:8000/ask \
  -H "X-API-Key: my-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
# → {"question":"Hello","answer":"..."}
```

### Exercise 4.2: JWT authentication (`04-api-gateway/production`)

**JWT flow (`auth.py`):**

```
1. POST /auth/token  {username, password}
        │
        ▼
   authenticate_user() — check DEMO_USERS
        │
        ▼
   create_token() — JWT signed với HS256, expiry 60 phút
        │
        ▼
   Trả access_token

2. POST /ask  Header: Authorization: Bearer <token>
        │
        ▼
   verify_token() — decode JWT, check signature + expiry
        │
        ▼
   Extract username + role → xử lý request
```

**Demo credentials:**
- `student` / `demo123` → role `user`
- `teacher` / `teach456` → role `admin`

**Kết quả test** (port 8002):

```bash
# Lấy token
curl -X POST http://localhost:8002/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "student", "password": "demo123"}'
# → {"access_token":"eyJ...","token_type":"bearer","expires_in_minutes":60}

# Không token → 401
curl -X POST http://localhost:8002/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain JWT"}'
# → {"detail":"Authentication required..."}

# Có token → 200
curl -X POST http://localhost:8002/ask \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain JWT"}'
# → {"question":"Explain JWT","answer":"...","usage":{...}}
```

### Exercise 4.3: Rate limiting (`rate_limiter.py`)

**Algorithm:** **Sliding Window Counter**
- Mỗi user có một `deque` lưu timestamps của các request.
- Trước mỗi request: loại bỏ timestamps cũ hơn `window_seconds` (60s).
- Nếu số request trong window ≥ `max_requests` → **429 Too Many Requests**.

**Limit:**

| Role | Limiter | Limit |
|------|---------|-------|
| `user` (student) | `rate_limiter_user` | **10 requests / 60 giây** |
| `admin` (teacher) | `rate_limiter_admin` | **100 requests / 60 giây** |

**Bypass limit cho admin:**
- Trong `app.py`: `limiter = rate_limiter_admin if role == "admin" else rate_limiter_user`
- Admin (`teacher`) tự động dùng limiter 100 req/min thay vì 10.

**Kết quả test** (student token, 20 requests):

```
req 1–9:  HTTP 200
req 10:   HTTP 429
```

Response khi hit limit:

```json
{
  "detail": {
    "error": "Rate limit exceeded",
    "limit": 10,
    "window_seconds": 60,
    "retry_after_seconds": 59
  }
}
```

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`

Admin (`teacher`) gọi 12 requests liên tiếp → tất cả **200** (dưới ngưỡng 100).

### Exercise 4.4: Cost guard (`cost_guard.py`)

**Logic đã implement trong `CostGuard` class:**

```python
# Trước khi gọi LLM:
cost_guard.check_budget(username)
# → Raise 402 nếu user vượt daily budget ($1/user/ngày)
# → Raise 503 nếu global budget vượt ($10/ngày tổng)

# Sau khi gọi LLM:
cost_guard.record_usage(username, input_tokens, output_tokens)
# → Cộng dồn token cost theo giá GPT-4o-mini
```

**Chi tiết:**
- **Per-user budget:** $1.00/ngày (reset theo ngày UTC)
- **Global budget:** $10.00/ngày tổng tất cả users
- **Warning:** log khi user dùng ≥ 80% budget
- **Pricing:** $0.00015/1K input tokens, $0.0006/1K output tokens
- Production nên dùng **Redis** thay in-memory (lab solution bên dưới)

**Lab solution (Redis, $10/tháng/user):**

```python
def check_budget(user_id: str, estimated_cost: float) -> bool:
    month_key = datetime.now().strftime("%Y-%m")
    key = f"budget:{user_id}:{month_key}"
    current = float(r.get(key) or 0)
    if current + estimated_cost > 10:
        return False
    r.incrbyfloat(key, estimated_cost)
    r.expire(key, 32 * 24 * 3600)
    return True
```

**Kết quả test usage** (`GET /me/usage`):

```json
{
  "user_id": "student",
  "date": "2026-06-12",
  "requests": 10,
  "input_tokens": 40,
  "output_tokens": 324,
  "cost_usd": 0.0002,
  "budget_usd": 1.0,
  "budget_remaining_usd": 0.9998,
  "budget_used_pct": 0.0
}
```

### Checkpoint 4

- [x] API key authentication — develop app, test 401/403/200
- [x] Hiểu JWT flow — login → token → Bearer header
- [x] Rate limiting — sliding window, 10 req/min user, 429 khi vượt
- [x] Cost guard — `check_budget()` + `record_usage()`, per-user + global limits

---

## Part 5: Scaling & Reliability

### Exercise 5.1: Health checks (`05-scaling-reliability/develop`)

**Đã implement trong `app.py`:**

| Endpoint | Loại | Mục đích |
|----------|------|----------|
| `GET /health` | **Liveness probe** | Container còn sống? Trả uptime, version, memory check |
| `GET /ready` | **Readiness probe** | Sẵn sàng nhận traffic? Trả 503 nếu `_is_ready=False` |

**Khác biệt:**
- **Liveness** (`/health`): Platform restart container nếu process chết hoặc deadlock.
- **Readiness** (`/ready`): Load balancer ngừng route traffic khi đang startup/shutdown.

**Kết quả test** (port 8003):

```bash
curl http://localhost:8003/health
# → {"status":"ok","uptime_seconds":8.6,"version":"1.0.0","checks":{"memory":{...}}}

curl http://localhost:8003/ready
# → {"ready":true,"in_flight_requests":1}
```

### Exercise 5.2: Graceful shutdown

**Implementation trong `develop/app.py`:**

1. **FastAPI `lifespan`** — shutdown hook đặt `_is_ready=False`, chờ `_in_flight_requests == 0` (tối đa 30s).
2. **Middleware `track_requests`** — đếm request đang xử lý.
3. **`signal.SIGTERM` / `SIGINT` handler** — log khi platform gửi signal dừng container.
4. **`uvicorn.run(..., timeout_graceful_shutdown=30)`** — uvicorn chờ request hoàn thành.

**Flow khi `kill -TERM`:**

```
SIGTERM → uvicorn bắt signal
        → ngừng accept request mới
        → lifespan shutdown: chờ in-flight requests
        → log "Shutdown complete"
```

**Quan sát:** Request `POST /ask?question=Long task` (mock delay ~3s) hoàn thành **200 OK** trước khi server tắt — chứng tỏ graceful shutdown chờ request in-flight.

### Exercise 5.3: Stateless design (`production/app.py`)

**Anti-pattern (state trong memory):**

```python
conversation_history = {}  # Mỗi instance có dict riêng
# User gửi req 1 → Instance A lưu history
# User gửi req 2 → Instance B KHÔNG có history → BUG
```

**Correct (state trong Redis):**

```python
# session:{session_id} → JSON history trong Redis
save_session(session_id, data, ttl_seconds=3600)
load_session(session_id)
append_to_history(session_id, role, content)
```

**Tại sao stateless quan trọng khi scale?**
- Scale ra N instances → load balancer phân tán request ngẫu nhiên.
- Memory local không shared → session mất khi request đến instance khác.
- Redis (external store) → mọi instance đọc/ghi cùng session.

**Production app features:**
- `INSTANCE_ID` unique mỗi container — thấy rõ instance nào xử lý request.
- Fallback in-memory nếu Redis không có (dev only, không scalable).

### Exercise 5.4: Load balancing

**Stack:** `docker compose up --scale agent=3` (port **8080** qua Nginx)

```
Client → nginx:80 → upstream agent_cluster (round-robin)
                         ├── agent-1
                         ├── agent-2
                         └── agent-3
                              └── redis:6379 (shared sessions)
```

**Containers running:**

| Container | Role |
|-----------|------|
| `production-nginx-1` | Reverse proxy, port 8080→80 |
| `production-agent-1/2/3` | 3 agent instances (healthy) |
| `production-redis-1` | Session storage |

**Nginx config (`nginx.conf`):**
- `upstream agent_cluster { server agent:8000; }` — Docker DNS round-robin tới tất cả agent replicas.
- `proxy_next_upstream error timeout http_503` — failover nếu 1 instance die.
- Header `X-Served-By: $upstream_addr` — thấy instance nào xử lý.

**Kết quả test** (10 requests, cùng session):

```
req 1: served_by=instance-a0f30b
req 2: served_by=instance-dec344
req 3: served_by=instance-210bc7
...
req 10: served_by=instance-a0f30b
```

→ Traffic phân tán qua **3 instances** khác nhau.

### Exercise 5.5: Test stateless (`test_stateless.py`)

```bash
cd 05-scaling-reliability/production
docker compose up --scale agent=3 -d
python test_stateless.py
```

**Kết quả:**

```
Session ID: 400f2bf8-488a-4a0d-b632-e5ebf68f8185

Request 1: [instance-210bc7]  Q: What is Docker?
Request 2: [instance-dec344]  Q: Why do we need containers?
Request 3: [instance-210bc7]  Q: What is Kubernetes?
Request 4: [instance-dec344]  Q: How does load balancing work?
Request 5: [instance-a0f30b]  Q: What is Redis used for?

Instances used: {instance-dec344, instance-a0f30b, instance-210bc7}
✅ All requests served despite different instances!

Conversation History: 10 messages (5 user + 5 assistant)
✅ Session history preserved across all instances via Redis!
```

**Kết luận:** Dù mỗi request có thể đến instance khác, conversation history vẫn liên tục vì state lưu trong **Redis**, không phải memory local.

### Checkpoint 5

- [x] Health (`/health`) và readiness (`/ready`) checks
- [x] Graceful shutdown — lifespan + SIGTERM + in-flight tracking
- [x] Stateless design — Redis session storage
- [x] Load balancing — Nginx + 3 agent instances
- [x] Test stateless — `test_stateless.py` pass với 3 instances

---

## Part 6: Final Production Agent (`06-lab-complete`)

### Exercise 6.1: BaSau Agent (Day06 → Production)

**Nguồn:** Day06 AI Product Hackathon — port sang Python production stack.

| Thành phần | Mô tả |
|------------|-------|
| `app/basau/agent.py` | Gemini client singleton + tool-calling loop |
| `app/basau/tools.py` | 8 tools: lookupOrder, cancelOrder, analyzeOrderRisk, … |
| `app/basau/domain.py` | Order status, cancel journey, customer view types |
| `ai-model/` | SYSTEM_PROMPT, rules, tool docs |
| `data/data.json` | Demo orders ORD-001 … ORD-005 |

**Tại sao singleton Gemini client?**  
Docker + uvicorn workers > 1 gây lỗi `client has been closed`. Fix: `--workers 1` + reuse một `genai.Client`.

### Exercise 6.2: Customer Web UI

UI Day06 được copy vào `web/` và serve qua FastAPI:

| URL | Nội dung |
|-----|----------|
| `GET /` | `web/src/customer/index.html` — đơn hàng + chat |
| `GET /policies` | Chính sách BaSau |
| `/public`, `/src`, `/data` | Static assets |

`app/chat_api.py` implement contract `/api/chat/*` để UI gọi Python backend thay Node.js.

### Exercise 6.3: Security & Reliability (tích hợp Parts 1–5)

| Feature | Implementation |
|---------|----------------|
| Config | `app/config.py` — env vars, không hardcode secrets |
| Auth | `X-API-Key` trên `POST /ask` và `GET /metrics` |
| Rate limit | In-memory sliding window per API key |
| Cost guard | Daily budget USD, reset theo ngày |
| Health | `/health` (liveness), `/ready` (readiness) |
| Logging | JSON structured logs |
| Shutdown | SIGTERM handler + uvicorn graceful timeout |
| Redis | docker-compose — session/cache ready |

### Exercise 6.4: CI/CD

**CI** (`.github/workflows/ci.yml`):
- ruff check + format
- pytest 13 tests
- `check_production_ready.py`

**CD** (`.github/workflows/cd.yml`):
- SSH vào VPS → `git pull` → `deploy-remote.sh` → health check

**GitHub Secrets:** `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_REPO_DIR`

### Exercise 6.5: VPS Deployment

| Item | Value |
|------|-------|
| **Public UI** | http://202.92.7.140:8000/?order=ORD-001 |
| **Health** | http://202.92.7.140:8000/health |
| **Platform** | VPS + Docker Compose |
| **Repo path** | `/opt/basau-agent/06-lab-complete` |
| **Secrets** | `.env.local` on server only |

**Test production:**

```bash
# UI — mở browser
open http://202.92.7.140:8000/?order=ORD-001

# Health
curl http://202.92.7.140:8000/health

# Agent API (cần API key từ .env.local trên VPS)
curl -X POST http://202.92.7.140:8000/ask \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "Đơn ORD-001 sao rồi?", "order_id": "ORD-001"}'
```

**Lỗi deploy đã gặp:**

| Lỗi | Fix |
|-----|-----|
| `KeyError: ContainerConfig` (docker-compose v1) | `docker-compose down` + xóa container cũ + `--force-recreate` |
| SSH handshake reset (GitHub CD) | Mở firewall port 24700, kiểm tra `VPS_PORT` secret |
| `web/data` missing on CI | Mount `/data` từ `data/` thay vì `web/data` |

### Checkpoint 6

- [x] Multi-stage Dockerfile + docker-compose
- [x] API key auth + rate limit + cost guard
- [x] Health + readiness + graceful shutdown
- [x] BaSau Gemini agent với tool-calling
- [x] Day06 customer UI trên production
- [x] CI (ruff + pytest) trên GitHub Actions
- [x] CD deploy script + VPS running
- [x] `DEPLOYMENT.md` với public URL và test commands
