---
name: template-ai — Editorial Legal
colors:
  background: "#f5f1e8"
  surface: "#fdfcf9"
  border: "#e0dbd3"
  textPrimary: "#1a1714"
  textSecondary: "#5a544c"
  accent: "#3d6b8f"
  accentHover: "#2d5a78"
  success: "#2d7a4f"
  warning: "#b07d2a"
  danger: "#c0392b"
  neutral: "#7a7570"
---

# Design System: template-ai — Editorial Legal

**Stitch Asset ID:** `assets/5621834681417054068`
**Project ID:** `13244395666194572658`

## 1. Visual Theme & Atmosphere

Serious, calm, accountable legal workspace. Editorial aesthetic with warm paper tones — reminiscent of a well-lit law library. Desktop-first at 1440px with strict column rhythm and professional density. No SaaS marketing patterns: no hero metrics, no decorative charts, no celebratory confetti. Trust is communicated through clarity, structure, and restraint.

Light theme only. Background surfaces use warm off-white (#f5f1e8) with elevated cards at pure near-white (#fdfcf9). No drop shadows — only 1px hairline borders for depth separation. Typography carries the emotional weight: refined serifs for legal content convey authority and tradition; neutral geometric sans-serifs for controls and data maintain precision without coldness.

## 2. Color Palette & Roles

### Primary Foundation
- Page background: warm ivory (#f5f1e8)
- Elevated surfaces: pure parchment (#fdfcf9)
- Hairline borders: warm stone (#e0dbd3)

### Accent & Interactive
- Primary accent: muted steel blue (#3d6b8f) — CTAs, links, active states
- Hover accent: deeper navy (#2d5a78)
- Focus ring: accent with 2px offset

### Typography & Text Hierarchy
- Primary text: near-black brown (#1a1714) — body, headings
- Secondary text: warm gray (#5a544c) — labels, metadata, helper text
- Disabled text: lighter warm gray (#8a847c)

### Functional States
- Success: forest green (#2d7a4f) — confirmed, VALIDADA, completed
- Warning: amber (#b07d2a) — BAJA confidence, pending review, near limit
- Danger: muted red (#c0392b) — destructive actions, fallido, blocked
- Neutral: stone gray (#7a7570) — BORRADOR, archived, inactive

## 3. Typography Rules

### Font Families
- **Headlines**: Literata — refined serif, authoritative but warm
- **Body/legal content**: Source Serif 4 — distinguished editorial serif, excellent for dense legal reading
- **UI controls/data**: Inter — neutral geometric sans-serif, crisp at small sizes

### Hierarchy & Weights
- Display/hero headings: Literata Bold, generous letter-spacing for legal gravitas
- Section headings: Literata Semibold
- Body text: Source Serif 4 Regular, 16px base, 1.6 line-height
- Data tables: Inter Regular 14px, tabular figures, compact row height
- Labels/badges: Inter Medium 12px, uppercase tracking

### Spacing Principles
- Base unit: 8px grid
- Section gutters: 32px vertical, 24px horizontal
- Card padding: 24px
- Table row: 48px compact, 56px comfortable
- Input fields: 40px height

## 4. Component Stylings

### Buttons
- Primary: accent background (#3d6b8f), white text, 4px radius, 40px height
- Secondary: 1px accent border, transparent background
- Destructive: danger text (#c0392b), danger border
- Disabled: reduced opacity (0.4), helper microcopy

### Cards
- 4px border radius, 1px hairline border (#e0dbd3), no shadow
- 24px internal padding, 16px gaps between cards

### Data Tables
- Dense professional grid, 1px horizontal dividers between rows
- Row hover: subtle warm tint
- Selected row: accent left border indicator
- Sticky headers with column sort affordances

### Status Chips
- Pill shape (full radius), Inter Medium 12px
- BORRADOR: neutral gray (#7a7570)
- VALIDADA: success green (#2d7a4f)
- ARCHIVADA: muted gray (#8a847c)

### Confidence Badges
- ALTA: bold weight, accent color (#3d6b8f)
- BAJA: outline style, warning amber (#b07d2a), always prominent
- Must be distinguishable in grayscale

### Inputs & Forms
- 1px border (#e0dbd3), 4px radius
- Focus: accent border (#3d6b8f) with 2px light accent ring
- Error: danger border (#c0392b) with inline error message
- Disabled: reduced contrast, preserved layout

## 5. Layout Principles

### Grid & Structure
- Fixed desktop width: 1440px max-width container
- 12-column grid, 24px gutters
- Shell: top bar (56px) + sidebar (240px) + main content (rest)
- Sidebar always secondary, content always dominant

### App Shell (universal)
- Top bar: logo left, user/account right, 56px height, bottom border
- Sidebar: 240px fixed width, section-divided navigation, icon + text items
- Page header: breadcrumb + title + contextual actions
- Content area: fills remaining space, scrollable independently

### Responsive Behavior
- Desktop-first: 1440px baseline
- Below 1200px: sidebar collapses to icon-only (64px)
- Below 768px: single column, sidebar becomes bottom navigation
- Tables: horizontal scroll with sticky first column below container width

## 6. Design System Notes for Stitch Generation

### Language to Use
- "Professional legal workspace" not "dashboard"
- "Editorial layout" not "modern clean"
- "Dense professional grid" not "spacious"
- "Warm paper tones" not "light theme"
- "Strict column rhythm" not "aligned"

### Color References
- Background: #f5f1e8 (warm ivory)
- Surface: #fdfcf9 (parchment)
- Text primary: #1a1714 (near-black brown)
- Text secondary: #5a544c (warm gray)
- Accent: #3d6b8f (muted steel blue)
- Success: #2d7a4f (forest green)
- Warning: #b07d2a (amber)
- Danger: #c0392b (muted red)
- Neutral: #7a7570 (stone gray)

### Component Prompts
- "Create a dense data table with 1px horizontal dividers, hover row highlighting, sticky header, and inline row actions"
- "Design a two-panel review screen: document viewer left (62%), entity inspector right (38%), persistent bottom action bar"
- "Build an app shell with 56px top bar, 240px sidebar, and main content area with breadcrumb + page header"

### Incremental Iteration
- Always reuse the same shell — never redesign the frame
- Add states to existing components before creating new ones
- Maintain strict column alignment when adding content
- If a screen feels 'flashy', reduce: fewer colors, fewer shadows, more structure
