/// <reference types="vite/client" />
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema.js";

const modules = import.meta.glob("./component/**/*.ts");
export function registerKpiComponent(t: TestConvex<SchemaDefinition<GenericSchema, boolean>>, name = "kpiConvex") {
  t.registerComponent(name, schema, modules);
}
export { schema, modules };
