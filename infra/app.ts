export const domain = (() => {
  if ($app.stage === "production") return "opencode.ai"
  if ($app.stage === "dev") return "dev.opencode.ai"
  return `${$app.stage}.dev.opencode.ai`
})()

const bucket = new sst.cloudflare.Bucket("Bucket")

export const api = new sst.cloudflare.Worker("Api", {
  domain: `api.${domain}`,
  handler: "packages/function/src/api.ts",
  url: true,
  link: [bucket],
  transform: {
    worker: (args) => {
      args.logpush = true
      args.bindings = $resolve(args.bindings).apply((bindings) => [
        ...bindings,
        {
          name: "SYNC_SERVER",
          type: "durable_object_namespace",
          className: "SyncServer",
        },
      ])
      args.migrations = {
        oldTag: "v1",
        newTag: "v1",
        //newSqliteClasses: ["SyncServer"],
      }
    },
  },
})

// new sst.cloudflare.StaticSite("Web", {
//   path: "packages/web",
//   domain,
//   environment: {
//     VITE_API_URL: api.url,
//   },
//   build: {
//     command: "bun run build",
//     output: "dist",
//   },
// })
new sst.cloudflare.Astro("Web", {
  domain,
  path: "packages/web",
  environment: {
    VITE_API_URL: api.url,
  },
})
