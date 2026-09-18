"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import type { KpiPoint, KpiSummary, SyncStatus, ViewerPreferences } from "../contracts/index.js";
import { KpiCatalogWorkspace, KpiWorkspaceHeader, useCatalogProjection } from "./catalog.js";
import type { KpiMessages } from "./catalog.js";
import { KpiDetail } from "./charts.js";
import type { KpiCatalogState, KpiChartMode, KpiSavedView } from "./model.js";

type CatalogListRef = FunctionReference<"query", "public", { paginationOpts: { numItems: number; cursor: string | null }; search?: string; domain?: string }, { page: KpiSummary[]; isDone: boolean; continueCursor: string }>;
type SummaryRef = FunctionReference<"query", "public", { indicatorKey: string }, KpiSummary | null>;
type SeriesRef = FunctionReference<"query", "public", { indicatorKey: string }, KpiPoint[]>;
type FavoritesRef = FunctionReference<"query", "public", Record<string, never>, string[]>;
type ToggleRef = FunctionReference<"mutation", "public", { indicatorKey: string }, boolean>;
type SavedViewsRef = FunctionReference<"query", "public", Record<string, never>, KpiSavedView[]>;
type SaveViewRef = FunctionReference<"mutation", "public", { viewKey: string; name: string; definition: unknown }, null>;
type RemoveViewRef = FunctionReference<"mutation", "public", { viewKey: string }, null>;
type PreferencesRef = FunctionReference<"query", "public", Record<string, never>, ViewerPreferences>;
type SavePreferencesRef = FunctionReference<"mutation", "public", { preferences: ViewerPreferences }, null>;
type SyncStatusRef = FunctionReference<"query", "public", Record<string, never>, SyncStatus>;
type LiveRef = FunctionReference<"action", "public", { indicatorKey: string; startDate: string; endDate: string; limit?: number }, { indicatorKey: string; history: KpiPoint[]; fetchedAt: number }>;

export type KpiReactReferences = {
  catalogList: CatalogListRef;
  catalogGet: SummaryRef;
  getSeries: SeriesRef;
  favoritesList: FavoritesRef;
  favoriteToggle: ToggleRef;
  savedViewsList: SavedViewsRef;
  savedViewSave: SaveViewRef;
  savedViewRemove: RemoveViewRef;
  preferencesGet: PreferencesRef;
  preferencesSave: SavePreferencesRef;
  syncStatus: SyncStatusRef;
  getLiveDetail: LiveRef;
};

const fallbackPreferences: ViewerPreferences = { theme: "system", catalogView: "table", density: "compact", defaultChartMode: "line" };

function rangeDates(range: string) {
  const end = new Date();
  const start = new Date(end);
  const days = range === "all" ? 730 : Math.min(730, Number(range) * 31);
  start.setUTCDate(start.getUTCDate() - days);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function createKpiReactBindings(refs: KpiReactReferences) {
  function BoundCatalog({ eyebrow = "KPI CONVEX", title, description, getKpiHref, onOpenKpi, showSavedViews = false, pageSize = 50, messages }: { eyebrow?: string; title?: string; description?: string; getKpiHref?: (key: string) => string; onOpenKpi?: (key: string) => void; showSavedViews?: boolean; pageSize?: number; messages?: KpiMessages }) {
    const preferences = useQuery(refs.preferencesGet, {});
    const savedViews = useQuery(refs.savedViewsList, {}) ?? [];
    const status = useQuery(refs.syncStatus, {});
    const saveView = useMutation(refs.savedViewSave);
    const removeView = useMutation(refs.savedViewRemove);
    const savePreferences = useMutation(refs.preferencesSave);
    const [state, setState] = useState<KpiCatalogState>({ query: "", sort: "label", descending: false, view: "table" });
    const [viewWasChosen, setViewWasChosen] = useState(false);
    const [page, setPage] = useState(1);
    const deferredQuery = useDeferredValue(state.query);
    const result = usePaginatedQuery(refs.catalogList, { ...(deferredQuery.trim() ? { search: deferredQuery.trim() } : {}), ...(state.domain ? { domain: state.domain } : {}) }, { initialNumItems: 100 });
    const effectiveState = viewWasChosen || !preferences ? state : { ...state, view: preferences.catalogView };
    const projected = useCatalogProjection(result.results, effectiveState);
    const domains = useMemo(() => [...new Set(result.results.map((item) => item.domain))].sort((a, b) => a.localeCompare(b, "it")), [result.results]);
    const pageCount = Math.max(1, Math.ceil(projected.length / pageSize) + (result.status === "CanLoadMore" ? 1 : 0));
    const items = projected.slice((page - 1) * pageSize, page * pageSize);
    function changeState(next: KpiCatalogState) {
      if (next.view !== effectiveState.view) {
        setViewWasChosen(true);
        void savePreferences({ preferences: { ...(preferences ?? fallbackPreferences), catalogView: next.view } });
      }
      setState(next); setPage(1);
    }
    function changePage(next: number) {
      if (next * pageSize > projected.length && result.status === "CanLoadMore") result.loadMore(100);
      setPage(next);
    }
    return <section className="kpi-catalog-page"><KpiWorkspaceHeader eyebrow={eyebrow} title={title} description={description} status={status}/><KpiCatalogWorkspace items={items} state={effectiveState} domains={domains} savedViews={savedViews} showSavedViews={showSavedViews} canPersist loading={result.status === "LoadingFirstPage" || result.status === "LoadingMore"} page={page} pageCount={pageCount} total={projected.length} getKpiHref={getKpiHref} onOpenKpi={onOpenKpi} onStateChange={changeState} onPageChange={changePage} onSaveView={(name, definition) => { void saveView({ viewKey: `view_${Date.now().toString(36)}`, name, definition }); }} onRemoveView={(viewKey) => { void removeView({ viewKey }); }} messages={messages}/></section>;
  }

  function BoundDetail({ indicatorKey, initialMode, getBackHref = () => "/", onBack }: { indicatorKey: string; initialMode?: KpiChartMode; getBackHref?: () => string; onBack?: () => void }) {
    const summary = useQuery(refs.catalogGet, { indicatorKey });
    const projectedPoints = useQuery(refs.getSeries, { indicatorKey }) ?? [];
    const preferences = useQuery(refs.preferencesGet, {});
    const savePreferences = useMutation(refs.preferencesSave);
    const getLiveDetail = useAction(refs.getLiveDetail);
    const [modeOverride, setModeOverride] = useState<KpiChartMode | null>(initialMode ?? null);
    const [range, setRange] = useState("12");
    const [livePoints, setLivePoints] = useState<KpiPoint[] | null>(null);
    const [liveState, setLiveState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
    const mode = modeOverride ?? preferences?.defaultChartMode ?? "line";
    useEffect(() => {
      let active = true;
      setLiveState("loading");
      void getLiveDetail({ indicatorKey, ...rangeDates(range), limit: 500 }).then((result) => { if (active) { setLivePoints(result.history); setLiveState("ready"); } }).catch(() => { if (active) { setLivePoints(null); setLiveState("unavailable"); } });
      return () => { active = false; };
    }, [getLiveDetail, indicatorKey, range]);
    if (summary === undefined) return <div className="kpi-empty" role="status">Caricamento KPI…</div>;
    if (summary === null) return <div className="kpi-empty"><h2>Indicatore non trovato</h2></div>;
    const source = livePoints ?? projectedPoints;
    const points = range === "all" ? source : source.slice(-Number(range));
    function changeMode(next: KpiChartMode) { setModeOverride(next); void savePreferences({ preferences: { ...(preferences ?? fallbackPreferences), defaultChartMode: next } }); }
    return <div className="kpi-detail-page">{onBack ? <button className="kpi-breadcrumb" type="button" onClick={onBack}>← Catalogo KPI</button> : <a className="kpi-breadcrumb" href={getBackHref()}>← Catalogo KPI</a>}<KpiDetail summary={summary} points={points} mode={mode} range={range} liveState={liveState} onModeChange={changeMode} onRangeChange={setRange}/></div>;
  }

  function useLiveDetail() { return useAction(refs.getLiveDetail); }
  return { Catalog: BoundCatalog, Detail: BoundDetail, useLiveDetail };
}
