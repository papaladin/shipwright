// =====================================================
// SAFE NUMERIC PARSER (avoids NaN from stepper spans)
// =====================================================
function parseNumericElement(elId, fallback = 0) {
    const el = document.getElementById(elId);
    if (!el) return fallback;
    const val = parseInt(el.textContent, 10);
    return isNaN(val) ? fallback : val;
}

// =====================================================
// SYNC STATE FROM UI
// =====================================================
function syncUItoState() {
    const previousHullSize = state.hullSize;
    state.hullSize = document.getElementById("hullSize").value;

    // Reset sails when hull size changes
    if (previousHullSize !== state.hullSize) {
        state.masts.forEach(mast => {
            mast.squareSails = { course: false, topsail: false, topgallant: false, royal: false };
            mast.gaff = { hasGaff: false, hasSquareTopsail: false };
        });
        state.rig.staysails = {
            mainStaysail: false,
            mizzenStaysail: false,
            mainTopmastStaysail: false,
            mizzenTopmastStaysail: false
        };
        // Optionally reset flags? Let's keep them as is.
    }

    state.hullStructures.gunDecks = parseNumericElement("gunDecksValue", 0);

    state.hullStructures.forecastle = document.getElementById("forecastleCheck").checked;
    state.hullStructures.quarterdeck = document.getElementById("quarterdeckCheck").checked;
    state.hullStructures.poopDeck = document.getElementById("poopDeckCheck").checked;
    state.hullStructures.sternGallery = document.getElementById("sternGalleryCheck").checked;
    state.hullStructures.hullWindows = document.getElementById("hullWindowsCheck").checked;

    state.armament.gunPortsLower = parseNumericElement("gunPortsLowerValue", 0);
    state.armament.gunPortsUpper = parseNumericElement("gunPortsUpperValue", 0);

    state.rig.mastCount = parseNumericElement("mastCountValue", 1);

    state.bowspritType = document.getElementById("bowspritType").value;

    state.appearance.hullColor = document.getElementById("hullColor").value;
    state.appearance.sailColor = document.getElementById("sailColor").value;
    state.appearance.deckColor = document.getElementById("deckColor").value;
    state.appearance.gunPortColor = document.getElementById("gunPortColor").value;

    // Sail pattern & stripe color
    state.appearance.sailPattern = document.getElementById("sailPattern").value;
    state.appearance.stripeColor = document.getElementById("stripeColor").value;
    document.getElementById("stripeColorRow").style.display =
        state.appearance.sailPattern === "stripes" ? "flex" : "none";
}

// =====================================================
// GUN PORT UI (steppers)
// =====================================================
function rebuildGunPortsUI() {
    const cnt = document.getElementById("gunPortsPanel");
    cnt.innerHTML = '';
    const gd = state.hullStructures.gunDecks;
    if (gd === 0) return;

    const geo = buildShipGeometry();
    const maxLower = geo.gunDeckYs.length > 0 ? Math.floor((geo.sternFairX - geo.bowFairX - 60) / 40) : 10;
    const maxUpper = geo.gunDeckYs.length > 1 ? Math.floor((geo.sternFairX - geo.bowFairX - 60) / 40) : 8;

    const row1 = document.createElement('div');
    row1.className = 'row';
    row1.innerHTML = '<label>Lower deck ports:</label>';
    const c1 = document.createElement('div');
    c1.id = 'gunPortsLowerStepper';
    row1.appendChild(c1);
    cnt.appendChild(row1);
    createStepper('gunPortsLowerStepper', 0, maxLower, state.armament.gunPortsLower, v => {
        state.armament.gunPortsLower = v;
        updateAndDraw();
    });

    if (gd >= 2) {
        const row2 = document.createElement('div');
        row2.className = 'row';
        row2.innerHTML = '<label>Upper deck ports:</label>';
        const c2 = document.createElement('div');
        c2.id = 'gunPortsUpperStepper';
        row2.appendChild(c2);
        cnt.appendChild(row2);
        createStepper('gunPortsUpperStepper', 0, maxUpper, state.armament.gunPortsUpper, v => {
            state.armament.gunPortsUpper = v;
            updateAndDraw();
        });
    }
}

// =====================================================
// MAST RIGGING UI (sail checkboxes)
// =====================================================
function rebuildMastRiggingUI() {
    const container = document.getElementById("mastRiggingContainer");
    container.innerHTML = "";
    const names = ["Foremast", "Mainmast", "Mizzen"];

    while (state.masts.length < state.rig.mastCount) {
        state.masts.push({
            type: "square",
            squareSails: { course: true, topsail: true, topgallant: false, royal: false },
            gaff: { hasGaff: false, hasSquareTopsail: false }
        });
    }
    while (state.masts.length > state.rig.mastCount) {
        state.masts.pop();
    }

    const royalAllowed = isRoyalSailAllowed();

    for (let i = 0; i < state.rig.mastCount; i++) {
        const mast = state.masts[i];
        const card = document.createElement("div");
        card.className = "mast-detail-card";

        const header = document.createElement("strong");
        header.textContent = names[i];
        card.appendChild(header);

        const rigSelector = document.createElement("div");
        rigSelector.className = "rig-type-selector";
        ["square", "gaff", "lateen"].forEach(type => {
            const lbl = document.createElement("label");
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = `rig${i}`;
            radio.value = type;
            radio.checked = mast.type === type;
            radio.addEventListener("change", () => {
                mast.type = type;
                if (type !== "square") mast.squareSails = { course: false, topsail: false, topgallant: false, royal: false };
                if (type !== "gaff") mast.gaff = { hasGaff: false, hasSquareTopsail: false };
                rebuildMastRiggingUI();
                updateAndDraw();
            });
            lbl.appendChild(radio);
            lbl.appendChild(document.createTextNode(" " + type.charAt(0).toUpperCase() + type.slice(1)));
            rigSelector.appendChild(lbl);
        });
        card.appendChild(rigSelector);

        // Square sails
        const sqPanel = document.createElement("div");
        sqPanel.className = "squarePanel";
        sqPanel.style.display = mast.type === "square" ? "" : "none";

        function makeCheck(label, key, requires) {
            const lbl = document.createElement("label");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = "sail-check";
            cb.dataset.sail = key;
            cb.dataset.requires = requires.join(",");
            cb.checked = mast.squareSails[key];
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(" " + label));
            cb.addEventListener("change", () => {
                mast.squareSails[key] = cb.checked;
                updateAndDraw();
            });
            return { lbl, cb };
        }

        const course = makeCheck("Course", "course", []);
        const topsail = makeCheck("Topsail", "topsail", ["course"]);
        const topgallant = makeCheck("Topgallant", "topgallant", ["course", "topsail"]);
        const royal = makeCheck("Royal", "royal", ["course", "topsail", "topgallant"]);
        royal.cb.disabled = !royalAllowed;

        [course, topsail, topgallant, royal].forEach(({ lbl }) => sqPanel.appendChild(lbl));
        card.appendChild(sqPanel);

        // Gaff sails
        const gaffPanel = document.createElement("div");
        gaffPanel.className = "gaffPanel";
        gaffPanel.style.display = mast.type === "gaff" ? "" : "none";

        const gaffMainLabel = document.createElement("label");
        const gaffMain = document.createElement("input");
        gaffMain.type = "checkbox";
        gaffMain.className = "gaffMain";
        gaffMain.checked = mast.gaff.hasGaff;
        gaffMain.addEventListener("change", () => {
            mast.gaff.hasGaff = gaffMain.checked;
            updateAndDraw();
        });
        gaffMainLabel.appendChild(gaffMain);
        gaffMainLabel.appendChild(document.createTextNode(" Gaff Sail"));
        gaffPanel.appendChild(gaffMainLabel);

        const gaffTopLabel = document.createElement("label");
        const gaffTop = document.createElement("input");
        gaffTop.type = "checkbox";
        gaffTop.className = "gaffTop";
        gaffTop.checked = mast.gaff.hasSquareTopsail;
        gaffTop.addEventListener("change", () => {
            mast.gaff.hasSquareTopsail = gaffTop.checked;
            updateAndDraw();
        });
        gaffTopLabel.appendChild(gaffTop);
        gaffTopLabel.appendChild(document.createTextNode(" Square Topsail"));
        gaffPanel.appendChild(gaffTopLabel);

        card.appendChild(gaffPanel);
        container.appendChild(card);
    }
}

// =====================================================
// STAYSAIL UI
// =====================================================
function rebuildStaysailsUI() {
    const panel = document.getElementById("staysailsPanel");
    if (!panel) return;
    panel.innerHTML = '<strong>Staysails</strong>';

    const staysailDefs = [
        { key: 'mainStaysail', label: 'Main staysail', can: canHaveMainStaysail },
        { key: 'mizzenStaysail', label: 'Mizzen staysail', can: canHaveMizzenStaysail },
        { key: 'mainTopmastStaysail', label: 'Main topmast staysail', can: canHaveMainTopmastStaysail },
        { key: 'mizzenTopmastStaysail', label: 'Mizzen topmast staysail', can: canHaveMizzenTopmastStaysail }
    ];

    staysailDefs.forEach(def => {
        const row = document.createElement('div');
        row.className = 'row';
        const lbl = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = state.rig.staysails[def.key];
        cb.disabled = !def.can();
        cb.addEventListener('change', () => {
            state.rig.staysails[def.key] = cb.checked;
            updateAndDraw();
        });
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' ' + def.label));
        if (!def.can()) lbl.style.opacity = '0.5';
        row.appendChild(lbl);
        panel.appendChild(row);
    });
}

// =====================================================
// FLAGS UI
// =====================================================
function rebuildFlagsUI() {
    const panel = document.getElementById("flagsPanel");
    if (!panel) return;
    panel.innerHTML = '';

    const positions = ['fore', 'main', 'mizzen', 'stern'];
    const positionNames = { fore: 'Foremast', main: 'Mainmast', mizzen: 'Mizzen', stern: 'Stern' };

    positions.forEach(pos => {
        const flagState = state.flags[pos];
        const container = document.createElement('div');
        container.style.marginBottom = '8px';
        container.style.padding = '6px';
        container.style.background = 'rgba(255,255,240,0.5)';
        container.style.borderRadius = '8px';

        // ---- Enable checkbox ----
        const enableLabel = document.createElement('label');
        const enableCb = document.createElement('input');
        enableCb.type = 'checkbox';
        enableCb.checked = flagState.enabled;
        enableCb.addEventListener('change', () => {
            flagState.enabled = enableCb.checked;
            rebuildFlagsUI();   // show/hide sub-controls
            updateAndDraw();
        });
        enableLabel.appendChild(enableCb);
        enableLabel.appendChild(document.createTextNode(' ' + positionNames[pos]));
        container.appendChild(enableLabel);

        if (!flagState.enabled) {
            panel.appendChild(container);
            return; // skip the rest for this position
        }

        // ---- Design dropdown ----
        const designRow = document.createElement('div');
        designRow.style.margin = '4px 0';
        const designSelect = document.createElement('select');
        Object.entries(FLAG_DESIGNS).forEach(([key, def]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = def.label;
            designSelect.appendChild(opt);
        });
        designSelect.value = flagState.design;
        designSelect.addEventListener('change', () => {
            const newDesign = FLAG_DESIGNS[designSelect.value];
            flagState.design = designSelect.value;
            // if preset, auto‑fill colours
            if (newDesign.fixedColors && newDesign.fixedColors.length > 0) {
                flagState.primary = newDesign.fixedColors[0] || '#000000';
                flagState.secondary = newDesign.fixedColors[1] || '#FFFFFF';
            }
            rebuildFlagsUI();
            updateAndDraw();
        });
        designRow.appendChild(designSelect);
        container.appendChild(designRow);

        const currentDesign = FLAG_DESIGNS[flagState.design];

        // ---- Colour pickers (only if customisable) ----
        if (currentDesign.colors >= 1 && !currentDesign.fixedColors) {
            const colorRow = document.createElement('div');
            colorRow.style.display = 'flex'; colorRow.style.gap = '8px'; colorRow.style.alignItems = 'center';
            const primLabel = document.createElement('label');
            primLabel.textContent = 'C1:';
            const primInput = document.createElement('input');
            primInput.type = 'color';
            primInput.value = flagState.primary;
            primInput.addEventListener('input', () => { flagState.primary = primInput.value; updateAndDraw(); });
            primLabel.appendChild(primInput);
            colorRow.appendChild(primLabel);

            if (currentDesign.colors >= 2) {
                const secLabel = document.createElement('label');
                secLabel.textContent = 'C2:';
                const secInput = document.createElement('input');
                secInput.type = 'color';
                secInput.value = flagState.secondary;
                secInput.addEventListener('input', () => { flagState.secondary = secInput.value; updateAndDraw(); });
                secLabel.appendChild(secInput);
                colorRow.appendChild(secLabel);
            }
            container.appendChild(colorRow);
        }

        panel.appendChild(container);
    });
}

// =====================================================
// MAIN UPDATE CYCLE
// =====================================================
function updateAndDraw() {
    syncUItoState();
    applyShipConstraints();
    rebuildGunPortsUI();
    rebuildMastRiggingUI();
    rebuildStaysailsUI();
    rebuildFlagsUI();
    drawShip();
}

// =====================================================
// INITIALISE STEPPERS
// =====================================================
let setGunDecks, setMastCount;

function initSteppers() {
    const maxGunDecks = getMaxGunDecks();
    setGunDecks = createStepper("gunDecksStepper", 0, maxGunDecks, state.hullStructures.gunDecks, v => {
        state.hullStructures.gunDecks = v;
        applyShipConstraints();
        updateAndDraw();
    });

    const minMasts = getMinMasts();
    const maxMasts = getMaxMasts();
    setMastCount = createStepper("mastCountStepper", minMasts, maxMasts, state.rig.mastCount, v => {
        state.rig.mastCount = v;
        applyShipConstraints();
        rebuildMastRiggingUI();
        updateAndDraw();
    });
}

// =====================================================
// EVENT BINDINGS
// =====================================================
document.getElementById("hullSize").addEventListener("change", () => {
    syncUItoState();
    applyShipConstraints();
    initSteppers();
    updateAndDraw();
});
document.getElementById("forecastleCheck").addEventListener("change", updateAndDraw);
document.getElementById("quarterdeckCheck").addEventListener("change", updateAndDraw);
document.getElementById("poopDeckCheck").addEventListener("change", updateAndDraw);
document.getElementById("sternGalleryCheck").addEventListener("change", updateAndDraw);
document.getElementById("hullWindowsCheck").addEventListener("change", updateAndDraw);
document.getElementById("bowspritType").addEventListener("change", updateAndDraw);
document.getElementById("hullColor").addEventListener("input", updateAndDraw);
document.getElementById("sailColor").addEventListener("input", updateAndDraw);
document.getElementById("deckColor").addEventListener("input", updateAndDraw);
document.getElementById("gunPortColor").addEventListener("input", updateAndDraw);
document.getElementById("sailPattern").addEventListener("change", () => {
    state.appearance.sailPattern = document.getElementById("sailPattern").value;
    document.getElementById("stripeColorRow").style.display = 
        state.appearance.sailPattern === "stripes" ? "flex" : "none";
    updateAndDraw();
});
document.getElementById("stripeColor").addEventListener("input", () => {
    state.appearance.stripeColor = document.getElementById("stripeColor").value;
    updateAndDraw();
});

// =====================================================
// BOOT
// =====================================================
initSteppers();
rebuildGunPortsUI();
rebuildMastRiggingUI();
rebuildStaysailsUI();
rebuildFlagsUI();
updateAndDraw();