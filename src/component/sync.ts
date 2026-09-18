import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { getState } from "./lib.js";
import { errorCodeValidator } from "./validators.js";

export const getStatus = query({
  args: {},
  returns: v.object({ state: v.union(v.literal("empty"), v.literal("ready"), v.literal("degraded"), v.literal("projecting")), releaseVersion: v.union(v.string(), v.null()), sourceRunId: v.union(v.string(), v.null()), lastCheckedAt: v.union(v.number(), v.null()), lastProjectedAt: v.union(v.number(), v.null()), errorCode: v.union(errorCodeValidator, v.null()) }),
  handler: async (ctx) => {
    const state = await getState(ctx);
    const generation = state?.activeGenerationId ? await ctx.db.get("projectionGenerations", state.activeGenerationId) : null;
    const building = await ctx.db.query("projectionGenerations").withIndex("by_status_created", (q) => q.eq("status", "building")).first();
    return { state: building ? "projecting" as const : state?.lastErrorCode ? "degraded" as const : generation ? "ready" as const : "empty" as const, releaseVersion: generation?.releaseVersion ?? null, sourceRunId: generation?.sourceRunId ?? null, lastCheckedAt: state?.lastCheckedAt ?? null, lastProjectedAt: state?.lastProjectedAt ?? null, errorCode: state?.lastErrorCode ?? null };
  },
});
