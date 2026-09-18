import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { errorCodeValidator, pointValidator, preferencesValidator, summaryValidator } from "./validators.js";

export default defineSchema({
  componentState: defineTable({
    key: v.literal("singleton"),
    activeGenerationId: v.optional(v.id("projectionGenerations")),
    previousGenerationId: v.optional(v.id("projectionGenerations")),
    candidateReleaseId: v.optional(v.id("catalogReleases")),
    pointerFingerprint: v.optional(v.string()),
    lastCheckedAt: v.optional(v.number()),
    lastProjectedAt: v.optional(v.number()),
    lastErrorCode: v.optional(errorCodeValidator),
    lastErrorMessage: v.optional(v.string()),
  }).index("by_key", ["key"]),
  catalogReleases: defineTable({
    releaseVersion: v.string(),
    generatedAt: v.string(),
    fingerprint: v.string(),
    status: v.union(v.literal("candidate"), v.literal("active"), v.literal("previous"), v.literal("failed")),
    indicatorCount: v.number(),
    importedAt: v.number(),
  }).index("by_version", ["releaseVersion"]),
  catalogItems: defineTable({
    releaseId: v.id("catalogReleases"),
    indicatorKey: v.string(),
    label: v.string(),
    description: v.string(),
    domain: v.string(),
    unit: v.string(),
    symbol: v.string(),
    periodicity: v.string(),
    isReverse: v.boolean(),
    grain: v.string(),
    relationName: v.string(),
    valueColumn: v.string(),
    timeColumn: v.string(),
    tenantColumn: v.optional(v.string()),
    dimensionsJson: v.string(),
  }).index("by_release_key", ["releaseId", "indicatorKey"]),
  projectionGenerations: defineTable({
    sourceRunId: v.string(),
    releaseId: v.id("catalogReleases"),
    releaseVersion: v.string(),
    status: v.union(v.literal("building"), v.literal("complete"), v.literal("failed")),
    totalKpis: v.number(),
    completedKpis: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index("by_source_run", ["sourceRunId"]).index("by_status_created", ["status", "createdAt"]),
  kpiReadModels: defineTable({
    generationId: v.id("projectionGenerations"),
    indicatorKey: v.string(),
    domain: v.string(),
    searchText: v.string(),
    summary: summaryValidator,
  }).index("by_generation_key", ["generationId", "indicatorKey"]).index("by_generation_domain", ["generationId", "domain"])
    .searchIndex("search", { searchField: "searchText", filterFields: ["generationId", "domain"] }),
  kpiPoints: defineTable({
    generationId: v.id("projectionGenerations"),
    indicatorKey: v.string(),
    point: pointValidator,
  }).index("by_generation_kpi_period", ["generationId", "indicatorKey", "point.period"]),
  processedCallbacks: defineTable({
    eventId: v.string(),
    sourceRunId: v.string(),
    receivedAt: v.number(),
  }).index("by_event", ["eventId"]),
  favorites: defineTable({ viewerKey: v.string(), indicatorKey: v.string(), createdAt: v.number() })
    .index("by_viewer_kpi", ["viewerKey", "indicatorKey"]),
  savedViews: defineTable({ viewerKey: v.string(), viewKey: v.string(), name: v.string(), definitionJson: v.string(), updatedAt: v.number() })
    .index("by_viewer_key", ["viewerKey", "viewKey"]),
  viewerPreferences: defineTable({ viewerKey: v.string(), preferences: preferencesValidator, updatedAt: v.number() })
    .index("by_viewer", ["viewerKey"]),
});
