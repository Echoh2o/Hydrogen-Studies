// Liveness for Railway's deploy healthcheck (Express keeps /health, /healthz).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "web" });
}
