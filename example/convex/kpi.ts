import { ConvexError } from "convex/values";
import { exposeKpiApi, type KpiAuthorizationOperation } from "@okrlinkhub/kpi-convex/server";
import { components } from "./_generated/api";
import { env } from "./_generated/server";

async function identity(ctx: { auth: { getUserIdentity(): Promise<{ subject: string; role?: string } | null> } }) {
  const value = await ctx.auth.getUserIdentity();
  if (!value && env.KPI_EXAMPLE_ALLOW_ANONYMOUS === "true") {
    return { subject: "local-kpi-preview", role: "admin" };
  }
  if (!value) throw new ConvexError("Unauthenticated");
  return value;
}
async function viewerKey(ctx: Parameters<typeof identity>[0]) {
  const viewer = await identity(ctx);
  const bytes = new TextEncoder().encode(`${env.KPI_CONVEX_VIEWER_KEY_SALT}:${viewer.subject}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `viewer_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
async function authorize(ctx: Parameters<typeof identity>[0], operation: KpiAuthorizationOperation) {
  const viewer = await identity(ctx);
  if (operation.type === "admin.refresh" && viewer.role !== "admin") throw new ConvexError("Forbidden");
}

export const { catalogList, catalogGet, getSeries, getLiveDetail, favoritesList, favoriteToggle, savedViewsList, savedViewSave, savedViewRemove, preferencesGet, preferencesSave, syncStatus, requestRefresh } = exposeKpiApi(components.kpiConvex, { authorize, viewerKey });
