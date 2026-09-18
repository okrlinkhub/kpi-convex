"use client";
import { createKpiReactBindings } from "@okrlinkhub/kpi-convex/react";
import { useRouter } from "next/navigation";
import { api } from "../convex/_generated/api";

const KpiUi = createKpiReactBindings({
  catalogList: api.kpi.catalogList,
  catalogGet: api.kpi.catalogGet,
  getSeries: api.kpi.getSeries,
  getLiveDetail: api.kpi.getLiveDetail,
  favoritesList: api.kpi.favoritesList,
  favoriteToggle: api.kpi.favoriteToggle,
  savedViewsList: api.kpi.savedViewsList,
  savedViewSave: api.kpi.savedViewSave,
  savedViewRemove: api.kpi.savedViewRemove,
  preferencesGet: api.kpi.preferencesGet,
  preferencesSave: api.kpi.preferencesSave,
  syncStatus: api.kpi.syncStatus,
});
export function ExampleCatalog() {
  const router = useRouter();
  return <KpiUi.Catalog eyebrow="COMPLY · PREVIEW LOCALE" getKpiHref={(indicatorKey) => `/kpi/${encodeURIComponent(indicatorKey)}`} onOpenKpi={(indicatorKey) => router.push(`/kpi/${encodeURIComponent(indicatorKey)}`)} />;
}

export function ExampleDetail({ indicatorKey }: { indicatorKey: string }) {
  return <KpiUi.Detail indicatorKey={indicatorKey} />;
}
