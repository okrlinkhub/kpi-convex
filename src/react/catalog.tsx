"use client";
/* eslint-disable react-refresh/only-export-components -- public UI module exports helpers with components */

import { ArrowDown, ArrowUp, BookmarkPlus, Grid2X2, List, Search, Star, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { KpiSummary, SyncStatus } from "../contracts/index.js";
import type { KpiCatalogSort, KpiCatalogState, KpiCatalogView, KpiSavedView } from "./model.js";
import { formatKpiDate, formatKpiValue, parseSavedView } from "./model.js";

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

export function KpiWorkspaceHeader({ eyebrow, title = "Catalogo KPI", description = "Esplora definizioni, valori e andamento degli indicatori verificati.", status, action }: { eyebrow: string; title?: string; description?: string; status?: SyncStatus; action?: ReactNode }) {
  const degraded = status?.state === "degraded";
  return <>
    <header className="kpi-workspace-head">
      <div><span className="kpi-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action ?? (status ? <div className={`kpi-freshness-pill ${degraded ? "degraded" : ""}`}><span className="kpi-live-dot"/><div><strong>{degraded ? "Ultima generazione valida" : status.state === "projecting" ? "Aggiornamento in corso" : "Catalogo aggiornato"}</strong><time>{formatKpiDate(status.lastProjectedAt ?? status.lastCheckedAt)}</time></div></div> : null)}
    </header>
    {degraded ? <div className="kpi-warning" role="status"><strong>Dati in modalità degradata</strong><p>È mostrata l’ultima generazione valida. Codice: {status.errorCode ?? "errore sconosciuto"}.</p></div> : null}
  </>;
}

export function KpiCard({ kpi, favorite = false, onToggleFavorite, getKpiHref, onOpen, messages }: { kpi: KpiSummary; favorite?: boolean; onToggleFavorite?: () => void; getKpiHref?: () => string; onOpen?: () => void; messages?: KpiMessages }) {
  const copy = { ...defaultMessages, ...messages };
  const content = <><h2>{kpi.label}</h2><p>{kpi.description}</p><strong>{formatKpiValue(kpi.current, kpi.unit)}</strong><code>{kpi.indicatorKey}</code></>;
  return <article className="kpi-metric-card"><div><span className="kpi-badge">{kpi.domain}</span>{onToggleFavorite ? <button type="button" className={`kpi-star ${favorite ? "active" : ""}`} aria-label={favorite ? copy.favoriteRemove : copy.favoriteAdd} aria-pressed={favorite} onClick={onToggleFavorite}><Star aria-hidden="true" fill={favorite ? "currentColor" : "none"}/></button> : null}</div>{getKpiHref ? <a href={getKpiHref()}>{content}</a> : <button className="kpi-card-open" type="button" onClick={onOpen}>{content}</button>}</article>;
}

export function KpiCatalog({ items, view = "table", loading, getKpiHref, onOpenKpi, messages }: { items: KpiSummary[]; view?: KpiCatalogView; loading?: boolean; getKpiHref?: (key: string) => string; onOpenKpi?: (key: string) => void; messages?: KpiMessages }) {
  const copy = { ...defaultMessages, ...messages };
  if (loading && items.length === 0) return <div className="kpi-empty" role="status">{copy.loading}</div>;
  if (items.length === 0) return <div className="kpi-empty"><Search aria-hidden="true"/><h2>{copy.empty}</h2><p>{copy.emptyDescription}</p></div>;
  if (view === "cards") return <div className="kpi-compact-grid">{items.map((kpi) => <KpiCard key={kpi.indicatorKey} kpi={kpi} getKpiHref={getKpiHref ? () => getKpiHref(kpi.indicatorKey) : undefined} onOpen={onOpenKpi ? () => onOpenKpi(kpi.indicatorKey) : undefined} messages={copy}/>)}</div>;
  return <div className="kpi-data-table-wrap"><table className="kpi-data-table"><thead><tr><th>Indicatore</th><th>Dominio</th><th className="number">Valore corrente</th><th className="number">Variazione</th><th>Periodo</th><th>Aggiornato</th></tr></thead><tbody>{items.map((kpi) => {
    const label = <><strong>{kpi.label}</strong><code>{kpi.indicatorKey}</code></>;
    return <tr key={kpi.indicatorKey}><td>{getKpiHref ? <a className="kpi-metric-link" href={getKpiHref(kpi.indicatorKey)}>{label}</a> : <button type="button" className="kpi-metric-link kpi-link-button" onClick={() => onOpenKpi?.(kpi.indicatorKey)}>{label}</button>}</td><td><span className="kpi-badge">{kpi.domain}</span></td><td className="number kpi-metric-value">{formatKpiValue(kpi.current, kpi.unit)}</td><td className={`number kpi-delta ${(kpi.delta ?? 0) > 0 ? "positive" : (kpi.delta ?? 0) < 0 ? "negative" : ""}`}>{kpi.delta === null ? "—" : `${kpi.delta > 0 ? "+" : ""}${kpi.delta.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`}</td><td>{kpi.current?.period.slice(0, 7) ?? "—"}</td><td><time>{formatKpiDate(kpi.generatedAt)}</time></td></tr>;
  })}</tbody></table></div>;
}

export type KpiCatalogWorkspaceProps = {
  items: KpiSummary[];
  state: KpiCatalogState;
  domains: string[];
  savedViews?: KpiSavedView[];
  showSavedViews?: boolean;
  canPersist?: boolean;
  loading?: boolean;
  page: number;
  pageCount: number;
  total: number;
  getKpiHref?: (key: string) => string;
  onOpenKpi?: (key: string) => void;
  onStateChange: (state: KpiCatalogState) => void;
  onPageChange: (page: number) => void;
  onSaveView?: (name: string, state: KpiCatalogState) => Promise<void> | void;
  onRemoveView?: (viewKey: string) => Promise<void> | void;
  messages?: KpiMessages;
};

export function KpiCatalogWorkspace(props: KpiCatalogWorkspaceProps) {
  const { state } = props;
  const [viewName, setViewName] = useState("");
  const update = (patch: Partial<KpiCatalogState>) => props.onStateChange({ ...state, ...patch });
  function applySavedView(saved: KpiSavedView) { const parsed = parseSavedView(saved.definition); if (parsed) props.onStateChange(parsed); }
  async function saveView() { const name = viewName.trim(); if (!name || !props.onSaveView) return; await props.onSaveView(name, state); setViewName(""); }
  return <section className="kpi-catalog-workspace">
    {props.showSavedViews ? <section className="kpi-saved-views-panel" aria-label="Viste salvate"><div><h2>Viste salvate</h2><p>Richiama una combinazione personale di ricerca, filtri e ordinamento.</p></div><div className="kpi-saved-view-list">{props.savedViews?.length ? props.savedViews.map((saved) => <div className="kpi-saved-view" key={saved.viewKey}><button type="button" onClick={() => applySavedView(saved)}>{saved.name}</button>{props.onRemoveView ? <button type="button" aria-label={`Elimina vista ${saved.name}`} onClick={() => void props.onRemoveView?.(saved.viewKey)}><Trash2 aria-hidden="true"/></button> : null}</div>) : <span>Nessuna vista salvata.</span>}</div></section> : null}
    <div className="kpi-catalog-toolbar"><label className="kpi-catalog-search"><Search aria-hidden="true"/><span className="sr-only">Cerca nel catalogo</span><input value={state.query} onChange={(event) => update({ query: event.target.value })} placeholder={defaultMessages.searchPlaceholder}/></label><label className="kpi-filter-control">Dominio<select value={state.domain ?? "all"} onChange={(event) => update({ domain: event.target.value === "all" ? undefined : event.target.value })}><option value="all">Tutti</option>{props.domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select></label><label className="kpi-filter-control">Ordina<select value={state.sort} onChange={(event) => update({ sort: event.target.value as KpiCatalogSort })}><option value="label">Indicatore</option><option value="domain">Dominio</option><option value="value">Valore</option><option value="updated">Aggiornamento</option></select></label><button type="button" className="kpi-icon-button" onClick={() => update({ descending: !state.descending })} aria-label={state.descending ? "Ordine decrescente" : "Ordine crescente"}>{state.descending ? <ArrowDown aria-hidden="true"/> : <ArrowUp aria-hidden="true"/>}</button><div className="kpi-segmented kpi-view-toggle"><button type="button" aria-pressed={state.view === "table"} onClick={() => update({ view: "table" })}><List aria-hidden="true"/><span className="sr-only">Tabella</span></button><button type="button" aria-pressed={state.view === "cards"} onClick={() => update({ view: "cards" })}><Grid2X2 aria-hidden="true"/><span className="sr-only">Card</span></button></div></div>
    {props.canPersist && props.onSaveView ? <div className="kpi-save-view-bar"><BookmarkPlus aria-hidden="true"/><input aria-label="Nome vista" placeholder="Nome della vista…" value={viewName} onChange={(event) => setViewName(event.target.value)}/><button type="button" disabled={!viewName.trim()} onClick={() => void saveView()}>Salva vista</button></div> : null}
    <div className="kpi-results-meta"><span><strong>{props.total}</strong> KPI</span><span>Pagina {props.page} di {props.pageCount}</span></div>
    <KpiCatalog items={props.items} view={state.view} loading={props.loading} getKpiHref={props.getKpiHref} onOpenKpi={props.onOpenKpi} messages={props.messages}/>
    <footer className="kpi-pagination"><button type="button" disabled={props.page === 1} onClick={() => props.onPageChange(props.page - 1)}>{defaultMessages.previous}</button><span>{props.total ? (props.page - 1) * 50 + 1 : 0}–{Math.min(props.page * 50, props.total)} di {props.total}</span><button type="button" disabled={props.page === props.pageCount} onClick={() => props.onPageChange(props.page + 1)}>{defaultMessages.next}</button></footer>
  </section>;
}

export function useCatalogProjection(items: KpiSummary[], state: KpiCatalogState) {
  return useMemo(() => {
    const needle = state.query.trim().toLocaleLowerCase("it");
    const filtered = items.filter((item) => (!state.domain || item.domain === state.domain) && (!needle || [item.label, item.domain, item.indicatorKey].some((value) => value.toLocaleLowerCase("it").includes(needle))));
    const multiplier = state.descending ? -1 : 1;
    return filtered.sort((a, b) => {
      if (state.sort === "value") return multiplier * ((a.current?.value ?? -Infinity) - (b.current?.value ?? -Infinity));
      if (state.sort === "updated") return multiplier * a.generatedAt.localeCompare(b.generatedAt);
      return multiplier * (state.sort === "domain" ? a.domain.localeCompare(b.domain, "it") : a.label.localeCompare(b.label, "it"));
    });
  }, [items, state]);
}
