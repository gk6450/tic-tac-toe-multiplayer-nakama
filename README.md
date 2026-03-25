# Multiplayer Tic-Tac-Toe

A production-ready, real-time multiplayer Tic-Tac-Toe game with server-authoritative architecture powered by [Nakama](https://heroiclabs.com/nakama/).

Includes a **React web app** (with PhaserJS game board), an **Expo React Native Android app**, and a **Nakama TypeScript backend** with matchmaking, leaderboards, and timed game modes.

**Repository**: [github.com/gk6450/tic-tac-toe-multiplayer-nakama](https://github.com/gk6450/tic-tac-toe-multiplayer-nakama)

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Tech Stack](#tech-stack)
5. [Local Development Setup](#local-development-setup)
6. [Environment Variables](#environment-variables)
7. [Deployment](#deployment)
8. [API & Server Configuration](#api--server-configuration)
9. [Testing Multiplayer](#testing-multiplayer)
10. [Design Decisions](#design-decisions)

---

## Features

### Core
- **Server-authoritative game logic** -- all moves validated server-side; board state managed exclusively on the Nakama server; prevents client-side cheating
- **Real-time multiplayer** -- WebSocket-based state synchronization with sub-second latency
- **Matchmaking system** -- create rooms, find open matches, or auto-match via Nakama's matchmaker
- **Graceful disconnect handling** -- opponent leaving mid-game awards a win to the remaining player

### Optional (Implemented)
- **Concurrent game sessions** -- multiple isolated matches run simultaneously with independent state
- **Leaderboard system** -- global ranking by score (3 pts per win, 1 pt per draw), with detailed per-player stats (wins, losses, draws, current/best streak)
- **Timer-based game mode** -- configurable turn timer (10s/20s/30s/45s/60s); automatic forfeit on timeout; timer countdown displayed in real-time
- **Cross-platform play** -- web and mobile players compete against each other seamlessly

### Authentication
- **Quick Play** -- instant device-based authentication with a username
- **Account Login** -- email + password registration/login, with username-based login support

---

## Architecture

```
                    ┌───────────────────────┐
                    │   React Native App    │
                    │   (Expo + Native UI)  │
                    └──────────┬────────────┘
                               │ HTTP/WS :7350
┌──────────────────────────────┼───────────────────────────┐
│              EC2 Instance    │    (Docker Compose)        │
│                              │                            │
│  ┌───────────────────┐       │       ┌────────────────┐  │
│  │   nginx (:80)     │       └──────►│  Nakama (:7350)│  │
│  │                   │  proxy /v2/   │                │  │
│  │  Serves React     ├─────────────►│  TS Match      │  │
│  │  Web App          │  proxy /ws    │  Handler       │  │
│  │  (Vite + Phaser)  ├─────────────►│                │  │
│  └───────────────────┘               └───────┬────────┘  │
│         ▲                                    │           │
│         │ HTTP :80                    ┌──────▼────────┐  │
│         │                            │  CockroachDB  │  │
│         │                            │  (or Postgres) │  │
│         │                            └───────────────┘  │
└─────────┼───────────────────────────────────────────────┘
          │
    ┌─────┴─────┐
    │  Browser  │
    │  (Web)    │
    └───────────┘
```

**Data flow for a move:**
1. Client sends `MOVE` message (op code 2) via WebSocket with `{ position: 0-8 }`
2. Nakama `matchLoop` validates: correct turn, valid position, cell empty
3. Server updates board, checks for win/draw, switches turn
4. Server broadcasts `STATE_UPDATE` (op code 3) or `GAME_OVER` (op code 4) to all clients
5. Clients render the authoritative state

---

## Project Structure

```
tic-tac-toe-multiplayer-nakama/
├── nakama/                     # Nakama server-side runtime module
│   ├── src/
│   │   ├── main.ts             # InitModule entry point, registers RPCs/hooks
│   │   ├── match_handler.ts    # Match lifecycle (init, join, loop, leave)
│   │   ├── match_rpc.ts        # RPCs: create_match, find_match, login_with_username
│   │   ├── leaderboard.ts      # Leaderboard + player stats CRUD
│   │   └── types.ts            # Shared types, OpCodes, constants
│   ├── build/                  # Compiled JS output (git-ignored)
│   ├── package.json
│   └── tsconfig.json           # Targets ES5, single outFile
│
├── web-app/                    # React + Vite web frontend
│   ├── src/
│   │   ├── App.tsx             # Screen router (Login → Lobby → Game / Leaderboard)
│   │   ├── main.tsx            # ReactDOM entry
│   │   ├── index.css           # Global styles (dark theme, responsive)
│   │   ├── components/
│   │   │   ├── Login.tsx       # Quick Play + Account Login tabs
│   │   │   ├── Lobby.tsx       # Mode select, create/find/auto-match, stats
│   │   │   ├── GameView.tsx    # In-game UI, player panels, timer, rematch
│   │   │   └── Leaderboard.tsx # Global rankings table
│   │   ├── context/
│   │   │   └── NakamaContext.tsx # React context for session, socket, RPCs
│   │   ├── game/
│   │   │   ├── TicTacToeScene.ts # PhaserJS scene: board, X/O marks, animations
│   │   │   └── PhaserGame.tsx    # React wrapper for Phaser canvas
│   │   ├── nakama/
│   │   │   └── client.ts        # Nakama client init (reads env vars)
│   │   └── types/
│   │       └── game.ts          # Client-side OpCodes and interfaces
│   ├── .env                    # Local env vars (VITE_NAKAMA_*)
│   ├── .env.production         # Production env vars
│   └── package.json
│
├── mobile-app/                 # Expo React Native Android app
│   ├── App.tsx                 # Entry: SafeAreaProvider, portrait lock
│   ├── index.ts                # registerRootComponent
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.tsx       # Quick Play + Account Login (native UI)
│   │   │   ├── Lobby.tsx       # Mode select, matchmaking, stats
│   │   │   ├── GameView.tsx    # In-game UI with player panels, timer
│   │   │   ├── GameBoard.tsx   # Native 3x3 grid (replaces PhaserJS)
│   │   │   └── Leaderboard.tsx # Rankings with FlatList
│   │   ├── context/
│   │   │   └── NakamaContext.tsx # AsyncStorage-based session persistence
│   │   ├── nakama/
│   │   │   └── client.ts        # Nakama client (reads EXPO_PUBLIC_* env vars)
│   │   ├── styles/
│   │   │   └── theme.ts         # Color palette and spacing
│   │   └── types/
│   │       └── game.ts          # Shared OpCodes (mirrors server)
│   ├── .env                    # Local env vars (EXPO_PUBLIC_NAKAMA_*)
│   ├── .env.production         # Production env vars
│   ├── app.json                # Expo config (portrait, dark mode)
│   ├── eas.json                # EAS Build profiles
│   └── package.json
│
├── nginx/
│   ├── nginx.conf              # Reverse proxy config (serves web + proxies Nakama)
│   └── Dockerfile              # Multi-stage: builds web-app + nginx image
│
├── .github/
│   └── workflows/
│       └── deploy-nakama.yml   # CI/CD: auto-deploy on push
│
├── deploy/
│   └── aws-setup.sh            # EC2 one-time setup script
│
├── docker-compose.yml          # CockroachDB + Nakama + nginx (production)
├── docker-compose.postgres.yml # PostgreSQL + Nakama (alternative)
├── DEPLOYMENT.md               # Detailed deployment guide
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | [Nakama 3.37](https://heroiclabs.com/nakama/) with TypeScript runtime |
| Database | CockroachDB (default) or PostgreSQL 16 (alternative) |
| Web Frontend | React 19, Vite 8, PhaserJS 3 |
| Mobile Frontend | React Native 0.83, Expo SDK 55 |
| CI/CD | GitHub Actions (auto-deploy on push) |
| Deployment | AWS EC2 (Docker Compose), Vercel (web), EAS Build (APK) |

---

## Local Development Setup

### Prerequisites

- **Node.js** >= 18
- **Docker** and **Docker Desktop**

### 1. Clone the Repository

```bash
git clone https://github.com/gk6450/tic-tac-toe-multiplayer-nakama.git
cd tic-tac-toe-multiplayer-nakama
```

### 2. Build the Nakama Module

```bash
cd nakama
npm install
npx tsc
cd ..
```

### 3. Start Nakama with Docker Compose

```bash
# CockroachDB (default)
docker compose up -d

# OR with PostgreSQL
docker compose -f docker-compose.postgres.yml up -d
```

Verify at http://127.0.0.1:7351 (Console login: `admin` / `password`).

### 4. Start the Web App

```bash
cd web-app
npm install
npm run dev
```

Opens at http://localhost:5173.

### 5. Start the Mobile App

```bash
cd mobile-app
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` to open in an Android emulator.

### Useful Docker Commands

```bash
# View Nakama logs
docker compose logs -f nakama

# Restart Nakama after code changes
cd nakama && npx tsc && cd ..
docker compose restart nakama

# Stop everything (data persists)
docker compose down

# Stop and wipe all data
docker compose down -v
```

---

## Environment Variables

### Web App (`web-app/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_NAKAMA_SERVER_KEY` | `defaultkey` | Nakama server key |
| `VITE_NAKAMA_HOST` | `127.0.0.1` | Nakama server hostname/IP |
| `VITE_NAKAMA_PORT` | `7350` | Nakama API port |
| `VITE_NAKAMA_USE_SSL` | `false` | Use HTTPS/WSS |
| `VITE_NAKAMA_HTTP_KEY` | `defaulthttpkey` | HTTP key for unauthenticated RPCs |

### Mobile App (`mobile-app/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_NAKAMA_SERVER_KEY` | `defaultkey` | Nakama server key |
| `EXPO_PUBLIC_NAKAMA_HOST` | `10.0.2.2` | Nakama host (10.0.2.2 = emulator localhost) |
| `EXPO_PUBLIC_NAKAMA_PORT` | `7350` | Nakama API port |
| `EXPO_PUBLIC_NAKAMA_USE_SSL` | `false` | Use HTTPS/WSS |
| `EXPO_PUBLIC_NAKAMA_HTTP_KEY` | `defaulthttpkey` | HTTP key for unauthenticated RPCs |

For production, update the `HOST` values with your EC2 public IP.

---

## Deployment

The entire stack (Nakama + CockroachDB + web app) runs on a single server via Docker Compose. An nginx container serves the web app on port 80 and reverse-proxies API/WebSocket traffic to Nakama internally, avoiding mixed-content issues.

### Backend + Web App (Single Server)

Deploy to any cloud VM that supports Docker (AWS EC2, DigitalOcean, GCP, Azure, etc.):

1. Spin up a Linux VM, install Docker + Node.js
2. Clone the repo, build the Nakama TypeScript module (`cd nakama && npm install && npx tsc`)
3. Build and start: `docker compose build && docker compose up -d`

This starts three containers:
- **CockroachDB** -- database (port 26257, internal)
- **Nakama** -- game server (port 7350 for API, port 7351 for admin console)
- **nginx** -- serves the React web app (port 80) and proxies `/v2/` and `/ws` to Nakama

Key ports to open in the firewall/security group:
- **80** -- Web app (game URL, open to all)
- **7350** -- Nakama API (mobile app connects here directly)
- **7351** -- Nakama Admin Console (restrict to your IP)

An example setup script for AWS EC2 is provided in `deploy/aws-setup.sh`.

### Mobile App (Android APK)

Build the APK using Expo's EAS Build service (`eas build --platform android --profile preview`) or locally with `npx expo prebuild` + Gradle. Update `EXPO_PUBLIC_NAKAMA_HOST` in `mobile-app/.env` to your server's public IP before building. The mobile app connects directly to Nakama on port 7350.

### CI/CD

A GitHub Actions workflow (`.github/workflows/deploy-nakama.yml`) auto-deploys on push to `main` when `nakama/`, `web-app/`, `nginx/`, or docker-compose files change. It SSHs into the server, pulls code, rebuilds the Nakama module and web container, and restarts. This requires three GitHub Secrets: `EC2_HOST`, `EC2_USER`, and `EC2_SSH_KEY`. You can adapt this to any CI/CD platform or deploy manually.

### Data Persistence

Database data is stored in Docker volumes and persists across container restarts, redeployments, and server reboots. Data is only wiped if you explicitly run `docker compose down -v`.

### Detailed Deployment Guide

For step-by-step instructions (AWS EC2 setup, Elastic IP, GitHub Actions secrets, APK build, server management, troubleshooting), see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## API & Server Configuration

### Nakama Server Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 7349 | gRPC | Server-to-server / admin gRPC |
| 7350 | HTTP/WS | Client API (REST + WebSocket) |
| 7351 | HTTP | Admin Console (web UI) |

### Registered RPCs

| RPC ID | Auth | Description |
|--------|------|-------------|
| `create_match` | Yes | Creates a new match. Payload: `{ mode: "classic"\|"timed", turnDuration?: number }` |
| `find_match` | Yes | Lists open matches. Payload: `{ mode: "classic"\|"timed" }` |
| `login_with_username` | No (HTTP key) | Login with username + password for email-registered accounts |
| `get_leaderboard` | Yes | Returns top players. Payload: `{ limit?: number }` |
| `get_player_stats` | Yes | Returns player statistics. Payload: `{ userId?: string }` |

### WebSocket Op Codes

| Code | Name | Direction | Description |
|------|------|-----------|-------------|
| 1 | `START` | Server → Client | Game started, player assignments |
| 2 | `MOVE` | Client → Server | Player move: `{ position: 0-8 }` |
| 3 | `STATE_UPDATE` | Server → Client | Board update after validated move |
| 4 | `GAME_OVER` | Server → Client | Win/draw/timeout result |
| 5 | `TIMER_UPDATE` | Server → Client | Remaining seconds for timed mode |
| 6 | `OPPONENT_LEFT` | Server → Client | Opponent disconnected |

### Leaderboard Scoring

| Event | Points |
|-------|--------|
| Win | +3 |
| Draw | +1 |
| Loss | +0 |

Leaderboard ID: `tic_tac_toe_wins`, sorted descending, operator: incremental.

### Player Stats Storage

Stored in Nakama's storage engine:
- **Collection**: `player_stats`
- **Key**: `stats`
- **Fields**: `wins`, `losses`, `draws`, `totalGames`, `currentStreak`, `bestStreak`

---

## Testing Multiplayer

### Local Testing (Two Browser Tabs)

1. Start services: `docker compose up -d`
2. Start the web app: `cd web-app && npm run dev`
3. Open **two browser tabs** at http://localhost:5173
4. Tab 1: Log in as `player1` (Quick Play)
5. Tab 2: Log in as `player2` (Quick Play)
6. Tab 1: Select mode → **Create Match**
7. Tab 2: Click **Auto-Match** (same mode) or **Find Match** to join
8. Take turns clicking cells -- moves appear in real-time on both tabs

### Cross-Platform Testing (Web + Mobile)

1. Start Nakama and the web app as above
2. Start Expo dev server: `cd mobile-app && npx expo start`
3. Open app on Android device/emulator
4. For physical devices, set `EXPO_PUBLIC_NAKAMA_HOST` to your computer's LAN IP
5. Log in on both platforms and play a match

### Features to Test

- **Classic mode**: No timer, unlimited turn time
- **Timed mode**: Select a timer duration, observe countdown
- **Timeout forfeit**: Let the timer expire -- opponent wins automatically
- **Opponent disconnect**: Close one tab mid-game -- other player wins
- **Leaderboard**: After games, check the leaderboard screen for rankings
- **Auto-matchmaking**: Use Auto-Match on two players -- they pair automatically
- **Session persistence**: Close and reopen a tab -- Quick Play remembers your username
- **Cross-device Quick Play**: Log in as the same Quick Play username on both web and mobile -- same account

---

## Design Decisions

### Server-Authoritative Architecture
All game state lives on the Nakama server. Clients send move intents; the server validates (correct turn, valid cell, not occupied) and broadcasts the authoritative state. This prevents any client-side cheating.

### Optimistic Rendering
To minimize perceived latency, the web client renders a move immediately on click (semi-transparent) before the server confirms it. Once the server broadcasts `STATE_UPDATE`, the optimistic mark is replaced with the authoritative state. This gives instant feedback without sacrificing correctness.

### PhaserJS for Web, Native UI for Mobile
The web app uses PhaserJS for smooth canvas-based board rendering with animations. The mobile app uses plain React Native `View` and `TouchableOpacity` components instead of Phaser, avoiding the overhead of a WebView-embedded game engine on mobile.

### ES5 Target for Nakama Runtime
Nakama's Go-embedded JS runtime (Goja) does not support ES2015+ features. All server-side TypeScript compiles to ES5 with a single `outFile` bundle. This requires `var` instead of `let/const` and manual iteration instead of `Object.entries`.

### Match Labels with Numeric Open Flag
Nakama's label query engine (Bleve) doesn't reliably index boolean values. The `open` field uses `1`/`0` instead of `true`/`false` to ensure `+label.open:1` queries work correctly.

### Deterministic Device IDs for Cross-Device Quick Play
Quick Play uses a deterministic device ID derived from the username (`ttt_quick_<username>`). This means the same username produces the same account on any device -- web, mobile, or multiple browsers -- without needing a password. If users need security, they use Account Login (email + password).

### Data Persistence
Docker volumes (`data:` for CockroachDB, `pg_data:` for PostgreSQL) persist all database data across container restarts and redeployments. Data is only wiped with `docker compose down -v`.

### AsyncStorage for Mobile
The mobile app uses `@react-native-async-storage/async-storage` (instead of `localStorage`) for local session caching, following React Native best practices.
