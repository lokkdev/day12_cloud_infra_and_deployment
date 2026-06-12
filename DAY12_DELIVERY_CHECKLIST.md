# Delivery Checklist — Day 12 Lab Submission

> **Student Name:** _________________________  
> **Student ID:** _________________________  
> **Date:** _________________________  
> **GitHub Repo:** https://github.com/lokkdev/day12_cloud_infra_and_deployment

---

## Submission Requirements

### 1. Mission Answers (40 points)

- [x] `MISSION_ANSWERS.md` — Parts 1–6 completed
- [x] Exercise answers with test outputs
- [x] Comparison tables and architecture notes

### 2. Full Source Code — Lab 06 (60 points)

- [x] `06-lab-complete/` — production agent
- [x] Multi-stage Dockerfile (< 500 MB)
- [x] docker-compose.yml (agent + Redis)
- [x] API key authentication
- [x] Rate limiting + cost guard
- [x] Health + readiness checks
- [x] Graceful shutdown
- [x] BaSau Gemini agent + tools (Day06)
- [x] Customer web UI (Day06)
- [x] CI/CD (GitHub Actions)
- [x] pytest + ruff passing
- [x] No `.env` / `.env.local` committed
- [x] No hardcoded secrets

### 3. Service Domain Link

- [x] `DEPLOYMENT.md` with public URL and test commands
- [x] **Primary URL:** http://202.92.7.140:8000/?order=ORD-001
- [x] **Health:** http://202.92.7.140:8000/health
- [ ] Screenshots in `screenshots/` folder (add before grading)

---

## Pre-Submission Checklist

- [x] Repository is public (or instructor has access)
- [x] `MISSION_ANSWERS.md` completed
- [x] `DEPLOYMENT.md` has working public URL
- [x] `06-lab-complete/README.md` has setup instructions
- [x] `.env.example` present, `.env.local` gitignored
- [x] CI passing on GitHub Actions
- [ ] Screenshots included (`screenshots/ui-order-page.png`, etc.)
- [x] Clear commit history

---

## Self-Test (run before submitting)

```bash
# 1. Health
curl http://202.92.7.140:8000/health

# 2. UI loads (browser)
open http://202.92.7.140:8000/?order=ORD-001

# 3. Auth required
curl -X POST http://202.92.7.140:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
# → 401

# 4. With API key
curl -X POST http://202.92.7.140:8000/ask \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "Đơn ORD-001 sao rồi?", "order_id": "ORD-001"}'
# → 200

# 5. Chat API (UI)
curl http://202.92.7.140:8000/api/chat/status
# → {"aiEnabled": true, ...}

# 6. Local tests
cd 06-lab-complete && pytest tests -v
```

---

## Submit

**GitHub repository URL:**

```
https://github.com/lokkdev/day12_cloud_infra_and_deployment
```

**Deadline:** 17/4/2026

---

## Documentation Map

| File | Purpose |
|------|---------|
| [README.md](README.md) | Project overview |
| [MISSION_ANSWERS.md](MISSION_ANSWERS.md) | Lab exercise answers |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Live URLs + test commands |
| [06-lab-complete/README.md](06-lab-complete/README.md) | Final project setup |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common errors |
| [QUICK_START.md](QUICK_START.md) | 5-minute intro |
