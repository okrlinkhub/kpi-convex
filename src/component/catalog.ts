import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { getState } from "./lib.js";
import { summaryValidator } from "./validators.js";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  returns: v.object({ page: v.array(summaryValidator), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const state = await getState(ctx);
    if (!state?.activeGenerationId) return { page: [], isDone: true, continueCursor: "" };
    const pageSize = Math.min(100, Math.max(1, Math.trunc(args.paginationOpts.numItems)));
    const scanSize = Math.min(500, Math.max(pageSize + 1, pageSize * 10));
    const cursor = args.paginationOpts.cursor;
    const rows = await ctx.db.query("kpiReadModels").withIndex("by_generation_key", (q) => {
      const generation = q.eq("generationId", state.activeGenerationId!);
      return cursor ? generation.gt("indicatorKey", cursor) : generation;
    }).take(scanSize + 1);
    const scanned = rows.slice(0, scanSize);
    const search = args.search?.trim().slice(0, 120).toLowerCase();
    const matches = scanned.filter((item) => (!args.domain || item.domain === args.domain) && (!search || item.searchText.includes(search)));
    const page = matches.slice(0, pageSize);
    const hasBufferedMatch = matches.length > pageSize;
    const hasMoreRows = rows.length > scanSize;
    const isDone = !hasBufferedMatch && !hasMoreRows;
    const continueCursor = hasBufferedMatch
      ? page.at(-1)?.indicatorKey ?? cursor ?? ""
      : scanned.at(-1)?.indicatorKey ?? cursor ?? "";
    return { page: page.map((item) => item.summary), isDone, continueCursor };
  },
});

export const get = query({
  args: { indicatorKey: v.string() },
  returns: v.union(summaryValidator, v.null()),
  handler: async (ctx, { indicatorKey }) => {
    const state = await getState(ctx);
    if (!state?.activeGenerationId) return null;
    return (await ctx.db.query("kpiReadModels").withIndex("by_generation_key", (q) => q.eq("generationId", state.activeGenerationId!).eq("indicatorKey", indicatorKey)).unique())?.summary ?? null;
  },
});
