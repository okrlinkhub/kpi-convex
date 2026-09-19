import { componentsGeneric } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { registerKpiComponent } from "../test.js";

const components = componentsGeneric();
const viewerA = "viewer_dashboard_owner_1234";
const viewerB = "viewer_dashboard_other_5678";

function testBackend() {
  const t = convexTest(undefined, {
    "./_generated/server.js": async () => ({}),
  });
  registerKpiComponent(t);
  return t;
}

async function seedProjection(t: ReturnType<typeof testBackend>) {
  const releaseId = await t.mutation(
    components.kpiConvex.internal.beginCandidate,
    {
      releaseVersion: "release-dashboard-test",
      generatedAt: "2026-09-18T00:00:00.000Z",
      fingerprint: "fingerprint-dashboard-test",
      indicatorCount: 1,
    },
  );
  await t.mutation(components.kpiConvex.internal.finishCandidate, {
    releaseId,
    fingerprint: "fingerprint-dashboard-test",
  });
  const accepted = await t.mutation(
    components.kpiConvex.internal.acceptCallback,
    {
      eventId: "event-dashboard-test",
      sourceRunId: "run-dashboard-test",
      releaseVersion: "release-dashboard-test",
    },
  );
  await t.mutation(components.kpiConvex.internal.writeProjectionBatch, {
    generationId: accepted.generationId,
    rows: [
      {
        indicatorKey: "revenue",
        summary: {
          indicatorKey: "revenue",
          label: "Ricavi",
          description: "Ricavi netti",
          domain: "Economico",
          unit: "€",
          grain: "monthly",
          dimensions: [],
          current: { period: "2026-08", value: 120 },
          previous: { period: "2026-07", value: 100 },
          delta: 20,
          deltaPercent: 0.2,
          generatedAt: "2026-09-18T00:00:00.000Z",
          releaseVersion: "release-dashboard-test",
        },
        points: [
          { period: "2026-07", value: 100 },
          { period: "2026-08", value: 120 },
        ],
      },
    ],
  });
  await t.mutation(components.kpiConvex.internal.activateGeneration, {
    generationId: accepted.generationId,
  });
}

describe("component dashboards", () => {
  test("persists a dashboard, projects widgets and isolates owner edits", async () => {
    const t = testBackend();
    await seedProjection(t);

    const dashboardId = await t.mutation(
      components.kpiConvex.dashboards.create,
      {
        viewerKey: viewerA,
        name: "Direzione",
        indicatorKeys: ["revenue"],
      },
    );
    const listed = await t.query(components.kpiConvex.dashboards.list, {
      viewerKey: viewerA,
    });
    expect(listed).toMatchObject([
      {
        id: dashboardId,
        name: "Direzione",
        widgetCount: 1,
        canEdit: true,
        containsIndicator: false,
        isFavorite: true,
        favoriteCount: 1,
        favoritedBy: [{ displayName: "Tu", isCurrentUser: true }],
      },
    ]);
    expect(
      await t.query(components.kpiConvex.dashboards.list, {
        viewerKey: viewerA,
        indicatorKey: "revenue",
      }),
    ).toMatchObject([{ id: dashboardId, containsIndicator: true }]);

    const board = await t.query(components.kpiConvex.dashboards.get, {
      viewerKey: viewerA,
      dashboardId,
    });
    expect(board?.widgets).toMatchObject([
      {
        indicatorKey: "revenue",
        label: "Ricavi",
        current: { period: "2026-08", value: 120 },
        points: [
          { period: "2026-07", value: 100 },
          { period: "2026-08", value: 120 },
        ],
        status: "ready",
      },
    ]);

    await expect(
      t.mutation(components.kpiConvex.dashboards.remove, {
        viewerKey: viewerB,
        dashboardId,
      }),
    ).rejects.toThrow("not editable");

    expect(
      await t.mutation(components.kpiConvex.dashboards.toggleFavorite, {
        viewerKey: viewerB,
        dashboardId,
      }),
    ).toBe(true);
    expect(
      (
        await t.query(components.kpiConvex.dashboards.list, {
          viewerKey: viewerB,
        })
      )[0],
    ).toMatchObject({
      isFavorite: true,
      favoriteCount: 2,
      canEdit: false,
      favoritedBy: [{ displayName: "Tu", isCurrentUser: true }],
    });

    await t.mutation(components.kpiConvex.dashboards.remove, {
      viewerKey: viewerA,
      dashboardId,
    });
    expect(
      await t.query(components.kpiConvex.dashboards.get, {
        viewerKey: viewerA,
        dashboardId,
      }),
    ).toBeNull();
  });

  test("adds a KPI to multiple dashboards and treats existing widgets as idempotent", async () => {
    const t = testBackend();
    await seedProjection(t);
    const first = await t.mutation(components.kpiConvex.dashboards.create, {
      viewerKey: viewerA,
      name: "Direzione",
      indicatorKeys: ["revenue"],
    });
    const second = await t.mutation(components.kpiConvex.dashboards.create, {
      viewerKey: viewerA,
      name: "Vendite",
      indicatorKeys: [],
    });

    expect(
      await t.mutation(components.kpiConvex.dashboards.addWidgetToDashboards, {
        viewerKey: viewerA,
        dashboardIds: [first, second],
        indicatorKey: "revenue",
      }),
    ).toEqual({
      addedDashboardIds: [second],
      alreadyPresentDashboardIds: [first],
    });
    await expect(
      t.mutation(components.kpiConvex.dashboards.addWidget, {
        viewerKey: viewerA,
        dashboardId: first,
        indicatorKey: "revenue",
      }),
    ).resolves.toBeNull();
  });

  test("rejects active dashboard names that differ only by case or whitespace", async () => {
    const t = testBackend();
    await seedProjection(t);
    await t.mutation(components.kpiConvex.dashboards.create, {
      viewerKey: viewerA,
      name: "Direzione generale",
      indicatorKeys: [],
    });

    await expect(
      t.mutation(components.kpiConvex.dashboards.create, {
        viewerKey: viewerB,
        name: "  DIREZIONE   GENERALE  ",
        indicatorKeys: [],
      }),
    ).rejects.toThrow("Esiste già una dashboard con questo nome");
  });
});
