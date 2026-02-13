# Mind Sensei

> **Sharpen Your Mind. Own Your Data.**
> 
> A privacy-first, offline-capable cognitive performance training platform built for peak mental agility.

## Overview

**Mind Sensei** is a cutting-edge brain training application designed to systematically improve **Focus**, **Memory**, **Reaction Speed**, and **Logical Reasoning**. Built on a **privacy-first, zero-tracking architecture**, all data is processed and stored locally on your device—no accounts, no servers, no surveillance.


---

## Key Features

### Specialized Cognitive Training Engines

| Engine | Focus | Training Methods |
|--------|-------|------------------|
| **Focus** | Sustained Attention | Real-time target tracking with distraction resistance |
| **Memory** | Working Memory Capacity | N-back sequences, recall challenges, pattern memorization |
| **Reaction** | Response Speed & Accuracy | Go/No-Go paradigms, millisecond-precision tracking |
| **Logic** | Fluid Reasoning | Pattern recognition, spatial puzzles, constraint solving |

### Privacy-First & Offline-Capable

- **Zero Data Collection**: No cloud servers, API calls, or external tracking
- **100% Local Processing**: All computations happen on your device using IndexedDB
- **PWA Support**: Installable as a standalone app on iOS, Android, macOS, Windows, and Linux
- **Offline Mode**: Train anywhere without internet connectivity

### Intelligent Adaptive Training System

- **Dynamic Difficulty Adjustment**: Real-time algorithm detects fatigue and performance trends
- **Fatigue Detection**: Automatically reduces difficulty during sustained sessions to prevent mental burnout
- **Growth Velocity Tracking**: Measures your rate of improvement week-over-week
- **Cognitive Growth Index (CGI)**: Composite metric tracking overall mental fitness across all domains
- **Performance Consistency Analysis**: Identifies your peak training windows and optimal session duration

### Premium User Experience

- **Modern Glassmorphic Design**: Deep blue aesthetic with ambient blur effects
- **60fps Smooth Animations**: Optimized GPU-accelerated transitions and micro-interactions
- **Interactive Analytics**: Real-time heatmaps, performance graphs, and consistency visualizations
- **Responsive Layout**: Seamless experience across mobile, tablet, and desktop devices

---

## Architecture & Project Structure

```
mind-sensei/
├── public/
│   ├── manifest.json          # PWA manifest for app installation
│   └── sw.js                  # Service Worker for offline capability
│
├── src/
│   ├── app/                   # Next.js App Router (v16)
│   │   ├── dashboard/         # Analytics & performance dashboard
│   │   ├── settings/          # Preferences, data management, export
│   │   ├── train/             # Training interface hub
│   │   │   ├── focus/         # Focus engine training
│   │   │   ├── logic/         # Logic puzzle training
│   │   │   ├── memory/        # Memory challenge training
│   │   │   └── reaction/      # Reaction time training
│   │   ├── layout.tsx         # Root layout with metadata
│   │   └── page.tsx           # Landing/home page
│   │
│   ├── components/            # Reusable React components
│   │   ├── icons.tsx          # SVG icon system
│   │   ├── landing/           # Landing page components
│   │   └── layout/            # Shell, navigation, headers
│   │
│   ├── domain/                # Core business logic (engine-agnostic)
│   │   ├── analytics/         # Metrics, CGI calculations, suggestions
│   │   ├── difficulty/        # Adaptive difficulty algorithms
│   │   ├── engines/           # Pure cognitive engine logic
│   │   │   ├── focus.ts       # Focus game state & scoring
│   │   │   ├── logic.ts       # Logic puzzle generation
│   │   │   ├── memory.ts      # N-back sequences
│   │   │   └── reaction.ts    # Go/No-Go stimulus management
│   │   └── gamification/      # XP system, streaks, ranks, achievements
│   │
│   ├── hooks/                 # Custom React hooks
│   │   └── useStorage.ts      # LocalStorage & IndexedDB integration
│   │
│   ├── infrastructure/        # Data layer & worker integration
│   │   ├── db/                # Database schema & client
│   │   ├── export/            # Data export/import utilities
│   │   ├── storage/           # Local storage abstractions
│   │   └── workers/           # Web Workers for heavy computation
│   │
│   ├── lib/                   # Utility functions
│   │   ├── constants.ts       # App-wide configuration
│   │   ├── math.ts            # Statistical & mathematical helpers
│   │   └── time.ts            # Time manipulation utilities
│   │
│   ├── styles/                # Global & modular styles
│   │   ├── animations.css     # Reusable animation keyframes
│   │   ├── appshell.css       # Layout styling
│   │   ├── components.css     # Component-specific styles
│   │   ├── dashboard.css      # Dashboard styling
│   │   ├── globals.css        # Global variables & resets
│   │   ├── landing.css        # Landing page styling
│   │   ├── settings.css       # Settings page styling
│   │   └── training.css       # Training interface styling
│   │
│   └── types/                 # TypeScript definitions
│       ├── analytics.ts       # Analytics & metrics types
│       ├── engines.ts         # Cognitive engine interfaces
│       ├── gamification.ts    # Gamification system types
│       └── storage.ts         # Storage & data persistence types
│
├── assets/                    # Documentation & media assets
├── .eslintrc.mjs              # ESLint configuration
├── next.config.ts             # Next.js build & runtime config
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript compiler options
└── README.md                  # This file
```

### Data Flow Architecture

```
User Interface (React Components)
            ↓
      Custom Hooks (useStorage)
            ↓
Domain Logic (Cognitive Engines)
            ↓
Analytics Engine (CGI, Fatigue, Suggestions)
            ↓
Local Storage Layer (IndexedDB + LocalStorage)
            ↓
[Device Memory - No External Servers]
```

---

## Tech Stack

Built with modern, production-ready web technologies:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | [Next.js 16](https://nextjs.org/) | React meta-framework with App Router |
| **Runtime** | [React 19](https://react.dev/) | UI library with hooks & composition |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Type-safe JavaScript development |
| **Styling** | CSS Modules + CSS Variables | Scoped, maintainable styles |
| **Storage** | IndexedDB + LocalStorage | Client-side data persistence |
| **Workers** | Web Workers | Offload computation to background threads |
| **Linting** | ESLint 9 | Code quality & consistency |

---

### Build for Production

```bash
npm run build
npm start
```

### Code Quality

```bash
npm run lint
```

---

## Project Standards

### Code Organization
- **Domain Logic**: Pure, testable functions in `/src/domain`
- **UI Components**: Reusable React components in `/src/components`
- **Hooks**: Custom React hooks for state/storage in `/src/hooks`
- **Types**: Single source of truth for TypeScript definitions in `/src/types`

### TypeScript
- Strict mode enabled (`strict: true`)
- No implicit `any` types
- All exported functions typed
- Interfaces for domain models

### Performance
- Tree-shakeable imports
- Code splitting at route boundaries
- Web Workers for heavy computations
- Optimized CSS with variables

---

## Contributing

Contributions are welcome and appreciated! Whether it's bug fixes, features, documentation, or test coverage, your help improves Mind Sensei.

### How to Contribute

1. **Fork the repository**
   ```bash
   git clone https://github.com/Rafi-Luffy/mind-sensei.git
   cd mind-sensei
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** following the project standards above

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new cognitive engine" -m "Description of changes"
   ```

5. **Push to your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** with a clear description
    - Link to any relevant issues
    - Describe the problem and your solution
    - Include screenshots or GIFs if applicable

## Analytics & Metrics

Mind Sensei tracks the following metrics **locally only**:

- **Performance Scores**: Accuracy, speed, consistency
- **Growth Tracking**: Weekly improvement rates
- **Cognitive Growth Index**: Overall mental fitness composite
- **Session Data**: Duration, difficulty, fatigue levels
- **Consistency Heatmap**: Training frequency visualization

All data stays on your device and can be exported anytime.

---


## License

This project is distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

You are free to use, modify, and distribute this software for personal and commercial purposes.

---

