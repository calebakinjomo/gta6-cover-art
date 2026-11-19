/* Vice City Cover Studio — a fully offline cover maker.
   Plain JavaScript + Canvas 2D. No libraries, no network requests.
   Every photo is read on the user's own machine and never uploaded. */

'use strict';

/* ------------------------------------------------------------------ */
/* Sizes, layouts, grades, presets                                     */
/* ------------------------------------------------------------------ */

var SIZES = {
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
};

/* Panel rects are fractions of the cover: x, y, width, height. */
var LAYOUTS = {
  hero: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 0.34 },
    { x: 0.62, y: 0.34, w: 0.38, h: 0.33 },
    { x: 0.62, y: 0.67, w: 0.38, h: 0.33 },
  ],
  comic: [
    { x: 0, y: 0, w: 1, h: 0.34 },
    { x: 0, y: 0.34, w: 1, h: 0.33 },
    { x: 0, y: 0.67, w: 1, h: 0.33 },
  ],
  duo: [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
};

var GRADES = ['sunset', 'neon', 'original'];

var PRESETS = {
  sunset: {
    layout: 'hero', grade: 'sunset', gradeStrength: 0.7,
    textFill: 'sunset', outlineColor: '#14061f', textPos: 'bottom',
    halftone: true, vignette: true,
  },
  neon: {
    layout: 'duo', grade: 'neon', gradeStrength: 0.8,
    textFill: 'white', outlineColor: '#ff2bd6', textPos: 'top',
    halftone: true, vignette: true,
  },
  noir: {
    layout: 'comic', grade: 'original', gradeStrength: 0.25,
    textFill: 'white', outlineColor: '#00e5d4', textPos: 'diagonal',
    halftone: true, vignette: true,
  },
};

var SAMPLES = [
  { src: 'samples/sample-sunset.jpg', name: 'Sunset street (sample)' },
  { src: 'samples/sample-neon.jpg', name: 'Neon night (sample)' },
];

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

function defaultPanel(photo) {
  return {
    photo: photo, cx: 0.5, cy: 0.5, zoom: 1.15,
    rot: 0, flip: false, grade: 'sunset',
  };
}

var state = {
  size: 'wide',
  layout: 'hero',
  panels: [defaultPanel(0), defaultPanel(0), defaultPanel(0), defaultPanel(0)],
  selectedPanel: 0,
  gradeStrength: 0.7,
  halftone: true,
  vignette: true,
  title: 'NEON COAST',
  subtitle: 'chase the sunset',
  tag: 'SUNSET SHORES',
  textPos: 'bottom',
  textSize: 1,
  textFill: 'sunset',
  outlineColor: '#14061f',
  stickers: [],
  selectedSticker: -1,
};

var photos = []; /* { img: Image, name: string, src: string } */
var activePhoto = 0;
var lastPanelRects = []; /* pixel rects from the latest render, for hit tests */
var halftonePattern = null;

var canvas = document.getElementById('cover');
var ctx = canvas.getContext('2d');
var statusEl = document.getElementById('status');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function makeHalftonePattern(c) {
  var dot = document.createElement('canvas');
  dot.width = 9; dot.height = 9;
  var d = dot.getContext('2d');
  d.fillStyle = '#000';
  d.beginPath(); d.arc(4.5, 4.5, 1.6, 0, Math.PI * 2); d.fill();
  return c.createPattern(dot, 'repeat');
}

function drawPhotoIntoPanel(c, img, panel, rect) {
  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  var base = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
  /* Clamp the pan so the photo always covers its panel: a wide panel
     with a panned photo would otherwise show the dark background. */
  var spanW = iw * base;
  var spanH = ih * base;
  var maxDx = Math.max(0, (spanW - rect.w) / 2 / rect.w);
  var maxDy = Math.max(0, (spanH - rect.h) / 2 / rect.h);
  var cx = Math.max(0.5 - maxDx, Math.min(0.5 + maxDx, panel.cx));
  var cy = Math.max(0.5 - maxDy, Math.min(0.5 + maxDy, panel.cy));
  var px = rect.x + rect.w * cx;
  var py = rect.y + rect.h * cy;
  c.save();
  c.beginPath();
  c.rect(rect.x, rect.y, rect.w, rect.h);
  c.clip();
  c.translate(px, py);
  c.rotate((panel.rot * Math.PI) / 180);
  c.scale(panel.flip ? -1 : 1, 1);
  if (panel.grade === 'sunset') c.filter = 'saturate(1.28) contrast(1.06)';
  else if (panel.grade === 'neon') c.filter = 'saturate(1.45) contrast(1.1)';
  else c.filter = 'none';
  c.drawImage(img, (-iw * base) / 2, (-ih * base) / 2, iw * base, ih * base);
  c.filter = 'none';
  applyGradeWash(c, panel, rect);
  c.restore();
}

function applyGradeWash(c, panel, rect) {
  var strength = state.gradeStrength;
  if (panel.grade === 'original' || strength <= 0) return;
  var g;
  if (panel.grade === 'sunset') {
    g = c.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, 'rgba(255, 122, 24, ' + (0.34 * strength) + ')');
    g.addColorStop(0.55, 'rgba(255, 64, 120, ' + (0.2 * strength) + ')');
    g.addColorStop(1, 'rgba(64, 16, 96, ' + (0.34 * strength) + ')');
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = g;
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
    c.globalCompositeOperation = 'source-over';
  } else if (panel.grade === 'neon') {
    g = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, 'rgba(255, 43, 214, ' + (0.3 * strength) + ')');
    g.addColorStop(0.5, 'rgba(120, 40, 255, ' + (0.14 * strength) + ')');
    g.addColorStop(1, 'rgba(0, 229, 212, ' + (0.3 * strength) + ')');
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = g;
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
    c.globalCompositeOperation = 'source-over';
  }
}

function drawFrameAndGutters(c, W, H, rects) {
  var gutter = Math.max(3, Math.round(W * 0.006));
  var i, r;
  c.save();
  c.lineJoin = 'miter';
  for (i = 0; i < rects.length; i++) {
    r = rects[i];
    c.strokeStyle = '#ffffff';
    c.lineWidth = gutter;
    c.strokeRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = 'rgba(10, 2, 24, 0.85)';
    c.lineWidth = Math.max(1, gutter * 0.22);
    c.strokeRect(r.x + gutter / 2, r.y + gutter / 2, r.w - gutter, r.h - gutter);
  }
  /* Outer white frame around the whole cover. */
  var frame = Math.max(6, Math.round(W * 0.014));
  c.strokeStyle = '#ffffff';
  c.lineWidth = frame;
  c.strokeRect(frame / 2, frame / 2, W - frame, H - frame);
  c.strokeStyle = 'rgba(10, 2, 24, 0.9)';
  c.lineWidth = Math.max(1, frame * 0.18);
  c.strokeRect(frame, frame, W - frame * 2, H - frame * 2);
  c.restore();
}

function drawHalftone(c, W, H) {
  if (!halftonePattern) halftonePattern = makeHalftonePattern(c);
  c.save();
  c.globalAlpha = 0.07;
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = halftonePattern;
  c.fillRect(0, 0, W, H);
  c.restore();
}

function drawVignette(c, W, H) {
  var g = c.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.72,
  );
  g.addColorStop(0, 'rgba(16, 2, 40, 0)');
  g.addColorStop(1, 'rgba(16, 2, 40, 0.38)');
  c.save();
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.restore();
}

/* --- Stickers, all drawn in code: palm, sun, bolt, star. --- */

function drawStickerShape(c, type, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  /* White halo first so the sticker reads on any photo. */
  c.strokeStyle = '#ffffff';
  c.fillStyle = '#ffffff';
  c.lineWidth = s * 0.09;
  drawStickerPath(c, type, s, true);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = s * 0.045;
  drawStickerPath(c, type, s, false);
  c.restore();
}

function drawStickerPath(c, type, s, halo) {
  var i, a;
  if (type === 'sun') {
    c.beginPath(); c.arc(0, 0, s * 0.34, 0, Math.PI * 2); c.fill();
    c.beginPath();
    for (i = 0; i < 8; i++) {
      a = (i * Math.PI) / 4;
      c.moveTo(Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.46);
      c.lineTo(Math.cos(a) * s * 0.62, Math.sin(a) * s * 0.62);
    }
    c.stroke();
  } else if (type === 'bolt') {
    c.beginPath();
    c.moveTo(s * 0.1, -s * 0.6); c.lineTo(-s * 0.34, s * 0.12); c.lineTo(-s * 0.02, s * 0.12);
    c.lineTo(-s * 0.1, s * 0.6); c.lineTo(s * 0.34, -s * 0.12); c.lineTo(s * 0.02, -s * 0.12);
    c.closePath(); c.fill();
    if (halo) c.stroke();
  } else if (type === 'star') {
    c.beginPath();
    for (i = 0; i < 10; i++) {
      a = (i * Math.PI) / 5 - Math.PI / 2;
      var r = i % 2 === 0 ? s * 0.6 : s * 0.26;
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fill();
    if (halo) c.stroke();
  } else { /* palm */
    c.beginPath();
    c.moveTo(0, s * 0.6);
    c.quadraticCurveTo(s * 0.08, s * 0.1, -s * 0.04, -s * 0.28);
    c.stroke();
    c.beginPath();
    var tips = [
      [-0.62, -0.34], [-0.5, -0.58], [-0.2, -0.68],
      [0.14, -0.68], [0.46, -0.56], [0.62, -0.3],
    ];
    for (i = 0; i < tips.length; i++) {
      c.moveTo(-s * 0.04, -s * 0.28);
      c.quadraticCurveTo(
        tips[i][0] * s * 0.55, -s * 0.28 + tips[i][1] * s * 0.28,
        tips[i][0] * s, -s * 0.28 + tips[i][1] * s,
      );
    }
    c.stroke();
    c.beginPath(); c.arc(-s * 0.12, -s * 0.2, s * 0.07, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(s * 0.06, -s * 0.24, s * 0.07, 0, Math.PI * 2); c.fill();
  }
}

var STICKER_COLORS = { palm: '#14061f', sun: '#ffcf3f', bolt: '#ffe93f', star: '#ff2bd6' };

function drawStickers(c, W, H) {
  state.stickers.forEach(function (st) {
    drawStickerShape(c, st.type, st.x * W, st.y * H, st.s * W, STICKER_COLORS[st.type] || '#14061f');
  });
}

/* --- Lettering --- */

function titleFillStyle(c, x, y, size, W) {
  if (state.textFill === 'white') return '#ffffff';
  var g = c.createLinearGradient(x - W * 0.3, y, x + W * 0.3, y);
  if (state.textFill === 'neon') {
    g.addColorStop(0, '#00f0ff'); g.addColorStop(0.55, '#c86bff'); g.addColorStop(1, '#ff2bd6');
  } else {
    g.addColorStop(0, '#ffd23f'); g.addColorStop(0.5, '#ff7a18'); g.addColorStop(1, '#ff2d78');
  }
  return g;
}

function fitFontSize(c, text, start, maxWidth) {
  var size = start;
  c.font = size + 'px Anton, "Arial Narrow", sans-serif';
  while (size > 24 && c.measureText(text).width > maxWidth) {
    size *= 0.92;
    c.font = size + 'px Anton, "Arial Narrow", sans-serif';
  }
  return size;
}

function drawTitleBlock(c, W, H, cx, cy, angle) {
  var base = W * 0.115 * state.textSize;
  var title = (state.title || 'NEON COAST').toUpperCase();
  c.save();
  c.translate(cx, cy);
  if (angle) c.rotate(angle);
  var size = fitFontSize(c, title, base, W * 0.92);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  try { c.letterSpacing = '2px'; } catch (e) { /* older canvas: ignore */ }
  /* Hard drop shadow. */
  c.font = size + 'px Anton, "Arial Narrow", sans-serif';
  c.fillStyle = 'rgba(8, 0, 20, 0.6)';
  c.fillText(title, size * 0.035, size * 0.05);
  /* Thick outline, then fill. */
  c.lineJoin = 'round';
  c.strokeStyle = state.outlineColor;
  c.lineWidth = Math.max(3, size * 0.14);
  c.strokeText(title, 0, 0);
  c.fillStyle = titleFillStyle(c, 0, 0, size, W);
  c.fillText(title, 0, 0);
  /* Subtitle under the title. */
  var sub = (state.subtitle || '').trim();
  if (sub) {
    var subSize = Math.max(14, size * 0.3);
    c.font = subSize + 'px Anton, "Arial Narrow", sans-serif';
    try { c.letterSpacing = '6px'; } catch (e) { /* ignore */ }
    c.fillStyle = 'rgba(8, 0, 20, 0.55)';
    c.fillText(sub.toUpperCase(), subSize * 0.04, size * 0.62 + subSize * 0.05);
    c.strokeStyle = state.outlineColor;
    c.lineWidth = Math.max(2, subSize * 0.16);
    c.strokeText(sub.toUpperCase(), 0, size * 0.62);
    c.fillStyle = '#ffffff';
    c.fillText(sub.toUpperCase(), 0, size * 0.62);
  }
  c.restore();
}

function drawCornerTag(c, W, H) {
  var tag = (state.tag || '').trim();
  if (!tag) return;
  var size = Math.max(13, W * 0.016);
  c.save();
  c.font = size + 'px Anton, "Arial Narrow", sans-serif';
  var tw = c.measureText(tag.toUpperCase()).width;
  var padX = size * 0.9;
  var padY = size * 0.55;
  var x = state.textPos === 'top' ? W - tw - padX * 2 - W * 0.03 : W - tw - padX * 2 - W * 0.03;
  var y = state.textPos === 'top' ? H - (size + padY * 2) - H * 0.03 : H * 0.03;
  c.translate(x + (tw + padX * 2) / 2, y + (size + padY * 2) / 2);
  c.rotate(-0.06);
  c.fillStyle = '#ff2bd6';
  c.strokeStyle = '#ffffff';
  c.lineWidth = Math.max(2, size * 0.12);
  roundRect(c, -(tw + padX * 2) / 2, -(size + padY * 2) / 2, tw + padX * 2, size + padY * 2, size * 0.35);
  c.fill();
  c.stroke();
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(tag.toUpperCase(), 0, size * 0.06);
  c.restore();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawLettering(c, W, H) {
  var base = W * 0.115 * state.textSize;
  if (state.textPos === 'top') {
    drawTitleBlock(c, W, H, W / 2, H * 0.09 + base * 0.5, 0);
  } else if (state.textPos === 'diagonal') {
    c.save();
    c.translate(W / 2, H * 0.62);
    c.rotate(-0.13);
    c.fillStyle = 'rgba(10, 0, 26, 0.45)';
    c.fillRect(-W * 0.62, -base * 0.85, W * 1.24, base * 1.7);
    c.restore();
    drawTitleBlock(c, W, H, W / 2, H * 0.62, -0.13);
  } else {
    drawTitleBlock(c, W, H, W / 2, H * 0.9 - base * 0.5, 0);
  }
  drawCornerTag(c, W, H);
}

/* --- The one render path: preview and export share it. --- */

function renderCover(c, W, H, trackRects) {
  c.save();
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#0d0a14';
  c.fillRect(0, 0, W, H);
  var rects = LAYOUTS[state.layout].map(function (p) {
    return { x: p.x * W, y: p.y * H, w: p.w * W, h: p.h * H };
  });
  /* Only the preview's rects are used for click/drag hit tests: an export
     renders at a different size and must not overwrite them. */
  if (trackRects) lastPanelRects = rects;
  rects.forEach(function (rect, i) {
    var panel = state.panels[i];
    var photo = photos[panel.photo];
    if (photo && photo.img.complete && photo.img.naturalWidth) {
      drawPhotoIntoPanel(c, photo.img, panel, rect);
    } else {
      c.fillStyle = '#241a3a';
      c.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  });
  drawFrameAndGutters(c, W, H, rects);
  if (state.halftone) drawHalftone(c, W, H);
  if (state.vignette) drawVignette(c, W, H);
  drawStickers(c, W, H);
  drawLettering(c, W, H);
  c.restore();
}

function renderPreview() {
  var size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  renderCover(ctx, size.w, size.h, true);
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

function addPhoto(img, name, src) {
  photos.push({ img: img, name: name, src: src || '' });
  activePhoto = photos.length - 1;
  refreshTray();
  renderPreview();
}

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error('Could not load ' + src)); };
    img.src = src;
  });
}

function loadSample(name) {
  var sample = SAMPLES.filter(function (s) { return s.src.indexOf(name) !== -1; })[0] || SAMPLES[0];
  var existing = photos.filter(function (p) { return p.src === sample.src; })[0];
  if (existing) {
    activePhoto = photos.indexOf(existing);
    refreshTray();
    setStatus('Sample photo is already loaded — it is the active photo.');
    return Promise.resolve();
  }
  return loadImage(sample.src).then(function (img) {
    addPhoto(img, sample.name, sample.src);
    setStatus('Sample photo loaded. Pick a layout, then export a PNG.');
  }).catch(function (err) {
    setStatus('Could not load the sample photo: ' + err.message);
  });
}

function loadFilePhoto(file) {
  var reader = new FileReader();
  reader.onload = function () {
    var img = new Image();
    img.onload = function () {
      addPhoto(img, file.name, '');
      setStatus('Loaded ' + file.name + ' — click a panel, then “Fill with active photo”.');
    };
    img.onerror = function () { setStatus('Could not read ' + file.name + ' as a photo.'); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function refreshTray() {
  var tray = document.getElementById('photoTray');
  tray.innerHTML = '';
  photos.forEach(function (p, i) {
    var thumb = document.createElement('img');
    thumb.src = p.img.src;
    thumb.alt = p.name;
    thumb.title = p.name + ' — click to make active, double-click to fill the selected panel';
    if (i === activePhoto) thumb.className = 'active';
    thumb.addEventListener('click', function () {
      activePhoto = i;
      refreshTray();
    });
    thumb.addEventListener('dblclick', function () {
      activePhoto = i;
      fillSelectedPanel();
    });
    tray.appendChild(thumb);
  });
  var count = document.getElementById('photoCount');
  if (count) count.textContent = photos.length ? photos.length + (photos.length === 1 ? ' photo' : ' photos') + ' loaded' : 'No photos yet';
}

/* ------------------------------------------------------------------ */
/* Panel actions                                                       */
/* ------------------------------------------------------------------ */

function selectedPanelState() {
  return state.panels[state.selectedPanel];
}

function fillSelectedPanel() {
  if (!photos.length) { setStatus('Load a photo first.'); return; }
  var panel = selectedPanelState();
  panel.photo = activePhoto;
  renderPreview();
  setStatus('Panel ' + (state.selectedPanel + 1) + ' filled with ' + photos[activePhoto].name + '.');
}

function autoFillAll() {
  if (!photos.length) { setStatus('Load a photo first — try “Load sample photo”.'); return; }
  var rects = LAYOUTS[state.layout];
  rects.forEach(function (_, i) {
    var p = state.panels[i];
    p.photo = i % photos.length;
    p.cx = 0.3 + 0.2 * (i % 3);
    p.cy = 0.35 + 0.18 * ((i + 1) % 3);
    p.zoom = 1.2;
    p.rot = (i % 2 === 0 ? -1 : 1) * 1.5;
    p.grade = state.panels[0].grade;
  });
  renderPreview();
  setStatus('All panels filled — drag any photo to reposition it.');
}

function applyPreset(name) {
  var preset = PRESETS[name];
  if (!preset) return;
  state.layout = preset.layout;
  state.gradeStrength = preset.gradeStrength;
  state.textFill = preset.textFill;
  state.outlineColor = preset.outlineColor;
  state.textPos = preset.textPos;
  state.halftone = preset.halftone;
  state.vignette = preset.vignette;
  state.panels.forEach(function (p) { p.grade = preset.grade; });
  syncControls();
  renderPreview();
  setStatus('Preset “' + name + '” applied — tweak anything, then export.');
}

function randomiseLook() {
  var layouts = Object.keys(LAYOUTS);
  var fills = ['sunset', 'white', 'neon'];
  var outlines = ['#14061f', '#ff2bd6', '#00e5d4', '#ffffff'];
  var positions = ['top', 'bottom', 'diagonal'];
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  var grade = GRADES[Math.floor(Math.random() * GRADES.length)];
  state.panels.forEach(function (p) { p.grade = grade; });
  state.gradeStrength = 0.5 + Math.random() * 0.5;
  state.textFill = fills[Math.floor(Math.random() * fills.length)];
  state.outlineColor = outlines[Math.floor(Math.random() * outlines.length)];
  state.textPos = positions[Math.floor(Math.random() * positions.length)];
  state.textSize = 0.85 + Math.random() * 0.4;
  if (Math.random() < 0.6) addSticker(['palm', 'sun', 'bolt', 'star'][Math.floor(Math.random() * 4)]);
  syncControls();
  renderPreview();
  setStatus('Randomised — keep it or hit Randomise again.');
}

function addSticker(type) {
  state.stickers.push({
    type: type,
    x: 0.15 + Math.random() * 0.7,
    y: 0.15 + Math.random() * 0.6,
    s: 0.05 + Math.random() * 0.03,
    rot: (Math.random() - 0.5) * 0.3,
  });
  state.selectedSticker = state.stickers.length - 1;
  renderPreview();
  setStatus('Sticker added — drag it on the cover to place it.');
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

function exportPNGDataURL(sizeKey) {
  return new Promise(function (resolve) {
    var size = SIZES[sizeKey];
    var off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    renderCover(off.getContext('2d'), size.w, size.h);
    resolve(off.toDataURL('image/png'));
  });
}

function downloadPNG(sizeKey) {
  var size = SIZES[sizeKey];
  var off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderCover(off.getContext('2d'), size.w, size.h);
  off.toBlob(function (blob) {
    if (!blob) { setStatus('Export failed — the browser could not make the PNG.'); return; }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vice-city-cover-' + sizeKey + '-' + size.w + 'x' + size.h + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    setStatus('Exported ' + size.label + ' PNG — check your downloads.');
  }, 'image/png');
}

function exportAllSizes() {
  var keys = ['wide', 'square', 'portrait'];
  var i = 0;
  (function next() {
    if (i >= keys.length) { setStatus('All three PNGs exported.'); return; }
    downloadPNG(keys[i]);
    i++;
    setTimeout(next, 450);
  })();
}

function copyPNG() {
  var size = SIZES[state.size];
  var off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderCover(off.getContext('2d'), size.w, size.h);
  off.toBlob(function (blob) {
    if (!blob) { setStatus('Copy failed — the browser could not make the PNG.'); return; }
    if (!navigator.clipboard || !window.ClipboardItem) {
      setStatus('This browser cannot copy images — use “Download all three sizes” instead.');
      return;
    }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
      function () { setStatus('PNG copied — paste it straight into your post.'); },
      function () { setStatus('Copy was blocked — use “Download all three sizes” instead.'); },
    );
  }, 'image/png');
}

/* ------------------------------------------------------------------ */
/* Pointer interaction on the preview                                  */
/* ------------------------------------------------------------------ */

function canvasPoint(ev) {
  var r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * canvas.width,
    y: ((ev.clientY - r.top) / r.height) * canvas.height,
  };
}

function panelAt(x, y) {
  for (var i = lastPanelRects.length - 1; i >= 0; i--) {
    var r = lastPanelRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function stickerAt(x, y) {
  for (var i = state.stickers.length - 1; i >= 0; i--) {
    var st = state.stickers[i];
    var dx = x - st.x * canvas.width;
    var dy = y - st.y * canvas.height;
    if (Math.sqrt(dx * dx + dy * dy) < st.s * canvas.width * 0.7) return i;
  }
  return -1;
}

var drag = null;

canvas.addEventListener('pointerdown', function (ev) {
  var pt = canvasPoint(ev);
  var si = stickerAt(pt.x, pt.y);
  if (si >= 0) {
    state.selectedSticker = si;
    drag = { kind: 'sticker', index: si, lastX: pt.x, lastY: pt.y };
    canvas.setPointerCapture(ev.pointerId);
    return;
  }
  var pi = panelAt(pt.x, pt.y);
  if (pi >= 0) {
    state.selectedPanel = pi;
    state.selectedSticker = -1;
    var panel = state.panels[pi];
    var rect = lastPanelRects[pi];
    drag = { kind: 'panel', index: pi, lastX: pt.x, lastY: pt.y, rect: rect, panel: panel };
    canvas.setPointerCapture(ev.pointerId);
    syncPanelControls();
    renderPreview();
  }
});

canvas.addEventListener('pointermove', function (ev) {
  if (!drag) return;
  var pt = canvasPoint(ev);
  var dx = pt.x - drag.lastX;
  var dy = pt.y - drag.lastY;
  drag.lastX = pt.x;
  drag.lastY = pt.y;
  if (drag.kind === 'sticker') {
    var st = state.stickers[drag.index];
    st.x += dx / canvas.width;
    st.y += dy / canvas.height;
    st.x = Math.max(0.02, Math.min(0.98, st.x));
    st.y = Math.max(0.02, Math.min(0.98, st.y));
  } else {
    var panel = drag.panel;
    var rect = drag.rect;
    panel.cx -= dx / (rect.w * panel.zoom);
    panel.cy -= dy / (rect.h * panel.zoom);
    panel.cx = Math.max(-0.5, Math.min(1.5, panel.cx));
    panel.cy = Math.max(-0.5, Math.min(1.5, panel.cy));
  }
  renderPreview();
});

canvas.addEventListener('pointerup', function () { drag = null; });
canvas.addEventListener('pointercancel', function () { drag = null; });

canvas.addEventListener('wheel', function (ev) {
  ev.preventDefault();
  var panel = selectedPanelState();
  var factor = ev.deltaY < 0 ? 1.06 : 1 / 1.06;
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * factor));
  syncPanelControls();
  renderPreview();
}, { passive: false });

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function $(id) { return document.getElementById(id); }

function bindSeg(id, attr, fn) {
  var seg = $(id);
  seg.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button');
    if (!btn) return;
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    fn(btn.getAttribute(attr));
  });
}

function syncPanelControls() {
  var panel = selectedPanelState();
  $('panelLabel').textContent = '— panel ' + (state.selectedPanel + 1);
  $('zoom').value = panel.zoom;
  $('zoomVal').textContent = panel.zoom.toFixed(2) + '×';
  $('rotate').value = panel.rot;
  $('rotateVal').textContent = panel.rot.toFixed(1) + '°';
  $('panelGrade').value = panel.grade;
}

function syncControls() {
  bindSegState('layoutSeg', 'data-layout', state.layout);
  bindSegState('sizeSeg', 'data-size', state.size);
  bindSegState('textPosSeg', 'data-pos', state.textPos);
  $('gradeStrength').value = state.gradeStrength;
  $('gradeStrengthVal').textContent = Math.round(state.gradeStrength * 100) + '%';
  $('halftone').checked = state.halftone;
  $('vignette').checked = state.vignette;
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('tag').value = state.tag;
  $('textSize').value = state.textSize;
  $('textSizeVal').textContent = Math.round(state.textSize * 100) + '%';
  $('textFill').value = state.textFill;
  $('outlineColor').value = state.outlineColor;
  syncPanelControls();
}

function bindSegState(id, attr, value) {
  var seg = $(id);
  Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
    b.classList.toggle('active', b.getAttribute(attr) === value);
  });
}

bindSeg('layoutSeg', 'data-layout', function (v) { state.layout = v; renderPreview(); });
bindSeg('sizeSeg', 'data-size', function (v) { state.size = v; renderPreview(); });
bindSeg('textPosSeg', 'data-pos', function (v) { state.textPos = v; renderPreview(); });

$('zoom').addEventListener('input', function () {
  selectedPanelState().zoom = parseFloat(this.value);
  $('zoomVal').textContent = parseFloat(this.value).toFixed(2) + '×';
  renderPreview();
});
$('rotate').addEventListener('input', function () {
  selectedPanelState().rot = parseFloat(this.value);
  $('rotateVal').textContent = parseFloat(this.value).toFixed(1) + '°';
  renderPreview();
});
$('btnFlip').addEventListener('click', function () {
  var p = selectedPanelState();
  p.flip = !p.flip;
  renderPreview();
});
$('btnFillPanel').addEventListener('click', fillSelectedPanel);
$('panelGrade').addEventListener('change', function () {
  selectedPanelState().grade = this.value;
  renderPreview();
});
$('gradeStrength').addEventListener('input', function () {
  state.gradeStrength = parseFloat(this.value);
  $('gradeStrengthVal').textContent = Math.round(state.gradeStrength * 100) + '%';
  renderPreview();
});
$('halftone').addEventListener('change', function () { state.halftone = this.checked; renderPreview(); });
$('vignette').addEventListener('change', function () { state.vignette = this.checked; renderPreview(); });
$('title').addEventListener('input', function () { state.title = this.value; renderPreview(); });
$('subtitle').addEventListener('input', function () { state.subtitle = this.value; renderPreview(); });
$('tag').addEventListener('input', function () { state.tag = this.value; renderPreview(); });
$('textSize').addEventListener('input', function () {
  state.textSize = parseFloat(this.value);
  $('textSizeVal').textContent = Math.round(state.textSize * 100) + '%';
  renderPreview();
});
$('textFill').addEventListener('change', function () { state.textFill = this.value; renderPreview(); });
$('outlineColor').addEventListener('change', function () { state.outlineColor = this.value; renderPreview(); });

document.querySelectorAll('[data-preset]').forEach(function (btn) {
  btn.addEventListener('click', function () { applyPreset(btn.getAttribute('data-preset')); });
});
document.querySelectorAll('[data-sticker]').forEach(function (btn) {
  btn.addEventListener('click', function () { addSticker(btn.getAttribute('data-sticker')); });
});
document.querySelectorAll('[data-export]').forEach(function (btn) {
  btn.addEventListener('click', function () { downloadPNG(btn.getAttribute('data-export')); });
});

$('btnDeleteSticker').addEventListener('click', function () {
  if (state.selectedSticker < 0) { setStatus('No sticker selected — click a sticker on the cover first.'); return; }
  state.stickers.splice(state.selectedSticker, 1);
  state.selectedSticker = -1;
  renderPreview();
  setStatus('Sticker removed.');
});
$('btnRandom').addEventListener('click', randomiseLook);
$('btnExportAll').addEventListener('click', exportAllSizes);
$('btnCopyPng').addEventListener('click', copyPNG);
$('btnAutoFill').addEventListener('click', autoFillAll);
$('btnSample').addEventListener('click', function () { loadSample('sample-sunset'); });
$('fileInput').addEventListener('change', function () {
  var files = Array.prototype.slice.call(this.files || []);
  files.filter(function (f) { return f.type.indexOf('image/') === 0; }).forEach(loadFilePhoto);
  this.value = '';
});

/* Drag-and-drop photos straight onto the preview. */
canvas.addEventListener('dragover', function (ev) { ev.preventDefault(); });
canvas.addEventListener('drop', function (ev) {
  ev.preventDefault();
  var files = Array.prototype.slice.call(ev.dataTransfer.files || []);
  files.filter(function (f) { return f.type.indexOf('image/') === 0; }).forEach(loadFilePhoto);
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

syncControls();

/* Preload both samples so the editor is never empty, then render. */
Promise.all(SAMPLES.map(function (s) {
  return loadImage(s.src).then(function (img) {
    photos.push({ img: img, name: s.name, src: s.src });
  }).catch(function () { /* a missing sample is not fatal */ });
})).then(function () {
  if (document.fonts && document.fonts.load) {
    return document.fonts.load('100px Anton').catch(function () {});
  }
}).then(function () {
  activePhoto = 0;
  refreshTray();
  renderPreview();
  setStatus(photos.length
    ? 'Sample photos loaded. Pick a layout, edit the caption, then export a PNG.'
    : 'No sample photo found — upload a photo to start.');
});

/* Automation hook for local testing and screenshots: the app's own
   export path, so screenshots are real renders of this app. */
window.coverStudio = {
  state: state,
  photos: photos,
  renderPreview: renderPreview,
  exportPNGDataURL: exportPNGDataURL,
  setLayout: function (layout) { state.layout = layout; renderPreview(); },
  setSize: function (size) { state.size = size; renderPreview(); },
  applyPreset: applyPreset,
  loadSample: loadSample,
  autoFillAll: autoFillAll,
};
