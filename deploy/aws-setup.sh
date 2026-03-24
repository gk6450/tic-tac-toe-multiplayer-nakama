#!/bin/bash
# ============================================================
# AWS EC2 Initial Setup Script for Nakama + Tic-Tac-Toe
# ============================================================
# Run this ONCE on a fresh EC2 instance after SSH-ing in.
# Tested on Amazon Linux 2023 / Ubuntu 22.04+
#
# Usage:
#   chmod +x aws-setup.sh
#   ./aws-setup.sh https://github.com/gk6450/tic-tac-toe-multiplayer-nakama.git
# ============================================================

set -e

REPO_URL="${1:-}"
REPO_DIR="$HOME/tic-tac-toe-multiplayer-nakama"

if [ -z "$REPO_URL" ] && [ ! -d "$REPO_DIR" ]; then
  echo "Usage: ./aws-setup.sh <github-repo-url>"
  echo "Example: ./aws-setup.sh https://github.com/gk6450/tic-tac-toe-multiplayer-nakama.git"
  exit 1
fi

echo "=== 1. Installing Docker ==="
if command -v docker &> /dev/null; then
  echo "Docker already installed: $(docker --version)"
else
  if [ -f /etc/amazon-linux-release ]; then
    sudo yum update -y
    sudo yum install -y docker git
  elif [ -f /etc/lsb-release ]; then
    sudo apt-get update -y
    sudo apt-get install -y docker.io git
  fi
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker $USER
  echo "Docker installed. You may need to log out and back in for group changes."
fi

echo ""
echo "=== 2. Installing Docker Compose plugin ==="
if docker compose version &> /dev/null 2>&1; then
  echo "Docker Compose already installed: $(docker compose version)"
else
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
  sudo mkdir -p /usr/local/lib/docker/cli-plugins/
  sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  echo "Docker Compose installed: $(docker compose version)"
fi

echo ""
echo "=== 3. Installing Node.js 20 ==="
if command -v node &> /dev/null; then
  echo "Node.js already installed: $(node --version)"
else
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - 2>/dev/null || \
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo yum install -y nodejs 2>/dev/null || sudo apt-get install -y nodejs
  echo "Node.js installed: $(node --version)"
fi

echo ""
echo "=== 4. Cloning Repository ==="
if [ -d "$REPO_DIR" ]; then
  echo "Directory exists, pulling latest..."
  cd "$REPO_DIR"
  git pull origin main
else
  git clone "$REPO_URL" "$REPO_DIR"
  cd "$REPO_DIR"
fi

echo ""
echo "=== 5. Building Nakama TypeScript Module ==="
cd "$REPO_DIR/nakama"
npm install
npx tsc
echo "Build output: $REPO_DIR/nakama/build/index.js"

echo ""
echo "=== 6. Starting Services with Docker Compose ==="
cd "$REPO_DIR"
sudo docker compose -f docker-compose.yml up -d

echo ""
echo "=== 7. Waiting for services to start ==="
sleep 15
sudo docker compose ps

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'YOUR_EC2_IP')

echo ""
echo "============================================="
echo "  Initial Setup Complete!"
echo "============================================="
echo ""
echo "  Nakama API:     http://${PUBLIC_IP}:7350"
echo "  Nakama Console: http://${PUBLIC_IP}:7351"
echo "  Console Login:  admin / password"
echo "  Health Check:   curl http://${PUBLIC_IP}:7350/healthcheck"
echo ""
echo "  Security Group must allow inbound:"
echo "    - TCP 22   (SSH)"
echo "    - TCP 7350 (Nakama API - open to 0.0.0.0/0)"
echo "    - TCP 7351 (Nakama Console - restrict to your IP)"
echo ""
echo "  GitHub Actions will auto-deploy on push to nakama/"
echo "============================================="
