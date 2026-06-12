#!/usr/bin/env bash
# Remote deploy script — used by GitHub Actions CD and manual server deploy.
set -eo pipefail

REPO_DIR="${VPS_REPO_DIR:-/opt/basau-agent}"
REPO_URL="${REPO_URL:-https://github.com/lokkdev/day12_cloud_infra_and_deployment.git}"
APP_DIR="$REPO_DIR/06-lab-complete"

echo "=== deploy-remote.sh ==="
echo "REPO_DIR=$REPO_DIR"
echo "APP_DIR=$APP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERROR: docker compose not found"
  exit 1
fi
echo "Using: $COMPOSE"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Cloning $REPO_URL ..."
  mkdir -p "$REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "ERROR: $APP_DIR/.env.local not found."
  echo "Run on server:"
  echo "  cp $APP_DIR/.env.example $APP_DIR/.env.local"
  echo "  nano $APP_DIR/.env.local"
  exit 1
fi

cd "$APP_DIR"
echo "Stopping old containers..."
# docker-compose v1.29 + Docker Engine mới → KeyError 'ContainerConfig' khi recreate.
# Phải xóa hết container cũ trước khi up (không dựa vào recreate in-place).
$COMPOSE down --remove-orphans 2>/dev/null || true
docker ps -aq --filter "name=06-lab-complete" | xargs -r docker rm -f 2>/dev/null || true
docker rm -f 06-lab-complete_agent_1 06-lab-complete_redis_1 2>/dev/null || true

echo "Building and starting..."
$COMPOSE up -d --build --remove-orphans --force-recreate
$COMPOSE ps

echo "Waiting for health check..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "Deploy OK (attempt $i)"
    curl -s http://127.0.0.1:8000/health
    exit 0
  fi
  echo "  attempt $i/30 — not ready yet"
  sleep 2
done

echo "Health check failed — container logs:"
$COMPOSE logs --tail=80 agent
exit 1
