/**
 * /admin/mcp — internal MCP keys: the list never shows full keys, a new key
 * is shown once with filled-in setup snippets, and revoke calls the API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

vi.mock("@/components/admin/AdminLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import McpPage from "../McpPage";

const NEW_KEY = "hsk_newly-created-key-abcdefghijklmnopqrstuvwxyz0123";
const calls: Array<{ method: string; url: string; body?: unknown }> = [];

beforeEach(() => {
  calls.length = 0;
  queryClient.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes("/api/admin/mcp-keys") && method === "GET") {
        return Response.json({
          keys: [
            { id: 1, name: "Josh – Claude Code", key_prefix: "hsk_AbCd", created_by_name: "josh", created_at: "2026-10-21T20:00:00Z", last_used_at: null, revoked_at: null },
            { id: 2, name: "Old laptop", key_prefix: "hsk_ZzZz", created_by_name: null, created_at: "2026-10-01T20:00:00Z", last_used_at: null, revoked_at: "2026-10-10T00:00:00Z" },
          ],
        });
      }
      if (url.includes("/api/admin/mcp-keys") && method === "POST") {
        return Response.json({ id: 3, name: "Sarah", key: NEW_KEY, key_prefix: NEW_KEY.slice(0, 8), created_at: "2026-10-21T21:00:00Z" }, { status: 201 });
      }
      if (url.includes("/api/admin/mcp-keys/") && method === "DELETE") return Response.json({ ok: true });
      return Response.json({ csrfToken: "t" });
    }),
  );
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn(async () => {}) } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <McpPage />
    </QueryClientProvider>,
  );

describe("McpPage", () => {
  it("lists keys by prefix only, with revoke only on active keys", async () => {
    renderPage();
    const active = (await screen.findByText("Josh – Claude Code")).closest("tr")!;
    expect(within(active).getByText("hsk_AbCd…")).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    const revoked = screen.getByText("Old laptop").closest("tr")!;
    expect(within(revoked).getByText("Revoked")).toBeInTheDocument();
    expect(within(revoked).queryByRole("button", { name: "Revoke" })).toBeNull();
  });

  it("creates a key and shows it once with filled-in setup snippets", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /New key/ }));
    await user.type(screen.getByLabelText("Name"), "Sarah");
    await user.click(screen.getByRole("button", { name: /Create key/ }));

    expect(await screen.findByText("Key for Sarah")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ name: "Sarah" });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(NEW_KEY)).toBeInTheDocument();
    expect(within(dialog).getByText(new RegExp(`Authorization: Bearer ${NEW_KEY}`))).toBeInTheDocument();
    expect(within(dialog).getByText(new RegExp(`"HS_AUTH": "Bearer ${NEW_KEY}"`))).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByText(NEW_KEY)).toBeNull();
  });

  it("revokes after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText("Josh – Claude Code")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Revoke" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revoke" }));
    await vi.waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/api/admin/mcp-keys/1"))).toBe(true));
  });
});
