"use client";

import {
  useDeferredValue,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionReference } from "convex/server";
import type {
  KpiPoint,
  KpiSummary,
  SyncStatus,
  ViewerPreferences,
} from "../contracts/index.js";
import {
  KpiCatalogWorkspace,
  KpiWorkspaceHeader,
  useCatalogProjection,
} from "./catalog.js";
import type { KpiMessages } from "./catalog.js";
import { KpiDetail } from "./charts.js";
import {
  DashboardBoard as DashboardBoardView,
  DashboardHome as DashboardHomeView,
} from "./dashboards.js";
import type { DashboardBoardProps, DashboardHomeProps } from "./dashboards.js";
import type {
  DashboardPickerItem,
  DashboardSummary,
  DashboardView,
  KpiCatalogState,
  KpiChartMode,
  WidgetChartMode,
} from "./model.js";

type CatalogListRef = FunctionReference<
  "query",
  "public",
  {
    paginationOpts: { numItems: number; cursor: string | null };
    search?: string;
    domain?: string;
  },
  { page: KpiSummary[]; isDone: boolean; continueCursor: string }
>;
type SummaryRef = FunctionReference<
  "query",
  "public",
  { indicatorKey: string },
  KpiSummary | null
>;
type SeriesRef = FunctionReference<
  "query",
  "public",
  { indicatorKey: string },
  KpiPoint[]
>;
type FavoritesRef = FunctionReference<
  "query",
  "public",
  Record<string, never>,
  string[]
>;
type ToggleRef = FunctionReference<
  "mutation",
  "public",
  { indicatorKey: string },
  boolean
>;
type PreferencesRef = FunctionReference<
  "query",
  "public",
  Record<string, never>,
  ViewerPreferences
>;
type SavePreferencesRef = FunctionReference<
  "mutation",
  "public",
  { preferences: ViewerPreferences },
  null
>;
type SyncStatusRef = FunctionReference<
  "query",
  "public",
  Record<string, never>,
  SyncStatus
>;
type LiveRef = FunctionReference<
  "action",
  "public",
  { indicatorKey: string; startDate: string; endDate: string; limit?: number },
  { indicatorKey: string; history: KpiPoint[]; fetchedAt: number }
>;
type DashboardListRef = FunctionReference<
  "query",
  "public",
  { indicatorKey?: string },
  DashboardSummary[]
>;
type DashboardPickerRef = FunctionReference<
  "query",
  "public",
  Record<string, never>,
  DashboardPickerItem[]
>;
type DashboardGetRef = FunctionReference<
  "query",
  "public",
  { dashboardId: string },
  DashboardView | null
>;
type DashboardCreateRef = FunctionReference<
  "mutation",
  "public",
  { name: string; indicatorKeys: string[] },
  string
>;
type DashboardIdMutationRef<Returns = null> = FunctionReference<
  "mutation",
  "public",
  { dashboardId: string },
  Returns
>;
type DashboardWidgetMutationRef = FunctionReference<
  "mutation",
  "public",
  { dashboardId: string; widgetId: string },
  null
>;
type DashboardAddWidgetRef = FunctionReference<
  "mutation",
  "public",
  { dashboardId: string; indicatorKey: string },
  null
>;
type DashboardAddWidgetsRef = FunctionReference<
  "mutation",
  "public",
  { dashboardIds: string[]; indicatorKey: string },
  { addedDashboardIds: string[]; alreadyPresentDashboardIds: string[] }
>;
type DashboardReorderRef = FunctionReference<
  "mutation",
  "public",
  { dashboardId: string; widgetIds: string[] },
  null
>;
type DashboardChartModeRef = FunctionReference<
  "mutation",
  "public",
  { dashboardId: string; widgetId: string; mode: WidgetChartMode },
  null
>;

export type KpiReactReferences = {
  catalogList: CatalogListRef;
  catalogGet: SummaryRef;
  getSeries: SeriesRef;
  favoritesList: FavoritesRef;
  favoriteToggle: ToggleRef;
  preferencesGet: PreferencesRef;
  preferencesSave: SavePreferencesRef;
  syncStatus: SyncStatusRef;
  getLiveDetail: LiveRef;
  dashboardList: DashboardListRef;
  dashboardPicker: DashboardPickerRef;
  dashboardGet: DashboardGetRef;
  dashboardCreate: DashboardCreateRef;
  dashboardToggleFavorite: DashboardIdMutationRef<boolean>;
  dashboardRemove: DashboardIdMutationRef;
  dashboardAddWidget: DashboardAddWidgetRef;
  dashboardAddWidgets: DashboardAddWidgetsRef;
  dashboardRemoveWidget: DashboardWidgetMutationRef;
  dashboardReorderWidgets: DashboardReorderRef;
  dashboardSetWidgetChartMode: DashboardChartModeRef;
};

export type KpiBoundCatalogProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  navigation?: ReactNode;
  getDashboardHref?: (id: string, indicatorKey?: string) => string;
  onOpenDashboard?: (id: string) => void;
  pageSize?: number;
  messages?: KpiMessages;
};

export type KpiBoundDashboardHomeProps = Omit<
  DashboardHomeProps,
  | "boards"
  | "pickerItems"
  | "loading"
  | "pickerLoading"
  | "creating"
  | "onCreatingChange"
  | "onToggleFavorite"
  | "onCreateDashboard"
>;

export type KpiBoundDashboardBoardProps = Omit<
  DashboardBoardProps,
  | "board"
  | "pickerItems"
  | "pickerLoading"
  | "adding"
  | "onAddingChange"
  | "onToggleFavorite"
  | "onAddWidget"
  | "onRemoveWidget"
  | "onReorderWidgets"
  | "onSetWidgetChartMode"
  | "onRemoveDashboard"
> & {
  dashboardId: string;
  onRemoved?: () => void;
};

const fallbackPreferences: ViewerPreferences = {
  theme: "system",
  catalogView: "table",
  density: "compact",
  defaultChartMode: "line",
};

function rangeDates(range: string) {
  const end = new Date();
  const start = new Date(end);
  const days = range === "all" ? 730 : Math.min(730, Number(range) * 31);
  start.setUTCDate(start.getUTCDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function createKpiReactBindings(refs: KpiReactReferences) {
  function BoundCatalog({
    eyebrow,
    title,
    description,
    headerAction,
    navigation,
    getDashboardHref,
    onOpenDashboard,
    pageSize = 50,
    messages,
  }: KpiBoundCatalogProps) {
    const preferences = useQuery(refs.preferencesGet, {});
    const status = useQuery(refs.syncStatus, {});
    const [selectedKpi, setSelectedKpi] = useState<KpiSummary | null>(null);
    const dashboards = useQuery(
      refs.dashboardList,
      selectedKpi ? { indicatorKey: selectedKpi.indicatorKey } : "skip",
    );
    const addWidgets = useMutation(refs.dashboardAddWidgets);
    const savePreferences = useMutation(refs.preferencesSave);
    const [state, setState] = useState<KpiCatalogState>({
      query: "",
      sort: "label",
      descending: false,
      view: "table",
    });
    const [viewWasChosen, setViewWasChosen] = useState(false);
    const [page, setPage] = useState(1);
    const deferredQuery = useDeferredValue(state.query);
    const result = usePaginatedQuery(
      refs.catalogList,
      {
        ...(deferredQuery.trim() ? { search: deferredQuery.trim() } : {}),
        ...(state.domain ? { domain: state.domain } : {}),
      },
      { initialNumItems: 100 },
    );
    const effectiveState =
      viewWasChosen || !preferences
        ? state
        : { ...state, view: preferences.catalogView };
    const projected = useCatalogProjection(result.results, effectiveState);
    const pageCount = Math.max(
      1,
      Math.ceil(projected.length / pageSize) +
        (result.status === "CanLoadMore" ? 1 : 0),
    );
    const items = projected.slice((page - 1) * pageSize, page * pageSize);
    function changeState(next: KpiCatalogState) {
      if (next.view !== effectiveState.view) {
        setViewWasChosen(true);
        void savePreferences({
          preferences: {
            ...(preferences ?? fallbackPreferences),
            catalogView: next.view,
          },
        });
      }
      setState(next);
      setPage(1);
    }
    function changePage(next: number) {
      if (next * pageSize > projected.length && result.status === "CanLoadMore")
        result.loadMore(100);
      setPage(next);
    }
    return (
      <section className="kpi-catalog-page">
        <KpiWorkspaceHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          status={status}
          action={headerAction}
          navigation={navigation}
        />
        <KpiCatalogWorkspace
          items={items}
          state={effectiveState}
          dashboards={dashboards ?? []}
          dashboardLoading={selectedKpi !== null && dashboards === undefined}
          selectedKpi={selectedKpi}
          loading={
            result.status === "LoadingFirstPage" ||
            result.status === "LoadingMore"
          }
          page={page}
          pageCount={pageCount}
          total={projected.length}
          onOpenKpi={(indicatorKey) => {
            const kpi = items.find((item) => item.indicatorKey === indicatorKey);
            if (kpi) setSelectedKpi(kpi);
          }}
          onSelectedKpiChange={setSelectedKpi}
          onAddToDashboards={async (dashboardIds, indicatorKey) => {
            await addWidgets({ dashboardIds, indicatorKey });
          }}
          getDashboardHref={getDashboardHref}
          onOpenDashboard={onOpenDashboard}
          onStateChange={changeState}
          onPageChange={changePage}
          messages={messages}
        />
      </section>
    );
  }

  function BoundDetail({
    indicatorKey,
    initialMode,
    getBackHref = () => "/",
    onBack,
    backLabel = "← Dashboard",
  }: {
    indicatorKey: string;
    initialMode?: KpiChartMode;
    getBackHref?: () => string;
    onBack?: () => void;
    backLabel?: string;
  }) {
    const summary = useQuery(refs.catalogGet, { indicatorKey });
    const projectedPoints = useQuery(refs.getSeries, { indicatorKey }) ?? [];
    const preferences = useQuery(refs.preferencesGet, {});
    const savePreferences = useMutation(refs.preferencesSave);
    const getLiveDetail = useAction(refs.getLiveDetail);
    const [modeOverride, setModeOverride] = useState<KpiChartMode | null>(
      initialMode ?? null,
    );
    const [range, setRange] = useState("12");
    const [livePoints, setLivePoints] = useState<KpiPoint[] | null>(null);
    const [liveState, setLiveState] = useState<
      "idle" | "loading" | "ready" | "unavailable"
    >("idle");
    const mode = modeOverride ?? preferences?.defaultChartMode ?? "line";
    useEffect(() => {
      let active = true;
      setLiveState("loading");
      void getLiveDetail({ indicatorKey, ...rangeDates(range), limit: 500 })
        .then((result) => {
          if (active) {
            setLivePoints(result.history);
            setLiveState("ready");
          }
        })
        .catch(() => {
          if (active) {
            setLivePoints(null);
            setLiveState("unavailable");
          }
        });
      return () => {
        active = false;
      };
    }, [getLiveDetail, indicatorKey, range]);
    if (summary === undefined)
      return (
        <div className="kpi-detail-page">
          <div className="kpi-empty" role="status">
            Caricamento KPI…
          </div>
        </div>
      );
    if (summary === null)
      return (
        <div className="kpi-detail-page">
          <div className="kpi-empty">
            <h2>Indicatore non trovato</h2>
          </div>
        </div>
      );
    const source = livePoints ?? projectedPoints;
    const points = range === "all" ? source : source.slice(-Number(range));
    function changeMode(next: KpiChartMode) {
      setModeOverride(next);
      void savePreferences({
        preferences: {
          ...(preferences ?? fallbackPreferences),
          defaultChartMode: next,
        },
      });
    }
    return (
      <div className="kpi-detail-page">
        {onBack ? (
          <button className="kpi-breadcrumb" type="button" onClick={onBack}>
            {backLabel}
          </button>
        ) : (
          <a className="kpi-breadcrumb" href={getBackHref()}>
            {backLabel}
          </a>
        )}
        <KpiDetail
          summary={summary}
          points={points}
          mode={mode}
          range={range}
          liveState={liveState}
          onModeChange={changeMode}
          onRangeChange={setRange}
        />
      </div>
    );
  }

  function BoundDashboardHome(props: KpiBoundDashboardHomeProps) {
    const [creating, setCreating] = useState(false);
    const boards = useQuery(refs.dashboardList, {});
    const pickerItems = useQuery(refs.dashboardPicker, creating ? {} : "skip");
    const createDashboard = useMutation(refs.dashboardCreate);
    const toggleFavorite = useMutation(refs.dashboardToggleFavorite);
    return (
      <DashboardHomeView
        {...props}
        boards={boards ?? []}
        pickerItems={pickerItems ?? []}
        loading={boards === undefined}
        pickerLoading={creating && pickerItems === undefined}
        creating={creating}
        onCreatingChange={setCreating}
        onToggleFavorite={async (dashboardId) => {
          await toggleFavorite({ dashboardId });
        }}
        onCreateDashboard={async (input) => await createDashboard(input)}
      />
    );
  }

  function BoundDashboardBoard({
    dashboardId,
    onRemoved,
    ...props
  }: KpiBoundDashboardBoardProps) {
    const [adding, setAdding] = useState(false);
    const board = useQuery(refs.dashboardGet, { dashboardId });
    const pickerItems = useQuery(refs.dashboardPicker, adding ? {} : "skip");
    const toggleFavorite = useMutation(refs.dashboardToggleFavorite);
    const removeDashboard = useMutation(refs.dashboardRemove);
    const addWidget = useMutation(refs.dashboardAddWidget);
    const removeWidget = useMutation(refs.dashboardRemoveWidget);
    const reorderWidgets = useMutation(refs.dashboardReorderWidgets);
    const setWidgetChartMode = useMutation(refs.dashboardSetWidgetChartMode);
    if (board === undefined)
      return (
        <div className="kpi-dashboard-page">
          <div className="kpi-empty" role="status">
            Caricamento dashboard…
          </div>
        </div>
      );
    if (board === null)
      return (
        <div className="kpi-dashboard-page">
          <div className="kpi-empty">
            <h2>Dashboard non trovata</h2>
          </div>
        </div>
      );
    return (
      <DashboardBoardView
        {...props}
        board={board}
        pickerItems={pickerItems ?? []}
        pickerLoading={adding && pickerItems === undefined}
        adding={adding}
        onAddingChange={setAdding}
        onToggleFavorite={async () => {
          await toggleFavorite({ dashboardId });
        }}
        onAddWidget={async (indicatorKey) => {
          await addWidget({ dashboardId, indicatorKey });
        }}
        onRemoveWidget={async (widgetId) => {
          await removeWidget({ dashboardId, widgetId });
        }}
        onReorderWidgets={async (widgetIds) => {
          await reorderWidgets({ dashboardId, widgetIds });
        }}
        onSetWidgetChartMode={async (widgetId, mode) => {
          await setWidgetChartMode({ dashboardId, widgetId, mode });
        }}
        onRemoveDashboard={async () => {
          await removeDashboard({ dashboardId });
          onRemoved?.();
        }}
      />
    );
  }

  function useLiveDetail() {
    return useAction(refs.getLiveDetail);
  }
  return {
    Catalog: BoundCatalog,
    Detail: BoundDetail,
    DashboardHome: BoundDashboardHome,
    DashboardBoard: BoundDashboardBoard,
    useLiveDetail,
  };
}
