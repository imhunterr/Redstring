/* redstring — Map: one file in the middle, its connections around it on red strings.
   Click a neighbour to walk the string to it. Laid out automatically, so it never gets cluttered. */
(function () {
  "use strict";
  var S = window.RS.store, U = window.RS.ui, h = U.h;
  var SVGNS = "http://www.w3.org/2000/svg";

  var stage = document.getElementById("map-stage");
  var svg = stage.querySelector(".strings");
  var trailBox = document.getElementById("map-trail");
  var pickBox = document.getElementById("map-pick");
  var noteBox = document.getElementById("map-note");

  var els = {};        // id -> card element currently on stage
  var focusId = null;
  var trail = [];
  var animUntil = 0;

  function neighbours(id) {
    var out = [];
    S.linksOf(id).forEach(function (l) {
      var mine = l.from === id, other = mine ? l.to : l.from;
      if (!S.entity(other)) return;
      var rel = mine ? l.rel : S.RELS[l.rel];
      var have = out.filter(function (n) { return n.id === other; })[0];
      if (have) { if (have.rels.indexOf(rel) < 0) have.rels.push(rel); }
      else out.push({ id: other, rels: [rel] });
    });
    // keep the same relation next to each other around the circle
    out.sort(function (a, b) { return a.rels[0].localeCompare(b.rels[0]) || S.entity(a.id).name.localeCompare(S.entity(b.id).name); });
    return out;
  }

  function mostConnected() {
    var best = null, n = -1;
    S.entities().forEach(function (e) { var k = S.linksOf(e.id).length; if (k > n) { n = k; best = e; } });
    return best && best.id;
  }

  /* ---------- cards ---------- */
  function makeCard(e, isCenter) {
    var c = h(isCenter ? "div" : "button", { class: "mcard t-" + e.type + (isCenter ? " center" : ""), type: isCenter ? null : "button", "data-id": e.id },
      h("span", { class: "pin" }),
      h("span", { class: "mc-type" }, e.type),
      h("span", { class: "mc-name" }, e.name));
    if (isCenter) {
      if (e.blurb) c.appendChild(h("span", { class: "mc-blurb" }, e.blurb));
      c.appendChild(h("span", { class: "mc-foot" }, U.stamp(e.status, "xs"), h("a", { class: "mc-open", href: U.caseUrl(e.id) }, "open file →")));
    } else {
      var k = S.linksOf(e.id).length;
      c.appendChild(h("span", { class: "mc-more" }, k > 1 ? "↔ " + (k - 1) + " more" : "end of string"));
      c.title = "Walk to " + e.name;
    }
    return c;
  }

  /* ---------- layout ---------- */
  function layout() {
    var ns = neighbours(focusId);
    var W = stage.clientWidth;
    if (W < 640) return hanging(ns, W);
    stage.style.height = "";
    var H = stage.clientHeight;
    var cx = W / 2, cy = H / 2;
    var small = false;
    var rx = Math.max(120, Math.min(W / 2 - (small ? 74 : 110), 430));
    var ry = Math.max(110, Math.min(H / 2 - (small ? 52 : 64), 270));
    var pos = {};
    pos[focusId] = { x: cx, y: cy };
    var many = ns.length > 9;
    ns.forEach(function (n, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(ns.length, 1);
      var r = many && i % 2 ? 0.66 : 1;
      pos[n.id] = { x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r };
    });
    return { pos: pos, ns: ns };
  }

  // phones: centre file at the top, its connections hang below in two columns
  function hanging(ns, W) {
    var pos = {}, rows = Math.ceil(ns.length / 2), top = 250, gap = 150;
    pos[focusId] = { x: W / 2, y: 100 };
    ns.forEach(function (n, i) {
      var col = ns.length === 1 ? 0.5 : (i % 2 ? 0.74 : 0.26);
      pos[n.id] = { x: W * col, y: top + Math.floor(i / 2) * gap };
    });
    stage.style.height = Math.max(260, top + rows * gap - 40) + "px";
    return { pos: pos, ns: ns };
  }

  function render(animate) {
    var e = S.entity(focusId);
    if (!e) {
      focusId = mostConnected();
      e = S.entity(focusId);
      if (!e) { stage.classList.add("is-empty"); noteBox.textContent = "No files yet. Open one from Files."; return; }
    }
    stage.classList.remove("is-empty");
    var L = layout();
    var keep = {};
    Object.keys(L.pos).forEach(function (id) { keep[id] = true; });

    // leaving cards slide into the middle and fade
    Object.keys(els).forEach(function (id) {
      if (keep[id]) return;
      var el = els[id]; delete els[id];
      el.classList.add("leaving");
      el.style.left = L.pos[focusId].x + "px"; el.style.top = L.pos[focusId].y + "px";
      setTimeout(function () { el.remove(); }, 450);
    });

    Object.keys(L.pos).forEach(function (id) {
      var isCenter = id === focusId;
      var old = els[id];
      var fresh = makeCard(S.entity(id), isCenter);
      if (old) {
        fresh.style.left = old.style.left; fresh.style.top = old.style.top;
        old.replaceWith(fresh);
      } else {
        // new cards grow out of the middle
        var from = animate ? L.pos[focusId] : L.pos[id];
        fresh.style.left = from.x + "px"; fresh.style.top = from.y + "px";
        if (animate) fresh.classList.add("entering");
        stage.appendChild(fresh);
      }
      els[id] = fresh;
    });
    void stage.offsetWidth;                 // commit start positions so the move animates
    Object.keys(L.pos).forEach(function (id) {
      var el = els[id];
      el.classList.remove("entering");
      el.style.left = L.pos[id].x + "px"; el.style.top = L.pos[id].y + "px";
    });

    noteBox.textContent = L.ns.length ? "" : "No strings from " + e.name + " yet. Connect it from its case file.";
    stage.dataset.rels = JSON.stringify(L.ns.map(function (n) { return [n.id, n.rels.join(" · ")]; }));
    animUntil = performance.now() + (animate ? 520 : 60);
    tick();
    renderTrail();
    renderPick();
    document.title = e.name + " · map · redstring";
  }

  /* strings follow the cards while they move */
  function tick() {
    drawStrings();
    if (performance.now() < animUntil) requestAnimationFrame(tick);
  }
  function center(el) {
    var b = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
  }
  function openSpot(p, q) {
    var b = stage.getBoundingClientRect(), pad = 6;
    var rects = Object.keys(els).map(function (id) {
      var r = els[id].getBoundingClientRect();
      return { l: r.left - b.left - pad, t: r.top - b.top - pad, r: r.right - b.left + pad, b: r.bottom - b.top + pad };
    });
    var N = 50, best = null, run = null;
    for (var i = 0; i <= N; i++) {
      var t = i / N, x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
      var hid = rects.some(function (r) { return x > r.l && x < r.r && y > r.t && y < r.b; });
      if (!hid) { run = run || { a: t }; run.z = t; }
      if ((hid || i === N) && run) { if (!best || run.z - run.a > best.z - best.a) best = run; run = null; }
    }
    var m = best ? (best.a + best.z) / 2 : 0.5;
    return { x: p.x + (q.x - p.x) * m, y: p.y + (q.y - p.y) * m };
  }
  function drawStrings() {
    svg.innerHTML = "";
    stage.querySelectorAll(".map-tag").forEach(function (t) { t.remove(); });
    var mid = els[focusId]; if (!mid) return;
    var p = center(mid);
    var rels = [];
    try { rels = JSON.parse(stage.dataset.rels || "[]"); } catch (e) { rels = []; }
    rels.forEach(function (pair) {
      var el = els[pair[0]]; if (!el) return;
      var q = center(el);
      var ln = document.createElementNS(SVGNS, "line");
      ln.setAttribute("x1", p.x); ln.setAttribute("y1", p.y); ln.setAttribute("x2", q.x); ln.setAttribute("y2", q.y);
      svg.appendChild(ln);
      var s = openSpot(p, q);
      var tag = h("span", { class: "map-tag" }, pair[1]);
      tag.style.left = s.x + "px"; tag.style.top = s.y + "px";
      stage.appendChild(tag);
    });
  }

  /* ---------- walking ---------- */
  function go(id, fromTrail) {
    if (!S.entity(id) || id === focusId) return;
    if (!fromTrail) trail.push(id);
    focusId = id;
    history.replaceState(null, "", "#" + encodeURIComponent(id));
    render(true);
  }
  stage.addEventListener("click", function (ev) {
    var c = ev.target.closest("button.mcard");
    if (c) go(c.dataset.id);
  });

  function renderTrail() {
    trailBox.innerHTML = "";
    if (trail.length < 2) { trailBox.appendChild(h("span", { class: "label" }, "click a file to walk the string")); return; }
    trail.forEach(function (id, i) {
      var e = S.entity(id); if (!e) return;
      if (i) trailBox.appendChild(h("span", { class: "trail-sep", "aria-hidden": "true" }, "→"));
      var last = i === trail.length - 1;
      trailBox.appendChild(last ? h("span", { class: "trail-now t-" + e.type }, h("span", { class: "pin-dot" }), e.name)
        : h("button", { class: "trail-step t-" + e.type, type: "button", onclick: function () { trail = trail.slice(0, i + 1); go(id, true); } }, h("span", { class: "pin-dot" }), e.name));
    });
    trailBox.appendChild(h("button", { class: "linkbtn", type: "button", onclick: function () { trail = [focusId]; renderTrail(); } }, "clear"));
  }

  function renderPick() {
    pickBox.innerHTML = "";
    var sel = h("select", { class: "input", "aria-label": "Start from" },
      S.entities().slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (e) {
        return h("option", { value: e.id, selected: e.id === focusId }, e.name + "  ·  " + e.type);
      }));
    sel.addEventListener("change", function () { trail = [sel.value]; focusId = null; go(sel.value, true); });
    pickBox.appendChild(h("label", { class: "inline-label" }, h("span", { class: "label" }, "start from"), sel));
  }

  /* ---------- boot ---------- */
  var start = decodeURIComponent(location.hash.replace(/^#/, ""));
  focusId = S.entity(start) ? start : mostConnected();
  trail = focusId ? [focusId] : [];
  window.addEventListener("resize", function () { render(false); });
  S.on(function (what) { if (what !== "quiet") render(false); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { drawStrings(); });
  render(false);
})();
