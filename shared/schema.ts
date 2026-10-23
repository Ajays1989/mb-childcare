import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const AGE_GROUPS = ["Infant", "Toddler", "Preschool"] as const;
export const WAIT_BUCKETS = ["Under 3 months", "3–6 months", "6–12 months", "12+ months"] as const;
export const CENTRE_REPORT_REASONS = ["Wait time wrong", "Centre closed", "Other"] as const;

export const centres = sqliteTable("centres", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  fsa: text("fsa").notNull(), // first 3 chars of postal code, e.g. R3C
  neighbourhood: text("neighbourhood").notNull(),
  ages: text("ages").notNull(), // JSON array of AGE_GROUPS
  capacity: integer("capacity").notNull(),
  vacancy: integer("vacancy", { mode: "boolean" }).notNull().default(false),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(true),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false), // test centres (e.g. App Review) never shown to parents
});

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postalCode: text("postal_code").notNull(),
  fsa: text("fsa").notNull(),
  ageGroup: text("age_group").notNull(),
  centreId: integer("centre_id"),
  centreName: text("centre_name"),
  waitBucket: text("wait_bucket").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const searches = sqliteTable("searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fsa: text("fsa").notNull(),
  ageGroup: text("age_group").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(), // "centre" | "submission"
  targetId: integer("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  createdAt: integer("created_at").notNull(),
});

export const providers = sqliteTable("providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  centreId: integer("centre_id").notNull(),
});

const postal = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase().replace(/\s+/g, ""))
  .refine((s) => /^R[0-9][A-Z]([0-9][A-Z][0-9])?$/.test(s), {
    message: "Enter a Manitoba postal code starting with R (e.g. R3C 0V8)",
  });

export const searchQuerySchema = z.object({
  postalCode: postal,
  ageGroup: z.enum(AGE_GROUPS),
});

export const insertSubmissionSchema = z.object({
  postalCode: postal,
  ageGroup: z.enum(AGE_GROUPS),
  centreId: z.number().int().nullable().optional(),
  centreName: z.string().trim().max(120).nullable().optional(),
  waitBucket: z.enum(WAIT_BUCKETS),
});

export const insertReportSchema = z.object({
  kind: z.enum(["centre", "submission"]),
  targetId: z.number().int(),
  reason: z.string().min(1).max(60),
  details: z.string().max(500).nullable().optional(),
});

export const insertCentreSchema = z.object({
  name: z.string().trim().min(2, "Enter the centre name").max(120),
  postalCode: postal,
  neighbourhood: z.string().trim().min(2, "Enter a neighbourhood or town").max(80),
  ages: z.array(z.enum(AGE_GROUPS)).min(1, "Pick at least one age group"),
  capacity: z.number().int().min(1, "Enter licensed spaces").max(1000),
  hidden: z.boolean().default(false),
});

export const insertProviderSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  centreId: z.number().int(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(10, "Use at least 10 characters").max(200),
});

export type InsertCentre = z.infer<typeof insertCentreSchema>;
export type ProviderListItem = { id: number; email: string; centreId: number; centreName: string };

export type Centre = typeof centres.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Search = typeof searches.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type WaitEstimate = {
  label: string | null; // e.g. "6–12 months" or null if not enough data
  level: number; // 0-4 for progress bar
  reportCount: number;
};

export type CentreResult = Centre & {
  agesList: string[];
  estimate: WaitEstimate;
  recentSubmissions: { id: number; waitBucket: string; createdAt: number }[];
};

export type ProviderDashboard = {
  centre: Centre;
  fsa: string;
  totalSearches30d: number;
  searchesByAge: Record<string, number>;
  recentSearches: { id: number; ageGroup: string; createdAt: number }[];
  waitlistedCount: number;
  waitlistedByAge: Record<string, number>;
  estimate: WaitEstimate;
};
