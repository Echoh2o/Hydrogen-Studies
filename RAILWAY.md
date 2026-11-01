# Railway service settings

Railway config-as-code files (`railway.toml`) are deprecated (stop working
2026-12-01), so both services are configured in Railway service settings:

| Setting | `Hydrogen-Studies` (Express) | `web` (Next.js front door) |
|---|---|---|
| Builder | Nixpacks (`nixpacks.toml`) | Railpack |
| Build | `npm run build` | `npm run build:web` |
| Start | `node start-production.js` | `npm run start:web` |
| Healthcheck | `/health` (120 s) | `/web_health` (60 s) |
| Restart | on failure, 3 retries | on failure, 3 retries |
| Watch paths | (all) | `web/**`, `shared/**`, `client/src/index.css`, `tailwind.config.ts`, `package*.json` |

Express has NO pre-deploy command: schema changes are applied by the app's
own idempotent boot migrations (`server/migrations/*`, `_migrations` table).
`drizzle-kit push` is banned in prod — it would drop the runtime-managed
`search_vector` column and its indexes.

`web` env: `EXPRESS_ORIGIN=http://${{Hydrogen-Studies.RAILWAY_PRIVATE_DOMAIN}}:8080`,
`PAGE_DATA_KEY` (same value on both services), `NODE_ENV=production`,
`HOSTNAME=0.0.0.0`.
