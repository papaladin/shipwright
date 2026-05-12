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

// =====================================================
// SAIL PATH HELPERS (shared between rig types)
// =====================================================
function curvedSailPath(mastX, yardY, sailWidth, sailHeight) {
    const hw = sailWidth / 2;
    const leftX   = mastX - hw;
    const rightX  = mastX + hw;
    const bottomY = yardY + sailHeight;
    const topBelly    = sailHeight * -0.05;   // upward arch (wind fill)
    const bottomBelly = sailHeight * 0.10;   // downward belly
    return `M ${leftX},${yardY} ` +
           `Q ${mastX},${yardY - topBelly} ${rightX},${yardY} ` +
           `L ${rightX},${bottomY} ` +
           `Q ${mastX},${bottomY + bottomBelly} ${leftX},${bottomY} ` +
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

function drawJib(x0, y0, x1, y1, depth) {
    onto("sailLayer", el("polygon", {
        points: `${x0},${y0} ${x1},${y1} ${x0+32},${y0+depth}`,
        fill: state.appearance.sailColor,
        stroke: "#b18753",
        "stroke-width": "2"
    }));
}

// =====================================================
// STANDING RIGGING (stays, shrouds, ratlines, backstays)
// =====================================================
function drawStandingRigging(geo) {
    const { mastData, weatherDeckY, hullLength, bspritTipX, bspritTipY, sternX } = geo;
    const lowerShroudCount = 4;          // shrouds per side on lower mast
    const topmastShroudCount = 3;        // shrouds per side on topmast
    const ratlineSpacing = 15;
    const stayStroke = "#5a3e2b";
    const shroudStroke = "#6b5a42";
    const ratlineStroke = "#5a4a3a";
    const backstayStroke = "#6b5a42";

    // Helper to find segment tops
    function segmentTop(mast, name) {
        const seg = mast.segments.find(s => s.name === name);
        return seg ? seg.yTop : null;
    }

    // For each mast, determine highest usable head for stays and backstays:
    // topgallant if exists, else topmast if exists, else lower head (fallback)
    const mastHeads = mastData.map(mast => {
        let headY = segmentTop(mast, "lower"); // always exists
        let headName = "lower";
        if (segmentTop(mast, "topgallant") !== null) {
            headY = segmentTop(mast, "topgallant");
            headName = "topgallant";
        } else if (segmentTop(mast, "topmast") !== null) {
            headY = segmentTop(mast, "topmast");
            headName = "topmast";
        }
        return { y: headY, name: headName };
    });

    // ----- STAYS -----
    // Forestay: bowsprit tip → foremast head
    if (mastData.length >= 1) {
        onto("riggingLayer", el("line", {
            x1: bspritTipX, y1: bspritTipY,
            x2: mastData[0].x, y2: mastHeads[0].y,
            stroke: stayStroke, "stroke-width": "2.5", opacity: "0.9"
        }));
    }

    // Mainstay: foremast head → mainmast head
    if (mastData.length >= 2) {
        onto("riggingLayer", el("line", {
            x1: mastData[0].x, y1: mastHeads[0].y,
            x2: mastData[1].x, y2: mastHeads[1].y,
            stroke: stayStroke, "stroke-width": "2.5", opacity: "0.9"
        }));
    }

    // Mizzenstay: mainmast head → mizzen head
    if (mastData.length >= 3) {
        onto("riggingLayer", el("line", {
            x1: mastData[1].x, y1: mastHeads[1].y,
            x2: mastData[2].x, y2: mastHeads[2].y,
            stroke: stayStroke, "stroke-width": "2.5", opacity: "0.9"
        }));
    }

    // ----- SHROUDS AND RATLINES (for each mast) -----
    for (let i = 0; i < mastData.length; i++) {
        const mast = mastData[i];
        const xMast = mast.x;
        const lowerHeadY = segmentTop(mast, "lower");
        const topmastHeadY = segmentTop(mast, "topmast");
        // fallback if no topmast (unlikely) but just in case
        const effectiveTopmastHeadY = topmastHeadY !== null ? topmastHeadY : lowerHeadY;

        // Lower shrouds
        const lowerBaseY = weatherDeckY + 8;
        const lowerSpread = hullLength * 0.065;
        // draw shrouds
        for (let s = 0; s < lowerShroudCount; s++) {
            const t = s / (lowerShroudCount - 1); // 0 to 1
            // fan out: innermost shroud less spread, outermost more
            const lx = xMast - lowerSpread * (0.5 + t * 0.7);
            const rx = xMast + lowerSpread * (0.5 + t * 0.7);
            // left
            onto("riggingLayer", el("line", {
                x1: lx, y1: lowerBaseY,
                x2: xMast, y2: lowerHeadY,
                stroke: shroudStroke, "stroke-width": "1.6", opacity: "0.8"
            }));
            // right
            onto("riggingLayer", el("line", {
                x1: rx, y1: lowerBaseY,
                x2: xMast, y2: lowerHeadY,
                stroke: shroudStroke, "stroke-width": "1.6", opacity: "0.8"
            }));
        }

        // Platform (top) at lower head – only if a topmast exists
        if (topmastHeadY !== null) {
            const platformHalfWidth = hullLength * 0.04;
            const platformY = lowerHeadY;
            onto("riggingLayer", el("line", {
                x1: xMast - platformHalfWidth, y1: platformY,
                x2: xMast + platformHalfWidth, y2: platformY,
                stroke: "#4a3a2a", "stroke-width": "3", opacity: "0.9"
            }));
            // small vertical lines at platform edges (optional)
            onto("riggingLayer", el("line", { x1: xMast - platformHalfWidth, y1: platformY-4, x2: xMast - platformHalfWidth, y2: platformY+4, stroke: "#4a3a2a", "stroke-width": "2", opacity: "0.8" }));
            onto("riggingLayer", el("line", { x1: xMast + platformHalfWidth, y1: platformY-4, x2: xMast + platformHalfWidth, y2: platformY+4, stroke: "#4a3a2a", "stroke-width": "2", opacity: "0.8" }));
        }

        // Lower ratlines
        const lowerLeftOuter  = xMast - lowerSpread * 1.2;
        const lowerRightOuter = xMast + lowerSpread * 1.2;
        for (let yy = lowerBaseY + 10; yy < lowerHeadY - 6; yy += ratlineSpacing) {
            const t = (yy - lowerBaseY) / (lowerHeadY - lowerBaseY);
            const lx = lowerLeftOuter + (xMast - lowerLeftOuter) * t;
            const rx = lowerRightOuter + (xMast - lowerRightOuter) * t;
            onto("riggingLayer", el("line", {
                x1: lx, y1: yy,
                x2: rx, y2: yy,
                stroke: ratlineStroke, "stroke-width": "1.2", opacity: "0.7"
            }));
        }

        // Topmast shrouds (if topmast exists)
        if (topmastHeadY !== null && topmastHeadY !== lowerHeadY) {
            const topBaseY = lowerHeadY; // platform Y
            const topSpread = hullLength * 0.04;
            for (let s = 0; s < topmastShroudCount; s++) {
                const t = s / (topmastShroudCount - 1);
                const lx = xMast - topSpread * (0.5 + t * 0.8);
                const rx = xMast + topSpread * (0.5 + t * 0.8);
                onto("riggingLayer", el("line", {
                    x1: lx, y1: topBaseY,
                    x2: xMast, y2: topmastHeadY,
                    stroke: shroudStroke, "stroke-width": "1.4", opacity: "0.8"
                }));
                onto("riggingLayer", el("line", {
                    x1: rx, y1: topBaseY,
                    x2: xMast, y2: topmastHeadY,
                    stroke: shroudStroke, "stroke-width": "1.4", opacity: "0.8"
                }));
            }

            // Topmast ratlines
            const topLeftOuter  = xMast - topSpread * 1.3;
            const topRightOuter = xMast + topSpread * 1.3;
            for (let yy = topBaseY + 8; yy < topmastHeadY - 6; yy += ratlineSpacing) {
                const t = (yy - topBaseY) / (topmastHeadY - topBaseY);
                const lx = topLeftOuter + (xMast - topLeftOuter) * t;
                const rx = topRightOuter + (xMast - topRightOuter) * t;
                onto("riggingLayer", el("line", {
                    x1: lx, y1: yy,
                    x2: rx, y2: yy,
                    stroke: ratlineStroke, "stroke-width": "1.2", opacity: "0.7"
                }));
            }
        }

        // Backstay (from topmast or topgallant head to stern)
        const backstayHeadY = mastHeads[i].y;
        const sternXPoint = sternX - (i === 0 ? 160 : i === 1 ? 100 : 50);
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
    onto("hullLayer", el("path", { d: hullPath, fill: hullColor, stroke: "#3d2510", "stroke-width": "3" }));
    const clipId = "hullClip";
    let clip = document.getElementById(clipId);
    if (!clip) {
        clip = el("clipPath", { id: clipId });
        clip.appendChild(el("path", { d: hullPath }));
        getDefs().appendChild(clip);
    }
    const plankGrp = el("g", { "clip-path": `url(#${clipId})` });
    const plankClr = darken(hullColor, 22);
    for (let py = geo.weatherDeckY + 16; py < geo.keelY + 32; py += 20) {
        plankGrp.appendChild(el("line", { x1: 0, y1: py, x2: 1500, y2: py, stroke: plankClr, "stroke-width": "1.2", opacity: "0.4" }));
    }
    onto("hullLayer", plankGrp);
    onto("hullLayer", el("path", { d: hullPath, fill: "none", stroke: "#3d2510", "stroke-width": "3.5" }));
    onto("hullLayer", el("rect", {
        x: geo.bowFairX - 8, y: geo.weatherDeckY,
        width: geo.sternFairX - geo.bowFairX + 18, height: 10,
        fill: darken(hullColor, 28), opacity: "0.55"
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
    const gunClr = state.appearance.gunPortColor;
    for (let d = 0; d < state.hullStructures.gunDecks; d++) {
        const dy = gunDeckYs[d];
        const pCnt = d === 0 ? state.armament.gunPortsLower : (d === 1 ? state.armament.gunPortsUpper : 0);
        if (pCnt <= 0) continue;
        const startX = bowFairX + 22;
        const endX = sternFairX - 30;
        const step = (endX - startX) / Math.max(1, pCnt - 1);
        for (let i = 0; i < pCnt; i++) {
            const px = startX + i * step;
            onto("armamentLayer", el("rect", { x: px - 8, y: dy - 7, width: 16, height: 12, fill: gunClr, stroke: "#1a1208", "stroke-width": "1.5", rx: "2" }));
            onto("armamentLayer", el("line", { x1: px - 12, y1: dy - 3, x2: px - 8, y2: dy - 3, stroke: "#0d0a06", "stroke-width": "3.5" }));
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

    if (state.bowspritType === "jib") {
        drawJib(bspritTipX, bspritTipY, foreTopX-12, foreTopY+28, 70);
    } else if (state.bowspritType === "twoJibs") {
        drawJib(bspritTipX, bspritTipY, foreTopX-12, foreTopY+28, 70);
        const mx = Math.round((bspritTipX+bspritRootX)/2);
        const my = Math.round((bspritTipY+bspritRootY)/2);
        drawJib(mx, my, foreTopX+2, foreTopY+68, 55);
    } else if (state.bowspritType === "squareSpritsail") {
        const sx = Math.round(bspritRootX + (bspritTipX-bspritRootX)*0.65);
        const sy = Math.round(bspritRootY + (bspritTipY-bspritRootY)*0.65);
        const spritW = 100, spritH = 85;
        const grp = el("g", { transform: `translate(${sx}, ${sy}) rotate(-15)` });
        grp.appendChild(el("path", { d: curvedSailPath(0, 0, spritW, spritH), fill: sailColor, stroke: "#b18753", "stroke-width": "1.5" }));
        onto("sailLayer", grp);
        onto("riggingLayer", el("line", { x1: sx-spritW/2-10, y1: sy, x2: sx+spritW/2+10, y2: sy, stroke: "#7a5330", "stroke-width": "4" }));
    }

    // Masts
    for (let idx = 0; idx < mastData.length; idx++) {
        const mast = mastData[idx];
        const mastX = mast.x;
        const rigType = mast.rigType;

        // Mast segments
        for (const seg of mast.segments) {
            onto("mastLayer", el("line", { x1: mastX, y1: seg.yBottom, x2: mastX, y2: seg.yTop, stroke: "#6b4a28", "stroke-width": seg.width, "stroke-linecap": "round" }));
        }
        onto("mastLayer", el("line", { x1: mastX, y1: weatherDeckY, x2: mastX, y2: mastBotY, stroke: "#5e3e1c", "stroke-width": "13" }));

        // Square rig
        if (rigType === "square") {
            for (const yard of mast.yards) {
                onto("riggingLayer", el("line", { x1: mastX - yard.width/2 - 14, y1: yard.y, x2: mastX + yard.width/2 + 14, y2: yard.y, stroke: "#7a5330", "stroke-width": "5" }));
                onto("sailLayer", el("path", { d: curvedSailPath(mastX, yard.y, yard.width, yard.height), fill: sailColor, stroke: "#b8915e", "stroke-width": "1.5" }));
            }
        }
        // Gaff rig
        else if (rigType === "gaff") {
            const mastH = mast.totalHeight;
            const lowerTop = mast.segments.find(s => s.name === "lower")?.yTop || (weatherDeckY - mastH*0.55);
            if (state.masts[idx].gaff.hasGaff) {
                const throatY = lowerTop + 12;
                const boomY = weatherDeckY - mastH * 0.22;
                const peakLength = mastH * 0.42;
                const peakX = mastX + peakLength;
                const peakY = throatY - peakLength * 0.72;
                onto("riggingLayer", el("line", { x1: mastX, y1: throatY, x2: peakX, y2: peakY, stroke: "#7a5330", "stroke-width": "5" }));
                onto("riggingLayer", el("line", { x1: mastX, y1: boomY, x2: mastX+Math.min(240, mastH*0.75), y2: boomY, stroke: "#7a5330", "stroke-width": "5" }));
                onto("sailLayer", el("polygon", {
                    points: `${mastX},${throatY} ${peakX},${peakY} ${mastX+Math.min(240, mastH*0.75)},${boomY} ${mastX},${boomY}`,
                    fill: sailColor, stroke: "#b8915e", "stroke-width": "1.5"
                }));
            }
            if (state.masts[idx].gaff.hasSquareTopsail) {
                const tsW = 155, tsH = 100;
                const topmastTop = mast.segments.find(s => s.name === "topmast")?.yTop || (weatherDeckY - mastH*0.85);
                const tsY = topmastTop + 35;
                if (tsY > mast.mastTopY + 8) {
                    onto("riggingLayer", el("line", { x1: mastX-tsW/2-16, y1: tsY, x2: mastX+tsW/2+16, y2: tsY, stroke: "#7a5330", "stroke-width": "5" }));
                    onto("sailLayer", el("path", { d: curvedSailPath(mastX, tsY, tsW, tsH), fill: sailColor, stroke: "#b8915e", "stroke-width": "1.5" }));
                }
            }
        }
        // Lateen rig
        else if (rigType === "lateen") {
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

        // NO simple shrouds here anymore – all standing rigging is in drawStandingRigging()
    }

    // ----- DRAW STANDING RIGGING (stays, shrouds, ratlines, backstays) -----
    drawStandingRigging(geo);

    // ----- DRAW STAYSAILS -----
    if (staysailsData && staysailsData.length > 0) {
        for (const ss of staysailsData) {
            const key = ss.type;
            if (state.rig.staysails[key] === true) {
                drawJib(ss.footX, ss.footY, ss.headX, ss.headY, ss.depth);
            }
        }
    }
}

function drawShip() {
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
}