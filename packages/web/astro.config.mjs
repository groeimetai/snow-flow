// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import solidJs from "@astrojs/solid-js"
import cloudflare from "@astrojs/cloudflare"
import theme from "toolbeam-docs-theme"
import config from "./config.mjs"
import { rehypeHeadingIds } from "@astrojs/markdown-remark"
import rehypeAutolinkHeadings from "rehype-autolink-headings"

const github = "https://github.com/sst/opencode"
const headerLinks = [
  { name: "Docs", url: "/docs/" },
  { name: "GitHub", url: github },
]

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  devToolbar: {
    enabled: false,
  },
  markdown: {
    rehypePlugins: [
      rehypeHeadingIds,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
    ],
  },
  integrations: [
    solidJs(),
    starlight({
      title: "opencode",
      expressiveCode: { themes: ["github-light", "github-dark"] },
      social: [{ icon: "github", label: "GitHub", href: config.github }],
      editLink: {
        baseUrl: `${github}/edit/master/www/`,
      },
      markdown: {
        headingLinks: false,
      },
      customCss: ["./src/styles/custom.css"],
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      sidebar: [
        "docs",
        "docs/cli",
        "docs/config",
        "docs/agents",
        "docs/models",
        "docs/themes",
        "docs/keybinds",
        "docs/mcp-servers",
      ],
      components: {
        Hero: "./src/components/Hero.astro",
        Header: "./src/components/Header.astro",
      },
      plugins: [
        theme({
          headerLinks: config.headerLinks,
        }),
      ],
    }),
  ],
})
