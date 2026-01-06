import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://snow-flow.dev',

  // Static Site Generation
  output: 'static',

  // Enforce trailing slashes for consistent URLs (SEO best practice)
  trailingSlash: 'always',

  // i18n configuration
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'nl'],
    routing: {
      prefixDefaultLocale: true
    },
    fallback: {
      nl: 'en'
    }
  },

  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en-US',
          nl: 'nl-NL'
        }
      },
      filter: (page) => !page.includes('/api/'),
      changefreq: 'weekly',
      lastmod: new Date(),
      // Custom priority based on page type
      serialize(item) {
        // Homepage gets highest priority
        if (item.url.match(/\/(en|nl)\/$/)) {
          item.priority = 1.0;
          item.changefreq = 'daily';
        }
        // Enterprise pages
        else if (item.url.includes('/enterprise/')) {
          item.priority = 0.9;
        }
        // Documentation pages
        else if (item.url.includes('/docs') || item.url.includes('/cli-reference') || item.url.includes('/mcp-reference')) {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        }
        // Other pages
        else {
          item.priority = 0.7;
        }
        return item;
      }
    })
  ],

  build: {
    // Inline small stylesheets to reduce render-blocking
    inlineStylesheets: 'always'
  },

  vite: {
    css: {
      devSourcemap: true
    }
  }
});
