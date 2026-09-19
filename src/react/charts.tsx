"use client";
/* eslint-disable react-refresh/only-export-components -- public UI module exports formatters with components */

import {
  AreaChart as AreaChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  Table2,
} from "lucide-react";
import type { KpiPoint, KpiSummary } from "../contracts/index.js";
import type { KpiChartMode, WidgetChartMode } from "./model.js";
import { formatKpiDate, formatKpiValue } from "./model.js";

const chartModes: Array<{
  key: KpiChartMode;
  label: string;
  icon: typeof LineChartIcon;
}> = [
  { key: "line", label: "Linea", icon: LineChartIcon },
  { key: "bar", label: "Barre", icon: BarChart3 },
  { key: "area", label: "Area", icon: AreaChartIcon },
  { key: "table", label: "Tabella", icon: Table2 },
];

const monthLabels = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];
const monthNames = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
const grainLabels: Record<string, string> = {
  daily: "giornaliero",
  weekly: "settimanale",
  monthly: "mensile",
  quarterly: "trimestrale",
  yearly: "annuale",
};

function periodParts(period: string) {
  const [year = "", month = ""] = period.slice(0, 10).split("-");
  const monthIndex = Number(month) - 1;
  return {
    year,
    monthIndex:
      Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex < 12
        ? monthIndex
        : null,
  };
}

export function formatAxisPeriod(period: string) {
  const { monthIndex } = periodParts(period);
  return monthIndex === null ? period.slice(5, 7) : monthLabels[monthIndex];
}

export function formatTooltipPeriod(period: string) {
  const { year, monthIndex } = periodParts(period);
  return monthIndex === null
    ? period.slice(0, 7)
    : `${monthNames[monthIndex]} ${year}`;
}

function coordinates(points: KpiPoint[]) {
  let min = points[0]?.value ?? 0;
  let max = min;
  for (const point of points) {
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
  }
  const range = max - min || 1;
  return points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? 50 : 4 + (index / (points.length - 1)) * 92,
    y: 90 - ((point.value - min) / range) * 76,
  }));
}

function SvgChart({
  points,
  mode,
  compact = false,
}: {
  points: KpiPoint[];
  mode: "line" | "bar" | "area";
  compact?: boolean;
}) {
  const values = coordinates(points);
  const path = values
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {!compact
        ? [20, 45, 70, 95].map((y) => (
            <line
              key={y}
              className="kpi-chart-grid"
              x1="0"
              x2="100"
              y1={y}
              y2={y}
            />
          ))
        : null}
      {mode === "area" ? (
        <path className="kpi-chart-area" d={`${path} L96,100 L4,100 Z`} />
      ) : null}
      {mode === "bar" ? (
        values.map((point) => (
          <rect
            key={point.period}
            className="kpi-chart-bar"
            x={Math.max(0, point.x - 2.25)}
            y={point.y}
            width="4.5"
            height={100 - point.y}
            rx="1"
          />
        ))
      ) : (
        <path className="kpi-chart-line" d={path} />
      )}
      {mode === "line"
        ? values.map((point) => (
            <circle
              key={point.period}
              className="kpi-chart-dot"
              cx={point.x}
              cy={point.y}
              r="1.2"
            />
          ))
        : null}
    </svg>
  );
}

export function KpiChart({
  points,
  mode = "line",
  unit = "",
}: {
  points: KpiPoint[];
  mode?: KpiChartMode;
  unit?: string;
}) {
  if (mode === "table")
    return (
      <div className="kpi-history-table-wrap">
        <table className="kpi-history-table">
          <thead>
            <tr>
              <th>Periodo</th>
              <th>Valore</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((point) => (
              <tr key={point.period}>
                <td>{point.period}</td>
                <td>{formatKpiValue(point, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (points.length === 0)
    return (
      <div className="kpi-empty compact">Nessuno storico disponibile.</div>
    );
  return (
    <div
      className="kpi-data-chart"
      role="img"
      aria-label={`Grafico storico ${mode}, ${points.length} punti`}
    >
      <SvgChart points={points} mode={mode} />
      <div className="kpi-chart-labels">
        <span>{formatAxisPeriod(points[0].period)}</span>
        <span>{formatAxisPeriod(points.at(-1)?.period ?? "")}</span>
      </div>
    </div>
  );
}

export function WidgetChart({
  points,
  unit,
  mode,
}: {
  points: KpiPoint[];
  unit: string;
  mode: WidgetChartMode;
}) {
  if (points.length === 0)
    return <div className="kpi-widget-chart empty">Nessuno storico</div>;
  if (mode === "pie") {
    const slices = points.filter((point) => point.value > 0);
    const total = slices.reduce((sum, point) => sum + point.value, 0);
    if (!total)
      return (
        <div className="kpi-widget-chart empty">Nessun valore positivo</div>
      );
    const stops = slices.map((point, index) => {
      const start =
        (slices.slice(0, index).reduce((sum, slice) => sum + slice.value, 0) /
          total) *
        100;
      const end = start + (point.value / total) * 100;
      return `var(--kpi-chart-${(index % 5) + 1}) ${start}% ${end}%`;
    });
    return (
      <div className="kpi-widget-chart pie" aria-label={`Ripartizione ${unit}`}>
        <div
          className="kpi-widget-pie"
          style={{ background: `conic-gradient(${stops.join(",")})` }}
        >
          <span />
        </div>
        <ul>
          {slices.map((point, index) => (
            <li key={point.period}>
              <i
                style={{ background: `var(--kpi-chart-${(index % 5) + 1})` }}
              />
              {formatAxisPeriod(point.period)}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="kpi-widget-chart" aria-label={`Andamento ${unit}`}>
      <SvgChart points={points} mode={mode} compact />
      <div className="kpi-chart-labels">
        <span>{formatAxisPeriod(points[0].period)}</span>
        <span>{formatAxisPeriod(points.at(-1)?.period ?? "")}</span>
      </div>
    </div>
  );
}

export function KpiDetail({
  summary,
  points,
  mode,
  range,
  liveState = "idle",
  onModeChange,
  onRangeChange,
}: {
  summary: KpiSummary;
  points: KpiPoint[];
  mode: KpiChartMode;
  range: string;
  liveState?: "idle" | "loading" | "ready" | "unavailable";
  onModeChange: (mode: KpiChartMode) => void;
  onRangeChange: (range: string) => void;
}) {
  const deltaPercent =
    summary.deltaPercent === null ? null : summary.deltaPercent * 100;
  return (
    <section className="kpi-detail-shell">
      <header className="kpi-metric-header">
        <div className="kpi-metric-copy">
          <span className="kpi-badge">{summary.domain}</span>
          <h1>{summary.label}</h1>
          <p>{summary.description}</p>
        </div>
      </header>
      {liveState === "unavailable" ? (
        <div className="kpi-warning">
          <strong>Dati aggiornati non disponibili</strong>
          <p>Sono mostrati gli ultimi dati disponibili.</p>
        </div>
      ) : null}
      <div className="kpi-metric-overview">
        <article className="kpi-stat-card primary">
          <span>Valore corrente</span>
          <strong>{formatKpiValue(summary.current, summary.unit)}</strong>
          <small>
            {summary.current?.period.slice(0, 7) ?? "nessun periodo"}
          </small>
        </article>
        <article className="kpi-stat-card">
          <span>Variazione</span>
          <strong
            className={(summary.delta ?? 0) >= 0 ? "positive" : "negative"}
          >
            {summary.delta === null
              ? "—"
              : `${summary.delta > 0 ? "+" : ""}${summary.delta.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`}
          </strong>
          <small>
            {deltaPercent === null
              ? "Periodo precedente non disponibile"
              : `${deltaPercent > 0 ? "+" : ""}${deltaPercent.toFixed(1)}% sul periodo precedente`}
          </small>
        </article>
        <article className="kpi-stat-card">
          <span>Aggiornato</span>
          <strong>{formatKpiDate(summary.generatedAt)}</strong>
        </article>
      </div>
      <section className="kpi-panel">
        <header>
          <div>
            <h2>Andamento</h2>
            <p>Storico {grainLabels[summary.grain] ?? summary.grain}</p>
          </div>
          {liveState === "loading" ? (
            <span className="kpi-live-status">Aggiornamento…</span>
          ) : null}
        </header>
        <div className="kpi-chart-toolbar">
          <div className="kpi-segmented" aria-label="Tipo di grafico">
            {chartModes.map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                key={key}
                aria-pressed={mode === key}
                onClick={() => onModeChange(key)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <label className="kpi-range-select">
            Intervallo
            <select
              value={range}
              onChange={(event) => onRangeChange(event.target.value)}
            >
              <option value="3">3 mesi</option>
              <option value="6">6 mesi</option>
              <option value="12">12 mesi</option>
              <option value="24">24 mesi</option>
              <option value="all">Tutto</option>
            </select>
          </label>
        </div>
        <KpiChart points={points} mode={mode} unit={summary.unit} />
      </section>
      <section className="kpi-metadata-panel">
        <header>
          <div>
            <h2>Definizione del dato</h2>
          </div>
        </header>
        <dl>
          <div>
            <dt>Unità</dt>
            <dd>{summary.unit || "Nessuna"}</dd>
          </div>
          <div>
            <dt>Frequenza</dt>
            <dd>{grainLabels[summary.grain] ?? summary.grain}</dd>
          </div>
          <div>
            <dt>Dettagli disponibili</dt>
            <dd>
              {summary.dimensions.length
                ? summary.dimensions.join(", ")
                : "Nessuno"}
            </dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
