import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { getState } from "./lib.js";
import { pointValidator } from "./validators.js";

export const getSeries = query({
  args: { indicatorKey: v.string() },
  returns: v.array(pointValidator),
  handler: async (ctx, { indicatorKey }) => {
    const state = await getState(ctx);
    if (!state?.activeGenerationId) return [];
    const rows = await ctx.db.query("kpiPoints").withIndex("by_generation_kpi_period", (q) => q.eq("generationId", state.activeGenerationId!).eq("indicatorKey", indicatorKey)).collect();
    return rows.map((row) => row.point);
  },
});
