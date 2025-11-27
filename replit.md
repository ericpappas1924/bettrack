# BetTrack - Sports Betting Tracker

## Overview

BetTrack is a sports betting performance tracking application designed for NBA and NCAAF bettors. The application provides comprehensive bet tracking with CLV (Closing Line Value) analysis, profit/loss monitoring, and live odds tracking. Users can manually add bets or import them by pasting bet history, then track performance metrics including ROI, win rates, and expected value calculations.

The application emphasizes data clarity and efficient workflows, drawing design inspiration from modern analytics dashboards like Linear, Stripe Dashboard, and Vercel Analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server.

**Routing**: Wouter - a minimal client-side router for React applications.

**State Management**: 
- Local component state via React hooks (useState)
- Server state managed through TanStack Query (React Query) for data fetching, caching, and synchronization
- No global state management library currently implemented

**UI Component Library**: shadcn/ui (Radix UI primitives) with Tailwind CSS
- Uses the "new-york" style variant
- Custom theme system with light/dark mode support
- Component path aliases configured for clean imports

**Styling Approach**:
- Tailwind CSS for utility-first styling
- Design system based on Inter font family
- CSS custom properties for theming (HSL color values)
- Spacing primitives using Tailwind units (2, 4, 6, 8, 12, 16)
- Responsive grid layouts (4-column metrics, 2-3 column bet cards)

**Key Design Principles**:
- Data clarity over decoration
- Instant scanability of metrics and bet status
- Tabular number formatting for aligned numerical data
- Clear visual hierarchy for performance data

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js
- HTTP server created using Node's built-in `http` module
- Custom logging middleware for request/response tracking
- JSON body parsing with raw body preservation for webhook support

**API Structure**: 
- RESTful API pattern with `/api` prefix for all application routes
- Route registration system through `registerRoutes()` function
- Currently using in-memory storage with interface-based design for easy migration to persistent storage

**Static File Serving**:
- Production: Serves pre-built client files from `dist/public`
- Development: Vite dev server with HMR (Hot Module Replacement) over WebSocket
- Fallback to index.html for client-side routing

**Build Process**:
- Client built with Vite (outputs to `dist/public`)
- Server bundled with esbuild (outputs to `dist/index.cjs`)
- Selective dependency bundling to reduce cold start times

### Data Storage Solutions

**Database**: PostgreSQL via Neon serverless driver (@neondatabase/serverless)

**ORM**: Drizzle ORM
- Schema-first approach with TypeScript inference
- Zod integration for runtime validation (drizzle-zod)
- Migration support via drizzle-kit

**Schema Design**:
- `users` table: Authentication with username/password
- `bets` table: Comprehensive bet tracking with fields for:
  - Sport and bet type classification
  - Opening/closing/live odds tracking
  - Stake and profit calculations
  - CLV (Closing Line Value) metrics
  - Status tracking (active, settled, pending)
  - Result tracking (won, lost)
  - Projection source and notes for context
  - Timestamps for creation and settlement

**Current Implementation**: In-memory storage via `MemStorage` class implementing `IStorage` interface
- Designed for easy migration to database-backed storage
- User CRUD operations defined in storage interface

### Form Handling and Validation

**Form Library**: React Hook Form with Zod resolver
- Type-safe form validation using Zod schemas
- Schema definitions derived from Drizzle schema using `createInsertSchema`
- Custom form schemas for bet entry extending base schemas

**Validation Strategy**:
- Runtime validation with Zod
- Type-level validation with TypeScript
- Form-level validation integrated with shadcn/ui form components

### Betting Calculation Logic

**Core Utilities** (`client/src/lib/betting.ts`):
- American odds to implied probability conversion
- American to decimal odds conversion
- Potential payout and profit calculations
- Expected value (EV) calculation using win probability
- Probability formatting and change display

**Bet Parsing** (`client/src/lib/betParser.ts`):
- Custom parser for importing bet history from sportsbook formats
- Supports player props, straight bets, and parlays
- Date/time parsing and stake/odds extraction
- Conversion from parsed format to application bet schema

## External Dependencies

### Third-Party UI Libraries
- **Radix UI**: Headless UI component primitives (dialogs, dropdowns, selects, etc.)
- **Lucide React**: Icon library for consistent iconography
- **class-variance-authority**: Type-safe variant styling
- **cmdk**: Command palette component
- **embla-carousel-react**: Carousel/slider functionality
- **date-fns**: Date manipulation and formatting

### Database and ORM
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon
- **Drizzle ORM**: TypeScript ORM with schema definitions
- **drizzle-zod**: Zod schema generation from Drizzle schemas
- **connect-pg-simple**: PostgreSQL session store for Express (configured but not actively used)

### Development Tools
- **Vite**: Fast development server and build tool
- **esbuild**: Fast JavaScript bundler for server-side code
- **TypeScript**: Type safety across frontend and backend
- **@replit/vite-plugin-***: Replit-specific development plugins (runtime error overlay, cartographer, dev banner)

### Fonts
- **Inter**: Google Fonts family used for all typography (weights 300-800)

### Session Management
- **express-session**: Session middleware (configured but authentication not fully implemented)
- **memorystore**: In-memory session storage option

### Not Currently Used But Available
- **Passport**: Authentication middleware
- **Nodemailer**: Email sending
- **Stripe**: Payment processing
- **OpenAI/Google Generative AI**: AI capabilities
- **WebSocket (ws)**: Real-time communication
- **xlsx**: Excel file handling
- **multer**: File upload handling