// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  DashboardBoard,
  DashboardFavoritePeople,
  DashboardHome,
  KpiCard,
  KpiCatalog,
  KpiCatalogWorkspace,
  KpiChart,
  KpiSectionNav,
  KpiWorkspaceHeader,
  formatAxisPeriod,
} from "./index.js";

const summary = {
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
  generatedAt: "2026-09-18T00:00:00Z",
  releaseVersion: "sha256-test",
};

describe("KPI React UI", () => {
  test("renders a KPI and exposes keyboard-compatible actions", () => {
    const toggle = vi.fn();
    render(<KpiCard kpi={summary} favorite onToggleFavorite={toggle} />);
    expect(screen.getByRole("heading", { name: "Ricavi" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Rimuovi dai preferiti" }),
    );
    expect(toggle).toHaveBeenCalledOnce();
  });
  test("renders an accessible table mode", () => {
    render(
      <KpiChart
        points={[{ period: "2026-08", value: 120 }]}
        mode="table"
        unit="€"
      />,
    );
    expect(screen.getByRole("table")).toBeTruthy();
  });
  test("uses the KPI View table as the default catalog presentation", () => {
    const view = render(<KpiCatalog items={[summary]} />);
    expect(within(view.container).getByRole("table")).toBeTruthy();
    expect(
      within(view.container).getByRole("columnheader", { name: "Indicatore" }),
    ).toBeTruthy();
  });
  test("opens catalog selection from the entire KPI row", () => {
    const open = vi.fn();
    const view = render(<KpiCatalog items={[summary]} onOpenKpi={open} />);
    fireEvent.click(
      within(view.container).getByRole("row", { name: /Ricavi/ }),
    );
    expect(open).toHaveBeenCalledWith("revenue");
  });
  test("does not describe anonymous dashboard favorites as nobody", () => {
    render(<DashboardFavoritePeople count={1} people={[]} />);
    fireEvent.click(screen.getByText("1 persona"));
    expect(screen.queryByText(/Nessuna persona/)).toBeNull();
    expect(screen.getByText(/identità restano private/)).toBeTruthy();
  });
  test("formats dashboard chart periods without Next.js helpers", () => {
    expect(formatAxisPeriod("2026-09-01")).toBe("set");
  });
  test("renders a router-agnostic shared dashboard list", () => {
    const view = render(
      <DashboardHome
        appName="Comply"
        pickerItems={[]}
        boards={[
          {
            id: "zeta",
            name: "Zeta",
            description: "Ultima dashboard",
            widgetCount: 2,
            isFavorite: false,
            canEdit: true,
            containsIndicator: false,
            favoriteCount: 0,
            favoritedBy: [],
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "direzione",
            name: "Direzione",
            description: "Sintesi",
            widgetCount: 3,
            isFavorite: true,
            canEdit: true,
            containsIndicator: false,
            favoriteCount: 2,
            favoritedBy: [],
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "operations",
            name: "Operations",
            description: null,
            widgetCount: 1,
            isFavorite: false,
            canEdit: true,
            containsIndicator: false,
            favoriteCount: 0,
            favoritedBy: [],
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        getDashboardHref={(id) => `/dashboards/${id}`}
      />,
    );
    expect(
      within(view.container)
        .getByRole("link", { name: "Apri Direzione" })
        .getAttribute("href"),
    ).toBe("/dashboards/direzione");
    expect(
      within(view.container).queryByRole("link", { name: "Apri Operations" }),
    ).toBeNull();
    expect(
      within(view.container)
        .getByRole("button", { name: "Preferite" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(
      within(view.container).getByRole("button", { name: "Tutte" }),
    );
    expect(
      within(view.container).getByRole("link", { name: "Apri Operations" }),
    ).toBeTruthy();
    expect(
      within(view.container)
        .getAllByRole("link", { name: /^Apri / })
        .map((link) => link.getAttribute("aria-label")),
    ).toEqual(["Apri Direzione", "Apri Operations", "Apri Zeta"]);
    fireEvent.change(
      within(view.container).getByRole("searchbox", {
        name: "Cerca dashboard",
      }),
      { target: { value: "zeta" } },
    );
    expect(
      within(view.container).getByRole("link", { name: "Apri Zeta" }),
    ).toBeTruthy();
    expect(
      within(view.container).queryByRole("link", { name: "Apri Direzione" }),
    ).toBeNull();
  });
  test("blocks duplicate dashboard names and submits only once", async () => {
    const create = vi.fn().mockResolvedValue("new-dashboard");
    render(
      <DashboardHome
        boards={[
          {
            id: "direzione",
            name: "Direzione generale",
            description: null,
            widgetCount: 0,
            isFavorite: true,
            canEdit: true,
            containsIndicator: false,
            favoriteCount: 1,
            favoritedBy: [],
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        pickerItems={[]}
        canEdit
        onCreateDashboard={create}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nuova dashboard" }));
    const nameInput = screen.getByPlaceholderText(
      "Direzione, Vendite, People…",
    );
    fireEvent.change(nameInput, {
      target: { value: "  DIREZIONE   GENERALE " },
    });
    expect(
      screen.getByText("Esiste già una dashboard con questo nome."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Crea dashboard" })
        .hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.change(nameInput, { target: { value: "Vendite" } });
    const submit = screen.getByRole("button", { name: "Crea dashboard" });
    await act(async () => {
      submit.click();
      submit.click();
      await Promise.resolve();
    });
    expect(create).toHaveBeenCalledOnce();
  });
  test("selects several dashboard targets and deep-links existing KPI memberships", () => {
    const add = vi.fn().mockResolvedValue(undefined);
    render(
      <KpiCatalogWorkspace
        items={[summary]}
        state={{ query: "", sort: "label", descending: false, view: "cards" }}
        dashboards={[
          {
            id: "existing",
            name: "Direzione",
            description: null,
            widgetCount: 1,
            isFavorite: false,
            canEdit: true,
            containsIndicator: true,
            favoriteCount: 0,
            favoritedBy: [],
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "target-a",
            name: "Vendite",
            description: null,
            widgetCount: 2,
            isFavorite: false,
            canEdit: true,
            containsIndicator: false,
            favoriteCount: 0,
            favoritedBy: [],
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "target-b",
            name: "Operations",
            description: null,
            widgetCount: 3,
            isFavorite: false,
            canEdit: true,
            containsIndicator: false,
            favoriteCount: 0,
            favoritedBy: [],
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        selectedKpi={summary}
        page={1}
        pageCount={1}
        total={1}
        onStateChange={vi.fn()}
        onPageChange={vi.fn()}
        onSelectedKpiChange={vi.fn()}
        onAddToDashboards={add}
        getDashboardHref={(id, key) => `/dashboards/${id}?kpi=${key}`}
      />,
    );
    expect(screen.getByText("Già presente")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Apri Direzione su Ricavi" })
        .getAttribute("href"),
    ).toBe("/dashboards/existing?kpi=revenue");
    fireEvent.click(screen.getByRole("checkbox", { name: /Vendite/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Operations/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Aggiungi a 2 dashboard" }),
    );
    expect(add).toHaveBeenCalledWith(["target-a", "target-b"], "revenue");
  });
  test("keeps Dashboard first in the shared navigation", () => {
    const view = render(
      <KpiSectionNav
        active="dashboards"
        dashboardsHref="/dashboards"
        catalogHref="/catalog"
      />,
    );
    const links = within(view.container).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Catalogo KPI",
    ]);
    expect(links[0]?.getAttribute("aria-current")).toBe("page");
  });
  test("uses drag-only widget reordering and confirms dashboard deletion", async () => {
    const removeDashboard = vi.fn().mockResolvedValue(undefined);
    render(
      <DashboardBoard
        canEdit
        highlightIndicatorKey="revenue"
        pickerItems={[]}
        onReorderWidgets={vi.fn()}
        onRemoveDashboard={removeDashboard}
        board={{
          id: "direzione",
          name: "Direzione",
          description: null,
          isFavorite: false,
          favoriteCount: 0,
          favoritedBy: [],
          refreshedAt: 1,
          widgets: [
            {
              widgetId: "w1",
              indicatorKey: "revenue",
              sortOrder: 0,
              label: "Ricavi",
              domain: "Economico",
              unit: "€",
              current: null,
              previous: null,
              delta: null,
              points: [],
              chartMode: "area",
              refreshedAt: 1,
              status: "ready",
            },
            {
              widgetId: "w2",
              indicatorKey: "margin",
              sortOrder: 1,
              label: "Margine",
              domain: "Economico",
              unit: "%",
              current: null,
              previous: null,
              delta: null,
              points: [],
              chartMode: "area",
              refreshedAt: 1,
              status: "ready",
            },
          ],
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /Sposta prima/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sposta dopo/ })).toBeNull();
    expect(
      document
        .getElementById("kpi-widget-revenue")
        ?.getAttribute("aria-current"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));
    expect(removeDashboard).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Elimina dashboard" }));
    expect(removeDashboard).toHaveBeenCalledOnce();
  });
  test("copies dashboard and highlighted KPI links from compact actions", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <DashboardBoard
        pickerItems={[]}
        getDashboardShareUrl={() => "/dashboards/direzione"}
        getKpiShareUrl={(key) => `/dashboards/direzione?kpi=${key}`}
        board={{
          id: "direzione",
          name: "Direzione",
          description: null,
          isFavorite: false,
          favoriteCount: 0,
          favoritedBy: [],
          refreshedAt: 1,
          widgets: [
            {
              widgetId: "w1",
              indicatorKey: "revenue",
              sortOrder: 0,
              label: "Ricavi",
              domain: "Economico",
              unit: "€",
              current: null,
              previous: null,
              delta: null,
              points: [],
              chartMode: "area",
              refreshedAt: 1,
              status: "ready",
            },
          ],
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copia URL dashboard" }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "http://localhost:3000/dashboards/direzione",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copia link Ricavi" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "http://localhost:3000/dashboards/direzione?kpi=revenue",
      ),
    );
  });
  test("keeps sync status visible alongside a host header action", () => {
    render(
      <KpiWorkspaceHeader
        eyebrow="ABADDON"
        status={{
          state: "ready",
          releaseVersion: "release-1",
          sourceRunId: "run-1",
          lastCheckedAt: 1,
          lastProjectedAt: 1,
          errorCode: null,
        }}
        action={<button type="button">Aggiorna catalogo</button>}
      />,
    );
    expect(screen.getByText("Catalogo aggiornato")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Aggiorna catalogo" }),
    ).toBeTruthy();
  });
});
