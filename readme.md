# ⚓ Shipwright

An interactive, historically-inspired ship builder that renders fully-rigged sailing vessels in SVG.  
Users can configure hull size, gun decks, armament, mast count, rigging, sail plans, deck structures, and colours in real time.

---

## 🚀 Quick Start

Open `ship.html` in any modern browser.

No build tools, servers, or dependencies are required — the project uses plain HTML, CSS, and vanilla JavaScript.

---

# 🏗 Architecture Overview

The application is split into six files loaded in strict order:

```text
ship.html
 └─ ship.css
 └─ ship-config.js
     └─ ship-geometry.js
         └─ ship-render.js
             └─ ship-ui.js
```

All files share a single global scope.  
Later files may use symbols defined earlier.

---

## 🔁 Update Flow

```text
User input
  → ship-ui.js
      → syncUItoState()
      → applyShipConstraints()
      → rebuild UI
      → drawShip()
```

Rules and constraints are defined exclusively in `ship-config.js`.

---

# 📁 File Responsibilities

## `ship.html`

Defines the DOM structure and SVG canvas.

- Provides all required element IDs
- Loads CSS and scripts in order
- Contains no inline CSS or JavaScript

---

## `ship.css`

Handles presentation and layout only.

- UI styling
- Responsive layout
- Stepper/button styling

Contains no geometry or logic.

---

## `ship-config.js`

Central configuration and rules layer.

### Provides

- Global `state`
- Constants (`CANVAS_WIDTH`, `KEEL_Y`, etc.)
- Data tables (`HULL_PRESETS`, `RIG_CONSTANTS`)
- Utility helpers (`el()`, `darken()`, `createStepper()`)
- Constraint functions (`applyShipConstraints()`)

### Responsibilities

- Defines all ship-combination rules
- Maintains valid state
- Exposes limit/accessor functions for the UI

---

## `ship-geometry.js`

Pure geometry computation layer.

### Provides

- `buildShipGeometry()`
- Mast and sail geometry helpers

### Responsibilities

- Converts `state` into a `geo` object
- Computes hull proportions, mast placement, sail dimensions, and deck geometry
- Contains no DOM or SVG manipulation

---

## `ship-render.js`

SVG rendering layer.

### Provides

- `drawShip()`
- Hull, sail, rigging, and water drawing functions

### Responsibilities

- Converts `geo` into SVG elements
- Owns all SVG DOM manipulation
- Reads state but never modifies it

---

## `ship-ui.js`

User interaction and orchestration layer.

### Provides

- `updateAndDraw()`
- UI rebuild helpers
- State synchronisation

### Responsibilities

- Reads user input
- Updates global state
- Applies constraints
- Rebuilds controls
- Triggers rendering

Contains no ship-rule logic.

---

# ✨ Future Improvements

- Staysails & flags
- Save/load ship presets
- Responsive SVG scaling
- User-customisable appearance themes
- Geometry unit testing

---

## ⚖️ License

NA