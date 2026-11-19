/* PULSE project page v2 — interactive parts.
   No external libraries; works from file://.
   - Hero traces and modality cards draw from window.PULSE_PREVIEW (assets/sample_preview.js, ~30 KB).
   - The viewer loads assets/sample.js on demand (when it nears the viewport, or shortly after page load).
   v1/assets/app.js is unchanged; this file is the review revision. */
(function () {
  'use strict';

  var root = document.documentElement;
  var MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace';
  var SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  /* ------------------------------------------------------------ theme */
  var themeBtn = document.getElementById('themeBtn');
  var MODES = ['auto', 'light', 'dark'];
  var themeListeners = [];
  var palette = null;

  function currentMode() {
    var t = root.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  }
  function updateThemeBtn() {
    if (!themeBtn) return;
    var m = currentMode();
    themeBtn.dataset.mode = m;
    themeBtn.querySelector('.theme-txt').textContent = m === 'auto' ? 'Auto' : (m === 'light' ? 'Light' : 'Dark');
    themeBtn.setAttribute('aria-label', 'Color theme: ' + (m === 'auto' ? 'follows system' : m) + '. Click to change.');
  }
  function notifyTheme() {
    palette = null;
    for (var i = 0; i < themeListeners.length; i++) {
      try { themeListeners[i](); } catch (e) { if (window.console) console.error(e); }
    }
  }
  function setMode(m) {
    if (m === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', m);
    try { if (m === 'auto') localStorage.removeItem('pulse-theme'); else localStorage.setItem('pulse-theme', m); } catch (e) {}
    updateThemeBtn();
    notifyTheme();
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      setMode(MODES[(MODES.indexOf(currentMode()) + 1) % MODES.length]);
    });
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', notifyTheme);
    else if (mq.addListener) mq.addListener(notifyTheme);
  }
  updateThemeBtn();

  function P() {
    if (palette) return palette;
    var cs = getComputedStyle(root);
    function v(n) { return cs.getPropertyValue(n).trim(); }
    palette = {
      ink: v('--ink'), ink2: v('--ink-2'), muted: v('--muted'), faint: v('--faint'),
      rule: v('--rule'), rule2: v('--rule-2'), surface: v('--surface'), surface2: v('--surface-2'),
      accent: v('--accent'), accentInk: v('--accent-ink'), accentSoft: v('--accent-soft'),
      mocap: v('--c-mocap'), emg: v('--c-emg'), gaze: v('--c-gaze'), imu: v('--c-imu'), press: v('--c-press'),
      emgLo: v('--emg-lo'), emgHi: v('--emg-hi'), pressLo: v('--press-lo'), pressHi: v('--press-hi')
    };
    return palette;
  }
  function hexRgb(h) {
    h = (h || '#000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function ramp(lo, hi) {
    var a = hexRgb(lo), b = hexRgb(hi);
    return function (x) {
      x = x < 0 ? 0 : (x > 1 ? 1 : x);
      return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * x) + ',' + Math.round(a[1] + (b[1] - a[1]) * x) + ',' + Math.round(a[2] + (b[2] - a[2]) * x) + ')';
    };
  }
  function alpha(hex, a) {
    var c = hexRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* ------------------------------------------------------------ tooltip: hover with a mouse, tap on touch screens */
  var tip = document.getElementById('tooltip');
  var tipTarget = null;
  function placeTip(x, y) {
    var r = tip.getBoundingClientRect();
    var left = x + 14, top = y - r.height - 10;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (left < 8) left = 8;
    if (top < 8) top = y + 16;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function showTip(el, x, y) {
    if (tipTarget && tipTarget !== el) tipTarget.classList.remove('is-tip');
    tipTarget = el;
    el.classList.add('is-tip');
    tip.textContent = el.getAttribute('data-tip');
    tip.hidden = false;
    placeTip(x, y);
  }
  function hideTip() {
    if (tipTarget) tipTarget.classList.remove('is-tip');
    tipTarget = null;
    tip.hidden = true;
  }
  if (tip) {
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var el = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (el) showTip(el, e.clientX, e.clientY);
    });
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse' && tipTarget) placeTip(e.clientX, e.clientY);
    });
    document.addEventListener('pointerout', function (e) {
      if (e.pointerType !== 'mouse' || !tipTarget) return;
      var to = e.relatedTarget;
      if (to && tipTarget.contains(to)) return;
      hideTip();
    });
    document.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'mouse') return;
      var el = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (!el) { if (tipTarget) hideTip(); return; }
      if (el === tipTarget) { hideTip(); return; }
      var r = el.getBoundingClientRect();
      showTip(el, r.left + r.width / 2, r.top);
    });
    window.addEventListener('scroll', function () { if (tipTarget) hideTip(); }, { passive: true });
  }

  /* ------------------------------------------------------------ nav highlight (+ keep the active link visible on narrow screens) */
  (function () {
    var nav = document.querySelector('.nav');
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
    if (!nav || !links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var visible = {};
    var current = null;
    function reveal(a) {
      if (nav.scrollWidth <= nav.clientWidth + 1) return;
      var l = a.offsetLeft, r = l + a.offsetWidth;
      if (l < nav.scrollLeft + 4 || r > nav.scrollLeft + nav.clientWidth * 0.86) {
        var target = Math.max(0, l - 12);
        try { nav.scrollTo({ left: target, behavior: 'smooth' }); } catch (e) { nav.scrollLeft = target; }
      }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.intersectionRatio : 0; });
      var best = null, bestV = 0;
      Object.keys(visible).forEach(function (k) { if (visible[k] > bestV) { bestV = visible[k]; best = k; } });
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (best && map[best]) {
        map[best].setAttribute('aria-current', 'true');
        if (current !== best) { current = best; reveal(map[best]); }
      }
    }, { rootMargin: '-60px 0px -45% 0px', threshold: [0, 0.1, 0.3, 0.6] });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  })();

  /* ------------------------------------------------------------ tabs */
  (function () {
    var box = document.getElementById('resultTabs');
    if (!box) return;
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    function select(i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
      t.addEventListener('keydown', function (e) {
        var k = null;
        if (e.key === 'ArrowRight') k = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') k = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') k = 0;
        else if (e.key === 'End') k = tabs.length - 1;
        if (k !== null) { e.preventDefault(); select(k, true); }
      });
    });
    box.classList.add('is-ready');
    select(0, false);
  })();

  /* ------------------------------------------------------------ copy BibTeX */
  (function () {
    var btn = document.getElementById('copyBib');
    if (!btn) return;
    var pre = document.getElementById(btn.getAttribute('data-target'));
    function done(msg) {
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = 'Copy BibTeX'; }, 1800);
    }
    function selectText() {
      var range = document.createRange();
      range.selectNodeContents(pre);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    btn.addEventListener('click', function () {
      var text = pre.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done('Copied'); }, function () { selectText(); done('Press Ctrl+C'); });
      } else {
        selectText();
        try { done(document.execCommand('copy') ? 'Copied' : 'Press Ctrl+C'); } catch (e) { done('Press Ctrl+C'); }
      }
    });
  })();

  /* ------------------------------------------------------------ canvas + series helpers */
  function fit(canvas) {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h, dpr: dpr };
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function series(data, rate, t0) { return { data: data, rate: rate, t0: t0 || 0 }; }
  function maxOf(arrs) {
    var m = 0;
    arrs.forEach(function (a) { for (var i = 0; i < a.length; i++) { var v = a[i]; if (v !== null && v > m) m = v; } });
    return m || 1;
  }
  function valueAt(ser, t) {
    var x = (t - ser.t0) * ser.rate;
    var n = ser.data.length;
    if (x <= 0) return ser.data[0];
    if (x >= n - 1) return ser.data[n - 1];
    var i = Math.floor(x), f = x - i;
    var a = ser.data[i], b = ser.data[i + 1];
    if (a === null || b === null || a === undefined || b === undefined) return f < 0.5 ? a : b;
    return a + (b - a) * f;
  }
  // T = window length in seconds (18 s for both the preview and the viewer sample)
  function drawLine(ctx, ser, T, x, y, w, h, vmin, vmax, color, dash, lw) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y - 1, w, h + 2); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    var pen = false, n = ser.data.length;
    for (var k = 0; k < n; k++) {
      var v = ser.data[k];
      if (v === null || v === undefined || isNaN(v)) { pen = false; continue; }
      var t = ser.t0 + k / ser.rate;
      var px = x + (t / T) * w;
      var py = y + h - ((v - vmin) / (vmax - vmin)) * h;
      if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  // rows[c][k] in 0..1, drawn as a heat strip
  function drawHeat(ctx, rows, x, y, w, h, gap) {
    var pal = P(), col = ramp(pal.emgLo, pal.emgHi);
    var nch = rows.length, n = rows[0].length;
    gap = gap === undefined ? 1 : gap;
    var rh = (h - gap * (nch - 1)) / nch;
    var cw = w / n;
    for (var c = 0; c < nch; c++) {
      var ry = y + c * (rh + gap);
      for (var k = 0; k < n; k++) {
        ctx.fillStyle = col(rows[c][k]);
        ctx.fillRect(x + k * cw, ry, cw + 0.6, rh);
      }
    }
  }
  function drawSegTicks(ctx, segs, T, x, y, w, h, color) {
    ctx.fillStyle = color;
    segs.forEach(function (s) {
      var x0 = x + (s.start / T) * w, x1 = x + (s.end / T) * w;
      roundRect(ctx, x0 + 1, y, Math.max(2, x1 - x0 - 2), h, Math.min(2, h / 2));
      ctx.fill();
    });
  }

  /* ------------------------------------------------------------ hero traces + modality cards (preview data) */
  var PV = window.PULSE_PREVIEW || null;
  var heroCanvas = document.getElementById('heroTraces');
  var previews = Array.prototype.slice.call(document.querySelectorAll('canvas[data-preview]'));
  var PD = null;
  if (PV) {
    var sr = PV.series, R = PV.rate;
    PD = {
      T: PV.duration,
      segs: PV.segments || [],
      mocapR: series(sr.mocapR, R), mocapL: series(sr.mocapL, R),
      emgMean: series(sr.emgMean, R),
      gazeX: series(sr.gazeX, R), gazeY: series(sr.gazeY, R),
      imuR: series(sr.imuR, R), imuL: series(sr.imuL, R),
      pressR: series(sr.pressR, R), pressL: series(sr.pressL, R),
      heat: PV.emgHeat
    };
    PD.mocapMax = maxOf([sr.mocapR, sr.mocapL]) * 1.08;
    PD.imuMax = maxOf([sr.imuR, sr.imuL]) * 1.08;
    PD.pressMax = maxOf([sr.pressR, sr.pressL]) * 1.08;
    PD.emgMax = maxOf([sr.emgMean]) * 1.08;
  }

  function drawHero() {
    if (!heroCanvas || !PD) return;
    var f = fit(heroCanvas), ctx = f.ctx, w = f.w, h = f.h, pal = P(), T = PD.T;
    ctx.clearRect(0, 0, w, h);
    var narrow = w < 560;
    var L = narrow ? 74 : 104, Rm = 14, top = 12, bottom = 26;
    var rows = [
      { name: 'MoCap', color: pal.mocap, ser: PD.mocapR, vmax: PD.mocapMax },
      { name: 'EMG', color: pal.emg, ser: PD.emgMean, vmax: PD.emgMax },
      { name: 'Gaze', color: pal.gaze, ser: PD.gazeX, vmin: 0, vmax: 1 },
      { name: 'IMU', color: pal.imu, ser: PD.imuR, vmax: PD.imuMax },
      { name: 'Pressure', color: pal.press, ser: PD.pressR, vmax: PD.pressMax }
    ];
    var segH = 6, gap = 6;
    var ph = (h - top - bottom - segH - 8 - gap * (rows.length - 1)) / rows.length;
    var pw = w - L - Rm;
    ctx.strokeStyle = pal.rule; ctx.lineWidth = 1;
    for (var s = 0; s <= T; s += 2) {
      var gx = Math.round(L + (s / T) * pw) + 0.5;
      ctx.beginPath(); ctx.moveTo(gx, top - 4); ctx.lineTo(gx, h - bottom + 2); ctx.stroke();
    }
    rows.forEach(function (r, i) {
      var y = top + i * (ph + gap);
      var lx = narrow ? 8 : 14;
      ctx.fillStyle = r.color;
      ctx.fillRect(lx, Math.round(y + ph / 2 - 4), 8, 8);
      ctx.fillStyle = pal.ink; ctx.font = '600 ' + (narrow ? 11.5 : 13) + 'px ' + SANS; ctx.textBaseline = 'middle';
      ctx.fillText(r.name, lx + 13, y + ph / 2 + 0.5);
      ctx.strokeStyle = pal.rule; ctx.beginPath(); ctx.moveTo(L, Math.round(y + ph) + 0.5); ctx.lineTo(L + pw, Math.round(y + ph) + 0.5); ctx.stroke();
      drawLine(ctx, r.ser, T, L, y + 2, pw, ph - 3, r.vmin || 0, r.vmax, r.color, null, 1.6);
    });
    var sy = top + rows.length * (ph + gap) - gap + 6;
    drawSegTicks(ctx, PD.segs, T, L, sy, pw, segH, pal.ink2);
    ctx.fillStyle = pal.muted; ctx.font = '600 ' + (narrow ? 11.5 : 13) + 'px ' + SANS; ctx.textBaseline = 'middle';
    ctx.fillText('Actions', (narrow ? 8 : 14) + 13, sy + segH / 2);
    ctx.font = '11px ' + MONO; ctx.textBaseline = 'alphabetic';
    for (var s2 = 0; s2 <= T; s2 += (narrow ? 6 : 2)) {
      var tx0 = L + (s2 / T) * pw;
      var lab = s2 === T ? s2 + ' s' : String(s2);
      ctx.textAlign = s2 === 0 ? 'left' : (s2 === T ? 'right' : 'center');
      ctx.fillText(lab, tx0, h - 8);
    }
    ctx.textAlign = 'left';
  }

  function drawPreview(cv) {
    if (!PD) return;
    var kind = cv.getAttribute('data-preview');
    var f = fit(cv), ctx = f.ctx, w = f.w, h = f.h, pal = P(), T = PD.T;
    ctx.clearRect(0, 0, w, h);
    var x = 8, y = 8, pw = w - 16, ph = h - 24;
    ctx.strokeStyle = pal.rule; ctx.lineWidth = 1;
    for (var s = 0; s <= T; s += 2) {
      var gx = Math.round(x + (s / T) * pw) + 0.5;
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + ph); ctx.stroke();
    }
    if (kind === 'mocap') {
      drawLine(ctx, PD.mocapL, T, x, y, pw, ph, 0, PD.mocapMax, pal.mocap, [4, 3], 1.4);
      drawLine(ctx, PD.mocapR, T, x, y, pw, ph, 0, PD.mocapMax, pal.mocap, null, 1.6);
    } else if (kind === 'emg') {
      drawHeat(ctx, PD.heat, x, y, pw, ph, 1);
    } else if (kind === 'gaze') {
      drawLine(ctx, PD.gazeY, T, x, y, pw, ph, 0, 1, pal.gaze, [4, 3], 1.4);
      drawLine(ctx, PD.gazeX, T, x, y, pw, ph, 0, 1, pal.gaze, null, 1.6);
    } else if (kind === 'imu') {
      drawLine(ctx, PD.imuL, T, x, y, pw, ph, 0, PD.imuMax, pal.imu, [4, 3], 1.4);
      drawLine(ctx, PD.imuR, T, x, y, pw, ph, 0, PD.imuMax, pal.imu, null, 1.6);
    } else if (kind === 'press') {
      drawLine(ctx, PD.pressL, T, x, y, pw, ph, 0, PD.pressMax, pal.press, [4, 3], 1.4);
      drawLine(ctx, PD.pressR, T, x, y, pw, ph, 0, PD.pressMax, pal.press, null, 1.6);
    }
    drawSegTicks(ctx, PD.segs, T, x, h - 10, pw, 4, pal.rule2);
  }
  function drawAllStatic() {
    drawHero();
    previews.forEach(drawPreview);
  }

  /* ------------------------------------------------------------ viewer (full sample, loaded on demand) */
  var V = {
    root: document.getElementById('vRoot'),
    play: document.getElementById('vPlay'),
    time: document.getElementById('vTime'),
    scrub: document.getElementById('vScrub'),
    speed: document.getElementById('vSpeed'),
    reset: document.getElementById('vResetView'),
    skel: document.getElementById('vSkel'),
    gaze: document.getElementById('vGaze'),
    press: document.getElementById('vPress'),
    strip: document.getElementById('vStrip'),
    seg: document.getElementById('vSeg'),
    fallback: document.getElementById('vFallback')
  };
  var viewer = null; // set once the sample is loaded and the viewer is built

  function viewerFailed() {
    if (V.fallback) V.fallback.hidden = false;
    if (V.root) {
      V.root.classList.remove('is-loading');
      var g = V.root.querySelector('.v-grid'); if (g) g.hidden = true;
      if (V.seg) V.seg.hidden = true;
    }
  }

  function buildViewer(S) {
    var T = S.meta.duration;
    var segs = S.segments || [];

    function smooth(arr, r) {
      var out = new Array(arr.length);
      for (var i = 0; i < arr.length; i++) {
        var s = 0, n = 0;
        for (var k = i - r; k <= i + r; k++) {
          if (k < 0 || k >= arr.length) continue;
          var v = arr[k];
          if (v === null || v === undefined || isNaN(v)) continue;
          s += v; n++;
        }
        out[i] = (arr[i] === null || arr[i] === undefined) ? null : (n ? s / n : null);
      }
      return out;
    }

    var MC = S.mocap;
    // v2 sample stores the frames delta-encoded (lossless); rebuild frames[t][j] = [x, y, z]
    if (!MC.frames && MC.frames_delta) {
      var npt = MC.names.length, d = MC.frames_delta, nf = MC.n_frames, frames = new Array(nf), prev = null, idx = 0;
      for (var t = 0; t < nf; t++) {
        var fr = new Array(npt);
        for (var j = 0; j < npt; j++) {
          var p = [0, 0, 0];
          for (var c = 0; c < 3; c++) { var dv = d[idx++]; p[c] = t === 0 ? dv : prev[j][c] + dv; }
          fr[j] = p;
        }
        frames[t] = fr; prev = fr;
      }
      MC.frames = frames;
    }
    var JI = {};
    MC.names.forEach(function (n, i) { JI[n] = i; });
    var gch = {};
    S.gaze.channels.forEach(function (c, i) { gch[c] = i; });
    var frameW = (S.gaze.scene_frame_px && S.gaze.scene_frame_px[0]) || 1;
    var frameH = (S.gaze.scene_frame_px && S.gaze.scene_frame_px[1]) || 1;
    function scaleArr(a, k) { return a.map(function (v) { return v === null ? null : v / k; }); }
    var ich = {};
    S.imu.channels.forEach(function (c, i) { ich[c] = i; });
    var imuIdx = {};
    S.imu.sensors.forEach(function (s, i) { imuIdx[s.id] = i; });
    function gyroMag(si) {
      var dd = S.imu.data[si], gx = dd[ich.gyro_x], gy = dd[ich.gyro_y], gz = dd[ich.gyro_z];
      var out = new Array(gx.length);
      for (var k = 0; k < gx.length; k++) {
        if (gx[k] === null || gy[k] === null || gz[k] === null) { out[k] = null; continue; }
        out[k] = Math.sqrt(gx[k] * gx[k] + gy[k] * gy[k] + gz[k] * gz[k]);
      }
      return smooth(out, 1);
    }
    function pressSum(side) {
      var n = S.pressure.data[0].length, out = new Array(n);
      for (var k = 0; k < n; k++) {
        var s = 0;
        for (var c = 0; c < S.pressure.data.length; c++) if (S.pressure.hand[c] === side) s += S.pressure.data[c][k] || 0;
        out[k] = s;
      }
      return out;
    }
    var emgMax = S.emg.data.map(function (ch) { return Math.max.apply(null, ch) || 1; });
    var emgNorm = S.emg.data.map(function (ch, c) { return ch.map(function (v) { return v / emgMax[c]; }); });

    var D = {
      gazeX: series(scaleArr(S.gaze.data[gch.gaze_x], frameW), S.gaze.rate, S.gaze.t0),
      gazeY: series(scaleArr(S.gaze.data[gch.gaze_y], frameH), S.gaze.rate, S.gaze.t0),
      fix: series(S.gaze.data[gch.fixation], S.gaze.rate, S.gaze.t0),
      sac: series(S.gaze.data[gch.saccade], S.gaze.rate, S.gaze.t0),
      imuR: series(gyroMag(imuIdx.WT8), S.imu.rate, S.imu.t0),
      imuL: series(gyroMag(imuIdx.WT9), S.imu.rate, S.imu.t0),
      pressR: series(pressSum('right'), S.pressure.rate, S.pressure.t0),
      pressL: series(pressSum('left'), S.pressure.rate, S.pressure.t0)
    };
    D.imuMax = maxOf([D.imuR.data, D.imuL.data]) * 1.08;
    D.pressMax = maxOf([D.pressR.data, D.pressL.data]) * 1.08;
    D.cellMax = (function () { var m = 0; S.pressure.data.forEach(function (c) { c.forEach(function (v) { if (v > m) m = v; }); }); return m || 1; })();
    var cellSer = S.pressure.data.map(function (c) { return series(c, S.pressure.rate, S.pressure.t0); });

    function segAt(t) {
      for (var i = 0; i < segs.length; i++) if (t >= segs[i].start && t < segs[i].end) return i;
      return -1;
    }

    var state = { t: 4.0, playing: false, speed: 1, last: null, raf: 0, segIdx: -2, az: 0, el: 0.3, sliderDrag: false };

    // the camera follows a smoothed torso point so the body stays framed while the volunteer moves
    var spineC = (function () {
      var F = MC.frames, j = JI.Spine1 !== undefined ? JI.Spine1 : 0, n = F.length, out = new Array(n), r = 6;
      for (var k = 0; k < n; k++) {
        var sx = 0, sy = 0, sz = 0, c = 0;
        for (var m = k - r; m <= k + r; m++) {
          if (m < 0 || m >= n) continue;
          var p = F[m][j]; sx += p[0]; sy += p[1]; sz += p[2]; c++;
        }
        out[k] = [sx / c, sy / c, sz / c];
      }
      return out;
    })();
    function spineAt(t) {
      var x = (t - MC.t0) * MC.rate, n = spineC.length;
      var i = Math.max(0, Math.min(n - 1, Math.floor(x))), j = Math.min(n - 1, i + 1), f = Math.max(0, Math.min(1, x - i));
      var A = spineC[i], B = spineC[j];
      return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f];
    }
    var fitCache = { key: '', v: null };
    function viewFit(cam) {
      var key = state.az.toFixed(3) + ',' + state.el.toFixed(3);
      if (fitCache.key === key) return fitCache.v;
      var F = MC.frames, minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      for (var k = 0; k < F.length; k += 3) {
        var c = spineC[k], fr = F[k];
        for (var j = 0; j < fr.length; j++) {
          var q0 = fr[j][0] - c[0], q1 = fr[j][1] - c[1], q2 = fr[j][2] - c[2];
          var sx = q0 * cam.right[0] + q1 * cam.right[1] + q2 * cam.right[2];
          var sy = q0 * cam.up[0] + q1 * cam.up[1] + q2 * cam.up[2];
          if (sx < minx) minx = sx; if (sx > maxx) maxx = sx;
          if (sy < miny) miny = sy; if (sy > maxy) maxy = sy;
        }
      }
      maxy += 170; // head outline drawn above the Head joint
      var v = { minx: minx, maxx: maxx, miny: miny, maxy: maxy };
      fitCache = { key: key, v: v };
      return v;
    }
    (function () {
      var F = MC.frames;
      var rx = 0, ry = 0;
      F.forEach(function (fr) { var a = fr[JI.LeftShoulder], b = fr[JI.RightShoulder]; rx += b[0] - a[0]; ry += b[1] - a[1]; });
      var fx = -ry, fy = rx; // forward = up x right
      state.baseAz = Math.atan2(fy, fx) + 0.5;
      state.az = state.baseAz;
      state.baseEl = 0.32;
      state.el = state.baseEl;
    })();

    function camera() {
      var ca = Math.cos(state.az), sa = Math.sin(state.az), ce = Math.cos(state.el), se = Math.sin(state.el);
      var c = [ce * ca, ce * sa, se];
      var d = [-c[0], -c[1], -c[2]];
      var rl = Math.sqrt(d[1] * d[1] + d[0] * d[0]) || 1;
      var right = [d[1] / rl, -d[0] / rl, 0];
      var up = [right[1] * d[2] - right[2] * d[1], right[2] * d[0] - right[0] * d[2], right[0] * d[1] - right[1] * d[0]];
      return { d: d, right: right, up: up };
    }
    function frameAt(t) {
      var x = (t - MC.t0) * MC.rate, F = MC.frames, n = F.length;
      var i = Math.max(0, Math.min(n - 1, Math.floor(x))), j = Math.min(n - 1, i + 1), f = Math.max(0, Math.min(1, x - i));
      var A = F[i], B = F[j], out = new Array(A.length);
      for (var k = 0; k < A.length; k++) out[k] = [A[k][0] + (B[k][0] - A[k][0]) * f, A[k][1] + (B[k][1] - A[k][1]) * f, A[k][2] + (B[k][2] - A[k][2]) * f];
      return out;
    }

    var skelF = null;
    function drawSkeleton() {
      if (!V.skel) return;
      var f = skelF || (skelF = fit(V.skel));
      var ctx = f.ctx, w = f.w, h = f.h, pal = P();
      ctx.clearRect(0, 0, w, h);
      var cam = camera();
      var vf = viewFit(cam);
      var pad = 16;
      var scale = Math.min((w - 2 * pad) / (vf.maxx - vf.minx), (h - 2 * pad) / (vf.maxy - vf.miny));
      var cxw = (vf.minx + vf.maxx) / 2, cyw = (vf.miny + vf.maxy) / 2;
      var ctr = spineAt(state.t);
      var ox = w / 2, oy = h / 2;
      function proj(p) {
        var q0 = p[0] - ctr[0], q1 = p[1] - ctr[1], q2 = p[2] - ctr[2];
        return [ox + ((q0 * cam.right[0] + q1 * cam.right[1] + q2 * cam.right[2]) - cxw) * scale,
                oy - ((q0 * cam.up[0] + q1 * cam.up[1] + q2 * cam.up[2]) - cyw) * scale,
                q0 * cam.d[0] + q1 * cam.d[1] + q2 * cam.d[2]];
      }
      var cur = frameAt(state.t);
      var P3 = cur.map(proj);
      var si = segAt(state.t);
      var hand = si >= 0 ? segs[si].hand : null;
      var activeL = hand === 'left' || hand === 'both';
      var activeR = hand === 'right' || hand === 'both';

      // trails: last 1 s of each hand root
      [['LeftHand', activeL], ['RightHand', activeR]].forEach(function (hh) {
        var j = JI[hh[0]], pts = [];
        for (var k = 25; k >= 0; k--) {
          var tt = state.t - k / MC.rate;
          if (tt < 0) continue;
          pts.push(proj(frameAt(tt)[j]));
        }
        for (var m = 1; m < pts.length; m++) {
          ctx.strokeStyle = alpha(hh[1] ? pal.accent : pal.mocap, 0.05 + 0.4 * (m / pts.length));
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(pts[m - 1][0], pts[m - 1][1]); ctx.lineTo(pts[m][0], pts[m][1]); ctx.stroke();
        }
      });
      [['LeftHand', activeL], ['RightHand', activeR]].forEach(function (hh) {
        if (!hh[1]) return;
        var p = P3[JI[hh[0]]];
        ctx.fillStyle = alpha(pal.accent, 0.13);
        ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(14, 90 * scale), 0, Math.PI * 2); ctx.fill();
      });
      var head = P3[JI.Head];
      if (head) {
        var hz = cur[JI.Head];
        var hc = proj([hz[0], hz[1], hz[2] + 80]);
        ctx.strokeStyle = pal.ink2; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(hc[0], hc[1], 85 * scale, 0, Math.PI * 2); ctx.stroke();
      }
      var edges = MC.edges.map(function (e) { return { a: e[0], b: e[1], z: (P3[e[0]][2] + P3[e[1]][2]) / 2 }; });
      edges.sort(function (p, q) { return q.z - p.z; });
      edges.forEach(function (e) {
        var g = MC.groups[e.b];
        var isL = g === 'left_hand', isR = g === 'right_hand';
        var act = (isL && activeL) || (isR && activeR);
        ctx.strokeStyle = act ? pal.accent : (isL || isR ? pal.mocap : pal.ink2);
        ctx.lineWidth = act ? 2.2 : (isL || isR ? 1.4 : 2.4);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(P3[e.a][0], P3[e.a][1]); ctx.lineTo(P3[e.b][0], P3[e.b][1]); ctx.stroke();
      });
      for (var k = 0; k < P3.length; k++) {
        var g = MC.groups[k];
        if (g === 'body') { ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(P3[k][0], P3[k][1], 2.4, 0, Math.PI * 2); ctx.fill(); }
        else if (MC.virtual[k]) { ctx.fillStyle = pal.surface2; ctx.strokeStyle = pal.mocap; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(P3[k][0], P3[k][1], 1.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
      ctx.font = '600 12px ' + SANS; ctx.textBaseline = 'middle';
      [['LeftHand', 'L', activeL], ['RightHand', 'R', activeR]].forEach(function (hh) {
        var p = P3[JI[hh[0]]];
        var dx = p[0] < ox ? -18 : 18;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = pal.surface2; ctx.strokeText(hh[1], p[0] + dx, p[1] - 16);
        ctx.fillStyle = hh[2] ? pal.accent : pal.ink2; ctx.fillText(hh[1], p[0] + dx, p[1] - 16);
      });
      ctx.textAlign = 'left';
      var gx0 = 26, gy0 = h - 22, Lg = 16;
      [['X', [1, 0, 0]], ['Y', [0, 1, 0]], ['Z', [0, 0, 1]]].forEach(function (a) {
        var v = a[1];
        var ex = gx0 + (v[0] * cam.right[0] + v[1] * cam.right[1] + v[2] * cam.right[2]) * Lg;
        var ey = gy0 - (v[0] * cam.up[0] + v[1] * cam.up[1] + v[2] * cam.up[2]) * Lg;
        ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = pal.muted; ctx.font = '10px ' + MONO; ctx.textAlign = 'center';
        ctx.fillText(a[0], gx0 + (ex - gx0) * 1.45, gy0 + (ey - gy0) * 1.45);
      });
      ctx.textAlign = 'left';
    }

    var gazeF = null;
    function drawGaze() {
      if (!V.gaze) return;
      var f = gazeF || (gazeF = fit(V.gaze));
      var ctx = f.ctx, w = f.w, h = f.h, pal = P();
      ctx.clearRect(0, 0, w, h);
      var bw = w - 4, bh = bw * 9 / 16;
      if (bh > h - 4) { bh = h - 4; bw = bh * 16 / 9; }
      var bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.fillStyle = pal.surface; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = pal.rule2; ctx.lineWidth = 1; ctx.strokeRect(Math.round(bx) + 0.5, Math.round(by) + 0.5, Math.round(bw) - 1, Math.round(bh) - 1);
      ctx.strokeStyle = pal.rule; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(bx + bw / 2, by); ctx.lineTo(bx + bw / 2, by + bh); ctx.moveTo(bx, by + bh / 2); ctx.lineTo(bx + bw, by + bh / 2); ctx.stroke();
      ctx.setLineDash([]);
      var n = 30;
      for (var k = n; k >= 1; k--) {
        var tt = state.t - k / S.gaze.rate;
        if (tt < 0) continue;
        var x = valueAt(D.gazeX, tt), y = valueAt(D.gazeY, tt);
        if (x === null || y === null || x === undefined || y === undefined) continue;
        ctx.fillStyle = alpha(pal.gaze, 0.08 + 0.3 * (1 - k / n));
        ctx.beginPath(); ctx.arc(bx + x * bw, by + y * bh, 3, 0, Math.PI * 2); ctx.fill();
      }
      var gx = valueAt(D.gazeX, state.t), gy = valueAt(D.gazeY, state.t);
      ctx.font = '12px ' + SANS; ctx.textBaseline = 'top';
      if (gx === null || gy === null || gx === undefined || gy === undefined) {
        ctx.fillStyle = pal.muted; ctx.textAlign = 'center';
        ctx.fillText('tracking lost', bx + bw / 2, by + bh / 2 + 6);
        ctx.textAlign = 'left';
      } else {
        var px = bx + gx * bw, py = by + gy * bh;
        ctx.fillStyle = pal.surface; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pal.gaze; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
        var fixv = valueAt(D.fix, state.t), sacv = valueAt(D.sac, state.t);
        var lab = sacv >= 0.5 ? 'saccade' : (fixv >= 0.5 ? 'fixation' : '');
        if (lab) { ctx.fillStyle = pal.ink2; ctx.fillText(lab, bx + 6, by + 5); }
      }
    }

    var pressF = null;
    function drawPress() {
      if (!V.press) return;
      var f = pressF || (pressF = fit(V.press));
      var ctx = f.ctx, w = f.w, h = f.h, pal = P();
      ctx.clearRect(0, 0, w, h);
      var col = ramp(pal.pressLo, pal.pressHi);
      var lw = 18, gap = 2, legendH = 26;
      var cw = (w - lw - gap * 24) / 25;
      var ch = Math.min(cw * 2.2, (h - legendH - 10) / 2);
      var y0 = Math.max(2, (h - legendH - (ch * 2 + 6)) / 2);
      var rows = [['R', 0], ['L', 25]];
      ctx.font = '600 11.5px ' + SANS; ctx.textBaseline = 'middle';
      rows.forEach(function (r, ri) {
        var y = y0 + ri * (ch + 6);
        ctx.fillStyle = pal.ink2; ctx.fillText(r[0], 2, y + ch / 2);
        for (var c = 0; c < 25; c++) {
          var v = valueAt(cellSer[r[1] + c], state.t) || 0;
          ctx.fillStyle = col(Math.sqrt(v / D.cellMax));
          roundRect(ctx, lw + c * (cw + gap), y, cw, ch, 2); ctx.fill();
        }
      });
      var ly = h - legendH + 6, lx = lw, lwid = Math.min(150, w - lw - 70);
      for (var i = 0; i < lwid; i++) { ctx.fillStyle = col(i / (lwid - 1)); ctx.fillRect(lx + i, ly, 1.2, 7); }
      ctx.fillStyle = pal.muted; ctx.font = '11px ' + SANS; ctx.textBaseline = 'top';
      ctx.fillText('0', lx, ly + 9);
      ctx.textAlign = 'right'; ctx.fillText(Math.round(D.cellMax) + ' g', lx + lwid, ly + 9);
      ctx.textAlign = 'left'; ctx.fillText('√ scale', lx + lwid + 8, ly - 1);
    }

    // strip chart: static layer + per-frame overlay
    var strip = { L: 100, R: 10, bands: [], axisY: 0, plotW: 0, layer: null };
    function layoutStrip(w, h) {
      var narrow = w < 520;
      strip.L = narrow ? 72 : 106;
      strip.R = 10;
      strip.plotW = w - strip.L - strip.R;
      var top = 6, axisH = 24, gap = 10;
      var segH = 28;
      var spec = [
        { key: 'emg', flex: 1.25, name: 'EMG', sub: '8-ch envelope', color: P().emg },
        { key: 'imu', flex: 1, name: 'IMU', sub: 'wrist |ω| °/s', color: P().imu },
        { key: 'gaze', flex: 1, name: 'Gaze', sub: 'x, y (0–1)', color: P().gaze },
        { key: 'press', flex: 1, name: 'Pressure', sub: 'sum per hand, g', color: P().press }
      ];
      var avail = h - top - segH - gap - axisH - gap * spec.length;
      var tot = spec.reduce(function (s, b) { return s + b.flex; }, 0);
      var y = top;
      strip.seg = { y: y, h: segH };
      y += segH + gap;
      spec.forEach(function (b) { b.y = y; b.h = Math.max(30, avail * b.flex / tot); y += b.h + gap; });
      strip.bands = spec;
      strip.axisY = y - gap + 6;
      strip.narrow = narrow;
    }
    function tx(t) { return strip.L + (t / T) * strip.plotW; }
    // Segment blocks are only a couple of seconds wide, so spell the primitive out in the
    // largest size that fits instead of dropping the label whenever 10.5px overflows.
    function fitSegLabel(ctx, txt, avail) {
      var sizes = [10.5, 10, 9.5, 9], i;
      for (i = 0; i < sizes.length; i++) {
        ctx.font = '500 ' + sizes[i] + 'px ' + MONO;
        if (ctx.measureText(txt).width <= avail) return txt;
      }
      if (avail < 16) return '';
      var w = ctx.measureText(txt).width, keep = txt.length;
      var cut = txt;
      while (keep > 1 && w > avail) {
        keep--;
        cut = txt.slice(0, keep) + '…';
        w = ctx.measureText(cut).width;
      }
      return keep >= 4 ? cut : '';   // two-letter stubs read as noise; leave the block blank instead
    }
    function renderStripLayer() {
      if (!V.strip) return;
      var f = fit(V.strip), w = f.w, h = f.h, pal = P();
      layoutStrip(w, h);
      var layer = strip.layer || (strip.layer = document.createElement('canvas'));
      layer.width = V.strip.width; layer.height = V.strip.height;
      var ctx = layer.getContext('2d');
      ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var L = strip.L, pw = strip.plotW;
      ctx.strokeStyle = pal.rule; ctx.lineWidth = 1;
      for (var s = 0; s <= T; s += 2) {
        var gx = Math.round(tx(s)) + 0.5;
        ctx.beginPath(); ctx.moveTo(gx, strip.seg.y); ctx.lineTo(gx, strip.axisY - 4); ctx.stroke();
      }
      function label(y, hgt, name, sub, color, keys) {
        var x = 4;
        ctx.textBaseline = 'alphabetic';
        if (color) { ctx.fillStyle = color; ctx.fillRect(x, y + 6, 8, 8); }
        ctx.fillStyle = pal.ink; ctx.font = '600 12.5px ' + SANS;
        ctx.fillText(name, x + (color ? 13 : 0), y + 14);
        if (!strip.narrow) {
          ctx.fillStyle = pal.muted; ctx.font = '11px ' + SANS;
          ctx.fillText(sub, x, y + 29);
        }
        if (keys && hgt > 44 && !strip.narrow) {
          var ky = y + 42;
          ctx.strokeStyle = color; ctx.lineWidth = 1.6;
          ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x, ky); ctx.lineTo(x + 14, ky); ctx.stroke();
          ctx.fillStyle = pal.muted; ctx.fillText(keys[0], x + 18, ky + 4);
          ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x + 42, ky); ctx.lineTo(x + 56, ky); ctx.stroke();
          ctx.setLineDash([]); ctx.fillText(keys[1], x + 60, ky + 4);
        }
      }
      label(strip.seg.y + 2, strip.seg.h, 'Actions', 'VLM-assisted', null);
      segs.forEach(function (sg) {
        var x0 = tx(sg.start), x1 = tx(sg.end);
        roundRect(ctx, x0 + 1, strip.seg.y + 2, Math.max(2, x1 - x0 - 2), strip.seg.h - 4, 4);
        ctx.fillStyle = pal.surface; ctx.fill();
        ctx.strokeStyle = pal.muted; ctx.lineWidth = 1; ctx.stroke();
        ctx.textBaseline = 'middle';
        var lbl = fitSegLabel(ctx, sg.primitive, x1 - x0 - 6);
        if (lbl) { ctx.fillStyle = pal.ink2; ctx.textAlign = 'center'; ctx.fillText(lbl, (x0 + x1) / 2, strip.seg.y + strip.seg.h / 2); ctx.textAlign = 'left'; }
      });
      strip.bands.forEach(function (b) {
        ctx.strokeStyle = pal.rule2; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L, Math.round(b.y + b.h) + 0.5); ctx.lineTo(L + pw, Math.round(b.y + b.h) + 0.5); ctx.stroke();
        if (b.key === 'emg') {
          label(b.y, b.h, b.name, b.sub, b.color);
          drawHeat(ctx, emgNorm, L, b.y, pw, b.h, 1);
        } else if (b.key === 'imu') {
          label(b.y, b.h, b.name, b.sub, b.color, ['R', 'L']);
          drawLine(ctx, D.imuL, T, L, b.y + 2, pw, b.h - 3, 0, D.imuMax, b.color, [4, 3], 1.4);
          drawLine(ctx, D.imuR, T, L, b.y + 2, pw, b.h - 3, 0, D.imuMax, b.color, null, 1.7);
        } else if (b.key === 'gaze') {
          label(b.y, b.h, b.name, b.sub, b.color, ['x', 'y']);
          drawLine(ctx, D.gazeY, T, L, b.y + 2, pw, b.h - 3, 0, 1, b.color, [4, 3], 1.4);
          drawLine(ctx, D.gazeX, T, L, b.y + 2, pw, b.h - 3, 0, 1, b.color, null, 1.7);
        } else if (b.key === 'press') {
          label(b.y, b.h, b.name, b.sub, b.color, ['R', 'L']);
          drawLine(ctx, D.pressL, T, L, b.y + 2, pw, b.h - 3, 0, D.pressMax, b.color, [4, 3], 1.4);
          drawLine(ctx, D.pressR, T, L, b.y + 2, pw, b.h - 3, 0, D.pressMax, b.color, null, 1.7);
        }
      });
      ctx.fillStyle = pal.muted; ctx.font = '11px ' + MONO; ctx.textBaseline = 'top';
      var step = strip.narrow ? 3 : 2;
      for (var s2 = 0; s2 <= T; s2 += step) {
        ctx.textAlign = s2 === 0 ? 'left' : (s2 >= T ? 'right' : 'center');
        ctx.fillText(s2 >= T ? s2 + ' s' : String(s2), tx(s2), strip.axisY + 2);
      }
      ctx.textAlign = 'left';
    }
    var stripCtx = null;
    function drawStrip() {
      if (!V.strip || !strip.layer) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var ctx = stripCtx || (stripCtx = V.strip.getContext('2d'));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, V.strip.width, V.strip.height);
      ctx.drawImage(strip.layer, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var pal = P();
      var si = segAt(state.t);
      if (si >= 0) {
        var sg = segs[si], x0 = tx(sg.start), x1 = tx(sg.end);
        ctx.fillStyle = alpha(pal.accent, 0.08);
        ctx.fillRect(x0, strip.seg.y + strip.seg.h, x1 - x0, strip.axisY - 4 - strip.seg.y - strip.seg.h);
        roundRect(ctx, x0 + 1, strip.seg.y + 2, Math.max(2, x1 - x0 - 2), strip.seg.h - 4, 4);
        ctx.fillStyle = pal.accent; ctx.fill();
        // the highlight is the same rect as the outline above; only the label picks a size that fits
        var cxm = (x0 + x1) / 2, cy = strip.seg.y + strip.seg.h / 2;
        var lbl = fitSegLabel(ctx, sg.primitive, x1 - x0 - 6);
        if (!lbl) {
          // box too narrow for any text (phone widths): float the name as a pill over the block
          ctx.font = '600 10.5px ' + MONO;
          var pwid = ctx.measureText(sg.primitive).width + 12;
          var pl = Math.max(strip.L, Math.min(strip.L + strip.plotW - pwid, cxm - pwid / 2));
          roundRect(ctx, pl, strip.seg.y + 3, pwid, strip.seg.h - 6, 9);
          ctx.fillStyle = pal.accent; ctx.fill();
          cxm = pl + pwid / 2; lbl = sg.primitive;
        }
        ctx.textBaseline = 'middle';
        ctx.fillStyle = pal.accentInk; ctx.textAlign = 'center'; ctx.fillText(lbl, cxm, cy); ctx.textAlign = 'left';
      }
      var cx = Math.round(tx(state.t)) + 0.5;
      ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, strip.seg.y); ctx.lineTo(cx, strip.axisY - 2); ctx.stroke();
      ctx.fillStyle = pal.ink;
      ctx.beginPath(); ctx.moveTo(cx - 5, strip.axisY - 2); ctx.lineTo(cx + 5, strip.axisY - 2); ctx.lineTo(cx, strip.axisY - 8); ctx.closePath(); ctx.fill();
      ctx.font = '600 11px ' + MONO; ctx.textBaseline = 'top'; ctx.textAlign = 'right';
      strip.bands.forEach(function (b) {
        var txt = '';
        if (b.key === 'imu') txt = 'R ' + Math.round(valueAt(D.imuR, state.t) || 0) + ' · L ' + Math.round(valueAt(D.imuL, state.t) || 0);
        else if (b.key === 'press') txt = 'R ' + Math.round(valueAt(D.pressR, state.t) || 0) + ' g · L ' + Math.round(valueAt(D.pressL, state.t) || 0) + ' g';
        else if (b.key === 'gaze') {
          var gx = valueAt(D.gazeX, state.t), gy = valueAt(D.gazeY, state.t);
          txt = (gx === null || gy === null || gx === undefined || gy === undefined) ? 'tracking lost' : 'x ' + gx.toFixed(2) + ' · y ' + gy.toFixed(2);
        }
        if (!txt) return;
        var wtxt = ctx.measureText(txt).width;
        var rx = strip.L + strip.plotW - 2, ry = b.y + 2;
        ctx.fillStyle = alpha(pal.surface2, 0.88);
        ctx.fillRect(rx - wtxt - 6, ry - 1, wtxt + 8, 15);
        ctx.fillStyle = pal.ink;
        ctx.fillText(txt, rx, ry + 1);
      });
      ctx.textAlign = 'left';
    }

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function updateSegCard() {
      var si = segAt(state.t);
      if (si === state.segIdx) return;
      state.segIdx = si;
      if (si < 0) {
        V.seg.innerHTML = '<div class="v-seg-empty">No annotated segment at this moment. The annotation prompt asks for segments only where at least one hand actively interacts with an object; ' + segs.length + ' segments fall in this window.</div>';
        return;
      }
      var s = segs[si];
      var handTxt = s.hand === 'both' ? 'both hands' : s.hand + ' hand';
      var vars = (s.text_variants || []).map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('');
      V.seg.innerHTML =
        '<div><p class="v-seg-when">Segment ' + (s.index_in_recording + 1) + ' · ' + s.start + '–' + s.end + ' s</p>' +
        '<p class="v-prim">' + esc(s.primitive) + '</p></div>' +
        '<div><div class="v-attrs"><span class="v-attr">hand <b>' + esc(handTxt) + '</b></span><span class="v-attr">object <b>' + esc(s.object) + '</b></span></div>' +
        '<p class="v-desc">“' + esc(s.text) + '”</p>' +
        '<ul class="v-variants" aria-label="Text variants">' + vars + '</ul></div>';
    }
    function updateTimeUI() {
      V.time.textContent = 't = ' + state.t.toFixed(2) + ' s';
      // only skip the slider while the user is actually dragging it (v1 skipped it whenever it had focus)
      if (!state.sliderDrag) V.scrub.value = state.t.toFixed(2);
    }
    function render() {
      drawSkeleton();
      drawGaze();
      drawPress();
      drawStrip();
      updateSegCard();
      updateTimeUI();
    }
    function tick(ts) {
      if (!state.playing) { state.raf = 0; return; }
      if (state.last === null) state.last = ts;
      var dt = Math.min(0.1, (ts - state.last) / 1000);
      state.last = ts;
      state.t += dt * state.speed;
      if (state.t >= T) state.t -= T;
      render();
      state.raf = requestAnimationFrame(tick);
    }
    function setPlaying(on) {
      state.playing = on;
      V.root.classList.toggle('is-playing', on);
      V.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
      if (on && !state.raf) { state.last = null; state.raf = requestAnimationFrame(tick); }
    }
    function seek(t) {
      state.t = Math.max(0, Math.min(T - 0.001, t));
      render();
    }
    function relayout() {
      skelF = gazeF = pressF = null;
      stripCtx = null;
      renderStripLayer();
      render();
    }

    V.scrub.max = String(T);
    V.play.addEventListener('click', function () { setPlaying(!state.playing); });
    V.scrub.addEventListener('input', function () { seek(parseFloat(V.scrub.value)); });
    V.scrub.addEventListener('pointerdown', function () { state.sliderDrag = true; });
    function endSliderDrag() { if (state.sliderDrag) { state.sliderDrag = false; updateTimeUI(); } }
    window.addEventListener('pointerup', endSliderDrag);
    window.addEventListener('pointercancel', endSliderDrag);
    V.scrub.addEventListener('change', endSliderDrag);
    V.speed.addEventListener('change', function () { state.speed = parseFloat(V.speed.value) || 1; });
    V.reset.addEventListener('click', function () { state.az = state.baseAz; state.el = state.baseEl; render(); });
    V.root.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Spacebar') return;
      var tg = e.target;
      if (tg === V.root || tg === V.scrub || tg === V.strip || tg === V.skel) { e.preventDefault(); setPlaying(!state.playing); }
    });

    // strip chart: a mouse scrubs at once; on touch, a tap seeks and only a sideways drag scrubs,
    // so a vertical swipe over the chart still scrolls the page (touch-action: pan-y)
    var sc = null;
    function stripT(e) {
      var r = V.strip.getBoundingClientRect();
      return ((e.clientX - r.left) - strip.L) / strip.plotW * T;
    }
    V.strip.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') {
        sc = { mode: 'drag', id: e.pointerId };
        try { V.strip.setPointerCapture(e.pointerId); } catch (err) {}
        seek(stripT(e));
      } else {
        sc = { mode: 'pending', id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    });
    V.strip.addEventListener('pointermove', function (e) {
      if (!sc || sc.id !== e.pointerId) return;
      if (sc.mode === 'pending') {
        var dx = Math.abs(e.clientX - sc.x), dy = Math.abs(e.clientY - sc.y);
        if (dx > 8 && dx > dy) {
          sc.mode = 'drag';
          try { V.strip.setPointerCapture(e.pointerId); } catch (err) {}
        } else if (dy > 8) { sc = null; return; }
      }
      if (sc && sc.mode === 'drag') seek(stripT(e));
    });
    V.strip.addEventListener('pointerup', function (e) {
      if (sc && sc.mode === 'pending' && sc.id === e.pointerId) seek(stripT(e)); // tap
      sc = null;
    });
    V.strip.addEventListener('pointercancel', function () { sc = null; });

    // skeleton: a mouse rotates freely; touch only turns around the vertical axis so vertical swipes scroll the page
    var drag = null;
    V.skel.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, az: state.az, el: state.el, touch: e.pointerType !== 'mouse', id: e.pointerId, captured: false };
      if (!drag.touch) { try { V.skel.setPointerCapture(e.pointerId); } catch (err) {} drag.captured = true; }
    });
    V.skel.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.touch && !drag.captured) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { try { V.skel.setPointerCapture(e.pointerId); } catch (err) {} drag.captured = true; }
        else if (Math.abs(dy) > 8) { drag = null; return; }
        else return;
      }
      state.az = drag.az - dx * 0.01;
      if (!drag.touch) state.el = Math.max(-0.2, Math.min(1.35, drag.el + dy * 0.008));
      if (!state.playing) render();
    });
    V.skel.addEventListener('pointerup', function () { drag = null; });
    V.skel.addEventListener('pointercancel', function () { drag = null; });
    V.skel.addEventListener('dblclick', function () { state.az = state.baseAz; state.el = state.baseEl; render(); });

    V.root.classList.remove('is-loading');
    renderStripLayer();
    render();
    return { state: state, relayout: relayout, play: function () { setPlaying(true); }, pause: function () { setPlaying(false); }, seek: seek };
  }

  /* ------------------------------------------------------------ on-demand loading of assets/sample.js */
  var loadState = 'idle';
  function loadSample() {
    if (loadState !== 'idle' || !V.root) return;
    if (window.PULSE_SAMPLE) { initViewer(); return; }
    loadState = 'loading';
    var s = document.createElement('script');
    s.src = 'assets/sample.js?v=20261119c';
    s.async = true;
    s.onload = function () { loadState = 'done'; initViewer(); };
    s.onerror = function () { loadState = 'failed'; viewerFailed(); };
    document.body.appendChild(s);
  }
  function initViewer() {
    if (viewer || !window.PULSE_SAMPLE) { if (!window.PULSE_SAMPLE) viewerFailed(); return; }
    try {
      viewer = buildViewer(window.PULSE_SAMPLE);
      window.__pulseViewer = viewer; // tiny hook for automated checks
    } catch (e) {
      if (window.console) console.error(e);
      viewerFailed();
    }
  }
  if (V.root) {
    if ('IntersectionObserver' in window) {
      var lio = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { lio.disconnect(); loadSample(); }
      }, { rootMargin: '1200px 0px 1200px 0px' });
      lio.observe(V.root);
    }
    // also fetch it shortly after the page has finished loading, so the viewer is ready before anyone scrolls there
    var later = function () { setTimeout(loadSample, 1500); };
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
    // interacting with the controls before the data arrives starts the load right away
    V.root.addEventListener('pointerdown', loadSample, { once: true });
    V.root.addEventListener('focusin', loadSample, { once: true });
  }

  /* ------------------------------------------------------------ init + resize + theme */
  function redrawAll() {
    drawAllStatic();
    if (viewer) viewer.relayout();
  }
  themeListeners.push(redrawAll);
  var rafResize = 0;
  function onResize() {
    if (rafResize) return;
    rafResize = requestAnimationFrame(function () { rafResize = 0; redrawAll(); });
  }
  if ('ResizeObserver' in window) {
    var lastW = {};
    var ro = new ResizeObserver(function (entries) {
      var changed = false;
      entries.forEach(function (en) {
        var id = en.target.id || en.target.getAttribute('data-preview') || 'x';
        var cw = Math.round(en.contentRect.width) + 'x' + Math.round(en.contentRect.height);
        if (lastW[id] !== cw) { lastW[id] = cw; changed = true; }
      });
      if (changed) onResize();
    });
    [heroCanvas, V.skel, V.gaze, V.press, V.strip].concat(previews).forEach(function (el) { if (el) ro.observe(el); });
  } else {
    window.addEventListener('resize', onResize);
  }
  drawAllStatic();
})();
