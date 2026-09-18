import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { assertViewerKey } from "./validators.js";
import { boundedJson } from "./lib.js";

const savedViewValidator = v.object({ viewKey: v.string(), name: v.string(), definition: v.any(), updatedAt: v.number() });

export const list = query({
  args: { viewerKey: v.string() },
  returns: v.array(savedViewValidator),
  handler: async (ctx, { viewerKey }) => {
    assertViewerKey(viewerKey);
    const rows = await ctx.db.query("savedViews").withIndex("by_viewer_key", (q) => q.eq("viewerKey", viewerKey)).collect();
    return rows.map((row) => ({ viewKey: row.viewKey, name: row.name, definition: JSON.parse(row.definitionJson), updatedAt: row.updatedAt }));
  },
});

export const save = mutation({
  args: { viewerKey: v.string(), viewKey: v.string(), name: v.string(), definition: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertViewerKey(args.viewerKey);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(args.viewKey) || !args.name.trim() || args.name.length > 120) throw new Error("Invalid saved view");
    const definitionJson = boundedJson(args.definition);
    const existing = await ctx.db.query("savedViews").withIndex("by_viewer_key", (q) => q.eq("viewerKey", args.viewerKey).eq("viewKey", args.viewKey)).unique();
    const value = { name: args.name.trim(), definitionJson, updatedAt: Date.now() };
    if (existing) await ctx.db.patch("savedViews", existing._id, value);
    else await ctx.db.insert("savedViews", { viewerKey: args.viewerKey, viewKey: args.viewKey, ...value });
    return null;
  },
});

export const remove = mutation({
  args: { viewerKey: v.string(), viewKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertViewerKey(args.viewerKey);
    const existing = await ctx.db.query("savedViews").withIndex("by_viewer_key", (q) => q.eq("viewerKey", args.viewerKey).eq("viewKey", args.viewKey)).unique();
    if (existing) await ctx.db.delete("savedViews", existing._id);
    return null;
  },
});
