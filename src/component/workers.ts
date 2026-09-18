import { v } from "convex/values";
import { internalAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { readKpiPoints, projectedPoints } from "./runtime.js";
import type { KpiRuntimeIndicator, KpiSummary } from "../contracts/index.js";

const BATCH_SIZE = 4;

function runtimeIndicator(item: any): KpiRuntimeIndicator {
  return {
    indicatorKey: item.indicatorKey,
    metricKey: item.indicatorKey,
    description: item.description,
    symbol: item.symbol,
    periodicity: item.periodicity,
    isReverse: item.isReverse,
    view: { label: item.label, domain: item.domain, unit: item.unit, valueColumn: item.valueColumn },
    knowledge: { producerNodeId: item.relationName, analysis: { relationNodeId: item.relationName, timeColumn: item.timeColumn, ...(item.tenantColumn ? { tenantColumn: item.tenantColumn } : {}), grain: item.grain, dimensions: item.dimensions } },
    relationName: item.relationName,
  };
}

export const projectBatch = internalAction({
  args: { generationId: v.id("projectionGenerations"), releaseId: v.id("catalogReleases"), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    try {
      const page = await ctx.runQuery(internal.internal.getReleaseItems, { releaseId: args.releaseId, cursor: args.cursor, limit: BATCH_SIZE });
      const rows = await Promise.all(page.page.map(async (item: any) => {
        const points = await readKpiPoints(runtimeIndicator(item), { operation: "latest", limit: projectedPoints() });
        const current = points.at(-1) ?? null;
        const previous = points.at(-2) ?? null;
        const delta = current && previous ? current.value - previous.value : null;
        const summary: KpiSummary = {
          indicatorKey: item.indicatorKey, label: item.label, description: item.description, domain: item.domain, unit: item.unit,
          grain: item.grain, dimensions: item.dimensions.map((dimension: { key: string }) => dimension.key), current, previous, delta,
          deltaPercent: delta !== null && previous?.value ? delta / Math.abs(previous.value) : null,
          generatedAt: new Date().toISOString(), releaseVersion: item.releaseVersion ?? "",
        };
        return { indicatorKey: item.indicatorKey, summary, points };
      }));
      await ctx.runMutation(internal.internal.writeProjectionBatch, { generationId: args.generationId, rows });
      if (page.isDone) await ctx.runMutation(internal.internal.activateGeneration, { generationId: args.generationId });
      else await ctx.scheduler.runAfter(0, internal.workers.projectBatch, { generationId: args.generationId, releaseId: args.releaseId, cursor: page.continueCursor });
    } catch (error) {
      await ctx.runMutation(internal.internal.failGeneration, { generationId: args.generationId, message: error instanceof Error ? error.message : "Unknown projection failure" });
      throw error;
    }
  },
});
