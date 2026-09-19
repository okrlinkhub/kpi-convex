"use client";
/* eslint-disable react-refresh/only-export-components -- public UI module exports helpers with components */

import {
  ArrowRight,
  Check,
  Grid2X2,
  List,
  Search,
  Star,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { KpiSummary, SyncStatus } from "../contracts/index.js";
import type {
  KpiCatalogState,
  KpiCatalogView,
  DashboardSummary,
} from "./model.js";
import { formatKpiDate, formatKpiValue } from "./model.js";

export type KpiMessages = Partial<typeof defaultMessages>;
const defaultMessages = {
  searchPlaceholder: "Cerca nome, dominio o ID…",
  empty: "Nessun indicatore trovato",
  emptyDescription: "Modifica ricerca o filtri per ampliare i risultati.",
  loading: "Caricamento KPI…",
  favoriteAdd: "Aggiungi ai preferiti",
  favoriteRemove: "Rimuovi dai preferiti",
  previous: "Precedente",
  next: "Successiva",
};

export function KpiSectionNav({
  active,
  catalogHref,
  dashboardsHref,
  onOpenCatalog,
  onOpenDashboards,
}: {
  active: "catalog" | "dashboards";
  catalogHref?: string;
  dashboardsHref?: string;
  onOpenCatalog?: () => void;
  onOpenDashboards?: () => void;
}) {
  const item = (
    key: "catalog" | "dashboards",
    label: string,
    href: string | undefined,
    onOpen: (() => void) | undefined,
  ) =>
    href ? (
      <a
        className="kpi-section-nav-item"
        aria-current={active === key ? "page" : undefined}
        href={href}
      >
        {label}
      </a>
    ) : (
      <button
        className="kpi-section-nav-item"
        aria-current={active === key ? "page" : undefined}
        type="button"
        onClick={onOpen}
      >
        {label}
      </button>
    );
  return (
    <nav className="kpi-section-nav" aria-label="Sezioni KPI">
      {item("dashboards", "Dashboard", dashboardsHref, onOpenDashboards)}
      {item("catalog", "Catalogo KPI", catalogHref, onOpenCatalog)}
    </nav>
  );
}

export function KpiWorkspaceHeader({
  eyebrow,
  title = "Catalogo KPI",
  description,
  status,
  action,
  navigation,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  status?: SyncStatus;
  action?: ReactNode;
  navigation?: ReactNode;
}) {
  const degraded = status?.state === "degraded";
  const statusPill = status ? (
    <div className={`kpi-freshness-pill ${degraded ? "degraded" : ""}`}>
      <span className="kpi-live-dot" />
      <div>
        <strong>
          {degraded
            ? "Ultima generazione valida"
            : status.state === "projecting"
              ? "Aggiornamento in corso"
              : "Catalogo aggiornato"}
        </strong>
        <time>
          {formatKpiDate(status.lastProjectedAt ?? status.lastCheckedAt)}
        </time>
      </div>
    </div>
  ) : null;
  return (
    <>
      <header className="kpi-workspace-head">
        <div>
          {eyebrow ? <span className="kpi-eyebrow">{eyebrow}</span> : null}
          {navigation ?? <h1>{title}</h1>}
          {description ? <p>{description}</p> : null}
        </div>
        {statusPill || action ? (
          <div className="kpi-workspace-actions">
            {statusPill}
            {action}
          </div>
        ) : null}
      </header>
      {degraded ? (
        <div className="kpi-warning" role="status">
          <strong>Dati in modalità degradata</strong>
          <p>
            È mostrata l’ultima generazione valida. Codice:{" "}
            {status.errorCode ?? "errore sconosciuto"}.
          </p>
        </div>
      ) : null}
    </>
  );
}

export function KpiCard({
  kpi,
  favorite = false,
  onToggleFavorite,
  getKpiHref,
  onOpen,
  messages,
}: {
  kpi: KpiSummary;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  getKpiHref?: () => string;
  onOpen?: () => void;
  messages?: KpiMessages;
}) {
  const copy = { ...defaultMessages, ...messages };
  const content = (
    <>
      <h2>{kpi.label}</h2>
      <p>{kpi.description}</p>
      <strong>{formatKpiValue(kpi.current, kpi.unit)}</strong>
    </>
  );
  return (
    <article className="kpi-metric-card">
      <div>
        <span className="kpi-badge">{kpi.domain}</span>
        {onToggleFavorite ? (
          <button
            type="button"
            className={`kpi-star ${favorite ? "active" : ""}`}
            aria-label={favorite ? copy.favoriteRemove : copy.favoriteAdd}
            aria-pressed={favorite}
            onClick={onToggleFavorite}
          >
            <Star
              aria-hidden="true"
              fill={favorite ? "currentColor" : "none"}
            />
          </button>
        ) : null}
      </div>
      {getKpiHref ? (
        <a href={getKpiHref()}>{content}</a>
      ) : (
        <button className="kpi-card-open" type="button" onClick={onOpen}>
          {content}
        </button>
      )}
    </article>
  );
}

export function KpiCatalog({
  items,
  view = "table",
  loading,
  onOpenKpi,
  messages,
}: {
  items: KpiSummary[];
  view?: KpiCatalogView;
  loading?: boolean;
  onOpenKpi?: (key: string) => void;
  messages?: KpiMessages;
}) {
  const copy = { ...defaultMessages, ...messages };
  if (loading && items.length === 0)
    return (
      <div className="kpi-empty" role="status">
        {copy.loading}
      </div>
    );
  if (items.length === 0)
    return (
      <div className="kpi-empty">
        <Search aria-hidden="true" />
        <h2>{copy.empty}</h2>
        <p>{copy.emptyDescription}</p>
      </div>
    );
  if (view === "cards")
    return (
      <div className="kpi-compact-grid">
        {items.map((kpi) => (
          <KpiCard
            key={kpi.indicatorKey}
            kpi={kpi}
            onOpen={onOpenKpi ? () => onOpenKpi(kpi.indicatorKey) : undefined}
            messages={copy}
          />
        ))}
      </div>
    );
  return (
    <div className="kpi-data-table-wrap">
      <table className="kpi-data-table">
        <thead>
          <tr>
            <th>Indicatore</th>
            <th>Dominio</th>
            <th className="number">Valore corrente</th>
            <th className="number">Variazione</th>
            <th>Periodo</th>
            <th>Aggiornato</th>
          </tr>
        </thead>
        <tbody>
          {items.map((kpi) => {
            const label = <strong>{kpi.label}</strong>;
            return (
              <tr
                key={kpi.indicatorKey}
                data-clickable={onOpenKpi ? "true" : undefined}
                tabIndex={onOpenKpi ? 0 : undefined}
                onClick={() => onOpenKpi?.(kpi.indicatorKey)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenKpi?.(kpi.indicatorKey);
                  }
                }}
              >
                <td>
                  <span className="kpi-metric-link">{label}</span>
                </td>
                <td>
                  <span className="kpi-badge">{kpi.domain}</span>
                </td>
                <td className="number kpi-metric-value">
                  {formatKpiValue(kpi.current, kpi.unit)}
                </td>
                <td
                  className={`number kpi-delta ${(kpi.delta ?? 0) > 0 ? "positive" : (kpi.delta ?? 0) < 0 ? "negative" : ""}`}
                >
                  {kpi.delta === null
                    ? "—"
                    : `${kpi.delta > 0 ? "+" : ""}${kpi.delta.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`}
                </td>
                <td>{kpi.current?.period.slice(0, 7) ?? "—"}</td>
                <td>
                  <time>{formatKpiDate(kpi.generatedAt)}</time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type KpiCatalogWorkspaceProps = {
  items: KpiSummary[];
  state: KpiCatalogState;
  dashboards?: DashboardSummary[];
  dashboardLoading?: boolean;
  selectedKpi?: KpiSummary | null;
  loading?: boolean;
  page: number;
  pageCount: number;
  total: number;
  onOpenKpi?: (key: string) => void;
  onSelectedKpiChange?: (kpi: KpiSummary | null) => void;
  onAddToDashboards?: (dashboardIds: string[], indicatorKey: string) => Promise<void> | void;
  getDashboardHref?: (id: string, indicatorKey?: string) => string;
  onOpenDashboard?: (id: string) => void;
  onStateChange: (state: KpiCatalogState) => void;
  onPageChange: (page: number) => void;
  messages?: KpiMessages;
};

export function KpiCatalogWorkspace(props: KpiCatalogWorkspaceProps) {
  const { state } = props;
  const [adding, setAdding] = useState(false);
  const [dashboardSelection, setDashboardSelection] = useState<{
    indicatorKey: string;
    ids: string[];
  }>({ indicatorKey: "", ids: [] });
  const [notice, setNotice] = useState<string | null>(null);
  const selectionKey = props.selectedKpi?.indicatorKey ?? "";
  const selectedDashboardIds =
    dashboardSelection.indicatorKey === selectionKey
      ? dashboardSelection.ids
      : [];
  const update = (patch: Partial<KpiCatalogState>) =>
    props.onStateChange({ ...state, ...patch });
  async function addToDashboards() {
    if (!props.selectedKpi || !props.onAddToDashboards || adding || selectedDashboardIds.length === 0) return;
    setAdding(true);
    setNotice(null);
    try {
      await props.onAddToDashboards(selectedDashboardIds, props.selectedKpi.indicatorKey);
      setNotice(`${props.selectedKpi.label} aggiunto a ${selectedDashboardIds.length} ${selectedDashboardIds.length === 1 ? "dashboard" : "dashboard"}.`);
      props.onSelectedKpiChange?.(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Aggiunta non riuscita");
    } finally {
      setAdding(false);
    }
  }
  const editableDashboards = (props.dashboards ?? []).filter((board) => board.canEdit);
  return (
    <section className="kpi-catalog-workspace">
      {notice ? <div className="kpi-notice" role="status">{notice}</div> : null}
      <div className="kpi-catalog-toolbar">
        <label className="kpi-catalog-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Cerca nel catalogo</span>
          <input
            value={state.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder={defaultMessages.searchPlaceholder}
          />
        </label>
        <div className="kpi-segmented kpi-view-toggle">
          <button
            type="button"
            aria-pressed={state.view === "table"}
            onClick={() => update({ view: "table" })}
          >
            <List aria-hidden="true" />
            <span className="sr-only">Tabella</span>
          </button>
          <button
            type="button"
            aria-pressed={state.view === "cards"}
            onClick={() => update({ view: "cards" })}
          >
            <Grid2X2 aria-hidden="true" />
            <span className="sr-only">Card</span>
          </button>
        </div>
      </div>
      <div className="kpi-results-meta">
        <span>
          <strong>{props.total}</strong> KPI
        </span>
        <span>
          Pagina {props.page} di {props.pageCount}
        </span>
      </div>
      <KpiCatalog
        items={props.items}
        view={state.view}
        loading={props.loading}
        onOpenKpi={props.onOpenKpi}
        messages={props.messages}
      />
      <footer className="kpi-pagination">
        <button
          type="button"
          disabled={props.page === 1}
          onClick={() => props.onPageChange(props.page - 1)}
        >
          {defaultMessages.previous}
        </button>
        <span>
          {props.total ? (props.page - 1) * 50 + 1 : 0}–
          {Math.min(props.page * 50, props.total)} di {props.total}
        </span>
        <button
          type="button"
          disabled={props.page === props.pageCount}
          onClick={() => props.onPageChange(props.page + 1)}
        >
          {defaultMessages.next}
        </button>
      </footer>
      {props.selectedKpi ? (
        <div className="kpi-picker-overlay" role="dialog" aria-modal="true" aria-labelledby="add-kpi-title">
          <section className="kpi-picker-card">
            <header>
              <h2 id="add-kpi-title">Aggiungi a una dashboard</h2>
              <p>Scegli dove inserire “{props.selectedKpi.label}”.</p>
            </header>
            <div className="kpi-picker-list">
              {props.dashboardLoading ? (
                <div className="kpi-empty compact" role="status">Caricamento dashboard…</div>
              ) : editableDashboards.length ? (
                editableDashboards.map((dashboard) => {
                  const selected = selectedDashboardIds.includes(dashboard.id);
                  return (
                    <div className={`kpi-picker-item${dashboard.containsIndicator ? " present" : ""}`} key={dashboard.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={dashboard.containsIndicator || selected}
                          disabled={dashboard.containsIndicator || adding}
                          onChange={(event) => setDashboardSelection({
                            indicatorKey: selectionKey,
                            ids: event.target.checked
                              ? [...selectedDashboardIds, dashboard.id]
                              : selectedDashboardIds.filter((id) => id !== dashboard.id),
                          })}
                        />
                        <span>
                          <strong>{dashboard.name}</strong>
                          <small>
                            {dashboard.containsIndicator ? "Già presente" : `${dashboard.widgetCount} indicatori`}
                          </small>
                        </span>
                        {dashboard.containsIndicator ? <Check className="kpi-picker-check" aria-hidden="true" /> : null}
                      </label>
                      {dashboard.containsIndicator && props.getDashboardHref ? (
                        <a
                          className="kpi-icon-button"
                          href={props.getDashboardHref(dashboard.id, props.selectedKpi?.indicatorKey)}
                          aria-label={`Apri ${dashboard.name} su ${props.selectedKpi?.label}`}
                        >
                          <ArrowRight aria-hidden="true" />
                        </a>
                      ) : dashboard.containsIndicator && props.onOpenDashboard ? (
                        <button
                          className="kpi-icon-button"
                          type="button"
                          aria-label={`Apri ${dashboard.name} su ${props.selectedKpi?.label}`}
                          onClick={() => props.onOpenDashboard?.(dashboard.id)}
                        >
                          <ArrowRight aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="kpi-empty compact">
                  <h2>Nessuna dashboard modificabile</h2>
                  <p>Crea una dashboard prima di aggiungere un indicatore.</p>
                </div>
              )}
            </div>
            <footer>
              <button
                className="kpi-button primary"
                type="button"
                disabled={adding || selectedDashboardIds.length === 0}
                onClick={() => void addToDashboards()}
              >
                {adding ? "Aggiunta…" : `Aggiungi a ${selectedDashboardIds.length || "…"} ${selectedDashboardIds.length === 1 ? "dashboard" : "dashboard"}`}
              </button>
              {props.getDashboardHref ? (
                <a className="kpi-button" href={props.getDashboardHref("")}>Vai alle dashboard</a>
              ) : props.onOpenDashboard ? (
                <button className="kpi-button" type="button" onClick={() => props.onOpenDashboard?.("")}>Vai alle dashboard</button>
              ) : null}
              <button className="kpi-button" type="button" onClick={() => props.onSelectedKpiChange?.(null)}>Annulla</button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export function useCatalogProjection(
  items: KpiSummary[],
  state: KpiCatalogState,
) {
  return useMemo(() => {
    const needle = state.query.trim().toLocaleLowerCase("it");
    const filtered = items.filter(
      (item) =>
        (!state.domain || item.domain === state.domain) &&
        (!needle ||
          [item.label, item.domain, item.indicatorKey].some((value) =>
            value.toLocaleLowerCase("it").includes(needle),
          )),
    );
    const multiplier = state.descending ? -1 : 1;
    return filtered.sort((a, b) => {
      if (state.sort === "value")
        return (
          multiplier *
          ((a.current?.value ?? -Infinity) - (b.current?.value ?? -Infinity))
        );
      if (state.sort === "updated")
        return multiplier * a.generatedAt.localeCompare(b.generatedAt);
      return (
        multiplier *
        (state.sort === "domain"
          ? a.domain.localeCompare(b.domain, "it")
          : a.label.localeCompare(b.label, "it"))
      );
    });
  }, [items, state]);
}
