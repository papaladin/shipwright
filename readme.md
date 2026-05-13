# ⚓ Shipwright

An interactive, historically-inspired ship builder that renders fully-rigged sailing vessels in SVG.  
Users can configure hull size, gun decks, armament, mast count, rig type, sail plans, deck structures, staysails, and colours in real time.

---

## 🚀 Quick Start

Open `ship.html` in any modern browser.

No build tools, servers, or dependencies are required — the project uses plain HTML, CSS, and vanilla JavaScript.

---

# 🏗 Architecture Overview

```text
ship.html
 └─ ship.css
 └─ ship-config.js
     └─ ship-geometry.js
         └─ ship-render.js
             └─ ship-ui.js
```

All files share a single global scope; later files may use symbols defined earlier.

---

## 🔁 Update Flow

```text
User input
  → syncUItoState()
  → applyShipConstraints()
  → rebuild UI
  → drawShip()
```

All ship-combination rules are defined in `ship-config.js`.

---

# ✨ Features

| Area | Features |
|---|---|
| **Hull & Deck** | 4 hull sizes, up to 2 gun decks, forecastle, quarterdeck, poop deck, stern gallery |
| **Armament** | Configurable gun ports with automatic limits |
| **Rigging** | 1–3 masts, square/gaff/lateen rigs, realistic sail hierarchy |
| **Staysails** | Main, mizzen, and topmast staysails with automatic validation |
| **Standing Rigging** | Stays, shrouds, ratlines, platforms, backstays |
| **Visual Depth** | Tilted yards/sails, curved sail paths, quarter-view perspective |
| **Colours** | Customisable hull, sail, deck, and gun-port colours |

### Square-Rig Sail Hierarchy

```text
Course → Topsail → Topgallant → Royal
```

---

# 📁 File Responsibilities

| File | Purpose |
|---|---|
| `ship.html` | DOM structure and SVG canvas; loads all scripts |
| `ship.css` | Layout, controls, steppers, dynamic panel styling |
| `ship-config.js` | Global state, constants, helpers, constraints, accessor functions |
| `ship-geometry.js` | Pure geometry computation; builds the `geo` object |
| `ship-render.js` | SVG rendering and drawing logic |
| `ship-ui.js` | User interaction, state sync, UI rebuilding, redraw orchestration |

---

# 🧠 Constraint Rules

| Rule Area | Behaviour |
|---|---|
| **Hull Limits** | Small hulls cannot have gun decks or poop decks |
| **Gun Decks** | Medium hulls: max 1; Large/Very Large: max 2 |
| **Masts** | Large/Very Large hulls require at least 2 masts |
| **Sail Hierarchy** | Upper sails automatically enable lower sails |
| **Royal Sails** | Only allowed on Large and Very Large hulls |
| **Staysails** | Automatically enabled/disabled based on mast count and topmast availability |

### Staysail Conditions

| Staysail | Requirement |
|---|---|
| Main staysail | ≥ 2 masts |
| Mizzen staysail | 3 masts |
| Main topmast staysail | ≥ 2 masts + valid fore/main topmast |
| Mizzen topmast staysail | 3 masts + valid main/mizzen topmast |

Invalid staysails are automatically removed when conditions change.

---

# 🔧 Code Quality Improvements

| Improvement | Description |
|---|---|
| Safer rendering | `drawShip()` wrapped in `try/catch` |
| Cleaner constants | Extracted rigging magic numbers into named constants |
| Better debugging | Added `console.warn()` handling in `onto()` |
| Safer parsing | Added `parseNumericElement()` helper |
| CSS resilience | Added fallbacks for `.squarePanel` and `.gaffPanel` |
| Cleanup | Removed unused `estimateBeam()` |

---

## 🚢 Roadmap

- **Backend & Architecture**
  - Add unit tests and robust input validation
  - Modularize codebase, move off global scope, centralize constants/utilities
  - Further cleanup: consistent coding style (e.g., Prettier, ESLint), dead code removal
  - Strengthen error handling (UI and geometry)
  - Explore TypeScript or JSDoc for stronger type safety

- **Visual Improvements**
  - Hull: Advanced plank textures and smooth hull curves
  - Gun ports: 3D/shadowed ports, animated open/close
  - Decks & Structures: More visible plank lines, step shading, castle enhancements, ornate rails, poop deck, windows, decorated stern gallery
  - Responsive polish: Ensure UI and SVG look great across devices
  - Add SVG/PNG export option

- **Features**
  - Ship Presets: Famous ships and user-defined configurations; Save/load (local and optional cloud)
  - Accessible tutorial overlays and contextual help

- **Other Enhancements**
  - Optional backend for online ship gallery and sharing
  - Sidebar with historical context on ship types and rigging


---

## ⚖️ License

NA
