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

### 4. Azure Key Vault Client Secret

The backend requires an Azure AD client secret to access Key Vault. Store it using .NET User Secrets (never commit it to launchSettings):

```bash
cd backend/TripPlanner/Web
dotnet user-secrets set "CLIENT_SECRET" "<your-secret>"
```

### 5. Local Config Overrides (appsettings.local.json)

Check if `backend/TripPlanner/Web/appsettings.local.json` exists. If not, copy from example:

```bash
cp backend/TripPlanner/Web/appsettings.local.example.json backend/TripPlanner/Web/appsettings.local.json
```

Then fill in secrets (e.g. Google OAuth ClientSecret). This file is gitignored and loaded last, so it overrides Key Vault values.

## Documentation

Layout and architecture documentation lives in `frontend/docs/`. Keep it updated when adding, renaming, or restructuring components. Key doc:

- [`frontend/docs/trip-layout.md`](frontend/docs/trip-layout.md) — 3-panel trip view components, responsive behaviour, grid logic
