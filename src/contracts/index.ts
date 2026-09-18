import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
export * from "./query.js";

export const CATALOG_SCHEMA = "sync-indicators.catalog/v5" as const;
export const TARGET_POINTER_SCHEMA = "sync-indicators.target-catalog-release-pointer/v1" as const;
export const TARGET_RELEASE_SCHEMA = "sync-indicators.target-catalog-release/v1" as const;
export const TARGET_RELEASE_ENVELOPE_SCHEMA = "sync-indicators.target-catalog-release-envelope/v1" as const;
export const SOURCE_MANIFEST_SCHEMA = "sync-indicators.source-catalog-manifest/v1" as const;
export const SOURCE_ENVELOPE_SCHEMA = "sync-indicators.source-catalog-envelope/v1" as const;

export type LocalizedText = { it: string; en: string };
export type KpiPoint = { period: string; value: number };
export type KpiDimension = { key: string; label: LocalizedText; column: string; labelColumn?: string; valueType: "string" | "number" };
export type KpiCatalogIndicator = {
  indicatorKey: string;
  metricKey: string;
  description: string;
  symbol: string;
  periodicity: "weekly" | "monthly" | "quarterly" | "semesterly" | "yearly";
  isReverse: boolean;
  view: { label: string; domain: string; unit: string; valueColumn: string };
  knowledge: {
    producerNodeId: string;
    analysis: {
      relationNodeId: string;
      timeColumn: string;
      tenantColumn?: string;
      grain: string;
      dimensions: KpiDimension[];
    };
  };
};
export type KpiCatalogLineageNode = {
  uniqueId: string;
  relationName?: string;
  columns: Array<{ name: string; dataType?: string }>;
};
export type KpiCatalogV5 = {
  schema: typeof CATALOG_SCHEMA;
  namespace: string;
  catalogVersion: string;
  generatedAt: string;
  indicators: KpiCatalogIndicator[];
  lineage: { nodes: KpiCatalogLineageNode[]; edges: Array<{ parentId: string; childId: string }> };
};
export type KpiRuntimeIndicator = KpiCatalogIndicator & { relationName: string };
export type LoadedKpiCatalog = { releaseVersion: string; generatedAt: string; indicators: KpiRuntimeIndicator[] };
export type KpiSummary = {
  indicatorKey: string;
  label: string;
  description: string;
  domain: string;
  unit: string;
  grain: string;
  dimensions: string[];
  current: KpiPoint | null;
  previous: KpiPoint | null;
  delta: number | null;
  deltaPercent: number | null;
  generatedAt: string;
  releaseVersion: string;
};
export type KpiDetail = KpiSummary & { history: KpiPoint[] };
export type CatalogPage = { page: KpiSummary[]; isDone: boolean; continueCursor: string };
export type ViewerPreferences = { theme: "light" | "dark" | "system"; catalogView: "table" | "cards"; density: "compact" | "comfortable"; defaultChartMode: "line" | "bar" | "area" | "table" };
export type SyncErrorCode = "RELEASE_NOT_FOUND" | "RELEASE_INVALID" | "SCHEMA_INCOMPATIBLE" | "DATA_SOURCE_UNAVAILABLE" | "PROJECTION_FAILED";
export type SyncStatus = { state: "empty" | "ready" | "degraded" | "projecting"; releaseVersion: string | null; sourceRunId: string | null; lastCheckedAt: number | null; lastProjectedAt: number | null; errorCode: SyncErrorCode | null };

export type TargetCatalogPointer = { schema: typeof TARGET_POINTER_SCHEMA; objectKey: string; envelopeSha256: string; targetReleaseVersion?: string };
export type TargetReleaseEnvelope = {
  schema: typeof TARGET_RELEASE_ENVELOPE_SCHEMA;
  keyId: string;
  releaseSha256: string;
  signature: string;
  release: {
    schema: typeof TARGET_RELEASE_SCHEMA;
    targetNamespace: string;
    targetReleaseVersion: string;
    generatedAt: string;
    indicatorCount: number;
    sources: Array<{ sourceKey: string; sourceCatalogVersion: string; manifestObjectKey: string; manifestSha256: string; keyId: string; indicatorCount: number }>;
  };
};
export type SourceCatalogEnvelope = {
  schema: typeof SOURCE_ENVELOPE_SCHEMA;
  keyId: string;
  manifestSha256: string;
  signature: string;
  manifest: {
    schema: typeof SOURCE_MANIFEST_SCHEMA;
    targetNamespace: string;
    sourceKey: string;
    sourceCatalogVersion: string;
    generatedAt: string;
    indicatorCount: number;
    lineageNodeCount: number;
    lineageEdgeCount: number;
    chunks: Array<{ kind: "indicators" | "lineage_nodes" | "lineage_edges"; index: number; count: number; objectKey: string; sha256: string }>;
  };
};

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}
function string(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value;
}
function number(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(message);
  return value;
}
function array(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}
function identifier(value: unknown, message: string): string {
  const parsed = string(value, message);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(parsed)) throw new Error(message);
  return parsed;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Unsupported canonical JSON value");
  return serialized;
}

export function sha256Hex(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

export function verifyEd25519(body: unknown, signatureBase64: string, publicKey: string): void {
  const decode = (value: string) => Uint8Array.from(atob(value.replace(/\s+/g, "")), (character) => character.charCodeAt(0));
  const encoded = publicKey.includes("BEGIN PUBLIC KEY") ? publicKey.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, "") : publicKey;
  const decoded = decode(encoded);
  const rawKey = decoded.length === 32 ? decoded : decoded.slice(-32);
  if (!ed25519.verify(decode(signatureBase64), new TextEncoder().encode(canonicalJson(body)), rawKey)) throw new Error("Invalid Ed25519 signature");
}

export function parseTargetPointer(value: unknown): TargetCatalogPointer {
  const raw = record(value, "Invalid target catalog pointer");
  if (raw.schema !== TARGET_POINTER_SCHEMA) throw new Error("Invalid target catalog pointer");
  return { schema: TARGET_POINTER_SCHEMA, objectKey: string(raw.objectKey, "Invalid target catalog pointer"), envelopeSha256: string(raw.envelopeSha256, "Invalid target catalog pointer"), ...(typeof raw.targetReleaseVersion === "string" ? { targetReleaseVersion: raw.targetReleaseVersion } : {}) };
}

export function parseTargetReleaseEnvelope(value: unknown): TargetReleaseEnvelope {
  const raw = record(value, "Invalid target release envelope");
  const release = record(raw.release, "Invalid target release");
  if (raw.schema !== TARGET_RELEASE_ENVELOPE_SCHEMA || release.schema !== TARGET_RELEASE_SCHEMA) throw new Error("Invalid target release envelope");
  return {
    schema: TARGET_RELEASE_ENVELOPE_SCHEMA,
    keyId: string(raw.keyId, "Invalid target release key"),
    releaseSha256: string(raw.releaseSha256, "Invalid target release checksum"),
    signature: string(raw.signature, "Invalid target release signature"),
    release: {
      schema: TARGET_RELEASE_SCHEMA,
      targetNamespace: string(release.targetNamespace, "Invalid target namespace"),
      targetReleaseVersion: string(release.targetReleaseVersion, "Invalid target release version"),
      generatedAt: string(release.generatedAt, "Invalid target release date"),
      indicatorCount: number(release.indicatorCount, "Invalid target indicator count"),
      sources: array(release.sources, "Invalid target sources").map((entry) => {
        const source = record(entry, "Invalid target source");
        return { sourceKey: string(source.sourceKey, "Invalid source key"), sourceCatalogVersion: string(source.sourceCatalogVersion, "Invalid source version"), manifestObjectKey: string(source.manifestObjectKey, "Invalid source manifest key"), manifestSha256: string(source.manifestSha256, "Invalid source checksum"), keyId: string(source.keyId, "Invalid source key id"), indicatorCount: number(source.indicatorCount, "Invalid source indicator count") };
      }),
    },
  };
}

export function parseSourceEnvelope(value: unknown): SourceCatalogEnvelope {
  const raw = record(value, "Invalid source catalog envelope");
  const manifest = record(raw.manifest, "Invalid source manifest");
  if (raw.schema !== SOURCE_ENVELOPE_SCHEMA || manifest.schema !== SOURCE_MANIFEST_SCHEMA) throw new Error("Invalid source catalog envelope");
  return {
    schema: SOURCE_ENVELOPE_SCHEMA,
    keyId: string(raw.keyId, "Invalid source key"),
    manifestSha256: string(raw.manifestSha256, "Invalid source manifest checksum"),
    signature: string(raw.signature, "Invalid source signature"),
    manifest: {
      schema: SOURCE_MANIFEST_SCHEMA,
      targetNamespace: string(manifest.targetNamespace, "Invalid source namespace"),
      sourceKey: string(manifest.sourceKey, "Invalid source key"),
      sourceCatalogVersion: string(manifest.sourceCatalogVersion, "Invalid source version"),
      generatedAt: string(manifest.generatedAt, "Invalid source date"),
      indicatorCount: number(manifest.indicatorCount, "Invalid source indicator count"),
      lineageNodeCount: number(manifest.lineageNodeCount, "Invalid lineage node count"),
      lineageEdgeCount: number(manifest.lineageEdgeCount, "Invalid lineage edge count"),
      chunks: array(manifest.chunks, "Invalid source chunks").map((entry) => {
        const chunk = record(entry, "Invalid source chunk");
        if (chunk.kind !== "indicators" && chunk.kind !== "lineage_nodes" && chunk.kind !== "lineage_edges") throw new Error("Invalid source chunk kind");
        return { kind: chunk.kind, index: number(chunk.index, "Invalid source chunk index"), count: number(chunk.count, "Invalid source chunk count"), objectKey: string(chunk.objectKey, "Invalid source chunk key"), sha256: string(chunk.sha256, "Invalid source chunk checksum") };
      }),
    },
  };
}

export function parseCatalogV5(value: unknown): KpiCatalogV5 {
  const raw = record(value, "Invalid KPI catalog");
  if (raw.schema !== CATALOG_SCHEMA) throw new Error("Unsupported KPI catalog schema");
  const lineageRaw = record(raw.lineage, "KPI catalog lineage is required");
  const nodes = array(lineageRaw.nodes, "Invalid lineage nodes").map((entry) => {
    const node = record(entry, "Invalid lineage node");
    return { uniqueId: string(node.uniqueId, "Invalid lineage node id"), ...(typeof node.relationName === "string" ? { relationName: node.relationName } : {}), columns: array(node.columns, "Invalid lineage columns").map((columnEntry) => { const column = record(columnEntry, "Invalid lineage column"); return { name: identifier(column.name, "Invalid lineage column name"), ...(typeof column.dataType === "string" ? { dataType: column.dataType } : {}) }; }) };
  });
  const indicators = array(raw.indicators, "Invalid indicators").map((entry) => parseIndicator(entry));
  return { schema: CATALOG_SCHEMA, namespace: string(raw.namespace, "Invalid namespace"), catalogVersion: string(raw.catalogVersion, "Invalid catalog version"), generatedAt: string(raw.generatedAt, "Invalid catalog date"), indicators, lineage: { nodes, edges: array(lineageRaw.edges, "Invalid lineage edges").map((entry) => { const edge = record(entry, "Invalid lineage edge"); return { parentId: string(edge.parentId, "Invalid lineage parent"), childId: string(edge.childId, "Invalid lineage child") }; }) } };
}

export function selectUiEnabledIndicators(values: unknown[]): unknown[] {
  return values.filter((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const indicator = value as Record<string, unknown>;
    return Boolean(indicator.view) && Boolean(indicator.knowledge);
  });
}

function parseIndicator(value: unknown): KpiCatalogIndicator {
  const raw = record(value, "Invalid KPI indicator");
  const view = record(raw.view, "KPI presentation contract is required");
  const knowledge = record(raw.knowledge, "KPI knowledge contract is required");
  const analysis = record(knowledge.analysis, "KPI analysis contract is required");
  const periodicity = raw.periodicity;
  if (!["weekly", "monthly", "quarterly", "semesterly", "yearly"].includes(String(periodicity))) throw new Error("Invalid KPI periodicity");
  return {
    indicatorKey: string(raw.indicatorKey, "Invalid indicator key"), metricKey: string(raw.metricKey, "Invalid metric key"), description: string(raw.description, "Invalid description"), symbol: string(raw.symbol, "Invalid symbol"), periodicity: periodicity as KpiCatalogIndicator["periodicity"], isReverse: Boolean(raw.isReverse),
    view: { label: string(view.label, "Invalid KPI label"), domain: string(view.domain, "Invalid KPI domain"), unit: string(view.unit, "Invalid KPI unit"), valueColumn: identifier(view.valueColumn, "Invalid KPI value column") },
    knowledge: { producerNodeId: string(knowledge.producerNodeId, "Invalid producer node"), analysis: { relationNodeId: string(analysis.relationNodeId, "Invalid relation node"), timeColumn: identifier(analysis.timeColumn, "Invalid time column"), ...(analysis.tenantColumn === undefined ? {} : { tenantColumn: identifier(analysis.tenantColumn, "Invalid tenant column") }), grain: string(analysis.grain, "Invalid grain"), dimensions: array(analysis.dimensions, "Invalid dimensions").map((entry) => { const dimension = record(entry, "Invalid dimension"); const labels = record(dimension.label, "Invalid dimension label"); if (dimension.valueType !== "string" && dimension.valueType !== "number") throw new Error("Invalid dimension value type"); return { key: string(dimension.key, "Invalid dimension key"), label: { it: string(labels.it, "Invalid Italian label"), en: string(labels.en, "Invalid English label") }, column: identifier(dimension.column, "Invalid dimension column"), ...(dimension.labelColumn === undefined ? {} : { labelColumn: identifier(dimension.labelColumn, "Invalid label column") }), valueType: dimension.valueType }; }) } },
  };
}

export function projectRuntimeIndicators(catalog: KpiCatalogV5): KpiRuntimeIndicator[] {
  const nodes = new Map(catalog.lineage.nodes.map((node) => [node.uniqueId, node]));
  return catalog.indicators.map((indicator) => {
    const node = nodes.get(indicator.knowledge.producerNodeId);
    if (!node?.relationName) throw new Error(`Missing relation for ${indicator.indicatorKey}`);
    const columns = new Set(node.columns.map((column) => column.name.toLowerCase()));
    for (const required of [indicator.view.valueColumn, indicator.knowledge.analysis.timeColumn, indicator.knowledge.analysis.tenantColumn].filter((item): item is string => Boolean(item))) {
      if (!columns.has(required.toLowerCase())) throw new Error(`Catalog column not found for ${indicator.indicatorKey}: ${required}`);
    }
    return { ...indicator, relationName: node.relationName };
  });
}
