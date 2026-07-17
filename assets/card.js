/* Quote card renderer — draws a share image on a <canvas>.
   Pure function of (quote, format, theme); no DOM deps beyond the canvas. */
(function (global) {
  'use strict';

  var FORMATS = {
    square: { w: 1080, h: 1080 },
    story:  { w: 1080, h: 1920 },
    wide:   { w: 1200, h: 630  }
  };

  var THEMES = {
    ink:   { bg: '#0b0b0d', glow: 'rgba(200,204,210,0.10)', text: '#efe9dd', dim: '#8f8a80', rule: 'rgba(239,233,221,0.28)', frame: 'rgba(239,233,221,0.16)' },
    cream: { bg: '#efe9dd', glow: 'rgba(11,11,13,0.05)',    text: '#17171a', dim: '#6f6a62', rule: 'rgba(23,23,26,0.30)',    frame: 'rgba(23,23,26,0.16)' }
  };

  var DISPLAY = '"Cormorant Garamond", "EB Garamond", Georgia, serif';

  /* The book uses emphasis, and it's the poet's, not decoration: an italic
     "are", a bold stanza in The nutshell. Lines carry it as markdown-lite
     (*italic*, **bold**); a card that dropped it would misquote the book. */
  function parseRuns(line) {
    if (Array.isArray(line)) return line;
    var out = [], re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g, last = 0, m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) out.push({ t: line.slice(last, m.index), s: 'r' });
      var tok = m[0];
      if (tok.slice(0, 2) === '**') out.push({ t: tok.slice(2, -2), s: 'b' });
      else out.push({ t: tok.slice(1, -1), s: 'i' });
      last = re.lastIndex;
    }
    if (last < line.length) out.push({ t: line.slice(last), s: 'r' });
    return out.length ? out : [{ t: line, s: 'r' }];
  }

  function fontFor(s, size) {
    if (s === 'i') return 'italic 300 ' + size + 'px ' + DISPLAY;
    if (s === 'b') return '600 ' + size + 'px ' + DISPLAY;
    return '300 ' + size + 'px ' + DISPLAY;
  }

  function lineWidth(ctx, runs, size) {
    var w = 0;
    for (var i = 0; i < runs.length; i++) {
      ctx.font = fontFor(runs[i].s, size);
      w += ctx.measureText(runs[i].t).width;
    }
    return w;
  }

  /* Draw a line centred, run by run, so italic and bold sit inline. */
  function drawRuns(ctx, runs, cx, y, size) {
    var prev = ctx.textAlign;
    ctx.textAlign = 'left';
    var x = cx - lineWidth(ctx, runs, size) / 2;
    for (var i = 0; i < runs.length; i++) {
      ctx.font = fontFor(runs[i].s, size);
      ctx.fillText(runs[i].t, x, y);
      x += ctx.measureText(runs[i].t).width;
    }
    ctx.textAlign = prev;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Widest natural line at a given font size. */
  function widestLine(ctx, lines, size) {
    var max = 0;
    for (var i = 0; i < lines.length; i++) {
      max = Math.max(max, lineWidth(ctx, lines[i], size));
    }
    return max;
  }

  /* Largest font size where the block fits both axes. */
  function fitSize(ctx, lines, maxW, maxH, cap) {
    var size = cap;
    while (size > 18) {
      var lineH = size * 1.62;
      if (widestLine(ctx, lines, size) <= maxW && lines.length * lineH <= maxH) break;
      size -= 1;
    }
    return size;
  }

  function drawSpacedText(ctx, text, cx, y, tracking) {
    // Manual letter-spacing, centered — canvas letterSpacing isn't universal yet.
    var chars = text.split('');
    var total = 0, i;
    for (i = 0; i < chars.length; i++) total += ctx.measureText(chars[i]).width + tracking;
    total -= tracking;
    var x = cx - total / 2;
    for (i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, y);
      x += ctx.measureText(chars[i]).width + tracking;
    }
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{lines:string[], poemTitle:string}} quote
   * @param {string} format  square | story | wide
   * @param {string} theme   ink | cream
   * @param {{author:string, book:string, site:string}} meta
   */
  function render(canvas, quote, format, theme, meta) {
    var f = FORMATS[format] || FORMATS.square;
    var t = THEMES[theme] || THEMES.ink;
    var lines = quote.lines.map(parseRuns);

    canvas.width = f.w;
    canvas.height = f.h;
    var ctx = canvas.getContext('2d');
    var cx = f.w / 2;

    // Background
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, f.w, f.h);

    // Soft light from above — echoes the cover's spark-in-the-void feel
    var g = ctx.createRadialGradient(cx, f.h * -0.06, 0, cx, f.h * -0.06, f.h * 0.85);
    g.addColorStop(0, t.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, f.w, f.h);

    // Inset frame
    var pad = Math.round(Math.min(f.w, f.h) * 0.055);
    ctx.strokeStyle = t.frame;
    ctx.lineWidth = 2;
    roundRect(ctx, pad, pad, f.w - pad * 2, f.h - pad * 2, 4);
    ctx.stroke();

    var inner = pad * 2;
    var maxW = f.w - inner * 2;

    // Reserve room for the footer block
    var footerH = format === 'wide' ? f.h * 0.20 : f.h * 0.16;
    var maxH = f.h - inner * 2 - footerH;
    var cap = format === 'wide' ? 58 : 84;

    var size = fitSize(ctx, lines, maxW, maxH, cap);
    var lineH = size * 1.62;
    var blockH = lines.length * lineH;
    var top = inner + (maxH - blockH) / 2;

    // Quote
    ctx.fillStyle = t.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < lines.length; i++) {
      drawRuns(ctx, lines[i], cx, top + i * lineH + lineH / 2, size);
    }

    // Divider
    var ruleY = top + blockH + Math.min(footerH * 0.34, 70);
    var ruleW = Math.min(120, f.w * 0.14);
    ctx.strokeStyle = t.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - ruleW / 2, ruleY);
    ctx.lineTo(cx + ruleW / 2, ruleY);
    ctx.stroke();

    // Attribution
    var attrSize = Math.round(Math.max(20, Math.min(f.w, f.h) * 0.026));
    ctx.fillStyle = t.text;
    ctx.font = '400 ' + attrSize + 'px ' + DISPLAY;
    drawSpacedText(ctx, meta.author.toUpperCase(), cx, ruleY + attrSize * 2.1, attrSize * 0.24);

    ctx.fillStyle = t.dim;
    ctx.font = 'italic 400 ' + Math.round(attrSize * 0.95) + 'px ' + DISPLAY;
    ctx.fillText(meta.book, cx, ruleY + attrSize * 3.7);

    // Site, bottom-anchored
    ctx.fillStyle = t.dim;
    ctx.font = '400 ' + Math.round(attrSize * 0.7) + 'px ' + DISPLAY;
    drawSpacedText(ctx, meta.site.toUpperCase(), cx, f.h - pad - attrSize * 0.9, attrSize * 0.18);

    return canvas;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (b) { resolve(b); }, 'image/png');
    });
  }

  global.QuoteCard = { render: render, toBlob: toBlob, FORMATS: FORMATS, parseRuns: parseRuns };
})(window);
