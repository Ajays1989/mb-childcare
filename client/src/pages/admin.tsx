import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shell } from "@/components/shell";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Submission, Report } from "@shared/schema";
import { CentresTab, ProvidersTab } from "./admin-accounts";

let memoryToken: string | null = null;
const fmt = (t: number) => new Date(t).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });

export default function Admin() {
  const [token, setToken] = useState<string | null>(memoryToken);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const login = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/login", { password: pw })).json(),
    onSuccess: (d: { token: string }) => { memoryToken = d.token; setToken(d.token); },
    onError: (e: Error) => setErr(e.message),
  });

  const subs = useQuery<Submission[]>({
    queryKey: ["/api/admin/submissions", token], enabled: !!token,
    queryFn: async () => (await apiRequest("GET", "/api/admin/submissions", undefined, token)).json(),
  });
  const reps = useQuery<(Report & { targetLabel: string })[]>({
    queryKey: ["/api/admin/reports", token], enabled: !!token,
    queryFn: async () => (await apiRequest("GET", "/api/admin/reports", undefined, token)).json(),
  });
  const del = useMutation({
    mutationFn: async ({ kind, id }: { kind: "submissions" | "reports"; id: number }) =>
      (await apiRequest("DELETE", `/api/admin/${kind}/${id}`, undefined, token)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
    },
  });

  if (token && (subs.error || reps.error)) { memoryToken = null; setTimeout(() => setToken(null)); }

  if (!token) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm px-4 py-12">
          <ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-semibold">Moderation</h1>
          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); setErr(""); login.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="admin-pw">Admin password</Label>
              <Input id="admin-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-12" data-testid="input-admin-password" />
            </div>
            {err && <p role="alert" className="text-sm font-medium text-destructive" data-testid="text-admin-error">{err}</p>}
            <Button type="submit" className="min-h-12 w-full" disabled={login.isPending} data-testid="button-admin-login">
              {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
            </Button>
          </form>
        </div>
      </Shell>
    );
  }

  const reportedSubIds = new Set((reps.data ?? []).filter((r) => r.kind === "submission").map((r) => r.targetId));

  return (
    <Shell>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold">Moderation</h1>
        <p className="text-sm text-muted-foreground">Review reports, manage centres, and create provider logins.</p>
        <Tabs defaultValue="reports" className="mt-5">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="reports" data-testid="tab-reports">Reports ({reps.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="subs" data-testid="tab-submissions">Submissions ({subs.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="centres" data-testid="tab-centres">Centres</TabsTrigger>
            <TabsTrigger value="providers" data-testid="tab-providers">Provider logins</TabsTrigger>
          </TabsList>

          <TabsContent value="centres" className="mt-4"><CentresTab token={token} /></TabsContent>
          <TabsContent value="providers" className="mt-4"><ProvidersTab token={token} /></TabsContent>

          <TabsContent value="reports" className="mt-4">
            {reps.data?.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground" data-testid="status-no-reports">No open reports.</p>}
            <ul className="space-y-3">
              {reps.data?.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between" data-testid={`row-report-${r.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">{r.kind === "centre" ? "Centre info" : "Parent submission"} · {fmt(r.createdAt)}</p>
                    <p className="mt-1 font-semibold [overflow-wrap:anywhere]">{r.reason}</p>
                    <p className="text-sm [overflow-wrap:anywhere]">{r.targetLabel}</p>
                    {r.details && <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">“{r.details}”</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {r.kind === "submission" && (
                      <Button variant="destructive" size="sm" onClick={() => del.mutate({ kind: "submissions", id: r.targetId })} data-testid={`button-delete-reported-${r.id}`}>
                        <Trash2 className="mr-1 h-4 w-4" /> Delete submission
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => del.mutate({ kind: "reports", id: r.id })} data-testid={`button-dismiss-report-${r.id}`}>Dismiss</Button>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="subs" className="mt-4">
            <div className="overflow-x-auto rounded-2xl border border-card-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left">
                  <tr><th className="p-3">Date</th><th className="p-3">Area</th><th className="p-3">Age</th><th className="p-3">Centre</th><th className="p-3">Waiting</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subs.data?.map((s) => (
                    <tr key={s.id} data-testid={`row-admin-submission-${s.id}`} className={reportedSubIds.has(s.id) ? "bg-[hsl(38_80%_95%)]" : ""}>
                      <td className="whitespace-nowrap p-3 text-muted-foreground">{fmt(s.createdAt)}</td>
                      <td className="p-3">{s.fsa}</td>
                      <td className="p-3">{s.ageGroup}</td>
                      <td className="min-w-40 p-3">{s.centreName ?? (s.centreId ? `#${s.centreId}` : "—")}</td>
                      <td className="whitespace-nowrap p-3">{s.waitBucket}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" aria-label="Delete submission" onClick={() => del.mutate({ kind: "submissions", id: s.id })} data-testid={`button-delete-submission-${s.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}
