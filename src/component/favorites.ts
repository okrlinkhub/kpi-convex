import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { assertViewerKey } from "./validators.js";

export const list = query({
  args: { viewerKey: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, { viewerKey }) => {
    assertViewerKey(viewerKey);
    return (await ctx.db.query("favorites").withIndex("by_viewer_kpi", (q) => q.eq("viewerKey", viewerKey)).collect()).map((item) => item.indicatorKey);
  },
});

export const toggle = mutation({
  args: { viewerKey: v.string(), indicatorKey: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { viewerKey, indicatorKey }) => {
    assertViewerKey(viewerKey);
    const existing = await ctx.db.query("favorites").withIndex("by_viewer_kpi", (q) => q.eq("viewerKey", viewerKey).eq("indicatorKey", indicatorKey)).unique();
    if (existing) {
      await ctx.db.delete("favorites", existing._id);
      return false;
    }
    await ctx.db.insert("favorites", { viewerKey, indicatorKey, createdAt: Date.now() });
    return true;
  },
});
