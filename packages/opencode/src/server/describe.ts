import { describeRoute, type DescribeRouteOptions } from "hono-openapi"
import type { MiddlewareHandler } from "hono"

/**
 * Typed wrapper around hono-openapi's `describeRoute` that preserves
 * middleware type-chain compatibility.
 *
 * `describeRoute()` returns a plain `MiddlewareHandler` (no type params),
 * which causes overload-resolution failures in tsgo (native TS compiler)
 * when combined with `validator()` middleware in a route handler chain.
 *
 * This wrapper casts the result so that Hono's `HandlerInterface` overloads
 * resolve correctly on all platforms.
 */
export const describe = describeRoute as unknown as (spec: DescribeRouteOptions) => MiddlewareHandler<any, any, {}>
