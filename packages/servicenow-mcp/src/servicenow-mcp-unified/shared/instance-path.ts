/**
 * Whether a caller-supplied request path can only resolve to the instance.
 *
 * The client from auth.ts sends the instance's Authorization header with every
 * request, and axios drops its baseURL when handed an absolute URL — so a tool
 * that forwards a path from its arguments as-is sends those credentials to
 * whatever host the arguments name. Arguments come from a model that reads
 * instance data, so that host is not necessarily one anyone chose.
 *
 * Exactly one leading "/" is the rule because "//host" is protocol-relative and
 * URL parsers read "/\host" the same way. Control characters are refused too:
 * the parser strips tab, CR and LF wherever they appear, so "/\t/host" would
 * collapse into "//host" after this check had passed it.
 */
export function isInstancePath(path: unknown): path is string {
  return typeof path === "string" && /^\/(?![/\\])[^\\\p{Cc}]*$/u.test(path)
}
