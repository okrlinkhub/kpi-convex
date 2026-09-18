import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import type { Auth } from "convex/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import { preferencesValidator } from "../component/validators.js";

export type KpiAuthorizationOperation =
  | { type: "catalog.read" }
  | { type: "kpi.read"; indicatorKey: string }
  | { type: "viewer.write" }
  | { type: "admin.refresh" };

export function exposeKpiApi(component: ComponentApi, options: {
  authorize: (ctx: { auth: Auth }, operation: KpiAuthorizationOperation) => Promise<void>;
  viewerKey: (ctx: { auth: Auth }) => Promise<string>;
}) {
  return {
    catalogList: queryGeneric({
      args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()), domain: v.optional(v.string()) },
      handler: async (ctx, args) => { await options.authorize(ctx, { type: "catalog.read" }); return await ctx.runQuery(component.catalog.list, args); },
    }),
    catalogGet: queryGeneric({
      args: { indicatorKey: v.string() },
      handler: async (ctx, args) => { await options.authorize(ctx, { type: "kpi.read", indicatorKey: args.indicatorKey }); return await ctx.runQuery(component.catalog.get, args); },
    }),
    getSeries: queryGeneric({
      args: { indicatorKey: v.string() },
      handler: async (ctx, args) => { await options.authorize(ctx, { type: "kpi.read", indicatorKey: args.indicatorKey }); return await ctx.runQuery(component.projections.getSeries, args); },
    }),
    getLiveDetail: actionGeneric({
      args: { indicatorKey: v.string(), startDate: v.string(), endDate: v.string(), limit: v.optional(v.number()) },
      handler: async (ctx, args) => { await options.authorize(ctx, { type: "kpi.read", indicatorKey: args.indicatorKey }); return await ctx.runAction(component.metrics.getLiveDetail, args); },
    }),
    favoritesList: queryGeneric({
      args: {}, handler: async (ctx) => { await options.authorize(ctx, { type: "catalog.read" }); return await ctx.runQuery(component.favorites.list, { viewerKey: await options.viewerKey(ctx) }); },
    }),
    favoriteToggle: mutationGeneric({
      args: { indicatorKey: v.string() }, handler: async (ctx, args) => { await options.authorize(ctx, { type: "viewer.write" }); return await ctx.runMutation(component.favorites.toggle, { ...args, viewerKey: await options.viewerKey(ctx) }); },
    }),
    savedViewsList: queryGeneric({
      args: {}, handler: async (ctx) => { await options.authorize(ctx, { type: "catalog.read" }); return await ctx.runQuery(component.savedViews.list, { viewerKey: await options.viewerKey(ctx) }); },
    }),
    savedViewSave: mutationGeneric({
      args: { viewKey: v.string(), name: v.string(), definition: v.any() }, handler: async (ctx, args) => { await options.authorize(ctx, { type: "viewer.write" }); return await ctx.runMutation(component.savedViews.save, { ...args, viewerKey: await options.viewerKey(ctx) }); },
    }),
    savedViewRemove: mutationGeneric({
      args: { viewKey: v.string() }, handler: async (ctx, args) => { await options.authorize(ctx, { type: "viewer.write" }); return await ctx.runMutation(component.savedViews.remove, { ...args, viewerKey: await options.viewerKey(ctx) }); },
    }),
    preferencesGet: queryGeneric({
      args: {}, handler: async (ctx) => { await options.authorize(ctx, { type: "catalog.read" }); return await ctx.runQuery(component.preferences.get, { viewerKey: await options.viewerKey(ctx) }); },
    }),
    preferencesSave: mutationGeneric({
      args: { preferences: preferencesValidator }, handler: async (ctx, args) => { await options.authorize(ctx, { type: "viewer.write" }); return await ctx.runMutation(component.preferences.save, { ...args, viewerKey: await options.viewerKey(ctx) }); },
    }),
    syncStatus: queryGeneric({ args: {}, handler: async (ctx) => { await options.authorize(ctx, { type: "catalog.read" }); return await ctx.runQuery(component.sync.getStatus, {}); } }),
    requestRefresh: actionGeneric({ args: {}, handler: async (ctx) => { await options.authorize(ctx, { type: "admin.refresh" }); return await ctx.runAction(component.admin.requestRefresh, {}); } }),
  };
}

export type KpiHostApi = ReturnType<typeof exposeKpiApi>;
