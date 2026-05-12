// =====================================================
// MAST BUILDERS (square, gaff, lateen)
// =====================================================

function buildSquareMast(totalHeight, sails, weatherDeckY, hullLength, hullHeight) {
    const enabled = [];
    if (sails.course) enabled.push("course");
    if (sails.topsail) enabled.push("topsail");
    if (sails.topgallant) enabled.push("topgallant");
    if (sails.royal) enabled.push("royal");
    const sailCount = enabled.length;

    const mastTopY = weatherDeckY - totalHeight;

    // ---- Mast segments ----
    let segDefs;
    if (sailCount === 0) {
        segDefs = [
            { name: "lower",   heightFrac: 0.78, width: 12 },
            { name: "topmast", heightFrac: 0.22, width: 8  }
        ];
    } else if (sailCount === 1) {
        segDefs = [
            { name: "lower",   heightFrac: 0.85, width: 12 },
            { name: "topmast", heightFrac: 0.15, width: 9  }
        ];
    } else if (sailCount === 2) {
        segDefs = [
            { name: "lower",   heightFrac: 0.60, width: 12 },
            { name: "topmast", heightFrac: 0.30, width: 9  },
            { name: "topgallant", heightFrac: 0.10, width: 7 }
        ];
    } else if (sailCount === 3) {
        segDefs = [
            { name: "lower",   heightFrac: 0.55, width: 12 },
            { name: "topmast", heightFrac: 0.30, width: 9  },
            { name: "topgallant", heightFrac: 0.15, width: 7 }
        ];
    } else { // sailCount == 4
        segDefs = [
            { name: "lower",   heightFrac: 0.48, width: 12 },
            { name: "topmast", heightFrac: 0.27, width: 9  },
            { name: "topgallant", heightFrac: 0.17, width: 7 },
            { name: "royal",   heightFrac: 0.08, width: 5  }
        ];
    }

    const mastScale = Math.max(0.7, hullLength / 900);
    const segments = [];
    let y = weatherDeckY;
    for (const def of segDefs) {
        const h = totalHeight * def.heightFrac;
        segments.push({
            name: def.name,
            yTop: y - h,
            yBottom: y,
            width: def.width * mastScale
        });
        y -= h;
    }

    // ---- Sail dimensions and repositioning ----
    const yards = [];
    if (sailCount > 0) {
        const sailScale = (totalHeight / 600) * 0.55 + (hullLength / 1000) * 0.45;
        const sailData = enabled.map(name => {
            const wRatio = RIG_CONSTANTS.square.baseWidthRatios[name];
            const aspect = RIG_CONSTANTS.square.aspectRatios[name];
            const width = hullLength * wRatio * sailScale;
            return { name, width, height: width / aspect };
        });

        const minGap = Math.max(8, hullHeight * 0.04);
        const topClearance = Math.max(14, hullHeight * 0.06);

        const baseFootClearance = hullHeight * 0.20;
        const courseBelly = sailData[0].height * 0.10;
        const effectiveFootClearance = baseFootClearance + courseBelly;

        const totalSailHeights = sailData.reduce((sum, s) => sum + s.height, 0);
        const totalGaps = (sailCount - 1) * minGap;
        const requiredStack = totalSailHeights + totalGaps;

        const availableFromDeck = weatherDeckY - effectiveFootClearance - mastTopY - topClearance;

        let startFootY;
        let gaps;

        if (requiredStack <= availableFromDeck) {
            startFootY = weatherDeckY - effectiveFootClearance;
            const slack = availableFromDeck - requiredStack;
            const extraPerGap = sailCount > 1 ? slack / (sailCount - 1) : 0;
            gaps = sailData.map((_, i) => (i < sailCount - 1) ? minGap + extraPerGap : 0);
        } else {
            startFootY = weatherDeckY - effectiveFootClearance;
            const actualTop = startFootY - requiredStack;
            if (actualTop < mastTopY + topClearance) {
                startFootY = mastTopY + topClearance + requiredStack;
            }
            gaps = sailData.map((_, i) => (i < sailCount - 1) ? minGap : 0);
        }

        let footY = startFootY;
        for (let i = 0; i < sailData.length; i++) {
            const s = sailData[i];
            const yardY = footY - s.height;
            yards.push({
                name: s.name,
                y: yardY,
                width: s.width,
                height: s.height
            });
            if (i < sailCount - 1) {
                footY = yardY - gaps[i];
            }
        }
    }

    return { segments, yards, mastTopY };
}

// -------------------------------------------------------
function buildGaffMast(totalHeight, gaffConf, weatherDeckY, hullLength) {
    const mastTopY = weatherDeckY - totalHeight;
    const mastScale = Math.max(0.7, hullLength / 900);
    let segments;
    if (gaffConf.hasSquareTopsail) {
        const lowerH = totalHeight * 0.75;
        const topmastH = totalHeight * 0.25;
        segments = [
            { name: "lower",   yTop: weatherDeckY - lowerH, yBottom: weatherDeckY, width: 12 * mastScale },
            { name: "topmast", yTop: weatherDeckY - lowerH - topmastH, yBottom: weatherDeckY - lowerH, width: 9 * mastScale }
        ];
    } else {
        segments = [
            { name: "lower", yTop: mastTopY, yBottom: weatherDeckY, width: 12 * mastScale }
        ];
    }
    return { segments, yards: [], mastTopY };
}

// -------------------------------------------------------
function buildLateenMast(totalHeight, weatherDeckY, hullLength) {
    const mastScale = Math.max(0.7, hullLength / 900);
    const lowerH   = totalHeight * 0.55;
    const topmastH = totalHeight * 0.30;
    const topgH    = totalHeight * 0.15;
    const segments = [
        { name: "lower",      yTop: weatherDeckY - lowerH, yBottom: weatherDeckY, width: 12 * mastScale },
        { name: "topmast",    yTop: weatherDeckY - lowerH - topmastH, yBottom: weatherDeckY - lowerH, width: 9 * mastScale },
        { name: "topgallant", yTop: weatherDeckY - lowerH - topmastH - topgH, yBottom: weatherDeckY - lowerH - topmastH, width: 7 * mastScale }
    ];
    const mastTopY = weatherDeckY - totalHeight;
    return { segments, yards: [], mastTopY };
}

// =====================================================
// FULL SHIP GEOMETRY BUILDER
// =====================================================
function buildShipGeometry() {
    const preset = HULL_PRESETS[state.hullSize];

    // ---- hull length ----
    let hullLength = preset.baseLength;
    hullLength += state.hullStructures.gunDecks * 120;
    hullLength += state.armament.gunPortsLower * 5;
    if (state.hullStructures.gunDecks >= 2) {
        hullLength += state.armament.gunPortsUpper * 4;
    }
    if (state.rig.mastCount === 3) hullLength += 70;
    hullLength = Math.min(1320, hullLength);

    let bowspritLength = Math.round(hullLength * 0.22);
    if (state.bowspritType === "none") bowspritLength = 0;

    // fit canvas
    const totalProjectedWidth = hullLength + bowspritLength + 40;
    const availableWidth = CANVAS_WIDTH - SIDE_MARGIN * 2;
    const scale = Math.min(1, availableWidth / totalProjectedWidth);
    hullLength *= scale;
    bowspritLength *= scale;

    const totalCenteredWidth = hullLength + bowspritLength;
    const bowX = ((CANVAS_WIDTH - totalCenteredWidth) / 2) + bowspritLength;
    const sternX = bowX + hullLength;

    // ---- height ----
    let ratio = preset.baseRatio + state.hullStructures.gunDecks * 0.012;
    ratio = Math.min(0.15, Math.max(0.10, ratio));
    let hullHeight = hullLength * ratio;
    hullHeight = Math.max(70, Math.min(280, hullHeight));
    const keelY = KEEL_Y;
    const weatherDeckY = keelY - hullHeight;
    const waterlineY = keelY - hullHeight * 0.4;

    // deck boundaries
    const flatDeckStart = bowX + 175 * scale;
    const flatDeckEnd = sternX - 215 * scale;
    const bowFairX = flatDeckStart;
    const sternFairX = flatDeckEnd;

    // gun deck Ys
    const gunDeckYs = [];
    for (let i = 0; i < state.hullStructures.gunDecks; i++) {
        gunDeckYs.push(weatherDeckY + 38 + i * 44);
    }

    // mast positions
    const mastRatios = (() => {
        if (state.rig.mastCount === 1) return [0.48];
        if (state.rig.mastCount === 2) return [0.36, 0.65];
        return [0.26, 0.51, 0.77];
    })();
    const mastPositions = mastRatios.map(r => bowX + r * hullLength);

    // base mast height
    const baseMastHeight = hullLength * preset.mastHeightFactor;

    const mastTotals = [];
    for (let i = 0; i < mastPositions.length; i++) {
        const conf = state.masts[i];
        let sailFactor;
        if (conf.type === "square") {
            const cnt = (conf.squareSails.course?1:0) + (conf.squareSails.topsail?1:0) +
                        (conf.squareSails.topgallant?1:0) + (conf.squareSails.royal?1:0);
            if (cnt === 0) sailFactor = 0.60;
            else if (cnt === 1) sailFactor = 0.70;
            else if (cnt === 4) sailFactor = 1.15;
            else sailFactor = 1.00; // 2 or 3
        } else if (conf.type === "gaff") {
            sailFactor = (conf.gaff.hasGaff && conf.gaff.hasSquareTopsail) ? 1.00 : 0.70;
        } else { // lateen
            sailFactor = 1.00;
        }

        let posFactor = 1.0;
        if (i === 0) posFactor = 0.93;
        else if (i === 2) {
            if (conf.type === "square") posFactor = 0.82;
            else if (conf.type === "gaff") posFactor = 0.92;
            else posFactor = 0.96;
        }

        let hullMod = 1.0;
        if (state.hullSize === "veryLarge") hullMod = 1.08;
        if (state.hullSize === "small") hullMod = 0.92;

        mastTotals.push(baseMastHeight * posFactor * sailFactor * hullMod);
    }

    // ---- build mast data ----
    const mastData = [];
    for (let i = 0; i < mastPositions.length; i++) {
        const mastX = mastPositions[i];
        const totalH = mastTotals[i];
        const conf = state.masts[i];
        let builderResult;
        if (conf.type === "square") {
            builderResult = buildSquareMast(totalH, conf.squareSails, weatherDeckY, hullLength, hullHeight);
        } else if (conf.type === "gaff") {
            builderResult = buildGaffMast(totalH, conf.gaff, weatherDeckY, hullLength);
        } else {
            builderResult = buildLateenMast(totalH, weatherDeckY, hullLength);
        }
        mastData.push({
            x: mastX,
            totalHeight: totalH,
            rigType: conf.type,
            squareSails: conf.squareSails,
            gaff: conf.gaff,
            segments: builderResult.segments,
            yards: builderResult.yards,
            mastTopY: builderResult.mastTopY
        });
    }

    // bowsprit
    const bspritLen = bowspritLength;
    const bspritRootX = bowX + 12;
    const bspritRootY = weatherDeckY - 8;
    const bspritTipX = Math.max(SIDE_MARGIN * 0.4, bspritRootX - bspritLen);
    const bspritTipY = bspritRootY - Math.round(bspritLen * 0.46);

    // deck structures
    const fcH = Math.max(18, Math.round(hullHeight * 0.12));
    const forecastle = state.hullStructures.forecastle ? {
        x: bowX + 12, y: weatherDeckY - fcH,
        width: Math.min(hullLength * 0.18, flatDeckEnd - (bowX + 12) - 20),
        height: fcH
    } : null;

    const qdH = Math.max(22, Math.round(hullHeight * 0.14));
    let qdWidth = Math.min(hullLength * 0.27, flatDeckEnd - flatDeckStart - 20);
    const quarterdeck = state.hullStructures.quarterdeck ? {
        x: sternX - qdWidth - 5, y: weatherDeckY - qdH,
        width: qdWidth, height: qdH
    } : null;

    const poopDeck = (state.hullStructures.poopDeck && quarterdeck) ? {
        x: sternX - Math.round(qdWidth * 0.7) - 5,
        y: quarterdeck.y - Math.max(16, qdH * 0.7),
        width: Math.round(qdWidth * 0.7),
        height: Math.max(16, qdH * 0.7)
    } : null;

    const bowSheer = Math.min(preset.bowSheer, hullHeight * 0.12);
    const sternSheer = Math.min(preset.sternSheer, hullHeight * 0.22);

    // ===================  NEW: Stern gallery geometry  ===================
    const galleryWidth = hullLength * (state.hullSize === "small" ? 0.06 :
                                       state.hullSize === "medium" ? 0.07 : 0.08);
    const windowCount = state.hullSize === "small" ? 1 :
                        state.hullSize === "medium" ? 2 :
                        state.hullSize === "large" ? 3 : 4;

    const galleryTopY = (() => {
        if (poopDeck) return poopDeck.y + poopDeck.height + 4;
        if (quarterdeck) return quarterdeck.y + quarterdeck.height + 4;
        return weatherDeckY - hullHeight * 0.45;
    })();

    const galleryBaseY = waterlineY + hullHeight * 0.18;
    const galleryHeight = Math.max(30, galleryBaseY - galleryTopY);

    const galleryRows = (state.hullSize === "large" || state.hullSize === "veryLarge") ? 2 : 1;
    const verticalGap = galleryHeight * 0.08;
    const rowHeight = (galleryHeight - verticalGap * (galleryRows - 1)) / galleryRows;

    const windowSpacing = galleryWidth / (windowCount + 1);
    const windowWidth   = windowSpacing * 0.7;
    const windowHeight  = rowHeight * 0.55;
    // =====================================================================

    // staysails (unchanged)
    const staysailsData = [];
    const lowerTop   = (m) => m.segments[0]?.yTop;
    const topmastTop = (m) => m.segments.length > 1 ? m.segments[1].yTop : lowerTop(m) - 50;
    const lowerMastY = (m, frac) => weatherDeckY - (weatherDeckY - lowerTop(m)) * frac;

    if (mastData.length >= 2) {
        if (canHaveMainStaysail()) {
            staysailsData.push({
                type: "mainStaysail",
                tackX: mastData[0].x,       tackY: lowerMastY(mastData[0], 0.18),
                headX: mastData[1].x,       headY: lowerMastY(mastData[1], 0.60),
                clewX: mastData[1].x + 12,  clewY: lowerMastY(mastData[1], 0.14)
            });
        }
        if (canHaveMainTopmastStaysail()) {
            const mainTopmastH = lowerTop(mastData[1]) - topmastTop(mastData[1]);
            staysailsData.push({
                type: "mainTopmastStaysail",
                tackX: mastData[0].x,       tackY: lowerTop(mastData[0]) + 18,
                headX: mastData[1].x,       headY: lowerTop(mastData[1]) - mainTopmastH * 0.65,
                clewX: mastData[1].x + 12,  clewY: lowerTop(mastData[1]) + 28
            });
        }
        if (mastData.length === 3) {
            if (canHaveMizzenStaysail()) {
                staysailsData.push({
                    type: "mizzenStaysail",
                    tackX: mastData[1].x,       tackY: lowerMastY(mastData[1], 0.18),
                    headX: mastData[2].x,       headY: lowerMastY(mastData[2], 0.60),
                    clewX: mastData[2].x + 12,  clewY: lowerMastY(mastData[2], 0.14)
                });
            }
            if (canHaveMizzenTopmastStaysail()) {
                const mizzTopmastH = lowerTop(mastData[2]) - topmastTop(mastData[2]);
                staysailsData.push({
                    type: "mizzenTopmastStaysail",
                    tackX: mastData[1].x,       tackY: lowerTop(mastData[1]) + 18,
                    headX: mastData[2].x,       headY: lowerTop(mastData[2]) - mizzTopmastH * 0.65,
                    clewX: mastData[2].x + 12,  clewY: lowerTop(mastData[2]) + 28
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
        staysailsData,
        // new gallery dimensions
        galleryWidth, windowCount, galleryBaseY, galleryTopY, galleryHeight,
        windowSpacing, windowWidth, windowHeight,
        galleryRows, rowHeight
    };
}