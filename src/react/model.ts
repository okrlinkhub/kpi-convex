import type { KpiPoint, KpiSummary, SyncStatus, ViewerPreferences } from "../contracts/index.js";

export type KpiCatalogSort = "label" | "domain" | "value" | "updated";
export type KpiCatalogView = "table" | "cards";
export type KpiChartMode = "line" | "bar" | "area" | "table";
export type WidgetChartMode = "pie" | "bar" | "area";

export type KpiCatalogState = {
  query: string;
  domain?: string;
  sort: KpiCatalogSort;
  descending: boolean;
  view: KpiCatalogView;
};

export type KpiSavedView = {
  viewKey: string;
  name: string;
  definition: unknown;
  updatedAt: number;
};

export type DashboardFavoritePerson = {
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
};

export type DashboardSummary = {
  id: string;
  name: string;
  description: string | null;
  widgetCount: number;
  isFavorite: boolean;
  favoriteCount: number;
  favoritedBy: DashboardFavoritePerson[];
  createdAt: number;
  updatedAt: number;
};

export type DashboardWidget = {
  widgetId: string;
  indicatorKey: string;
  sortOrder: number;
  label: string;
  domain: string;
  unit: string;
  current: KpiPoint | null;
  previous: KpiPoint | null;
  delta: number | null;
  points: KpiPoint[];
  chartMode: WidgetChartMode;
  refreshedAt: number | null;
  status: "ready" | "pending" | "missing";
};

export type DashboardView = {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  favoriteCount: number;
  favoritedBy: DashboardFavoritePerson[];
  refreshedAt: number | null;
  widgets: DashboardWidget[];
};

export type DashboardPickerItem = Pick<KpiSummary, "indicatorKey" | "label" | "domain">;

export type KpiUiPreferences = ViewerPreferences;
export type KpiUiSyncStatus = SyncStatus;

export function formatKpiValue(point: KpiPoint | null, unit: string) {
  if (!point) return "—";
  const value = point.value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
  return unit ? `${value} ${unit}` : value;
}

export function formatKpiDate(value: string | number | null) {
  return value === null ? "—" : new Date(value).toLocaleDateString("it-IT");
}

export function parseSavedView(value: unknown): KpiCatalogState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.query !== "string" || typeof item.descending !== "boolean") return null;
  if (item.sort !== "label" && item.sort !== "domain" && item.sort !== "value" && item.sort !== "updated") return null;
  if (item.view !== "table" && item.view !== "cards") return null;
  if (item.domain !== undefined && typeof item.domain !== "string") return null;
  return {
    query: item.query,
    ...(item.domain ? { domain: item.domain } : {}),
    sort: item.sort,
    descending: item.descending,
    view: item.view,
  };
}
