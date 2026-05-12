// =====================================================
// MAST SEGMENT COMPUTATION (SQUARE RIG)
// =====================================================
function computeSquareMastSegments(totalHeight, sails, weatherDeckY, hullHeight, hullLength) {
    const enabled = [];
    if (sails.course) enabled.push("course");
    if (sails.topsail) enabled.push("topsail");
    if (sails.topgallant) enabled.push("topgallant");
    if (sails.royal) enabled.push("royal");

    // Bare poles fallback
    if (enabled.length === 0) {
        const mastScale = Math.max(0.7, hullLength / 900);
        const lowerH = totalHeight * 0.78;
        const topmastH = totalHeight * 0.22;
        return {
            segments: [
                { name: "lower", yTop: weatherDeckY - lowerH, yBottom: weatherDeckY, width: 12 * mastScale },
                { name: "topmast", yTop: weatherDeckY - lowerH - topmastH, yBottom: weatherDeckY - lowerH, width: 8 * mastScale }
            ],
            yards: [],
            mastTopY: weatherDeckY - lowerH - topmastH
        };
    }

    const sailScale = (totalHeight / 600) * 0.55 + (hullLength / 1000) * 0.45;
    const sailData = enabled.map(name => {
        const widthRatio = RIG_CONSTANTS.square.baseWidthRatios[name];
        const aspect = RIG_CONSTANTS.square.aspectRatios[name];
        const width = hullLength * widthRatio * sailScale;
        return { name, width, height: width / aspect };
    });

    const baseGap = Math.max(18, hullHeight * 0.12);
    let currentBottom = weatherDeckY - Math.max(28, hullHeight * 0.18);
    const yards = [];

    for (const s of sailData) {
        const y = currentBottom - s.height;
        yards.push({ name: s.name, y, width: s.width, height: s.height });
        currentBottom = y - baseGap;
    }

    const topY = yards.length ? yards[yards.length - 1].y : weatherDeckY - totalHeight * 0.55;
    const mastTopY = topY - Math.max(24, hullHeight * 0.10);
    const actualHeight = weatherDeckY - mastTopY;

    const lowerRatio = sails.royal ? 0.48 : 0.55;
    const topmastRatio = sails.royal ? 0.27 : 0.30;
    const topgRatio = sails.royal ? 0.17 : 0.15;
    const royalRatio = sails.royal ? 0.08 : 0;

    const mastScale = Math.max(0.7, hullLength / 900);
    const lowerW = 12 * mastScale;
    const topmastW = 9 * mastScale;
    const topgW = 7 * mastScale;
    const royalW = 5 * mastScale;

    let y = weatherDeckY;
    const segments = [];

    const lowerH = actualHeight * lowerRatio;
    segments.push({ name: "lower", yTop: y - lowerH, yBottom: y, width: lowerW });
    y -= lowerH;

    const topmastH = actualHeight * topmastRatio;
    segments.push({ name: "topmast", yTop: y - topmastH, yBottom: y, width: topmastW });
    y -= topmastH;

    if (sails.topgallant || sails.royal) {
        const topgH = actualHeight * topgRatio;
        segments.push({ name: "topgallant", yTop: y - topgH, yBottom: y, width: topgW });
        y -= topgH;
    }

    if (sails.royal) {
        const royalH = actualHeight * royalRatio;
        segments.push({ name: "royal", yTop: y - royalH, yBottom: y, width: royalW });
    }

    return { segments, yards, mastTopY };
}

// =====================================================
// DEFAULT MAST SEGMENTS (for non‑square rigs)
// =====================================================
function computeDefaultMastSegments(totalHeight, weatherDeckY, hullHeight) {
    let segments = [];
    let remaining = totalHeight;
    let lowerHeight = remaining * 0.55;
    let topmastHeight = remaining * 0.30;
    let topgallantHeight = remaining * 0.15;

    let y = weatherDeckY;
    segments.push({ name: "lower", yTop: y - lowerHeight, yBottom: y, width: 12 });
    y -= lowerHeight;
    segments.push({ name: "topmast", yTop: y - topmastHeight, yBottom: y, width: 9 });
    y -= topmastHeight;
    segments.push({ name: "topgallant", yTop: y - topgallantHeight, yBottom: y, width: 7 });

    return { segments, yards: [], mastTopY: segments[segments.length - 1].yTop };
}

// =====================================================
// FULL SHIP GEOMETRY BUILDER
// =====================================================
function buildShipGeometry() {
    const preset = HULL_PRESETS[state.hullSize];

    // Base length
    let hullLength = preset.baseLength;
    hullLength += state.hullStructures.gunDecks * 120;
    hullLength += state.armament.gunPortsLower * 5;
    if (state.hullStructures.gunDecks >= 2) {
        hullLength += state.armament.gunPortsUpper * 4;
    }
    if (state.rig.mastCount === 3) hullLength += 70;
    hullLength = Math.min(1320, hullLength);

    // Bowsprit
    let bowspritLength = Math.round(hullLength * 0.22);
    if (state.bowspritType === "none") bowspritLength = 0;

    // Auto scale to fit canvas
    const totalProjectedWidth = hullLength + bowspritLength + 40;
    const availableWidth = CANVAS_WIDTH - SIDE_MARGIN * 2;
    const scale = Math.min(1, availableWidth / totalProjectedWidth);
    hullLength *= scale;
    bowspritLength *= scale;

    const totalCenteredWidth = hullLength + bowspritLength;
    const bowX = ((CANVAS_WIDTH - totalCenteredWidth) / 2) + bowspritLength;
    const sternX = bowX + hullLength;

    // Height
    let ratio = preset.baseRatio + state.hullStructures.gunDecks * 0.012;
    ratio = Math.min(0.15, Math.max(0.10, ratio));
    let hullHeight = hullLength * ratio;
    hullHeight = Math.max(70, Math.min(280, hullHeight));
    const keelY = KEEL_Y;
    const weatherDeckY = keelY - hullHeight;
    const waterlineY = keelY - hullHeight * 0.4;

    // Flat deck boundaries
    const flatDeckStart = bowX + 175 * scale;
    const flatDeckEnd = sternX - 215 * scale;
    const bowFairX = flatDeckStart;
    const sternFairX = flatDeckEnd;

    // Gun deck Y positions
    const gunDeckYs = [];
    for (let i = 0; i < state.hullStructures.gunDecks; i++) {
        gunDeckYs.push(weatherDeckY + 38 + i * 44);
    }

    // Mast positions
    const mastRatios = (() => {
        if (state.rig.mastCount === 1) return [0.48];
        if (state.rig.mastCount === 2) return [0.36, 0.65];
        return [0.26, 0.51, 0.77];
    })();
    const mastPositions = mastRatios.map(r => bowX + r * hullLength);

    // Mast heights
    const baseMainHeight = hullLength * preset.mastHeightFactor;
    const mastTotals = [];
    for (let i = 0; i < mastPositions.length; i++) {
        const conf = state.masts[i];
        const rigPower = computeRigPower(conf);
        let totalH = baseMainHeight * (0.42 + rigPower * 0.33);
        if (i === 0) totalH *= 0.93;
        if (i === 2) {
            if (conf.type === "square") totalH *= 0.82;
            else if (conf.type === "gaff") totalH *= 0.92;
            else if (conf.type === "lateen") totalH *= 0.96;
        }
        if (state.hullSize === "veryLarge") totalH *= 1.08;
        if (state.hullSize === "small") totalH *= 0.92;
        mastTotals.push(totalH);
    }

    // Build mast data
    const mastData = [];
    for (let i = 0; i < mastPositions.length; i++) {
        const mastX = mastPositions[i];
        const conf = state.masts[i];
        const totalH = mastTotals[i];
        let segs;
        if (conf.type === "square") {
            segs = computeSquareMastSegments(totalH, conf.squareSails, weatherDeckY, hullHeight, hullLength);
        } else {
            segs = computeDefaultMastSegments(totalH, weatherDeckY, hullHeight);
        }
        mastData.push({
            x: mastX,
            totalHeight: totalH,
            rigType: conf.type,
            squareSails: conf.squareSails,
            gaff: conf.gaff,
            segments: segs.segments,
            yards: segs.yards,
            mastTopY: segs.mastTopY
        });
    }

    // Bowsprit geometry
    const bspritLen = bowspritLength;
    const bspritRootX = bowX + 12;
    const bspritRootY = weatherDeckY - 8;
    const bspritTipX = Math.max(SIDE_MARGIN * 0.4, bspritRootX - bspritLen);
    const bspritTipY = bspritRootY - Math.round(bspritLen * 0.46);

    // Deck structures
    const fcH = Math.max(18, Math.round(hullHeight * 0.12));
    const forecastle = state.hullStructures.forecastle ? {
        x: bowX + 12,
        y: weatherDeckY - fcH,
        width: Math.min(hullLength * 0.18, flatDeckEnd - (bowX + 12) - 20),
        height: fcH
    } : null;

    const qdH = Math.max(22, Math.round(hullHeight * 0.14));
    let qdWidth = Math.min(hullLength * 0.27, flatDeckEnd - flatDeckStart - 20);
    const quarterdeck = state.hullStructures.quarterdeck ? {
        x: sternX - qdWidth - 5,
        y: weatherDeckY - qdH,
        width: qdWidth,
        height: qdH
    } : null;

    const poopDeck = (state.hullStructures.poopDeck && quarterdeck) ? {
        x: sternX - Math.round(qdWidth * 0.7) - 5,
        y: quarterdeck.y - Math.max(16, qdH * 0.7),
        width: Math.round(qdWidth * 0.7),
        height: Math.max(16, qdH * 0.7)
    } : null;

    const bowSheer = Math.min(preset.bowSheer, hullHeight * 0.12);
    const sternSheer = Math.min(preset.sternSheer, hullHeight * 0.22);

    // ----- Staysail geometry -----
    const staysailsData = [];

    // Helpers that rely on mastData being fully built
    const lowerTop = (m) => m.segments[0]?.yTop;
    const topmastTop = (m) => m.segments.length > 1 ? m.segments[1].yTop : lowerTop(m) - 50;

    if (mastData.length >= 2) {
        // Main staysail: foot at foremast base, head at main lower hounds
        if (canHaveMainStaysail()) {
            staysailsData.push({
                type: "mainStaysail",
                footX: mastData[0].x,
                footY: weatherDeckY,
                headX: mastData[1].x,
                headY: lowerTop(mastData[1]),
                depth: (lowerTop(mastData[1]) - weatherDeckY) * 0.25
            });
        }

        // Main topmast staysail: foot at fore lower hounds, head at main topmast head
        if (canHaveMainTopmastStaysail()) {
            staysailsData.push({
                type: "mainTopmastStaysail",
                footX: mastData[0].x,
                footY: lowerTop(mastData[0]),
                headX: mastData[1].x,
                headY: topmastTop(mastData[1]),
                depth: (topmastTop(mastData[1]) - lowerTop(mastData[0])) * 0.25
            });
        }

        if (mastData.length === 3) {
            // Mizzen staysail: foot at mainmast base, head at mizzen lower hounds
            if (canHaveMizzenStaysail()) {
                staysailsData.push({
                    type: "mizzenStaysail",
                    footX: mastData[1].x,
                    footY: weatherDeckY,
                    headX: mastData[2].x,
                    headY: lowerTop(mastData[2]),
                    depth: (lowerTop(mastData[2]) - weatherDeckY) * 0.25
                });
            }

            // Mizzen topmast staysail: foot at main lower hounds, head at mizzen topmast head
            if (canHaveMizzenTopmastStaysail()) {
                staysailsData.push({
                    type: "mizzenTopmastStaysail",
                    footX: mastData[1].x,
                    footY: lowerTop(mastData[1]),
                    headX: mastData[2].x,
                    headY: topmastTop(mastData[2]),
                    depth: (topmastTop(mastData[2]) - lowerTop(mastData[1])) * 0.25
                });
            }
        }
    }

    return {
        bowX, sternX, keelY, waterlineY, weatherDeckY,
        hullLength, hullHeight,
        bowFairX, sternFairX, flatDeckStart, flatDeckEnd,
        bowSheer, sternSheer, gunDeckYs,
        mastData,
        forecastle, quarterdeck, poopDeck,
        bspritRootX, bspritRootY, bspritTipX, bspritTipY,
        staysailsData
    };
}