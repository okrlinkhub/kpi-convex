/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as internal_ from "../internal.js";
import type * as lib from "../lib.js";
import type * as metrics from "../metrics.js";
import type * as preferences from "../preferences.js";
import type * as projections from "../projections.js";
import type * as runtime from "../runtime.js";
import type * as savedViews from "../savedViews.js";
import type * as sync from "../sync.js";
import type * as syncActions from "../syncActions.js";
import type * as validators from "../validators.js";
import type * as workers from "../workers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  admin: typeof admin;
  catalog: typeof catalog;
  crons: typeof crons;
  favorites: typeof favorites;
  http: typeof http;
  internal: typeof internal_;
  lib: typeof lib;
  metrics: typeof metrics;
  preferences: typeof preferences;
  projections: typeof projections;
  runtime: typeof runtime;
  savedViews: typeof savedViews;
  sync: typeof sync;
  syncActions: typeof syncActions;
  validators: typeof validators;
  workers: typeof workers;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {};
