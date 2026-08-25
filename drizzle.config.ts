import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: ["./shared/schema.ts", "./shared/schema-hydrogen-fields.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Tables that exist in the database but are intentionally NOT part of the
  // drizzle schema, because they're managed by other tooling:
  //   - `session`     — created/maintained by connect-pg-simple (session store)
  //   - `_migrations` — legacy migration bookkeeping table
  // Without this filter, `drizzle-kit push` sees them as "to be dropped" while
  // also seeing new schema-only tables as "to be created". That ambiguity makes
  // the tables resolver open an interactive rename prompt, which crashes the
  // non-interactive pre-deploy step ("Interactive prompts require a TTY").
  // Excluding them makes the diff unambiguous (creates only) so push runs
  // non-interactively — and guarantees these externally-owned tables are never
  // dropped by a schema sync.
  tablesFilter: ["!session", "!_migrations"],
});
