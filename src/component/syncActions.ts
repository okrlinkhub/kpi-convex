import { AwsClient } from "aws4fetch";
import { env, internalAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import {
  canonicalJson,
  parseCatalogV5,
  parseSourceEnvelope,
  parseTargetPointer,
  parseTargetReleaseEnvelope,
  projectRuntimeIndicators,
  selectTargetSource,
  selectUiEnabledIndicators,
  sha256Hex,
  verifyEd25519,
} from "../contracts/index.js";
import { preflightIndicators } from "./runtime.js";

function configuration() {
  const endpoint = new URL(env.KPI_CONVEX_R2_ENDPOINT);
  if (endpoint.protocol !== "https:")
    throw new Error("R2 endpoint must use HTTPS");
  const objectKey = env.KPI_CONVEX_CATALOG_OBJECT_KEY.replace(/^\/+/, "");
  const prefix = (
    env.KPI_CONVEX_CATALOG_PREFIX ?? objectKey.split("/").slice(0, -1).join("/")
  ).replace(/^\/+|\/+$/g, "");
  const keyring = (raw: string, name: string): Record<string, string> => {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.values(parsed).some((value) => typeof value !== "string")
    )
      throw new Error(`Invalid ${name} keyring`);
    return parsed as Record<string, string>;
  };
  const sourceKey = env.KPI_CONVEX_SOURCE_KEY.trim();
  if (!sourceKey) throw new Error("KPI_CONVEX_SOURCE_KEY is required");
  return {
    endpoint: endpoint.toString(),
    bucket: env.KPI_CONVEX_R2_BUCKET,
    objectKey,
    prefix,
    sourceKey,
    accessKeyId: env.KPI_CONVEX_R2_ACCESS_KEY_ID,
    secretAccessKey: env.KPI_CONVEX_R2_SECRET_ACCESS_KEY,
    releaseKeys: keyring(env.KPI_CONVEX_RELEASE_PUBLIC_KEYS_JSON, "release"),
    sourceKeys: keyring(env.KPI_CONVEX_SOURCE_PUBLIC_KEYS_JSON, "source"),
  };
}

function assertKey(key: string, prefix: string) {
  if (
    !key ||
    key.includes("..") ||
    (prefix && !key.startsWith(`${prefix}/`) && key !== prefix)
  )
    throw new Error("Object key is outside the allowed prefix");
}
async function readObject(
  s3: AwsClient,
  endpoint: string,
  bucket: string,
  key: string,
  prefix: string,
) {
  assertKey(key, prefix);
  const url = `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const response = await s3.fetch(url);
  if (!response.ok)
    throw new Error(`R2 object fetch failed (${response.status})`);
  return await response.text();
}
function json(body: string, label: string) {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}
function classify(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown catalog error";
  if (/schema|catalog column|unsupported/i.test(message))
    return { code: "SCHEMA_INCOMPATIBLE" as const, message };
  if (/not found|NoSuchKey|404/i.test(message))
    return { code: "RELEASE_NOT_FOUND" as const, message };
  if (/ClickHouse|PrimaryKey|fetch|connect|timeout/i.test(message))
    return { code: "DATA_SOURCE_UNAVAILABLE" as const, message };
  return { code: "RELEASE_INVALID" as const, message };
}

export const refreshCatalog = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const config = configuration();
      const s3 = new AwsClient({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        service: "s3",
        region: "auto",
      });
      {
        const pointerBody = await readObject(
          s3,
          config.endpoint,
          config.bucket,
          config.objectKey,
          config.prefix,
        );
        const pointer = parseTargetPointer(
          json(pointerBody, "Catalog pointer"),
        );
        const releaseBody = await readObject(
          s3,
          config.endpoint,
          config.bucket,
          pointer.objectKey,
          config.prefix,
        );
        if (sha256Hex(releaseBody) !== pointer.envelopeSha256)
          throw new Error("Release envelope checksum mismatch");
        const releaseRaw = json(releaseBody, "Target release") as Record<
          string,
          unknown
        >;
        const envelope = parseTargetReleaseEnvelope(releaseRaw);
        if (
          pointer.targetReleaseVersion &&
          pointer.targetReleaseVersion !== envelope.release.targetReleaseVersion
        )
          throw new Error("Pointer and release version mismatch");
        if (
          sha256Hex(canonicalJson(releaseRaw.release)) !==
          envelope.releaseSha256
        )
          throw new Error("Release checksum mismatch");
        const releaseKey = config.releaseKeys[envelope.keyId];
        if (!releaseKey) throw new Error("Unknown release signing key");
        verifyEd25519(releaseRaw.release, envelope.signature, releaseKey);

        const source = selectTargetSource(envelope, config.sourceKey);
        const state = await ctx.runQuery(internal.internal.getRuntimeState, {});
        if (
          state?.pointerFingerprint === source.manifestSha256 &&
          state.selectedReleaseFingerprint === source.manifestSha256
        ) {
          await ctx.runMutation(internal.internal.markChecked, {});
          return { status: "unchanged" as const };
        }

        const indicators: unknown[] = [];
        const nodes: unknown[] = [];
        const edges: unknown[] = [];
        const indicatorKeys = new Set<string>();
        {
          const sourceBody = await readObject(
            s3,
            config.endpoint,
            config.bucket,
            source.manifestObjectKey,
            config.prefix,
          );
          if (sha256Hex(sourceBody) !== source.manifestSha256)
            throw new Error("Source envelope checksum mismatch");
          const sourceRaw = json(sourceBody, "Source envelope") as Record<
            string,
            unknown
          >;
          const sourceEnvelope = parseSourceEnvelope(sourceRaw);
          if (
            sha256Hex(canonicalJson(sourceRaw.manifest)) !==
            sourceEnvelope.manifestSha256
          )
            throw new Error("Source manifest checksum mismatch");
          const sourceKey = config.sourceKeys[sourceEnvelope.keyId];
          if (!sourceKey || sourceEnvelope.keyId !== source.keyId)
            throw new Error("Unknown or mismatched source signing key");
          verifyEd25519(
            sourceRaw.manifest,
            sourceEnvelope.signature,
            sourceKey,
          );
          if (
            sourceEnvelope.manifest.targetNamespace !==
              envelope.release.targetNamespace ||
            sourceEnvelope.manifest.sourceKey !== source.sourceKey ||
            sourceEnvelope.manifest.sourceCatalogVersion !==
              source.sourceCatalogVersion
          )
            throw new Error("Source manifest identity mismatch");
          for (const chunk of [...sourceEnvelope.manifest.chunks].sort(
            (a, b) => a.index - b.index,
          )) {
            const body = await readObject(
              s3,
              config.endpoint,
              config.bucket,
              chunk.objectKey,
              config.prefix,
            );
            if (sha256Hex(body) !== chunk.sha256)
              throw new Error("Catalog chunk checksum mismatch");
            const values = json(body, `Catalog ${chunk.kind} chunk`);
            if (!Array.isArray(values) || values.length !== chunk.count)
              throw new Error("Catalog chunk count mismatch");
            if (chunk.kind === "indicators") {
              for (const value of values) {
                const key = (value as { indicatorKey?: unknown })?.indicatorKey;
                if (typeof key !== "string" || indicatorKeys.has(key))
                  throw new Error("Invalid or duplicate indicator key");
                indicatorKeys.add(key);
                indicators.push(value);
              }
            } else if (chunk.kind === "lineage_nodes") nodes.push(...values);
            else edges.push(...values);
          }
        }
        if (indicators.length !== source.indicatorCount)
          throw new Error("Source indicator count mismatch");
        const catalog = parseCatalogV5({
          schema: "sync-indicators.catalog/v5",
          namespace: envelope.release.targetNamespace,
          catalogVersion: envelope.release.targetReleaseVersion,
          generatedAt: envelope.release.generatedAt,
          indicators: selectUiEnabledIndicators(indicators),
          lineage: { nodes, edges },
        });
        const runtime = projectRuntimeIndicators(catalog);
        await preflightIndicators(runtime);
        const releaseId = await ctx.runMutation(
          internal.internal.beginCandidate,
          {
            releaseVersion: envelope.release.targetReleaseVersion,
            generatedAt: envelope.release.generatedAt,
            fingerprint: source.manifestSha256,
            indicatorCount: runtime.length,
          },
        );
        const items = runtime.map((indicator) => ({
          indicatorKey: indicator.indicatorKey,
          label: indicator.view.label,
          description: indicator.description,
          domain: indicator.view.domain,
          unit: indicator.view.unit,
          symbol: indicator.symbol,
          periodicity: indicator.periodicity,
          isReverse: indicator.isReverse,
          grain: indicator.knowledge.analysis.grain,
          relationName: indicator.relationName,
          valueColumn: indicator.view.valueColumn,
          timeColumn: indicator.knowledge.analysis.timeColumn,
          ...(indicator.knowledge.analysis.tenantColumn
            ? { tenantColumn: indicator.knowledge.analysis.tenantColumn }
            : {}),
          dimensionsJson: JSON.stringify(
            indicator.knowledge.analysis.dimensions,
          ),
        }));
        for (let offset = 0; offset < items.length; offset += 100)
          await ctx.runMutation(internal.internal.writeCatalogBatch, {
            releaseId,
            items: items.slice(offset, offset + 100),
          });
        await ctx.runMutation(internal.internal.finishCandidate, {
          releaseId,
          fingerprint: source.manifestSha256,
        });
        return {
          status: "updated" as const,
          releaseVersion: envelope.release.targetReleaseVersion,
          indicatorCount: items.length,
        };
      }
    } catch (error) {
      await ctx.runMutation(internal.internal.markSyncError, classify(error));
      throw error;
    }
  },
});
