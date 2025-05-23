const bucket = new sst.cloudflare.Bucket("Bucket")

export const api = new sst.cloudflare.Worker("Api", {
  handler: "packages/function/src/api.ts",
  url: true,
  link: [bucket],
  transform: {
    worker: (args) => {
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

//new sst.cloudflare.StaticSite("Web", {
//  path: "packages/web",
//  environment: {
//    VITE_API_URL: api.url,
//  },
//  errorPage: "fallback.html",
//  build: {
//    command: "bun run build",
//    output: "dist/client",
//  },
//})
