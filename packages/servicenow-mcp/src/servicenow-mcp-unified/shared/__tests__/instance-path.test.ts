/**
 * isInstancePath decides whether a path from tool arguments may be handed to
 * the authenticated client, which attaches the instance's credentials to
 * whatever URL it ends up requesting. Every rejected input below is a shape
 * that would leave the instance — directly through axios, or after a URL
 * parser normalises it.
 */

import { describe, test, expect } from "@jest/globals"
import { isInstancePath } from "../instance-path"

describe("isInstancePath", () => {
  test("accepts paths on the instance, query strings included", () => {
    expect(isInstancePath("/api/now/table/incident")).toBe(true)
    expect(isInstancePath("/api/now/table/incident?sysparm_limit=1")).toBe(true)
    expect(isInstancePath("/api/x_acme_app/v1/orders/42")).toBe(true)
    expect(isInstancePath("/")).toBe(true)
  })

  test("accepts a URL that only appears inside the query, where it is data", () => {
    expect(isInstancePath("/api/now/table/sys_attachment?sysparm_query=urlLIKEhttps://example.com")).toBe(true)
  })

  test("refuses absolute URLs, whatever the scheme or case", () => {
    expect(isInstancePath("https://attacker.example.com/collect")).toBe(false)
    expect(isInstancePath("http://attacker.example.com/collect")).toBe(false)
    expect(isInstancePath("HTTPS://attacker.example.com/collect")).toBe(false)
    expect(isInstancePath("ftp://attacker.example.com/collect")).toBe(false)
  })

  test("refuses protocol-relative and backslash forms", () => {
    expect(isInstancePath("//attacker.example.com/collect")).toBe(false)
    expect(isInstancePath("/\\attacker.example.com/collect")).toBe(false)
    expect(isInstancePath("\\\\attacker.example.com/collect")).toBe(false)
    expect(isInstancePath("/api/now/table\\incident")).toBe(false)
  })

  test("refuses control characters a URL parser would strip into '//'", () => {
    expect(isInstancePath("/\t/attacker.example.com/collect")).toBe(false)
    expect(isInstancePath("/\n/attacker.example.com/collect")).toBe(false)
    expect(isInstancePath("/api/now/table/incident\r\nHost: attacker.example.com")).toBe(false)
  })

  test("refuses anything that does not start with '/'", () => {
    expect(isInstancePath("api/now/table/incident")).toBe(false)
    expect(isInstancePath(" /api/now/table/incident")).toBe(false)
    expect(isInstancePath("")).toBe(false)
  })

  test("refuses non-strings", () => {
    expect(isInstancePath(undefined)).toBe(false)
    expect(isInstancePath(null)).toBe(false)
    expect(isInstancePath(42)).toBe(false)
    expect(isInstancePath({ toString: () => "/api/now/table/incident" })).toBe(false)
  })
})
