"use client";

import {
  AreaChart as AreaChartIcon,
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  GripVertical,
  LayoutDashboard,
  PieChart,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  DashboardFavoritePerson,
  DashboardPickerItem,
  DashboardSummary,
  DashboardView,
  WidgetChartMode,
} from "./model.js";
import { formatKpiValue } from "./model.js";
import { KpiWorkspaceHeader } from "./catalog.js";
import { WidgetChart } from "./charts.js";
import { dashboardNameKey } from "../component/dashboardNames.js";

const widgetChartModes: Array<{
  id: WidgetChartMode;
  label: string;
  icon: typeof PieChart;
}> = [
  { id: "pie", label: "Torta", icon: PieChart },
  { id: "bar", label: "Barre", icon: BarChart3 },
  { id: "area", label: "Area", icon: AreaChartIcon },
];

export function DashboardFavoritePeople({
  count,
  people,
}: {
  count: number;
  people: DashboardFavoritePerson[];
}) {
  const remaining = Math.max(0, count - people.length);
  return (
    <details className="kpi-dashboard-favorite-people">
      <summary>
        <Users aria-hidden="true" />
        <span>{count === 1 ? "1 persona" : `${count} persone`}</span>
      </summary>
      <div>
        {count === 0 ? (
          <span>Nessuna persona ha ancora salvato questa dashboard.</span>
        ) : people.length === 0 ? (
          <span>
            Salvata da {count === 1 ? "1 persona" : `${count} persone`}. Le
            identità restano private.
          </span>
        ) : (
          people.map((person) => (
            <span className="kpi-person-chip" key={person.userId}>
              {person.isCurrentUser ? "Tu" : person.displayName}
            </span>
          ))
        )}
        {remaining > 0 ? (
          <span className="kpi-person-chip">
            +{remaining} {remaining === 1 ? "altra persona" : "altre persone"}
          </span>
        ) : null}
      </div>
    </details>
  );
}

export type DashboardHomeProps = {
  appName?: string;
  boards: DashboardSummary[];
  pickerItems: DashboardPickerItem[];
  favoritesOnly?: boolean;
  defaultFavoritesOnly?: boolean;
  onFavoritesOnlyChange?: (favoritesOnly: boolean) => void;
  loading?: boolean;
  pickerLoading?: boolean;
  creating?: boolean;
  onCreatingChange?: (open: boolean) => void;
  canEdit?: boolean;
  navigation?: ReactNode;
  getDashboardHref?: (id: string) => string;
  onOpenDashboard?: (id: string) => void;
  onToggleFavorite?: (id: string, favorite: boolean) => Promise<void> | void;
  onCreateDashboard?: (input: {
    name: string;
    indicatorKeys: string[];
  }) => Promise<string | void> | string | void;
};

export function DashboardHome(props: DashboardHomeProps) {
  const [internalFavoritesOnly, setInternalFavoritesOnly] = useState(
    props.defaultFavoritesOnly ?? true,
  );
  const favoritesOnly = props.favoritesOnly ?? internalFavoritesOnly;
  const setFavoritesOnly = (next: boolean) => {
    setInternalFavoritesOnly(next);
    props.onFavoritesOnlyChange?.(next);
  };
  const [internalCreating, setInternalCreating] = useState(false);
  const creating = props.creating ?? internalCreating;
  const setCreating = (open: boolean) => {
    setInternalCreating(open);
    props.onCreatingChange?.(open);
  };
  const [saving, setSaving] = useState(false);
  const createInFlight = useRef(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const needle = pickerQuery.trim().toLocaleLowerCase("it");
    return props.pickerItems.filter(
      (item) =>
        !needle ||
        [item.label, item.domain, item.indicatorKey].some((value) =>
          value.toLocaleLowerCase("it").includes(needle),
        ),
    );
  }, [pickerQuery, props.pickerItems]);
  const visible = useMemo(() => {
    const needle = dashboardQuery.trim().toLocaleLowerCase("it");
    return props.boards
      .filter(
        (board) =>
          (!favoritesOnly || board.isFavorite) &&
          (!needle ||
            [board.name, board.description ?? ""].some((value) =>
              value.toLocaleLowerCase("it").includes(needle),
            )),
      )
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name, "it", {
            numeric: true,
            sensitivity: "base",
          }) || left.id.localeCompare(right.id),
      );
  }, [dashboardQuery, favoritesOnly, props.boards]);
  const duplicateName = useMemo(() => {
    const proposedName = dashboardNameKey(name);
    return Boolean(
      proposedName &&
      props.boards.some(
        (board) => dashboardNameKey(board.name) === proposedName,
      ),
    );
  }, [name, props.boards]);
  async function create() {
    if (
      !props.onCreateDashboard ||
      createInFlight.current ||
      !name.trim() ||
      duplicateName
    )
      return;
    createInFlight.current = true;
    setSaving(true);
    setNotice(null);
    try {
      const id = await props.onCreateDashboard({
        name: name.trim(),
        indicatorKeys: selected,
      });
      setCreating(false);
      setName("");
      setSelected([]);
      if (id) props.onOpenDashboard?.(id);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Creazione non riuscita",
      );
    } finally {
      createInFlight.current = false;
      setSaving(false);
    }
  }
  return (
    <section className="kpi-dashboard-page">
      <KpiWorkspaceHeader
        eyebrow={props.appName}
        title="Dashboard"
        navigation={props.navigation}
        action={
          props.canEdit ? (
            <button
              className="kpi-button primary"
              type="button"
              onClick={() => setCreating(true)}
            >
              <Plus aria-hidden="true" />
              Nuova dashboard
            </button>
          ) : undefined
        }
      />
      {notice ? (
        <div className="kpi-notice" role="status">
          {notice}
        </div>
      ) : null}
      <div className="kpi-dashboard-toolbar">
        <label className="kpi-catalog-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Cerca dashboard</span>
          <input
            type="search"
            value={dashboardQuery}
            onChange={(event) => setDashboardQuery(event.target.value)}
            placeholder="Cerca dashboard…"
          />
        </label>
        <div className="kpi-segmented" aria-label="Visualizzazione dashboard">
          <button
            type="button"
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly(true)}
          >
            <Star
              aria-hidden="true"
              fill={favoritesOnly ? "currentColor" : "none"}
            />
            Preferite
          </button>
          <button
            type="button"
            aria-pressed={!favoritesOnly}
            onClick={() => setFavoritesOnly(false)}
          >
            Tutte
          </button>
        </div>
      </div>
      {props.loading ? (
        <div className="kpi-notice" role="status">
          Caricamento dashboard…
        </div>
      ) : visible.length === 0 ? (
        <div className="kpi-empty">
          <LayoutDashboard aria-hidden="true" />
          <h2>
            {dashboardQuery.trim()
              ? "Nessuna dashboard trovata"
              : favoritesOnly
                ? "Nessuna dashboard preferita"
                : "Nessuna dashboard"}
          </h2>
          <p>
            {dashboardQuery.trim()
              ? "Prova con un nome o una descrizione diversa."
              : favoritesOnly
                ? "Salva come preferite le dashboard che vuoi ritrovare qui."
                : "Crea la prima dashboard e scegli gli indicatori dal catalogo."}
          </p>
          {!dashboardQuery.trim() &&
          favoritesOnly &&
          props.boards.length > 0 ? (
            <button
              className="kpi-button"
              type="button"
              onClick={() => setFavoritesOnly(false)}
            >
              Mostra tutte
            </button>
          ) : null}
        </div>
      ) : (
        <section
          className="kpi-dashboard-list"
          aria-label={
            favoritesOnly ? "Dashboard preferite" : "Dashboard disponibili"
          }
        >
          <header>
            <span>Dashboard</span>
            <span>Indicatori</span>
            <span>Salvata da</span>
            <span>Aggiornata</span>
            <span className="sr-only">Azioni</span>
          </header>
          {visible.map((board) => {
            const content = (
              <>
                <strong>{board.name}</strong>
                {board.description ? <span>{board.description}</span> : null}
              </>
            );
            return (
              <article className="kpi-dashboard-row" key={board.id}>
                {props.getDashboardHref ? (
                  <a
                    className="kpi-dashboard-row-hitarea"
                    aria-label={`Apri ${board.name}`}
                    href={props.getDashboardHref(board.id)}
                  />
                ) : (
                  <button
                    className="kpi-dashboard-row-hitarea"
                    type="button"
                    aria-label={`Apri ${board.name}`}
                    onClick={() => props.onOpenDashboard?.(board.id)}
                  />
                )}
                <button
                  type="button"
                  className={`kpi-star ${board.isFavorite ? "active" : ""}`}
                  aria-label={
                    board.isFavorite
                      ? `Rimuovi ${board.name} dalle preferite`
                      : `Salva ${board.name} tra le preferite`
                  }
                  aria-pressed={board.isFavorite}
                  onClick={() =>
                    void props.onToggleFavorite?.(board.id, !board.isFavorite)
                  }
                  disabled={!props.onToggleFavorite}
                >
                  <Star
                    aria-hidden="true"
                    fill={board.isFavorite ? "currentColor" : "none"}
                  />
                </button>
                <div className="kpi-dashboard-row-main">{content}</div>
                <strong className="kpi-dashboard-row-count">
                  {board.widgetCount}
                </strong>
                <DashboardFavoritePeople
                  count={board.favoriteCount}
                  people={board.favoritedBy}
                />
                <time>
                  {new Date(board.updatedAt).toLocaleDateString("it-IT")}
                </time>
                <span className="kpi-row-action" aria-hidden="true">
                  <ArrowRight />
                </span>
              </article>
            );
          })}
        </section>
      )}
      {creating ? (
        <div
          className="kpi-picker-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-dashboard-title"
        >
          <section className="kpi-picker-card">
            <header>
              <h2 id="new-dashboard-title">Nuova dashboard</h2>
              <p>Scegli un nome e gli indicatori da mostrare.</p>
            </header>
            <label className="kpi-filter-control stacked">
              Nome
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Direzione, Vendite, People…"
                aria-invalid={duplicateName}
                aria-describedby={
                  duplicateName ? "dashboard-name-error" : undefined
                }
              />
              {duplicateName ? (
                <small className="kpi-field-error" id="dashboard-name-error">
                  Esiste già una dashboard con questo nome.
                </small>
              ) : null}
            </label>
            <label className="kpi-catalog-search">
              <span className="sr-only">Cerca indicatori</span>
              <input
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Cerca nel catalogo…"
              />
            </label>
            <div className="kpi-picker-list">
              {props.pickerLoading ? (
                <div className="kpi-empty compact" role="status">
                  Caricamento indicatori…
                </div>
              ) : filtered.length === 0 ? (
                <div className="kpi-empty compact">
                  Nessun indicatore in catalogo.
                </div>
              ) : (
                filtered.map((item) => {
                  const checked = selected.includes(item.indicatorKey);
                  return (
                    <label key={item.indicatorKey} className="kpi-picker-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && selected.length >= 12}
                        onChange={() =>
                          setSelected((current) =>
                            checked
                              ? current.filter(
                                  (key) => key !== item.indicatorKey,
                                )
                              : [...current, item.indicatorKey],
                          )
                        }
                      />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.domain}</small>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <footer>
              <button
                className="kpi-button"
                type="button"
                onClick={() => {
                  setCreating(false);
                  setName("");
                  setSelected([]);
                }}
              >
                Annulla
              </button>
              <button
                className="kpi-button primary"
                type="button"
                disabled={!name.trim() || duplicateName || saving}
                onClick={() => void create()}
              >
                {saving ? "Creazione…" : "Crea dashboard"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export type DashboardBoardProps = {
  board: DashboardView;
  highlightIndicatorKey?: string;
  pickerItems: DashboardPickerItem[];
  pickerLoading?: boolean;
  adding?: boolean;
  onAddingChange?: (open: boolean) => void;
  canEdit?: boolean;
  getBackHref?: () => string;
  onBack?: () => void;
  getKpiHref?: (key: string) => string;
  onOpenKpi?: (key: string) => void;
  getDashboardShareUrl?: () => string;
  getKpiShareUrl?: (key: string) => string;
  onToggleFavorite?: (favorite: boolean) => Promise<void> | void;
  onAddWidget?: (indicatorKey: string) => Promise<void> | void;
  onRemoveWidget?: (widgetId: string) => Promise<void> | void;
  onReorderWidgets?: (widgetIds: string[]) => Promise<void> | void;
  onSetWidgetChartMode?: (
    widgetId: string,
    mode: WidgetChartMode,
  ) => Promise<void> | void;
  onRemoveDashboard?: () => Promise<void> | void;
};

export function DashboardBoard(props: DashboardBoardProps) {
  const [internalAdding, setInternalAdding] = useState(false);
  const adding = props.adding ?? internalAdding;
  const setAdding = (open: boolean) => {
    setInternalAdding(open);
    props.onAddingChange?.(open);
  };
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const copyResetTimer = useRef<number | null>(null);
  const used = useMemo(
    () => new Set(props.board.widgets.map((widget) => widget.indicatorKey)),
    [props.board.widgets],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("it");
    return props.pickerItems.filter(
      (item) =>
        !used.has(item.indicatorKey) &&
        (!needle ||
          [item.label, item.domain, item.indicatorKey].some((value) =>
            value.toLocaleLowerCase("it").includes(needle),
          )),
    );
  }, [props.pickerItems, query, used]);
  const widgets = useMemo(() => {
    const byId = new Map(
      props.board.widgets.map((widget) => [widget.widgetId, widget]),
    );
    return (
      localOrder ?? props.board.widgets.map((widget) => widget.widgetId)
    ).flatMap((id) => {
      const widget = byId.get(id);
      return widget ? [widget] : [];
    });
  }, [localOrder, props.board.widgets]);
  useEffect(() => {
    if (!props.highlightIndicatorKey) return;
    const element = document.getElementById(
      `kpi-widget-${encodeURIComponent(props.highlightIndicatorKey)}`,
    );
    if (!element) return;
    element.scrollIntoView?.({ behavior: "smooth", block: "center" });
    element.focus({ preventScroll: true });
  }, [props.highlightIndicatorKey, widgets]);
  useEffect(
    () => () => {
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current);
      }
    },
    [],
  );
  async function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = widgets.map((widget) => widget.widgetId);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setLocalOrder(next);
    setDragId(null);
    try {
      await props.onReorderWidgets?.(next);
    } catch {
      setNotice("Impossibile riordinare i widget");
      setLocalOrder(null);
    }
  }
  async function removeDashboard() {
    setRemoving(true);
    try {
      await props.onRemoveDashboard?.();
    } catch {
      setNotice("Impossibile eliminare la dashboard. Riprova.");
      setRemoving(false);
    }
  }
  async function copyLink(target: string, href: string) {
    try {
      const url =
        typeof window === "undefined"
          ? href
          : new URL(href, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setCopiedTarget(target);
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current);
      }
      copyResetTimer.current = window.setTimeout(() => {
        setCopiedTarget((current) => (current === target ? null : current));
      }, 1800);
    } catch {
      setNotice("Impossibile copiare il link. Riprova.");
    }
  }
  return (
    <section className="kpi-dashboard-page">
      {props.onBack ? (
        <button className="kpi-breadcrumb" type="button" onClick={props.onBack}>
          ← Dashboard
        </button>
      ) : (
        <a className="kpi-breadcrumb" href={props.getBackHref?.() ?? "/"}>
          ← Dashboard
        </a>
      )}
      <KpiWorkspaceHeader
        title={props.board.name}
        action={
          <div className="kpi-dashboard-head-actions">
            <div
              className={`kpi-freshness-pill ${props.board.widgets.some((widget) => widget.status === "pending") ? "degraded" : ""}`}
            >
              <span className="kpi-live-dot" />
              <div>
                <strong>Ultimo aggiornamento</strong>
                <time>
                  {props.board.refreshedAt
                    ? new Date(props.board.refreshedAt).toLocaleString("it-IT")
                    : "In attesa di aggiornamento"}
                </time>
              </div>
            </div>
            <div className="kpi-metric-actions">
              {props.getDashboardShareUrl ? (
                <button
                  type="button"
                  className="kpi-icon-button"
                  aria-label={
                    copiedTarget === "dashboard"
                      ? "URL dashboard copiato"
                      : "Copia URL dashboard"
                  }
                  title="Copia URL dashboard"
                  onClick={() =>
                    void copyLink(
                      "dashboard",
                      props.getDashboardShareUrl?.() ?? "",
                    )
                  }
                >
                  {copiedTarget === "dashboard" ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Copy aria-hidden="true" />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                className={`kpi-icon-button ${props.board.isFavorite ? "active" : ""}`}
                aria-label={
                  props.board.isFavorite
                    ? "Rimuovi dai preferiti"
                    : "Aggiungi ai preferiti"
                }
                onClick={() =>
                  void props.onToggleFavorite?.(!props.board.isFavorite)
                }
              >
                <Star
                  aria-hidden="true"
                  fill={props.board.isFavorite ? "currentColor" : "none"}
                />
              </button>
              {props.canEdit ? (
                <>
                  <button
                    className="kpi-button"
                    type="button"
                    onClick={() => setAdding(true)}
                  >
                    <Plus aria-hidden="true" />
                    Aggiungi indicatore
                  </button>
                  {props.onRemoveDashboard ? (
                    <button
                      className="kpi-button"
                      type="button"
                      onClick={() => setConfirmingRemoval(true)}
                    >
                      <Trash2 aria-hidden="true" />
                      Elimina
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            <DashboardFavoritePeople
              count={props.board.favoriteCount}
              people={props.board.favoritedBy}
            />
          </div>
        }
      />
      {notice ? (
        <div className="kpi-notice" role="status">
          {notice}
        </div>
      ) : null}
      {widgets.length === 0 ? (
        <div className="kpi-empty">
          <h2>Nessun indicatore</h2>
          <p>
            Aggiungi KPI dal catalogo. I numeri compariranno al prossimo
            aggiornamento valori.
          </p>
        </div>
      ) : (
        <div className="kpi-dashboard-widget-grid">
          {widgets.map((widget) => {
            const content = (
              <>
                <h2>{widget.label}</h2>
                <strong>{formatKpiValue(widget.current, widget.unit)}</strong>
                <span
                  className={`kpi-delta ${(widget.delta ?? 0) > 0 ? "positive" : (widget.delta ?? 0) < 0 ? "negative" : ""}`}
                >
                  {widget.delta === null
                    ? "Variazione non disponibile"
                    : `${widget.delta > 0 ? "+" : ""}${widget.delta.toLocaleString("it-IT")}`}
                </span>
              </>
            );
            return (
              <article
                id={`kpi-widget-${encodeURIComponent(widget.indicatorKey)}`}
                tabIndex={-1}
                aria-current={
                  props.highlightIndicatorKey === widget.indicatorKey
                    ? "true"
                    : undefined
                }
                className={`kpi-metric-card kpi-dashboard-widget${dragId === widget.widgetId ? " dragging" : ""}${props.highlightIndicatorKey === widget.indicatorKey ? " highlighted" : ""}`}
                key={widget.widgetId}
                draggable={Boolean(props.canEdit && props.onReorderWidgets)}
                onDragStart={(event) => {
                  setDragId(widget.widgetId);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (dragId) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void drop(widget.widgetId);
                }}
                onDragEnd={() => setDragId(null)}
              >
                <div>
                  <span className="kpi-badge">
                    {widget.domain || "Catalogo"}
                  </span>
                  <span className="kpi-widget-actions">
                    {props.getKpiShareUrl ? (
                      <button
                        className="kpi-icon-button"
                        type="button"
                        aria-label={
                          copiedTarget === widget.indicatorKey
                            ? `Link copiato per ${widget.label}`
                            : `Copia link ${widget.label}`
                        }
                        title={`Copia link ${widget.label}`}
                        onClick={() =>
                          void copyLink(
                            widget.indicatorKey,
                            props.getKpiShareUrl?.(widget.indicatorKey) ?? "",
                          )
                        }
                      >
                        {copiedTarget === widget.indicatorKey ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <Copy aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                    <div
                      className="kpi-segmented"
                      aria-label={`Tipo di grafico ${widget.label}`}
                    >
                      {widgetChartModes.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={widget.chartMode === id}
                          aria-label={label}
                          disabled={!props.onSetWidgetChartMode}
                          onClick={() =>
                            void props.onSetWidgetChartMode?.(
                              widget.widgetId,
                              id,
                            )
                          }
                        >
                          <Icon aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    {props.canEdit ? (
                      <>
                        <span
                          className="kpi-icon-button drag-handle"
                          aria-hidden="true"
                        >
                          <GripVertical />
                        </span>
                        <button
                          className="kpi-icon-button"
                          type="button"
                          aria-label={`Rimuovi ${widget.label}`}
                          onClick={() =>
                            void props.onRemoveWidget?.(widget.widgetId)
                          }
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </>
                    ) : null}
                  </span>
                </div>
                {props.getKpiHref ? (
                  <a href={props.getKpiHref(widget.indicatorKey)}>{content}</a>
                ) : (
                  <button
                    type="button"
                    className="kpi-card-open"
                    onClick={() => props.onOpenKpi?.(widget.indicatorKey)}
                  >
                    {content}
                  </button>
                )}
                <WidgetChart
                  points={widget.points}
                  unit={widget.unit}
                  mode={widget.chartMode}
                />
                {widget.status !== "ready" ? (
                  <small>
                    {widget.status === "pending"
                      ? "In attesa di snapshot"
                      : "Non più in catalogo"}
                  </small>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {adding ? (
        <div
          className="kpi-picker-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-widget-title"
        >
          <section className="kpi-picker-card">
            <header>
              <h2 id="add-widget-title">Aggiungi indicatore</h2>
              <p>Scegli un indicatore dal catalogo.</p>
            </header>
            <label className="kpi-catalog-search">
              <span className="sr-only">Cerca indicatori</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca nel catalogo…"
              />
            </label>
            <div className="kpi-picker-list">
              {props.pickerLoading ? (
                <div className="kpi-empty compact" role="status">
                  Caricamento indicatori…
                </div>
              ) : filtered.length === 0 ? (
                <div className="kpi-empty compact">
                  Nessun indicatore da aggiungere.
                </div>
              ) : (
                filtered.map((item) => (
                  <button
                    className="kpi-picker-item"
                    type="button"
                    key={item.indicatorKey}
                    onClick={async () => {
                      try {
                        await props.onAddWidget?.(item.indicatorKey);
                        setAdding(false);
                        setQuery("");
                      } catch (error) {
                        setNotice(
                          error instanceof Error
                            ? error.message
                            : "Aggiunta non riuscita",
                        );
                      }
                    }}
                  >
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.domain}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
            <footer>
              <button
                className="kpi-button"
                type="button"
                onClick={() => setAdding(false)}
              >
                Chiudi
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {confirmingRemoval ? (
        <div
          className="kpi-picker-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-dashboard-title"
          aria-describedby="remove-dashboard-description"
        >
          <section className="kpi-picker-card kpi-confirm-card">
            <header>
              <h2 id="remove-dashboard-title">Eliminare la dashboard?</h2>
              <p id="remove-dashboard-description">
                La dashboard e i suoi widget verranno eliminati. L’azione non
                può essere annullata.
              </p>
            </header>
            <footer>
              <button
                className="kpi-button"
                type="button"
                disabled={removing}
                onClick={() => setConfirmingRemoval(false)}
              >
                Annulla
              </button>
              <button
                className="kpi-button danger"
                type="button"
                disabled={removing}
                onClick={() => void removeDashboard()}
              >
                {removing ? "Eliminazione…" : "Elimina dashboard"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
