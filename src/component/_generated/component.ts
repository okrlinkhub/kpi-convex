/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    admin: {
      requestRefresh: FunctionReference<"action", "internal", {}, any, Name>;
    };
    catalog: {
      get: FunctionReference<
        "query",
        "internal",
        { indicatorKey: string },
        {
          current: { period: string; value: number } | null;
          delta: number | null;
          deltaPercent: number | null;
          description: string;
          dimensions: Array<string>;
          domain: string;
          generatedAt: string;
          grain: string;
          indicatorKey: string;
          label: string;
          previous: { period: string; value: number } | null;
          releaseVersion: string;
          unit: string;
        } | null,
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          domain?: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          search?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            current: { period: string; value: number } | null;
            delta: number | null;
            deltaPercent: number | null;
            description: string;
            dimensions: Array<string>;
            domain: string;
            generatedAt: string;
            grain: string;
            indicatorKey: string;
            label: string;
            previous: { period: string; value: number } | null;
            releaseVersion: string;
            unit: string;
          }>;
        },
        Name
      >;
    };
    favorites: {
      list: FunctionReference<
        "query",
        "internal",
        { viewerKey: string },
        Array<string>,
        Name
      >;
      toggle: FunctionReference<
        "mutation",
        "internal",
        { indicatorKey: string; viewerKey: string },
        boolean,
        Name
      >;
    };
    metrics: {
      getLiveDetail: FunctionReference<
        "action",
        "internal",
        {
          endDate: string;
          indicatorKey: string;
          limit?: number;
          startDate: string;
        },
        {
          fetchedAt: number;
          history: Array<{ period: string; value: number }>;
          indicatorKey: string;
        },
        Name
      >;
    };
    preferences: {
      get: FunctionReference<
        "query",
        "internal",
        { viewerKey: string },
        {
          catalogView: "table" | "cards";
          defaultChartMode: "line" | "bar" | "area" | "table";
          density: "compact" | "comfortable";
          theme: "light" | "dark" | "system";
        },
        Name
      >;
      save: FunctionReference<
        "mutation",
        "internal",
        {
          preferences: {
            catalogView: "table" | "cards";
            defaultChartMode: "line" | "bar" | "area" | "table";
            density: "compact" | "comfortable";
            theme: "light" | "dark" | "system";
          };
          viewerKey: string;
        },
        null,
        Name
      >;
    };
    projections: {
      getSeries: FunctionReference<
        "query",
        "internal",
        { indicatorKey: string },
        Array<{ period: string; value: number }>,
        Name
      >;
    };
    savedViews: {
      list: FunctionReference<
        "query",
        "internal",
        { viewerKey: string },
        Array<{
          definition: any;
          name: string;
          updatedAt: number;
          viewKey: string;
        }>,
        Name
      >;
      remove: FunctionReference<
        "mutation",
        "internal",
        { viewKey: string; viewerKey: string },
        null,
        Name
      >;
      save: FunctionReference<
        "mutation",
        "internal",
        { definition: any; name: string; viewKey: string; viewerKey: string },
        null,
        Name
      >;
    };
    sync: {
      getStatus: FunctionReference<
        "query",
        "internal",
        {},
        {
          errorCode:
            | "RELEASE_NOT_FOUND"
            | "RELEASE_INVALID"
            | "SCHEMA_INCOMPATIBLE"
            | "DATA_SOURCE_UNAVAILABLE"
            | "PROJECTION_FAILED"
            | null;
          lastCheckedAt: number | null;
          lastProjectedAt: number | null;
          releaseVersion: string | null;
          sourceRunId: string | null;
          state: "empty" | "ready" | "degraded" | "projecting";
        },
        Name
      >;
    };
  };
