"use strict";
/* Vice City Cover Studio — offline multi-panel cover art maker.
   Plain JavaScript + Canvas 2D. No libraries, no network requests. */

const canvas = document.getElementById("cover");
const ctx = canvas.getContext("2d");
const PREVIEW_W = 1080, PREVIEW_H = 1350;
const GUTTER = 0.012; // fraction of cover width, white panel gutters

/* ---------- layouts: panels in normalised coordinates ---------- */
const LAYOUTS = {
  hero: [
    { name: "Hero",     x: 0.02, y: 0.02, w: 0.58, h: 0.96 },
    { name: "Panel 2",  x: 0.62, y: 0.02, w: 0.18, h: 0.47 },
    { name: "Panel 3",  x: 0.82, y: 0.02, w: 0.16, h: 0.47 },
    { name: "Panel 4",  x: 0.62, y: 0.51, w: 0.18, h: 0.47 },
    { name: "Panel 5",  x: 0.82, y: 0.51, w: 0.16, h: 0.47 },
  ],
  strip: [
    { name: "Band 1", x: 0.02, y: 0.02, w: 0.96, h: 0.34 },
    { name: "Band 2", x: 0.02, y: 0.38, w: 0.96, h: 0.28 },
    { name: "Band 3", x: 0.02, y: 0.68, w: 0.96, h: 0.30 },
  ],
  duo: [
    { name: "Left",  x: 0.02, y: 0.02, w: 0.47, h: 0.96 },
    { name: "Right", x: 0.51, y: 0.02, w: 0.47, h: 0.96 },
  ],
};

const state = {
  layout: "hero",
  photos: [],          // { img, name }
  activePhoto: 0,
  panels: [],          // per panel: { photo, dx, dy, zoom, rot, flip, grade }
  selected: 0,
  grade: "sunset",
  strength: 0.70,
  halftone: true,
  vignette: true,
  title: "VICE CITY",
  subtitle: "nights on the boulevard",
  tag: "EST. 2026",
  textPos: "top",
  titleSize: 1.0,
  titleFill: "white",
  outline: "#111111",
  stickers: [],        // { type, x, y, size }
  selectedSticker: -1,
};

function freshPanels(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ photo: -1, dx: 0, dy: 0, zoom: 1, rot: 0, flip: false, grade: "sunset" });
  }
  return out;
}
state.panels = freshPanels(LAYOUTS.hero.length);

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- photo loading ---------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load " + src));
    img.src = src;
  });
}

async function addPhoto(src, name) {
  const img = await loadImage(src);
  state.photos.push({ img, name });
  state.activePhoto = state.photos.length - 1;
  renderStrip();
  return state.photos.length - 1;
}

async function loadSample(which) {
  const src = which === 2 ? "samples/sample-neon.jpg" : "samples/sample-sunset.jpg";
  const name = which === 2 ? "Night sample" : "Sunset sample";
  try {
    const idx = await addPhoto(src, name);
    autoFill(idx);
    setStatus("Sample photo loaded.");
  } catch (e) {
    setStatus("Sample photo failed to load.");
  }
}

function renderStrip() {
  const strip = $("photo-strip");
  strip.innerHTML = "";
  state.photos.forEach((p, i) => {
    const thumb = document.createElement("img");
    thumb.className = "photo-thumb" + (i === state.activePhoto ? " selected" : "");
    thumb.src = p.img.src;
    thumb.alt = p.name;
    thumb.title = p.name + " — click to use, drag onto a panel";
    thumb.draggable = true;
    thumb.addEventListener("click", () => { state.activePhoto = i; renderStrip(); });
    thumb.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/photo-index", String(i));
    });
    strip.appendChild(thumb);
  });
}

/* ---------- panel filling ---------- */
function autoFill(photoIdx) {
  const idx = photoIdx === undefined ? state.activePhoto : photoIdx;
  if (idx < 0 || !state.photos[idx]) return;
  const crops = [0, -0.22, 0.22, -0.12, 0.12, -0.3, 0.3];
  state.panels.forEach((p, i) => {
    p.photo = idx;
    p.dx = crops[i % crops.length] * (i % 2 ? -1 : 1);
    p.dy = (i % 3 - 1) * 0.08;
    p.zoom = 1 + (i % 3) * 0.12;
    p.rot = 0;
  });
  syncPanelControls();
  render();
}

function fillPanel(panelIdx, photoIdx) {
  const p = state.panels[panelIdx];
  if (!p) return;
  p.photo = photoIdx;
  p.dx = 0; p.dy = 0; p.zoom = 1; p.rot = 0;
  state.selected = panelIdx;
  syncPanelControls();
  render();
}

/* ---------- rendering ---------- */
function gradeOverlay(c, x, y, w, h, kind, strength) {
  if (kind === "none" || strength <= 0) return;
  c.save();
  if (kind === "sunset") {
    const g = c.createLinearGradient(x, y, x + w * 0.25, y + h);
    g.addColorStop(0, "rgba(255,150,50,0.55)");
    g.addColorStop(0.55, "rgba(255,60,120,0.45)");
    g.addColorStop(1, "rgba(90,20,120,0.55)");
    c.globalCompositeOperation = "overlay";
    c.globalAlpha = strength;
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    const sh = c.createLinearGradient(x, y + h * 0.55, x, y + h);
    sh.addColorStop(0, "rgba(40,0,80,0)");
    sh.addColorStop(1, "rgba(40,0,80,0.32)");
    c.globalCompositeOperation = "multiply";
    c.globalAlpha = strength * 0.8;
    c.fillStyle = sh;
    c.fillRect(x, y, w, h);
  } else if (kind === "neon") {
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "rgba(255,0,140,0.5)");
    g.addColorStop(0.5, "rgba(120,0,200,0.35)");
    g.addColorStop(1, "rgba(0,220,255,0.5)");
    c.globalCompositeOperation = "overlay";
    c.globalAlpha = strength;
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }
  c.restore();
}

let halftonePattern = null;
function halftone(c, W, H) {
  if (!halftonePattern) {
    const p = document.createElement("canvas");
    p.width = 9; p.height = 9;
    const pc = p.getContext("2d");
    pc.fillStyle = "rgba(0,0,0,0.55)";
    pc.beginPath(); pc.arc(4.5, 4.5, 1.6, 0, Math.PI * 2); pc.fill();
    halftonePattern = c.createPattern(p, "repeat");
  }
  c.save();
  c.globalAlpha = 0.10;
  c.globalCompositeOperation = "overlay";
  c.fillStyle = halftonePattern;
  c.fillRect(0, 0, W, H);
  c.restore();
}

function clampPan(p, photo, rect) {
  // Keep the photo covering its panel: never let a pan open a gap at an edge.
  const iw = photo.img.naturalWidth, ih = photo.img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih) * p.zoom;
  const dw = iw * base, dh = ih * base;
  const maxDx = Math.max(0, (dw - rect.w) / 2 / rect.w);
  const maxDy = Math.max(0, (dh - rect.h) / 2 / rect.h);
  p.dx = clamp(p.dx, -maxDx, maxDx);
  p.dy = clamp(p.dy, -maxDy, maxDy);
}

function drawPanelPhoto(c, panel, rect) {
  const p = state.panels[panel];
  const photo = p.photo >= 0 ? state.photos[p.photo] : null;
  c.save();
  c.beginPath();
  c.rect(rect.x, rect.y, rect.w, rect.h);
  c.clip();
  if (photo) {
    clampPan(p, photo, rect);
    const iw = photo.img.naturalWidth, ih = photo.img.naturalHeight;
    const base = Math.max(rect.w / iw, rect.h / ih) * p.zoom;
    const dw = iw * base, dh = ih * base;
    c.translate(rect.x + rect.w / 2 + p.dx * rect.w, rect.y + rect.h / 2 + p.dy * rect.h);
    c.rotate((p.rot * Math.PI) / 180);
    c.scale(p.flip ? -1 : 1, 1);
    c.drawImage(photo.img, -dw / 2, -dh / 2, dw, dh);
  } else {
    const g = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, "#2a1540"); g.addColorStop(1, "#160a24");
    c.fillStyle = g;
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.font = `600 ${Math.round(rect.w * 0.09)}px system-ui, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("EMPTY PANEL", rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  gradeOverlay(c, rect.x, rect.y, rect.w, rect.h, p.grade, 0.55);
  c.restore();
}

function drawSticker(c, s, W, H) {
  const x = s.x * W, y = s.y * H, r = s.size * W * 0.06;
  c.save();
  c.translate(x, y);
  c.lineWidth = Math.max(2, r * 0.08);
  c.strokeStyle = "#111";
  c.fillStyle = "#fff";
  if (s.type === "sun") {
    c.fillStyle = "#ffb300";
    c.beginPath(); c.arc(0, 0, r * 0.55, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#ffb300";
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c.stroke();
    }
  } else if (s.type === "bolt") {
    c.fillStyle = "#ffe600";
    c.beginPath();
    c.moveTo(r * 0.25, -r); c.lineTo(-r * 0.45, r * 0.15); c.lineTo(-r * 0.05, r * 0.15);
    c.lineTo(-r * 0.25, r); c.lineTo(r * 0.45, -r * 0.15); c.lineTo(r * 0.05, -r * 0.15);
    c.closePath(); c.fill(); c.stroke();
  } else if (s.type === "star") {
    c.fillStyle = "#ff2e88";
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 ? r * 0.45 : r;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fill(); c.stroke();
  } else { // palm
    c.strokeStyle = "#0d3b1e"; c.fillStyle = "#0d3b1e";
    c.lineWidth = r * 0.14;
    c.beginPath(); c.moveTo(0, r); c.quadraticCurveTo(r * 0.12, 0, 0, -r * 0.7); c.stroke();
    c.lineWidth = r * 0.1;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      c.beginPath();
      c.moveTo(0, -r * 0.7);
      c.quadraticCurveTo(Math.cos(a) * r * 0.6, -r * 0.7 + Math.sin(a) * r * 0.6,
        Math.cos(a) * r, -r * 0.7 + Math.sin(a) * r * 0.9 + r * 0.25);
      c.stroke();
    }
    c.fillStyle = "#7a4a21";
    c.beginPath(); c.arc(-r * 0.12, -r * 0.55, r * 0.09, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(r * 0.1, -r * 0.62, r * 0.09, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function drawText(c, W, H) {
  // Title: shrink until it fits the cover width (including its outline).
  let titleSize = W * 0.155 * state.titleSize;
  const setTitleFont = (s) => { c.font = `${s}px Anton, "Arial Narrow", sans-serif`; };
  setTitleFont(titleSize);
  let lineW = Math.max(4, titleSize * 0.14);
  while (c.measureText(state.title).width + lineW * 2 > W * 0.94 && titleSize > 24) {
    titleSize *= 0.92;
    setTitleFont(titleSize);
    lineW = Math.max(4, titleSize * 0.14);
  }
  const metrics = c.measureText(state.title);
  const textH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const subSize = Math.max(14, W * 0.032);
  const fill = state.titleFill === "sunset"
    ? (() => { const g = c.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, "#ffb300"); g.addColorStop(0.5, "#ff5e62"); g.addColorStop(1, "#ff2e88");
        return g; })()
    : state.titleFill === "pink" ? "#ff2e88" : "#ffffff";
  c.save();
  c.textAlign = "center";
  c.lineJoin = "round";
  c.miterLimit = 2;
  let rot = 0, titleTop, subTop;
  if (state.textPos === "bottom") {
    titleTop = H - H * 0.055 - textH - subSize * 1.9;
    subTop = H - H * 0.055 - subSize * 1.6;
  } else if (state.textPos === "diagonal") {
    rot = -0.14;
    titleTop = H * 0.5 - textH / 2;
    subTop = H * 0.5 + textH * 0.62;
  } else {
    titleTop = H * 0.055;
    subTop = titleTop + textH + subSize * 0.55;
  }
  c.translate(W / 2, titleTop);
  c.rotate(rot);
  c.textBaseline = "top";
  // hard drop shadow
  c.fillStyle = "rgba(10,0,20,0.85)";
  c.fillText(state.title, titleSize * 0.045, titleSize * 0.06);
  // outline + fill
  c.strokeStyle = state.outline;
  c.lineWidth = lineW;
  c.strokeText(state.title, 0, 0);
  c.fillStyle = fill;
  c.fillText(state.title, 0, 0);
  c.restore();
  // subtitle (shrink to fit if needed)
  c.save();
  c.textAlign = "center";
  c.textBaseline = "top";
  let ss = subSize;
  c.font = `700 ${ss}px system-ui, sans-serif`;
  while (c.measureText(state.subtitle).width > W * 0.92 && ss > 12) {
    ss *= 0.92;
    c.font = `700 ${ss}px system-ui, sans-serif`;
  }
  const subY = state.textPos === "diagonal" ? subTop : subTop;
  c.fillStyle = "rgba(10,0,20,0.85)";
  c.fillText(state.subtitle, W / 2 + 2, subY + 2);
  c.fillStyle = "#ffe9f4";
  c.fillText(state.subtitle, W / 2, subY);
  c.restore();
  // corner tag
  if (state.tag.trim()) {
    c.save();
    const tagSize = Math.max(12, W * 0.02);
    c.font = `700 ${tagSize}px system-ui, sans-serif`;
    const tw = c.measureText(state.tag).width + tagSize * 1.6;
    const th = tagSize * 2.1;
    const tx = W - tw - W * 0.03, ty = H - th - H * 0.025;
    c.fillStyle = "rgba(10,0,20,0.75)";
    c.beginPath();
    c.roundRect(tx, ty, tw, th, th / 2);
    c.fill();
    c.strokeStyle = "#ff2e88"; c.lineWidth = 2; c.stroke();
    c.fillStyle = "#fff";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(state.tag, tx + tw / 2, ty + th / 2 + 1);
    c.restore();
  }
}

function render(targetCtx, W, H) {
  const c = targetCtx || ctx;
  const w = W || PREVIEW_W, h = H || PREVIEW_H;
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#0d0616";
  c.fillRect(0, 0, w, h);
  const panels = LAYOUTS[state.layout];
  const g = Math.max(2, w * GUTTER);
  panels.forEach((def, i) => {
    const rect = { x: def.x * w, y: def.y * h, w: def.w * w, h: def.h * h };
    drawPanelPhoto(c, i, rect);
    // white gutter + dark outline
    c.save();
    c.strokeStyle = "#ffffff";
    c.lineWidth = g * 0.55;
    c.strokeRect(rect.x, rect.y, rect.w, rect.h);
    c.strokeStyle = "rgba(10,0,20,0.9)";
    c.lineWidth = Math.max(1.5, g * 0.22);
    c.strokeRect(rect.x + g * 0.28, rect.y + g * 0.28, rect.w - g * 0.56, rect.h - g * 0.56);
    if (i === state.selected && !targetCtx) {
      c.strokeStyle = "#00e5ff";
      c.lineWidth = Math.max(3, w * 0.006);
      c.setLineDash([w * 0.012, w * 0.008]);
      c.strokeRect(rect.x - g * 0.4, rect.y - g * 0.4, rect.w + g * 0.8, rect.h + g * 0.8);
      c.setLineDash([]);
    }
    c.restore();
  });
  gradeOverlay(c, 0, 0, w, h, state.grade, state.strength);
  if (state.halftone) halftone(c, w, h);
  if (state.vignette) {
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.30)");
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
  }
  state.stickers.forEach((s) => drawSticker(c, s, w, h));
  drawText(c, w, h);
}

function renderPreview() { render(ctx, PREVIEW_W, PREVIEW_H); }

/* ---------- export ---------- */
function exportCanvas(w, h) {
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  render(off.getContext("2d"), w, h);
  return off;
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

function setStatus(msg) { $("export-status").textContent = msg; }

function exportSize(spec) {
  const [w, h] = spec.split("x").map(Number);
  exportCanvas(w, h).toBlob((blob) => {
    if (!blob) { setStatus("Export failed."); return; }
    downloadBlob(blob, `vice-city-cover-${w}x${h}.png`);
    setStatus(`Exported ${w} × ${h} PNG (${(blob.size / 1024).toFixed(0)} KB).`);
  }, "image/png");
}

async function exportAll() {
  for (const spec of ["1080x1080", "1080x1350", "1920x1080"]) {
    exportSize(spec);
    await new Promise((r) => setTimeout(r, 350));
  }
  setStatus("All three sizes exported.");
}

async function copyPng() {
  try {
    const off = exportCanvas(1080, 1350);
    const blob = await new Promise((res) => off.toBlob(res, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus("Cover PNG copied to clipboard.");
  } catch (e) {
    setStatus("Copy not allowed in this browser — use Download instead.");
  }
}

/* ---------- pointer interaction on the preview ---------- */
let drag = null; // { kind: 'panel'|'sticker', index, lastX, lastY }

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * PREVIEW_W,
    y: ((e.clientY - r.top) / r.height) * PREVIEW_H,
  };
}
function panelAt(x, y) {
  const panels = LAYOUTS[state.layout];
  for (let i = panels.length - 1; i >= 0; i--) {
    const d = panels[i];
    if (x >= d.x * PREVIEW_W && x <= (d.x + d.w) * PREVIEW_W &&
        y >= d.y * PREVIEW_H && y <= (d.y + d.h) * PREVIEW_H) return i;
  }
  return -1;
}
function stickerAt(x, y) {
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const s = state.stickers[i];
    const r = s.size * PREVIEW_W * 0.06 * 1.4;
    if (Math.hypot(x - s.x * PREVIEW_W, y - s.y * PREVIEW_H) < r) return i;
  }
  return -1;
}

canvas.addEventListener("pointerdown", (e) => {
  const { x, y } = pointerPos(e);
  const si = stickerAt(x, y);
  if (si >= 0) {
    state.selectedSticker = si;
    drag = { kind: "sticker", index: si, lastX: x, lastY: y };
  } else {
    const pi = panelAt(x, y);
    if (pi >= 0) {
      state.selected = pi;
      state.selectedSticker = -1;
      syncPanelControls();
      drag = { kind: "panel", index: pi, lastX: x, lastY: y };
    }
  }
  canvas.setPointerCapture(e.pointerId);
  renderPreview();
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const { x, y } = pointerPos(e);
  const dx = x - drag.lastX, dy = y - drag.lastY;
  if (drag.kind === "sticker") {
    const s = state.stickers[drag.index];
    s.x = clamp(s.x + dx / PREVIEW_W, 0.02, 0.98);
    s.y = clamp(s.y + dy / PREVIEW_H, 0.02, 0.98);
  } else {
    const p = state.panels[drag.index];
    const def = LAYOUTS[state.layout][drag.index];
    p.dx = clamp(p.dx + dx / (def.w * PREVIEW_W), -0.6, 0.6);
    p.dy = clamp(p.dy + dy / (def.h * PREVIEW_H), -0.6, 0.6);
  }
  drag.lastX = x; drag.lastY = y;
  renderPreview();
});
canvas.addEventListener("pointerup", () => { drag = null; });
canvas.addEventListener("dblclick", (e) => {
  const { x, y } = pointerPos(e);
  const si = stickerAt(x, y);
  if (si >= 0) { state.stickers.splice(si, 1); state.selectedSticker = -1; renderPreview(); }
});
canvas.addEventListener("dragover", (e) => { e.preventDefault(); canvas.parentElement.classList.add("dragging"); });
canvas.addEventListener("dragleave", () => canvas.parentElement.classList.remove("dragging"));
canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  canvas.parentElement.classList.remove("dragging");
  const { x, y } = pointerPos(e);
  const pi = panelAt(x, y);
  const photoIdx = Number(e.dataTransfer.getData("text/photo-index"));
  if (pi >= 0 && !Number.isNaN(photoIdx) && state.photos[photoIdx]) fillPanel(pi, photoIdx);
  const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
  files.forEach((f) => addPhoto(URL.createObjectURL(f), f.name).then((i) => { if (pi >= 0) fillPanel(pi, i); }));
});

/* ---------- controls ---------- */
function syncPanelControls() {
  const p = state.panels[state.selected] || state.panels[0];
  const def = LAYOUTS[state.layout][state.selected];
  $("panel-name").textContent = (def ? def.name : "Panel") + " — selected";
  $("zoom").value = Math.round(p.zoom * 100);
  $("zoom-val").textContent = Math.round(p.zoom * 100) + "%";
  $("rot").value = p.rot;
  $("rot-val").textContent = p.rot + "°";
  $("panel-grade").value = p.grade;
}

function bindControls() {
  $("btn-sample").addEventListener("click", () => loadSample(1));
  $("btn-sample2").addEventListener("click", () => loadSample(2));
  $("btn-autofill").addEventListener("click", () => autoFill());
  $("file-input").addEventListener("change", (e) => {
    [...e.target.files].filter((f) => f.type.startsWith("image/"))
      .forEach((f) => addPhoto(URL.createObjectURL(f), f.name));
    e.target.value = "";
  });

  document.querySelectorAll(".layout-btn").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".layout-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const old = state.panels;
      state.layout = b.dataset.layout;
      state.panels = freshPanels(LAYOUTS[state.layout].length);
      state.panels.forEach((p, i) => { if (old[i]) Object.assign(p, old[i]); });
      state.selected = 0;
      syncPanelControls();
      renderPreview();
    });
  });

  $("zoom").addEventListener("input", (e) => {
    state.panels[state.selected].zoom = e.target.value / 100;
    $("zoom-val").textContent = e.target.value + "%";
    renderPreview();
  });
  $("rot").addEventListener("input", (e) => {
    state.panels[state.selected].rot = Number(e.target.value);
    $("rot-val").textContent = e.target.value + "°";
    renderPreview();
  });
  $("btn-flip").addEventListener("click", () => {
    const p = state.panels[state.selected];
    p.flip = !p.flip;
    renderPreview();
  });
  $("btn-centre").addEventListener("click", () => {
    const p = state.panels[state.selected];
    p.dx = 0; p.dy = 0; p.zoom = 1; p.rot = 0;
    syncPanelControls();
    renderPreview();
  });
  $("panel-grade").addEventListener("change", (e) => {
    state.panels[state.selected].grade = e.target.value;
    renderPreview();
  });

  $("grade").addEventListener("change", (e) => { state.grade = e.target.value; renderPreview(); });
  $("strength").addEventListener("input", (e) => {
    state.strength = e.target.value / 100;
    $("strength-val").textContent = e.target.value + "%";
    renderPreview();
  });
  $("halftone").addEventListener("change", (e) => { state.halftone = e.target.checked; renderPreview(); });
  $("vignette").addEventListener("change", (e) => { state.vignette = e.target.checked; renderPreview(); });

  $("title").addEventListener("input", (e) => { state.title = e.target.value.toUpperCase() || " "; renderPreview(); });
  $("subtitle").addEventListener("input", (e) => { state.subtitle = e.target.value; renderPreview(); });
  $("tag").addEventListener("input", (e) => { state.tag = e.target.value.toUpperCase(); renderPreview(); });
  $("text-pos").addEventListener("change", (e) => { state.textPos = e.target.value; renderPreview(); });
  $("title-size").addEventListener("input", (e) => {
    state.titleSize = e.target.value / 100;
    $("title-size-val").textContent = e.target.value + "%";
    renderPreview();
  });
  $("title-fill").addEventListener("change", (e) => { state.titleFill = e.target.value; renderPreview(); });
  $("outline").addEventListener("change", (e) => { state.outline = e.target.value; renderPreview(); });

  document.querySelectorAll(".preset").forEach((b) => {
    b.addEventListener("click", () => applyPreset(b.dataset.preset));
  });
  document.querySelectorAll(".sticker-btn").forEach((b) => {
    b.addEventListener("click", () => {
      state.stickers.push({ type: b.dataset.sticker, x: 0.5, y: 0.45, size: Number($("sticker-size").value) / 100 });
      state.selectedSticker = state.stickers.length - 1;
      renderPreview();
    });
  });
  $("sticker-size").addEventListener("input", (e) => {
    $("sticker-size-val").textContent = e.target.value + "%";
    if (state.selectedSticker >= 0) {
      state.stickers[state.selectedSticker].size = e.target.value / 100;
      renderPreview();
    }
  });

  document.querySelectorAll("[data-export]").forEach((b) => {
    b.addEventListener("click", () => exportSize(b.dataset.export));
  });
  $("btn-export-all").addEventListener("click", exportAll);
  $("btn-copy").addEventListener("click", copyPng);

  $("btn-random").addEventListener("click", randomise);
  $("btn-reset").addEventListener("click", () => {
    state.layout = "hero";
    document.querySelectorAll(".layout-btn").forEach((x) => x.classList.toggle("active", x.dataset.layout === "hero"));
    state.panels = freshPanels(LAYOUTS.hero.length);
    state.selected = 0;
    state.grade = "sunset"; state.strength = 0.7;
    state.halftone = true; state.vignette = true;
    state.title = "VICE CITY"; state.subtitle = "nights on the boulevard"; state.tag = "EST. 2026";
    state.textPos = "top"; state.titleSize = 1; state.titleFill = "white"; state.outline = "#111111";
    state.stickers = [];
    $("grade").value = "sunset"; $("strength").value = 70; $("strength-val").textContent = "70%";
    $("halftone").checked = true; $("vignette").checked = true;
    $("title").value = "VICE CITY"; $("subtitle").value = "nights on the boulevard"; $("tag").value = "EST. 2026";
    $("text-pos").value = "top"; $("title-size").value = 100; $("title-size-val").textContent = "100%";
    $("title-fill").value = "white"; $("outline").value = "#111111";
    autoFill();
  });
}

function applyPreset(name) {
  if (name === "sunset") {
    state.grade = "sunset"; state.strength = 0.7; state.halftone = true; state.vignette = true;
    state.titleFill = "sunset"; state.outline = "#111111";
  } else if (name === "neon") {
    state.grade = "neon"; state.strength = 0.85; state.halftone = true; state.vignette = true;
    state.titleFill = "pink"; state.outline = "#00e5ff";
  } else { // noir
    state.grade = "none"; state.strength = 0; state.halftone = false; state.vignette = true;
    state.titleFill = "white"; state.outline = "#111111";
  }
  $("grade").value = state.grade;
  $("strength").value = Math.round(state.strength * 100);
  $("strength-val").textContent = Math.round(state.strength * 100) + "%";
  $("halftone").checked = state.halftone;
  $("vignette").checked = state.vignette;
  $("title-fill").value = state.titleFill;
  $("outline").value = state.outline;
  renderPreview();
}

function randomise() {
  const layouts = Object.keys(LAYOUTS);
  const layout = layouts[Math.floor(Math.random() * layouts.length)];
  document.querySelector(`.layout-btn[data-layout="${layout}"]`).click();
  const grades = ["sunset", "neon", "none"];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  state.strength = 0.5 + Math.random() * 0.5;
  state.titleFill = ["white", "sunset", "pink"][Math.floor(Math.random() * 3)];
  state.titleSize = 0.85 + Math.random() * 0.4;
  const kinds = ["palm", "sun", "bolt", "star"];
  state.stickers.push({
    type: kinds[Math.floor(Math.random() * kinds.length)],
    x: 0.15 + Math.random() * 0.7,
    y: 0.2 + Math.random() * 0.6,
    size: 0.7 + Math.random() * 0.8,
  });
  $("grade").value = state.grade;
  $("strength").value = Math.round(state.strength * 100);
  $("strength-val").textContent = Math.round(state.strength * 100) + "%";
  $("title-fill").value = state.titleFill;
  $("title-size").value = Math.round(state.titleSize * 100);
  $("title-size-val").textContent = Math.round(state.titleSize * 100) + "%";
  autoFill();
  setStatus("Randomised — new look applied.");
}

/* ---------- boot ---------- */
bindControls();
syncPanelControls();
if (document.fonts && document.fonts.load) {
  document.fonts.load('80px Anton').then(renderPreview).catch(renderPreview);
  document.fonts.ready.then(renderPreview);
}
renderPreview();
loadSample(1);
