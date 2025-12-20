# Snow-Flow Brand Style Guide

> **Version:** 1.0
> **Last Updated:** December 2024
> **Website:** https://snow-flow.dev
> **For:** Designers & Developers

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing System](#4-spacing-system)
5. [Border & Radius](#5-border--radius)
6. [Shadows & Glows](#6-shadows--glows)
7. [Gradients](#7-gradients)
8. [Animations](#8-animations)
9. [Components](#9-components)
10. [Responsive Design](#10-responsive-design)
11. [Accessibility](#11-accessibility)

---

## 1. Brand Identity

### Mission
Snow-Flow is een AI-powered ServiceNow development platform dat natuurlijke taal transformeert naar enterprise automation.

### Brand Personality
- **Futuristic** - Cutting-edge, next-generation
- **Intelligent** - AI-driven, smart, automated
- **Premium** - High-end, professional, enterprise-ready
- **Dynamic** - Energetic, modern, innovative

### Visual Language
- **Dark theme** als basis (ultra-dark navy)
- **Neon accenten** in cyan en paars
- **Glassmorphism** effecten met blur
- **Glow effects** voor emphasis
- **Smooth animations** voor moderne feel
- **High contrast** voor leesbaarheid

### Design Philosophy
```
"Premium Dark with Electric Accents"

We gebruiken een ultra-donkere achtergrond als canvas,
met elektrische cyan en paarse accenten die de AI/tech
identiteit benadrukken. Glassmorphism en glow effects
geven een futuristisch, premium gevoel.
```

---

## 2. Color System

### Background Colors (Dark Theme)

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--bg-primary` | `#050508` | 5, 5, 8 | Hoofdachtergrond, page background |
| `--bg-secondary` | `#0a0a0f` | 10, 10, 15 | Secundaire secties |
| `--bg-tertiary` | `#111118` | 17, 17, 24 | Cards, elevated surfaces |
| `--bg-card` | `#0d0d14` | 13, 13, 20 | Card backgrounds |
| `--bg-hover` | `#16161f` | 22, 22, 31 | Hover states |

### Primary Accent Colors

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--accent-cyan` | `#00D9FF` | 0, 217, 255 | **Primary accent**, CTAs, links, highlights |
| `--accent-blue` | `#3B82F6` | 59, 130, 246 | Secondary accent, icons |
| `--accent-purple` | `#8B5CF6` | 139, 92, 246 | Tertiary accent, gradients |
| `--accent-green` | `#10B981` | 16, 185, 129 | Success states |
| `--accent-red` | `#EF4444` | 239, 68, 68 | Error states, alerts |
| `--accent-yellow` | `#F59E0B` | 245, 158, 11 | Warnings |

### Text Colors

| Token | Hex | Opacity | Usage |
|-------|-----|---------|-------|
| `--text-primary` | `#FFFFFF` | 100% | Headlines, belangrijke tekst |
| `--text-secondary` | `#94A3B8` | - | Body text, descriptions |
| `--text-muted` | `#64748B` | - | Subtle text, labels |
| `--text-disabled` | `#475569` | - | Disabled states |

### Border Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--border-subtle` | `rgba(255, 255, 255, 0.06)` | Subtle dividers |
| `--border-medium` | `rgba(255, 255, 255, 0.1)` | Card borders |
| `--border-strong` | `rgba(255, 255, 255, 0.15)` | Emphasized borders |
| `--border-accent` | `rgba(0, 217, 255, 0.3)` | Accent borders |

### Color Palette Visual

```
BACKGROUNDS
┌──────────────────────────────────────────────────┐
│ #050508  Primary - Ultra dark navy               │
├──────────────────────────────────────────────────┤
│ #0a0a0f  Secondary - Very dark                   │
├──────────────────────────────────────────────────┤
│ #111118  Tertiary - Dark gray                    │
├──────────────────────────────────────────────────┤
│ #0d0d14  Card - Elevated surface                 │
└──────────────────────────────────────────────────┘

ACCENTS
┌────────┬────────┬────────┬────────┬────────┐
│ CYAN   │ BLUE   │ PURPLE │ GREEN  │ RED    │
│#00D9FF │#3B82F6 │#8B5CF6 │#10B981 │#EF4444 │
│Primary │Second. │Tertiary│Success │Error   │
└────────┴────────┴────────┴────────┴────────┘

TEXT
┌──────────────────────────────────────────────────┐
│ #FFFFFF  Primary - Headlines                     │
│ #94A3B8  Secondary - Body text                   │
│ #64748B  Muted - Labels, subtle                  │
│ #475569  Disabled - Inactive elements            │
└──────────────────────────────────────────────────┘
```

---

## 3. Typography

### Font Families

#### Primary Font: Inter
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```
**Usage:** Headlines, body text, UI elements

#### Monospace Font: JetBrains Mono
```css
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace;
```
**Usage:** Code blocks, technical content, terminal output

### Type Scale (Golden Ratio Based)

| Token | Size | Pixels | Usage |
|-------|------|--------|-------|
| `--font-xs` | 0.75rem | 12px | Labels, captions |
| `--font-sm` | 0.875rem | 14px | Small text, metadata |
| `--font-base` | 1rem | 16px | Body text |
| `--font-md` | 1.125rem | 18px | Large body, intro text |
| `--font-lg` | 1.25rem | 20px | H6, small headings |
| `--font-xl` | 1.5rem | 24px | H5 |
| `--font-2xl` | 1.875rem | 30px | H4 |
| `--font-3xl` | 2.25rem | 36px | H3 |
| `--font-4xl` | 3rem | 48px | H2 |
| `--font-5xl` | 3.75rem | 60px | H1 |
| `--font-6xl` | 4.5rem | 72px | Hero text |
| `--font-7xl` | 6rem | 96px | Display |
| `--font-8xl` | 8rem | 128px | Jumbo display |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Large display text |
| Regular | 400 | Body text |
| Medium | 500 | Emphasis, labels |
| Semibold | 600 | Subheadings, buttons |
| Bold | 700 | Headlines |
| Extrabold | 800 | Hero headlines |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-none` | 1 | Headlines, display |
| `--leading-tight` | 1.25 | Headings |
| `--leading-snug` | 1.375 | Subheadings |
| `--leading-normal` | 1.5 | Body text |
| `--leading-relaxed` | 1.625 | Large body |
| `--leading-loose` | 2 | Spacious text |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tighter` | -0.05em | Large headlines |
| `--tracking-tight` | -0.025em | Headlines |
| `--tracking-normal` | 0 | Body text |
| `--tracking-wide` | 0.025em | Small text |
| `--tracking-wider` | 0.05em | Labels, buttons |
| `--tracking-widest` | 0.1em | Uppercase text |

### Typography Examples

```
HERO HEADLINE
Font: Inter Extrabold
Size: 72px (--font-6xl)
Line Height: 1 (--leading-none)
Letter Spacing: -0.05em (--tracking-tighter)
Color: #FFFFFF

H1 - PAGE TITLE
Font: Inter Bold
Size: 60px (--font-5xl)
Line Height: 1.25 (--leading-tight)
Letter Spacing: -0.025em (--tracking-tight)
Color: #FFFFFF

H2 - SECTION HEADING
Font: Inter Bold
Size: 48px (--font-4xl)
Line Height: 1.25 (--leading-tight)
Letter Spacing: -0.025em
Color: #FFFFFF

H3 - SUBSECTION
Font: Inter Semibold
Size: 36px (--font-3xl)
Line Height: 1.375 (--leading-snug)
Color: #FFFFFF

BODY TEXT
Font: Inter Regular
Size: 16px (--font-base)
Line Height: 1.5 (--leading-normal)
Color: #94A3B8 (--text-secondary)

BUTTON TEXT
Font: Inter Semibold
Size: 14px (--font-sm)
Letter Spacing: 0.05em (--tracking-wider)
Text Transform: Uppercase
Color: #FFFFFF or #050508
```

---

## 4. Spacing System

### Base Unit: 4px (0.25rem)

| Token | Value (rem) | Value (px) | Usage |
|-------|-------------|------------|-------|
| `--space-0` | 0 | 0 | Reset |
| `--space-px` | 1px | 1px | Hairline |
| `--space-0.5` | 0.125rem | 2px | Micro |
| `--space-1` | 0.25rem | 4px | Tiny |
| `--space-2` | 0.5rem | 8px | Extra small |
| `--space-3` | 0.75rem | 12px | Small |
| `--space-4` | 1rem | 16px | Default |
| `--space-5` | 1.25rem | 20px | Medium-small |
| `--space-6` | 1.5rem | 24px | Medium |
| `--space-8` | 2rem | 32px | Large |
| `--space-10` | 2.5rem | 40px | Extra large |
| `--space-12` | 3rem | 48px | Section gap |
| `--space-16` | 4rem | 64px | Large section |
| `--space-20` | 5rem | 80px | Extra large section |
| `--space-24` | 6rem | 96px | Hero spacing |
| `--space-32` | 8rem | 128px | Massive gap |
| `--space-40` | 10rem | 160px | Page sections |

### Common Spacing Patterns

| Element | Mobile | Desktop |
|---------|--------|---------|
| Page padding | 16px | 24-32px |
| Section gap | 64px | 96-128px |
| Card padding | 24px | 32px |
| Button padding (H) | 24px | 32px |
| Button padding (V) | 12px | 16px |
| Grid gap | 16px | 24px |
| Text gap | 8px | 12px |

---

## 5. Border & Radius

### Border Radius Scale

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--radius-none` | 0 | 0px | Sharp corners |
| `--radius-sm` | 0.125rem | 2px | Subtle rounding |
| `--radius-base` | 0.25rem | 4px | Default small |
| `--radius-md` | 0.375rem | 6px | Inputs |
| `--radius-lg` | 0.5rem | 8px | Buttons, small cards |
| `--radius-xl` | 0.75rem | 12px | Cards |
| `--radius-2xl` | 1rem | 16px | Large cards |
| `--radius-3xl` | 1.5rem | 24px | Modals, panels |
| `--radius-full` | 9999px | Pill | Pills, avatars |

### Radius Usage Guidelines

```
Buttons          → 8px (--radius-lg) of 9999px (pill)
Inputs           → 6-8px (--radius-md to --radius-lg)
Cards            → 12-16px (--radius-xl to --radius-2xl)
Modals           → 24px (--radius-3xl)
Badges/Tags      → 9999px (pill) of 4px (--radius-base)
Avatars          → 9999px (--radius-full)
```

### Border Styles

```css
/* Subtle border for cards */
border: 1px solid rgba(255, 255, 255, 0.06);

/* Medium border for emphasis */
border: 1px solid rgba(255, 255, 255, 0.1);

/* Accent border for focus/active */
border: 1px solid rgba(0, 217, 255, 0.3);

/* Glow border effect */
border: 1px solid rgba(0, 217, 255, 0.5);
box-shadow: 0 0 20px rgba(0, 217, 255, 0.2);
```

---

## 6. Shadows & Glows

### Shadow Scale

| Token | CSS Value | Usage |
|-------|-----------|-------|
| `--shadow-xs` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-sm` | `0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)` | Cards |
| `--shadow-base` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)` | Elevated |
| `--shadow-md` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)` | Dropdowns |
| `--shadow-lg` | `0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)` | Modals |
| `--shadow-xl` | `0 25px 50px -12px rgba(0,0,0,0.25)` | Large panels |
| `--shadow-2xl` | `0 35px 60px -15px rgba(0,0,0,0.3)` | Hero elements |
| `--shadow-inner` | `inset 0 2px 4px 0 rgba(0,0,0,0.06)` | Inset effect |

### Glow Effects (Signature Look)

| Token | CSS Value | Usage |
|-------|-----------|-------|
| `--glow-cyan` | `0 0 60px rgba(0, 217, 255, 0.3)` | Primary glow |
| `--glow-cyan-strong` | `0 0 80px rgba(0, 217, 255, 0.5)` | Intense glow |
| `--glow-purple` | `0 0 60px rgba(139, 92, 246, 0.2)` | Secondary glow |
| `--glow-white` | `0 0 15px rgba(255, 255, 255, 0.1)` | Subtle white |

### Glow Usage Examples

```css
/* Button glow on hover */
.button-primary:hover {
  box-shadow: 0 0 30px rgba(0, 217, 255, 0.4);
}

/* Card glow on hover */
.card:hover {
  box-shadow: 0 0 40px rgba(0, 217, 255, 0.15);
  border-color: rgba(0, 217, 255, 0.3);
}

/* Text glow effect */
.heading-glow {
  text-shadow: 0 0 40px rgba(0, 217, 255, 0.5);
}

/* Hero element glow */
.hero-element {
  box-shadow:
    0 0 60px rgba(0, 217, 255, 0.3),
    0 0 120px rgba(139, 92, 246, 0.2);
}
```

---

## 7. Gradients

### Background Gradients

```css
/* Primary dark gradient */
--gradient-primary: linear-gradient(135deg, #050508 0%, #111118 100%);

/* Card gradient */
--gradient-card: linear-gradient(135deg, #0d0d14 0%, #0a0a0f 100%);

/* Section gradient */
--gradient-section: linear-gradient(180deg, #050508 0%, #0a0a0f 50%, #050508 100%);
```

### Accent Gradients

```css
/* Cyan to purple (hero elements) */
--gradient-accent: linear-gradient(135deg, #00D9FF 0%, #8B5CF6 100%);

/* Blue to cyan */
--gradient-blue-cyan: linear-gradient(135deg, #3B82F6 0%, #00D9FF 100%);

/* Purple to pink */
--gradient-purple-pink: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
```

### Text Gradients

```css
/* Gradient text effect */
.gradient-text {
  background: linear-gradient(135deg, #00D9FF 0%, #8B5CF6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Animated gradient text */
.gradient-text-animated {
  background: linear-gradient(90deg, #00D9FF, #8B5CF6, #00D9FF);
  background-size: 200% 100%;
  animation: gradientShift 3s ease infinite;
}
```

### Glassmorphism

```css
/* Glass panel effect */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Dark glass */
.glass-dark {
  background: rgba(5, 5, 8, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

---

## 8. Animations

### Timing & Easing

#### Duration Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-75` | 75ms | Micro interactions |
| `--duration-100` | 100ms | Quick feedback |
| `--duration-150` | 150ms | Fast transitions |
| `--duration-200` | 200ms | Default transitions |
| `--duration-300` | 300ms | Standard animations |
| `--duration-500` | 500ms | Slow animations |
| `--duration-700` | 700ms | Entrance animations |
| `--duration-1000` | 1000ms | Complex animations |

#### Easing Functions
| Token | Value | Usage |
|-------|-------|-------|
| `--ease-linear` | `linear` | Progress bars |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entrance animations |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | General use |
| `--ease-bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful |

### Key Animations

#### Fade Animations
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
}
```

#### Glow Pulse
```css
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 30px rgba(0, 217, 255, 0.3); }
  50% { box-shadow: 0 0 60px rgba(0, 217, 255, 0.5); }
}
```

#### Gradient Shift
```css
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

#### Float Animation
```css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}
```

#### Shimmer Effect
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### Animation Classes

```css
/* Entrance animations */
.animate-fade-in-up { animation: fadeInUp 0.6s ease-out; }
.animate-fade-in-down { animation: fadeInDown 0.6s ease-out; }

/* Continuous animations */
.animate-float { animation: float 6s ease-in-out infinite; }
.animate-glow-pulse { animation: glowPulse 2s ease-in-out infinite; }
.animate-shimmer { animation: shimmer 2s linear infinite; }

/* Staggered delays */
.delay-100 { animation-delay: 100ms; }
.delay-200 { animation-delay: 200ms; }
.delay-300 { animation-delay: 300ms; }
.delay-500 { animation-delay: 500ms; }
```

---

## 9. Components

### Buttons

#### Primary Button (CTA)
```css
.btn-primary {
  background: linear-gradient(135deg, #00D9FF 0%, #0099cc 100%);
  color: #050508;
  font-weight: 600;
  padding: 16px 32px;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  box-shadow: 0 0 40px rgba(0, 217, 255, 0.5);
  transform: translateY(-2px);
}
```

#### Secondary Button (Outline)
```css
.btn-secondary {
  background: transparent;
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 16px 32px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  border-color: rgba(0, 217, 255, 0.5);
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.2);
}
```

#### Ghost Button
```css
.btn-ghost {
  background: transparent;
  color: #94A3B8;
  padding: 12px 24px;
  transition: color 0.3s ease;
}

.btn-ghost:hover {
  color: #00D9FF;
}
```

### Cards

#### Standard Card
```css
.card {
  background: #0d0d14;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 32px;
  transition: all 0.3s ease;
}

.card:hover {
  border-color: rgba(0, 217, 255, 0.2);
  box-shadow: 0 0 40px rgba(0, 217, 255, 0.1);
  transform: translateY(-4px);
}
```

#### Glass Card
```css
.card-glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 32px;
}
```

### Navigation

```css
.nav {
  background: rgba(5, 5, 8, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 16px 24px;
  position: fixed;
  width: 100%;
  z-index: 100;
}

.nav-link {
  color: #94A3B8;
  font-weight: 500;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: #00D9FF;
}

.nav-link.active {
  color: #FFFFFF;
}
```

### Badges / Tags

```css
.badge {
  background: rgba(0, 217, 255, 0.1);
  color: #00D9FF;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-purple {
  background: rgba(139, 92, 246, 0.1);
  color: #8B5CF6;
}

.badge-green {
  background: rgba(16, 185, 129, 0.1);
  color: #10B981;
}
```

### Code Blocks

```css
.code-block {
  background: #0a0a0f;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 24px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #94A3B8;
  overflow-x: auto;
}

/* Syntax highlighting */
.code-keyword { color: #8B5CF6; }
.code-string { color: #10B981; }
.code-comment { color: #64748B; }
.code-function { color: #00D9FF; }
.code-number { color: #F59E0B; }
```

---

## 10. Responsive Design

### Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| Mobile (default) | 0-639px | Single column, stacked |
| Tablet (sm) | 640px+ | Two columns |
| Desktop (md) | 768px+ | Multi-column |
| Large (lg) | 1024px+ | Full layout |
| XL (xl) | 1280px+ | Wide screens |
| 2XL (2xl) | 1536px+ | Ultra-wide |

### Container Widths

| Breakpoint | Max Width |
|------------|-----------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

### Responsive Typography

```css
/* Mobile first approach */
.hero-title {
  font-size: 36px;      /* Mobile */
}

@media (min-width: 640px) {
  .hero-title {
    font-size: 48px;    /* Tablet */
  }
}

@media (min-width: 1024px) {
  .hero-title {
    font-size: 72px;    /* Desktop */
  }
}
```

### Responsive Spacing

```css
/* Section padding */
.section {
  padding: 64px 16px;   /* Mobile */
}

@media (min-width: 768px) {
  .section {
    padding: 96px 24px;  /* Tablet */
  }
}

@media (min-width: 1024px) {
  .section {
    padding: 128px 32px; /* Desktop */
  }
}
```

---

## 11. Accessibility

### Color Contrast

All text must meet WCAG 2.1 AA standards:

| Combination | Contrast Ratio | Status |
|-------------|----------------|--------|
| White (#FFF) on Primary BG (#050508) | 20.5:1 | AAA |
| Secondary text (#94A3B8) on Primary BG | 7.5:1 | AAA |
| Muted text (#64748B) on Primary BG | 4.8:1 | AA |
| Cyan (#00D9FF) on Primary BG | 11.2:1 | AAA |

### Focus States

```css
/* Visible focus ring */
:focus-visible {
  outline: 2px solid #00D9FF;
  outline-offset: 2px;
}

/* Focus ring for buttons */
.btn:focus-visible {
  box-shadow: 0 0 0 3px rgba(0, 217, 255, 0.4);
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Touch Targets

- Minimum size: 44x44px
- Adequate spacing between interactive elements
- Clear hover/active states

---

## Quick Reference

### Essential Colors
```
Background       → #050508
Card BG          → #0d0d14
Primary Accent   → #00D9FF (Cyan)
Secondary Accent → #8B5CF6 (Purple)
Text Primary     → #FFFFFF
Text Secondary   → #94A3B8
Border           → rgba(255, 255, 255, 0.06)
```

### Essential Typography
```
Font Family      → Inter
Mono Font        → JetBrains Mono
Hero Size        → 72px
H1 Size          → 60px
Body Size        → 16px
```

### Essential Effects
```
Glow             → 0 0 60px rgba(0, 217, 255, 0.3)
Glass BG         → rgba(255, 255, 255, 0.05) + blur(10px)
Gradient         → linear-gradient(135deg, #00D9FF, #8B5CF6)
```

---

## File References

| File | Location | Description |
|------|----------|-------------|
| Main Styles | `/website/src/styles/global.css` | Core design system |
| Animations | `/website/src/styles/animations.css` | 30+ keyframe animations |
| Hero Styles | `/website/src/styles/hero-*.css` | Hero section variants |
| Mobile Fixes | `/website/src/styles/mobile-*.css` | Responsive adjustments |

---

*This style guide reflects the Snow-Flow website design system.*
*Last updated: December 2024*
