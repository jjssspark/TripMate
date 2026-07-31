---
name: TripMate AI
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
  on-surface-variant: '#3e4850'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#6e7881'
  outline-variant: '#bdc8d1'
  surface-tint: '#00658d'
  primary: '#00658d'
  on-primary: '#ffffff'
  primary-container: '#00aeef'
  on-primary-container: '#003e58'
  inverse-primary: '#82cfff'
  secondary: '#a43c12'
  on-secondary: '#ffffff'
  secondary-container: '#fe7e4f'
  on-secondary-container: '#6b1f00'
  tertiary: '#785900'
  on-tertiary: '#ffffff'
  tertiary-container: '#ce9b00'
  on-tertiary-container: '#4a3600'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c6e7ff'
  primary-fixed-dim: '#82cfff'
  on-primary-fixed: '#001e2d'
  on-primary-fixed-variant: '#004c6b'
  secondary-fixed: '#ffdbcf'
  secondary-fixed-dim: '#ffb59c'
  on-secondary-fixed: '#380c00'
  on-secondary-fixed-variant: '#822800'
  tertiary-fixed: '#ffdf9e'
  tertiary-fixed-dim: '#fabd00'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5b4300'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 64px
  max-width-content: 1200px
---

## Brand & Style

The design system is anchored in the spirit of exploration and the intelligence of modern AI. It targets tech-savvy travelers who value efficiency without sacrificing the joy of discovery. The emotional response is one of "effortless inspiration"—the UI should feel like a knowledgeable, friendly companion that handles the complexity of logistics while the user focuses on the horizon.

The visual style is **Modern/Friendly Minimalism** with a focus on high-clarity card-based layouts. It utilizes generous whitespace, soft rounded geometries, and subtle depth to create a breathable, organized environment. Elements are approachable but precise, ensuring the AI's recommendations feel trustworthy and curated.

## Colors

The palette is designed to evoke the brightness of a clear sky and the warmth of a sunset. 

- **Primary (Sky Blue):** Used for primary actions, progress indicators, and core branding. It represents the freedom of travel.
- **Secondary (Soft Coral):** Reserved for "must-visit" highlights and high-interest AI suggestions.
- **Tertiary (Warm Yellow):** Used sparingly for ratings, sunny weather indicators, and saved "gems."
- **Neutrals:** A range of cool grays (from #F8F9FA to #212529) ensures high legibility and defines the background layers for the card-based architecture.

## Typography

This design system uses **Plus Jakarta Sans** for headlines to provide a friendly, optimistic, and modern character. Its soft curves complement the rounded UI elements. 

**Inter** is utilized for body text and labels to ensure maximum functional readability, especially when displaying dense travel itineraries or AI-generated descriptions. 

Hierarchy is established through clear weight shifts. Use `display-lg` for destination names, `headline-md` for card titles, and `label-md` for category tags (e.g., "FLIGHTS", "DINING").

## Layout & Spacing

The layout follows a **Fluid Grid** model with fixed safe margins.

- **Mobile:** A single-column stack with 20px side margins. Cards span the full width of the container.
- **Tablet:** A 2-column masonry or grid layout for itinerary items.
- **Desktop:** A 12-column grid with a maximum content width of 1200px. Sidebars for "Travel Filters" or "AI Chat" should occupy 3 columns, with the primary content spanning 9.

Spacing follows a 4px baseline. Use `lg` (24px) for padding within cards to ensure an airy, premium feel. Use `md` (16px) for gutters between adjacent cards.

## Elevation & Depth

Depth is conveyed through **Tonal Layers** and **Ambient Shadows**. 

The base background is a very light gray (#F8F9FA). Interactive cards are pure white (#FFFFFF) with a soft, highly diffused shadow (Y: 4px, Blur: 20px, 5% Black) to make them appear slightly lifted. 

Floating Action Buttons (FABs) or active "AI Suggestion" overlays use a higher elevation with a slightly more pronounced shadow to indicate immediate priority. Avoid harsh borders; instead, use a 1px stroke in a slightly darker neutral (#E9ECEF) to define boundaries where shadows are not appropriate.

## Shapes

The design system leans heavily into a rounded aesthetic to reinforce its friendly and approachable personality. 

- **Standard Cards/Containers:** Use `rounded-lg` (16px) as the default.
- **Buttons/Inputs:** Use `rounded-md` (8px) for a modern, click-friendly appearance.
- **Chips/Badges:** Use a full pill shape (`rounded-full`) for status indicators and category tags.
- **Images:** Always apply a minimum of 16px radius to travel photos to keep them consistent with the UI container language.

## Components

### Buttons
Primary buttons use the Sky Blue background with white text. They should have a subtle 4px vertical offset shadow that disappears on "active" states to simulate a physical press. Secondary buttons use a ghost style (Sky Blue border and text).

### Chips
Chips are used for travel tags (e.g., "Family Friendly," "Budget"). They should have a light tinted background of the primary or secondary color (10% opacity) with high-contrast text.

### Cards
Cards are the primary unit of information. Every card should have a 16px corner radius. Content within cards should follow the `lg` spacing (24px) for internal padding. Destination cards should feature high-quality imagery with a gradient overlay at the bottom for text legibility.

### Input Fields
Inputs use a light gray background (#F1F3F5) with no border in their default state. Upon focus, they transition to a white background with a 2px Sky Blue border and a soft glow.

### AI Chat Interface
The AI interaction should feel distinct. Messages from the AI are contained in soft Sky Blue bubbles, while user messages are in light neutral bubbles. Use a "shimmer" loading effect for AI "thinking" states to maintain a high-tech, responsive feel.

### Itinerary Timeline
A vertical line component with 8px circular nodes. Must-visit highlights should use the Secondary Coral color for the node to stand out from standard itinerary stops.