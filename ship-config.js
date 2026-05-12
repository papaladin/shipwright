// =====================================================
// CANVAS CONSTANTS
// =====================================================
const CANVAS_WIDTH = 1500;
const CANVAS_HEIGHT = 1200;
const SIDE_MARGIN = 130;
const KEEL_Y = 1100;

// =====================================================
// SVG HELPERS
// =====================================================
const svgNS = "http://www.w3.org/2000/svg";

function el(tag, attrs) {
    const e = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) {
        e.setAttribute(k, v);
    }
    return e;
}

function onto(layerId, node) {
    const target = document.getElementById("shipSvg")
        ?.querySelector(`#${layerId}`);
    if (!target) {
        console.warn(`Layer '${layerId}' not found – element not appended.`);
        return;
    }
    target.appendChild(node);
}

function darken(hex, amount) {
    const clamp = n => Math.max(0, Math.min(255, n));
    const r = clamp(parseInt(hex.slice(1, 3), 16) - amount);
    const g = clamp(parseInt(hex.slice(3, 5), 16) - amount);
    const b = clamp(parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// =====================================================
// STEMMER (UI helper)
// =====================================================
function createStepper(containerId, min, max, initialValue, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.className = 'stepper';
    container.innerHTML = '';

    const minus = document.createElement('button');
    minus.className = 'stepper-btn';
    minus.textContent = '−';

    const valueEl = document.createElement('span');
    valueEl.className = 'stepper-value';
    valueEl.id = containerId.replace(/Stepper$/, '') + 'Value';
    valueEl.textContent = initialValue;

    const plus = document.createElement('button');
    plus.className = 'stepper-btn';
    plus.textContent = '+';

    container.appendChild(minus);
    container.appendChild(valueEl);
    container.appendChild(plus);

    function setValue(v) {
        v = Math.min(max, Math.max(min, v));
        valueEl.textContent = v;
        if (onChange) onChange(v);
    }

    minus.addEventListener('click', () => setValue(parseInt(valueEl.textContent) - 1));
    plus.addEventListener('click', () => setValue(parseInt(valueEl.textContent) + 1));

    return setValue;
}

// =====================================================
// HULL PRESETS
// =====================================================
const HULL_PRESETS = {
    small: {
        baseLength: 560,
        maxMasts: 2,
        maxGunDecks: 0,
        baseRatio: 0.10,
        bowSheer: 12,
        sternSheer: 18,
        mastHeightFactor: 0.75
    },
    medium: {
        baseLength: 760,
        maxMasts: 3,
        maxGunDecks: 1,
        baseRatio: 0.11,
        bowSheer: 18,
        sternSheer: 28,
        mastHeightFactor: 0.80
    },
    large: {
        baseLength: 980,
        maxMasts: 3,
        maxGunDecks: 2,
        baseRatio: 0.12,
        bowSheer: 22,
        sternSheer: 38,
        mastHeightFactor: 0.85
    },
    veryLarge: {
        baseLength: 1180,
        maxMasts: 3,
        maxGunDecks: 2,
        baseRatio: 0.13,
        bowSheer: 28,
        sternSheer: 50,
        mastHeightFactor: 0.90
    }
};

// =====================================================
// HISTORICAL RIGGING CONSTANTS
// =====================================================
const RIG_CONSTANTS = {
    square: {
        baseWidthRatios: {
            course: 0.24,
            topsail: 0.20,
            topgallant: 0.16,
            royal: 0.12
        },
        aspectRatios: {
            course: 1.70,
            topsail: 1.55,
            topgallant: 1.40,
            royal: 1.25
        }
    }
};

// =====================================================
// RIGGING VISUAL CONSTANTS (extracted magic numbers)
// =====================================================
const LOWER_SHROUD_SPREAD_RATIO = 0.065;
const TOPMAST_SHROUD_SPREAD_RATIO = 0.04;
const RATLINE_SPACING = 15;
const PLATFORM_HALF_WIDTH_RATIO = 0.04;
const BACKSTAY_OFFSETS = [160, 100, 50];   // per mast index (fore, main, mizzen)

// =====================================================
// RIG POWER (used for mast height scaling)
// =====================================================
function computeRigPower(mastConf) {
    if (mastConf.type === "square") {
        let p = 0;
        if (mastConf.squareSails.course) p += 1.00;
        if (mastConf.squareSails.topsail) p += 0.85;
        if (mastConf.squareSails.topgallant) p += 0.60;
        if (mastConf.squareSails.royal) p += 0.35;
        return p;
    }
    if (mastConf.type === "gaff") {
        let p = 0;
        if (mastConf.gaff.hasGaff) p += 1.15;
        if (mastConf.gaff.hasSquareTopsail) p += 0.30;
        return p;
    }
    if (mastConf.type === "lateen") return 1.10;
    return 0.5;
}

// =====================================================
// STATE MODEL
// =====================================================
let state = {
    hullSize: "medium",
    hullStructures: {
        gunDecks: 1,
        forecastle: true,
        quarterdeck: true,
        poopDeck: false,
        sternGallery: true,
        hullWindows: false
    },
    armament: {
        gunPortsLower: 8,
        gunPortsUpper: 6
    },
    rig: {
        mastCount: 2,
        rigFamily: "square",
        staysails: {
            mainStaysail: false,
            mizzenStaysail: false,
            mainTopmastStaysail: false,
            mizzenTopmastStaysail: false
        }
    },
    appearance: {
        hullColor: "#7C4A2A",
        sailColor: "#F7E9CD",
        deckColor: "#C29A6B",
        gunPortColor: "#3E2C1A"
    },
    masts: [
        {
            type: "square",
            squareSails: { course: true, topsail: true, topgallant: true, royal: false },
            gaff: { hasGaff: false, hasSquareTopsail: false }
        },
        {
            type: "square",
            squareSails: { course: true, topsail: true, topgallant: true, royal: false },
            gaff: { hasGaff: false, hasSquareTopsail: false }
        }
    ],
    bowspritType: "jib"
};

// =====================================================
// RULE ACCESSORS (single source of truth for limits)
// =====================================================
function getMaxGunDecks() {
    return HULL_PRESETS[state.hullSize].maxGunDecks;
}

function getMinMasts() {
    return (state.hullSize === "large" || state.hullSize === "veryLarge") ? 2 : 1;
}

function getMaxMasts() {
    return HULL_PRESETS[state.hullSize].maxMasts;
}

function isRoyalSailAllowed() {
    return state.hullSize === "large" || state.hullSize === "veryLarge";
}

// ----- Staysail accessors -----
function mastHasUsableTopmast(mastIndex) {
    if (mastIndex >= state.masts.length) return false;
    const m = state.masts[mastIndex];
    if (m.type === "square") {
        return m.squareSails.topsail || m.squareSails.topgallant || m.squareSails.royal;
    }
    if (m.type === "gaff") {
        return m.gaff.hasSquareTopsail;
    }
    return false; // lateen does not contribute
}

function canHaveMainStaysail() {
    return state.rig.mastCount >= 2;
}

function canHaveMizzenStaysail() {
    return state.rig.mastCount === 3;
}

function canHaveMainTopmastStaysail() {
    return state.rig.mastCount >= 2 &&
           (mastHasUsableTopmast(0) || mastHasUsableTopmast(1));
}

function canHaveMizzenTopmastStaysail() {
    return state.rig.mastCount === 3 &&
           (mastHasUsableTopmast(1) || mastHasUsableTopmast(2));
}

// =====================================================
// CONSTRAINTS (all rules that make the ship realistic)
// =====================================================
function applyShipConstraints() {
    const p = HULL_PRESETS[state.hullSize];

    // Gun decks
    if (state.hullStructures.gunDecks > p.maxGunDecks) {
        state.hullStructures.gunDecks = p.maxGunDecks;
    }
    if (state.hullSize === "small") {
        state.hullStructures.gunDecks = 0;
        state.hullStructures.poopDeck = false;
    }

    // Mast count
    const minMasts = getMinMasts();
    if (state.rig.mastCount < minMasts) state.rig.mastCount = minMasts;
    if (state.rig.mastCount > getMaxMasts()) state.rig.mastCount = getMaxMasts();

    // Sail hierarchy + royal restriction
    state.masts.forEach(mast => {
        if (mast.type !== "square") return;
        const s = mast.squareSails;
        if (s.royal) {
            s.topgallant = true;
            s.topsail = true;
            s.course = true;
        }
        if (s.topgallant) {
            s.topsail = true;
            s.course = true;
        }
        if (s.topsail) {
            s.course = true;
        }
        if (!isRoyalSailAllowed()) {
            s.royal = false;
        }
    });

    // Staysail constraints – remove any that are no longer allowed
    if (!canHaveMainStaysail())         state.rig.staysails.mainStaysail = false;
    if (!canHaveMizzenStaysail())       state.rig.staysails.mizzenStaysail = false;
    if (!canHaveMainTopmastStaysail())  state.rig.staysails.mainTopmastStaysail = false;
    if (!canHaveMizzenTopmastStaysail()) state.rig.staysails.mizzenTopmastStaysail = false;

    // Keep UI checkboxes consistent
    document.getElementById("poopDeckCheck").checked = state.hullStructures.poopDeck;
    const gdSpan = document.getElementById("gunDecksValue");
    if (gdSpan) gdSpan.textContent = state.hullStructures.gunDecks;
}