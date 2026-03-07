# ApartmentPicker Frontend

Next.js 15 application with React 19, Tailwind CSS, and Radix UI components.

## Prerequisites

- Node.js 20+
- npm

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_ROOT_URL` | Backend API base URL | `https://localhost:5001` |

The frontend proxies all `/api/*` requests to the backend via Next.js rewrites.

## HTTPS / Dev Certificate Setup

The backend runs on HTTPS with ASP.NET's self-signed dev certificate. For the frontend to proxy requests without TLS errors, you can either export the certificate or rely on the automatic fallback.

### Option A: Export the ASP.NET dev certificate (recommended)

```bash
dotnet dev-certs https --export-path ./aspnet-dev-cert.pem --format PEM --no-password
```

This places `aspnet-dev-cert.pem` in the frontend root. The Next.js config will pick it up via `NODE_EXTRA_CA_CERTS`.

### Option B: Automatic fallback (no action needed)

If `aspnet-dev-cert.pem` is not present and the backend URL is `localhost`, the config automatically sets `NODE_TLS_REJECT_UNAUTHORIZED=0` so Node accepts the self-signed certificate. This is fine for local development but should not be used in production.

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode (port 3001)
npm run dev
```

The app will be available at [http://localhost:3001](http://localhost:3001).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3001 |
| `npm run build` | Production build |
| `npm start` | Start production server on port 3001 |
| `npm run lint` | Run ESLint |
