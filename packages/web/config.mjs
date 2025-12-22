const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://snow-flow.dev" : `https://${stage}.snow-flow.dev`,
  console: stage === "production" ? "https://portal.snow-flow.dev" : `https://${stage}.portal.snow-flow.dev`,
  email: "contact@groeimetai.com",
  socialCard: "https://snow-flow.dev/og-image.png",
  github: "https://github.com/groeimetai/snow-flow",
  discord: "https://discord.gg/snowflow",
  headerLinks: [
    { name: "Home", url: "https://snow-flow.dev" },
    { name: "Docs", url: "/docs/" },
  ],
}
