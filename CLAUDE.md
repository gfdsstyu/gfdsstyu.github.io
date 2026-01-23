# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**감린이 (Gamlini) v4.0** - A Korean accounting audit exam study platform. Single Page Application (SPA) built with vanilla JavaScript ES6 modules, Firebase backend, and AI-powered grading via Gemini API.

## Development Commands

```bash
# CSS build (Tailwind)
npm run build:css          # Build minified CSS
npm run watch:css          # Watch mode for development

# Ranking snapshot (admin)
cd admin-scripts && npm run snapshot

# Firebase Functions deployment
cd functions && firebase deploy --only functions

# Firebase hosting
firebase deploy --only hosting
```

No build step required for JavaScript - static site uses ES6 modules directly.

## Architecture

### Module Structure

```
js/
├── app.js              # Entry point, Firebase init, module orchestration
├── config/config.js    # AI prompts, chapter definitions, constants
├── core/               # State & data management
│   ├── stateManager.js    # Global state (getter/setter pattern)
│   ├── dataManager.js     # Question data loading from questions.json
│   ├── storageManager.js  # localStorage wrapper
│   ├── persistentStorage.js # IndexedDB backup layer
│   └── eventBus.js        # Pub/sub for cross-module communication
├── services/           # External API integrations
│   ├── geminiApi.js       # AI grading
│   ├── geminiChatApi.js   # Chatbot tutor
│   ├── ragService.js      # Vector search for knowledge base
│   └── googleSttApi.js    # Speech-to-text
├── features/           # Feature modules (each has Core + UI pattern)
│   ├── quiz/           # Core quiz system (quizCore.js, grading.js, navigation.js)
│   ├── exam/           # Past exam simulation (2014-2025)
│   ├── review/         # HLR spaced repetition with TensorFlow.js
│   ├── achievements/   # Gamification badges
│   ├── ranking/        # Leaderboard with snapshot caching
│   ├── kam/            # Case-based learning (핵심감사사항)
│   └── ...             # filter, report, calendar, flashcard, etc.
└── ui/                 # Shared UI utilities (elements.js, domUtils.js)
```

### Key Patterns

**State Management**: Centralized in `stateManager.js` using getter/setter pattern. Access via `StateManager.get('key')` / `StateManager.set('key', value)`.

**Event Bus**: Used to avoid circular dependencies. Modules communicate via `eventBus.emit('event-name', data)` and `eventBus.on('event-name', handler)`.

**Feature Modules**: Each feature typically has:
- `*Core.js` - Business logic
- `*UI.js` - DOM rendering
- Optional service integrations

**Storage Layers**:
1. localStorage - Preferences, study history
2. IndexedDB (persistentStorage.js) - Backup layer, survives cache clearing
3. Firestore - Cloud sync for user data, rankings, achievements

### Data Flow

Questions loaded from `/questions.json` (6,113 items) → cached in stateManager → filtered by chapter/difficulty → rendered in quiz UI → answers graded via Gemini API → results stored in Firestore.

## Important Files

- `/questions.json` - Main question database
- `/firestore.rules` - Database security rules
- `/public/data/vectors.json` - RAG embeddings for chatbot
- `/DB/*.md` - Knowledge base files for RAG system

## Firebase Structure

```
users/{userId}/
  ├── records/        # Answer history
  ├── examScores/     # Past exam scores by year
  └── kamScores/      # Case study scores

ranking_cache/snapshot   # Cached leaderboard (regenerated every 6h)
```

## AI Integration

Grading uses Gemini API with strict scoring prompts defined in `config.js`. The chatbot (Gamlini tutor) uses RAG with pre-embedded audit standards from `/DB/` markdown files.

Supported models configured in `AI_MODELS` array in config.js - includes Gemini 2.5/3 Flash/Pro and Gemma variants.

## Korean Language Context

- UI and comments primarily in Korean
- Chapters follow Korean Audit Standards (회계감사기준서) structure
- Common abbreviations: RMM (중요왜곡표시위험), TOC (통제테스트), KAM (핵심감사사항)
