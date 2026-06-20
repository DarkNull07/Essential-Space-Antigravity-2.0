---
name: Aura SaaS
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#4d4635'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#7f7663'
  outline-variant: '#d0c5af'
  surface-tint: '#735c00'
  primary: '#735c00'
  on-primary: '#ffffff'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#e9c349'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#006875'
  on-tertiary: '#ffffff'
  tertiary-container: '#00c5db'
  on-tertiary-container: '#004d56'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#9cf0ff'
  tertiary-fixed-dim: '#00daf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  margin-sm: 12px
  margin-md: 24px
  margin-lg: 48px
  max-width: 1440px
---

## Brand & Style

This design system is built on a foundation of **Modern Corporate** elegance with a heavy emphasis on **Minimalism** and **Tactile** depth. It is designed for high-productivity SaaS environments where clarity and focus are paramount. 

The brand personality is authoritative yet approachable, utilizing the "Golden Taupe" accent to evoke a sense of premium quality and reliability. The interface relies on generous whitespace to reduce cognitive load and uses subtle elevation to establish a clear information hierarchy. The aesthetic is "soft-professional"—avoiding the harshness of traditional enterprise software in favor of a warm, inviting, and human-centric workspace.

## Colors

The palette is centered around the **Golden Taupe** primary accent, used purposefully for calls to action and active states. 

- **Primary (Golden Taupe):** Used for primary buttons, active sidebar states, and critical highlights.
- **Secondary (Deep Charcoal):** Provides high-contrast grounding for text and structural elements in light mode.
- **Neutral (Soft Gray/Off-white):** Defines the "canvas" and container backgrounds to minimize visual fatigue.

The system supports four distinct modes. In all dark modes (Midnight Gold, Cyber Neon, Emerald Night), surface colors utilize a "container-on-base" logic where the surface is slightly lighter than the background to create depth without relying on heavy shadows.

## Typography

The typography system utilizes a trio of modern sans-serifs to distinguish between hierarchy and utility.

- **Hanken Grotesk** is used for headlines to provide a sharp, contemporary edge that feels tech-forward.
- **Manrope** is the workhorse for body copy, chosen for its exceptional readability and balanced proportions.
- **Geist** is reserved for labels, buttons, and monospaced data, providing a technical precision that complements the SaaS aesthetic.

For mobile devices, `display-lg` scales down to 32px and `headline-lg` scales to 24px to ensure readability without horizontal scrolling.

## Layout & Spacing

The layout follows a **Fluid Grid** model with fixed maximum widths for content readability. 

- **Desktop (1280px+):** 12-column grid, 24px gutters, 48px side margins.
- **Tablet (768px - 1279px):** 8-column grid, 16px gutters, 24px side margins.
- **Mobile (<767px):** 4-column grid, 16px gutters, 16px side margins.

Spacing follows an 8px linear scale. Large cards and sections should prioritize `margin-lg` to create the "premium" airy feel requested. Information-dense areas (like sidebars) use the 4px sub-unit for tighter alignment.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows**.

1. **Level 0 (Base):** The background canvas (`neutral_color_hex`).
2. **Level 1 (Card/Surface):** White or slightly off-white surfaces with a very soft, diffused shadow: `0px 4px 20px rgba(0, 0, 0, 0.05)`.
3. **Level 2 (Dropdowns/Modals):** Elevated surfaces with a more pronounced shadow to indicate focus: `0px 12px 32px rgba(0, 0, 0, 0.12)`.
4. **Active States:** Elements like the "All Items" sidebar category use a subtle background tint of the primary color (10% opacity) rather than a heavy shadow.

In dark modes, shadows are replaced by subtle 1px inner borders (rim lights) with a low-opacity version of the accent color to define edges.

## Shapes

The design system uses a **Rounded** (0.5rem) corner radius for most UI components. 

- **Small Components:** Checkboxes and small buttons use `0.375rem` (6px).
- **Standard Components:** Cards, input fields, and main buttons use `0.5rem` (8px).
- **Large Components:** Modals and feature hero cards use `1rem` (16px).
- **Pill Elements:** Search bars and "Tags" use a fully rounded radius (999px) to contrast against the more structured card layout.

## Components

### Buttons
- **Primary:** Solid Golden Taupe background with white text (light mode) or charcoal text (dark mode). 8px radius.
- **Secondary:** Ghost style with a 1px border of the accent color or a soft neutral fill.
- **Icon Buttons:** Square 8px radius with center-aligned icons, utilizing the Golden Taupe for the hover state.

### Input Fields
- Inputs feature a soft neutral background and a 1px border that transitions to Golden Taupe on focus. Labels are always `label-sm` (Geist) positioned above the field.

### Cards
- Cards are the primary container. They must have a white background, 16px padding, and an 8px radius. In the "Empty State" or "Add New," use a dashed border in a soft neutral tone.

### Sidebar
- Categories use a transparent background by default. The active category is indicated by a soft Golden Taupe tint background and a bolded font weight.

### Chips & Tags
- Used for categories or counts. These should be small, using the `label-sm` font, with a background color that is a 10% tint of the primary accent.