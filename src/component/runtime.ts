import { env } from "./_generated/server.js";
import { buildExplainQuery, buildKpiQuery, type KpiRuntimeIndicator, type KpiPoint } from "../contracts/index.js";

export function projectedPoints() {
  const parsed = Number(env.KPI_CONVEX_PROJECTED_POINTS ?? "12");
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 120) throw new Error("KPI_CONVEX_PROJECTED_POINTS must be between 1 and 120");
  return parsed;
}

export function clickHouseConfiguration() {
  const url = new URL(env.KPI_CONVEX_CLICKHOUSE_URL);
  if (url.protocol !== "https:") throw new Error("ClickHouse must use HTTPS");
  return {
    url: url.toString(),
    database: env.KPI_CONVEX_CLICKHOUSE_DATABASE,
    username: env.KPI_CONVEX_CLICKHOUSE_USERNAME,
    password: env.KPI_CONVEX_CLICKHOUSE_PASSWORD,
    scopeValue: env.KPI_CONVEX_SCOPE_VALUE,
  };
}

function normalizePoints(rows: Array<{ period: unknown; value: unknown }>): KpiPoint[] {
  return rows.map((row) => {
    const value = typeof row.value === "number" ? row.value : Number(row.value);
    const period = String(row.period);
    if (!period || !Number.isFinite(value)) throw new Error("ClickHouse returned a non-numeric KPI value");
    return { period, value };
  });
}

export async function readKpiPoints(indicator: KpiRuntimeIndicator, request: Parameters<typeof buildKpiQuery>[0]["request"]) {
  const config = clickHouseConfiguration();
  const built = buildKpiQuery({ indicator, database: config.database, scopeValue: config.scopeValue, request });
  const text = await clickHouseRequest(config, built, "JSONEachRow");
  const rows = text.trim() ? text.trim().split("\n").map((line) => JSON.parse(line) as { period: unknown; value: unknown }) : [];
  return normalizePoints(rows);
}

export async function preflightIndicators(indicators: KpiRuntimeIndicator[]) {
  const config = clickHouseConfiguration();
  const representatives = [...new Map(indicators.map((indicator) => [indicator.relationName, indicator])).values()];
  for (const indicator of representatives) {
    const built = buildExplainQuery({ indicator, database: config.database, scopeValue: config.scopeValue });
    const plan = await clickHouseRequest(config, built, "TabSeparatedRaw");
    if (!/PrimaryKey\s*\n[\s\S]*Condition:\s*(?!true\b)/i.test(plan) && !/PrimaryKey[\s\S]*Condition:\s*(?!true\b)/i.test(plan)) {
      throw new Error(`No useful PrimaryKey condition for ${indicator.relationName}`);
    }
  }
}

async function clickHouseRequest(config: ReturnType<typeof clickHouseConfiguration>, built: ReturnType<typeof buildKpiQuery>, format: "JSONEachRow" | "TabSeparatedRaw") {
  const url = new URL(config.url);
  url.searchParams.set("database", config.database);
  url.searchParams.set("default_format", format);
  for (const [key, value] of Object.entries(built.query_params)) url.searchParams.set(`param_${key}`, value);
  for (const [key, value] of Object.entries(built.clickhouse_settings)) url.searchParams.set(key, String(value));
  const credentials = btoa(`${config.username}:${config.password}`);
  const response = await fetch(url, { method: "POST", headers: { authorization: `Basic ${credentials}`, "content-type": "text/plain; charset=utf-8" }, body: built.query, signal: AbortSignal.timeout(35_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`ClickHouse query failed (${response.status}): ${text.slice(0, 300)}`);
  return text;
}
