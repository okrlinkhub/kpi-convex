import { describe, expect, test } from "vitest";
import { buildExplainQuery, buildKpiQuery } from "./query.js";
import type { KpiRuntimeIndicator } from "./index.js";

const indicator: KpiRuntimeIndicator = {
  indicatorKey: "active_team_count", metricKey: "active_team_count", description: "Active teams", symbol: "#", periodicity: "monthly", isReverse: false,
  view: { label: "Team attivi", domain: "Organizzazione", unit: "team", valueColumn: "metric_value" },
  knowledge: { producerNodeId: "model.kpis", analysis: { relationNodeId: "$self", timeColumn: "value_date", tenantColumn: "company_id", grain: "monthly", dimensions: [] } },
  relationName: "analytics.kpi_values",
};

describe("ClickHouse KPI query builder", () => {
  test("selects the latest points before restoring chronological order", () => {
    const built = buildKpiQuery({ indicator, database: "analytics", scopeValue: "company-a", request: { operation: "latest", limit: 12 } });
    expect(built.query).toContain("ORDER BY `value_date` DESC LIMIT 12");
    expect(built.query).toContain("ORDER BY period ASC");
    expect(built.query_params).toEqual({ scope: "company-a", indicator: "active_team_count" });
    expect(built.clickhouse_settings).toMatchObject({ readonly: "2", max_result_rows: "12", result_overflow_mode: "throw" });
  });
  test("bounds live ranges and rejects cross-database relations", () => {
    expect(() => buildKpiQuery({ indicator, database: "other", scopeValue: "company-a", request: { operation: "latest", limit: 12 } })).toThrow("database mismatch");
    expect(() => buildKpiQuery({ indicator, database: "analytics", scopeValue: "company-a", request: { operation: "history", startDate: "2020-01-01", endDate: "2026-01-01", limit: 500 } })).toThrow("730 days");
  });
  test("uses the same bounded parameterized query for EXPLAIN", () => {
    const built = buildExplainQuery({ indicator, database: "analytics", scopeValue: "company-a" });
    expect(built.query).toMatch(/^EXPLAIN indexes = 1 SELECT/);
    expect(built.query_params.scope).toBe("company-a");
    expect(built.clickhouse_settings).toMatchObject({ readonly: "2", max_result_rows: "1000", result_overflow_mode: "throw" });
  });
});
