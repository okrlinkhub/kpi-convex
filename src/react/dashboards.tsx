"use client";

import { AreaChart as AreaChartIcon, ArrowRight, BarChart3, GripVertical, LayoutDashboard, PieChart, Plus, Star, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { DashboardFavoritePerson, DashboardPickerItem, DashboardSummary, DashboardView, WidgetChartMode } from "./model.js";
import { formatKpiValue } from "./model.js";
import { KpiWorkspaceHeader } from "./catalog.js";
import { WidgetChart } from "./charts.js";

const widgetChartModes: Array<{ id: WidgetChartMode; label: string; icon: typeof PieChart }> = [
  { id: "pie", label: "Torta", icon: PieChart },
  { id: "bar", label: "Barre", icon: BarChart3 },
  { id: "area", label: "Area", icon: AreaChartIcon },
];

export function DashboardFavoritePeople({ count, people }: { count: number; people: DashboardFavoritePerson[] }) {
  const remaining = Math.max(0, count - people.length);
  return <details className="kpi-dashboard-favorite-people"><summary><Users aria-hidden="true"/><span>{count === 1 ? "1 persona" : `${count} persone`}</span></summary><div>{people.length === 0 ? <span>Nessuna persona ha ancora salvato questa dashboard.</span> : people.map((person) => <span className="kpi-person-chip" key={person.userId}>{person.displayName}{person.isCurrentUser ? " (tu)" : ""}</span>)}{remaining > 0 ? <span className="kpi-person-chip">+{remaining}</span> : null}</div></details>;
}

export type DashboardHomeProps = {
  appName: string;
  boards: DashboardSummary[];
  pickerItems: DashboardPickerItem[];
  favoritesOnly?: boolean;
  loading?: boolean;
  canEdit?: boolean;
  getDashboardHref?: (id: string) => string;
  onOpenDashboard?: (id: string) => void;
  onToggleFavorite?: (id: string, favorite: boolean) => Promise<void> | void;
  onCreateDashboard?: (input: { name: string; indicatorKeys: string[] }) => Promise<string | void> | string | void;
};

export function DashboardHome(props: DashboardHomeProps) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("it");
    return props.pickerItems.filter((item) => !needle || [item.label, item.domain, item.indicatorKey].some((value) => value.toLocaleLowerCase("it").includes(needle)));
  }, [props.pickerItems, query]);
  const visible = props.favoritesOnly ? props.boards.filter((board) => board.isFavorite) : props.boards;
  async function create() {
    if (!props.onCreateDashboard || saving || !name.trim()) return;
    setSaving(true); setNotice(null);
    try {
      const id = await props.onCreateDashboard({ name: name.trim(), indicatorKeys: selected });
      setCreating(false); setName(""); setSelected([]);
      if (id) props.onOpenDashboard?.(id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Creazione non riuscita"); }
    finally { setSaving(false); }
  }
  return <section className="kpi-dashboard-page"><KpiWorkspaceHeader eyebrow={props.appName} title={props.favoritesOnly ? "Dashboard preferite" : "Dashboard"} description="Componi viste dagli indicatori di catalogo. I valori restano su Convex finché non apri il dettaglio." action={props.canEdit ? <button className="kpi-button primary" type="button" onClick={() => setCreating(true)}><Plus aria-hidden="true"/>Nuova dashboard</button> : undefined}/>
    {notice ? <div className="kpi-notice" role="status">{notice}</div> : null}
    {props.loading ? <div className="kpi-notice" role="status">Caricamento dashboard…</div> : visible.length === 0 ? <div className="kpi-empty"><LayoutDashboard aria-hidden="true"/><h2>{props.favoritesOnly ? "Nessuna dashboard preferita" : "Nessuna dashboard"}</h2><p>{props.favoritesOnly ? "Salva come preferite le dashboard che vuoi ritrovare qui." : "Crea la prima dashboard e scegli gli indicatori dal catalogo."}</p></div> : <section className="kpi-dashboard-list" aria-label={props.favoritesOnly ? "Dashboard preferite" : "Dashboard disponibili"}><header><span>Dashboard</span><span>Indicatori</span><span>Salvata da</span><span>Aggiornata</span><span className="sr-only">Azioni</span></header>{visible.map((board) => {
      const content = <><strong>{board.name}</strong><span>{board.description || "Nessuna descrizione"}</span></>;
      return <article className="kpi-dashboard-row" key={board.id}><button type="button" className={`kpi-star ${board.isFavorite ? "active" : ""}`} aria-label={board.isFavorite ? `Rimuovi ${board.name} dalle preferite` : `Salva ${board.name} tra le preferite`} aria-pressed={board.isFavorite} onClick={() => void props.onToggleFavorite?.(board.id, !board.isFavorite)} disabled={!props.onToggleFavorite}><Star aria-hidden="true" fill={board.isFavorite ? "currentColor" : "none"}/></button>{props.getDashboardHref ? <a className="kpi-dashboard-row-main" href={props.getDashboardHref(board.id)}>{content}</a> : <button className="kpi-dashboard-row-main link-button" type="button" onClick={() => props.onOpenDashboard?.(board.id)}>{content}</button>}<strong className="kpi-dashboard-row-count">{board.widgetCount}</strong><DashboardFavoritePeople count={board.favoriteCount} people={board.favoritedBy}/><time>{new Date(board.updatedAt).toLocaleDateString("it-IT")}</time>{props.getDashboardHref ? <a className="kpi-row-action" aria-label={`Apri ${board.name}`} href={props.getDashboardHref(board.id)}><ArrowRight aria-hidden="true"/></a> : <button type="button" className="kpi-row-action" aria-label={`Apri ${board.name}`} onClick={() => props.onOpenDashboard?.(board.id)}><ArrowRight aria-hidden="true"/></button>}</article>;
    })}</section>}
    {creating ? <div className="kpi-picker-overlay" role="dialog" aria-modal="true" aria-labelledby="new-dashboard-title"><section className="kpi-picker-card"><header><h2 id="new-dashboard-title">Nuova dashboard</h2><p>Nome e indicatori dal catalogo. I valori arriveranno al prossimo aggiornamento.</p></header><label className="kpi-filter-control stacked">Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Direzione, Vendite, People…"/></label><label className="kpi-catalog-search"><span className="sr-only">Cerca indicatori</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nel catalogo…"/></label><div className="kpi-picker-list">{filtered.length === 0 ? <div className="kpi-empty compact">Nessun indicatore in catalogo.</div> : filtered.map((item) => { const checked = selected.includes(item.indicatorKey); return <label key={item.indicatorKey} className="kpi-picker-item"><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 12} onChange={() => setSelected((current) => checked ? current.filter((key) => key !== item.indicatorKey) : [...current, item.indicatorKey])}/><span><strong>{item.label}</strong><small>{item.domain}</small></span></label>; })}</div><footer><button className="kpi-button" type="button" onClick={() => { setCreating(false); setName(""); setSelected([]); }}>Annulla</button><button className="kpi-button primary" type="button" disabled={!name.trim() || saving} onClick={() => void create()}>{saving ? "Creazione…" : "Crea dashboard"}</button></footer></section></div> : null}
  </section>;
}

export type DashboardBoardProps = {
  board: DashboardView;
  pickerItems: DashboardPickerItem[];
  canEdit?: boolean;
  getBackHref?: () => string;
  onBack?: () => void;
  getKpiHref?: (key: string) => string;
  onOpenKpi?: (key: string) => void;
  onToggleFavorite?: (favorite: boolean) => Promise<void> | void;
  onAddWidget?: (indicatorKey: string) => Promise<void> | void;
  onRemoveWidget?: (widgetId: string) => Promise<void> | void;
  onReorderWidgets?: (widgetIds: string[]) => Promise<void> | void;
  onSetWidgetChartMode?: (widgetId: string, mode: WidgetChartMode) => Promise<void> | void;
  onRemoveDashboard?: () => Promise<void> | void;
};

export function DashboardBoard(props: DashboardBoardProps) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const used = useMemo(() => new Set(props.board.widgets.map((widget) => widget.indicatorKey)), [props.board.widgets]);
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase("it"); return props.pickerItems.filter((item) => !used.has(item.indicatorKey) && (!needle || [item.label, item.domain, item.indicatorKey].some((value) => value.toLocaleLowerCase("it").includes(needle)))); }, [props.pickerItems, query, used]);
  const widgets = useMemo(() => { const byId = new Map(props.board.widgets.map((widget) => [widget.widgetId, widget])); return (localOrder ?? props.board.widgets.map((widget) => widget.widgetId)).flatMap((id) => { const widget = byId.get(id); return widget ? [widget] : []; }); }, [localOrder, props.board.widgets]);
  async function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = widgets.map((widget) => widget.widgetId); const from = ids.indexOf(dragId); const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids]; const [moved] = next.splice(from, 1); if (!moved) return; next.splice(to, 0, moved); setLocalOrder(next); setDragId(null);
    try { await props.onReorderWidgets?.(next); } catch { setNotice("Impossibile riordinare i widget"); setLocalOrder(null); }
  }
  return <section className="kpi-dashboard-page">{props.onBack ? <button className="kpi-breadcrumb" type="button" onClick={props.onBack}>← Dashboard</button> : <a className="kpi-breadcrumb" href={props.getBackHref?.() ?? "/"}>← Dashboard</a>}<KpiWorkspaceHeader eyebrow="Dashboard" title={props.board.name} description="Valori da snapshot Convex. Il dettaglio KPI legge ClickHouse in live e non aggiorna questa vista." action={<div className="kpi-dashboard-head-actions"><div className={`kpi-freshness-pill ${props.board.widgets.some((widget) => widget.status === "pending") ? "degraded" : ""}`}><span className="kpi-live-dot"/><div><strong>Ultimo aggiornamento</strong><time>{props.board.refreshedAt ? new Date(props.board.refreshedAt).toLocaleString("it-IT") : "In attesa dello snapshot"}</time></div></div><div className="kpi-metric-actions"><button type="button" className={`kpi-icon-button ${props.board.isFavorite ? "active" : ""}`} aria-label={props.board.isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"} onClick={() => void props.onToggleFavorite?.(!props.board.isFavorite)}><Star aria-hidden="true" fill={props.board.isFavorite ? "currentColor" : "none"}/></button>{props.canEdit ? <><button className="kpi-button" type="button" onClick={() => setAdding(true)}><Plus aria-hidden="true"/>Aggiungi indicatore</button>{props.onRemoveDashboard ? <button className="kpi-button" type="button" onClick={() => void props.onRemoveDashboard?.()}><Trash2 aria-hidden="true"/>Elimina</button> : null}</> : null}</div><DashboardFavoritePeople count={props.board.favoriteCount} people={props.board.favoritedBy}/></div>}/>
    {notice ? <div className="kpi-notice" role="status">{notice}</div> : null}
    {widgets.length === 0 ? <div className="kpi-empty"><h2>Nessun indicatore</h2><p>Aggiungi KPI dal catalogo. I numeri compariranno al prossimo aggiornamento valori.</p></div> : <div className="kpi-dashboard-widget-grid">{widgets.map((widget) => { const content = <><h2>{widget.label}</h2><strong>{formatKpiValue(widget.current, widget.unit)}</strong><span className={`kpi-delta ${(widget.delta ?? 0) > 0 ? "positive" : (widget.delta ?? 0) < 0 ? "negative" : ""}`}>{widget.delta === null ? "Variazione non disponibile" : `${widget.delta > 0 ? "+" : ""}${widget.delta.toLocaleString("it-IT")}`}</span></>; return <article className={`kpi-metric-card kpi-dashboard-widget${dragId === widget.widgetId ? " dragging" : ""}`} key={widget.widgetId} draggable={Boolean(props.canEdit && props.onReorderWidgets)} onDragStart={(event) => { setDragId(widget.widgetId); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { if (dragId) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); void drop(widget.widgetId); }} onDragEnd={() => setDragId(null)}><div><span className="kpi-badge">{widget.domain || "Catalogo"}</span><span className="kpi-widget-actions"><div className="kpi-segmented" aria-label={`Tipo di grafico ${widget.label}`}>{widgetChartModes.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={widget.chartMode === id} aria-label={label} disabled={!props.onSetWidgetChartMode} onClick={() => void props.onSetWidgetChartMode?.(widget.widgetId, id)}><Icon aria-hidden="true"/></button>)}</div>{props.canEdit ? <><span className="kpi-icon-button drag-handle" aria-hidden="true"><GripVertical/></span><button className="kpi-icon-button" type="button" aria-label={`Rimuovi ${widget.label}`} onClick={() => void props.onRemoveWidget?.(widget.widgetId)}><Trash2 aria-hidden="true"/></button></> : null}</span></div>{props.getKpiHref ? <a href={props.getKpiHref(widget.indicatorKey)}>{content}</a> : <button type="button" className="kpi-card-open" onClick={() => props.onOpenKpi?.(widget.indicatorKey)}>{content}</button>}<WidgetChart points={widget.points} unit={widget.unit} mode={widget.chartMode}/>{widget.status !== "ready" ? <small>{widget.status === "pending" ? "In attesa di snapshot" : "Non più in catalogo"}</small> : null}</article>; })}</div>}
    {adding ? <div className="kpi-picker-overlay" role="dialog" aria-modal="true" aria-labelledby="add-widget-title"><section className="kpi-picker-card"><header><h2 id="add-widget-title">Aggiungi dal catalogo</h2><p>L’indicatore userà lo snapshot Convex, senza interrogare ClickHouse ora.</p></header><label className="kpi-catalog-search"><span className="sr-only">Cerca indicatori</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nel catalogo…"/></label><div className="kpi-picker-list">{filtered.length === 0 ? <div className="kpi-empty compact">Nessun indicatore da aggiungere.</div> : filtered.map((item) => <button className="kpi-picker-item" type="button" key={item.indicatorKey} onClick={async () => { try { await props.onAddWidget?.(item.indicatorKey); setAdding(false); setQuery(""); } catch (error) { setNotice(error instanceof Error ? error.message : "Aggiunta non riuscita"); } }}><span><strong>{item.label}</strong><small>{item.domain}</small></span></button>)}</div><footer><button className="kpi-button" type="button" onClick={() => setAdding(false)}>Chiudi</button></footer></section></div> : null}
  </section>;
}
