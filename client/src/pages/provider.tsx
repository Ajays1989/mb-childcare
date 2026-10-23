import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, LogOut, Search, Users, Clock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Shell } from "@/components/shell";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AGE_GROUPS, type ProviderDashboard } from "@shared/schema";
import { CONTACT_EMAIL } from "@/lib/contact";

// Session token kept in memory only (sandbox blocks browser storage; in production use Supabase Auth)
let memoryToken: string | null = null;

function ago(ts: number) {
  const h = Math.floor((Date.now() - ts) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const demo = useQuery<{ email: string; password: string } | null>({
    queryKey: ["/api/provider/demo"],
    queryFn: async () => (await apiRequest("GET", "/api/provider/demo")).json(),
  });
  const m = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/provider/login", { email, password })).json(),
    onSuccess: (d: { token: string }) => onLogin(d.token),
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Provider sign in</h1>
      <p className="mt-1 text-muted-foreground">For licensed childcare directors in Manitoba.</p>
      <form className="mt-6 space-y-4 rounded-2xl border border-card-border bg-card p-5" noValidate
        onSubmit={(e) => { e.preventDefault(); setError(""); m.mutate(); }}>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" data-testid="input-provider-email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-base">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" data-testid="input-provider-password" />
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive" data-testid="text-login-error">{error}</p>}
        <Button type="submit" className="min-h-12 w-full text-base" disabled={m.isPending} data-testid="button-provider-login">
          {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
        </Button>
      </form>
      {demo.data && (
        <div className="mt-4 rounded-xl bg-accent p-4 text-sm text-accent-foreground" data-testid="text-demo-credentials">
          <p className="font-semibold">Demo account</p>
          <p className="mt-1 [overflow-wrap:anywhere]">{demo.data.email} · {demo.data.password}</p>
        </div>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        Run a licensed centre and need an account? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Provider%20account%20request`} className="font-medium text-primary underline underline-offset-2 [overflow-wrap:anywhere]" data-testid="link-request-account">{CONTACT_EMAIL}</a>{" "}
        from your centre's email address with your centre name, and we will set one up after confirming you are the director.
      </p>
    </div>
  );
}

function ChangePassword({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const m = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/provider/password", { currentPassword, newPassword }, token)).json(),
    onSuccess: () => { setMsg({ ok: true, text: "Password updated." }); setCurrent(""); setNew(""); },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });
  return (
    <section className="mt-4 rounded-2xl border border-card-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5" aria-hidden="true" /> Password</h2>
        {!open && <Button variant="outline" className="min-h-11" onClick={() => { setOpen(true); setMsg(null); }} data-testid="button-open-change-password">Change password</Button>}
      </div>
      {open && (
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setMsg(null); m.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="cur-pw">Current password</Label>
            <Input id="cur-pw" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} className="h-12" data-testid="input-current-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw">New password (10+ characters)</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} className="h-12" data-testid="input-new-password" />
          </div>
          {msg && <p role="status" className={`text-sm font-medium sm:col-span-2 ${msg.ok ? "text-primary" : "text-destructive"}`} data-testid="text-password-message">{msg.text}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" className="min-h-11" disabled={m.isPending} data-testid="button-save-password">
              {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save new password
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Stat({ icon: Icon, label, value, sub, testid }: { icon: any; label: string; value: string | number; sub: string; testid: string }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Icon className="h-4 w-4" aria-hidden="true" />{label}</p>
      <p className="mt-2 text-xl font-semibold tabular md:text-2xl" data-testid={testid}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function Bars({ data, total }: { data: Record<string, number>; total: number }) {
  return (
    <ul className="space-y-4">
      {AGE_GROUPS.map((a) => {
        const v = data[a] ?? 0;
        const pct = total ? Math.round((v / total) * 100) : 0;
        return (
          <li key={a} data-testid={`row-age-${a.toLowerCase()}`}>
            <div className="flex items-baseline justify-between text-base">
              <span className="font-medium">{a}</span>
              <span className="tabular"><span className="font-semibold">{v}</span> <span className="text-sm text-muted-foreground">({pct}%)</span></span>
            </div>
            <div className="mt-1.5 h-3 rounded-full bg-muted">
              <div className="h-3 rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const { data, isLoading, error } = useQuery<ProviderDashboard>({
    queryKey: ["/api/provider/dashboard", token],
    queryFn: async () => (await apiRequest("GET", "/api/provider/dashboard", undefined, token)).json(),
  });
  const vac = useMutation({
    mutationFn: async (v: boolean) => (await apiRequest("PATCH", "/api/provider/vacancy", { vacancy: v }, token)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/provider/dashboard"] }),
  });

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
  if (error || !data) return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="font-semibold">Your session has ended.</p>
      <Button className="mt-4" onClick={onLogout}>Sign in again</Button>
    </div>
  );

  const { centre } = data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]" data-testid="text-centre-name">{centre.name} · {data.fsa}</p>
          <h1 className="mt-1 text-xl font-semibold leading-tight">See the demand you cannot see anywhere else.</h1>
        </div>
        <Button variant="outline" onClick={onLogout} className="min-h-11" data-testid="button-logout"><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
      </div>

      <div className={`mt-6 flex items-center justify-between gap-4 rounded-2xl border p-5 ${centre.vacancy ? "border-[hsl(152_40%_70%)] bg-accent" : "border-card-border bg-card"}`}>
        <div className="min-w-0">
          <Label htmlFor="vacancy" className="text-lg font-semibold">We have a vacancy right now</Label>
          <p className="mt-0.5 text-sm text-muted-foreground" data-testid="text-vacancy-status">
            {centre.vacancy ? "Parents see a “Vacancy now” badge on your listing." : "Turn on to show parents you have an open spot."}
          </p>
        </div>
        <Switch id="vacancy" checked={centre.vacancy} disabled={vac.isPending} onCheckedChange={(v) => vac.mutate(v)} className="scale-125" data-testid="switch-vacancy" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat icon={Search} label="Parent searches" value={data.totalSearches30d} sub={`in ${data.fsa}, last 30 days`} testid="text-total-searches" />
        <Stat icon={Users} label="Waitlisted with you" value={data.waitlistedCount} sub="parents reported waiting here" testid="text-waitlisted-count" />
        <Stat icon={Clock} label="Parent-reported wait" value={data.estimate.label ?? "—"} sub={`from ${data.estimate.reportCount} reports`} testid="text-estimate" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="text-lg font-semibold">Searches by age group</h2>
          <p className="mb-4 text-sm text-muted-foreground">What parents in {data.fsa} are looking for</p>
          <Bars data={data.searchesByAge} total={data.totalSearches30d} />
        </section>
        <section className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="text-lg font-semibold">Waitlisted at your centre</h2>
          <p className="mb-4 text-sm text-muted-foreground">Anonymous parent reports, by age group</p>
          <Bars data={data.waitlistedByAge} total={data.waitlistedCount} />
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-card-border bg-card p-5">
        <h2 className="text-lg font-semibold">Recent searches in {data.fsa}</h2>
        <p className="mb-3 text-sm text-muted-foreground">Anonymous — no names or contact info are collected</p>
        <ul className="divide-y divide-border">
          {data.recentSearches.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-3" data-testid={`row-search-${s.id}`}>
              <span className="text-base">A parent searched for <span className="font-semibold">{s.ageGroup}</span> care</span>
              <span className="shrink-0 text-sm text-muted-foreground">{ago(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
      <ChangePassword token={token} />
      {centre.isSample && <p className="mt-4 text-sm text-muted-foreground">Prototype: dashboard figures include placeholder sample data.</p>}
    </div>
  );
}

export default function Provider() {
  const [token, setToken] = useState<string | null>(memoryToken);
  const login = (t: string) => { memoryToken = t; setToken(t); };
  const logout = () => {
    if (token) apiRequest("POST", "/api/provider/logout", {}, token).catch(() => {});
    memoryToken = null; setToken(null); queryClient.removeQueries({ queryKey: ["/api/provider/dashboard"] });
  };
  return <Shell>{token ? <Dashboard token={token} onLogout={logout} /> : <Login onLogin={login} />}</Shell>;
}
