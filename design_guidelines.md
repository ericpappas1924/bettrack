# Sports Betting Tracker Design Guidelines

## Design Approach

**Design System Approach**: Drawing from modern analytics dashboards like Linear, Stripe Dashboard, and Vercel Analytics. This is a data-heavy productivity tool requiring clarity, efficiency, and consistent patterns for rapid information processing.

**Key Design Principles**:
- Data clarity over decoration
- Instant scanability of metrics and bet status
- Efficient workflows for quick bet entry
- Clear visual hierarchy for numbers and performance data

---

## Typography

**Font Family**: Inter (Google Fonts) for excellent legibility at all sizes

**Hierarchy**:
- Page Headers: text-3xl font-bold (30px)
- Section Headers: text-xl font-semibold (20px)
- Metric Values: text-4xl font-bold (36px) for dashboard stats
- Table Headers: text-sm font-medium uppercase tracking-wide
- Body/Data: text-base (16px) regular weight
- Labels: text-sm (14px) medium weight
- Small Text/Meta: text-xs (12px) regular weight

**Number Formatting**: Use tabular-nums (font-variant-numeric) for aligned numerical data in tables

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: gap-6 or gap-8
- Page margins: px-6 lg:px-8
- Card padding: p-6

**Container Strategy**:
- Main content: max-w-7xl mx-auto
- Dashboard cards: Full width within container
- Forms: max-w-2xl for focused entry

**Grid Layouts**:
- Metrics Dashboard: 4-column grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Bet Cards: 2-3 columns (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Tables: Full-width responsive

---

## Component Library

### Navigation
Top navbar with app logo, main sections (Dashboard, Bets, Analytics, Add Bet), user menu

### Dashboard Metrics Cards
Elevated cards displaying key stats (Total P/L, ROI, Win Rate, Avg CLV). Each card includes:
- Large numerical value (text-4xl)
- Label (text-sm)
- Trend indicator (small badge with ↑/↓)
- Subtle border and shadow (shadow-sm)

### Bet Entry Form
Clean, focused form with:
- Grouped form sections (Sport Selection, Bet Details, Odds & Stake)
- Radio buttons for sport type (NBA/NCAAF)
- Text inputs with clear labels positioned above
- Number inputs for odds and stake with step controls
- Large primary submit button
- Form validation states

### Bet Dashboard Table
Comprehensive table with:
- Sticky header row
- Columns: Date, Sport, Bet Type, Team/Player, Odds, Stake, Status, P/L, CLV
- Status badges (Active: blue, Won: green, Lost: red, Pending: gray)
- Positive numbers in green, negative in red
- Row hover state with subtle elevation
- Responsive: card layout on mobile, table on desktop

### Filter Bar
Horizontal filter controls:
- Sport dropdown
- Status filter chips (All, Active, Settled)
- Date range picker
- Search input
- Clear filters button

### Individual Bet Detail View
Modal or dedicated page with:
- Header with bet summary
- Two-column layout (left: bet details, right: performance metrics)
- Opening vs Closing odds comparison
- CLV calculation breakdown
- Timeline of bet status changes

### Performance Analytics
Charts section featuring:
- Line chart for P/L over time
- Bar chart for performance by sport
- Win rate visualization
- Use simple, clean chart styling (prefer libraries like Recharts)

### Empty States
Friendly empty state when no bets exist with:
- Icon or illustration placeholder
- Helpful message
- Primary CTA to add first bet

---

## Data Visualization

**Status Indicators**:
- Use badge components with icon + text
- Color coding: Green (profit/won), Red (loss/lost), Blue (active), Gray (pending)

**Tables**:
- Alternating row backgrounds for scannability
- Right-align numerical columns
- Clear column headers with sort indicators
- Compact row height (h-12) for data density

**Metric Cards**:
- Large numbers as focal point
- Supporting context below
- Minimal decoration, maximum clarity

---

## Images

No hero images needed. This is a dashboard application focused on data and functionality, not marketing.

**Icon Usage**: Use Heroicons (CDN) for consistent iconography throughout - sports icons, status indicators, navigation icons, form field icons

---

## Animations

Minimal and purposeful only:
- Smooth transitions on status badge changes (transition-colors duration-200)
- Subtle hover elevations on cards (transition-shadow duration-150)
- Form validation feedback
- No scroll animations or decorative motion