import { httpRouter } from "convex/server";
import { env, httpAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";

const http = httpRouter();
async function verifyHmac(body: string, supplied: string) {
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.KPI_CONVEX_VALUES_READY_HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(supplied.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16));
  return await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(body));
}
http.route({
  path: "/values-ready", method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const supplied = request.headers.get("x-kpi-signature")?.replace(/^sha256=/, "") ?? "";
    if (!(await verifyHmac(body, supplied))) return new Response("Invalid signature", { status: 401 });
    let payload: { eventId: string; sourceRunId: string; releaseVersion: string; timestamp: string };
    try { payload = JSON.parse(body) as typeof payload; } catch { return new Response("Invalid JSON", { status: 400 }); }
    if (![payload.eventId, payload.sourceRunId, payload.releaseVersion, payload.timestamp].every((value) => typeof value === "string" && value.length > 0)) return new Response("Invalid payload", { status: 400 });
    const timestamp = Date.parse(payload.timestamp);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000) return new Response("Expired callback", { status: 401 });
    try {
      const accepted = await ctx.runMutation(internal.internal.acceptCallback, {
        eventId: payload.eventId,
        sourceRunId: payload.sourceRunId,
        releaseVersion: payload.releaseVersion,
      });
      if (!accepted.duplicate && accepted.generationId && accepted.releaseId) await ctx.scheduler.runAfter(0, internal.workers.projectBatch, { generationId: accepted.generationId, releaseId: accepted.releaseId });
      return Response.json({ accepted: true, duplicate: accepted.duplicate }, { status: accepted.duplicate ? 200 : 202 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Callback rejected";
      return Response.json({ accepted: false, error: message }, { status: /RELEASE_NOT_FOUND/.test(message) ? 409 : 400 });
    }
  }),
});
export default http;
