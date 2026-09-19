import { describe, expect, test } from "vitest";
import { buildKpiSearchText, matchesKpiSearch } from "./lib.js";

describe("KPI search text", () => {
  test("includes the stable indicator ID advertised by the catalog search", () => {
    const searchText = buildKpiSearchText({
      indicatorKey: "pcg.sla.acquisti",
      label: "% SLA ticket Acquisti",
      description: "Ticket chiusi entro SLA",
      domain: "Abaddon",
    });

    expect(searchText).toContain("pcg.sla.acquisti");
  });

  test("matches an ID in read models projected before IDs were indexed", () => {
    expect(matchesKpiSearch({
      indicatorKey: "pcg.sla.acquisti",
      searchText: "% sla ticket acquisti abaddon",
    }, "pcg.sla.acquisti")).toBe(true);
  });
});
