/* Site behaviour: load quotes, filter, and drive the share dialog. */
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

  var state = {
    data: null,
    poemsById: {},
    filtered: [],
    theme: '',
    poem: '',
    q: '',
    current: null,
    format: 'square',
    cardTheme: 'ink'
  };

  var $ = function (s) { return document.querySelector(s); };
  var grid = $('#quote-grid');
  var dialog = $('#share-dialog');
  var canvas = $('#card-canvas');

  /* ---------- load ---------- */
  fetch('data/quotes.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      state.data = data;
      data.poems.forEach(function (p) { state.poemsById[p.id] = p; });
      buildFilters();
      apply();
      openFromHash();
    })
    .catch(function (err) {
      grid.innerHTML = '';
      $('#empty').hidden = false;
      $('#empty').textContent = 'The quotes could not be loaded. Please refresh.';
      console.error(err);
    });

  /* ---------- filters ---------- */
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
    $('#shuffle').addEventListener('click', function () {
      var pool = state.filtered.length ? state.filtered : state.data.quotes;
      openQuote(pool[Math.floor(Math.random() * pool.length)]);
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
      btn.setAttribute('aria-label', 'Share: ' + q.lines.join(' / '));

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
      cta.textContent = 'Share ↗';
      foot.appendChild(poem);
      foot.appendChild(cta);

      btn.appendChild(p);
      btn.appendChild(foot);
      btn.addEventListener('click', function () { openQuote(q); });
      li.appendChild(btn);
      frag.appendChild(li);
    });
    grid.appendChild(frag);

    var n = state.filtered.length;
    $('#result-count').textContent = n + (n === 1 ? ' passage' : ' passages');
    $('#empty').hidden = n !== 0;
  }

  /* ---------- share dialog ---------- */
  function meta() {
    return {
      author: state.data.book.author,
      book: state.data.book.title,
      site: SITE
    };
  }

  function draw() {
    if (!state.current) return;
    QuoteCard.render(canvas, {
      lines: state.current.lines,
      poemTitle: state.poemsById[state.current.poem].title
    }, state.format, state.cardTheme, meta());
  }

  function openQuote(q) {
    state.current = q;
    $('#dlg-poem').textContent = 'from “' + state.poemsById[q.poem].title + '”';
    $('#dlg-status').textContent = '';
    history.replaceState(null, '', '#q=' + q.id);
    if (!dialog.open) dialog.showModal();
    // Webfonts must be ready or canvas falls back to a system serif.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    else draw();
  }

  function openFromHash() {
    var m = /#q=([\w-]+)/.exec(location.hash);
    if (!m) return;
    var q = state.data.quotes.filter(function (x) { return x.id === m[1]; })[0];
    if (q) openQuote(q);
  }

  document.querySelectorAll('[data-format]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.format = b.dataset.format;
      document.querySelectorAll('[data-format]').forEach(function (x) {
        x.classList.toggle('is-on', x === b);
      });
      draw();
    });
  });

  document.querySelectorAll('[data-theme]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.cardTheme = b.dataset.theme;
      document.querySelectorAll('[data-theme]').forEach(function (x) {
        x.classList.toggle('is-on', x === b);
      });
      draw();
    });
  });

  function status(msg) {
    $('#dlg-status').textContent = msg;
    setTimeout(function () {
      if ($('#dlg-status').textContent === msg) $('#dlg-status').textContent = '';
    }, 2600);
  }

  function filename() {
    return 'i-came-to-be-free-' + state.current.id + '-' + state.format + '.png';
  }

  function shareText() {
    return state.current.lines.join('\n') +
      '\n\n— ' + state.data.book.author + ', “' + state.data.book.title + '”' +
      '\n' + location.origin + location.pathname + '#q=' + state.current.id;
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
    navigator.clipboard.writeText(location.origin + location.pathname + '#q=' + state.current.id)
      .then(function () { status('Link copied.'); })
      .catch(function () { status('Copy failed.'); });
  });

  $('#dlg-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close(); // click on backdrop
  });
  dialog.addEventListener('close', function () {
    history.replaceState(null, '', location.pathname + location.search);
  });
})();
