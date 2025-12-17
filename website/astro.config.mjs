import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://snow-flow.dev',

  // Static Site Generation
  output: 'static',

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
      priority: 0.7,
      lastmod: new Date()
    })
  ],

  build: {
    inlineStylesheets: 'auto'
  },

  vite: {
    css: {
      devSourcemap: true
    }
  }
});
