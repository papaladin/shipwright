// =====================================================
// SVG LAYER MANAGEMENT
// =====================================================
function clearSVG() {
    const svg = document.getElementById("shipSvg");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function addLayer(id) {
    const g = el("g", { id });
    document.getElementById("shipSvg").appendChild(g);
    return g;
}

function getDefs() {
    const svg = document.getElementById("shipSvg");
    let d = svg.querySelector("defs");
    if (!d) {
        d = document.createElementNS(svgNS, "defs");
        svg.insertBefore(d, svg.firstChild);
    }
    return d;
}

// -------------------------------------------------------
// Tiny colour helpers (only used for shading)
// -------------------------------------------------------
function lighten(hex, amount) {
    const clamp = n => Math.max(0, Math.min(255, n));
    const r = clamp(parseInt(hex.slice(1, 3), 16) + amount);
    const g = clamp(parseInt(hex.slice(3, 5), 16) + amount);
    const b = clamp(parseInt(hex.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Copper sheathing colour (below waterline)
const COPPER_COLOR = "#b87333";

// =====================================================
// SAIL PATH HELPERS (shared between rig types)
// =====================================================
function curvedSailPath(mastX, yardY, sailWidth, sailHeight, tilt = 0) {
    const hw = sailWidth / 2;
    const leftX   = mastX - hw;
    const rightX  = mastX + hw;
    const bottomY = yardY + sailHeight;

    const topLeftY    = yardY - tilt;
    const topRightY   = yardY + tilt;
    const bottomLeftY = bottomY - tilt;
    const bottomRightY = bottomY + tilt;

    const topMidY   = (topLeftY + topRightY) / 2;
    const topBelly  = sailHeight * -0.05;
    const topCtrlY  = topMidY + topBelly;

    const bottomMidY   = (bottomLeftY + bottomRightY) / 2;
    const bottomBelly  = sailHeight * 0.10;
    const bottomCtrlY  = bottomMidY + bottomBelly;

    return `M ${leftX},${topLeftY} ` +
           `Q ${mastX},${topCtrlY} ${rightX},${topRightY} ` +
           `L ${rightX},${bottomRightY} ` +
           `Q ${mastX},${bottomCtrlY} ${leftX},${bottomLeftY} ` +
           `Z`;
}

function curvedLateenPath(yardBotX, yardBotY, yardTopX, yardTopY, tackX, tackY) {
    const dx = yardTopX - yardBotX;
    const dy = yardTopY - yardBotY;
    const yardLen = Math.hypot(dx, dy);
    const nx = -dy / yardLen;
    const ny =  dx / yardLen;
    const points = [];
    const samples = 11;
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const px = yardBotX + dx * t;
        const py = yardBotY + dy * t;
        const belly = Math.sin(t * Math.PI) * (28 + t * 46);
        points.push([px + nx * belly, py + ny * belly]);
    }
    let d = `M ${yardBotX} ${yardBotY}`;
    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i][0]} ${points[i][1]}`;
    }
    d += ` L ${tackX} ${tackY} Z`;
    return d;
}

function drawTriangularSail(tackX, tackY, headX, headY, clewX, clewY, sailColor) {
    const luffLen  = Math.hypot(headX - tackX, headY - tackY);
    const luffMidX = (tackX + headX) / 2;
    const luffMidY = (tackY + headY) / 2;
    const luffCtrlX = luffMidX - luffLen * 0.04;
    const luffCtrlY = luffMidY;

    const leechLen  = Math.hypot(clewX - headX, clewY - headY);
    const leechMidX = (headX + clewX) / 2;
    const leechMidY = (headY + clewY) / 2;
    const leechCtrlX = leechMidX + leechLen * 0.10;
    const leechCtrlY = leechMidY;

    const footLen  = Math.hypot(tackX - clewX, tackY - clewY);
    const footMidX = (clewX + tackX) / 2;
    const footMidY = (clewY + tackY) / 2;
    const footCtrlX = footMidX;
    const footCtrlY = footMidY + footLen * 0.20;

    const d = `M ${tackX},${tackY} ` +
              `Q ${luffCtrlX},${luffCtrlY} ${headX},${headY} ` +
              `Q ${leechCtrlX},${leechCtrlY} ${clewX},${clewY} ` +
              `Q ${footCtrlX},${footCtrlY} ${tackX},${tackY} Z`;

    onto("sailLayer", el("path", {
        d,
        fill: sailColor,
        stroke: "#b18753",
        "stroke-width": "1.8"
    }));

    function quadPt(ax, ay, cx, cy, bx, by, t) {
        const u = 1 - t;
        return { x: u*u*ax + 2*u*t*cx + t*t*bx,
                 y: u*u*ay + 2*u*t*cy + t*t*by };
    }
    for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        const lp = quadPt(tackX, tackY, luffCtrlX, luffCtrlY, headX, headY, 1 - t);
        const rp = quadPt(headX, headY, leechCtrlX, leechCtrlY, clewX, clewY, t);
        const mx = (lp.x + rp.x) / 2 + 4;
        const my = (lp.y + rp.y) / 2 + 5;
        onto("sailLayer", el("path", {
            d: `M ${lp.x},${lp.y} Q ${mx},${my} ${rp.x},${rp.y}`,
            fill: "none",
            stroke: "#c8a87a",
            "stroke-width": "0.8",
            opacity: "0.45"
        }));
    }
}

// =====================================================
// STANDING RIGGING (stays, shrouds, ratlines, backstays)
// =====================================================
function drawStandingRigging(geo) {
    const { mastData, weatherDeckY, hullLength, bspritTipX, bspritTipY, sternX } = geo;
    const lowerShroudCount = 4;
    const topmastShroudCount = 3;
    const stayStroke = "#5a3e2b";
    const shroudStroke = "#6b5a42";
    const ratlineStroke = "#5a4a3a";
    const backstayStroke = "#6b5a42";

    function segmentTop(mast, name) {
        const seg = mast.segments.find(s => s.name === name);
        return seg ? seg.yTop : null;
    }

    const mastHeads = mastData.map(mast => {
        let headY = segmentTop(mast, "lower");
        if (segmentTop(mast, "topgallant") !== null) {
            headY = segmentTop(mast, "topgallant");
        } else if (segmentTop(mast, "topmast") !== null) {
            headY = segmentTop(mast, "topmast");
        }
        return { y: headY };
    });

    // ----- STAYS -----
    if (mastData.length >= 1) {
        onto("riggingLayer", el("line", {
            x1: bspritTipX, y1: bspritTipY,
            x2: mastData[0].x, y2: mastHeads[0].y,
            stroke: stayStroke, "stroke-width": "2.5", opacity: "0.9"
        }));
    }
    if (mastData.length >= 2) {
        onto("riggingLayer", el("line", {
            x1: mastData[0].x, y1: mastHeads[0].y,
            x2: mastData[1].x, y2: mastHeads[1].y,
            stroke: stayStroke, "stroke-width": "2.5", opacity: "0.9"
        }));
    }
    if (mastData.length >= 3) {
        onto("riggingLayer", el("line", {
            x1: mastData[1].x, y1: mastHeads[1].y,
            x2: mastData[2].x, y2: mastHeads[2].y,
            stroke: stayStroke, "stroke-width": "2.5", opacity: "0.9"
        }));
    }

    // ----- SHROUDS AND RATLINES -----
    for (let i = 0; i < mastData.length; i++) {
        const mast = mastData[i];
        const xMast = mast.x;
        const lowerHeadY = segmentTop(mast, "lower");
        const topmastHeadY = segmentTop(mast, "topmast");

        const lowerBaseY = weatherDeckY + 8;
        const lowerSpread = hullLength * LOWER_SHROUD_SPREAD_RATIO;
        for (let s = 0; s < lowerShroudCount; s++) {
            const t = s / (lowerShroudCount - 1);
            const lx = xMast - lowerSpread * (0.5 + t * 0.7);
            const rx = xMast + lowerSpread * (0.5 + t * 0.7);
            onto("riggingLayer", el("line", {
                x1: lx, y1: lowerBaseY, x2: xMast, y2: lowerHeadY,
                stroke: shroudStroke, "stroke-width": "1.6", opacity: "0.8"
            }));
            onto("riggingLayer", el("line", {
                x1: rx, y1: lowerBaseY, x2: xMast, y2: lowerHeadY,
                stroke: shroudStroke, "stroke-width": "1.6", opacity: "0.8"
            }));
        }

        if (topmastHeadY !== null) {
            const platformHalfWidth = hullLength * PLATFORM_HALF_WIDTH_RATIO;
            const platformY = lowerHeadY;
            onto("riggingLayer", el("line", {
                x1: xMast - platformHalfWidth, y1: platformY,
                x2: xMast + platformHalfWidth, y2: platformY,
                stroke: "#4a3a2a", "stroke-width": "3", opacity: "0.9"
            }));
            onto("riggingLayer", el("line", { x1: xMast - platformHalfWidth, y1: platformY-4, x2: xMast - platformHalfWidth, y2: platformY+4, stroke: "#4a3a2a", "stroke-width": "2", opacity: "0.8" }));
            onto("riggingLayer", el("line", { x1: xMast + platformHalfWidth, y1: platformY-4, x2: xMast + platformHalfWidth, y2: platformY+4, stroke: "#4a3a2a", "stroke-width": "2", opacity: "0.8" }));
        }

        const lowerLeftOuter  = xMast - lowerSpread * 1.2;
        const lowerRightOuter = xMast + lowerSpread * 1.2;
        for (let yy = lowerBaseY + 10; yy < lowerHeadY - 6; yy += RATLINE_SPACING) {
            const t = (yy - lowerBaseY) / (lowerHeadY - lowerBaseY);
            const lx = lowerLeftOuter + (xMast - lowerLeftOuter) * t;
            const rx = lowerRightOuter + (xMast - lowerRightOuter) * t;
            onto("riggingLayer", el("line", {
                x1: lx, y1: yy, x2: rx, y2: yy,
                stroke: ratlineStroke, "stroke-width": "1.2", opacity: "0.7"
            }));
        }

        if (topmastHeadY !== null && topmastHeadY !== lowerHeadY) {
            const topBaseY = lowerHeadY;
            const topSpread = hullLength * TOPMAST_SHROUD_SPREAD_RATIO;
            for (let s = 0; s < topmastShroudCount; s++) {
                const t = s / (topmastShroudCount - 1);
                const lx = xMast - topSpread * (0.5 + t * 0.8);
                const rx = xMast + topSpread * (0.5 + t * 0.8);
                onto("riggingLayer", el("line", {
                    x1: lx, y1: topBaseY, x2: xMast, y2: topmastHeadY,
                    stroke: shroudStroke, "stroke-width": "1.4", opacity: "0.8"
                }));
                onto("riggingLayer", el("line", {
                    x1: rx, y1: topBaseY, x2: xMast, y2: topmastHeadY,
                    stroke: shroudStroke, "stroke-width": "1.4", opacity: "0.8"
                }));
            }

            const topLeftOuter  = xMast - topSpread * 1.3;
            const topRightOuter = xMast + topSpread * 1.3;
            for (let yy = topBaseY + 8; yy < topmastHeadY - 6; yy += RATLINE_SPACING) {
                const t = (yy - topBaseY) / (topmastHeadY - topBaseY);
                const lx = topLeftOuter + (xMast - topLeftOuter) * t;
                const rx = topRightOuter + (xMast - topRightOuter) * t;
                onto("riggingLayer", el("line", {
                    x1: lx, y1: yy, x2: rx, y2: yy,
                    stroke: ratlineStroke, "stroke-width": "1.2", opacity: "0.7"
                }));
            }
        }

        const backstayHeadY = mastHeads[i].y;
        const offset = BACKSTAY_OFFSETS[i] || 100;
        const sternXPoint = sternX - offset;
        onto("riggingLayer", el("line", {
            x1: xMast, y1: backstayHeadY,
            x2: sternXPoint, y2: weatherDeckY - 10,
            stroke: backstayStroke, "stroke-width": "1.6", opacity: "0.7"
        }));
    }
}

// =====================================================
// DRAWING FUNCTIONS
// =====================================================
function drawWater(geo) {
    const { waterlineY } = geo;
    onto("waterLayer", el("rect", {
        x: 0, y: waterlineY,
        width: CANVAS_WIDTH, height: CANVAS_HEIGHT - waterlineY,
        fill: "#4a8faa", opacity: "0.35"
    }));
    for (let i = 0; i < 2; i++) {
        const off = i * 8;
        onto("waterLayer", el("path", {
            d: `M 30,${waterlineY+off} Q 380,${waterlineY-3+off} 760,${waterlineY+5+off} T 1480,${waterlineY+off}`,
            stroke: "#5d9bb3", "stroke-width": i === 0 ? "3" : "2",
            fill: "none", opacity: i === 0 ? 0.8 : 0.55
        }));
    }
    onto("waterLayer", el("path", {
        d: `M ${geo.bowX+80},${waterlineY-1} Q ${(geo.bowX+geo.sternX)/2},${waterlineY-3} ${geo.sternX-80},${waterlineY-1}`,
        stroke: "#c2e0f0", "stroke-width": "2", fill: "none", opacity: "0.7"
    }));
}

function buildHullPath(geo) {
    const { bowX, sternX, weatherDeckY, keelY, bowSheer, sternSheer, hullLength } = geo;
    const tumblehome = hullLength * 0.04;
    const sternRiseCtrl = weatherDeckY - sternSheer * 1.2 - 5;
    const bowRiseCtrl = weatherDeckY - bowSheer * 1.1 - 5;
    const bowTipY = weatherDeckY - bowSheer + 15;
    return `M ${sternX},${weatherDeckY} ` +
        `Q ${sternX - hullLength * 0.15},${sternRiseCtrl} ${sternX - hullLength * 0.25},${weatherDeckY} ` +
        `L ${bowX + hullLength * 0.25 + tumblehome},${weatherDeckY} ` +
        `Q ${bowX + hullLength * 0.15},${bowRiseCtrl} ${bowX},${bowTipY} ` +
        `Q ${bowX + 10},${keelY + 15} ${bowX + hullLength * 0.25},${keelY + 30} ` +
        `Q ${sternX - hullLength * 0.25},${keelY + 30} ${sternX - 10},${keelY + 15} ` +
        `Q ${sternX},${keelY + 5} ${sternX},${weatherDeckY} Z`;
}

function drawHull(geo) {
    const hullColor = state.appearance.hullColor;
    const hullPath = buildHullPath(geo);

    // ---- 1. Copper bottom (full hull below waterline will be covered later) ----
    onto("hullLayer", el("path", {
        d: hullPath,
        fill: COPPER_COLOR,
        stroke: "none"
    }));

    // ---- 2. Clip for the upper hull (above waterline) ----
    const aboveWaterId = "aboveWaterClip";
    let aboveClip = document.getElementById(aboveWaterId);
    if (!aboveClip) {
        aboveClip = el("clipPath", { id: aboveWaterId });
        aboveClip.appendChild(el("rect", {
            x: 0, y: 0,
            width: CANVAS_WIDTH, height: geo.waterlineY
        }));
        getDefs().appendChild(aboveClip);
    }
    onto("hullLayer", el("path", {
        d: hullPath,
        fill: hullColor,
        stroke: "none",
        "clip-path": `url(#${aboveWaterId})`
    }));

    // ---- 3. Hull interior details (planks, wales, shading) ----
    const clipId = "hullClip";
    let hullClip = document.getElementById(clipId);
    if (!hullClip) {
        hullClip = el("clipPath", { id: clipId });
        hullClip.appendChild(el("path", { d: hullPath }));
        getDefs().appendChild(hullClip);
    }

    const interiorGrp = el("g", { "clip-path": `url(#${clipId})` });

    // a) Plank lines (enhanced)
    const plankClr = darken(hullColor, 22);
    const plankLight = lighten(hullColor, 20);
    for (let py = geo.weatherDeckY + 16; py < geo.keelY + 32; py += 20) {
        // dark seam
        interiorGrp.appendChild(el("line", {
            x1: 0, y1: py, x2: 1500, y2: py,
            stroke: plankClr, "stroke-width": "1.2", opacity: "0.5"
        }));
        // light bevel just below
        interiorGrp.appendChild(el("line", {
            x1: 0, y1: py + 1.5, x2: 1500, y2: py + 1.5,
            stroke: plankLight, "stroke-width": "0.8", opacity: "0.35"
        }));
    }

    // b) Wales (reinforcing bands)
    const freeboard = geo.weatherDeckY - geo.waterlineY;
    const waleYs = [
        geo.weatherDeckY - freeboard * 0.22,
        geo.weatherDeckY - freeboard * 0.52,
        geo.weatherDeckY - freeboard * 0.78
    ];
    const waleColor = darken(hullColor, 35);
    waleYs.forEach(wy => {
        interiorGrp.appendChild(el("line", {
            x1: 0, y1: wy, x2: 1500, y2: wy,
            stroke: waleColor, "stroke-width": "4.5", opacity: "0.85"
        }));
        // thin highlight above each wale
        interiorGrp.appendChild(el("line", {
            x1: 0, y1: wy - 2, x2: 1500, y2: wy - 2,
            stroke: lighten(hullColor, 5), "stroke-width": "1", opacity: "0.5"
        }));
    });

    // c) 3D shading (vertical gradient)
    const shadeId = "hullShadeGrad";
    let shadeGrad = document.getElementById(shadeId);
    if (!shadeGrad) {
        shadeGrad = el("linearGradient", { id: shadeId, gradientTransform: "rotate(90)" });
        // top of hull (deck) lighter, bottom (keel) darker
        shadeGrad.appendChild(el("stop", { offset: "0%", "stop-color": lighten(hullColor, 40) }));
        shadeGrad.appendChild(el("stop", { offset: "100%", "stop-color": darken(hullColor, 30) }));
        getDefs().appendChild(shadeGrad);
    }
    interiorGrp.appendChild(el("rect", {
        x: 0, y: geo.weatherDeckY,
        width: CANVAS_WIDTH, height: geo.keelY - geo.weatherDeckY + 5,
        fill: `url(#${shadeId})`,
        opacity: "0.25"
    }));

    onto("hullLayer", interiorGrp);

    // ---- 4. Hull outline (clean edge) ----
    onto("hullLayer", el("path", {
        d: hullPath,
        fill: "none",
        stroke: "#3d2510",
        "stroke-width": "3.5"
    }));

    // ---- 5. Deck-level dark strip (unchanged) ----
    onto("hullLayer", el("rect", {
        x: geo.bowFairX - 8,
        y: geo.weatherDeckY,
        width: geo.sternFairX - geo.bowFairX + 18,
        height: 10,
        fill: darken(hullColor, 28),
        opacity: "0.55"
    }));
}

function drawRaisedDeck(layerId, x, y, w, h, hullClr, deckClr, railingPosts = true) {
    onto(layerId, el("rect", { x, y, width: w, height: h, fill: darken(hullClr, 14), stroke: "#3d2510", "stroke-width": "2" }));
    onto(layerId, el("line", { x1: x+6, y1: y+5, x2: x+w-6, y2: y+5, stroke: deckClr, "stroke-width": "2.5" }));
    if (railingPosts) {
        for (let px = x+10; px < x+w-6; px += 18) {
            onto(layerId, el("line", { x1: px, y1: y+2, x2: px, y2: y-5, stroke: "#5a3e2b", "stroke-width": "1.5" }));
        }
        onto(layerId, el("line", { x1: x+5, y1: y-3, x2: x+w-5, y2: y-3, stroke: "#5a3e2b", "stroke-width": "2" }));
    }
}

function drawDeckStructures(geo) {
    const deckClr = state.appearance.deckColor;
    const hullClr = state.appearance.hullColor;
    const { weatherDeckY, forecastle, quarterdeck, poopDeck, bowFairX, sternFairX, gunDeckYs } = geo;
    for (const dy of gunDeckYs) {
        onto("deckLayer", el("line", {
            x1: bowFairX+18, y1: dy, x2: sternFairX-18, y2: dy,
            stroke: deckClr, "stroke-width": "2.5", "stroke-dasharray": "10 4", opacity: "0.85"
        }));
        for (let tx = bowFairX+30; tx < sternFairX-18; tx += 60) {
            onto("deckLayer", el("line", { x1: tx, y1: dy-4, x2: tx, y2: dy+4, stroke: deckClr, "stroke-width": "1.5", opacity: "0.55" }));
        }
    }
    onto("deckLayer", el("line", { x1: bowFairX-14, y1: weatherDeckY, x2: sternFairX+12, y2: weatherDeckY, stroke: deckClr, "stroke-width": "3.5" }));
    if (forecastle) drawRaisedDeck("deckLayer", forecastle.x, forecastle.y, forecastle.width, forecastle.height, hullClr, deckClr);
    if (quarterdeck) drawRaisedDeck("deckLayer", quarterdeck.x, quarterdeck.y, quarterdeck.width, quarterdeck.height, hullClr, deckClr);
    if (poopDeck) drawRaisedDeck("deckLayer", poopDeck.x, poopDeck.y, poopDeck.width, poopDeck.height, hullClr, deckClr, false);
}

function drawGunPorts(geo) {
    const { gunDeckYs, bowFairX, sternFairX } = geo;
    const lidColor      = state.appearance.gunPortColor;   // user‑selected lid colour
    const frameColor    = "#2a1a0c";                       // dark frame
    const highlightColor = lighten(lidColor, 25);          // top bevel

    for (let d = 0; d < state.hullStructures.gunDecks; d++) {
        const dy = gunDeckYs[d];
        const pCnt = d === 0 ? state.armament.gunPortsLower
                    : d === 1 ? state.armament.gunPortsUpper : 0;
        if (pCnt <= 0) continue;

        const startX = bowFairX + 22;
        const endX   = sternFairX - 30;
        const step   = (endX - startX) / Math.max(1, pCnt - 1);

        for (let i = 0; i < pCnt; i++) {
            const px = startX + i * step;

            // 1. Outer frame (dark, slightly larger)
            onto("armamentLayer", el("rect", {
                x: px - 10, y: dy - 9,
                width: 20, height: 16,
                fill: frameColor,
                stroke: "#0d0a06",
                "stroke-width": "1",
                rx: "2"
            }));

            // 2. Lid (user colour, covers the inner area)
            onto("armamentLayer", el("rect", {
                x: px - 8, y: dy - 7,
                width: 16, height: 12,
                fill: lidColor,
                stroke: frameColor,
                "stroke-width": "1",
                rx: "1"
            }));

            // 3. Top bevel highlight (thin light line along the upper edge of the lid)
            onto("armamentLayer", el("line", {
                x1: px - 7, y1: dy - 6.5,
                x2: px + 7, y2: dy - 6.5,
                stroke: highlightColor,
                "stroke-width": "1.2",
                opacity: "0.9"
            }));

            // 4. Subtle shadow below the frame (gives depth)
            onto("armamentLayer", el("rect", {
                x: px - 10, y: dy - 3,
                width: 20, height: 6,
                fill: "#050302",
                opacity: "0.35",
                rx: "1"
            }));
        }
    }
}

function drawCabinsAndGallery(geo) {
    const { sternX, weatherDeckY, sternSheer, quarterdeck, hullSize } = geo;
    if (state.hullStructures.sternGallery) {
        const galY = weatherDeckY - sternSheer + 12;
        const left = sternX - 94;
        onto("detailLayer", el("line", { x1: left, y1: galY+24, x2: sternX-6, y2: galY+24, stroke: "#5a3e2b", "stroke-width": "3" }));
        for (let i = 0; i < 3; i++) {
            onto("detailLayer", el("rect", { x: left + 6 + i*28, y: galY+2, width: 16, height: 20, fill: "#F8DD9A", stroke: "#8b6942", "stroke-width": "1.5", rx: "2" }));
        }
        if (quarterdeck && hullSize !== "small") {
            const gy2 = quarterdeck.y + 8;
            for (let i = 0; i < 2; i++) {
                onto("detailLayer", el("rect", { x: left+14 + i*30, y: gy2, width: 14, height: 16, fill: "#F0D08A", stroke: "#8b6942", "stroke-width": "1.5", rx: "2" }));
            }
        }
    }
    if (state.hullStructures.hullWindows) {
        const winY = weatherDeckY + 22;
        const wStart = geo.bowFairX + 30;
        const wEnd = geo.sternFairX - 55;
        const cnt = Math.min(6, Math.max(2, Math.floor((wEnd-wStart)/80)));
        const step = (wEnd - wStart) / Math.max(1, cnt-1);
        for (let i = 0; i < cnt; i++) {
            onto("detailLayer", el("rect", { x: wStart + i*step - 7, y: winY, width: 14, height: 16, fill: "#D4B483", stroke: "#5a3e2b", "stroke-width": "1.5", rx: "2" }));
        }
    }
}

function drawMastsAndSails(geo) {
    const { mastData, weatherDeckY, keelY, bspritRootX, bspritRootY, bspritTipX, bspritTipY, staysailsData } = geo;
    const sailColor = state.appearance.sailColor;
    const mastBotY = keelY - 22;

    // Bowsprit
    if (state.bowspritType !== "none") {
        onto("mastLayer", el("line", { x1: bspritRootX, y1: bspritRootY, x2: bspritTipX, y2: bspritTipY, stroke: "#6f4a2c", "stroke-width": "10" }));
        onto("riggingLayer", el("line", { x1: bspritTipX, y1: bspritTipY, x2: bspritRootX+5, y2: weatherDeckY+18, stroke: "#7a6a52", "stroke-width": "1.5", opacity: "0.8" }));
    }

    const foreTopY = mastData[0]?.mastTopY ?? weatherDeckY - 220;
    const foreTopX = mastData[0]?.x ?? (bspritRootX + 100);
    const bspritSpan  = foreTopX - bspritRootX;
    const jibClewX    = bspritRootX + bspritSpan * 0.38;
    const jibClewY    = weatherDeckY - 75;

    if (state.bowspritType === "jib") {
        drawTriangularSail(
            bspritTipX, bspritTipY,
            foreTopX - 12, foreTopY + 28,
            jibClewX, jibClewY,
            sailColor
        );
    } else if (state.bowspritType === "twoJibs") {
        drawTriangularSail(
            bspritTipX, bspritTipY,
            foreTopX - 12, foreTopY + 28,
            jibClewX, jibClewY,
            sailColor
        );
        const mx = Math.round((bspritTipX + bspritRootX) / 2);
        const my = Math.round((bspritTipY + bspritRootY) / 2);
        const foreLowerTopY = mastData[0]?.segments[0]?.yTop ?? (foreTopY + 200);
        const innerClewX = bspritRootX + bspritSpan * 0.52;
        const innerClewY = weatherDeckY - 90;
        drawTriangularSail(
            mx, my,
            foreTopX, foreLowerTopY + 25,
            innerClewX, innerClewY,
            sailColor
        );
    } else if (state.bowspritType === "squareSpritsail") {
        const sx = Math.round(bspritRootX + (bspritTipX-bspritRootX)*0.65);
        const sy = Math.round(bspritRootY + (bspritTipY-bspritRootY)*0.65);
        const spritW = 100, spritH = 85;
        const tilt = spritH * 0.15;
        const hw = spritW / 2;
        const leftX = sx - hw;
        const rightX = sx + hw;
        const topLeftY = sy - tilt;
        const topRightY = sy + tilt;

        onto("riggingLayer", el("line", {
            x1: leftX - 10, y1: topLeftY,
            x2: rightX + 10, y2: topRightY,
            stroke: "#7a5330", "stroke-width": "4"
        }));
        onto("sailLayer", el("path", {
            d: curvedSailPath(sx, sy, spritW, spritH, tilt),
            fill: sailColor,
            stroke: "#b18753",
            "stroke-width": "1.5"
        }));
    }

    // Masts
    for (let idx = 0; idx < mastData.length; idx++) {
        const mast = mastData[idx];
        const mastX = mast.x;
        const rigType = mast.rigType;

        for (const seg of mast.segments) {
            onto("mastLayer", el("line", { x1: mastX, y1: seg.yBottom, x2: mastX, y2: seg.yTop, stroke: "#6b4a28", "stroke-width": seg.width, "stroke-linecap": "round" }));
        }
        onto("mastLayer", el("line", { x1: mastX, y1: weatherDeckY, x2: mastX, y2: mastBotY, stroke: "#5e3e1c", "stroke-width": "13" }));

        if (rigType === "square") {
            for (const yard of mast.yards) {
                const tilt = yard.height * 0.08;
                const hw = yard.width / 2;
                const leftX = mastX - hw;
                const rightX = mastX + hw;
                const topLeftY = yard.y - tilt;
                const topRightY = yard.y + tilt;

                onto("riggingLayer", el("line", {
                    x1: leftX - 14, y1: topLeftY,
                    x2: rightX + 14, y2: topRightY,
                    stroke: "#7a5330", "stroke-width": "5"
                }));
                onto("sailLayer", el("path", {
                    d: curvedSailPath(mastX, yard.y, yard.width, yard.height, tilt),
                    fill: sailColor,
                    stroke: "#b8915e",
                    "stroke-width": "1.5"
                }));
            }
        } else if (rigType === "gaff") {
            const mastH = mast.totalHeight;
            const lowerTop = mast.segments.find(s => s.name === "lower")?.yTop || (weatherDeckY - mastH*0.55);
            if (state.masts[idx].gaff.hasGaff) {
                const throatY    = lowerTop + 12;
                const boomY      = weatherDeckY - mastH * 0.22;
                const boomLength = Math.min(geo.hullLength * 0.22, mastH * 0.72);
                const boomEndX   = mastX + boomLength;
                const boomEndY   = boomY - boomLength * 0.04;
                const peakLength = mastH * 0.42;
                const peakX      = mastX + peakLength;
                const peakY      = throatY - peakLength * 0.38;

                onto("riggingLayer", el("line", { x1: mastX, y1: throatY, x2: peakX,    y2: peakY,    stroke: "#7a5330", "stroke-width": "5" }));
                onto("riggingLayer", el("line", { x1: mastX, y1: boomY,   x2: boomEndX, y2: boomEndY, stroke: "#7a5330", "stroke-width": "5" }));

                const leechLen   = Math.hypot(boomEndX - peakX, boomEndY - peakY);
                const leechCtrlX = (peakX + boomEndX) / 2 + leechLen * 0.14;
                const leechCtrlY = (peakY + boomEndY) / 2;
                const footLen    = Math.hypot(mastX - boomEndX, boomY - boomEndY);
                const footCtrlX  = (boomEndX + mastX) / 2;
                const footCtrlY  = (boomEndY + boomY) / 2 + footLen * 0.06;

                const d = `M ${mastX},${throatY} ` +
                          `L ${peakX},${peakY} ` +
                          `Q ${leechCtrlX},${leechCtrlY} ${boomEndX},${boomEndY} ` +
                          `Q ${footCtrlX},${footCtrlY} ${mastX},${boomY} Z`;

                onto("sailLayer", el("path", { d, fill: sailColor, stroke: "#b8915e", "stroke-width": "1.5" }));

                function quadPt(ax, ay, cx, cy, bx, by, t) {
                    const u = 1 - t;
                    return { x: u*u*ax + 2*u*t*cx + t*t*bx,
                             y: u*u*ay + 2*u*t*cy + t*t*by };
                }
                for (let i = 1; i <= 4; i++) {
                    const t = i / 5;
                    const lx = mastX;
                    const ly = throatY + (boomY - throatY) * t;
                    const rp = quadPt(peakX, peakY, leechCtrlX, leechCtrlY, boomEndX, boomEndY, t);
                    const smx = (lx + rp.x) / 2 + 5;
                    const smy = (ly + rp.y) / 2 + 4;
                    onto("sailLayer", el("path", {
                        d: `M ${lx},${ly} Q ${smx},${smy} ${rp.x},${rp.y}`,
                        fill: "none", stroke: "#c8a87a", "stroke-width": "0.8", opacity: "0.45"
                    }));
                }
            }
            if (state.masts[idx].gaff.hasSquareTopsail) {
                const tsW = 155, tsH = 100;
                const topmastTop = mast.segments.find(s => s.name === "topmast")?.yTop
                    || (weatherDeckY - mastH*0.85);
                const tsY = topmastTop + 35;
                if (tsY > mast.mastTopY + 8) {
                    const tilt = tsH * 0.08;
                    const hw = tsW / 2;
                    const leftX = mastX - hw;
                    const rightX = mastX + hw;
                    const topLeftY = tsY - tilt;
                    const topRightY = tsY + tilt;

                    onto("riggingLayer", el("line", {
                        x1: leftX - 16, y1: topLeftY,
                        x2: rightX + 16, y2: topRightY,
                        stroke: "#7a5330", "stroke-width": "5"
                    }));
                    onto("sailLayer", el("path", {
                        d: curvedSailPath(mastX, tsY, tsW, tsH, tilt),
                        fill: sailColor,
                        stroke: "#b8915e",
                        "stroke-width": "1.5"
                    }));
                }
            }
        } else if (rigType === "lateen") {
            const mastH = mast.totalHeight;
            const lowerTop = mast.segments.find(s => s.name === "lower")?.yTop || (weatherDeckY - mastH * 0.55);
            const topmastTop = (mast.segments[mast.segments.length - 1]?.yTop) || (weatherDeckY - mastH * 0.85);
            const yardLength = mastH * 1.34;
            const forwardPart = yardLength * 0.34;
            const aftPart = yardLength * 0.66;
            const yardBotX = mastX - forwardPart;
            const yardBotY = lowerTop + 56;
            const yardTopX = mastX + aftPart;
            const yardTopY = topmastTop - 18;
            onto("riggingLayer", el("line", { x1: yardBotX, y1: yardBotY, x2: yardTopX, y2: yardTopY, stroke: "#7a5330", "stroke-width": "6", "stroke-linecap": "round" }));
            const tackX = mastX + aftPart * 0.12;
            const tackY = weatherDeckY - 20;
            onto("sailLayer", el("path", { d: curvedLateenPath(yardBotX, yardBotY, yardTopX, yardTopY, tackX, tackY), fill: sailColor, stroke: "#b8915e", "stroke-width": "1.5" }));
            for (let i = 1; i <= 4; i++) {
                const t = i / 5;
                const sx1 = yardBotX + (yardTopX - yardBotX) * t;
                const sy1 = yardBotY + (yardTopY - yardBotY) * t;
                const sx2 = tackX + (sx1 - tackX) * 0.55;
                const sy2 = tackY + (sy1 - tackY) * 0.55;
                const mx = (sx1 + sx2) * 0.5 + 12;
                const my = (sy1 + sy2) * 0.5 + 18;
                onto("sailLayer", el("path", { d: `M ${sx1} ${sy1} Q ${mx} ${my} ${sx2} ${sy2}`, fill: "none", stroke: "#d8c09a", "stroke-width": "0.9", opacity: "0.55" }));
            }
        }
    }

    drawStandingRigging(geo);

    if (staysailsData && staysailsData.length > 0) {
        for (const ss of staysailsData) {
            if (state.rig.staysails[ss.type] === true) {
                drawTriangularSail(
                    ss.tackX, ss.tackY,
                    ss.headX, ss.headY,
                    ss.clewX, ss.clewY,
                    sailColor
                );
            }
        }
    }
}

function drawShip() {
    try {
        clearSVG();
        getDefs();
        addLayer("waterLayer");
        addLayer("hullLayer");
        addLayer("deckLayer");
        addLayer("armamentLayer");
        addLayer("mastLayer");
        addLayer("riggingLayer");
        addLayer("sailLayer");
        addLayer("detailLayer");

        const geo = buildShipGeometry();
        drawWater(geo);
        drawHull(geo);
        drawDeckStructures(geo);
        drawGunPorts(geo);
        drawCabinsAndGallery(geo);
        drawMastsAndSails(geo);
    } catch (err) {
        console.error("drawShip() failed:", err);
    }
}