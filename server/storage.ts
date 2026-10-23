import { centres, submissions, searches, reports, providers } from "@shared/schema";
import type {
  Centre, Submission, Report, Provider, InsertSubmission, InsertReport,
  WaitEstimate, CentreResult, ProviderDashboard, InsertCentre, ProviderListItem,
} from "@shared/schema";
import { AGE_GROUPS, WAIT_BUCKETS } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, gte, inArray, like } from "drizzle-orm";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// ---------- Password hashing (scrypt, built into Node) ----------
export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string) {
  if (!stored.startsWith("scrypt$")) return pw === stored; // legacy plain text, upgraded on next login
  const [, salt, hash] = stored.split("$");
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function generatePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(14);
  return Array.from(bytes, (x) => chars[x % chars.length]).join("").replace(/(.{4})(?=.)/g, "$1-");
}
export const DEMO_EMAIL = "director@littlemaples.example";
export const DEMO_PASSWORD = "demo1234";

const sqlite = new Database(process.env.DATABASE_PATH || "data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
CREATE TABLE IF NOT EXISTS centres (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, fsa TEXT NOT NULL, neighbourhood TEXT NOT NULL, ages TEXT NOT NULL, capacity INTEGER NOT NULL, vacancy INTEGER NOT NULL DEFAULT 0, is_sample INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, postal_code TEXT NOT NULL, fsa TEXT NOT NULL, age_group TEXT NOT NULL, centre_id INTEGER, centre_name TEXT, wait_bucket TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS searches (id INTEGER PRIMARY KEY AUTOINCREMENT, fsa TEXT NOT NULL, age_group TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, target_id INTEGER NOT NULL, reason TEXT NOT NULL, details TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS providers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, centre_id INTEGER NOT NULL);
`);
try { sqlite.exec("ALTER TABLE centres ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }

export const db = drizzle(sqlite);

const BUCKET_MONTHS: Record<string, number> = {
  "Under 3 months": 1.5, "3–6 months": 4.5, "6–12 months": 9, "12+ months": 18,
};

export function estimateFrom(buckets: string[]): WaitEstimate {
  const n = buckets.length;
  if (n < 2) return { label: null, level: 0, reportCount: n };
  const avg = buckets.reduce((s, b) => s + (BUCKET_MONTHS[b] ?? 9), 0) / n;
  if (avg < 6) return { label: "Under 6 months", level: 1, reportCount: n };
  if (avg < 12) return { label: "6–12 months", level: 2, reportCount: n };
  if (avg < 18) return { label: "12–18 months", level: 3, reportCount: n };
  return { label: "18+ months", level: 4, reportCount: n };
}

const DAY = 86400000;

// Deterministic pseudo-random for stable sample data
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function seed() {
  const count = sqlite.prepare("SELECT COUNT(*) as c FROM centres").get() as { c: number };
  if (count.c > 0) return;
  // Set SEED_SAMPLE_DATA=false on your live server so a fresh database starts empty
  if (process.env.SEED_SAMPLE_DATA === "false") return;
  const sample: [string, string, string, string[], number][] = [
    ["Little Maples Early Learning (Sample)", "R3C", "Downtown Winnipeg", ["Infant", "Toddler", "Preschool"], 64],
    ["Exchange District Kids Co-op (Sample)", "R3C", "Downtown Winnipeg", ["Toddler", "Preschool"], 40],
    ["Forks Family Childcare (Sample)", "R3C", "Downtown Winnipeg", ["Infant", "Toddler"], 24],
    ["Wolseley Sprouts Daycare (Sample)", "R3G", "West End / Wolseley", ["Infant", "Toddler", "Preschool"], 52],
    ["Broadway Bright Beginnings (Sample)", "R3G", "West End / Wolseley", ["Preschool"], 32],
    ["River Heights Little Learners (Sample)", "R3M", "River Heights", ["Toddler", "Preschool"], 48],
    ["Crescentwood Children's Centre (Sample)", "R3M", "River Heights", ["Infant", "Toddler", "Preschool"], 72],
    ["Osborne Village Nest (Sample)", "R3L", "Osborne / Riverview", ["Infant", "Toddler"], 28],
    ["St. Vital Sunflower Daycare (Sample)", "R2M", "St. Vital", ["Infant", "Toddler", "Preschool"], 60],
    ["Riel Park Kids Centre (Sample)", "R2M", "St. Vital", ["Preschool"], 36],
    ["Fort Garry Prairie Kids (Sample)", "R3T", "Fort Garry", ["Infant", "Toddler", "Preschool"], 80],
    ["Pembina Early Years (Sample)", "R3T", "Fort Garry", ["Toddler", "Preschool"], 44],
    ["Kildonan Riverbend Daycare (Sample)", "R2K", "North / East Kildonan", ["Infant", "Toddler", "Preschool"], 56],
    ["North End Community Childcare (Sample)", "R2W", "North End", ["Infant", "Toddler", "Preschool"], 48],
    ["St. James Bluebird Centre (Sample)", "R3J", "St. James", ["Toddler", "Preschool"], 40],
    ["Transcona Little Engines (Sample)", "R2C", "Transcona", ["Infant", "Toddler", "Preschool"], 64],
    ["Brandon Wheat City Kids (Sample)", "R7A", "Brandon", ["Infant", "Toddler", "Preschool"], 56],
    ["Steinbach Meadowlark Daycare (Sample)", "R5G", "Steinbach", ["Toddler", "Preschool"], 48],
  ];
  const insC = sqlite.prepare("INSERT INTO centres (name, fsa, neighbourhood, ages, capacity, vacancy, is_sample) VALUES (?,?,?,?,?,?,1)");
  const insS = sqlite.prepare("INSERT INTO submissions (postal_code, fsa, age_group, centre_id, centre_name, wait_bucket, created_at) VALUES (?,?,?,?,?,?,?)");
  const insQ = sqlite.prepare("INSERT INTO searches (fsa, age_group, created_at) VALUES (?,?,?)");
  const r = rng(42);
  const now = Date.now();
  const tx = sqlite.transaction(() => {
    sample.forEach(([name, fsa, hood, ages, cap], i) => {
      const vacancy = i === 5 || i === 16 ? 1 : 0;
      const info = insC.run(name, fsa, hood, JSON.stringify(ages), cap, vacancy);
      const cid = Number(info.lastInsertRowid);
      for (const age of ages) {
        // infants wait longest
        const bias = age === "Infant" ? 2.8 : age === "Toddler" ? 2.1 : 1.2;
        const n = 3 + Math.floor(r() * 6);
        for (let k = 0; k < n; k++) {
          const idx = Math.max(0, Math.min(3, Math.round(bias + (r() - 0.5) * 2)));
          insS.run(`${fsa}0A1`, fsa, age, cid, name, WAIT_BUCKETS[idx], now - Math.floor(r() * 60 * DAY));
        }
      }
    });
    const fsas = Array.from(new Set(sample.map((s) => s[1])));
    for (const fsa of fsas) {
      const n = 25 + Math.floor(r() * 60);
      for (let k = 0; k < n; k++) {
        const x = r();
        const age = x < 0.45 ? "Infant" : x < 0.8 ? "Toddler" : "Preschool";
        insQ.run(fsa, age, now - Math.floor(r() * 30 * DAY));
      }
    }
    sqlite.prepare("INSERT INTO providers (email, password, centre_id) VALUES (?,?,?)").run(DEMO_EMAIL, hashPassword(DEMO_PASSWORD), 1);
  });
  tx();
}
seed();

export function normalizeFsa(postal: string) {
  return postal.toUpperCase().replace(/\s+/g, "").slice(0, 3);
}

export interface IStorage {
  searchCentres(fsa: string, ageGroup: string): { exact: CentreResult[]; nearby: CentreResult[] };
  logSearch(fsa: string, ageGroup: string): void;
  listCentres(): Centre[];
  createSubmission(data: InsertSubmission): Submission;
  createReport(data: InsertReport): Report;
  getProviderByLogin(email: string, password: string): Provider | undefined;
  getProvider(id: number): Provider | undefined;
  getDashboard(centreId: number): ProviderDashboard | undefined;
  setVacancy(centreId: number, vacancy: boolean): Centre | undefined;
  listSubmissions(): Submission[];
  listReports(): (Report & { targetLabel: string })[];
  deleteSubmission(id: number): void;
  deleteReport(id: number): void;
  listAllCentres(): Centre[];
  createCentre(data: InsertCentre): Centre;
  deleteCentre(id: number): void;
  listProviders(): ProviderListItem[];
  createProvider(email: string, centreId: number, password: string): Provider;
  setProviderPassword(id: number, password: string): void;
  deleteProvider(id: number): void;
  getDemoProvider(): Provider | undefined;
  clearSampleData(): void;
}

export class DatabaseStorage implements IStorage {
  private buildResults(list: Centre[], ageGroup: string): CentreResult[] {
    if (list.length === 0) return [];
    const ids = list.map((c) => c.id);
    const subs = db.select().from(submissions)
      .where(and(inArray(submissions.centreId, ids), eq(submissions.ageGroup, ageGroup)))
      .orderBy(desc(submissions.createdAt)).all();
    return list
      .map((c) => {
        const agesList = JSON.parse(c.ages) as string[];
        const mine = subs.filter((s) => s.centreId === c.id);
        return {
          ...c,
          agesList,
          estimate: estimateFrom(mine.map((s) => s.waitBucket)),
          recentSubmissions: mine.slice(0, 5).map((s) => ({ id: s.id, waitBucket: s.waitBucket, createdAt: s.createdAt })),
        };
      })
      .filter((c) => c.agesList.includes(ageGroup))
      .sort((a, b) => Number(b.vacancy) - Number(a.vacancy) || a.estimate.level - b.estimate.level || a.name.localeCompare(b.name));
  }

  searchCentres(fsa: string, ageGroup: string) {
    const exact = db.select().from(centres).where(and(eq(centres.fsa, fsa), eq(centres.hidden, false))).all();
    let nearby: Centre[] = [];
    if (exact.length < 3) {
      nearby = db.select().from(centres).where(and(like(centres.fsa, `${fsa.slice(0, 2)}%`), eq(centres.hidden, false))).all().filter((c) => c.fsa !== fsa).slice(0, 6);
    }
    return { exact: this.buildResults(exact, ageGroup), nearby: this.buildResults(nearby, ageGroup) };
  }

  logSearch(fsa: string, ageGroup: string) {
    db.insert(searches).values({ fsa, ageGroup, createdAt: Date.now() }).run();
  }

  listCentres() {
    return db.select().from(centres).where(eq(centres.hidden, false)).orderBy(centres.name).all();
  }

  createSubmission(data: InsertSubmission) {
    let centreName = data.centreName ?? null;
    if (data.centreId) {
      const c = db.select().from(centres).where(eq(centres.id, data.centreId)).get();
      centreName = c?.name ?? centreName;
    }
    return db.insert(submissions).values({
      postalCode: data.postalCode,
      fsa: normalizeFsa(data.postalCode),
      ageGroup: data.ageGroup,
      centreId: data.centreId ?? null,
      centreName,
      waitBucket: data.waitBucket,
      createdAt: Date.now(),
    }).returning().get();
  }

  createReport(data: InsertReport) {
    return db.insert(reports).values({ ...data, details: data.details ?? null, createdAt: Date.now() }).returning().get();
  }

  getProviderByLogin(email: string, password: string) {
    const p = db.select().from(providers).where(eq(providers.email, email.trim().toLowerCase())).get();
    if (!p || !verifyPassword(password, p.password)) return undefined;
    if (!p.password.startsWith("scrypt$")) this.setProviderPassword(p.id, password); // upgrade legacy
    return p;
  }

  getProvider(id: number) {
    return db.select().from(providers).where(eq(providers.id, id)).get();
  }

  getDashboard(centreId: number): ProviderDashboard | undefined {
    const centre = db.select().from(centres).where(eq(centres.id, centreId)).get();
    if (!centre) return undefined;
    const since = Date.now() - 30 * DAY;
    const recent = db.select().from(searches)
      .where(and(eq(searches.fsa, centre.fsa), gte(searches.createdAt, since)))
      .orderBy(desc(searches.createdAt)).all();
    const searchesByAge: Record<string, number> = {};
    for (const a of AGE_GROUPS) searchesByAge[a] = recent.filter((s) => s.ageGroup === a).length;
    const subs = db.select().from(submissions).where(eq(submissions.centreId, centreId)).all();
    const waitlistedByAge: Record<string, number> = {};
    for (const a of AGE_GROUPS) waitlistedByAge[a] = subs.filter((s) => s.ageGroup === a).length;
    return {
      centre,
      fsa: centre.fsa,
      totalSearches30d: recent.length,
      searchesByAge,
      recentSearches: recent.slice(0, 8).map((s) => ({ id: s.id, ageGroup: s.ageGroup, createdAt: s.createdAt })),
      waitlistedCount: subs.length,
      waitlistedByAge,
      estimate: estimateFrom(subs.map((s) => s.waitBucket)),
    };
  }

  setVacancy(centreId: number, vacancy: boolean) {
    return db.update(centres).set({ vacancy }).where(eq(centres.id, centreId)).returning().get();
  }

  listSubmissions() {
    return db.select().from(submissions).orderBy(desc(submissions.createdAt)).all();
  }

  listReports() {
    const all = db.select().from(reports).orderBy(desc(reports.createdAt)).all();
    return all.map((r) => {
      let targetLabel = `#${r.targetId}`;
      if (r.kind === "centre") {
        targetLabel = db.select().from(centres).where(eq(centres.id, r.targetId)).get()?.name ?? `Centre #${r.targetId} (removed)`;
      } else {
        const s = db.select().from(submissions).where(eq(submissions.id, r.targetId)).get();
        targetLabel = s ? `${s.waitBucket} · ${s.ageGroup} · ${s.centreName ?? "No centre"}` : `Submission #${r.targetId} (deleted)`;
      }
      return { ...r, targetLabel };
    });
  }

  deleteSubmission(id: number) {
    db.delete(submissions).where(eq(submissions.id, id)).run();
  }

  deleteReport(id: number) {
    db.delete(reports).where(eq(reports.id, id)).run();
  }

  listAllCentres() {
    return db.select().from(centres).orderBy(centres.name).all();
  }

  createCentre(data: InsertCentre) {
    return db.insert(centres).values({
      name: data.name, fsa: normalizeFsa(data.postalCode), neighbourhood: data.neighbourhood,
      ages: JSON.stringify(data.ages), capacity: data.capacity, vacancy: false, isSample: false, hidden: data.hidden,
    }).returning().get();
  }

  deleteCentre(id: number) {
    sqlite.transaction(() => {
      db.delete(providers).where(eq(providers.centreId, id)).run();
      db.delete(submissions).where(eq(submissions.centreId, id)).run();
      db.delete(reports).where(and(eq(reports.kind, "centre"), eq(reports.targetId, id))).run();
      db.delete(centres).where(eq(centres.id, id)).run();
    })();
  }

  listProviders(): ProviderListItem[] {
    const all = db.select().from(providers).orderBy(providers.email).all();
    return all.map((p) => ({
      id: p.id, email: p.email, centreId: p.centreId,
      centreName: db.select().from(centres).where(eq(centres.id, p.centreId)).get()?.name ?? "(centre removed)",
    }));
  }

  createProvider(email: string, centreId: number, password: string) {
    return db.insert(providers).values({ email: email.trim().toLowerCase(), centreId, password: hashPassword(password) }).returning().get();
  }

  setProviderPassword(id: number, password: string) {
    db.update(providers).set({ password: hashPassword(password) }).where(eq(providers.id, id)).run();
  }

  deleteProvider(id: number) {
    db.delete(providers).where(eq(providers.id, id)).run();
  }

  getDemoProvider() {
    const p = db.select().from(providers).where(eq(providers.email, DEMO_EMAIL)).get();
    return p && verifyPassword(DEMO_PASSWORD, p.password) ? p : undefined;
  }

  // Pre-launch reset: removes sample centres, the demo provider, and all test activity
  clearSampleData() {
    sqlite.transaction(() => {
      const ids = db.select().from(centres).where(eq(centres.isSample, true)).all().map((c) => c.id);
      if (ids.length) {
        db.delete(providers).where(inArray(providers.centreId, ids)).run();
        db.delete(centres).where(inArray(centres.id, ids)).run();
      }
      db.delete(providers).where(eq(providers.email, DEMO_EMAIL)).run();
      db.delete(submissions).run();
      db.delete(searches).run();
      db.delete(reports).run();
    })();
  }
}

export const storage = new DatabaseStorage();
