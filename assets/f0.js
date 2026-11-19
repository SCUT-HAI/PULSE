/* F0 · anticipatory coordination around grasp contact — interactive version of the paper figure.
   Hover (or arrow-key) the canvas for values at a time point; click a legend key to hide a series. */
(function () {
  var cv = document.getElementById('f0Chart');
  if (!cv || !window.PULSE_F0) return;
  var D = window.PULSE_F0;
  var tip = document.getElementById('f0Tip');
  var legend = document.getElementById('f0Legend');
  var host = cv.parentNode;

  var SERIES = [
    { k: 'emg', name: 'EMG envelope', color: '#E74C3C', short: 'EMG' },
    { k: 'velocity', name: 'Hand velocity', color: '#3498DB', short: 'Velocity' },
    { k: 'pressure', name: 'Pressure (contact)', color: '#27AE60', short: 'Pressure' }
  ];
  var on = { emg: true, velocity: true, pressure: true };
  var T = D.time_ms, N = T.length, STEP = D.step_ms || 10;
  var X0 = T[0], X1 = 500, Y0 = -0.05, Y1 = 1.1;   // axis ends at +500 ms as in the paper figure
  var hover = -1, raf = 0;

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }
  function fmt(n) { return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('en-US'); }

  var M = { l: 58, r: 16, t: 16, b: 40 };
  function setMargins() { M.l = 58; M.b = W < 520 ? 36 : 40; }
  var W = 0, H = 0, dpr = 1;

  function layout() {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var rect = cv.getBoundingClientRect();
    if (!rect.width) return false;
    if (d === dpr && Math.round(rect.width) === W && Math.round(rect.width * 0.55) === H) return false;
    dpr = d;
    W = Math.round(rect.width);
    H = Math.round(rect.width * 0.55);
    setMargins();
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.height = H + 'px';
    return true;
  }
  function px(t) { return M.l + (t - X0) / (X1 - X0) * (W - M.l - M.r); }
  function py(v) { return M.t + (Y1 - v) / (Y1 - Y0) * (H - M.t - M.b); }

  function draw() {
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var ink = css('--ink', '#121b19'), muted = css('--muted', '#5d6a66');
    var rule = css('--rule', '#dae1de'), faint = css('--faint', '#8a9591');
    var mono = css('--font-mono', 'Consolas, monospace');
    var body = css('--font-body', 'system-ui, sans-serif');

    // grid + axes
    ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.font = '11.5px ' + mono;
    ctx.fillStyle = muted; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    for (var v = 0; v <= 1.0001; v += 0.2) {
      var y = Math.round(py(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(M.l, y); ctx.lineTo(W - M.r, y); ctx.stroke();
      ctx.fillText(v.toFixed(1), M.l - 8, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var plotW = W - M.l - M.r;
    var tickMs = plotW * 500 / (X1 - X0) >= 62 ? 500 : 1000;
    for (var s = X0; s <= X1; s += tickMs) {
      var x = Math.round(px(s)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, M.t); ctx.lineTo(x, H - M.b); ctx.stroke();
      ctx.fillText(fmt(s), x, H - M.b + 8);
    }
    ctx.fillStyle = muted; ctx.font = '12px ' + body;
    ctx.fillText('Time relative to contact onset (ms)', (M.l + W - M.r) / 2, H - M.b + 26);
    ctx.save();
    ctx.translate(14, (M.t + H - M.b) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Normalized amplitude', 0, 0);
    ctx.restore();

    // band + line per visible series
    SERIES.forEach(function (sr) {
      var d = D.series[sr.k]; if (!d || !on[sr.k]) return;
      ctx.beginPath();
      for (var i = 0; i < N; i++) ctx[i ? 'lineTo' : 'moveTo'](px(T[i]), py(d.hi[i]));
      for (var j = N - 1; j >= 0; j--) ctx.lineTo(px(T[j]), py(d.lo[j]));
      ctx.closePath();
      ctx.globalAlpha = 0.16; ctx.fillStyle = sr.color; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath();
      for (var k = 0; k < N; k++) ctx[k ? 'lineTo' : 'moveTo'](px(T[k]), py(d.mean[k]));
      ctx.strokeStyle = sr.color; ctx.lineWidth = 2.1; ctx.lineJoin = 'round'; ctx.stroke();
    });

    // onset and contact markers, with the label set to the left of its own dotted line
    function vline(t, color, dash) {
      var x = Math.round(px(t)) + 0.5;
      ctx.save();
      ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(x, M.t); ctx.lineTo(x, H - M.b); ctx.stroke();
      ctx.restore();
    }
    vline(D.emg_onset_ms, '#E74C3C', [3, 3]);
    vline(D.motion_onset_ms, '#3498DB', [3, 3]);
    vline(0, ink, [7, 5]);
    var tags = [
      { t: D.emg_onset_ms, y: 0.88, color: '#E74C3C', label: 'EMG ' + fmt(D.emg_onset_ms) + ' ms' },
      { t: D.motion_onset_ms, y: 0.68, color: '#3498DB', label: 'Motion ' + fmt(D.motion_onset_ms) + ' ms' }
    ];
    ctx.font = '600 11px ' + mono;
    var TH = 18, gapTag = 5, prevBottom = -Infinity;
    tags.forEach(function (g) {
      var w = ctx.measureText(g.label).width + 14;
      g.w = w;
      g.lx = Math.max(M.l + 2, px(g.t) - w - 6);
      g.ly = Math.max(M.t + 2, py(g.y) - TH / 2);
      if (g.ly < prevBottom + gapTag) g.ly = prevBottom + gapTag;   // short canvases: stack instead of collide
      prevBottom = g.ly + TH;
    });
    tags.forEach(function (g) {
      ctx.fillStyle = g.color; ctx.globalAlpha = 0.13;
      ctx.fillRect(g.lx, g.ly, g.w, TH); ctx.globalAlpha = 1;
      ctx.strokeStyle = g.color; ctx.lineWidth = 1;
      ctx.strokeRect(g.lx + 0.5, g.ly + 0.5, g.w - 1, TH - 1);
      ctx.fillStyle = g.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.label, g.lx + g.w / 2, g.ly + TH / 2 + 0.5);
    });

    // crosshair
    if (hover >= 0) {
      var hx = px(T[hover]);
      ctx.strokeStyle = faint; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, M.t); ctx.lineTo(hx, H - M.b); ctx.stroke();
      SERIES.forEach(function (sr) {
        if (!on[sr.k]) return;
        var d = D.series[sr.k];
        ctx.beginPath(); ctx.arc(hx, py(d.mean[hover]), 3.4, 0, Math.PI * 2);
        ctx.fillStyle = sr.color; ctx.fill();
        ctx.strokeStyle = css('--surface', '#fff'); ctx.lineWidth = 1.6; ctx.stroke();
      });
    }
  }

  function paint() {
    raf = 0;
    if (layout()) { /* size changed */ }
    draw();
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(paint); }

  // ---- tooltip -------------------------------------------------------------
  function showTip(i, clientX) {
    if (!tip) return;
    var rows = SERIES.map(function (sr) {
      if (!on[sr.k]) return '';
      var d = D.series[sr.k];
      return '<tr><th><i style="background:' + sr.color + '"></i>' + sr.name + '</th>' +
        '<td>' + d.mean[i].toFixed(2) + '</td><td class="f0-band">' +
        d.lo[i].toFixed(2) + '–' + d.hi[i].toFixed(2) + '</td></tr>';
    }).join('');
    tip.innerHTML = '<p class="f0-tip-t">t = ' + fmt(T[i]) + ' ms</p>' +
      '<table><thead><tr><th></th><th>mean</th><th class="f0-band">±0.5σ</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
    tip.hidden = false;
    var hostRect = host.getBoundingClientRect();
    var x = clientX - hostRect.left;
    var tw = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(hostRect.width - tw - 4, x + 14)) + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  function nearest(t) {
    var i = Math.round((t - X0) / STEP);
    return Math.max(0, Math.min(N - 1, i));
  }
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect();
    var t = X0 + (e.clientX - r.left - M.l) / Math.max(1, (r.width - M.l - M.r)) * (X1 - X0);
    hover = nearest(t);
    showTip(hover, e.clientX);
    schedule();
  });
  cv.addEventListener('pointerleave', function () { hover = -1; hideTip(); schedule(); });
  cv.addEventListener('focus', function () {
    if (hover < 0) hover = nearest(-600);
    var r = cv.getBoundingClientRect();
    showTip(hover, r.left + px(T[hover]));
    schedule();
  });
  cv.addEventListener('blur', function () { hover = -1; hideTip(); schedule(); });
  cv.addEventListener('keydown', function (e) {
    var d = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') { hover = Math.max(0, (hover < 0 ? nearest(0) : hover) - d); }
    else if (e.key === 'ArrowRight') { hover = Math.min(N - 1, (hover < 0 ? nearest(0) : hover) + d); }
    else if (e.key === 'Home') { hover = 0; }
    else if (e.key === 'End') { hover = N - 1; }
    else return;
    e.preventDefault();
    var r = cv.getBoundingClientRect();
    showTip(hover, r.left + px(T[hover]));
    schedule();
  });

  // ---- legend --------------------------------------------------------------
  if (legend) {
    legend.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]');
      if (!b) return;
      var k = b.getAttribute('data-k');
      if (on[k] && Object.keys(on).filter(function (x) { return on[x]; }).length === 1) return;
      on[k] = !on[k];
      b.classList.toggle('is-off', !on[k]);
      b.setAttribute('aria-pressed', on[k] ? 'true' : 'false');
      if (hover >= 0) showTip(hover, cv.getBoundingClientRect().left + px(T[hover]));
      schedule();
    });
  }

  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(cv);
  else window.addEventListener('resize', schedule);
  if ('MutationObserver' in window) {
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  schedule();
})();
