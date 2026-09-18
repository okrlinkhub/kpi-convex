import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { assertViewerKey, DEFAULT_PREFERENCES, preferencesValidator } from "./validators.js";

export const get = query({
  args: { viewerKey: v.string() },
  returns: preferencesValidator,
  handler: async (ctx, { viewerKey }) => {
    assertViewerKey(viewerKey);
    return (await ctx.db.query("viewerPreferences").withIndex("by_viewer", (q) => q.eq("viewerKey", viewerKey)).unique())?.preferences ?? DEFAULT_PREFERENCES;
  },
});

export const save = mutation({
  args: { viewerKey: v.string(), preferences: preferencesValidator },
  returns: v.null(),
  handler: async (ctx, { viewerKey, preferences }) => {
    assertViewerKey(viewerKey);
    const existing = await ctx.db.query("viewerPreferences").withIndex("by_viewer", (q) => q.eq("viewerKey", viewerKey)).unique();
    if (existing) await ctx.db.patch("viewerPreferences", existing._id, { preferences, updatedAt: Date.now() });
    else await ctx.db.insert("viewerPreferences", { viewerKey, preferences, updatedAt: Date.now() });
    return null;
  },
});
