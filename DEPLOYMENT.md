# Deployment Guide

Complete step-by-step instructions for deploying the Tic-Tac-Toe multiplayer game.

---

## Table of Contents

1. [Backend -- AWS EC2](#1-backend----aws-ec2) (includes Elastic IP setup)
2. [CI/CD -- GitHub Actions](#2-cicd----github-actions)
3. [Web App -- Vercel](#3-web-app----vercel)
4. [Mobile App -- Android APK](#4-mobile-app----android-apk)
5. [Post-Deployment Checklist](#5-post-deployment-checklist)
6. [Server Management](#6-server-management) (includes stop/start behavior table)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Backend -- AWS EC2

### 1.1 Launch an EC2 Instance

1. Go to **AWS Console > EC2 > Launch Instance**
2. Configure:

   | Setting | Value |
   |---------|-------|
   | Name | `nakama-tic-tac-toe` |
   | AMI | Amazon Linux 2023 |
   | Instance type | `t2.micro` (free tier) |
   | Key pair | Create new → download `.pem` file → keep it safe |
   | Network | Default VPC, auto-assign public IP = enabled |

3. Click **Launch Instance**

### 1.2 Configure Security Group

Go to **EC2 > Instances > your instance > Security > Security Group > Edit inbound rules**.

Add these rules:

| Type | Port Range | Source | Purpose |
|------|-----------|--------|---------|
| SSH | 22 | My IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web app (nginx serves the game) |
| Custom TCP | 7350 | 0.0.0.0/0 | Nakama API (mobile app connects here) |
| Custom TCP | 7351 | My IP | Nakama Console (admin only, restrict!) |

### 1.3 Initial Server Setup

**Option A: Using the setup script (recommended)**

```bash
# From your LOCAL machine, transfer the script
scp -i your-key.pem deploy/aws-setup.sh ec2-user@YOUR_EC2_IP:~/

# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Run the setup script
chmod +x ~/aws-setup.sh
./aws-setup.sh https://github.com/gk6450/tic-tac-toe-multiplayer-nakama.git

# IMPORTANT: Log out and back in for docker group to take effect
exit
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Verify docker works without sudo
cd ~/tic-tac-toe-multiplayer-nakama
docker compose ps
```

**Option B: Manual setup**

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Install Docker
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Install Docker Compose plugin
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
sudo mkdir -p /usr/local/lib/docker/cli-plugins/
sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Log out and back in for docker group
exit
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Clone repo
git clone https://github.com/gk6450/tic-tac-toe-multiplayer-nakama.git
cd tic-tac-toe-multiplayer-nakama

# Build Nakama module
cd nakama
npm install
npx tsc
cd ..

# Build web app container and start all services
docker compose build
docker compose up -d

# Verify
docker compose ps
```

### 1.4 Allocate an Elastic IP (Recommended)

By default, the public IP changes every time you stop and start the instance. An Elastic IP gives you a **permanent static IP** that survives stop/start cycles.

1. Go to **EC2 > Elastic IPs > Allocate Elastic IP address > Allocate**
2. Select the new Elastic IP > **Actions > Associate Elastic IP address**
3. Choose your instance > **Associate**

The Elastic IP is **free** as long as it's associated with a running instance. AWS charges ~$3.65/month if the IP is allocated but the instance is stopped, so either release it or keep the instance running.

After associating, use this Elastic IP everywhere:
- `web-app/.env.production` (`VITE_NAKAMA_HOST`)
- `mobile-app/.env` / `.env.production` (`EXPO_PUBLIC_NAKAMA_HOST`)
- GitHub Secrets (`EC2_HOST`)
- Vercel environment variables

### 1.5 Verify Deployment

```bash
# From your local machine -- check Nakama health
curl http://YOUR_EC2_IP:7350/healthcheck

# Check web app is served
curl -I http://YOUR_EC2_IP
```

- **Web App (game)**: `http://YOUR_EC2_IP` (port 80, served by nginx)
- **Nakama API**: `http://YOUR_EC2_IP:7350` (mobile app connects here)
- **Nakama Console**: `http://YOUR_EC2_IP:7351` (login: `admin` / `password`)

---

## 2. CI/CD -- GitHub Actions

The workflow at `.github/workflows/deploy-nakama.yml` auto-deploys whenever `nakama/` or docker-compose files change on the `main` branch.

### 2.1 Add GitHub Secrets

Go to **GitHub repo > Settings > Secrets and variables > Actions > New repository secret**.

| Secret Name | Value | How to Get It |
|-------------|-------|---------------|
| `EC2_HOST` | `3.xx.xx.xx` | EC2 instance public IPv4 (from AWS Console) |
| `EC2_USER` | `ec2-user` | Default for Amazon Linux 2023 (`ubuntu` for Ubuntu) |
| `EC2_SSH_KEY` | (entire `.pem` file content) | Open your `.pem` file in a text editor, copy everything including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` |

### 2.2 Test the Workflow

After adding secrets, trigger manually:
1. Go to **GitHub > Actions > Deploy Nakama to EC2**
2. Click **Run workflow** > **Run workflow**
3. Watch the logs to confirm success

### 2.3 Automatic Deploys

After setup, just push changes:

```bash
# Make changes to nakama/src/*.ts
git add nakama/
git commit -m "Update match handler"
git push origin main
# GitHub Actions auto-deploys to EC2
```

### What Happens During Deploy

1. GitHub Actions SSHs into your EC2
2. Pulls latest code from `main`
3. Runs `npm install` + `npx tsc` in `nakama/`
4. Recreates only the Nakama container (`docker compose up -d --force-recreate nakama`)
5. Database container and volumes are **untouched** -- all player data persists

---

## 3. Web App

The web app is served directly from the EC2 instance via nginx (port 80). It's built as a Docker container alongside Nakama, so deploying the backend also deploys the web app.

**How it works**: nginx serves the static React build on port 80 and proxies `/v2/` and `/ws` requests to Nakama on port 7350 internally. This avoids mixed-content issues (HTTPS page calling HTTP API) since everything is on the same host.

The web app is accessible at: `http://YOUR_EC2_IP`

No separate Vercel/Netlify deployment needed.

### Rebuilding the Web App

```bash
# On EC2 (or via CI/CD automatically)
cd ~/tic-tac-toe-multiplayer-nakama
git pull origin main
docker compose build web
docker compose up -d --force-recreate web
```

---

## 4. Mobile App -- Android APK

### Before Building

Update `mobile-app/.env` with your production Nakama server:

```env
EXPO_PUBLIC_NAKAMA_SERVER_KEY=defaultkey
EXPO_PUBLIC_NAKAMA_HOST=YOUR_EC2_IP
EXPO_PUBLIC_NAKAMA_PORT=7350
EXPO_PUBLIC_NAKAMA_USE_SSL=false
EXPO_PUBLIC_NAKAMA_HTTP_KEY=defaulthttpkey
```

### 4.1 Option A: EAS Cloud Build (Recommended)

No local Android SDK needed. Builds run on Expo's servers.

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo (create free account at expo.dev if needed)
eas login

# From mobile-app directory
cd mobile-app

# Build APK (preview profile)
eas build --platform android --profile preview
```

When the build finishes (5-10 minutes), you'll get a download link for the `.apk` file.

### 4.2 Option B: Local Build

Requires **Android SDK** and **JDK 17+** installed.

```bash
cd mobile-app

# Generate native Android project
npx expo prebuild --platform android

# Build release APK
cd android
./gradlew assembleRelease

# APK output location:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 5. Post-Deployment Checklist

- [ ] EC2 instance running, security group configured (ports 22, 80, 7350, 7351)
- [ ] `curl http://YOUR_EC2_IP:7350/healthcheck` returns OK
- [ ] Web app accessible at `http://YOUR_EC2_IP`
- [ ] Nakama Console accessible at `http://YOUR_EC2_IP:7351`
- [ ] GitHub Actions secrets (`EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`) added
- [ ] GitHub Actions workflow tested (manual run succeeded)
- [ ] Mobile app `.env` updated with EC2 IP
- [ ] APK built and installed on test device
- [ ] Cross-platform test: web player vs mobile player in same match

---

## 6. Server Management

### SSH into EC2

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
cd ~/tic-tac-toe-multiplayer-nakama
```

### View Logs

```bash
# Nakama logs (real-time)
docker compose logs -f nakama

# CockroachDB logs
docker compose logs -f cockroachdb

# Last 100 lines
docker compose logs --tail 100 nakama
```

### Restart Services

```bash
# Restart Nakama only (keeps DB running, data safe)
docker compose restart nakama

# Restart everything
docker compose restart

# Full stop and start
docker compose down && docker compose up -d
```

### Manual Rebuild (without CI/CD)

```bash
cd ~/tic-tac-toe-multiplayer-nakama
git pull origin main
cd nakama && npm install && npx tsc && cd ..
docker compose build web
docker compose up -d --force-recreate nakama web
```

### Database Data

Data is stored in Docker volumes and **persists across**:
- Container restarts (`docker compose restart`)
- Container recreation (`docker compose up --force-recreate`)
- Server reboots (containers auto-start due to `restart: unless-stopped`)
- Code redeployments via CI/CD

Data is **only deleted** when you explicitly remove volumes:

```bash
# THIS DELETES ALL DATA -- use with caution
docker compose down -v
```

### Instance Stop/Start Behavior

| What happens | Data | Containers | Public IP |
|-------------|------|------------|-----------|
| `docker compose restart` | Persists | Restart | Same |
| EC2 reboot | Persists | Auto-start (`restart: unless-stopped`) | Same |
| EC2 stop → start | Persists | Auto-start | **Changes** (use Elastic IP to avoid) |
| EC2 terminate | **DELETED** | Deleted | Released |
| `docker compose down` | Persists | Removed | Same |
| `docker compose down -v` | **DELETED** | Removed | Same |

The EC2 instance must be running for GitHub Actions to deploy. If the instance is stopped, the workflow will fail with a connection timeout -- just start the instance and re-trigger.

### Check Disk Usage

```bash
docker system df
df -h
```

### Update Nakama Version

Edit `docker-compose.yml`, change the image tag, then:

```bash
docker compose pull nakama
docker compose up -d --force-recreate nakama
```

---

## 7. Troubleshooting

### EC2: "Permission denied" running docker

```bash
# Docker group not applied yet
sudo usermod -aG docker $USER
exit
# SSH back in
```

### EC2: Containers not starting after reboot

```bash
sudo systemctl start docker
docker compose up -d
```

### GitHub Actions: SSH connection refused

- If you don't have an Elastic IP, the public IP changes on every stop/start -- update `EC2_HOST` secret
- Use an Elastic IP (see section 1.4) to avoid this problem permanently
- Check security group allows port 22 from GitHub's IP ranges (or use `0.0.0.0/0` for port 22 temporarily)
- Verify `EC2_SSH_KEY` includes the full `.pem` content with headers

### Web app can't connect to Nakama

- Verify EC2 security group allows port 7350 from `0.0.0.0/0`
- Check `VITE_NAKAMA_HOST` matches your EC2 public IP
- Test: `curl http://YOUR_EC2_IP:7350/healthcheck`

### Mobile app can't connect

- For emulator: use `10.0.2.2` as host (maps to host machine)
- For physical device on same WiFi: use your computer's LAN IP
- For production APK: use the EC2 public IP

### Nakama module not loading

```bash
# Check if build exists
ls -la ~/tic-tac-toe-multiplayer-nakama/nakama/build/index.js

# Rebuild
cd ~/tic-tac-toe-multiplayer-nakama/nakama
npm install
npx tsc

# Check Nakama logs for module load errors
docker compose logs --tail 50 nakama
```
