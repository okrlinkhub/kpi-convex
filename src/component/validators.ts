import { v } from "convex/values";

export const pointValidator = v.object({ period: v.string(), value: v.number() });
export const summaryValidator = v.object({
  indicatorKey: v.string(),
  label: v.string(),
  description: v.string(),
  domain: v.string(),
  unit: v.string(),
  grain: v.string(),
  dimensions: v.array(v.string()),
  current: v.union(pointValidator, v.null()),
  previous: v.union(pointValidator, v.null()),
  delta: v.union(v.number(), v.null()),
  deltaPercent: v.union(v.number(), v.null()),
  generatedAt: v.string(),
  releaseVersion: v.string(),
});
export const preferencesValidator = v.object({
  theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
  catalogView: v.union(v.literal("table"), v.literal("cards")),
  density: v.union(v.literal("compact"), v.literal("comfortable")),
  defaultChartMode: v.union(v.literal("line"), v.literal("bar"), v.literal("area"), v.literal("table")),
});
export const errorCodeValidator = v.union(
  v.literal("RELEASE_NOT_FOUND"),
  v.literal("RELEASE_INVALID"),
  v.literal("SCHEMA_INCOMPATIBLE"),
  v.literal("DATA_SOURCE_UNAVAILABLE"),
  v.literal("PROJECTION_FAILED"),
);

export const DEFAULT_PREFERENCES = {
  theme: "system",
  catalogView: "table",
  density: "compact",
  defaultChartMode: "line",
} as const;

export function assertViewerKey(viewerKey: string) {
  if (!/^[A-Za-z0-9:_-]{16,160}$/.test(viewerKey)) throw new Error("Invalid opaque viewer key");
}
