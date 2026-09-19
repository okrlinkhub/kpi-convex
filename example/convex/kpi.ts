import { ConvexError } from "convex/values";
import {
  exposeKpiApi,
  type KpiAuthorizationContext,
  type KpiAuthorizationOperation,
  type KpiViewerContext,
} from "@okrlinkhub/kpi-convex/server";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { env } from "./_generated/server";

type HostContext = KpiAuthorizationContext<DataModel>["ctx"];

async function identity(ctx: HostContext) {
  const value = await ctx.auth.getUserIdentity();
  if (!value && env.KPI_EXAMPLE_ALLOW_ANONYMOUS === "true") {
    return { subject: "local-kpi-preview", role: "admin" };
  }
  if (!value) throw new ConvexError("Unauthenticated");
  return value;
}
async function viewerKey({ ctx }: KpiViewerContext<DataModel>) {
  const viewer = await identity(ctx);
  const bytes = new TextEncoder().encode(`${env.KPI_CONVEX_VIEWER_KEY_SALT}:${viewer.subject}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `viewer_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
async function authorize(
  { ctx }: KpiAuthorizationContext<DataModel>,
  operation: KpiAuthorizationOperation,
) {
  const viewer = await identity(ctx);
  if (operation.type === "admin.refresh" && viewer.role !== "admin") throw new ConvexError("Forbidden");
}

export const { catalogList, catalogGet, getSeries, getLiveDetail, favoritesList, favoriteToggle, savedViewsList, savedViewSave, savedViewRemove, preferencesGet, preferencesSave, dashboardList, dashboardPicker, dashboardGet, dashboardCreate, dashboardToggleFavorite, dashboardRemove, dashboardAddWidget, dashboardAddWidgets, dashboardRemoveWidget, dashboardReorderWidgets, dashboardSetWidgetChartMode, syncStatus, requestRefresh } = exposeKpiApi<DataModel>(components.kpiConvex, { authorize, viewerKey });
