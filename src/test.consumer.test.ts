import { componentsGeneric } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import {
  modules,
  registerKpiComponent,
} from "@okrlinkhub/kpi-convex/test";

describe("public test helper", () => {
  test("loads from the package export and registers runnable component modules", async () => {
    expect(Object.keys(modules)).toContain("./component/_generated/server.js");
    expect(Object.keys(modules)).toContain("./component/sync.js");

    const t = convexTest(undefined, {
      "./_generated/server.js": async () => ({}),
    });
    registerKpiComponent(t);
    const components = componentsGeneric();
    const status = await t.query(components.kpiConvex.sync.getStatus, {});

    expect(status).toEqual({
      state: "empty",
      releaseVersion: null,
      sourceRunId: null,
      lastCheckedAt: null,
      lastProjectedAt: null,
      errorCode: null,
    });
  });
});
