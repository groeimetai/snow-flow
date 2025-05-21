// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import theme from "toolbeam-docs-theme";
import { rehypeHeadingIds } from "@astrojs/markdown-remark";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

const discord = "https://discord.gg/sst";
const github = "https://github.com/sst/opencode";

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
		starlight({
			title: "OpenCode",
			social: [
				{ icon: "discord", label: "Discord", href: discord },
				{ icon: "github", label: "GitHub", href: github },
			],
			editLink: {
				baseUrl: `${github}/edit/master/www/`,
			},
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
			},
			plugins: [theme({
				// Optionally, add your own header links
				headerLinks: [
					{ name: "Home", url: "/" },
					{ name: "Docs", url: "/docs/" },
				],
			})],
		}),
	],
});
