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
export const widgetChartModeValidator = v.union(
  v.literal("pie"),
  v.literal("bar"),
  v.literal("area"),
);
export const dashboardFavoritePersonValidator = v.object({
  userId: v.string(),
  displayName: v.string(),
  isCurrentUser: v.boolean(),
});
export const dashboardSummaryValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  widgetCount: v.number(),
  isFavorite: v.boolean(),
  canEdit: v.boolean(),
  containsIndicator: v.boolean(),
  favoriteCount: v.number(),
  favoritedBy: v.array(dashboardFavoritePersonValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export const dashboardWidgetValidator = v.object({
  widgetId: v.string(),
  indicatorKey: v.string(),
  sortOrder: v.number(),
  label: v.string(),
  domain: v.string(),
  unit: v.string(),
  current: v.union(pointValidator, v.null()),
  previous: v.union(pointValidator, v.null()),
  delta: v.union(v.number(), v.null()),
  points: v.array(pointValidator),
  chartMode: widgetChartModeValidator,
  refreshedAt: v.union(v.number(), v.null()),
  status: v.union(v.literal("ready"), v.literal("pending"), v.literal("missing")),
});
export const dashboardViewValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  isFavorite: v.boolean(),
  favoriteCount: v.number(),
  favoritedBy: v.array(dashboardFavoritePersonValidator),
  refreshedAt: v.union(v.number(), v.null()),
  widgets: v.array(dashboardWidgetValidator),
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
