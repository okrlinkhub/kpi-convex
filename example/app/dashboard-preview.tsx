"use client";

import { DashboardBoard, DashboardHome, type DashboardSummary, type DashboardView } from "@okrlinkhub/kpi-convex/react";

const people = [
  { userId: "viewer-1", displayName: "William", isCurrentUser: true },
  { userId: "viewer-2", displayName: "Team Comply", isCurrentUser: false },
];
const previewTimestamp = Date.UTC(2026, 8, 18, 9, 0, 0);

const summaries: DashboardSummary[] = [
  { id: "direzione", name: "Direzione", description: "Indicatori di sintesi per il comitato di direzione.", widgetCount: 3, isFavorite: true, favoriteCount: 2, favoritedBy: people, createdAt: previewTimestamp, updatedAt: previewTimestamp },
];

const points = [
  { period: "2026-04-01", value: 9 }, { period: "2026-05-01", value: 10 }, { period: "2026-06-01", value: 12 },
  { period: "2026-07-01", value: 13 }, { period: "2026-08-01", value: 14 }, { period: "2026-09-01", value: 15 },
];

const board: DashboardView = {
  id: "direzione",
  name: "Direzione",
  description: "Indicatori di sintesi per il comitato di direzione.",
  isFavorite: true,
  favoriteCount: 2,
  favoritedBy: people,
  refreshedAt: previewTimestamp,
  widgets: [
    { widgetId: "active-teams", indicatorKey: "linkhub.active_team_count", sortOrder: 0, label: "Team attivi", domain: "Adozione", unit: "team", current: points.at(-1) ?? null, previous: points.at(-2) ?? null, delta: 1, points, chartMode: "area", refreshedAt: previewTimestamp, status: "ready" },
    { widgetId: "reviews", indicatorKey: "example.reviews", sortOrder: 1, label: "Review completate", domain: "Execution", unit: "review", current: { period: "2026-09-01", value: 28 }, previous: { period: "2026-08-01", value: 24 }, delta: 4, points: points.map((point) => ({ ...point, value: point.value + 12 })), chartMode: "bar", refreshedAt: previewTimestamp, status: "ready" },
    { widgetId: "mix", indicatorKey: "example.mix", sortOrder: 2, label: "Mix iniziative", domain: "Strategia", unit: "%", current: { period: "2026-09-01", value: 64 }, previous: { period: "2026-08-01", value: 61 }, delta: 3, points, chartMode: "pie", refreshedAt: previewTimestamp, status: "ready" },
  ],
};

export function ExampleDashboardHome() {
  return <DashboardHome appName="COMPLY · PREVIEW LOCALE" boards={summaries} pickerItems={[]} getDashboardHref={(id) => `/dashboards/${id}`}/>;
}

export function ExampleDashboardBoard() {
  return <DashboardBoard board={board} pickerItems={[]} getBackHref={() => "/dashboards"} getKpiHref={(key) => key === "linkhub.active_team_count" ? `/kpi/${encodeURIComponent(key)}` : "/dashboards/direzione"}/>;
}
