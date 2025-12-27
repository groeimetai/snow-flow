# Snow-Flow Website

**Live URL**: https://snow-flow.dev

The official Snow-Flow marketing website built with Astro, featuring full internationalization (English & Dutch), comprehensive documentation pages, and enterprise sections.

## Features

- ✅ Static site generation with Astro 5.0
- ✅ Full internationalization (EN/NL)
- ✅ Responsive design (mobile-first)
- ✅ SEO optimized with structured data
- ✅ Dynamic MCP tools reference (410+ tools)
- ✅ CLI command reference
- ✅ OAuth setup guide
- ✅ TUI user guide
- ✅ Enterprise sections (customers, developers, partners, stakeholders)
- ✅ Early access waitlist
- ✅ Automatic sitemap generation

## Pages

### Main Pages

| Page | Route | Description |
|------|-------|-------------|
| Homepage | `/[lang]/` | Hero, features, branding |
| Quick Start | `/[lang]/docs` | Getting started guide |
| CLI Reference | `/[lang]/cli-reference` | Command documentation |
| MCP Reference | `/[lang]/mcp-reference` | 410+ MCP tools reference |
| OAuth Setup | `/[lang]/oauth-setup` | ServiceNow OAuth guide |
| TUI Guide | `/[lang]/tui-guide` | Terminal UI documentation |
| Stats | `/[lang]/stats` | Usage statistics |
| Waitlist | `/[lang]/waitlist` | Early access signup |

### Enterprise Pages

| Page | Route | Description |
|------|-------|-------------|
| Enterprise Overview | `/[lang]/enterprise/` | Enterprise features |
| Customers | `/[lang]/enterprise/customers` | Customer resources |
| Developers | `/[lang]/enterprise/developers` | Developer documentation |
| Partners | `/[lang]/enterprise/partners` | Partnership information |
| Stakeholders | `/[lang]/enterprise/stakeholders` | Stakeholder resources |

## Technology Stack

- **Framework**: [Astro](https://astro.build/) 5.0
- **Styling**: CSS with custom design system
- **Internationalization**: Custom i18n implementation
- **Build**: Static site generation (SSG)
- **Sitemap**: @astrojs/sitemap
- **TypeScript**: Full type support

## Project Structure

```
website/
├── src/
│   ├── components/           # Reusable Astro components
│   │   ├── Navigation.astro  # Main navigation
│   │   ├── LanguageSelector.astro  # EN/NL switcher
│   │   └── SEO.astro         # SEO meta tags
│   │
│   ├── data/
│   │   └── mcp-tools.json    # MCP tools data (410+ tools)
│   │
│   ├── i18n/
│   │   ├── locales/
│   │   │   ├── en.json       # English translations
│   │   │   └── nl.json       # Dutch translations
│   │   └── utils.ts          # i18n utility functions
│   │
│   ├── layouts/
│   │   └── BaseLayout.astro  # Main layout wrapper
│   │
│   ├── pages/
│   │   ├── index.astro       # Root redirect
│   │   └── [lang]/           # Language-based routing
│   │       ├── index.astro   # Homepage
│   │       ├── docs.astro    # Quick start
│   │       ├── cli-reference.astro
│   │       ├── mcp-reference.astro
│   │       ├── oauth-setup.astro
│   │       ├── tui-guide.astro
│   │       ├── stats.astro
│   │       ├── waitlist.astro
│   │       └── enterprise/   # Enterprise section
│   │           ├── index.astro
│   │           ├── customers.astro
│   │           ├── developers.astro
│   │           ├── partners.astro
│   │           └── stakeholders.astro
│   │
│   └── styles/               # CSS modules
│       ├── global.css        # Global styles
│       ├── animations.css    # Animation definitions
│       └── ...               # Page-specific styles
│
├── public/
│   ├── logos/                # Brand assets
│   ├── favicon.svg           # Favicon
│   └── robots.txt            # Robots configuration
│
├── astro.config.mjs          # Astro configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── BRAND_STYLEGUIDE.md       # Brand identity guide
└── README.md                 # This file
```

## Development

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or pnpm

### Local Setup

```bash
# Navigate to website directory
cd apps/website

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:4321
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (port 4321) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run astro` | Run Astro CLI commands |

### Development Server

The development server runs at `http://localhost:4321` with:
- Hot module replacement (HMR)
- Automatic page reloading
- TypeScript compilation

## Building for Production

```bash
# Build static site
npm run build

# Preview production build locally
npm run preview
```

The build output is generated in the `dist/` directory.

## Internationalization (i18n)

### Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `en` | English | ✅ Complete |
| `nl` | Dutch (Nederlands) | ✅ Complete |

### Adding Translations

1. Add translations to `src/i18n/locales/[lang].json`
2. Use the `useTranslations` helper in pages:

```astro
---
import { getLangFromUrl, useTranslations, type Lang } from '../../i18n/utils';

const lang = getLangFromUrl(Astro.url) as Lang;
const t = useTranslations(lang);
---

<h1>{t('hero.title')}</h1>
```

### Language Routing

All pages use `[lang]` dynamic routes:
- English: `/en/docs`, `/en/enterprise/`
- Dutch: `/nl/docs`, `/nl/enterprise/`

The root `/` redirects to the user's preferred language.

## MCP Tools Data

The MCP tools reference is data-driven, loaded from `src/data/mcp-tools.json`:

```json
{
  "totalTools": 410,
  "totalCategories": 15,
  "categories": [
    {
      "id": "core-operations",
      "name": "Core Operations",
      "description": { "en": "...", "nl": "..." },
      "toolCount": 30,
      "readCount": 20,
      "writeCount": 10,
      "tools": [...]
    }
  ]
}
```

### Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| Advanced AI/ML | 52 | AI and machine learning tools |
| Asset Management | 8 | Asset lifecycle management |
| Automation | 57 | Script execution & scheduling |
| CMDB | 14 | Configuration item management |
| Core Operations | 30 | Fundamental platform operations |
| Development | 78 | Platform development & UI |
| Integration | 33 | REST & external integrations |
| ITSM | 45 | IT Service Management |
| ML Analytics | 2 | Machine learning analytics |
| Performance Analytics | 3 | Performance monitoring |
| Reporting | 10 | Reports & dashboards |
| Security | 18 | Security & compliance |
| UI Builder | 9 | Now Experience UI |
| UI Frameworks | 19 | UI framework tools |
| Workspace | 1 | Workspace configuration |

## Styling

### Design System

See [BRAND_STYLEGUIDE.md](./BRAND_STYLEGUIDE.md) for the complete brand identity guide.

### CSS Architecture

The website uses a modular CSS architecture:

```
src/styles/
├── global.css              # CSS variables, resets
├── animations.css          # @keyframes definitions
├── button-fixes.css        # Button styling
├── hero-*.css              # Hero section styles
├── mobile-*.css            # Mobile responsive fixes
└── ...
```

### CSS Variables

Key design tokens defined in `global.css`:

```css
:root {
  /* Colors */
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-card: rgba(18, 18, 26, 0.8);
  --accent-cyan: #00d9ff;
  --text-primary: #ffffff;
  --text-secondary: #a0a0b0;
  --text-muted: #6b7280;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-medium: rgba(255, 255, 255, 0.12);

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

## Deployment

### Automatic Deployment

The website is automatically deployed via Cloud Build when changes are pushed to the `main` branch.

### Manual Deployment

```bash
# Build the site
npm run build

# Deploy to Cloud Run (static hosting)
gcloud run deploy snow-flow-website \
  --source . \
  --region europe-west4 \
  --allow-unauthenticated
```

### Custom Domain

The website is served at `snow-flow.dev` with automatic SSL.

## Components

### Navigation

```astro
<Navigation lang={lang} />
```

Features:
- Responsive hamburger menu on mobile
- Language selector integration
- Active page highlighting
- Smooth scroll behavior

### Language Selector

```astro
<LanguageSelector lang={lang} />
```

Features:
- EN/NL toggle
- Preserves current page path
- Cookie-based preference

### SEO Component

```astro
<SEO
  title="Page Title"
  description="Page description"
  lang={lang}
/>
```

Features:
- Open Graph meta tags
- Twitter Card meta tags
- Canonical URLs
- JSON-LD structured data

## Performance

### Optimization Features

- Static site generation (no server runtime)
- CSS inlining for critical styles
- Image optimization
- Minimal JavaScript (islands architecture)
- Gzip compression

### Lighthouse Scores

| Metric | Score |
|--------|-------|
| Performance | 95+ |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

## Adding New Pages

### 1. Create the Page File

```bash
# Create new page with language support
touch src/pages/[lang]/new-page.astro
```

### 2. Add Page Content

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getLangFromUrl, useTranslations, type Lang } from '../../i18n/utils';

export function getStaticPaths() {
  return [
    { params: { lang: 'en' } },
    { params: { lang: 'nl' } }
  ];
}

const lang = getLangFromUrl(Astro.url) as Lang;
const t = useTranslations(lang);

const title = lang === 'en' ? 'New Page | Snow-Flow' : 'Nieuwe Pagina | Snow-Flow';
---

<BaseLayout title={title}>
  <main>
    <h1>{lang === 'en' ? 'New Page' : 'Nieuwe Pagina'}</h1>
  </main>
</BaseLayout>
```

### 3. Add Navigation Link (optional)

Update `src/components/Navigation.astro` to include the new page.

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Kill process on port 4321
lsof -ti:4321 | xargs kill -9
```

**Build failures:**
```bash
# Clear cache and rebuild
rm -rf node_modules .astro dist
npm install
npm run build
```

**TypeScript errors:**
```bash
# Check types
npx astro check
```

## Related Documentation

- [Brand Style Guide](./BRAND_STYLEGUIDE.md) - Brand identity and design system
- [Main Docs](https://docs.snow-flow.dev) - Full documentation site

## Support

- **Report an issue**: support@snow-flow.dev
- **GitHub**: https://github.com/groeimetai/snow-flow
- **Status**: https://status.snow-flow.dev

---

**Last Updated**: December 2025
