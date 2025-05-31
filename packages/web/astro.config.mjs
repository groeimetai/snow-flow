// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import solidJs from "@astrojs/solid-js"
import theme from "toolbeam-docs-theme"
import { rehypeHeadingIds } from "@astrojs/markdown-remark"
import rehypeAutolinkHeadings from "rehype-autolink-headings"

const discord = "https://discord.gg/sst"
const github = "https://github.com/sst/opencode"

// https://astro.build/config
export default defineConfig({
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
      title: "OpenCode",
      expressiveCode: { themes: ["github-light", "github-dark"] },
      social: [
        { icon: "discord", label: "Discord", href: discord },
        { icon: "github", label: "GitHub", href: github },
      ],
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
        "docs/models",
        "docs/themes",
        "docs/shortcuts",
        "docs/lsp-servers",
        "docs/mcp-servers",
      ],
      components: {
        Hero: "./src/components/Hero.astro",
        Header: "./src/components/Header.astro",
      },
      plugins: [
        theme({
          // Optionally, add your own header links
          headerLinks: [
            { name: "Home", url: "/" },
            { name: "Docs", url: "/docs/" },
          ],
        }),
      ],
    }),
  ],
})
