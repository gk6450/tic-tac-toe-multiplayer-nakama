# Local Setup Guide (Windows, No Docker)

## Prerequisites
- Node.js v18+ (already installed)
- PostgreSQL (Windows installer)
- Nakama v3.38.0 Windows binary

## Step 1: Install PostgreSQL

1. Download the PostgreSQL Windows installer from:
   https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
2. Run the installer:
   - Select "PostgreSQL Server" and "Command Line Tools"
   - Set superuser password to: `localdb`
   - Use default port: `5432`
   - Complete installation
3. PostgreSQL will run as a Windows service automatically.

## Step 2: Install Nakama

1. Download Nakama v3.38.0 for Windows from:
   https://github.com/heroiclabs/nakama/releases/download/v3.38.0/nakama-3.38.0-windows-amd64.tar.gz
2. Extract the archive into: `tools/nakama/`
3. You should have `tools/nakama/nakama.exe` after extraction.

## Step 3: Build Server Module

```powershell
cd nakama
npm install
npx tsc
cd ..
```

This creates `nakama/build/index.js` which is the compiled server runtime.

## Step 4: Run Database Migrations

```powershell
./tools/nakama/nakama.exe migrate up --database.address "postgres:localdb@127.0.0.1:5432/nakama"
```

## Step 5: Start Nakama Server

```powershell
./tools/nakama/nakama.exe --database.address "postgres:localdb@127.0.0.1:5432/nakama" --logger.level DEBUG --session.token_expiry_sec 7200 --runtime.path "./nakama/build"
```

## Step 6: Verify

- Nakama Console: http://127.0.0.1:7351 (login: admin / password)
- Nakama API: http://127.0.0.1:7350
- Healthcheck: http://127.0.0.1:7350/healthcheck

## Alternative: Docker Setup

If you have Docker installed, simply run:

```powershell
# With CockroachDB (recommended)
docker compose up

# Or with PostgreSQL
docker compose -f docker-compose.postgres.yml up
```
