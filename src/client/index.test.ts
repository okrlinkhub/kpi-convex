import { defineSchema, defineTable, makeFunctionReference } from "convex/server";
import type { DataModelFromSchemaDefinition } from "convex/server";
import { v } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import {
  exposeKpiApi,
  type KpiAuthorizationContext,
  type KpiHostActionContext,
  type KpiHostMutationContext,
  type KpiHostOptions,
  type KpiHostQueryContext,
  type KpiViewerContext,
} from "./index.js";

const component = {
  catalog: { get: makeFunctionReference<"query">("catalog:get") },
  favorites: { toggle: makeFunctionReference<"mutation">("favorites:toggle") },
  metrics: { getLiveDetail: makeFunctionReference<"action">("metrics:getLiveDetail") },
} as unknown as Parameters<typeof exposeKpiApi>[0];

const hostSchema = defineSchema({ memberships: defineTable({ viewerKey: v.string() }) });
type HostDataModel = DataModelFromSchemaDefinition<typeof hostSchema>;
void hostSchema;

const typeCheckedOptions: KpiHostOptions<HostDataModel> = {
  authorize: async (context: KpiAuthorizationContext<HostDataModel>) => {
    if (context.kind === "query") void context.ctx.db.query("memberships");
    if (context.kind === "mutation") void context.ctx.db.query("memberships");
    if (context.kind === "action") void context.ctx.runQuery;
  },
  viewerKey: async (context: KpiViewerContext<HostDataModel>) => {
    if (context.kind === "query") void context.ctx.db.query("memberships");
    if (context.kind === "mutation") void context.ctx.db.query("memberships");
    return "viewer_test";
  },
};
void typeCheckedOptions;

type RuntimeRegistered<Context, Args> = {
  _handler: (ctx: Context, args: Args) => Promise<unknown>;
};

describe("exposeKpiApi host contexts", () => {
  test("passes the complete discriminated Convex context to host callbacks", async () => {
    const queryCtx = {
      auth: {},
      db: { source: "query-db" },
      runQuery: vi.fn(async () => ({ indicatorKey: "revenue" })),
      storage: {},
    } as unknown as KpiHostQueryContext;
    const mutationCtx = {
      auth: {},
      db: { source: "mutation-db" },
      runMutation: vi.fn(async () => true),
      runQuery: vi.fn(),
      scheduler: {},
      storage: {},
    } as unknown as KpiHostMutationContext;
    const actionCtx = {
      auth: {},
      runAction: vi.fn(async () => ({ points: [] })),
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      scheduler: {},
      storage: {},
    } as unknown as KpiHostActionContext;
    const authorize = vi.fn<KpiHostOptions["authorize"]>(async () => undefined);
    const viewerKey = vi.fn<KpiHostOptions["viewerKey"]>(async () => "viewer_test");
    const api = exposeKpiApi(component, { authorize, viewerKey });

    await (api.catalogGet as unknown as RuntimeRegistered<
      KpiHostQueryContext,
      { indicatorKey: string }
    >)._handler(queryCtx, { indicatorKey: "revenue" });
    await (api.favoriteToggle as unknown as RuntimeRegistered<
      KpiHostMutationContext,
      { indicatorKey: string }
    >)._handler(mutationCtx, { indicatorKey: "revenue" });
    await (api.getLiveDetail as unknown as RuntimeRegistered<
      KpiHostActionContext,
      { indicatorKey: string; startDate: string; endDate: string; limit?: number }
    >)._handler(actionCtx, {
      indicatorKey: "revenue",
      startDate: "2026-01-01",
      endDate: "2026-09-18",
    });

    expect(authorize).toHaveBeenNthCalledWith(
      1,
      { kind: "query", ctx: queryCtx },
      { type: "kpi.read", indicatorKey: "revenue" },
    );
    expect(authorize).toHaveBeenNthCalledWith(
      2,
      { kind: "mutation", ctx: mutationCtx },
      { type: "viewer.write" },
    );
    expect(authorize).toHaveBeenNthCalledWith(
      3,
      { kind: "action", ctx: actionCtx },
      { type: "kpi.read", indicatorKey: "revenue" },
    );
    expect(viewerKey).toHaveBeenCalledOnce();
    expect(viewerKey).toHaveBeenCalledWith({ kind: "mutation", ctx: mutationCtx });
  });
});
