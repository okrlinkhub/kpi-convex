import { defineComponent } from "convex/server";
import { v } from "convex/values";

export default defineComponent("kpiConvex", {
  env: {
    KPI_CONVEX_R2_ENDPOINT: v.string(),
    KPI_CONVEX_R2_BUCKET: v.string(),
    KPI_CONVEX_R2_ACCESS_KEY_ID: v.string(),
    KPI_CONVEX_R2_SECRET_ACCESS_KEY: v.string(),
    KPI_CONVEX_CATALOG_OBJECT_KEY: v.string(),
    KPI_CONVEX_SOURCE_KEY: v.string(),
    KPI_CONVEX_CATALOG_PREFIX: v.optional(v.string()),
    KPI_CONVEX_RELEASE_PUBLIC_KEYS_JSON: v.string(),
    KPI_CONVEX_SOURCE_PUBLIC_KEYS_JSON: v.string(),
    KPI_CONVEX_CLICKHOUSE_URL: v.string(),
    KPI_CONVEX_CLICKHOUSE_DATABASE: v.string(),
    KPI_CONVEX_CLICKHOUSE_USERNAME: v.string(),
    KPI_CONVEX_CLICKHOUSE_PASSWORD: v.string(),
    KPI_CONVEX_VALUES_READY_HMAC_SECRET: v.string(),
    KPI_CONVEX_SCOPE_VALUE: v.optional(v.string()),
    KPI_CONVEX_PROJECTED_POINTS: v.optional(v.string()),
  },
});
