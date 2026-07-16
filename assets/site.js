/* Site behaviour.

   The page shows ONE passage at a time, rendered as the actual share card.
   "Another passage" draws the next one. The full library lives behind a link. */
(function () {
  'use strict';

  /* The line printed on every shared card. It must be somewhere a reader can
     actually type in and land on this site — so it keeps the path (the site may
     live at /icametobefree/, where the bare host serves something else) and
     never invents a domain we don't own. */
  var SITE = (function () {
    var host = location.hostname.replace(/^www\./, '');
    if (!host || host === 'localhost' || host === '127.0.0.1') return 'i came to be free';
    var path = location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
    return host + path;
  })();

  var $ = function (s) { return document.querySelector(s); };

  var state = {
    data: null,
    poemsById: {},
    current: null,
    deck: [],          // shuffled ids not yet shown
    format: 'square',
    cardTheme: 'ink',
    filtered: [],
    theme: '',
    poem: '',
    q: ''
  };

  var canvas = $('#card-canvas');
  var grid = $('#quote-grid');

  /* ---------- load ---------- */
  fetch('data/quotes.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      state.data = data;
      data.poems.forEach(function (p) { state.poemsById[p.id] = p; });
      setToggleLabel(false);
      buildFilters();
      apply();
      start();
    })
    .catch(function (err) {
      $('#stage-fallback').textContent = 'The passages could not be loaded. Please refresh.';
      $('#stage-fallback').hidden = false;
      console.error(err);
    });

  /* ---------- the deck ----------
     Draw without repeats: shuffle all ids, deal one at a time, reshuffle when
     spent. Pure random would show the same passage twice in a row often enough
     to feel broken. */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function refillDeck(excludeId) {
    state.deck = shuffle(state.data.quotes.map(function (q) { return q.id; }));
    // Don't let a reshuffle immediately repeat the passage still on screen.
    if (excludeId && state.deck.length > 1 && state.deck[state.deck.length - 1] === excludeId) {
      state.deck.unshift(state.deck.pop());
    }
  }

  function draw() {
    if (!state.deck.length) refillDeck(state.current && state.current.id);
    var id = state.deck.pop();
    show(byId(id));
  }

  function byId(id) {
    return state.data.quotes.filter(function (q) { return q.id === id; })[0];
  }

  /* ---------- the stage ---------- */
  function meta() {
    return { author: state.data.book.author, book: state.data.book.title, site: SITE };
  }

  function paint() {
    if (!state.current) return;
    QuoteCard.render(canvas, {
      lines: state.current.lines,
      poemTitle: state.poemsById[state.current.poem].title
    }, state.format, state.cardTheme, meta());
  }

  function show(q) {
    if (!q) return;
    state.current = q;
    $('#stage-poem').textContent = 'from “' + state.poemsById[q.poem].title + '”';
    $('#stage-fallback').hidden = true;
    $('#status').textContent = '';
    history.replaceState(null, '', '#q=' + q.id);

    canvas.classList.add('is-changing');
    var render = function () {
      paint();
      requestAnimationFrame(function () { canvas.classList.remove('is-changing'); });
    };
    // Webfonts must be ready or the canvas silently falls back to a system serif.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    else render();
  }

  function start() {
    var m = /#q=([\w-]+)/.exec(location.hash);
    var q = m && byId(m[1]);
    refillDeck();
    if (q) {
      // Arrived on a shared link — honour it, and don't repeat it on first draw.
      state.deck = state.deck.filter(function (id) { return id !== q.id; });
      show(q);
    } else {
      draw();
    }
  }

  $('#another').addEventListener('click', draw);

  // Space / N for another. Ignore it while typing in the search box.
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ' || e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      draw();
    }
  });

  document.querySelectorAll('[data-format]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.format = b.dataset.format;
      document.querySelectorAll('[data-format]').forEach(function (x) {
        x.classList.toggle('is-on', x === b);
      });
      paint();
    });
  });

  document.querySelectorAll('[data-theme]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.cardTheme = b.dataset.theme;
      document.querySelectorAll('[data-theme]').forEach(function (x) {
        x.classList.toggle('is-on', x === b);
      });
      paint();
    });
  });

  /* ---------- sharing ---------- */
  function status(msg) {
    $('#status').textContent = msg;
    setTimeout(function () {
      if ($('#status').textContent === msg) $('#status').textContent = '';
    }, 2600);
  }

  function filename() {
    return 'i-came-to-be-free-' + state.current.id + '-' + state.format + '.png';
  }

  function permalink() {
    return location.origin + location.pathname + '#q=' + state.current.id;
  }

  function shareText() {
    return state.current.lines.join('\n') +
      '\n\n— ' + state.data.book.author + ', “' + state.data.book.title + '”' +
      '\n' + permalink();
  }

  $('#download').addEventListener('click', function () {
    QuoteCard.toBlob(canvas).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename();
      a.click();
      URL.revokeObjectURL(url);
      status('Saved.');
    });
  });

  var nativeBtn = $('#native-share');
  if (navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', function () {
      QuoteCard.toBlob(canvas).then(function (blob) {
        var file = new File([blob], filename(), { type: 'image/png' });
        navigator.share({ files: [file], text: shareText() }).catch(function () {});
      });
    });
  }

  $('#copy-text').addEventListener('click', function () {
    navigator.clipboard.writeText(shareText())
      .then(function () { status('Copied.'); })
      .catch(function () { status('Copy failed — select the text instead.'); });
  });

  $('#copy-link').addEventListener('click', function () {
    navigator.clipboard.writeText(permalink())
      .then(function () { status('Link copied.'); })
      .catch(function () { status('Copy failed.'); });
  });

  /* ---------- the library ---------- */
  var toggle = $('#browse-toggle');
  var library = $('#quotes');

  function setToggleLabel(open) {
    toggle.textContent = open
      ? 'Hide the passages'
      : 'See all ' + state.data.quotes.length + ' passages';
  }

  toggle.addEventListener('click', function () {
    var open = library.hidden;
    library.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    setToggleLabel(open);
    if (open) library.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function buildFilters() {
    var sel = $('#poem-filter');
    state.data.poems.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.title;
      sel.appendChild(o);
    });

    var themes = [];
    state.data.quotes.forEach(function (q) {
      (q.themes || []).forEach(function (t) {
        if (themes.indexOf(t) === -1) themes.push(t);
      });
    });
    themes.sort();

    var wrap = $('#theme-chips');
    themes.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.themeFilter = t;
      b.textContent = t;
      b.addEventListener('click', function () {
        state.theme = state.theme === t ? '' : t;
        wrap.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('is-on', c.dataset.themeFilter === state.theme);
        });
        apply();
      });
      wrap.appendChild(b);
    });

    sel.addEventListener('change', function () { state.poem = sel.value; apply(); });
    $('#search').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      apply();
    });
  }

  function apply() {
    state.filtered = state.data.quotes.filter(function (q) {
      if (state.poem && q.poem !== state.poem) return false;
      if (state.theme && (q.themes || []).indexOf(state.theme) === -1) return false;
      if (state.q) {
        var hay = (q.lines.join(' ') + ' ' + state.poemsById[q.poem].title).toLowerCase();
        if (hay.indexOf(state.q) === -1) return false;
      }
      return true;
    });
    renderGrid();
  }

  function renderGrid() {
    grid.innerHTML = '';
    var frag = document.createDocumentFragment();
    state.filtered.forEach(function (q) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quote-card';
      btn.setAttribute('aria-label', 'Show: ' + q.lines.join(' / '));

      var p = document.createElement('p');
      p.className = 'qc-lines';
      q.lines.forEach(function (line, i) {
        if (i) p.appendChild(document.createElement('br'));
        p.appendChild(document.createTextNode(line));
      });

      var foot = document.createElement('div');
      foot.className = 'qc-foot';
      var poem = document.createElement('span');
      poem.className = 'qc-poem';
      poem.textContent = state.poemsById[q.poem].title;
      var cta = document.createElement('span');
      cta.className = 'qc-cta';
      cta.textContent = 'Show ↑';
      foot.appendChild(poem);
      foot.appendChild(cta);

      btn.appendChild(p);
      btn.appendChild(foot);
      btn.addEventListener('click', function () {
        show(q);
        document.getElementById('stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.appendChild(btn);
      frag.appendChild(li);
    });
    grid.appendChild(frag);

    var n = state.filtered.length;
    $('#result-count').textContent = n + (n === 1 ? ' passage' : ' passages');
    $('#empty').hidden = n !== 0;
  }
})();
