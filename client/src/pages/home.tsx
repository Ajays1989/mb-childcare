import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Plus, Flag, MapPin, Loader2, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell } from "@/components/shell";
import { AgePicker, AddStatusDialog, ReportDialog, type ReportTarget } from "@/components/forms";
import { apiRequest } from "@/lib/queryClient";
import type { CentreResult } from "@shared/schema";

type SearchResponse = { fsa: string; ageGroup: string; exact: CentreResult[]; nearby: CentreResult[] };

function ago(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  return `${m} month${m > 1 ? "s" : ""} ago`;
}

const LEVEL_COLOR = ["bg-muted-foreground/40", "bg-[hsl(152_42%_42%)]", "bg-[hsl(190_50%_42%)]", "bg-[hsl(210_55%_45%)]", "bg-[hsl(225_45%_42%)]"];

function WaitBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`h-2.5 flex-1 rounded-full ${i <= level ? LEVEL_COLOR[level] : "bg-muted"}`} />
      ))}
    </div>
  );
}

function CentreCard({ c, onReport, onAdd }: { c: CentreResult; onReport: (t: ReportTarget) => void; onAdd: (centreId: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_1px_2px_hsl(208_35%_16%/0.05)]" data-testid={`card-centre-${c.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug [overflow-wrap:anywhere]" data-testid={`text-centre-name-${c.id}`}>{c.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{c.neighbourhood} · {c.fsa}</p>
        </div>
        {c.vacancy && (
          <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground" data-testid={`status-vacancy-${c.id}`}>Vacancy now</span>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-secondary/60 p-4">
        <p className="text-sm text-muted-foreground">Estimated wait</p>
        {c.estimate.label ? (
          <>
            <p className="mt-0.5 text-xl font-semibold tabular" data-testid={`text-estimate-${c.id}`}>{c.estimate.label}</p>
            <div className="mt-3"><WaitBar level={c.estimate.level} /></div>
            <p className="mt-2 text-sm text-muted-foreground">Based on {c.estimate.reportCount} parent report{c.estimate.reportCount === 1 ? "" : "s"}</p>
          </>
        ) : (
          <>
            <p className="mt-0.5 text-lg font-semibold" data-testid={`text-estimate-${c.id}`}>Not enough reports yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Waiting here? Your report helps the next parent.</p>
          </>
        )}
      </div>

      {c.recentSubmissions.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOpen(!open)} aria-expanded={open} data-testid={`button-toggle-reports-${c.id}`}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-sm font-medium text-primary">
            Recent parent reports <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {c.recentSubmissions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2" data-testid={`row-submission-${s.id}`}>
                  <span className="text-sm"><span className="font-medium">Waiting {s.waitBucket.toLowerCase()}</span> <span className="text-muted-foreground">· {ago(s.createdAt)}</span></span>
                  <button aria-label="Report abuse on this wait time" title="Report abuse" data-testid={`button-flag-submission-${s.id}`}
                    onClick={() => onReport({ kind: "submission", targetId: s.id, title: `Wait time: ${s.waitBucket} at ${c.name}` })}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover-elevate">
                    <Flag className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="ghost" className="min-h-11 px-2 text-primary" onClick={() => onAdd(c.id)} data-testid={`button-add-for-${c.id}`}>
          <Plus className="mr-1 h-4 w-4" /> I'm waiting here
        </Button>
        <button onClick={() => onReport({ kind: "centre", targetId: c.id, title: c.name })} data-testid={`link-report-centre-${c.id}`}
          className="min-h-11 px-2 text-sm text-muted-foreground underline underline-offset-4">
          Report inaccurate info
        </button>
      </div>
    </article>
  );
}

export default function Home() {
  const [postal, setPostal] = useState("");
  const [age, setAge] = useState("Infant");
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ postalCode?: string; ageGroup?: string; centreId?: number }>({});
  const [report, setReport] = useState<ReportTarget>(null);

  const search = useMutation({
    mutationFn: async () => {
      const q = new URLSearchParams({ postalCode: postal, ageGroup: age });
      return (await apiRequest("GET", `/api/search?${q}`)).json() as Promise<SearchResponse>;
    },
    onSuccess: () => setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50),
    onError: (e: Error) => setError(e.message),
  });

  function openAdd(centreId?: number) {
    setAddDefaults({ postalCode: postal, ageGroup: search.data?.ageGroup ?? age, centreId });
    setAddOpen(true);
  }

  const r = search.data;
  const total = r ? r.exact.length + r.nearby.length : 0;

  return (
    <Shell showBanner>
      <section className="border-b border-border bg-[linear-gradient(180deg,hsl(200_45%_94%),hsl(200_33%_98%))]">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[1.1fr_1fr] md:items-center md:py-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">For Manitoba parents</p>
            <h1 className="mt-2 text-xl font-semibold leading-tight md:text-2xl">How long is the childcare waitlist near you?</h1>
            <p className="mt-3 max-w-prose text-base text-muted-foreground">
              Manitoba has no central waitlist. Parents share how long they've been waiting — anonymously — so you can plan with real numbers.
            </p>
            <Button variant="outline" className="mt-5 hidden min-h-12 border-primary/40 bg-card text-base md:inline-flex" onClick={() => openAdd()} data-testid="button-add-status-hero">
              <Plus className="mr-2 h-5 w-5" /> Add your waitlist status
            </Button>
          </div>

          <form className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_4px_20px_hsl(204_40%_30%/0.08)]" noValidate
            onSubmit={(e) => { e.preventDefault(); setError(""); if (!postal.trim()) return setError("Enter your postal code"); search.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="postal" className="text-base">Your postal code</Label>
              <Input id="postal" value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="R3C 0V8" autoComplete="postal-code"
                inputMode="text" className="h-14 text-lg uppercase tracking-wide" data-testid="input-postal" />
            </div>
            <div className="mt-4 space-y-2">
              <Label className="text-base">Age group</Label>
              <AgePicker value={age} onChange={setAge} idPrefix="search" />
            </div>
            {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive" data-testid="text-search-error">{error}</p>}
            <Button type="submit" className="mt-5 min-h-14 w-full text-lg" disabled={search.isPending} data-testid="button-search">
              {search.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />} See wait times
            </Button>
          </form>
        </div>
      </section>

      {/* Prominent add-status action on mobile */}
      {!search.data && <div className="mx-auto max-w-5xl px-4 pt-5 md:hidden">
        <Button variant="outline" className="min-h-12 w-full border-primary/40 bg-card text-base" onClick={() => openAdd()} data-testid="button-add-status">
          <Plus className="mr-2 h-5 w-5" /> Add your waitlist status
        </Button>
      </div>}

      <section id="results" className="mx-auto max-w-5xl scroll-mt-4 px-4 py-8">
        {search.isPending && (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        )}

        {r && !search.isPending && (
          <div data-testid="section-results">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold" data-testid="text-results-title">{r.ageGroup} care near {r.fsa}</h2>
                <p className="text-sm text-muted-foreground">{total} centre{total === 1 ? "" : "s"} · vacancies shown first</p>
              </div>
              <Button onClick={() => openAdd()} className="min-h-12 text-base" data-testid="button-add-status-results">
                <Plus className="mr-2 h-5 w-5" /> Add your waitlist status
              </Button>
            </div>

            {total === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center" data-testid="status-empty">
                <p className="text-lg font-semibold">No centres listed for {r.fsa} yet</p>
                <p className="mx-auto mt-2 max-w-md text-muted-foreground">We're still building coverage. Adding your waitlist status puts your area on the map.</p>
                <Button className="mt-5 min-h-12 text-base" onClick={() => openAdd()}>Add your waitlist status</Button>
              </div>
            )}

            {r.exact.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {r.exact.map((c) => <CentreCard key={c.id} c={c} onReport={setReport} onAdd={openAdd} />)}
              </div>
            )}

            {r.nearby.length > 0 && (
              <>
                <h3 className="mb-3 mt-8 text-lg font-semibold">Nearby areas</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {r.nearby.map((c) => <CentreCard key={c.id} c={c} onReport={setReport} onAdd={openAdd} />)}
                </div>
              </>
            )}

            <p className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Prototype: centres marked "(Sample)" and their wait times are placeholder data for testing.
            </p>
          </div>
        )}

        {!r && !search.isPending && (
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Search in seconds", "Enter your postal code and your child's age group."],
              ["See real estimates", "Wait ranges come from anonymous parent reports, not guesses."],
              ["Pay it forward", "Add how long you've waited. It takes four taps."],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-2xl border border-card-border bg-card p-5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">{i + 1}</span>
                <p className="mt-3 text-base font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <AddStatusDialog key={`${addOpen}-${addDefaults.centreId ?? ""}`} open={addOpen} onOpenChange={setAddOpen} defaults={addDefaults} />
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </Shell>
  );
}
