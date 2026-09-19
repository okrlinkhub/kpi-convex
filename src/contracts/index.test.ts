import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  canonicalJson,
  parseTargetReleaseEnvelope,
  projectRuntimeIndicators,
  selectTargetSource,
  selectUiEnabledIndicators,
  sha256Hex,
  verifyEd25519,
} from "./index.js";

describe("signed catalog contracts", () => {
  test("accepts a valid Ed25519 release and rejects tampering", () => {
    const keys = generateKeyPairSync("ed25519");
    const release = {
      schema: "sync-indicators.target-catalog-release/v1",
      targetNamespace: "example",
      targetReleaseVersion: `sha256-${"a".repeat(64)}`,
      generatedAt: "2026-09-18T10:00:00.000Z",
      indicatorCount: 1,
      sources: [
        {
          sourceKey: "example",
          sourceCatalogVersion: `sha256-${"b".repeat(64)}`,
          manifestObjectKey: "catalog/source.json",
          manifestSha256: "c".repeat(64),
          keyId: "source-1",
          indicatorCount: 1,
        },
      ],
    };
    const signature = sign(
      null,
      Buffer.from(canonicalJson(release)),
      keys.privateKey,
    ).toString("base64");
    const envelope = parseTargetReleaseEnvelope({
      schema: "sync-indicators.target-catalog-release-envelope/v1",
      keyId: "release-1",
      releaseSha256: sha256Hex(canonicalJson(release)),
      signature,
      release,
    });
    const publicKey = keys.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
    expect(() =>
      verifyEd25519(envelope.release, envelope.signature, publicKey),
    ).not.toThrow();
    expect(() =>
      verifyEd25519(
        { ...envelope.release, indicatorCount: 2 },
        envelope.signature,
        publicKey,
      ),
    ).toThrow("Invalid Ed25519 signature");
  });

  test("selects only indicators carrying the UI presentation contract", () => {
    const visible = {
      indicatorKey: "example.visible",
      view: { label: "Visible" },
      knowledge: { analysis: {} },
    };
    const catalogOnly = { indicatorKey: "example.catalog-only" };
    expect(selectUiEnabledIndicators([catalogOnly, visible, null])).toEqual([
      visible,
    ]);
  });

  test("selects exactly one configured source from an aggregate target", () => {
    const release = parseTargetReleaseEnvelope({
      schema: "sync-indicators.target-catalog-release-envelope/v1",
      keyId: "release-1",
      releaseSha256: "release-sha",
      signature: "signature",
      release: {
        schema: "sync-indicators.target-catalog-release/v1",
        targetNamespace: "pcg",
        targetReleaseVersion: "release-1",
        generatedAt: "2026-09-18T10:00:00.000Z",
        indicatorCount: 2,
        sources: ["abaddon-project", "innovation-sax"].map((sourceKey) => ({
          sourceKey,
          sourceCatalogVersion: `${sourceKey}-v1`,
          manifestObjectKey: `sources/${sourceKey}.json`,
          manifestSha256: `${sourceKey}-sha`,
          keyId: `${sourceKey}-key`,
          indicatorCount: 1,
        })),
      },
    });
    expect(selectTargetSource(release, "abaddon-project").sourceKey).toBe(
      "abaddon-project",
    );
    expect(() => selectTargetSource(release, "missing")).toThrow(
      "Configured KPI source was not found",
    );
  });

  test("projects source analysis columns onto the standard runtime relation", () => {
    const catalog = {
      schema: "sync-indicators.catalog/v5" as const,
      namespace: "pcg",
      catalogVersion: `sha256-${"a".repeat(64)}`,
      generatedAt: "2026-09-18T10:00:00.000Z",
      indicators: [
        {
          indicatorKey: "pcg.sla.acquisti",
          metricKey: "abaddon_sla_acquisti_pct",
          description: "SLA",
          symbol: "%",
          periodicity: "monthly" as const,
          isReverse: false,
          view: {
            label: "SLA Acquisti",
            domain: "Abaddon",
            unit: "%",
            valueColumn: "value",
          },
          knowledge: {
            producerNodeId: "model.pcg_dbt.rpt_abaddon_sync_indicator_values",
            analysis: {
              relationNodeId: "model.pcg_dbt.fct_abaddon_sync_ticket_sla",
              timeColumn: "metric_month",
              grain: "monthly",
              dimensions: [],
            },
          },
        },
      ],
      lineage: {
        nodes: [
          {
            uniqueId: "model.pcg_dbt.rpt_abaddon_sync_indicator_values",
            relationName: "analytics_pcg.rpt_abaddon_sync_indicator_values",
            columns: [
              "company_id",
              "indicator_key",
              "metric_key",
              "value_date",
              "value",
            ].map((name) => ({ name })),
          },
        ],
        edges: [],
      },
    };

    const [runtime] = projectRuntimeIndicators(catalog);
    expect(runtime.knowledge.analysis.timeColumn).toBe("value_date");
    expect(runtime.knowledge.analysis.tenantColumn).toBe("company_id");
    expect(runtime.relationName).toBe(
      "analytics_pcg.rpt_abaddon_sync_indicator_values",
    );
  });
});
