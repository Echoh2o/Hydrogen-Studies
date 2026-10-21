import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TEAM_GUIDE_URL = "https://claude.ai/artifact/Aeu6NF6yt2JnZ64pfDCyjB";

interface McpKey {
  id: number;
  name: string;
  key_prefix: string;
  created_by_name: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface CreatedKey {
  id: number;
  name: string;
  key: string;
}

const urls = () => {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://hydrogenstudies.com";
  return { publicUrl: `${origin}/mcp`, adminUrl: `${origin}/mcp/admin` };
};

/** Setup snippets; with a key they're ready to paste, without one they use $HS_MCP_KEY / a placeholder. */
function snippets(key?: string) {
  const { publicUrl, adminUrl } = urls();
  return {
    codePublic: `claude mcp add --transport http -s user hydrogen-studies ${publicUrl}`,
    codeAdmin: `claude mcp add --transport http -s user hydrogen-studies-admin ${adminUrl} \\\n  --header "Authorization: Bearer ${key ?? "$HS_MCP_KEY"}"`,
    desktopAdmin: JSON.stringify(
      {
        mcpServers: {
          "hydrogen-studies-admin": {
            command: "npx",
            args: ["-y", "mcp-remote", adminUrl, "--header", "Authorization:${HS_AUTH}"],
            env: { HS_AUTH: `Bearer ${key ?? "YOUR_KEY_HERE"}` },
          },
        },
      },
      null,
      2,
    ),
  };
}

function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-1">
      {label && <p className="text-sm font-medium">{label}</p>}
      <div className="relative">
        <pre className="overflow-x-auto rounded-md bg-muted p-3 pr-12 text-xs leading-relaxed">{text}</pre>
        <Button size="icon" variant="ghost" className="absolute right-1 top-1 h-8 w-8" onClick={copy} aria-label="Copy">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "Never");

export default function McpPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [revoking, setRevoking] = useState<McpKey | null>(null);

  const keysQuery = useQuery<{ keys: McpKey[] }>({ queryKey: ["/api/admin/mcp-keys"] });

  const createMutation = useMutation({
    mutationFn: async (keyName: string) => (await apiRequest("POST", "/api/admin/mcp-keys", { name: keyName })).json() as Promise<CreatedKey>,
    onSuccess: (data) => {
      setCreated(data);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mcp-keys"] });
    },
    onError: (error: Error) => toast({ title: "Couldn't create key", description: error.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/admin/mcp-keys/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mcp-keys"] });
      toast({ title: "Key revoked", description: "It stops working within 30 seconds." });
    },
    onError: (error: Error) => toast({ title: "Couldn't revoke key", description: error.message, variant: "destructive" }),
  });

  const closeCreate = () => {
    setCreateOpen(false);
    setCreated(null);
    setName("");
  };

  const { publicUrl, adminUrl } = urls();
  const generic = snippets();
  const filled = created ? snippets(created.key) : null;
  const keys = keysQuery.data?.keys ?? [];

  return (
    <AdminLayout title="AI / MCP" description="Connect AI assistants to the study database and manage internal keys">
      <Helmet>
        <title>AI / MCP | Admin</title>
      </Helmet>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Connect</CardTitle>
            <CardDescription>
              The public endpoint needs no key. The internal endpoint adds server-side answers, synthesis and full
              abstracts, and needs a key from below. Full instructions for the team are in the{" "}
              <a href={TEAM_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="underline">
                MCP guide
              </a>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="claude-ai">
              <TabsList className="flex-wrap">
                <TabsTrigger value="claude-ai">claude.ai / ChatGPT</TabsTrigger>
                <TabsTrigger value="code">Claude Code</TabsTrigger>
                <TabsTrigger value="desktop">Claude Desktop (internal)</TabsTrigger>
              </TabsList>
              <TabsContent value="claude-ai" className="space-y-3 pt-3">
                <p className="text-sm text-muted-foreground">
                  claude.ai: Settings → Connectors → Add custom connector. ChatGPT: Settings → Apps &amp; Connectors →
                  Create (Developer mode on), no authentication. Public endpoint only — these apps can't send a key.
                </p>
                <CopyBlock label="Public URL" text={publicUrl} />
              </TabsContent>
              <TabsContent value="code" className="space-y-3 pt-3">
                <CopyBlock label="Public" text={generic.codePublic} />
                <CopyBlock label="Internal (set HS_MCP_KEY first)" text={generic.codeAdmin} />
              </TabsContent>
              <TabsContent value="desktop" className="space-y-3 pt-3">
                <p className="text-sm text-muted-foreground">
                  Settings → Developer → Edit Config, add this entry, then quit and reopen Claude Desktop. Needs Node.js.
                </p>
                <CopyBlock label="claude_desktop_config.json" text={generic.desktopAdmin} />
              </TabsContent>
            </Tabs>
            <p className="mt-4 text-xs text-muted-foreground">Internal URL: {adminUrl}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Internal keys</CardTitle>
              <CardDescription>
                One key per person. A key is shown once, when it's created. Revoking takes effect within 30 seconds.
              </CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New key
            </Button>
          </CardHeader>
          <CardContent>
            {keysQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : keysQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>Couldn't load keys: {(keysQuery.error as Error).message}</AlertDescription>
              </Alert>
            ) : keys.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No keys issued from here yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id} className={k.revoked_at ? "opacity-50" : undefined}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs">{k.key_prefix}…</TableCell>
                      <TableCell className="text-sm">
                        {fmt(k.created_at)}
                        {k.created_by_name && <span className="block text-xs text-muted-foreground">by {k.created_by_name}</span>}
                      </TableCell>
                      <TableCell className="text-sm">{fmt(k.last_used_at)}</TableCell>
                      <TableCell>
                        {k.revoked_at ? <Badge variant="secondary">Revoked</Badge> : <Badge>Active</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {!k.revoked_at && (
                          <Button variant="outline" size="sm" onClick={() => setRevoking(k)}>
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Keys in the Railway variable MCP_ADMIN_KEYS also still work and aren't listed here.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => (open ? setCreateOpen(true) : closeCreate())}>
        <DialogContent className="max-w-2xl">
          {!created ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) createMutation.mutate(name.trim());
              }}
            >
              <DialogHeader>
                <DialogTitle>New internal key</DialogTitle>
                <DialogDescription>Name it after the person and where they'll use it.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <Label htmlFor="mcp-key-name">Name</Label>
                <Input
                  id="mcp-key-name"
                  value={name}
                  maxLength={100}
                  placeholder="Sarah – Claude Code"
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeCreate}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Create key
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Key for {created.name}</DialogTitle>
                <DialogDescription>
                  Copy it now — it won't be shown again. Send it through a password manager or a one-time secret link,
                  never Slack or email.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
                <CopyBlock label="Key" text={created.key} />
                <CopyBlock label="Claude Code" text={filled!.codeAdmin} />
                <CopyBlock label="Claude Desktop (claude_desktop_config.json)" text={filled!.desktopAdmin} />
              </div>
              <DialogFooter>
                <Button onClick={closeCreate}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revoking} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{revoking?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything using this key loses access to the internal MCP within 30 seconds. This can't be undone; issue a
              new key instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revoking) revokeMutation.mutate(revoking.id);
                setRevoking(null);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
