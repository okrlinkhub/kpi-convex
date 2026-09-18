// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DashboardHome, KpiCard, KpiCatalog, KpiChart, formatAxisPeriod } from "./index.js";

const summary = { indicatorKey: "revenue", label: "Ricavi", description: "Ricavi netti", domain: "Economico", unit: "€", grain: "monthly", dimensions: [], current: { period: "2026-08", value: 120 }, previous: { period: "2026-07", value: 100 }, delta: 20, deltaPercent: 0.2, generatedAt: "2026-09-18T00:00:00Z", releaseVersion: "sha256-test" };

describe("KPI React UI", () => {
  test("renders a KPI and exposes keyboard-compatible actions", () => {
    const toggle = vi.fn();
    render(<KpiCard kpi={summary} favorite onToggleFavorite={toggle} />);
    expect(screen.getByRole("heading", { name: "Ricavi" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi dai preferiti" }));
    expect(toggle).toHaveBeenCalledOnce();
  });
  test("renders an accessible table mode", () => {
    render(<KpiChart points={[{ period: "2026-08", value: 120 }]} mode="table" unit="€" />);
    expect(screen.getByRole("table")).toBeTruthy();
  });
  test("uses the KPI View table as the default catalog presentation", () => {
    const view = render(<KpiCatalog items={[summary]} />);
    expect(within(view.container).getByRole("table")).toBeTruthy();
    expect(within(view.container).getByRole("columnheader", { name: "Indicatore" })).toBeTruthy();
  });
  test("formats dashboard chart periods without Next.js helpers", () => {
    expect(formatAxisPeriod("2026-09-01")).toBe("set");
  });
  test("renders a router-agnostic shared dashboard list", () => {
    const view = render(<DashboardHome appName="Comply" pickerItems={[]} boards={[{ id: "direzione", name: "Direzione", description: "Sintesi", widgetCount: 3, isFavorite: true, favoriteCount: 2, favoritedBy: [], createdAt: 1, updatedAt: 1 }]} getDashboardHref={(id) => `/dashboards/${id}`} />);
    expect(within(view.container).getByRole("link", { name: "Direzione Sintesi" }).getAttribute("href")).toBe("/dashboards/direzione");
  });
});
