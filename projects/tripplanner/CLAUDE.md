# TripPlanner - Claude Code Instructions

## Startup Checks

Before running the frontend or backend, verify the following:

### 1. HTTPS Dev Certificate

Check if `frontend/aspnet-dev-cert.pem` exists. If it does not, create it:

```bash
dotnet dev-certs https --export-path frontend/aspnet-dev-cert.pem --format PEM --no-password
```

### 2. Frontend Packages

Check if `frontend/node_modules` exists. If not, restore packages:

```bash
cd frontend && npm install
```

### 3. Backend Packages

Check if the backend has been restored. If `backend/TripPlanner/Web/bin` does not exist, restore NuGet packages:

```bash
cd backend/TripPlanner && dotnet restore
```
