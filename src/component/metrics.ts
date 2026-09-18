import { v } from "convex/values";
import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { readKpiPoints } from "./runtime.js";
import type { KpiRuntimeIndicator } from "../contracts/index.js";
import { pointValidator } from "./validators.js";

export const getLiveDetail = action({
  args: { indicatorKey: v.string(), startDate: v.string(), endDate: v.string(), limit: v.optional(v.number()) },
  returns: v.object({ indicatorKey: v.string(), history: v.array(pointValidator), fetchedAt: v.number() }),
  handler: async (ctx, args) => {
    const state = await ctx.runQuery(internal.internal.getRuntimeState, {});
    if (!state?.activeGenerationId) throw new Error("RELEASE_NOT_FOUND: no active KPI generation");
    const generation: any = await ctx.runQuery(internal.internal.getGeneration, { generationId: state.activeGenerationId });
    const item: any = await ctx.runQuery(internal.internal.getCatalogItem, { releaseId: generation.releaseId, indicatorKey: args.indicatorKey });
    if (!item) throw new Error("RELEASE_NOT_FOUND: KPI not present in active release");
    const indicator: KpiRuntimeIndicator = {
      indicatorKey: item.indicatorKey, metricKey: item.indicatorKey, description: item.description, symbol: item.symbol, periodicity: item.periodicity,
      isReverse: item.isReverse, view: { label: item.label, domain: item.domain, unit: item.unit, valueColumn: item.valueColumn }, relationName: item.relationName,
      knowledge: { producerNodeId: item.relationName, analysis: { relationNodeId: item.relationName, timeColumn: item.timeColumn, ...(item.tenantColumn ? { tenantColumn: item.tenantColumn } : {}), grain: item.grain, dimensions: JSON.parse(item.dimensionsJson) } },
    };
    const history = await readKpiPoints(indicator, { operation: "history", startDate: args.startDate, endDate: args.endDate, limit: args.limit ?? 500 });
    return { indicatorKey: args.indicatorKey, history, fetchedAt: Date.now() };
  },
});
