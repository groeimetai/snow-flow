/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "opencode",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",
      providers: {
        cloudflare: {
          apiToken:
            input?.stage === "production"
              ? process.env.PRODUCTION_CLOUDFLARE_API_TOKEN
              : process.env.DEV_CLOUDFLARE_API_TOKEN,
        },
      },
    }
  },
  async run() {
    const { api } = await import("./infra/app.js")
    return {
      api: api.url,
    }
  },
})
