import { describeRoute, type DescribeRouteOptions } from "hono-openapi"

/**
 * Typed wrapper around hono-openapi's `describeRoute` that preserves
 * middleware type-chain compatibility.
 *
 * Root cause: monorepo has hono 4.11.10 (root) and 4.12.2 (packages/opencode).
 * tsgo on Linux treats these as incompatible types, breaking describeRoute's
 * MiddlewareHandler return type in route chains with validator().
 *
 * Fix: return type `any` erases the cross-package type boundary so Hono's
 * HandlerInterface overloads resolve from the caller's own hono version.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function describe(spec: DescribeRouteOptions): any {
  return describeRoute(spec)
}
