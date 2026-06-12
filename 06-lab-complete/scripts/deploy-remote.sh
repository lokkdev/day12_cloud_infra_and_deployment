#!/usr/bin/env bash
# Remote deploy script — used by GitHub Actions CD job.
set -euo pipefail

REPO_DIR="${VPS_REPO_DIR:?VPS_REPO_DIR is required}"
REPO_URL="${REPO_URL:-https://github.com/lokkdev/day12_cloud_infra_and_deployment.git}"
APP_DIR="$REPO_DIR/06-lab-complete"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERROR: docker compose not found"
  exit 1
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  mkdir -p "$REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "ERROR: $APP_DIR/.env.local not found."
  echo "Create it on the server before first deploy (see .env.example)."
  exit 1
fi

cd "$APP_DIR"
$COMPOSE down --remove-orphans || true
docker rm -f 06-lab-complete_agent_1 06-lab-complete_redis_1 2>/dev/null || true
$COMPOSE up -d --build --remove-orphans
$COMPOSE ps

echo "Waiting for health check..."
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "Health OK"
    curl -s http://127.0.0.1:8000/health
    exit 0
  fi
  sleep 2
done

echo "Health check failed — container logs:"
$COMPOSE logs --tail=80 agent
exit 1
