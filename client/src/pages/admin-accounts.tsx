import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2, Loader2, KeyRound, Copy, Check, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AGE_GROUPS, type Centre, type ProviderListItem } from "@shared/schema";

const card = "rounded-2xl border border-card-border bg-card p-5";

function refreshAll() {
  ["/api/admin/centres", "/api/admin/providers", "/api/admin/submissions", "/api/admin/reports", "/api/centres", "/api/provider/demo"]
    .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
}

export function useAdminCentres(token: string) {
  return useQuery<Centre[]>({
    queryKey: ["/api/admin/centres", token],
    queryFn: async () => (await apiRequest("GET", "/api/admin/centres", undefined, token)).json(),
  });
}

/* ---------------- Centres ---------------- */

export function CentresTab({ token }: { token: string }) {
  const centres = useAdminCentres(token);
  const [form, setForm] = useState({ name: "", postalCode: "", neighbourhood: "", capacity: "", hidden: false });
  const [ages, setAges] = useState<string[]>([...AGE_GROUPS]);
  const [err, setErr] = useState("");

  const add = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/centres", {
      ...form, capacity: Number(form.capacity) || 0, ages,
    }, token)).json(),
    onSuccess: () => { setForm({ name: "", postalCode: "", neighbourhood: "", capacity: "", hidden: false }); setAges([...AGE_GROUPS]); refreshAll(); },
    onError: (e: Error) => setErr(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/admin/centres/${id}`, undefined, token)).json(),
    onSuccess: refreshAll,
  });
  const clear = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/clear-sample-data", {}, token)).json(),
    onSuccess: refreshAll,
  });

  const sampleCount = centres.data?.filter((c) => c.isSample).length ?? 0;

  return (
    <div className="space-y-4">
      {sampleCount > 0 && (
        <div className={`${card} border-[hsl(38_70%_75%)] bg-[hsl(38_80%_96%)]`}>
          <p className="font-semibold">Before launch: remove sample data</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Deletes the {sampleCount} sample centres, the demo provider login, and all test submissions, searches and reports. Centres and accounts you added are kept.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-3 min-h-11" data-testid="button-clear-sample">Remove sample data</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove all sample data?</AlertDialogTitle>
                <AlertDialogDescription>This can't be undone. Do this once, right before you launch.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => clear.mutate()} data-testid="button-confirm-clear-sample">Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <form className={`${card} grid gap-4 sm:grid-cols-2`} onSubmit={(e) => { e.preventDefault(); setErr(""); add.mutate(); }}>
        <h2 className="text-lg font-semibold sm:col-span-2">Add a centre</h2>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="c-name">Centre name</Label>
          <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12" data-testid="input-centre-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-postal">Postal code</Label>
          <Input id="c-postal" placeholder="R3C 0V8" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className="h-12" data-testid="input-centre-postal" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-hood">Neighbourhood or town</Label>
          <Input id="c-hood" placeholder="St. Vital" value={form.neighbourhood} onChange={(e) => setForm({ ...form, neighbourhood: e.target.value })} className="h-12" data-testid="input-centre-neighbourhood" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-cap">Licensed spaces</Label>
          <Input id="c-cap" inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value.replace(/\D/g, "") })} className="h-12" data-testid="input-centre-capacity" />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Age groups</legend>
          <div className="flex flex-wrap gap-4 pt-1">
            {AGE_GROUPS.map((a) => (
              <label key={a} className="flex min-h-11 items-center gap-2 text-base">
                <Checkbox checked={ages.includes(a)} onCheckedChange={(v) => setAges(v ? [...ages, a] : ages.filter((x) => x !== a))} data-testid={`checkbox-age-${a.toLowerCase()}`} />
                {a}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3 sm:col-span-2">
          <Checkbox className="mt-0.5" checked={form.hidden} onCheckedChange={(v) => setForm({ ...form, hidden: !!v })} data-testid="checkbox-centre-hidden" />
          <span>
            <span className="font-medium">Test centre, hidden from parents</span>
            <span className="block text-sm text-muted-foreground">Use this for the App Store and Google Play reviewer login so reviewers never change a real listing.</span>
          </span>
        </label>
        {err && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2" data-testid="text-centre-error">{err}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" className="min-h-12" disabled={add.isPending} data-testid="button-add-centre">
            {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add centre
          </Button>
        </div>
      </form>

      <ul className="space-y-2">
        {centres.data?.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-card-border bg-card p-4" data-testid={`row-centre-${c.id}`}>
            <div className="min-w-0">
              <p className="font-semibold [overflow-wrap:anywhere]">{c.name}</p>
              <p className="text-sm text-muted-foreground">{c.fsa} · {c.neighbourhood} · {(JSON.parse(c.ages) as string[]).join(", ")}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {c.isSample && <Badge variant="secondary">Sample</Badge>}
                {c.hidden && <Badge variant="outline"><EyeOff className="mr-1 h-3 w-3" />Hidden test centre</Badge>}
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} data-testid={`button-delete-centre-${c.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {c.name}?</AlertDialogTitle>
                  <AlertDialogDescription>This also deletes its provider login and every parent report for this centre.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => del.mutate(c.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Provider accounts ---------------- */

function TempPassword({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Your Manitoba Childcare Waitlist provider login\nEmail: ${email}\nTemporary password: ${password}\nPlease sign in and change your password under "Password".`;
  return (
    <div className={`${card} border-[hsl(152_40%_70%)] bg-accent`} data-testid="panel-temp-password">
      <p className="font-semibold">Login ready for {email}</p>
      <p className="mt-1 text-sm text-muted-foreground">Copy this now. For security it won't be shown again.</p>
      <p className="mt-3 rounded-lg bg-card p-3 font-mono text-lg tracking-wide [overflow-wrap:anywhere]" data-testid="text-temp-password">{password}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="min-h-11" onClick={() => { navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {}); }} data-testid="button-copy-login">
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} {copied ? "Copied" : "Copy login message"}
        </Button>
        <Button variant="outline" className="min-h-11" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

export function ProvidersTab({ token }: { token: string }) {
  const centres = useAdminCentres(token);
  const providers = useQuery<ProviderListItem[]>({
    queryKey: ["/api/admin/providers", token],
    queryFn: async () => (await apiRequest("GET", "/api/admin/providers", undefined, token)).json(),
  });
  const [email, setEmail] = useState("");
  const [centreId, setCentreId] = useState<string>("");
  const [err, setErr] = useState("");
  const [issued, setIssued] = useState<{ email: string; tempPassword: string } | null>(null);

  const add = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/providers", { email, centreId: Number(centreId) }, token)).json(),
    onSuccess: (d) => { setIssued(d); setEmail(""); setCentreId(""); refreshAll(); },
    onError: (e: Error) => setErr(e.message),
  });
  const reset = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/admin/providers/${id}/reset`, {}, token)).json(),
    onSuccess: (d) => setIssued(d),
  });
  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/admin/providers/${id}`, undefined, token)).json(),
    onSuccess: refreshAll,
  });

  return (
    <div className="space-y-4">
      {issued && <TempPassword email={issued.email} password={issued.tempPassword} onDone={() => setIssued(null)} />}

      <form className={`${card} grid gap-4 sm:grid-cols-2`} onSubmit={(e) => { e.preventDefault(); setErr(""); setIssued(null); add.mutate(); }}>
        <div className="sm:col-span-2">
          <h2 className="text-lg font-semibold">Create a provider login</h2>
          <p className="text-sm text-muted-foreground">Before creating one, confirm the person is the director: call the centre's listed phone number, or check that the email matches the centre's own domain.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-email">Director's email</Label>
          <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" data-testid="input-new-provider-email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-centre">Centre</Label>
          <Select value={centreId} onValueChange={setCentreId}>
            <SelectTrigger id="p-centre" className="h-12" data-testid="select-new-provider-centre"><SelectValue placeholder="Pick a centre" /></SelectTrigger>
            <SelectContent>
              {centres.data?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.hidden ? " (hidden test)" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {err && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2" data-testid="text-provider-error">{err}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" className="min-h-12" disabled={add.isPending || !centreId} data-testid="button-create-provider">
            {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create login
          </Button>
        </div>
      </form>

      {providers.data?.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">No provider logins yet.</p>}
      <ul className="space-y-2">
        {providers.data?.map((p) => (
          <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-card-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-provider-${p.id}`}>
            <div className="min-w-0">
              <p className="font-semibold [overflow-wrap:anywhere]">{p.email}</p>
              <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{p.centreName}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => reset.mutate(p.id)} data-testid={`button-reset-provider-${p.id}`}>
                <KeyRound className="mr-1 h-4 w-4" /> Reset password
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive" data-testid={`button-delete-provider-${p.id}`}>
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {p.email}?</AlertDialogTitle>
                    <AlertDialogDescription>They will be signed out and can no longer access the dashboard. The centre listing stays.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => del.mutate(p.id)}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
