import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import {
  assertViewerKey,
  dashboardSummaryValidator,
  dashboardViewValidator,
  widgetChartModeValidator,
} from "./validators.js";
import { getState } from "./lib.js";
import { cleanDashboardName, dashboardNameKey } from "./dashboardNames.js";

const MAX_DASHBOARDS = 100;
const MAX_WIDGETS = 12;

function dashboardId(ctx: QueryCtx | MutationCtx, value: string) {
  const id = ctx.db.normalizeId("dashboards", value);
  if (!id) throw new Error("Dashboard not found");
  return id;
}

function widgetId(ctx: MutationCtx, value: string) {
  const id = ctx.db.normalizeId("dashboardWidgets", value);
  if (!id) throw new Error("Dashboard widget not found");
  return id;
}

async function activeDashboard(ctx: QueryCtx | MutationCtx, value: string) {
  const row = await ctx.db.get("dashboards", dashboardId(ctx, value));
  if (!row || row.status !== "active") throw new Error("Dashboard not found");
  return row;
}

async function ownedDashboard(
  ctx: MutationCtx,
  value: string,
  viewerKey: string,
) {
  const row = await activeDashboard(ctx, value);
  if (row.ownerViewerKey !== viewerKey)
    throw new Error("Dashboard is not editable by this viewer");
  return row;
}

async function requireIndicator(
  ctx: QueryCtx | MutationCtx,
  indicatorKey: string,
) {
  const state = await getState(ctx);
  if (!state?.activeGenerationId) throw new Error("No active KPI generation");
  const indicator = await ctx.db
    .query("kpiReadModels")
    .withIndex("by_generation_key", (q) =>
      q
        .eq("generationId", state.activeGenerationId!)
        .eq("indicatorKey", indicatorKey),
    )
    .unique();
  if (!indicator) throw new Error(`KPI not found: ${indicatorKey}`);
  return indicator;
}

export const list = query({
  args: { viewerKey: v.string(), indicatorKey: v.optional(v.string()) },
  returns: v.array(dashboardSummaryValidator),
  handler: async (ctx, { viewerKey, indicatorKey }) => {
    assertViewerKey(viewerKey);
    const rows = await ctx.db
      .query("dashboards")
      .withIndex("by_status_updated", (q) => q.eq("status", "active"))
      .order("desc")
      .take(MAX_DASHBOARDS);
    const dashboardState = await Promise.all(
      rows.map(async (row) => {
        const [favorite, matchingWidget] = await Promise.all([
          ctx.db
            .query("dashboardFavorites")
            .withIndex("by_dashboard_viewer", (q) =>
              q.eq("dashboardId", row._id).eq("viewerKey", viewerKey),
            )
            .unique(),
          indicatorKey
            ? ctx.db
                .query("dashboardWidgets")
                .withIndex("by_dashboard_indicator", (q) =>
                  q.eq("dashboardId", row._id).eq("indicatorKey", indicatorKey),
                )
                .unique()
            : null,
        ]);
        return { favorite, containsIndicator: Boolean(matchingWidget) };
      }),
    );
    return rows.map((row, index) => ({
      id: row._id,
      name: row.name,
      description: row.description ?? null,
      widgetCount: row.widgetCount,
      isFavorite: Boolean(dashboardState[index]?.favorite),
      canEdit: row.ownerViewerKey === viewerKey,
      containsIndicator: dashboardState[index]?.containsIndicator ?? false,
      favoriteCount: row.favoriteCount,
      favoritedBy: dashboardState[index]?.favorite
        ? [{ userId: viewerKey, displayName: "Tu", isCurrentUser: true }]
        : [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const picker = query({
  args: {},
  returns: v.array(
    v.object({
      indicatorKey: v.string(),
      label: v.string(),
      domain: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const state = await getState(ctx);
    if (!state?.activeGenerationId) return [];
    const rows = await ctx.db
      .query("kpiReadModels")
      .withIndex("by_generation_key", (q) =>
        q.eq("generationId", state.activeGenerationId!),
      )
      .take(500);
    return rows
      .map(({ indicatorKey, summary }) => ({
        indicatorKey,
        label: summary.label,
        domain: summary.domain,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "it"));
  },
});

export const get = query({
  args: { viewerKey: v.string(), dashboardId: v.string() },
  returns: v.union(dashboardViewValidator, v.null()),
  handler: async (ctx, { viewerKey, dashboardId: rawDashboardId }) => {
    assertViewerKey(viewerKey);
    const normalized = ctx.db.normalizeId("dashboards", rawDashboardId);
    if (!normalized) return null;
    const board = await ctx.db.get("dashboards", normalized);
    if (!board || board.status !== "active") return null;
    const [state, favorite, widgetRows] = await Promise.all([
      getState(ctx),
      ctx.db
        .query("dashboardFavorites")
        .withIndex("by_dashboard_viewer", (q) =>
          q.eq("dashboardId", normalized).eq("viewerKey", viewerKey),
        )
        .unique(),
      ctx.db
        .query("dashboardWidgets")
        .withIndex("by_dashboard_order", (q) => q.eq("dashboardId", normalized))
        .take(MAX_WIDGETS + 1),
    ]);
    const widgets = await Promise.all(
      widgetRows.slice(0, MAX_WIDGETS).map(async (widget) => {
        if (!state?.activeGenerationId) {
          return {
            widgetId: widget._id,
            indicatorKey: widget.indicatorKey,
            sortOrder: widget.sortOrder,
            label: widget.indicatorKey,
            domain: "",
            unit: "",
            current: null,
            previous: null,
            delta: null,
            points: [],
            chartMode: widget.chartMode,
            refreshedAt: null,
            status: "pending" as const,
          };
        }
        const summary = await ctx.db
          .query("kpiReadModels")
          .withIndex("by_generation_key", (q) =>
            q
              .eq("generationId", state.activeGenerationId!)
              .eq("indicatorKey", widget.indicatorKey),
          )
          .unique();
        if (!summary) {
          return {
            widgetId: widget._id,
            indicatorKey: widget.indicatorKey,
            sortOrder: widget.sortOrder,
            label: widget.indicatorKey,
            domain: "",
            unit: "",
            current: null,
            previous: null,
            delta: null,
            points: [],
            chartMode: widget.chartMode,
            refreshedAt: state.lastProjectedAt ?? null,
            status: "missing" as const,
          };
        }
        const points = await ctx.db
          .query("kpiPoints")
          .withIndex("by_generation_kpi_period", (q) =>
            q
              .eq("generationId", state.activeGenerationId!)
              .eq("indicatorKey", widget.indicatorKey),
          )
          .take(120);
        return {
          widgetId: widget._id,
          indicatorKey: widget.indicatorKey,
          sortOrder: widget.sortOrder,
          label: summary.summary.label,
          domain: summary.summary.domain,
          unit: summary.summary.unit,
          current: summary.summary.current,
          previous: summary.summary.previous,
          delta: summary.summary.delta,
          points: points.map((point) => point.point),
          chartMode: widget.chartMode,
          refreshedAt: state.lastProjectedAt ?? null,
          status: "ready" as const,
        };
      }),
    );
    return {
      id: board._id,
      name: board.name,
      description: board.description ?? null,
      isFavorite: Boolean(favorite),
      favoriteCount: board.favoriteCount,
      favoritedBy: favorite
        ? [{ userId: viewerKey, displayName: "Tu", isCurrentUser: true }]
        : [],
      refreshedAt: state?.lastProjectedAt ?? null,
      widgets,
    };
  },
});

export const create = mutation({
  args: {
    viewerKey: v.string(),
    name: v.string(),
    indicatorKeys: v.array(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, { viewerKey, name, indicatorKeys }) => {
    assertViewerKey(viewerKey);
    const displayName = cleanDashboardName(name);
    const normalizedName = dashboardNameKey(name);
    const uniqueKeys = [...new Set(indicatorKeys)];
    if (!displayName || displayName.length > 120)
      throw new Error("Invalid dashboard name");
    if (
      uniqueKeys.length !== indicatorKeys.length ||
      uniqueKeys.length > MAX_WIDGETS
    ) {
      throw new Error(`A dashboard supports up to ${MAX_WIDGETS} unique KPIs`);
    }
    const [exactMatch, activeDashboards] = await Promise.all([
      ctx.db
        .query("dashboards")
        .withIndex("by_status_normalized_name", (q) =>
          q.eq("status", "active").eq("normalizedName", normalizedName),
        )
        .first(),
      ctx.db
        .query("dashboards")
        .withIndex("by_status_updated", (q) => q.eq("status", "active"))
        .take(MAX_DASHBOARDS + 1),
    ]);
    if (
      exactMatch ||
      activeDashboards.some(
        (dashboard) => dashboardNameKey(dashboard.name) === normalizedName,
      )
    ) {
      throw new Error("Esiste già una dashboard con questo nome");
    }
    if (activeDashboards.length >= MAX_DASHBOARDS) {
      throw new Error(
        `The component supports up to ${MAX_DASHBOARDS} active dashboards`,
      );
    }
    for (const indicatorKey of uniqueKeys)
      await requireIndicator(ctx, indicatorKey);
    const now = Date.now();
    const id = await ctx.db.insert("dashboards", {
      ownerViewerKey: viewerKey,
      name: displayName,
      normalizedName,
      status: "active",
      widgetCount: uniqueKeys.length,
      favoriteCount: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("dashboardFavorites", {
      dashboardId: id,
      viewerKey,
      createdAt: now,
    });
    for (const [sortOrder, indicatorKey] of uniqueKeys.entries()) {
      await ctx.db.insert("dashboardWidgets", {
        dashboardId: id,
        indicatorKey,
        sortOrder,
        chartMode: "area",
        createdAt: now,
      });
    }
    return id;
  },
});

export const toggleFavorite = mutation({
  args: { viewerKey: v.string(), dashboardId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { viewerKey, dashboardId: rawDashboardId }) => {
    assertViewerKey(viewerKey);
    const board = await activeDashboard(ctx, rawDashboardId);
    const existing = await ctx.db
      .query("dashboardFavorites")
      .withIndex("by_dashboard_viewer", (q) =>
        q.eq("dashboardId", board._id).eq("viewerKey", viewerKey),
      )
      .unique();
    if (existing) {
      await ctx.db.delete("dashboardFavorites", existing._id);
      await ctx.db.patch("dashboards", board._id, {
        favoriteCount: Math.max(0, board.favoriteCount - 1),
      });
      return false;
    }
    await ctx.db.insert("dashboardFavorites", {
      dashboardId: board._id,
      viewerKey,
      createdAt: Date.now(),
    });
    await ctx.db.patch("dashboards", board._id, {
      favoriteCount: board.favoriteCount + 1,
    });
    return true;
  },
});

export const remove = mutation({
  args: { viewerKey: v.string(), dashboardId: v.string() },
  returns: v.null(),
  handler: async (ctx, { viewerKey, dashboardId: rawDashboardId }) => {
    assertViewerKey(viewerKey);
    const board = await ownedDashboard(ctx, rawDashboardId, viewerKey);
    await ctx.db.patch("dashboards", board._id, {
      status: "deleted",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const addWidget = mutation({
  args: {
    viewerKey: v.string(),
    dashboardId: v.string(),
    indicatorKey: v.string(),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { viewerKey, dashboardId: rawDashboardId, indicatorKey },
  ) => {
    assertViewerKey(viewerKey);
    const board = await ownedDashboard(ctx, rawDashboardId, viewerKey);
    const rows = await ctx.db
      .query("dashboardWidgets")
      .withIndex("by_dashboard_order", (q) => q.eq("dashboardId", board._id))
      .take(MAX_WIDGETS + 1);
    if (rows.some((row) => row.indicatorKey === indicatorKey)) return null;
    if (rows.length >= MAX_WIDGETS)
      throw new Error(`A dashboard supports up to ${MAX_WIDGETS} KPIs`);
    await requireIndicator(ctx, indicatorKey);
    await ctx.db.insert("dashboardWidgets", {
      dashboardId: board._id,
      indicatorKey,
      sortOrder: rows.length,
      chartMode: "area",
      createdAt: Date.now(),
    });
    await ctx.db.patch("dashboards", board._id, {
      widgetCount: rows.length + 1,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const addWidgetToDashboards = mutation({
  args: {
    viewerKey: v.string(),
    dashboardIds: v.array(v.string()),
    indicatorKey: v.string(),
  },
  returns: v.object({
    addedDashboardIds: v.array(v.string()),
    alreadyPresentDashboardIds: v.array(v.string()),
  }),
  handler: async (ctx, { viewerKey, dashboardIds, indicatorKey }) => {
    assertViewerKey(viewerKey);
    const uniqueDashboardIds = [...new Set(dashboardIds)];
    if (uniqueDashboardIds.length !== dashboardIds.length) {
      throw new Error("Each dashboard must be selected only once");
    }
    if (
      uniqueDashboardIds.length === 0 ||
      uniqueDashboardIds.length > MAX_DASHBOARDS
    ) {
      throw new Error(`Select between 1 and ${MAX_DASHBOARDS} dashboards`);
    }
    await requireIndicator(ctx, indicatorKey);
    const addedDashboardIds: string[] = [];
    const alreadyPresentDashboardIds: string[] = [];
    for (const rawDashboardId of uniqueDashboardIds) {
      const board = await ownedDashboard(ctx, rawDashboardId, viewerKey);
      const rows = await ctx.db
        .query("dashboardWidgets")
        .withIndex("by_dashboard_order", (q) => q.eq("dashboardId", board._id))
        .take(MAX_WIDGETS + 1);
      if (rows.some((row) => row.indicatorKey === indicatorKey)) {
        alreadyPresentDashboardIds.push(rawDashboardId);
        continue;
      }
      if (rows.length >= MAX_WIDGETS) {
        throw new Error(
          `Dashboard ${board.name} supports up to ${MAX_WIDGETS} KPIs`,
        );
      }
      const now = Date.now();
      await ctx.db.insert("dashboardWidgets", {
        dashboardId: board._id,
        indicatorKey,
        sortOrder: rows.length,
        chartMode: "area",
        createdAt: now,
      });
      await ctx.db.patch("dashboards", board._id, {
        widgetCount: rows.length + 1,
        updatedAt: now,
      });
      addedDashboardIds.push(rawDashboardId);
    }
    return { addedDashboardIds, alreadyPresentDashboardIds };
  },
});

export const removeWidget = mutation({
  args: {
    viewerKey: v.string(),
    dashboardId: v.string(),
    widgetId: v.string(),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { viewerKey, dashboardId: rawDashboardId, widgetId: rawWidgetId },
  ) => {
    assertViewerKey(viewerKey);
    const board = await ownedDashboard(ctx, rawDashboardId, viewerKey);
    const widget = await ctx.db.get(
      "dashboardWidgets",
      widgetId(ctx, rawWidgetId),
    );
    if (!widget || widget.dashboardId !== board._id)
      throw new Error("Dashboard widget not found");
    await ctx.db.delete("dashboardWidgets", widget._id);
    await ctx.db.patch("dashboards", board._id, {
      widgetCount: Math.max(0, board.widgetCount - 1),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const reorderWidgets = mutation({
  args: {
    viewerKey: v.string(),
    dashboardId: v.string(),
    widgetIds: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { viewerKey, dashboardId: rawDashboardId, widgetIds },
  ) => {
    assertViewerKey(viewerKey);
    const board = await ownedDashboard(ctx, rawDashboardId, viewerKey);
    const rows = await ctx.db
      .query("dashboardWidgets")
      .withIndex("by_dashboard_order", (q) => q.eq("dashboardId", board._id))
      .take(MAX_WIDGETS + 1);
    const expected = new Set(rows.map((row) => String(row._id)));
    if (
      widgetIds.length !== rows.length ||
      new Set(widgetIds).size !== rows.length ||
      widgetIds.some((id) => !expected.has(id))
    ) {
      throw new Error(
        "Widget order must contain every dashboard widget exactly once",
      );
    }
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    for (const [sortOrder, id] of widgetIds.entries()) {
      const row = byId.get(id)!;
      if (row.sortOrder !== sortOrder)
        await ctx.db.patch("dashboardWidgets", row._id, { sortOrder });
    }
    await ctx.db.patch("dashboards", board._id, { updatedAt: Date.now() });
    return null;
  },
});

export const setWidgetChartMode = mutation({
  args: {
    viewerKey: v.string(),
    dashboardId: v.string(),
    widgetId: v.string(),
    mode: widgetChartModeValidator,
  },
  returns: v.null(),
  handler: async (
    ctx,
    { viewerKey, dashboardId: rawDashboardId, widgetId: rawWidgetId, mode },
  ) => {
    assertViewerKey(viewerKey);
    const board = await ownedDashboard(ctx, rawDashboardId, viewerKey);
    const widget = await ctx.db.get(
      "dashboardWidgets",
      widgetId(ctx, rawWidgetId),
    );
    if (!widget || widget.dashboardId !== board._id)
      throw new Error("Dashboard widget not found");
    await ctx.db.patch("dashboardWidgets", widget._id, { chartMode: mode });
    await ctx.db.patch("dashboards", board._id, { updatedAt: Date.now() });
    return null;
  },
});
