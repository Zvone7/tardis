# TripPlanner Frontend

Next.js 15 app with React 19, Tailwind CSS, and shadcn/ui.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)
- The backend API running (defaults to `https://localhost:7048`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   A `.env` file is already present with local defaults:

   | Variable | Default | Description |
   |---|---|---|
   | `NEXT_PUBLIC_BACKEND_ROOT_URL` | `https://localhost:7048` | Backend API base URL |
   | `NEXT_PUBLIC_FRONTEND_ROOT_URL` | `https://localhost:3000` | Frontend base URL |
   | `NEXT_PUBLIC_ENV_CODE` | `local` | Environment identifier |
   | `NEXT_PUBLIC_BUILD_NUMBER` | `123` | Build number |

   To override, create a `.env.local` file (git-ignored) with your values.

3. **SSL certificate (local development)**

   When the backend URL contains `localhost`, the app tries to load a self-signed certificate from `./aspnet-dev-cert.pem`. Export the ASP.NET dev cert:

   ```bash
   dotnet dev-certs https --export-path ./aspnet-dev-cert.pem --format PEM --no-password
   ```

## Running

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

The app will be available at [http://localhost:3000](http://localhost:3000).

API requests to `/api/*` are proxied to the backend URL configured above.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Create production build |
| `npm start` | Serve production build |
| `npm run lint` | Run ESLint |
