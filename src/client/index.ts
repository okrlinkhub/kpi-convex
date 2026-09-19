import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import { preferencesValidator } from "../component/validators.js";

export type KpiAuthorizationOperation =
  | { type: "catalog.read" }
  | { type: "kpi.read"; indicatorKey: string }
  | { type: "viewer.write" }
  | { type: "dashboard.read"; dashboardId?: string }
  | { type: "dashboard.write"; dashboardId?: string }
  | { type: "admin.refresh" };

export type KpiHostQueryContext<DataModel extends GenericDataModel = GenericDataModel> =
  GenericQueryCtx<DataModel>;
export type KpiHostMutationContext<DataModel extends GenericDataModel = GenericDataModel> =
  GenericMutationCtx<DataModel>;
export type KpiHostActionContext<DataModel extends GenericDataModel = GenericDataModel> =
  GenericActionCtx<DataModel>;

export type KpiAuthorizationContext<
  DataModel extends GenericDataModel = GenericDataModel,
> =
  | { kind: "query"; ctx: KpiHostQueryContext<DataModel> }
  | { kind: "mutation"; ctx: KpiHostMutationContext<DataModel> }
  | { kind: "action"; ctx: KpiHostActionContext<DataModel> };

export type KpiViewerContext<DataModel extends GenericDataModel = GenericDataModel> =
  | { kind: "query"; ctx: KpiHostQueryContext<DataModel> }
  | { kind: "mutation"; ctx: KpiHostMutationContext<DataModel> };

export type KpiHostOptions<DataModel extends GenericDataModel = GenericDataModel> = {
  authorize: (
    context: KpiAuthorizationContext<DataModel>,
    operation: KpiAuthorizationOperation,
  ) => Promise<void>;
  viewerKey: (context: KpiViewerContext<DataModel>) => Promise<string>;
};

export function exposeKpiApi<DataModel extends GenericDataModel = GenericDataModel>(
  component: ComponentApi,
  options: KpiHostOptions<DataModel>,
) {
  const queryContext = (ctx: GenericQueryCtx<GenericDataModel>) => ({
    kind: "query" as const,
    ctx: ctx as unknown as KpiHostQueryContext<DataModel>,
  });
  const mutationContext = (ctx: GenericMutationCtx<GenericDataModel>) => ({
    kind: "mutation" as const,
    ctx: ctx as unknown as KpiHostMutationContext<DataModel>,
  });
  const actionContext = (ctx: GenericActionCtx<GenericDataModel>) => ({
    kind: "action" as const,
    ctx: ctx as unknown as KpiHostActionContext<DataModel>,
  });

  return {
    catalogList: queryGeneric({
      args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()), domain: v.optional(v.string()) },
      handler: async (ctx, args) => {
        await options.authorize(queryContext(ctx), { type: "catalog.read" });
        return await ctx.runQuery(component.catalog.list, args);
      },
    }),
    catalogGet: queryGeneric({
      args: { indicatorKey: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(
          queryContext(ctx),
          { type: "kpi.read", indicatorKey: args.indicatorKey },
        );
        return await ctx.runQuery(component.catalog.get, args);
      },
    }),
    getSeries: queryGeneric({
      args: { indicatorKey: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(
          queryContext(ctx),
          { type: "kpi.read", indicatorKey: args.indicatorKey },
        );
        return await ctx.runQuery(component.projections.getSeries, args);
      },
    }),
    getLiveDetail: actionGeneric({
      args: { indicatorKey: v.string(), startDate: v.string(), endDate: v.string(), limit: v.optional(v.number()) },
      handler: async (ctx, args) => {
        await options.authorize(
          actionContext(ctx),
          { type: "kpi.read", indicatorKey: args.indicatorKey },
        );
        return await ctx.runAction(component.metrics.getLiveDetail, args);
      },
    }),
    favoritesList: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.authorize(queryContext(ctx), { type: "catalog.read" });
        return await ctx.runQuery(component.favorites.list, {
          viewerKey: await options.viewerKey(queryContext(ctx)),
        });
      },
    }),
    favoriteToggle: mutationGeneric({
      args: { indicatorKey: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), { type: "viewer.write" });
        return await ctx.runMutation(component.favorites.toggle, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    savedViewsList: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.authorize(queryContext(ctx), { type: "catalog.read" });
        return await ctx.runQuery(component.savedViews.list, {
          viewerKey: await options.viewerKey(queryContext(ctx)),
        });
      },
    }),
    savedViewSave: mutationGeneric({
      args: { viewKey: v.string(), name: v.string(), definition: v.any() },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), { type: "viewer.write" });
        return await ctx.runMutation(component.savedViews.save, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    savedViewRemove: mutationGeneric({
      args: { viewKey: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), { type: "viewer.write" });
        return await ctx.runMutation(component.savedViews.remove, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    preferencesGet: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.authorize(queryContext(ctx), { type: "catalog.read" });
        return await ctx.runQuery(component.preferences.get, {
          viewerKey: await options.viewerKey(queryContext(ctx)),
        });
      },
    }),
    preferencesSave: mutationGeneric({
      args: { preferences: preferencesValidator },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), { type: "viewer.write" });
        return await ctx.runMutation(component.preferences.save, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    dashboardList: queryGeneric({
      args: { indicatorKey: v.optional(v.string()) },
      handler: async (ctx, args) => {
        await options.authorize(queryContext(ctx), { type: "dashboard.read" });
        return await ctx.runQuery(component.dashboards.list, {
          ...args,
          viewerKey: await options.viewerKey(queryContext(ctx)),
        });
      },
    }),
    dashboardPicker: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.authorize(queryContext(ctx), { type: "dashboard.read" });
        return await ctx.runQuery(component.dashboards.picker, {});
      },
    }),
    dashboardGet: queryGeneric({
      args: { dashboardId: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(queryContext(ctx), {
          type: "dashboard.read",
          dashboardId: args.dashboardId,
        });
        return await ctx.runQuery(component.dashboards.get, {
          ...args,
          viewerKey: await options.viewerKey(queryContext(ctx)),
        });
      },
    }),
    dashboardCreate: mutationGeneric({
      args: { name: v.string(), indicatorKeys: v.array(v.string()) },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), { type: "dashboard.write" });
        return await ctx.runMutation(component.dashboards.create, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    dashboardToggleFavorite: mutationGeneric({
      args: { dashboardId: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), {
          type: "dashboard.write",
          dashboardId: args.dashboardId,
        });
        return await ctx.runMutation(component.dashboards.toggleFavorite, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    dashboardRemove: mutationGeneric({
      args: { dashboardId: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), {
          type: "dashboard.write",
          dashboardId: args.dashboardId,
        });
        return await ctx.runMutation(component.dashboards.remove, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    dashboardAddWidget: mutationGeneric({
      args: { dashboardId: v.string(), indicatorKey: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), {
          type: "dashboard.write",
          dashboardId: args.dashboardId,
        });
        return await ctx.runMutation(component.dashboards.addWidget, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    dashboardAddWidgets: mutationGeneric({
      args: { dashboardIds: v.array(v.string()), indicatorKey: v.string() },
      handler: async (ctx, args) => {
        for (const dashboardId of args.dashboardIds) {
          await options.authorize(mutationContext(ctx), {
            type: "dashboard.write",
            dashboardId,
          });
        }
        return await ctx.runMutation(component.dashboards.addWidgetToDashboards, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    dashboardRemoveWidget: mutationGeneric({
      args: { dashboardId: v.string(), widgetId: v.string() },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), {
          type: "dashboard.write",
          dashboardId: args.dashboardId,
        });
        return await ctx.runMutation(component.dashboards.removeWidget, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    dashboardReorderWidgets: mutationGeneric({
      args: { dashboardId: v.string(), widgetIds: v.array(v.string()) },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), {
          type: "dashboard.write",
          dashboardId: args.dashboardId,
        });
        return await ctx.runMutation(component.dashboards.reorderWidgets, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    dashboardSetWidgetChartMode: mutationGeneric({
      args: {
        dashboardId: v.string(),
        widgetId: v.string(),
        mode: v.union(v.literal("pie"), v.literal("bar"), v.literal("area")),
      },
      handler: async (ctx, args) => {
        await options.authorize(mutationContext(ctx), {
          type: "dashboard.write",
          dashboardId: args.dashboardId,
        });
        return await ctx.runMutation(component.dashboards.setWidgetChartMode, {
          ...args,
          viewerKey: await options.viewerKey(mutationContext(ctx)),
        });
      },
    }),
    syncStatus: queryGeneric({
      args: {},
      handler: async (ctx) => {
        await options.authorize(queryContext(ctx), { type: "catalog.read" });
        return await ctx.runQuery(component.sync.getStatus, {});
      },
    }),
    requestRefresh: actionGeneric({
      args: {},
      handler: async (ctx) => {
        await options.authorize(actionContext(ctx), { type: "admin.refresh" });
        return await ctx.runAction(component.admin.requestRefresh, {});
      },
    }),
  };
}

export type KpiHostApi = ReturnType<typeof exposeKpiApi>;
