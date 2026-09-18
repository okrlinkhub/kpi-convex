import type { KpiRuntimeIndicator } from "./index.js";

export type KpiQueryRequest =
  | { operation: "latest"; limit: number }
  | { operation: "history"; startDate: string; endDate: string; limit: number };

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RELATION = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/;

function quoteIdentifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error("Invalid ClickHouse identifier");
  return `\`${value}\``;
}
function quoteRelation(value: string, configuredDatabase: string): string {
  if (!RELATION.test(value) || !IDENTIFIER.test(configuredDatabase)) throw new Error("Invalid ClickHouse relation");
  const parts = value.split(".");
  const database = parts.length === 2 ? parts[0] : configuredDatabase;
  const table = parts.length === 2 ? parts[1] : parts[0];
  if (database !== configuredDatabase || !table) throw new Error("ClickHouse catalog database mismatch");
  return `${quoteIdentifier(database)}.${quoteIdentifier(table)}`;
}

export function boundedSettings(maxResultRows: number) {
  return {
    readonly: "2" as const,
    max_execution_time: 30,
    max_estimated_execution_time: 30,
    max_rows_to_read: "1000000",
    max_bytes_to_read: "104857600",
    max_result_rows: String(maxResultRows),
    max_result_bytes: "1048576",
    result_overflow_mode: "throw" as const,
    timeout_overflow_mode: "throw" as const,
    timeout_before_checking_execution_speed: 0,
  };
}

export function buildKpiQuery(args: { indicator: KpiRuntimeIndicator; database: string; scopeValue?: string; request: KpiQueryRequest }) {
  const relation = quoteRelation(args.indicator.relationName, args.database);
  const time = quoteIdentifier(args.indicator.knowledge.analysis.timeColumn);
  const value = quoteIdentifier(args.indicator.view.valueColumn);
  const clauses = [`${quoteIdentifier("indicator_key")} = {indicator:String}`];
  const query_params: Record<string, string> = { indicator: args.indicator.indicatorKey };
  const tenantColumn = args.indicator.knowledge.analysis.tenantColumn;
  if (tenantColumn) {
    if (!args.scopeValue) throw new Error("KPI scope value is required by the catalog");
    clauses.unshift(`${quoteIdentifier(tenantColumn)} = {scope:String}`);
    query_params.scope = args.scopeValue;
  }
  const limit = Math.min(Math.max(Math.trunc(args.request.limit), 1), args.request.operation === "latest" ? 120 : 500);
  if (args.request.operation === "latest") {
    return {
      query: `SELECT period, value FROM (SELECT ${time} AS period, ${value} AS value FROM ${relation} WHERE ${clauses.join(" AND ")} ORDER BY ${time} DESC LIMIT ${limit}) ORDER BY period ASC`,
      query_params,
      clickhouse_settings: boundedSettings(limit),
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.request.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(args.request.endDate) || args.request.startDate >= args.request.endDate) throw new Error("Invalid KPI history range");
  const days = (Date.parse(args.request.endDate) - Date.parse(args.request.startDate)) / 86_400_000;
  if (days > 730) throw new Error("KPI history range exceeds 730 days");
  clauses.push(`${time} >= {start:Date}`, `${time} < {end:Date}`);
  query_params.start = args.request.startDate;
  query_params.end = args.request.endDate;
  return {
    query: `SELECT ${time} AS period, ${value} AS value FROM ${relation} WHERE ${clauses.join(" AND ")} ORDER BY ${time} ASC LIMIT ${limit}`,
    query_params,
    clickhouse_settings: boundedSettings(limit),
  };
}

export function buildExplainQuery(args: { indicator: KpiRuntimeIndicator; database: string; scopeValue?: string }) {
  const built = buildKpiQuery({ ...args, request: { operation: "latest", limit: 1 } });
  return { ...built, query: `EXPLAIN indexes = 1 ${built.query}`, clickhouse_settings: boundedSettings(1000) };
}
