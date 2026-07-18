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
    fullPoems: [],     // full text, from poems.json
    fullById: {},
    stanzaById: {},    // every stanza in the book, shareable by id
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

  /* ---------- load ----------
     base() not a relative path: the app is also served from /q/<id>/ and
     /poem/<id>/, where "data/quotes.json" would resolve to
     /q/<id>/data/quotes.json and 404. Every shared link would open a page
     that couldn't load the poems. */
  Promise.all([
    fetch(base() + 'data/quotes.json').then(function (r) {
      if (!r.ok) throw new Error('quotes ' + r.status);
      return r.json();
    }),
    fetch(base() + 'data/poems.json').then(function (r) {
      if (!r.ok) throw new Error('poems ' + r.status);
      return r.json();
    })
  ])
    .then(function (both) {
      var data = both[0];
      state.data = data;
      state.fullPoems = both[1].poems;
      data.poems.forEach(function (p) { state.poemsById[p.id] = p; });
      // index every stanza by id so it can be shown, shared and linked
      state.fullPoems.forEach(function (p) {
        state.fullById[p.id] = p;
        p.stanzas.forEach(function (s) {
          state.stanzaById[s.id] = { id: s.id, poem: p.id, lines: s.lines };
        });
      });
      setToggleLabel(false);
      buildFilters();
      apply();
      buildPoemIndex();
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

  /* draw(true) = the reader asked for another (button, tap, space) — push a
     history entry so Back returns the passage they just lost.
     draw(false) = the first draw on load — replace, so Back leaves the site
     rather than landing on a bare "/" with a card already on screen. */
  function draw(push) {
    if (!state.deck.length) refillDeck(state.current && state.current.id);
    var id = state.deck.pop();
    show(byId(id), push ? 'push' : 'replace');
  }

  /* An id may be a curated passage (wlng-1) or any stanza in the book
     (the-nutshell-s3). Both are shareable; curated ids came first, so they win. */
  function byId(id) {
    return state.data.quotes.filter(function (q) { return q.id === id; })[0]
        || state.stanzaById[id];
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

  /* mode: 'push' adds a history entry (Back returns here), 'replace' swaps the
     current one, 'none' leaves history alone — used when we're responding TO a
     history change and the URL is already correct. Pushing there would fight
     the Back button and trap the reader. */
  function show(q, mode) {
    if (!q) return;
    state.current = q;
    $('#stage-poem').textContent = 'from “' + state.poemsById[q.poem].title + '”';
    $('#stage-fallback').hidden = true;
    $('#status').textContent = '';

    // Put the SHAREABLE url in the address bar. People copy from there — the
    // whole point of this site is sharing, so what's on screen must be what
    // travels. "#q=<id>" never reaches a server and previews as the homepage.
    var url = base() + 'q/' + q.id + '/';
    if (mode === 'push' && location.pathname !== url) history.pushState(null, '', url);
    else if (mode !== 'none' && location.pathname !== url) history.replaceState(null, '', url);

    canvas.classList.add('is-changing');
    var render = function () {
      paint();
      requestAnimationFrame(function () { canvas.classList.remove('is-changing'); });
    };
    // Webfonts must be ready or the canvas silently falls back to a system serif.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    else render();
  }

  /* ---------- analytics ----------
     GoatCounter, cookieless. Counting is manual (no_onload in the script tag)
     because the site is hash-routed: the default would record "/" for every
     poem and every shared stanza, which answers nothing. The whole question is
     WHICH lines travel — so the hash is the interesting part of the path.

     count.js loads async and may not be here yet on first paint; queue until it is. */
  var pendingCount = null;
  function countView() {
    var path = location.pathname + (location.hash || '');
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: path });
      pendingCount = null;
    } else {
      pendingCount = path;
    }
  }
  window.addEventListener('load', function () {
    if (pendingCount && window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: pendingCount });
      pendingCount = null;
    }
  });

  /* Route from the hash. Called on load AND on hashchange — without the
     listener, the Back button and any in-page #poem= link change the URL and
     nothing else, which looks exactly like a broken site. */
  function route(initial) {
    countView();
    var t = routeTarget();

    /* An old "#q=" link is the ONE case where the URL is not already right: it
       routes correctly but leaves the address bar holding the un-shareable
       shape, so the next person to copy it hits the same dead preview. Upgrade
       it in place — on arrival only, never while responding to Back. */
    var fix = initial && t && t.via === 'hash' ? 'replace' : 'none';

    if (t && t.kind === 'poem' && state.fullById[t.id]) {
      if (initial) draw(false);     // leave a passage on the stage behind them
      showPoem(t.id, true, fix);
      return;
    }
    // Backing out past the poem must actually close it, or the URL says one
    // thing and the screen shows another.
    if (!initial && $('#poem') && !$('#poem').hidden) hidePoem('none');

    var q = t && t.kind === 'q' && byId(t.id);
    if (q) {
      // Came back via Back/Forward, or arrived on a /q/ link: the URL is already
      // right, so 'none' — pushing there would fight the history stack.
      state.deck = state.deck.filter(function (id) { return id !== q.id; });
      show(q, fix);
    } else if (initial) {
      draw(false);
    }
  }

  function start() {
    refillDeck();
    route(true);
    // popstate for path navigation (Back/Forward), hashchange for older
    // "#q=" links someone may still have. Path changes never fire hashchange.
    window.addEventListener('popstate', function () { route(false); });
    window.addEventListener('hashchange', function () { route(false); });
  }

  $('#another').addEventListener('click', function () { draw(true); });

  /* Tap the card itself for the next passage — the obvious gesture on a phone,
     where "press space" is meaningless. Bound to the canvas, not its container,
     so tapping the empty space beside the card doesn't fire.
     Keyboard/AT users aren't stranded: the button beside it does the same thing. */
  canvas.addEventListener('click', function () { draw(true); });

  // Space / N for another. Ignore it while typing in the search box.
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ' || e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      draw(true);
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

  /* The app root. The app is served at "/" AND at "/q/<id>/" and "/poem/<id>/",
     so the root has to be derived by stripping those, not read off the URL.
     ("/icametobefree/" on the github.io fallback.) */
  function base() {
    var p = location.pathname.replace(/index\.html$/, '');
    p = p.replace(/(q|poem)\/[\w-]+\/?$/, '');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }

  /* What the URL is asking for — path first (the shareable form), hash second
     (older links, still honoured). This is why the address bar can now be
     copied straight into a chat and preview properly. */
  function routeTarget() {
    var m = location.pathname.match(/\/q\/([\w-]+)\/?$/);
    if (m) return { kind: 'q', id: m[1], via: 'path' };
    m = location.pathname.match(/\/poem\/([\w-]+)\/?$/);
    if (m) return { kind: 'poem', id: m[1], via: 'path' };
    m = /#q=([\w-]+)/.exec(location.hash);
    if (m) return { kind: 'q', id: m[1], via: 'hash' };
    m = /#poem=([\w-]+)/.exec(location.hash);
    if (m) return { kind: 'poem', id: m[1], via: 'hash' };
    return null;
  }

  /* Share the /q/<id>/ page, NOT "#q=<id>".
     A fragment is never sent to the server — a crawler asked for "#q=isyn-3"
     requests "/" and gets the generic homepage tags. The /q/ pages are real
     URLs carrying the quote in their OG tags, and they bounce the reader
     straight back to #q=<id>. Same destination, but it can actually preview. */
  function permalink() {
    return location.origin + base() + 'q/' + state.current.id + '/';
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

  /* ---------- the poems ---------- */

  /* Render markdown-lite emphasis as real elements. Built as nodes, never as
     innerHTML — the poems are data, and data never becomes markup here. */
  function runsToNodes(line) {
    var frag = document.createDocumentFragment();
    QuoteCard.parseRuns(line).forEach(function (r) {
      if (r.s === 'i') {
        var em = document.createElement('em'); em.textContent = r.t; frag.appendChild(em);
      } else if (r.s === 'b') {
        var st = document.createElement('strong'); st.textContent = r.t; frag.appendChild(st);
      } else {
        frag.appendChild(document.createTextNode(r.t));
      }
    });
    return frag;
  }

  function buildPoemIndex() {
    var ul = $('#poem-index');
    ul.innerHTML = '';
    state.fullPoems.forEach(function (p) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'poem-link';
      var t = document.createElement('span');
      t.className = 'pl-title';
      t.textContent = p.title;
      var m = document.createElement('span');
      m.className = 'pl-meta';
      m.textContent = p.stanzas.length + ' stanzas · p.' + p.page;
      b.appendChild(t); b.appendChild(m);
      b.addEventListener('click', function () { showPoem(p.id, true, 'push'); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function showPoem(pid, scroll, mode) {
    var p = state.fullById[pid];
    if (!p) return;
    state.currentPoem = pid;   // the copy-link button reads this, not the URL
    $('#poem-index').hidden = true;
    $('#poem').hidden = false;
    $('#poem-title').textContent = p.title;
    $('#poem-meta').textContent = 'from “I came to be free” · page ' + p.page;
    $('#poem-status').textContent = '';

    var body = $('#poem-body');
    body.innerHTML = '';
    p.stanzas.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'stanza';
      b.id = s.id;
      b.setAttribute('aria-label', 'Make a card of: ' + s.lines.join(' / ').replace(/\*/g, ''));
      var pre = document.createElement('p');
      pre.className = 'stanza-lines';
      s.lines.forEach(function (line, i) {
        if (i) pre.appendChild(document.createElement('br'));
        pre.appendChild(runsToNodes(line));
      });
      var cue = document.createElement('span');
      cue.className = 'stanza-cue';
      cue.textContent = 'Share ↑';
      b.appendChild(pre);
      b.appendChild(cue);
      b.addEventListener('click', function () {
        // push: Back should return them to the poem they were reading
        show(state.stanzaById[s.id], 'push');
        document.getElementById('stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      body.appendChild(b);
    });

    var url = base() + 'poem/' + pid + '/';
    if (mode === 'push' && location.pathname !== url) history.pushState(null, '', url);
    else if (mode !== 'none' && location.pathname !== url) history.replaceState(null, '', url);
    if (scroll) $('#poems').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hidePoem(mode) {
    $('#poem').hidden = true;
    $('#poem-index').hidden = false;
    // 'none' when we're reacting to Back — rewriting the URL mid-navigation
    // would fight the history stack we're trying to honour.
    if (mode !== 'none') history.replaceState(null, '', base() + location.search);
  }

  $('#poem-back').addEventListener('click', function () { hidePoem(); });

  $('#copy-poem-link').addEventListener('click', function () {
    // Read the shown poem from state, not the URL. The URL used to carry
    // "#poem=<id>" in the hash; since the routing refactor it's the path
    // /poem/<id>/, so the old hash regex matched nothing and the button
    // silently did nothing.
    var pid = state.currentPoem;
    if (!pid) return;
    // /poem/<id>/ — a real URL with the poem's opening stanza in its OG tags.
    var url = location.origin + base() + 'poem/' + pid + '/';
    navigator.clipboard.writeText(url)
      .then(function () { $('#poem-status').textContent = 'Link copied.'; })
      .catch(function () { $('#poem-status').textContent = 'Copy failed.'; });
    setTimeout(function () { $('#poem-status').textContent = ''; }, 2600);
  });

  /* ---------- reading requests ----------
     Submitted by fetch so the reader stays on the page instead of being thrown
     to a vendor's thank-you screen. If it fails for any reason — vendor down,
     key expired, offline — say so and give the email address, because a lost
     invitation from a library is a genuinely expensive failure. */
  var rform = $('#reading-form');
  if (rform) {
    rform.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('#reading-status');
      var btn = $('#reading-submit');
      var data = Object.fromEntries(new FormData(rform));

      if (!data.name || !data.email) {
        status.textContent = 'A name and an email, and I can write back.';
        return;
      }

      btn.disabled = true;
      status.textContent = 'Sending…';

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.success) {
            rform.innerHTML = '';
            status.textContent = 'Thank you — that’s reached me. I’ll write back.';
          } else {
            throw new Error(j.message || 'rejected');
          }
        })
        .catch(function () {
          btn.disabled = false;
          status.innerHTML = 'That didn’t send, sorry. Please email ' +
            '<a href="mailto:readings@starlingpoetry.xyz?subject=Reading%20request">' +
            'readings@starlingpoetry.xyz</a> instead.';
        });
    });
  }

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
        show(q, 'push');
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
