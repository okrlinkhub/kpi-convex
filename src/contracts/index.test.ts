import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import { canonicalJson, parseTargetReleaseEnvelope, selectUiEnabledIndicators, sha256Hex, verifyEd25519 } from "./index.js";

describe("signed catalog contracts", () => {
  test("accepts a valid Ed25519 release and rejects tampering", () => {
    const keys = generateKeyPairSync("ed25519");
    const release = { schema: "sync-indicators.target-catalog-release/v1", targetNamespace: "example", targetReleaseVersion: `sha256-${"a".repeat(64)}`, generatedAt: "2026-09-18T10:00:00.000Z", indicatorCount: 1, sources: [{ sourceKey: "example", sourceCatalogVersion: `sha256-${"b".repeat(64)}`, manifestObjectKey: "catalog/source.json", manifestSha256: "c".repeat(64), keyId: "source-1", indicatorCount: 1 }] };
    const signature = sign(null, Buffer.from(canonicalJson(release)), keys.privateKey).toString("base64");
    const envelope = parseTargetReleaseEnvelope({ schema: "sync-indicators.target-catalog-release-envelope/v1", keyId: "release-1", releaseSha256: sha256Hex(canonicalJson(release)), signature, release });
    const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(() => verifyEd25519(envelope.release, envelope.signature, publicKey)).not.toThrow();
    expect(() => verifyEd25519({ ...envelope.release, indicatorCount: 2 }, envelope.signature, publicKey)).toThrow("Invalid Ed25519 signature");
  });

  test("selects only indicators carrying the UI presentation contract", () => {
    const visible = { indicatorKey: "example.visible", view: { label: "Visible" }, knowledge: { analysis: {} } };
    const catalogOnly = { indicatorKey: "example.catalog-only" };
    expect(selectUiEnabledIndicators([catalogOnly, visible, null])).toEqual([visible]);
  });
});
