import { describeRoute, type DescribeRouteOptions } from "hono-openapi"
import { createMiddleware } from "hono/factory"

/**
 * Typed wrapper around hono-openapi's `describeRoute` that preserves
 * middleware type-chain compatibility.
 *
 * `describeRoute()` returns `MiddlewareHandler` with a fixed string path
 * parameter, which causes overload-resolution failures in tsgo on Linux
 * when combined with `validator()` middleware in a route handler chain.
 *
 * This wrapper calls `describeRoute` internally but returns a properly
 * typed middleware created via Hono's `createMiddleware`, which preserves
 * generic type parameters through the handler chain.
 */
export function describe(spec: DescribeRouteOptions) {
  const original = describeRoute(spec)
  return createMiddleware(async (c, next) => {
    return original(c, next)
  })
}
