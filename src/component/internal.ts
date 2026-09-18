import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server.js";
import { ensureState, getState } from "./lib.js";
import { errorCodeValidator, pointValidator } from "./validators.js";

const catalogItemArgs = {
  indicatorKey: v.string(), label: v.string(), description: v.string(), domain: v.string(), unit: v.string(), symbol: v.string(),
  periodicity: v.string(), isReverse: v.boolean(), grain: v.string(), relationName: v.string(), valueColumn: v.string(), timeColumn: v.string(),
  tenantColumn: v.optional(v.string()), dimensionsJson: v.string(),
};

export const getRuntimeState = internalQuery({
  args: {},
  handler: async (ctx) => await getState(ctx),
});

export const getReleaseItems = internalQuery({
  args: { releaseId: v.id("catalogReleases"), cursor: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, args) => {
    const limit = Math.min(20, Math.max(1, Math.trunc(args.limit)));
    const items = await ctx.db.query("catalogItems").withIndex("by_release_key", (q) => {
      const release = q.eq("releaseId", args.releaseId);
      return args.cursor ? release.gt("indicatorKey", args.cursor) : release;
    }).take(limit + 1);
    const page = items.slice(0, limit);
    const release = await ctx.db.get("catalogReleases", args.releaseId);
    return {
      page: page.map((item) => ({ ...item, releaseVersion: release?.releaseVersion ?? "", dimensions: JSON.parse(item.dimensionsJson) })),
      isDone: items.length <= limit,
      continueCursor: page.at(-1)?.indicatorKey ?? args.cursor ?? "",
    };
  },
});

export const getCatalogItem = internalQuery({
  args: { releaseId: v.id("catalogReleases"), indicatorKey: v.string() },
  handler: async (ctx, args) => await ctx.db.query("catalogItems").withIndex("by_release_key", (q) => q.eq("releaseId", args.releaseId).eq("indicatorKey", args.indicatorKey)).unique(),
});

export const getGeneration = internalQuery({
  args: { generationId: v.id("projectionGenerations") },
  handler: async (ctx, { generationId }) => await ctx.db.get("projectionGenerations", generationId),
});

export const beginCandidate = internalMutation({
  args: { releaseVersion: v.string(), generatedAt: v.string(), fingerprint: v.string(), indicatorCount: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("catalogReleases").withIndex("by_version", (q) => q.eq("releaseVersion", args.releaseVersion)).unique();
    if (existing) return existing._id;
    return await ctx.db.insert("catalogReleases", { ...args, status: "candidate", importedAt: Date.now() });
  },
});

export const writeCatalogBatch = internalMutation({
  args: { releaseId: v.id("catalogReleases"), items: v.array(v.object(catalogItemArgs)) },
  handler: async (ctx, { releaseId, items }) => {
    for (const item of items) {
      const existing = await ctx.db.query("catalogItems").withIndex("by_release_key", (q) => q.eq("releaseId", releaseId).eq("indicatorKey", item.indicatorKey)).unique();
      if (!existing) await ctx.db.insert("catalogItems", { releaseId, ...item });
    }
  },
});

export const finishCandidate = internalMutation({
  args: { releaseId: v.id("catalogReleases"), fingerprint: v.string() },
  handler: async (ctx, { releaseId, fingerprint }) => {
    const state = await ensureState(ctx);
    await ctx.db.patch("componentState", state._id, { candidateReleaseId: releaseId, pointerFingerprint: fingerprint, lastCheckedAt: Date.now(), lastErrorCode: undefined, lastErrorMessage: undefined });
  },
});

export const markSyncError = internalMutation({
  args: { code: errorCodeValidator, message: v.string() },
  handler: async (ctx, args) => {
    const state = await ensureState(ctx);
    await ctx.db.patch("componentState", state._id, { lastCheckedAt: Date.now(), lastErrorCode: args.code, lastErrorMessage: args.message.slice(0, 500) });
  },
});

export const markChecked = internalMutation({
  args: {},
  handler: async (ctx) => {
    const state = await ensureState(ctx);
    await ctx.db.patch("componentState", state._id, { lastCheckedAt: Date.now() });
  },
});

export const acceptCallback = internalMutation({
  args: { eventId: v.string(), sourceRunId: v.string(), releaseVersion: v.string() },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db.query("processedCallbacks").withIndex("by_event", (q) => q.eq("eventId", args.eventId)).unique();
    if (duplicate) return { duplicate: true as const, generationId: null, releaseId: null };
    const state = await ensureState(ctx);
    if (!state.candidateReleaseId) throw new Error("RELEASE_NOT_FOUND: no verified candidate release");
    const release = await ctx.db.get("catalogReleases", state.candidateReleaseId);
    if (!release || release.releaseVersion !== args.releaseVersion) throw new Error("RELEASE_NOT_FOUND: callback release does not match candidate");
    const existing = await ctx.db.query("projectionGenerations").withIndex("by_source_run", (q) => q.eq("sourceRunId", args.sourceRunId)).unique();
    await ctx.db.insert("processedCallbacks", { eventId: args.eventId, sourceRunId: args.sourceRunId, receivedAt: Date.now() });
    if (existing) return { duplicate: true as const, generationId: existing._id, releaseId: existing.releaseId };
    const generationId = await ctx.db.insert("projectionGenerations", { sourceRunId: args.sourceRunId, releaseId: release._id, releaseVersion: release.releaseVersion, status: "building", totalKpis: release.indicatorCount, completedKpis: 0, createdAt: Date.now() });
    await ctx.db.patch("componentState", state._id, { lastErrorCode: undefined, lastErrorMessage: undefined });
    return { duplicate: false as const, generationId, releaseId: release._id };
  },
});

export const writeProjectionBatch = internalMutation({
  args: { generationId: v.id("projectionGenerations"), rows: v.array(v.object({ indicatorKey: v.string(), summary: v.any(), points: v.array(pointValidator) })) },
  handler: async (ctx, { generationId, rows }) => {
    const generation = await ctx.db.get("projectionGenerations", generationId);
    if (!generation || generation.status !== "building") return;
    let inserted = 0;
    for (const row of rows) {
      const existing = await ctx.db.query("kpiReadModels").withIndex("by_generation_key", (q) => q.eq("generationId", generationId).eq("indicatorKey", row.indicatorKey)).unique();
      if (existing) continue;
      await ctx.db.insert("kpiReadModels", { generationId, indicatorKey: row.indicatorKey, domain: row.summary.domain, searchText: `${row.summary.label} ${row.summary.description} ${row.summary.domain}`.toLowerCase(), summary: row.summary });
      for (const point of row.points) await ctx.db.insert("kpiPoints", { generationId, indicatorKey: row.indicatorKey, point });
      inserted += 1;
    }
    await ctx.db.patch("projectionGenerations", generationId, { completedKpis: generation.completedKpis + inserted });
  },
});

export const activateGeneration = internalMutation({
  args: { generationId: v.id("projectionGenerations") },
  handler: async (ctx, { generationId }) => {
    const generation = await ctx.db.get("projectionGenerations", generationId);
    if (!generation || generation.status !== "building" || generation.completedKpis !== generation.totalKpis) throw new Error("Projection is incomplete");
    const state = await ensureState(ctx);
    const oldActive = state.activeGenerationId;
    await ctx.db.patch("projectionGenerations", generationId, { status: "complete", completedAt: Date.now() });
    await ctx.db.patch("catalogReleases", generation.releaseId, { status: "active" });
    if (oldActive) {
      const old = await ctx.db.get("projectionGenerations", oldActive);
      if (old) await ctx.db.patch("catalogReleases", old.releaseId, { status: "previous" });
    }
    await ctx.db.patch("componentState", state._id, { activeGenerationId: generationId, previousGenerationId: oldActive, candidateReleaseId: undefined, lastProjectedAt: Date.now(), lastErrorCode: undefined, lastErrorMessage: undefined });
  },
});

export const failGeneration = internalMutation({
  args: { generationId: v.id("projectionGenerations"), message: v.string() },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get("projectionGenerations", args.generationId);
    if (generation?.status === "building") await ctx.db.patch("projectionGenerations", args.generationId, { status: "failed", errorMessage: args.message.slice(0, 500) });
    const state = await ensureState(ctx);
    await ctx.db.patch("componentState", state._id, { lastErrorCode: "PROJECTION_FAILED", lastErrorMessage: args.message.slice(0, 500) });
  },
});

export const sweepOneOldGeneration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const state = await ensureState(ctx);
    const protectedIds = new Set([state.activeGenerationId, state.previousGenerationId].filter(Boolean).map(String));
    const candidates = await ctx.db.query("projectionGenerations").withIndex("by_status_created", (q) => q.eq("status", "complete")).order("asc").take(10);
    const generation = candidates.find((item) => !protectedIds.has(String(item._id))) ?? (await ctx.db.query("projectionGenerations").withIndex("by_status_created", (q) => q.eq("status", "failed")).order("asc").first());
    if (!generation) return false;
    const readModels = await ctx.db.query("kpiReadModels").withIndex("by_generation_key", (q) => q.eq("generationId", generation._id)).take(100);
    const points = await ctx.db.query("kpiPoints").withIndex("by_generation_kpi_period", (q) => q.eq("generationId", generation._id)).take(100);
    for (const row of readModels) await ctx.db.delete("kpiReadModels", row._id);
    for (const row of points) await ctx.db.delete("kpiPoints", row._id);
    if (readModels.length === 0 && points.length === 0) await ctx.db.delete("projectionGenerations", generation._id);
    return true;
  },
});
