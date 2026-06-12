#!/usr/bin/env bash
# First-time VPS setup — run ON THE SERVER as root.
# Usage: bash server-bootstrap.sh [repo_dir]
set -euo pipefail

REPO_DIR="${1:-/opt/basau-agent}"
REPO_URL="${REPO_URL:-https://github.com/lokkdev/day12_cloud_infra_and_deployment.git}"
APP_DIR="$REPO_DIR/06-lab-complete"

echo "==> Install Docker (if missing)"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y docker.io docker-compose-plugin curl git
  systemctl enable docker
  systemctl start docker
fi

echo "==> Clone repository"
if [ ! -d "$REPO_DIR/.git" ]; then
  mkdir -p "$REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
else
  cd "$REPO_DIR" && git pull origin main
fi

echo "==> Create .env.local if missing"
if [ ! -f "$APP_DIR/.env.local" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env.local"
  echo ""
  echo "Created $APP_DIR/.env.local — EDIT before deploy:"
  echo "  - GEMINI_API_KEY"
  echo "  - AGENT_API_KEY"
  echo "  - JWT_SECRET"
  echo "  - ENVIRONMENT=production"
  exit 0
fi

echo "==> Build and start"
cd "$APP_DIR"
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:8000/health || true
