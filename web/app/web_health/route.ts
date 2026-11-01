// Liveness for the web service deploy healthcheck at /web_health (Railway
// paths allow only letters, digits, "/" and "_"). Express keeps /health.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "web" });
}
