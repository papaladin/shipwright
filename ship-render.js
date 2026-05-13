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
// Tiny colour helpers
// -------------------------------------------------------
function lighten(hex, amount) {
    const clamp = n => Math.max(0, Math.min(255, n));
    const r = clamp(parseInt(hex.slice(1, 3), 16) + amount);
    const g = clamp(parseInt(hex.slice(3, 5), 16) + amount);
    const b = clamp(parseInt(hex.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const COPPER_COLOR = "#b87333";

// =====================================================
// SAIL PATH HELPERS (with stripe support)
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

    const d = `M ${leftX},${topLeftY} ` +
              `Q ${mastX},${topCtrlY} ${rightX},${topRightY} ` +
              `L ${rightX},${bottomRightY} ` +
              `Q ${mastX},${bottomCtrlY} ${leftX},${bottomLeftY} ` +
              `Z`;

    const pattern = state.appearance.sailPattern;
    const sailColor = state.appearance.sailColor;
    const stripeColor = state.appearance.stripeColor;

    // 1. Base fill
    onto("sailLayer", el("path", { d, fill: sailColor }));

    // 2. Stripes overlay
    if (pattern === "stripes") {
        const clipId = "squareClip" + Math.random().toString(36).substr(2, 8);
        const clip = el("clipPath", { id: clipId });
        clip.appendChild(el("path", { d }));
        getDefs().appendChild(clip);

        const stripeG = el("g", { "clip-path": `url(#${clipId})` });
        const stripeWidth = 18;
        const offsetX = mastX;
        const offsetY = yardY + sailHeight / 2;
        for (let i = -40; i < 40; i++) {
            if ((i + 20) % 2 === 0) {
                const x = offsetX + i * stripeWidth;
                const stripeRect = el("rect", {
                    x: x - stripeWidth / 2,
                    y: offsetY - 1000,
                    width: stripeWidth,
                    height: 2000,
                    fill: stripeColor,
                    transform: `rotate(${tilt}, ${mastX}, ${offsetY})`
                });
                stripeG.appendChild(stripeRect);
            }
        }
        onto("sailLayer", stripeG);
    }

    onto("sailLayer", el("path", {
        d, fill: "none", stroke: "#b8915e", "stroke-width": "1.5"
    }));

    return d;
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

    const sailColor = state.appearance.sailColor;
    const pattern = state.appearance.sailPattern;
    const stripeColor = state.appearance.stripeColor;

    // 1. Base fill
    onto("sailLayer", el("path", { d, fill: sailColor }));

    // 2. Stripes overlay
    if (pattern === "stripes") {
        const clipId = "lateenClip" + Math.random().toString(36).substr(2, 8);
        const clip = el("clipPath", { id: clipId });
        clip.appendChild(el("path", { d }));
        getDefs().appendChild(clip);

        const stripeG = el("g", { "clip-path": `url(#${clipId})` });
        const stripeWidth = 18;
        const minX = Math.min(yardBotX, yardTopX, tackX) - 20;
        const maxX = Math.max(yardBotX, yardTopX, tackX) + 20;
        for (let x = minX; x < maxX; x += stripeWidth * 2) {
            stripeG.appendChild(el("rect", {
                x: x + stripeWidth, y: -200,
                width: stripeWidth, height: 1400,
                fill: stripeColor
            }));
        }
        onto("sailLayer", stripeG);
    }

    onto("sailLayer", el("path", { d, fill: "none", stroke: "#b8915e", "stroke-width": "1.5" }));
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

    const pattern = state.appearance.sailPattern;
    const stripeColor = state.appearance.stripeColor;
    const baseColor = state.appearance.sailColor;

    // 1. Base fill
    onto("sailLayer", el("path", { d, fill: baseColor }));

    // 2. Stripes overlay
    if (pattern === "stripes") {
        const clipId = "triClip" + Math.random().toString(36).substr(2, 8);
        const clip = el("clipPath", { id: clipId });
        clip.appendChild(el("path", { d }));
        getDefs().appendChild(clip);

        const stripeG = el("g", { "clip-path": `url(#${clipId})` });
        const stripeWidth = 18;
        const minX = Math.min(tackX, headX, clewX) - 20;
        const maxX = Math.max(tackX, headX, clewX) + 20;
        for (let x = minX; x < maxX; x += stripeWidth * 2) {
            stripeG.appendChild(el("rect", {
                x: x + stripeWidth, y: -200,
                width: stripeWidth, height: 1400,
                fill: stripeColor
            }));
        }
        onto("sailLayer", stripeG);
    }

    onto("sailLayer", el("path", { d, fill: "none", stroke: "#b18753", "stroke-width": "1.8" }));

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
// STANDING RIGGING
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
// HULL RAILING HELPER
// =====================================================
function getDeckEdgePoints(geo) {
    const { sternX, bowX, weatherDeckY, bowSheer, sternSheer, hullLength } = geo;
    const tumblehome = hullLength * 0.04;
    const sternRiseCtrl = weatherDeckY - sternSheer * 1.2 - 5;
    const bowRiseCtrl = weatherDeckY - bowSheer * 1.1 - 5;
    const bowTipY = weatherDeckY - bowSheer + 15;

    const sternDeckEnd = sternX - hullLength * 0.25;
    const bowDeckStart = bowX + hullLength * 0.25 + tumblehome;

    const points = [];

    for (let t = 0; t <= 1; t += 0.05) {
        const u = 1 - t;
        const cx = sternX - hullLength * 0.15;
        const cy = sternRiseCtrl;
        const x = u * u * sternX + 2 * u * t * cx + t * t * sternDeckEnd;
        const y = u * u * weatherDeckY + 2 * u * t * cy + t * t * weatherDeckY;
        points.push({ x, y });
    }

    points.push({ x: sternDeckEnd, y: weatherDeckY });
    points.push({ x: bowDeckStart, y: weatherDeckY });

    for (let t = 0; t <= 1; t += 0.05) {
        const u = 1 - t;
        const cx = bowX + hullLength * 0.15;
        const cy = bowRiseCtrl;
        const x = u * u * bowDeckStart + 2 * u * t * cx + t * t * bowX;
        const y = u * u * weatherDeckY + 2 * u * t * cy + t * t * bowTipY;
        points.push({ x, y });
    }

    return points;
}

function drawHullRailing(geo) {
    const points = getDeckEdgePoints(geo);
    if (points.length < 2) return;
    const railColor = darken(state.appearance.hullColor, 25);
    const postColor = "#3d2510";
    const postHeight = 12;

    for (let i = 0; i < points.length; i += 4) {
        const pt = points[i];
        onto("hullLayer", el("line", {
            x1: pt.x, y1: pt.y,
            x2: pt.x, y2: pt.y - postHeight,
            stroke: postColor,
            "stroke-width": "1.5"
        }));
    }

    const handrailPoints = points.map(p => `${p.x},${p.y - postHeight}`).join(' ');
    onto("hullLayer", el("polyline", {
        points: handrailPoints,
        fill: "none",
        stroke: railColor,
        "stroke-width": "3"
    }));

    const midRailPoints = points.map(p => `${p.x},${p.y - postHeight / 2}`).join(' ');
    onto("hullLayer", el("polyline", {
        points: midRailPoints,
        fill: "none",
        stroke: railColor,
        "stroke-width": "1.5",
        opacity: "0.7"
    }));
}

// =====================================================
// WATER IMPROVEMENTS
// =====================================================
function wavePath(yCenter, amplitude, frequency, phase, width, height) {
    let d = `M 0,${yCenter}`;
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * width;
        const y = yCenter + Math.sin(i * frequency + phase) * amplitude;
        d += ` L ${x},${y}`;
    }
    d += ` L ${width},${height} L 0,${height} Z`;
    return d;
}

function drawWater(geo) {
    const { waterlineY } = geo;
    const width = CANVAS_WIDTH;
    const height = CANVAS_HEIGHT;
    const waterTop = waterlineY;

    const gradId = "waterGrad";
    let grad = document.getElementById(gradId);
    if (!grad) {
        grad = el("linearGradient", { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" });
        grad.appendChild(el("stop", { offset: "0%", "stop-color": "#7ec8e3" }));
        grad.appendChild(el("stop", { offset: "100%", "stop-color": "#1e5a7a" }));
        getDefs().appendChild(grad);
    }

    onto("waterLayer", el("rect", { x: 0, y: waterTop, width, height: height - waterTop, fill: `url(#${gradId})`, opacity: "0.9" }));

    const waveStyles = [
        { yOff: 6, amp: 4, freq: 0.03, phase: 0, color: "#b3dff0", opacity: 0.4, width: 2.5 },
        { yOff: 16, amp: 6, freq: 0.05, phase: 2.1, color: "#89c8e0", opacity: 0.35, width: 2 },
        { yOff: 28, amp: 5, freq: 0.04, phase: 4.5, color: "#a0d4ea", opacity: 0.3, width: 2 },
        { yOff: 40, amp: 7, freq: 0.06, phase: 1.3, color: "#6eb5d1", opacity: 0.25, width: 1.8 }
    ];

    waveStyles.forEach(ws => {
        const yCenter = waterTop + ws.yOff;
        onto("waterLayer", el("path", {
            d: wavePath(yCenter, ws.amp, ws.freq, ws.phase, width, height),
            fill: "none", stroke: ws.color, "stroke-width": ws.width, opacity: ws.opacity
        }));
    });

    const bowWakeX = geo.bowX + 20;
    const bowWakeY = waterTop;
    onto("waterLayer", el("polygon", {
        points: `${bowWakeX},${bowWakeY} ${bowWakeX - 25},${bowWakeY + 8} ${bowWakeX + 10},${bowWakeY + 6} ${bowWakeX + 35},${bowWakeY + 12}`,
        fill: "#ffffff", opacity: "0.3"
    }));

    const hullPath = buildHullPath(geo);
    const waterClipId = "waterClip";
    let waterClip = document.getElementById(waterClipId);
    if (!waterClip) {
        waterClip = el("clipPath", { id: waterClipId });
        waterClip.appendChild(el("rect", { x: 0, y: waterTop, width, height: height - waterTop }));
        getDefs().appendChild(waterClip);
    }
    onto("waterLayer", el("path", {
        d: hullPath, fill: `url(#${gradId})`, opacity: "0.15",
        transform: `translate(0, ${waterTop * 2}) scale(1, -1)`,
        "clip-path": `url(#${waterClipId})`
    }));

    onto("waterLayer", el("path", {
        d: `M ${geo.bowX + 10},${waterTop} Q ${(geo.bowX + geo.sternX) / 2},${waterTop - 2} ${geo.sternX - 10},${waterTop}`,
        fill: "none", stroke: "#d4f0ff", "stroke-width": "2", opacity: "0.8"
    }));
}

// =====================================================
// DRAWING FUNCTIONS
// =====================================================
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

    onto("hullLayer", el("path", { d: hullPath, fill: COPPER_COLOR, stroke: "none" }));

    const aboveWaterId = "aboveWaterClip";
    let aboveClip = document.getElementById(aboveWaterId);
    if (!aboveClip) {
        aboveClip = el("clipPath", { id: aboveWaterId });
        aboveClip.appendChild(el("rect", { x: 0, y: 0, width: CANVAS_WIDTH, height: geo.waterlineY }));
        getDefs().appendChild(aboveClip);
    }
    onto("hullLayer", el("path", { d: hullPath, fill: hullColor, stroke: "none", "clip-path": `url(#${aboveWaterId})` }));

    const clipId = "hullClip";
    let hullClip = document.getElementById(clipId);
    if (!hullClip) {
        hullClip = el("clipPath", { id: clipId });
        hullClip.appendChild(el("path", { d: hullPath }));
        getDefs().appendChild(hullClip);
    }

    const interiorGrp = el("g", { "clip-path": `url(#${clipId})` });

    const plankClr = darken(hullColor, 22);
    const plankLight = lighten(hullColor, 20);
    for (let py = geo.weatherDeckY + 16; py < geo.keelY + 32; py += 20) {
        interiorGrp.appendChild(el("line", { x1: 0, y1: py, x2: 1500, y2: py, stroke: plankClr, "stroke-width": "1.2", opacity: "0.5" }));
        interiorGrp.appendChild(el("line", { x1: 0, y1: py + 1.5, x2: 1500, y2: py + 1.5, stroke: plankLight, "stroke-width": "0.8", opacity: "0.35" }));
    }

    const freeboard = geo.weatherDeckY - geo.waterlineY;
    const waleYs = [
        geo.weatherDeckY - freeboard * 0.22,
        geo.weatherDeckY - freeboard * 0.52,
        geo.weatherDeckY - freeboard * 0.78
    ];
    const waleColor = darken(hullColor, 35);
    waleYs.forEach(wy => {
        interiorGrp.appendChild(el("line", { x1: 0, y1: wy, x2: 1500, y2: wy, stroke: waleColor, "stroke-width": "4.5", opacity: "0.85" }));
        interiorGrp.appendChild(el("line", { x1: 0, y1: wy - 2, x2: 1500, y2: wy - 2, stroke: lighten(hullColor, 5), "stroke-width": "1", opacity: "0.5" }));
    });

    const shadeId = "hullShadeGrad";
    let shadeGrad = document.getElementById(shadeId);
    if (!shadeGrad) {
        shadeGrad = el("linearGradient", { id: shadeId, gradientTransform: "rotate(90)" });
        shadeGrad.appendChild(el("stop", { offset: "0%", "stop-color": lighten(hullColor, 40) }));
        shadeGrad.appendChild(el("stop", { offset: "100%", "stop-color": darken(hullColor, 30) }));
        getDefs().appendChild(shadeGrad);
    }
    interiorGrp.appendChild(el("rect", { x: 0, y: geo.weatherDeckY, width: CANVAS_WIDTH, height: geo.keelY - geo.weatherDeckY + 5, fill: `url(#${shadeId})`, opacity: "0.25" }));

    onto("hullLayer", interiorGrp);
    onto("hullLayer", el("path", { d: hullPath, fill: "none", stroke: "#3d2510", "stroke-width": "3.5" }));
    onto("hullLayer", el("rect", { x: geo.bowFairX - 8, y: geo.weatherDeckY, width: geo.sternFairX - geo.bowFairX + 18, height: 6, fill: darken(hullColor, 28), opacity: "0.55" }));
    drawHullRailing(geo);
}

function drawRaisedDeck(layerId, x, y, w, h, hullClr, deckClr, railingPosts = true, showSteps = false) {
    onto(layerId, el("rect", { x, y, width: w, height: h, fill: darken(hullClr, 14), stroke: "#3d2510", "stroke-width": "2" }));
    onto(layerId, el("line", { x1: x+6, y1: y+5, x2: x+w-6, y2: y+5, stroke: deckClr, "stroke-width": "2.5" }));
    if (showSteps) {
        const stepCount = Math.floor(h / 6);
        for (let s = 0; s < stepCount; s++) {
            const sy = y + h - s * 6;
            const sx = x + 4 + (s % 2) * 4;
            onto(layerId, el("line", { x1: sx, y1: sy, x2: sx + 8, y2: sy, stroke: darken(hullClr, 10), "stroke-width": "1.5" }));
        }
    }
    if (railingPosts) {
        for (let px = x + 10; px < x + w - 6; px += 18) {
            onto(layerId, el("line", { x1: px, y1: y + 2, x2: px, y2: y - 6, stroke: "#5a3e2b", "stroke-width": "1.5" }));
        }
        onto(layerId, el("line", { x1: x + 5, y1: y - 4, x2: x + w - 5, y2: y - 4, stroke: "#5a3e2b", "stroke-width": "2" }));
        onto(layerId, el("line", { x1: x + 5, y1: y - 5, x2: x + w - 5, y2: y - 5, stroke: lighten("#5a3e2b", 20), "stroke-width": "1", opacity: "0.6" }));
        onto(layerId, el("line", { x1: x + 5, y1: y - 1, x2: x + w - 5, y2: y - 1, stroke: "#5a3e2b", "stroke-width": "1.5" }));
    }
}

function drawDeckStructures(geo) {
    const deckClr = state.appearance.deckColor;
    const hullClr = state.appearance.hullColor;
    const { weatherDeckY, forecastle, quarterdeck, poopDeck, bowFairX, sternFairX, gunDeckYs } = geo;

    for (const dy of gunDeckYs) {
        onto("deckLayer", el("line", { x1: bowFairX+18, y1: dy, x2: sternFairX-18, y2: dy, stroke: deckClr, "stroke-width": "2.5", "stroke-dasharray": "10 4", opacity: "0.85" }));
        for (let tx = bowFairX+30; tx < sternFairX-18; tx += 60) {
            onto("deckLayer", el("line", { x1: tx, y1: dy-4, x2: tx, y2: dy+4, stroke: deckClr, "stroke-width": "1.5", opacity: "0.55" }));
        }
    }

    if (forecastle) {
        drawRaisedDeck("deckLayer", forecastle.x, forecastle.y, forecastle.width, forecastle.height, hullClr, deckClr, true, true);
        const winCount = Math.max(1, Math.floor(forecastle.width / 60));
        for (let i = 0; i < winCount; i++) {
            const wx = forecastle.x + forecastle.width - 30 - i * 50;
            const wy = forecastle.y + forecastle.height - 14;
            onto("deckLayer", el("rect", { x: wx, y: wy, width: 10, height: 10, fill: "#F8DD9A", stroke: "#8b6942", "stroke-width": "1", rx: "1" }));
            onto("deckLayer", el("line", { x1: wx + 5, y1: wy, x2: wx + 5, y2: wy + 10, stroke: "#8b6942", "stroke-width": "0.8", opacity: "0.6" }));
        }
    }

    if (quarterdeck) {
        drawRaisedDeck("deckLayer", quarterdeck.x, quarterdeck.y, quarterdeck.width, quarterdeck.height, hullClr, deckClr, true, true);
        const winCount = Math.max(1, Math.floor(quarterdeck.width / 80));
        for (let i = 0; i < winCount; i++) {
            const wx = quarterdeck.x + 30 + i * 60;
            const wy = quarterdeck.y + quarterdeck.height - 14;
            onto("deckLayer", el("rect", { x: wx, y: wy, width: 10, height: 10, fill: "#F8DD9A", stroke: "#8b6942", "stroke-width": "1", rx: "1" }));
            onto("deckLayer", el("line", { x1: wx + 5, y1: wy, x2: wx + 5, y2: wy + 10, stroke: "#8b6942", "stroke-width": "0.8", opacity: "0.6" }));
        }
    }

    if (poopDeck) {
        drawRaisedDeck("deckLayer", poopDeck.x, poopDeck.y, poopDeck.width, poopDeck.height, hullClr, deckClr, false, false);
        const skyX = poopDeck.x + poopDeck.width / 2 - 8;
        const skyY = poopDeck.y + 3;
        onto("deckLayer", el("rect", { x: skyX, y: skyY, width: 16, height: 10, fill: "#F8F0D0", stroke: "#6b4a28", "stroke-width": "1", rx: "1" }));
        onto("deckLayer", el("line", { x1: skyX + 8, y1: skyY, x2: skyX + 8, y2: skyY + 10, stroke: "#6b4a28", "stroke-width": "1", opacity: "0.7" }));
        onto("deckLayer", el("line", { x1: skyX, y1: skyY + 5, x2: skyX + 16, y2: skyY + 5, stroke: "#6b4a28", "stroke-width": "1", opacity: "0.7" }));
        const poleX = poopDeck.x + poopDeck.width - 10;
        const poleTopY = poopDeck.y - 30;
        onto("deckLayer", el("line", { x1: poleX, y1: poopDeck.y, x2: poleX, y2: poleTopY, stroke: "#4a3a2a", "stroke-width": "2" }));
        onto("deckLayer", el("circle", { cx: poleX, cy: poleTopY, r: 2, fill: "#4a3a2a" }));
    }
}

function drawGunPorts(geo) {
    const { gunDeckYs, bowFairX, sternFairX } = geo;
    const lidColor = state.appearance.gunPortColor;
    const frameColor = "#2a1a0c";
    const highlightColor = lighten(lidColor, 30);

    for (let d = 0; d < state.hullStructures.gunDecks; d++) {
        const dy = gunDeckYs[d];
        const pCnt = d === 0 ? state.armament.gunPortsLower : (d === 1 ? state.armament.gunPortsUpper : 0);
        if (pCnt <= 0) continue;
        const startX = bowFairX + 22;
        const endX = sternFairX - 30;
        const step = (endX - startX) / Math.max(1, pCnt - 1);
        for (let i = 0; i < pCnt; i++) {
            const px = startX + i * step;
            onto("armamentLayer", el("rect", { x: px - 10, y: dy - 9, width: 20, height: 14, fill: frameColor, stroke: "#0d0a06", "stroke-width": "1.2", rx: "2" }));
            onto("armamentLayer", el("rect", { x: px - 8, y: dy - 7, width: 16, height: 10, fill: lidColor, stroke: darken(lidColor, 20), "stroke-width": "1", rx: "1" }));
            onto("armamentLayer", el("line", { x1: px - 7, y1: dy - 6, x2: px + 7, y2: dy - 6, stroke: highlightColor, "stroke-width": "1.2", opacity: "0.8" }));
            onto("armamentLayer", el("rect", { x: px - 10, y: dy - 3, width: 20, height: 6, fill: "#000000", opacity: "0.2", rx: "1" }));
        }
    }
}

function drawCabinsAndGallery(geo) {
    const { sternX, weatherDeckY, quarterdeck, hullSize } = geo;
    const { galleryWidth, windowCount, galleryBaseY, galleryTopY, galleryHeight,
            windowSpacing, windowWidth, windowHeight,
            galleryRows = 1, rowHeight = galleryHeight } = geo;

    if (state.hullStructures.sternGallery) {
        const galLeftX = sternX - galleryWidth;
        const galRightX = sternX - 2;
        onto("detailLayer", el("rect", { x: galLeftX, y: galleryTopY, width: galleryWidth, height: galleryHeight, fill: darken(state.appearance.hullColor, 30), stroke: "#3d2510", "stroke-width": "2", rx: "4" }));
        const verticalGap = galleryHeight * 0.08;
        for (let row = 0; row < galleryRows; row++) {
            const rowTopY = galleryTopY + row * (rowHeight + (row > 0 ? verticalGap : 0));
            const windowY = rowTopY + (rowHeight - windowHeight) / 2;
            for (let i = 0; i < windowCount; i++) {
                const wx = galLeftX + windowSpacing * (i + 1) - windowWidth / 2;
                const wy = windowY;
                onto("detailLayer", el("rect", { x: wx, y: wy, width: windowWidth, height: windowHeight, fill: "#F8DD9A", stroke: "#8b6942", "stroke-width": "1.5", rx: "2" }));
                const archCtrlY = wy - windowHeight * 0.2;
                onto("detailLayer", el("path", { d: `M ${wx},${wy} Q ${wx + windowWidth / 2},${archCtrlY} ${wx + windowWidth},${wy}`, fill: "none", stroke: "#8b6942", "stroke-width": "1.5" }));
                onto("detailLayer", el("line", { x1: wx + windowWidth / 2, y1: wy, x2: wx + windowWidth / 2, y2: wy + windowHeight, stroke: "#8b6942", "stroke-width": "1", opacity: "0.6" }));
                onto("detailLayer", el("line", { x1: wx, y1: wy + windowHeight / 2, x2: wx + windowWidth, y2: wy + windowHeight / 2, stroke: "#8b6942", "stroke-width": "1", opacity: "0.6" }));
            }
        }
        for (let i = 0; i <= windowCount; i++) {
            const px = galLeftX + windowSpacing * (i + 0.5);
            onto("detailLayer", el("line", { x1: px, y1: galleryTopY, x2: px, y2: galleryBaseY, stroke: darken(state.appearance.hullColor, 15), "stroke-width": "2.5" }));
        }
        const roofY = galleryTopY - 8;
        onto("detailLayer", el("path", { d: `M ${galLeftX - 10},${roofY} Q ${(galLeftX + galRightX) / 2},${roofY - 8} ${galRightX + 10},${roofY}`, fill: "none", stroke: "#4a3a2a", "stroke-width": "3" }));
        onto("detailLayer", el("path", { d: `M ${galLeftX - 10},${roofY} Q ${(galLeftX + galRightX) / 2},${roofY - 8} ${galRightX + 10},${roofY} Z`, fill: darken(state.appearance.hullColor, 10), stroke: "none", opacity: "0.7" }));
        if ((hullSize === "large" || hullSize === "veryLarge") && quarterdeck) {
            const lanternX = (galLeftX + galRightX) / 2;
            const lanternY = roofY - 20;
            onto("detailLayer", el("line", { x1: lanternX, y1: roofY, x2: lanternX, y2: lanternY, stroke: "#4a3a2a", "stroke-width": "2" }));
            onto("detailLayer", el("rect", { x: lanternX - 6, y: lanternY - 10, width: 12, height: 10, fill: "#F0D08A", stroke: "#8b6942", "stroke-width": "1", rx: "1" }));
            onto("detailLayer", el("rect", { x: lanternX - 4, y: lanternY - 8, width: 8, height: 6, fill: "#FFFFCC", stroke: "none", opacity: "0.9" }));
            onto("detailLayer", el("polygon", { points: `${lanternX - 7},${lanternY - 10} ${lanternX + 7},${lanternY - 10} ${lanternX},${lanternY - 16}`, fill: "#6b4a28" }));
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

// =====================================================
// FLAG DRAWING
// =====================================================
function makeWavyPath(topPoints, leftX, rightX, topY, bottomY, waveFreq, waveAmp) {
    const steps = topPoints.length - 1;
    let d = `M ${topPoints[0].x},${topPoints[0].y}`;
    for (let i = 1; i < topPoints.length; i++) d += ` L ${topPoints[i].x},${topPoints[i].y}`;
    d += ` L ${topPoints[steps].x},${bottomY}`;
    for (let i = steps; i >= 0; i--) {
        const x = topPoints[i].x;
        const y = bottomY + (topPoints[i].y - topY);
        d += ` L ${x},${y}`;
    }
    d += ' Z';
    return d;
}

function drawFlappingFlag(cx, cy, flagWidth, flagHeight, primaryColor, secondaryColor, designKey, tiltDeg) {
    const design = FLAG_DESIGNS[designKey] || FLAG_DESIGNS.solid;
    const grp = el("g", { transform: `rotate(${tiltDeg}, ${cx}, ${cy})` });

    const leftX = cx - 2;
    const rightX = cx + flagWidth;
    const topY = cy - flagHeight / 2;
    const bottomY = cy + flagHeight / 2;

    const waveFreq = 2.5;
    const waveAmp = flagWidth * 0.08;
    const steps = 8;

    const topPoints = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = leftX + (rightX - leftX) * t;
        const y = topY + Math.sin(t * Math.PI * waveFreq) * waveAmp;
        topPoints.push({ x, y });
    }

    if (design.pattern === 'solid') {
        const d = makeWavyPath(topPoints, leftX, rightX, topY, bottomY, waveFreq, waveAmp);
        grp.appendChild(el("path", { d, fill: primaryColor, stroke: "#5a4a3a", "stroke-width": "0.8" }));
    }
    else if (design.pattern === 'stripesH') {
        let colors = design.fixedColors || [primaryColor, secondaryColor, primaryColor];
        const stripeCount = colors.length;
        const stripeHeight = flagHeight / stripeCount;
        for (let s = 0; s < stripeCount; s++) {
            const stripeTop = topY + s * stripeHeight;
            const stripeBottom = stripeTop + stripeHeight;
            let d = `M ${topPoints[0].x},${topPoints[0].y + s * stripeHeight}`;
            for (let i = 1; i < topPoints.length; i++) {
                d += ` L ${topPoints[i].x},${topPoints[i].y + s * stripeHeight}`;
            }
            d += ` L ${rightX},${stripeBottom}`;
            for (let i = topPoints.length - 1; i >= 0; i--) {
                d += ` L ${topPoints[i].x},${topPoints[i].y + (s+1) * stripeHeight}`;
            }
            d += ' Z';
            grp.appendChild(el("path", { d, fill: colors[s], stroke: "none" }));
        }
        const outlineD = makeWavyPath(topPoints, leftX, rightX, topY, bottomY, waveFreq, waveAmp);
        grp.appendChild(el("path", { d: outlineD, fill: "none", stroke: "#5a4a3a", "stroke-width": "0.8" }));
    }
    else if (design.pattern === 'stripesV') {
        const colors = design.fixedColors || [primaryColor, secondaryColor, primaryColor];
        const stripeW = flagWidth / colors.length;
        const clipId = 'flagClipV' + Math.random();
        const clip = el("clipPath", { id: clipId });
        const outlineD = makeWavyPath(topPoints, leftX, rightX, topY, bottomY, waveFreq, waveAmp);
        clip.appendChild(el("path", { d: outlineD }));
        getDefs().appendChild(clip);
        const stripeG = el("g", { "clip-path": `url(#${clipId})` });
        for (let s = 0; s < colors.length; s++) {
            stripeG.appendChild(el("rect", {
                x: leftX + s * stripeW, y: topY - 2,
                width: stripeW, height: flagHeight + 4,
                fill: colors[s]
            }));
        }
        grp.appendChild(stripeG);
        grp.appendChild(el("path", { d: outlineD, fill: "none", stroke: "#5a4a3a", "stroke-width": "0.8" }));
    }
    else if (design.pattern === 'emblem') {
        const outlineD = makeWavyPath(topPoints, leftX, rightX, topY, bottomY, waveFreq, waveAmp);
        grp.appendChild(el("path", { d: outlineD, fill: design.emblemPrimary, stroke: "#5a4a3a", "stroke-width": "0.8" }));
        const emb = FLAG_EMBLEMS[design.emblem];
        if (emb) {
            const emblemScale = Math.min(flagWidth, flagHeight) / 20;
            const emblemG = el("g", {
                transform: `translate(${cx + flagWidth/2 - 10*emblemScale}, ${cy - 10*emblemScale}) scale(${emblemScale})`
            });
            emblemG.appendChild(el("path", { d: emb.path, fill: emb.fg, stroke: "none" }));
            grp.appendChild(emblemG);
        }
    }
    else if (design.pattern === 'uk') {
        const outlineD = makeWavyPath(topPoints, leftX, rightX, topY, bottomY, waveFreq, waveAmp);
        const clipId = 'flagClipUK' + Math.random();
        const clip = el("clipPath", { id: clipId });
        clip.appendChild(el("path", { d: outlineD }));
        getDefs().appendChild(clip);
        const ukGroup = el("g", { "clip-path": `url(#${clipId})` });
        ukGroup.appendChild(el("rect", { x: leftX, y: topY, width: flagWidth, height: flagHeight, fill: '#012169' }));
        const diagW = flagHeight * 0.12;
        ukGroup.appendChild(el("polygon", { points: `${leftX},${topY} ${rightX},${bottomY} ${rightX},${bottomY - diagW} ${leftX},${topY - diagW}`, fill: '#FFFFFF' }));
        ukGroup.appendChild(el("polygon", { points: `${rightX},${topY} ${leftX},${bottomY} ${leftX},${bottomY - diagW} ${rightX},${topY - diagW}`, fill: '#FFFFFF' }));
        const thinW = flagHeight * 0.06;
        ukGroup.appendChild(el("polygon", { points: `${leftX},${topY} ${rightX},${bottomY} ${rightX},${bottomY - thinW} ${leftX},${topY - thinW}`, fill: '#C8102E' }));
        ukGroup.appendChild(el("polygon", { points: `${rightX},${topY} ${leftX},${bottomY} ${leftX},${bottomY - thinW} ${rightX},${topY - thinW}`, fill: '#C8102E' }));
        const crossW = flagHeight * 0.2;
        const crossH = flagWidth * 0.2;
        ukGroup.appendChild(el("rect", { x: cx - crossH/2, y: topY, width: crossH, height: flagHeight, fill: '#C8102E' }));
        ukGroup.appendChild(el("rect", { x: leftX, y: cy - crossW/2, width: flagWidth, height: crossW, fill: '#C8102E' }));
        ukGroup.appendChild(el("rect", { x: cx - crossH/4, y: topY, width: crossH/2, height: flagHeight, fill: '#FFFFFF' }));
        ukGroup.appendChild(el("rect", { x: leftX, y: cy - crossW/4, width: flagWidth, height: crossW/2, fill: '#FFFFFF' }));
        grp.appendChild(ukGroup);
        grp.appendChild(el("path", { d: outlineD, fill: "none", stroke: "#5a4a3a", "stroke-width": "0.8" }));
    }
    else if (design.pattern === 'portugal') {
        const colors = design.fixedColors;
        const leftW = flagWidth * 0.4;
        const rightW = flagWidth * 0.6;
        const clipId = 'flagClipP' + Math.random();
        const clip = el("clipPath", { id: clipId });
        const outlineD = makeWavyPath(topPoints, leftX, rightX, topY, bottomY, waveFreq, waveAmp);
        clip.appendChild(el("path", { d: outlineD }));
        getDefs().appendChild(clip);
        const stripeG = el("g", { "clip-path": `url(#${clipId})` });
        stripeG.appendChild(el("rect", { x: leftX, y: topY, width: leftW, height: flagHeight, fill: colors[0] }));
        stripeG.appendChild(el("rect", { x: leftX + leftW, y: topY, width: rightW, height: flagHeight, fill: colors[1] }));
        stripeG.appendChild(el("circle", { cx: leftX + leftW, cy: cy, r: flagHeight * 0.15, fill: colors[2] }));
        grp.appendChild(stripeG);
        grp.appendChild(el("path", { d: outlineD, fill: "none", stroke: "#5a4a3a", "stroke-width": "0.8" }));
    }

    onto("flagLayer", grp);
}

function drawFlags(geo) {
    const { mastData, sternX, quarterdeck, poopDeck, galleryTopY, galleryWidth } = geo;
    const poleHeight = 16;

    const mastFlagW = 35;
    const mastFlagH = 20;
    const sternFlagW = 55;
    const sternFlagH = 32;

    const positions = [
        { key: 'fore',   x: mastData[0]?.x,        y: mastData[0]?.mastTopY,        flagW: mastFlagW, flagH: mastFlagH, tilt: 4 },
        { key: 'main',   x: mastData[1]?.x,        y: mastData[1]?.mastTopY,        flagW: mastFlagW, flagH: mastFlagH, tilt: 4 },
        { key: 'mizzen', x: mastData[2]?.x,        y: mastData[2]?.mastTopY,        flagW: mastFlagW * 0.85, flagH: mastFlagH * 0.85, tilt: 3 },
    ];

    for (let i = 0; i < positions.length && i < mastData.length; i++) {
        const pos = positions[i];
        const flagState = state.flags[pos.key];
        if (!flagState || !flagState.enabled) continue;
        const poleTopX = pos.x;
        const poleTopY = pos.y - 4;
        onto("flagLayer", el("line", { x1: pos.x, y1: pos.y, x2: poleTopX, y2: poleTopY - poleHeight, stroke: "#3d2510", "stroke-width": "1.5" }));
        const flagCx = poleTopX - 2;
        const flagCy = poleTopY - poleHeight + pos.flagH / 2;
        drawFlappingFlag(flagCx, flagCy, pos.flagW, pos.flagH, flagState.primary, flagState.secondary, flagState.design, pos.tilt);
    }

    const sternFlag = state.flags.stern;
    if (sternFlag && sternFlag.enabled) {
        let sternPoleX, sternPoleTopY;
        if (poopDeck) {
            sternPoleX = poopDeck.x + poopDeck.width - 10;
            sternPoleTopY = poopDeck.y - 30;
        } else {
            sternPoleX = sternX - galleryWidth / 2;
            sternPoleTopY = (galleryTopY || geo.weatherDeckY - 50) - 20;
        }
        onto("flagLayer", el("line", { x1: sternPoleX, y1: sternPoleTopY + poleHeight, x2: sternPoleX, y2: sternPoleTopY - poleHeight, stroke: "#3d2510", "stroke-width": "2" }));
        const flagCx = sternPoleX - 2;
        const flagCy = sternPoleTopY - poleHeight + sternFlagH / 2;
        drawFlappingFlag(flagCx, flagCy, sternFlagW, sternFlagH, sternFlag.primary, sternFlag.secondary, sternFlag.design, -2);
    }
}

// =====================================================
// MASTS & SAILS
// =====================================================
function drawMastsAndSails(geo) {
    const { mastData, weatherDeckY, keelY, bspritRootX, bspritRootY, bspritTipX, bspritTipY, staysailsData } = geo;
    const sailColor = state.appearance.sailColor;
    const mastBotY = keelY - 22;

    if (state.bowspritType !== "none") {
        onto("mastLayer", el("line", { x1: bspritRootX, y1: bspritRootY, x2: bspritTipX, y2: bspritTipY, stroke: "#6f4a2c", "stroke-width": "10" }));
        onto("riggingLayer", el("line", { x1: bspritTipX, y1: bspritTipY, x2: bspritRootX+5, y2: weatherDeckY+18, stroke: "#7a6a52", "stroke-width": "1.5", opacity: "0.8" }));
    }

    for (const mast of mastData) {
        onto("mastBaseLayer", el("line", { x1: mast.x, y1: weatherDeckY, x2: mast.x, y2: mastBotY, stroke: "#5e3e1c", "stroke-width": "13" }));
    }

    const mastOrder = [2, 1, 0].filter(i => i < mastData.length);
    const drawnStaysailTypes = new Set();

    for (const idx of mastOrder) {
        const mast = mastData[idx];
        const mastX = mast.x;
        const rigType = mast.rigType;

        for (const seg of mast.segments) {
            onto("mastLayer", el("line", { x1: mastX, y1: seg.yBottom, x2: mastX, y2: seg.yTop, stroke: "#6b4a28", "stroke-width": seg.width, "stroke-linecap": "round" }));
        }

        if (rigType === "square") {
            for (let yi = mast.yards.length - 1; yi >= 0; yi--) {
                const yard = mast.yards[yi];
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
                curvedSailPath(mastX, yard.y, yard.width, yard.height, tilt);
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
                onto("riggingLayer", el("line", { x1: mastX, y1: throatY, x2: peakX, y2: peakY, stroke: "#7a5330", "stroke-width": "5" }));
                onto("riggingLayer", el("line", { x1: mastX, y1: boomY, x2: boomEndX, y2: boomEndY, stroke: "#7a5330", "stroke-width": "5" }));

                const leechLen   = Math.hypot(boomEndX - peakX, boomEndY - peakY);
                const leechCtrlX = (peakX + boomEndX) / 2 + leechLen * 0.14;
                const leechCtrlY = (peakY + boomEndY) / 2;
                const footLen    = Math.hypot(mastX - boomEndX, boomY - boomEndY);
                const footCtrlX  = (boomEndX + mastX) / 2;
                const footCtrlY  = (boomEndY + boomY) / 2 + footLen * 0.06;
                const d = `M ${mastX},${throatY} L ${peakX},${peakY} Q ${leechCtrlX},${leechCtrlY} ${boomEndX},${boomEndY} Q ${footCtrlX},${footCtrlY} ${mastX},${boomY} Z`;

                // Gaff sail stripes (base fill + overlay)
                const pattern = state.appearance.sailPattern;
                const stripeColor = state.appearance.stripeColor;
                onto("sailLayer", el("path", { d, fill: sailColor }));
                if (pattern === "stripes") {
                    const clipId = "gaffClip" + Math.random().toString(36).substr(2,8);
                    const clip = el("clipPath", { id: clipId });
                    clip.appendChild(el("path", { d }));
                    getDefs().appendChild(clip);
                    const stripeG = el("g", { "clip-path": `url(#${clipId})` });
                    const stripeW = 18;
                    const minX = mastX - 20;
                    const maxX = Math.max(peakX, boomEndX) + 20;
                    for (let x = minX; x < maxX; x += stripeW * 2) {
                        stripeG.appendChild(el("rect", {
                            x: x + stripeW, y: -200, width: stripeW, height: 1400,
                            fill: stripeColor
                        }));
                    }
                    onto("sailLayer", stripeG);
                }
                onto("sailLayer", el("path", { d, fill: "none", stroke: "#b8915e", "stroke-width": "1.5" }));

                function quadPt(ax, ay, cx, cy, bx, by, t) {
                    const u = 1 - t;
                    return { x: u*u*ax + 2*u*t*cx + t*t*bx, y: u*u*ay + 2*u*t*cy + t*t*by };
                }
                for (let i = 1; i <= 4; i++) {
                    const t = i / 5;
                    const lx = mastX;
                    const ly = throatY + (boomY - throatY) * t;
                    const rp = quadPt(peakX, peakY, leechCtrlX, leechCtrlY, boomEndX, boomEndY, t);
                    const smx = (lx + rp.x) / 2 + 5;
                    const smy = (ly + rp.y) / 2 + 4;
                    onto("sailLayer", el("path", { d: `M ${lx},${ly} Q ${smx},${smy} ${rp.x},${rp.y}`, fill: "none", stroke: "#c8a87a", "stroke-width": "0.8", opacity: "0.45" }));
                }
            }
            if (state.masts[idx].gaff.hasSquareTopsail) {
                const tsW = 155, tsH = 100;
                const topmastTop = mast.segments.find(s => s.name === "topmast")?.yTop || (weatherDeckY - mastH*0.85);
                const tsY = topmastTop + 35;
                if (tsY > mast.mastTopY + 8) {
                    const tilt = tsH * 0.08;
                    const hw = tsW / 2;
                    const leftX = mastX - hw;
                    const rightX = mastX + hw;
                    const topLeftY = tsY - tilt;
                    const topRightY = tsY + tilt;
                    onto("riggingLayer", el("line", { x1: leftX - 16, y1: topLeftY, x2: rightX + 16, y2: topRightY, stroke: "#7a5330", "stroke-width": "5" }));
                    curvedSailPath(mastX, tsY, tsW, tsH, tilt);
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
            curvedLateenPath(yardBotX, yardBotY, yardTopX, yardTopY, tackX, tackY);
        }

        if (staysailsData && staysailsData.length > 0) {
            const targetTypes = [];
            if (idx === 2) targetTypes.push("mizzenStaysail", "mizzenTopmastStaysail");
            else if (idx === 1) targetTypes.push("mainStaysail", "mainTopmastStaysail");
            for (const ss of staysailsData) {
                if (targetTypes.includes(ss.type) && !drawnStaysailTypes.has(ss.type)) {
                    if (state.rig.staysails[ss.type] === true) {
                        drawTriangularSail(ss.tackX, ss.tackY, ss.headX, ss.headY, ss.clewX, ss.clewY, sailColor);
                    }
                    drawnStaysailTypes.add(ss.type);
                }
            }
        }
    }

    const foreTopY = mastData[0]?.mastTopY ?? weatherDeckY - 220;
    const foreTopX = mastData[0]?.x ?? (bspritRootX + 100);
    const bspritSpan  = foreTopX - bspritRootX;
    const jibClewX    = bspritRootX + bspritSpan * 0.38;
    const jibClewY    = weatherDeckY - 75;

    if (state.bowspritType === "jib") {
        drawTriangularSail(bspritTipX, bspritTipY, foreTopX - 12, foreTopY + 28, jibClewX, jibClewY, sailColor);
    } else if (state.bowspritType === "twoJibs") {
        drawTriangularSail(bspritTipX, bspritTipY, foreTopX - 12, foreTopY + 28, jibClewX, jibClewY, sailColor);
        const mx = Math.round((bspritTipX + bspritRootX) / 2);
        const my = Math.round((bspritTipY + bspritRootY) / 2);
        const foreLowerTopY = mastData[0]?.segments[0]?.yTop ?? (foreTopY + 200);
        const innerClewX = bspritRootX + bspritSpan * 0.52;
        const innerClewY = weatherDeckY - 90;
        drawTriangularSail(mx, my, foreTopX, foreLowerTopY + 25, innerClewX, innerClewY, sailColor);
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
        onto("riggingLayer", el("line", { x1: leftX - 10, y1: topLeftY, x2: rightX + 10, y2: topRightY, stroke: "#7a5330", "stroke-width": "4" }));
        curvedSailPath(sx, sy, spritW, spritH, tilt);
    }

    drawStandingRigging(geo);
}

function drawShip() {
    try {
        clearSVG();
        getDefs();
        addLayer("mastBaseLayer");
        addLayer("hullLayer");
        addLayer("deckLayer");
        addLayer("armamentLayer");
        addLayer("mastLayer");
        addLayer("riggingLayer");
        addLayer("sailLayer");
        addLayer("detailLayer");
        addLayer("flagLayer");
        addLayer("waterLayer");

        const geo = buildShipGeometry();
        drawWater(geo);
        drawHull(geo);
        drawDeckStructures(geo);
        drawGunPorts(geo);
        drawCabinsAndGallery(geo);
        drawMastsAndSails(geo);
        drawFlags(geo);
    } catch (err) {
        console.error("drawShip() failed:", err);
    }
}