import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import { randomBytes } from "node:crypto";
import { storage, normalizeFsa, generatePassword, DEMO_EMAIL, DEMO_PASSWORD } from "./storage";
import {
  searchQuerySchema, insertSubmissionSchema, insertReportSchema,
  insertCentreSchema, insertProviderSchema, changePasswordSchema,
} from "@shared/schema";
import { z } from "zod";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "manitoba-admin";
if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === "production") {
  console.warn("WARNING: ADMIN_PASSWORD is not set. Using the demo password. Set it before launch.");
}
const providerSessions = new Map<string, number>(); // token -> providerId
const adminSessions = new Set<string>();

// Simple brute-force protection: 10 failed sign-ins per IP per 15 minutes
const failures = new Map<string, { n: number; until: number }>();
function tooManyAttempts(req: Request) {
  const f = failures.get(req.ip ?? "?");
  return !!f && f.n >= 10 && f.until > Date.now();
}
function recordFailure(req: Request) {
  const key = req.ip ?? "?";
  const f = failures.get(key);
  const fresh = !f || f.until < Date.now();
  failures.set(key, { n: fresh ? 1 : f!.n + 1, until: Date.now() + 15 * 60 * 1000 });
}
function endSessionsFor(providerId: number) {
  for (const [t, id] of Array.from(providerSessions.entries())) if (id === providerId) providerSessions.delete(t);
}

function bearer(req: Request) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

function requireProvider(req: Request, res: Response, next: NextFunction) {
  const pid = providerSessions.get(bearer(req));
  if (!pid) return res.status(401).json({ message: "Please sign in" });
  (req as any).providerId = pid;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!adminSessions.has(bearer(req))) return res.status(401).json({ message: "Admin sign-in required" });
  next();
}

function badRequest(res: Response, err: z.ZodError) {
  return res.status(400).json({ message: err.issues[0]?.message ?? "Invalid input" });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ---------- Parent (public) ----------
  app.get("/api/search", (req, res) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) return badRequest(res, parsed.error);
    const fsa = normalizeFsa(parsed.data.postalCode);
    storage.logSearch(fsa, parsed.data.ageGroup);
    res.json({ fsa, ageGroup: parsed.data.ageGroup, ...storage.searchCentres(fsa, parsed.data.ageGroup) });
  });

  app.get("/api/centres", (_req, res) => {
    res.json(storage.listCentres().map((c) => ({ id: c.id, name: c.name, fsa: c.fsa })));
  });

  app.post("/api/submissions", (req, res) => {
    const parsed = insertSubmissionSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const s = storage.createSubmission(parsed.data);
    res.status(201).json({ id: s.id });
  });

  app.post("/api/reports", (req, res) => {
    const parsed = insertReportSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const r = storage.createReport(parsed.data);
    res.status(201).json({ id: r.id });
  });

  // ---------- Provider ----------
  app.post("/api/provider/login", (req, res) => {
    const parsed = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Enter your password") }).safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    if (tooManyAttempts(req)) return res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
    const p = storage.getProviderByLogin(parsed.data.email, parsed.data.password);
    if (!p) { recordFailure(req); return res.status(401).json({ message: "Email or password is incorrect" }); }
    const token = randomBytes(24).toString("hex");
    providerSessions.set(token, p.id);
    res.json({ token, email: p.email });
  });

  // Only reports the demo login while the demo account still exists with its demo password
  app.get("/api/provider/demo", (_req, res) => {
    res.json(storage.getDemoProvider() ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null);
  });

  app.post("/api/provider/password", requireProvider, (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const p = storage.getProvider((req as any).providerId);
    if (!p || !storage.getProviderByLogin(p.email, parsed.data.currentPassword)) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    storage.setProviderPassword(p.id, parsed.data.newPassword);
    res.json({ ok: true });
  });

  app.post("/api/provider/logout", (req, res) => {
    providerSessions.delete(bearer(req));
    res.json({ ok: true });
  });

  app.get("/api/provider/dashboard", requireProvider, (req, res) => {
    const p = storage.getProvider((req as any).providerId);
    const d = p && storage.getDashboard(p.centreId);
    if (!d) return res.status(404).json({ message: "Centre not found" });
    res.json(d);
  });

  app.patch("/api/provider/vacancy", requireProvider, (req, res) => {
    const parsed = z.object({ vacancy: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const p = storage.getProvider((req as any).providerId)!;
    res.json(storage.setVacancy(p.centreId, parsed.data.vacancy));
  });

  // ---------- Admin moderation ----------
  app.post("/api/admin/login", (req, res) => {
    if (tooManyAttempts(req)) return res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
    if (req.body?.password !== ADMIN_PASSWORD) { recordFailure(req); return res.status(401).json({ message: "Incorrect password" }); }
    const token = randomBytes(24).toString("hex");
    adminSessions.add(token);
    res.json({ token });
  });

  app.get("/api/admin/submissions", requireAdmin, (_req, res) => res.json(storage.listSubmissions()));
  app.get("/api/admin/reports", requireAdmin, (_req, res) => res.json(storage.listReports()));
  app.delete("/api/admin/submissions/:id", requireAdmin, (req, res) => {
    storage.deleteSubmission(Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete("/api/admin/reports/:id", requireAdmin, (req, res) => {
    storage.deleteReport(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- Admin: centres ----------
  app.get("/api/admin/centres", requireAdmin, (_req, res) => res.json(storage.listAllCentres()));
  app.post("/api/admin/centres", requireAdmin, (req, res) => {
    const parsed = insertCentreSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    res.status(201).json(storage.createCentre(parsed.data));
  });
  app.delete("/api/admin/centres/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    storage.listProviders().filter((p) => p.centreId === id).forEach((p) => endSessionsFor(p.id));
    storage.deleteCentre(id);
    res.json({ ok: true });
  });
  app.post("/api/admin/clear-sample-data", requireAdmin, (_req, res) => {
    storage.clearSampleData();
    providerSessions.clear();
    res.json({ ok: true });
  });

  // ---------- Admin: provider accounts ----------
  app.get("/api/admin/providers", requireAdmin, (_req, res) => res.json(storage.listProviders()));
  app.post("/api/admin/providers", requireAdmin, (req, res) => {
    const parsed = insertProviderSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    if (!storage.listAllCentres().some((c) => c.id === parsed.data.centreId)) return res.status(400).json({ message: "Pick a centre" });
    if (storage.listProviders().some((p) => p.email === parsed.data.email)) return res.status(409).json({ message: "That email already has an account" });
    const tempPassword = generatePassword();
    const p = storage.createProvider(parsed.data.email, parsed.data.centreId, tempPassword);
    res.status(201).json({ id: p.id, email: p.email, tempPassword });
  });
  app.post("/api/admin/providers/:id/reset", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const p = storage.getProvider(id);
    if (!p) return res.status(404).json({ message: "Account not found" });
    const tempPassword = generatePassword();
    storage.setProviderPassword(id, tempPassword);
    endSessionsFor(id);
    res.json({ email: p.email, tempPassword });
  });
  app.delete("/api/admin/providers/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    endSessionsFor(id);
    storage.deleteProvider(id);
    res.json({ ok: true });
  });

  return httpServer;
}
