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

## Globe imagery

The itinerary globe uses locally bundled, 2:1 equirectangular NASA imagery, so it
does not require a map provider, API key, attribution overlay, or runtime image
request. Browsers reporting a WebGL `MAX_TEXTURE_SIZE` of at least 8192 use the
8K files; other browsers automatically retain the original 4096×2048 textures.

| Theme | 8K source | Processing |
|---|---|---|
| Light | [NASA Visible Earth: The Blue Marble—Land Surface, Ocean Color and Sea Ice](https://visibleearth.nasa.gov/images/57730/the-blue-marble-land-surface-ocean-color-and-sea-ice) | NASA's 8192×4096 PNG was encoded as a progressive JPEG at quality 82. |
| Dark | [NASA Earth Observatory: Earth at Night/Black Marble flat maps](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/) | NASA's 13500×6750 2016 color JPEG was resized with Lanczos resampling to 8192×4096 and encoded as a progressive JPEG at quality 82. |

The source images were processed with Sharp/mozjpeg. The 8K outputs are
`public/earth-blue-marble-8k.jpg` and `public/earth-night-8k.jpg`; the existing
`public/earth-blue-marble.jpg` and `public/earth-night.jpg` remain the 4K
compatibility fallbacks. Texture selection changes only the image and closest
useful zoom limit; geographic coordinates, pins, arcs, clicks, and camera fitting
continue to use the existing globe implementation.
