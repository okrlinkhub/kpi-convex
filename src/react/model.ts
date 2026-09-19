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
  canEdit: boolean;
  containsIndicator: boolean;
  favoriteCount: number;
  favoritedBy: DashboardFavoritePerson[];
  createdAt: number;
  updatedAt: number;
};

export type DashboardBatchAddResult = {
  addedDashboardIds: string[];
  alreadyPresentDashboardIds: string[];
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
