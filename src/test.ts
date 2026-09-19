import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema.js";

const modules = {
  "./component/_generated/api.js": () => import("./component/_generated/api.js"),
  "./component/_generated/component.js": () => import("./component/_generated/component.js"),
  "./component/_generated/dataModel.js": () => import("./component/_generated/dataModel.js"),
  "./component/_generated/server.js": () => import("./component/_generated/server.js"),
  "./component/admin.js": () => import("./component/admin.js"),
  "./component/catalog.js": () => import("./component/catalog.js"),
  "./component/convex.config.js": () => import("./component/convex.config.js"),
  "./component/crons.js": () => import("./component/crons.js"),
  "./component/dashboards.js": () => import("./component/dashboards.js"),
  "./component/favorites.js": () => import("./component/favorites.js"),
  "./component/http.js": () => import("./component/http.js"),
  "./component/internal.js": () => import("./component/internal.js"),
  "./component/lib.js": () => import("./component/lib.js"),
  "./component/metrics.js": () => import("./component/metrics.js"),
  "./component/preferences.js": () => import("./component/preferences.js"),
  "./component/projections.js": () => import("./component/projections.js"),
  "./component/runtime.js": () => import("./component/runtime.js"),
  "./component/savedViews.js": () => import("./component/savedViews.js"),
  "./component/schema.js": () => import("./component/schema.js"),
  "./component/sync.js": () => import("./component/sync.js"),
  "./component/syncActions.js": () => import("./component/syncActions.js"),
  "./component/validators.js": () => import("./component/validators.js"),
  "./component/workers.js": () => import("./component/workers.js"),
} satisfies Record<string, () => Promise<unknown>>;

export function registerKpiComponent(t: TestConvex<SchemaDefinition<GenericSchema, boolean>>, name = "kpiConvex") {
  t.registerComponent(name, schema, modules);
}
export { schema, modules };
