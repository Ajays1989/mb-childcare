import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest } from "@/lib/queryClient";
import { AGE_GROUPS, WAIT_BUCKETS, CENTRE_REPORT_REASONS } from "@shared/schema";

export function AgePicker({ value, onChange, idPrefix }: { value: string; onChange: (v: string) => void; idPrefix: string }) {
  return (
    <div role="radiogroup" aria-label="Age group" className="grid grid-cols-3 gap-2">
      {AGE_GROUPS.map((a) => {
        const on = value === a;
        return (
          <button type="button" key={a} role="radio" aria-checked={on} onClick={() => onChange(a)}
            data-testid={`${idPrefix}-age-${a.toLowerCase()}`}
            className={`min-h-12 rounded-xl border px-2 text-base font-medium transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover-elevate"}`}>
            {a}
          </button>
        );
      })}
    </div>
  );
}

const OTHER = "__other";

export function AddStatusDialog({ open, onOpenChange, defaults }: {
  open: boolean; onOpenChange: (o: boolean) => void; defaults?: { postalCode?: string; ageGroup?: string; centreId?: number };
}) {
  const [postalCode, setPostal] = useState(defaults?.postalCode ?? "");
  const [ageGroup, setAge] = useState(defaults?.ageGroup ?? "");
  const [centre, setCentre] = useState(defaults?.centreId ? String(defaults.centreId) : "");
  const [centreText, setCentreText] = useState("");
  const [wait, setWait] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const { data: centres } = useQuery<{ id: number; name: string; fsa: string }[]>({ queryKey: ["/api/centres"], enabled: open });

  const m = useMutation({
    mutationFn: async () => {
      const body = {
        postalCode, ageGroup, waitBucket: wait,
        centreId: centre && centre !== OTHER ? Number(centre) : null,
        centreName: centre === OTHER ? centreText || null : null,
      };
      return (await apiRequest("POST", "/api/submissions", body)).json();
    },
    onSuccess: () => setDone(true),
    onError: (e: Error) => setError(e.message),
  });

  function reset(o: boolean) {
    onOpenChange(o);
    if (!o) setTimeout(() => { setDone(false); setError(""); setWait(""); setCentreText(""); }, 200);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!postalCode.trim()) return setError("Enter your postal code");
    if (!ageGroup) return setError("Choose an age group");
    if (!wait) return setError("Choose how long you have been waiting");
    m.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        {done ? (
          <div className="py-6 text-center" data-testid="status-thank-you">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[hsl(152_40%_38%)]" aria-hidden="true" />
            <DialogTitle className="mt-4 text-xl">Thank you</DialogTitle>
            <DialogDescription className="mt-2 text-base">
              Your anonymous report helps other Manitoba parents plan. Estimates update as more families share.
            </DialogDescription>
            <Button className="mt-6 min-h-12 w-full text-base" onClick={() => reset(false)} data-testid="button-thanks-close">Done</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
              <DialogTitle className="text-xl">Add your waitlist status</DialogTitle>
              <DialogDescription className="text-base">Anonymous. No names, emails, or contact info.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="add-postal" className="text-base">Postal code</Label>
              <Input id="add-postal" value={postalCode} onChange={(e) => setPostal(e.target.value)} placeholder="R3C 0V8"
                autoComplete="postal-code" className="h-12 text-base uppercase" data-testid="input-add-postal" />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Age group</Label>
              <AgePicker value={ageGroup} onChange={setAge} idPrefix="add" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-centre" className="text-base">Centre <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Select value={centre} onValueChange={setCentre}>
                <SelectTrigger id="add-centre" className="h-12 text-base" data-testid="select-add-centre"><SelectValue placeholder="Choose a centre" /></SelectTrigger>
                <SelectContent>
                  {(centres ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} · {c.fsa}</SelectItem>)}
                  <SelectItem value={OTHER}>Not listed — type it in</SelectItem>
                </SelectContent>
              </Select>
              {centre === OTHER && (
                <Input value={centreText} onChange={(e) => setCentreText(e.target.value)} placeholder="Centre name"
                  className="h-12 text-base" data-testid="input-add-centre-name" maxLength={120} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-wait" className="text-base">How long have you been waiting?</Label>
              <Select value={wait} onValueChange={setWait}>
                <SelectTrigger id="add-wait" className="h-12 text-base" data-testid="select-add-wait"><SelectValue placeholder="Choose one" /></SelectTrigger>
                <SelectContent>
                  {WAIT_BUCKETS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {error && <p role="alert" className="text-sm font-medium text-destructive" data-testid="text-add-error">{error}</p>}
            <DialogFooter>
              <Button type="submit" className="min-h-12 w-full text-base" disabled={m.isPending} data-testid="button-submit-status">
                {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit anonymously
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type ReportTarget = { kind: "centre" | "submission"; targetId: number; title: string } | null;

const SUBMISSION_REASONS = ["Looks fake or spam", "Offensive or abusive", "Duplicate", "Other"] as const;

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const reasons = target?.kind === "centre" ? CENTRE_REPORT_REASONS : SUBMISSION_REASONS;

  const m = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/reports", { kind: target!.kind, targetId: target!.targetId, reason, details: details || null })).json(),
    onSuccess: () => setDone(true),
    onError: (e: Error) => setError(e.message),
  });

  function close() {
    onClose();
    setTimeout(() => { setReason(""); setDetails(""); setDone(false); setError(""); }, 200);
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="py-6 text-center" data-testid="status-report-sent">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[hsl(152_40%_38%)]" aria-hidden="true" />
            <DialogTitle className="mt-4 text-xl">Report received</DialogTitle>
            <DialogDescription className="mt-2 text-base">Our team reviews every report. Thank you for keeping this accurate.</DialogDescription>
            <Button className="mt-6 min-h-12 w-full text-base" onClick={close} data-testid="button-report-close">Done</Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!reason) return setError("Choose a reason"); m.mutate(); }}>
            <DialogHeader>
              <DialogTitle className="text-xl">{target?.kind === "centre" ? "Report inaccurate info" : "Report abuse"}</DialogTitle>
              <DialogDescription className="text-base">{target?.title}</DialogDescription>
            </DialogHeader>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-1">
              {reasons.map((r) => (
                <Label key={r} htmlFor={`reason-${r}`} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-input px-3 text-base font-normal hover-elevate">
                  <RadioGroupItem id={`reason-${r}`} value={r} data-testid={`radio-reason-${r.toLowerCase().replace(/\W+/g, "-")}`} />
                  {r}
                </Label>
              ))}
            </RadioGroup>
            <div className="space-y-2">
              <Label htmlFor="report-details" className="text-base">Details <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} className="text-base" data-testid="input-report-details" />
            </div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="min-h-12 w-full text-base" disabled={m.isPending} data-testid="button-submit-report">
              {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send report
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
