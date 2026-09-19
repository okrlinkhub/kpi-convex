"use client";
import { createKpiReactBindings } from "@okrlinkhub/kpi-convex/react";
import { api } from "../convex/_generated/api";

const KpiUi = createKpiReactBindings({
  catalogList: api.kpi.catalogList,
  catalogGet: api.kpi.catalogGet,
  getSeries: api.kpi.getSeries,
  getLiveDetail: api.kpi.getLiveDetail,
  favoritesList: api.kpi.favoritesList,
  favoriteToggle: api.kpi.favoriteToggle,
  preferencesGet: api.kpi.preferencesGet,
  preferencesSave: api.kpi.preferencesSave,
  syncStatus: api.kpi.syncStatus,
  dashboardList: api.kpi.dashboardList,
  dashboardPicker: api.kpi.dashboardPicker,
  dashboardGet: api.kpi.dashboardGet,
  dashboardCreate: api.kpi.dashboardCreate,
  dashboardToggleFavorite: api.kpi.dashboardToggleFavorite,
  dashboardRemove: api.kpi.dashboardRemove,
  dashboardAddWidget: api.kpi.dashboardAddWidget,
  dashboardAddWidgets: api.kpi.dashboardAddWidgets,
  dashboardRemoveWidget: api.kpi.dashboardRemoveWidget,
  dashboardReorderWidgets: api.kpi.dashboardReorderWidgets,
  dashboardSetWidgetChartMode: api.kpi.dashboardSetWidgetChartMode,
});
export function ExampleCatalog() {
  return <KpiUi.Catalog eyebrow="COMPLY · PREVIEW LOCALE" getDashboardHref={() => "/dashboards"} />;
}

export function ExampleDetail({ indicatorKey }: { indicatorKey: string }) {
  return <KpiUi.Detail indicatorKey={indicatorKey} />;
}
