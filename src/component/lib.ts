import type { MutationCtx, QueryCtx } from "./_generated/server.js";

export async function getState(ctx: QueryCtx | MutationCtx) {
  return await ctx.db.query("componentState").withIndex("by_key", (q) => q.eq("key", "singleton")).unique();
}

export async function ensureState(ctx: MutationCtx) {
  const existing = await getState(ctx);
  if (existing) return existing;
  const id = await ctx.db.insert("componentState", { key: "singleton" });
  return (await ctx.db.get("componentState", id))!;
}

export function boundedJson(value: unknown, maxBytes = 16_384) {
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).length > maxBytes) throw new Error("Saved view is too large");
  return json;
}

export function buildKpiSearchText(summary: {
  indicatorKey: string;
  label: string;
  description: string;
  domain: string;
}) {
  return `${summary.indicatorKey} ${summary.label} ${summary.description} ${summary.domain}`.toLocaleLowerCase("it");
}

export function matchesKpiSearch(
  item: { indicatorKey: string; searchText: string },
  search: string | undefined,
) {
  if (!search) return true;
  return item.indicatorKey.toLocaleLowerCase("it").includes(search) || item.searchText.includes(search);
}
