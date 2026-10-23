import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { X, Smartphone } from "lucide-react";
import { SiApple, SiGoogleplay } from "react-icons/si";

// Placeholder store URLs — replace with real listings once published
export const APP_STORE_URL = "https://apps.apple.com/app/id0000000000";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ca.example.mbchildcare";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M8 21.5c2.5-5 5.2-7.5 8-7.5s5.5 2.5 8 7.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="10" r="2.6" fill="hsl(150 45% 72%)" />
    </svg>
  );
}

export function DownloadBanner() {
  const [open, setOpen] = useState(true);
  // Hide inside the installed iOS/Android app — store reviewers flag "download our app" prompts
  const isNative = typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.();
  if (!open || isNative) return null;
  return (
    <div className="border-b border-border bg-accent text-accent-foreground" data-testid="banner-download">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <Smartphone className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-medium">Download our app for faster updates on your phone.</p>
        <div className="flex items-center gap-2">
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-app-store"
             className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-medium text-background">
            <SiApple className="h-4 w-4" aria-hidden="true" /> App Store
          </a>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-play-store"
             className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-medium text-background">
            <SiGoogleplay className="h-4 w-4" aria-hidden="true" /> Google Play
          </a>
          <button onClick={() => setOpen(false)} aria-label="Dismiss download banner" data-testid="button-dismiss-banner"
                  className="ml-1 grid h-9 w-9 place-items-center rounded-lg hover-elevate">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Shell({ children, showBanner = false }: { children: ReactNode; showBanner?: boolean }) {
  const [loc] = useLocation();
  const nav = [
    { href: "/", label: "Parents" },
    { href: "/provider", label: "Providers" },
  ];
  return (
    <div className="flex min-h-dvh flex-col">
      {showBanner && <DownloadBanner />}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" data-testid="link-home">
            <Mark />
            <span className="min-w-0 leading-tight">
              <span className="block whitespace-nowrap text-base font-semibold"><span className="min-[420px]:hidden">MB Childcare</span><span className="hidden min-[420px]:inline">Manitoba Childcare</span></span>
              <span className="block text-xs text-muted-foreground">Waitlist Tracker</span>
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
                className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-sm sm:px-3 font-medium ${loc === n.href ? "bg-secondary text-foreground" : "text-muted-foreground hover-elevate"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <p>Anonymous, parent-reported estimates. Not affiliated with the Government of Manitoba.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="underline-offset-4 hover:underline" data-testid="link-privacy">Privacy Policy</Link>
            <Link href="/terms" className="underline-offset-4 hover:underline" data-testid="link-terms">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
