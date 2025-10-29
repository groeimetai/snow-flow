# Snow-Flow Logo Variants

Dit mapje bevat alle logo varianten voor Snow-Flow in SVG formaat.

## Varianten

### 1. **icon-only.svg**
- Alleen het geometrische berg/sneeuw icoon
- 32x32px viewBox
- **Gebruik voor:**
  - Favicon
  - App icons
  - Social media profielfoto's
  - Kleine UI elementen

### 2. **horizontal.svg**
- Icoon + SNOWFLOW naast elkaar
- 200x32px viewBox
- **Gebruik voor:**
  - Website header/navigatie
  - Email signatures
  - Presentaties
  - Documenten

### 3. **vertical.svg**
- Icoon boven, SNOWFLOW eronder gestapeld
- 100x70px viewBox
- **Gebruik voor:**
  - Instagram posts
  - Vierkante social media plaatsingen
  - Mobiele app splash screens
  - Printmaterialen met beperkte breedte

### 4. **wordmark.svg**
- Alleen SNOWFLOW tekst zonder icoon
- 150x32px viewBox
- **Gebruik voor:**
  - Text-only plaatsingen
  - Kleine ruimtes waar icoon te klein zou zijn
  - Footer credits
  - Watermerks

### 5. **linkedin-banner.svg / linkedin-banner.png**
- Professionele LinkedIn bedrijfspagina banner
- 1584x396px (LinkedIn standaard formaat)
- **Bevat:**
  - Snow-Flow logo en branding (gebruikt icon-only.svg voor consistency)
  - Tagline: "Conversational ServiceNow Development Platform"
  - Key stats: 411 Tools • 75+ LLM Providers • MIT + Enterprise
  - Value proposition: "Build ServiceNow through conversation with ANY AI assistant"
  - Supported platforms badges (Claude, GPT, Gemini, +72 more)
  - Professional gradient background met subtiele berg graphics
- **Gebruik voor:**
  - LinkedIn company page header
  - Social media covers
  - Professional presentations
  - Marketing materials

## Kleurenschema

- **Primary Cyan**: `#00D9FF` (gebruikt voor FLOW en icoon)
- **White**: `#FFFFFF` (gebruikt voor SNOW)
- **Background**: `#1E2531` (brand dark - niet in logo's zelf)

## Richtlijnen

### Do's:
✅ Gebruik de SVG versies waar mogelijk (schaalbaar)
✅ Behoud de kleuren zoals gedefinieerd
✅ Zorg voor voldoende contrast met de achtergrond
✅ Respecteer de ruimte rond het logo (minimaal 8px padding)

### Don'ts:
❌ Verander de kleuren niet (behalve voor monochromatische varianten)
❌ Verwijder of wijzig onderdelen van het icoon niet
❌ Gebruik geen lage resolutie afbeeldingen
❌ Plaats het logo op onleesbare achtergronden

## Exporteren naar andere formaten

Voor PNG export (bijvoorbeeld voor social media):

```bash
# Icon only - 512x512 (high res)
inkscape icon-only.svg --export-filename=icon-only-512.png --export-width=512 --export-height=512

# Horizontal - 1200x200 (social media covers)
inkscape horizontal.svg --export-filename=horizontal-1200.png --export-width=1200 --export-height=200

# Vertical - 800x1120
inkscape vertical.svg --export-filename=vertical-800.png --export-width=800 --export-height=1120

# Wordmark - 1200x256
inkscape wordmark.svg --export-filename=wordmark-1200.png --export-width=1200 --export-height=256
```

## Licentie

Alle logo varianten zijn eigendom van Snow-Flow en vallen onder de MIT license van het project.

---

**Laatste update**: Oktober 2025
