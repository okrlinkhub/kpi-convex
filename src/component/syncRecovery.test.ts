import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import schema from "./schema.js";
import { modules } from "../test.js";
import { internal } from "./_generated/api.js";
import { canonicalJson, sha256Hex, SOURCE_ENVELOPE_SCHEMA, SOURCE_MANIFEST_SCHEMA, TARGET_POINTER_SCHEMA, TARGET_RELEASE_ENVELOPE_SCHEMA, TARGET_RELEASE_SCHEMA } from "../contracts/index.js";

const config = vi.hoisted(() => ({} as Record<string, string>));
vi.mock("./_generated/server.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./_generated/server.js")>(),
  env: config,
}));

function backend() {
  return convexTest(schema, modules);
}
type Backend = ReturnType<typeof backend>;

async function candidate(t: Backend, version = "release-1") {
  const releaseId = await t.mutation(internal.internal.beginCandidate, {
    releaseVersion: version, generatedAt: "2026-10-08T07:00:00Z", fingerprint: "source-same", indicatorCount: 0,
  });
  await t.mutation(internal.internal.finishCandidate, { releaseId, fingerprint: "source-same" });
  return releaseId;
}
async function activate(t: Backend, version = "release-1", run = "run-1") {
  const accepted = await t.mutation(internal.internal.acceptCallback, { eventId: run, sourceRunId: run, releaseVersion: version });
  await t.mutation(internal.internal.activateGeneration, { generationId: accepted.generationId! });
  return accepted;
}

function signedCatalog(version: string) {
  const keys = generateKeyPairSync("ed25519");
  const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  config.KPI_CONVEX_RELEASE_PUBLIC_KEYS_JSON = JSON.stringify({ test: publicKey });
  config.KPI_CONVEX_SOURCE_PUBLIC_KEYS_JSON = JSON.stringify({ test: publicKey });
  const signature = (value: unknown) => sign(null, Buffer.from(canonicalJson(value)), keys.privateKey).toString("base64");
  const manifest = { schema: SOURCE_MANIFEST_SCHEMA, targetNamespace: "pcg", sourceKey: "abaddon-project", sourceCatalogVersion: "source-v1", generatedAt: "2026-10-08T07:00:00Z", indicatorCount: 0, lineageNodeCount: 0, lineageEdgeCount: 0, chunks: [] };
  const sourceBody = JSON.stringify({ schema: SOURCE_ENVELOPE_SCHEMA, keyId: "test", manifestSha256: sha256Hex(canonicalJson(manifest)), signature: signature(manifest), manifest });
  const fingerprint = sha256Hex(sourceBody);
  const release = { schema: TARGET_RELEASE_SCHEMA, targetNamespace: "pcg", targetReleaseVersion: version, generatedAt: "2026-10-08T07:00:00Z", indicatorCount: 0, sources: [{ sourceKey: "abaddon-project", sourceCatalogVersion: "source-v1", manifestObjectKey: "catalog/source.json", manifestSha256: fingerprint, keyId: "test", indicatorCount: 0 }] };
  const releaseBody = JSON.stringify({ schema: TARGET_RELEASE_ENVELOPE_SCHEMA, keyId: "test", releaseSha256: sha256Hex(canonicalJson(release)), signature: signature(release), release });
  const objects: Record<string, string> = {
    "/bucket/catalog/current.json": JSON.stringify({ schema: TARGET_POINTER_SCHEMA, objectKey: "catalog/release.json", envelopeSha256: sha256Hex(releaseBody), targetReleaseVersion: version }),
    "/bucket/catalog/release.json": releaseBody,
    "/bucket/catalog/source.json": sourceBody,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const body = objects[url.pathname];
    return new Response(body ?? "Not found", { status: body ? 200 : 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fingerprint, fetchMock };
}
function callback(version: string, signatureValid = true) {
  const body = JSON.stringify({ eventId: `event-${version}`, sourceRunId: `run-${version}`, releaseVersion: version, timestamp: new Date().toISOString() });
  return { method: "POST", body, headers: { "x-kpi-signature": signatureValid ? createHmac("sha256", config.KPI_CONVEX_VALUES_READY_HMAC_SECRET).update(body).digest("hex") : "0".repeat(64) } };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(config, { KPI_CONVEX_R2_ENDPOINT: "https://r2.example.test", KPI_CONVEX_R2_BUCKET: "bucket", KPI_CONVEX_R2_ACCESS_KEY_ID: "fixture", KPI_CONVEX_R2_SECRET_ACCESS_KEY: "fixture", KPI_CONVEX_CATALOG_OBJECT_KEY: "catalog/current.json", KPI_CONVEX_SOURCE_KEY: "abaddon-project", KPI_CONVEX_CLICKHOUSE_URL: "https://clickhouse.example.test", KPI_CONVEX_CLICKHOUSE_DATABASE: "fixture", KPI_CONVEX_CLICKHOUSE_USERNAME: "fixture", KPI_CONVEX_CLICKHOUSE_PASSWORD: "fixture", KPI_CONVEX_VALUES_READY_HMAC_SECRET: "test-only-hmac" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("accepts fresh values for an already active verified release and deduplicates retries", async () => {
  const t = backend();
  const releaseId = await candidate(t);
  await activate(t);
  const args = { eventId: "event-2", sourceRunId: "run-2", releaseVersion: "release-1" };
  const next = await t.mutation(internal.internal.acceptCallback, args);
  expect(next).toMatchObject({ duplicate: false, releaseId });
  expect(await t.mutation(internal.internal.acceptCallback, args)).toMatchObject({ duplicate: true });
  await t.mutation(internal.internal.activateGeneration, { generationId: next.generationId! });
  expect(await t.run(ctx => ctx.db.get("catalogReleases", releaseId))).toMatchObject({ status: "active" });
});

test("rejects an unknown callback release without replacing active data", async () => {
  const t = backend();
  await candidate(t);
  const active = await activate(t);
  await expect(t.mutation(internal.internal.acceptCallback, { eventId: "bad", sourceRunId: "bad", releaseVersion: "unknown" })).rejects.toThrow("RELEASE_NOT_FOUND");
  expect(await t.query(internal.internal.getRuntimeState, {})).toMatchObject({ activeGenerationId: active.generationId });
});

test("activating an older in-flight generation preserves a newer verified candidate", async () => {
  const t = backend();
  await candidate(t);
  const first = await t.mutation(internal.internal.acceptCallback, { eventId: "first", sourceRunId: "first", releaseVersion: "release-1" });
  const newer = await candidate(t, "release-2");
  await t.mutation(internal.internal.activateGeneration, { generationId: first.generationId! });
  expect(await t.query(internal.internal.getRuntimeState, {})).toMatchObject({ candidateReleaseId: newer });
});

test("imports a new target release even when the selected source fingerprint is unchanged", async () => {
  const t = backend();
  const { fingerprint } = signedCatalog("release-2");
  const releaseId = await candidate(t);
  await t.run(ctx => ctx.db.patch("catalogReleases", releaseId, { fingerprint }));
  await t.mutation(internal.internal.finishCandidate, { releaseId, fingerprint });
  await activate(t);
  expect(await t.action(internal.syncActions.refreshCatalog, {})).toMatchObject({ status: "updated", releaseVersion: "release-2" });
});

test("a valid callback refreshes the signed catalog before accepting a new release", async () => {
  const t = backend();
  signedCatalog("release-2");
  const response = await t.fetch("/values-ready", callback("release-2"));
  expect(response.status).toBe(202);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await t.query(internal.internal.getRuntimeState, {})).toMatchObject({ selectedReleaseVersion: "release-2" });
});

test("an invalid HMAC cannot trigger a catalog refresh", async () => {
  const t = backend();
  const { fetchMock } = signedCatalog("release-2");
  expect((await t.fetch("/values-ready", callback("release-2", false))).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a callback for a release outside the verified pointer remains rejected", async () => {
  const t = backend();
  signedCatalog("release-2");
  expect((await t.fetch("/values-ready", callback("unknown"))).status).toBe(409);
  expect((await t.query(internal.internal.getRuntimeState, {}))?.activeGenerationId).toBeUndefined();
});
