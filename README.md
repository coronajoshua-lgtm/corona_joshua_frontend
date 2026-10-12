# corona_joshua_frontend / Peachstock

This directory is the complete React/Vite frontend. It communicates with the
backend through JSON HTTP requests and can be built and hosted independently.
It has no PHP or database dependencies.

Run from this directory:

```sh
cp .env.example .env
npm ci
npm run dev
```

In PowerShell, use `Copy-Item .env.example .env` instead of `cp` if preferred.
Open `http://localhost:5173`. Vite uses this fixed origin so it matches the
backend's default `CORS_ALLOWED_ORIGIN`. If port 5173 is busy, stop the process
using it before starting Vite.

`VITE_API_URL` in `.env` must point to the API base URL, including `/api`:

```dotenv
VITE_API_URL=http://127.0.0.1:3000/api
```

For WAMP without the PHP development server, use
`http://localhost/corona_joshua_backend/public/api`. Set the backend's
`CORS_ALLOWED_ORIGIN` to `http://localhost:5173` in either case.

For production, set `VITE_API_URL` to your deployed API's HTTPS URL and run:

```sh
npm run build
```

Deploy `dist/` to a static host and rewrite application paths to `index.html`.
Vite reads environment values at startup/build time; restart or rebuild after
changing the API URL. Never put database credentials or token signing secrets
in frontend environment variables.

Backend repository: https://github.com/coronajoshua-lgtm/corona_joshua_backend

Frontend maintained by [Joshua](https://github.com/coronajoshua-lgtm).
The companion backend uses LavaLust by
[Ron Marasigan](https://github.com/ronmarasigan).
