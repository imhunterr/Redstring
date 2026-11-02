/* redstring — the evidence board: drag cards, pin new ones, tie & cut strings, filter by type */
(function () {
  "use strict";
  var S = window.RS.store, U = window.RS.ui, h = U.h;
  var SVGNS = "http://www.w3.org/2000/svg";

  var board = document.getElementById("board-main");
  var svg = board.querySelector(".strings");
  var chipsBox = document.getElementById("board-chips");
  var countBox = document.getElementById("board-count");
  var tieBtn = document.getElementById("tie-btn");
  var hintBox = document.getElementById("board-hint");

  var hiddenTypes = {};
  try { hiddenTypes = JSON.parse(localStorage.getItem("redstring-board-hidden") || "{}") || {}; } catch (e) { hiddenTypes = {}; }
  var tying = null;          // null = off, {} = on, {from:id} = first card picked

  /* ---------- geometry ---------- */
  function pinPoint(el) {
    var b = board.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + 2 };
  }
  function openSpot(p, q) {
    var b = board.getBoundingClientRect(), pad = 6;
    var rects = [].map.call(board.querySelectorAll(".card"), function (c) {
      var r = c.getBoundingClientRect();
      return { l: r.left - b.left - pad, t: r.top - b.top - pad, r: r.right - b.left + pad, b: r.bottom - b.top + pad };
    });
    var N = 60, best = null, run = null;
    for (var i = 0; i <= N; i++) {
      var t = i / N, x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
      var hid = rects.some(function (r) { return x > r.l && x < r.r && y > r.t && y < r.b; });
      if (!hid) { run = run || { a: t }; run.z = t; }
      if ((hid || i === N) && run) { if (!best || run.z - run.a > best.z - best.a) best = run; run = null; }
    }
    var m = best ? (best.a + best.z) / 2 : 0.5;
    return { x: p.x + (q.x - p.x) * m, y: p.y + (q.y - p.y) * m };
  }

  /* ---------- strings ---------- */
  function drawStrings() {
    svg.innerHTML = "";
    board.querySelectorAll(".string-tag").forEach(function (t) { t.remove(); });
    var shown = 0;
    S.links().forEach(function (l) {
      var a = board.querySelector('.card[data-id="' + CSS.escape(l.from) + '"]');
      var z = board.querySelector('.card[data-id="' + CSS.escape(l.to) + '"]');
      if (!a || !z) return;
      shown++;
      var p = pinPoint(a), q = pinPoint(z);
      var g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", "string");
      g.dataset.from = l.from; g.dataset.to = l.to;
      ["core", "twist"].forEach(function (cls) {
        var ln = document.createElementNS(SVGNS, "line");
        ln.setAttribute("class", cls);
        ln.setAttribute("x1", p.x); ln.setAttribute("y1", p.y);
        ln.setAttribute("x2", q.x); ln.setAttribute("y2", q.y);
        g.appendChild(ln);
      });
      svg.appendChild(g);

      var ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
      var spot = openSpot(p, q);
      var tag = h("button", { class: "string-tag", type: "button", title: "Cut this string", "data-link": l.id }, l.rel);
      tag.dataset.from = l.from; tag.dataset.to = l.to;
      tag.style.left = spot.x + "px"; tag.style.top = spot.y + "px";
      tag.style.setProperty("--ang", ang + "deg");
      board.appendChild(tag);
    });
    var cards = board.querySelectorAll(".card").length;
    countBox.textContent = cards + " pinned · " + shown + " strings";
  }

  /* ---------- cards ---------- */
  function cardFor(e) {
    var note = e.type === "source" || e.type === "person";
    var a = h("a", {
      class: "card t-" + e.type + (note ? " note" : ""), href: U.caseUrl(e.id), "data-id": e.id, "data-type": e.type,
      style: "left:min(" + e.x + "%, calc(100% - 206px));top:min(" + e.y + "%, calc(100% - 150px));--tilt:" + e.tilt + "deg",
      draggable: "false"
    },
      h("span", { class: "pin" }),
      h("span", { class: "type" }, e.type + (e.type === "idea" && e.stage ? " · " + e.stage : "")),
      h("div", { class: "name" }, e.name),
      e.blurb ? h("p", { class: "blurb" }, e.blurb) : null,
      U.stamp(e.status));
    return a;
  }

  function renderChips() {
    var counts = {};
    S.entities().forEach(function (e) { if (e.onBoard) counts[e.type] = (counts[e.type] || 0) + 1; });
    chipsBox.innerHTML = "";
    S.TYPES.forEach(function (t) {
      if (!counts[t]) return;
      chipsBox.appendChild(h("button", { class: "chip t-" + t, type: "button", "data-type": t, "aria-pressed": hiddenTypes[t] ? "false" : "true" },
        h("span", { class: "pin-dot" }), t + " ", h("span", { class: "count" }, counts[t])));
    });
  }

  function render() {
    board.querySelectorAll(".card").forEach(function (c) { c.remove(); });
    var list = S.entities().filter(function (e) { return e.onBoard && !hiddenTypes[e.type]; });
    var empty = document.getElementById("board-empty");
    empty.hidden = list.length > 0;
    list.forEach(function (e) { board.appendChild(cardFor(e)); });
    renderChips();
    drawStrings();
    if (tying && tying.from) {
      var c = board.querySelector('.card[data-id="' + CSS.escape(tying.from) + '"]');
      if (c) c.classList.add("picked"); else tying = {};
    }
  }

  /* ---------- drag to move ---------- */
  var drag = null, raf = 0, suppressClick = false;
  board.addEventListener("pointerdown", function (e) {
    var c = e.target.closest(".card");
    if (!c || e.button !== 0 || tying) return;
    var b = board.getBoundingClientRect(), r = c.getBoundingClientRect();
    drag = { el: c, id: c.dataset.id, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false, b: b, pid: e.pointerId };
  });
  board.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
    if (!drag.moved) { drag.moved = true; drag.el.classList.add("dragging"); board.classList.add("is-dragging"); try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    e.preventDefault();
    var b = drag.b, w = drag.el.offsetWidth, hgt = drag.el.offsetHeight;
    var x = Math.min(Math.max(e.clientX - b.left - drag.dx, 0), b.width - w);
    var y = Math.min(Math.max(e.clientY - b.top - drag.dy, 8), b.height - hgt);
    drag.x = x / b.width * 100; drag.y = y / b.height * 100;
    drag.el.style.left = drag.x + "%"; drag.el.style.top = drag.y + "%";
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; drawStrings(); });
  });
  function endDrag(e) {
    if (!drag) return;
    var d = drag; drag = null;
    board.classList.remove("is-dragging");
    d.el.classList.remove("dragging");
    if (d.moved) {
      suppressClick = true; setTimeout(function () { suppressClick = false; }, 50);
      S.updateEntity(d.id, { x: Math.round(d.x * 10) / 10, y: Math.round(d.y * 10) / 10 }, true);
      drawStrings();
    }
  }
  board.addEventListener("pointerup", endDrag);
  board.addEventListener("pointercancel", endDrag);

  /* ---------- clicks: open, tie, cut ---------- */
  board.addEventListener("click", function (e) {
    var tag = e.target.closest(".string-tag");
    if (tag) {
      e.preventDefault();
      var l = S.links().filter(function (x) { return x.id === tag.dataset.link; })[0]; if (!l) return;
      var a = S.entity(l.from), z = S.entity(l.to);
      U.confirm("Cut this string?", a.name + " — " + l.rel + " — " + z.name, "Cut it").then(function (y) {
        if (y) { S.deleteLink(l.id); U.toast("String cut"); }
      });
      return;
    }
    var c = e.target.closest(".card");
    if (!c) return;
    if (suppressClick) { e.preventDefault(); return; }
    if (!tying) return;                                  // normal click opens the case file
    e.preventDefault();
    if (!tying.from) {
      tying.from = c.dataset.id; c.classList.add("picked");
      hint("Now click the card it connects to.");
      return;
    }
    if (tying.from === c.dataset.id) { c.classList.remove("picked"); tying = {}; hint("Click the first card."); return; }
    var from = S.entity(tying.from), to = S.entity(c.dataset.id);
    U.modal({
      title: "Tie a string", kicker: "connect two files", submit: "Tie it",
      message: from.name + "  →  ? →  " + to.name,
      fields: [{ name: "rel", label: from.name + " …", type: "select", value: "related to",
        options: Object.keys(S.RELS).map(function (r) { return [r, r + " " + to.name]; }) }]
    }).then(function (v) {
      board.querySelectorAll(".card.picked").forEach(function (x) { x.classList.remove("picked"); });
      tying = {}; hint("Pick the next pair, or press Esc to stop.");
      if (v) { S.addLink(from.id, to.id, v.rel); U.toast("String tied"); }
    });
  });

  function hint(msg) { hintBox.textContent = msg; }
  function setTying(on) {
    tying = on ? {} : null;
    board.classList.toggle("tying", on);
    tieBtn.setAttribute("aria-pressed", String(on));
    board.querySelectorAll(".card.picked").forEach(function (x) { x.classList.remove("picked"); });
    hint(on ? "Tie mode: click the first card." : "Drag cards to arrange · double-click the cork to pin a card · click a label to cut its string");
  }
  tieBtn.addEventListener("click", function () { setTying(!tying); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && tying && !document.querySelector("dialog[open]")) setTying(false); });

  /* ---------- pin new cards ---------- */
  // emptiest spot on the cork for a new card (least overlap with existing cards)
  function freeSpot() {
    var b = board.getBoundingClientRect();
    var w = 210 / b.width * 100, hh = 160 / b.height * 100;
    var taken = [].map.call(board.querySelectorAll(".card"), function (c) {
      var r = c.getBoundingClientRect();
      return { l: (r.left - b.left) / b.width * 100, t: (r.top - b.top) / b.height * 100, r: (r.right - b.left) / b.width * 100, b: (r.bottom - b.top) / b.height * 100 };
    });
    var best = { x: 40, y: 40, cost: Infinity };
    for (var y = 3; y <= 100 - hh; y += 4) {
      for (var x = 2; x <= 100 - w; x += 3) {
        var cost = 0;
        taken.forEach(function (t) {
          var ox = Math.max(0, Math.min(x + w, t.r) - Math.max(x, t.l));
          var oy = Math.max(0, Math.min(y + hh, t.b) - Math.max(y, t.t));
          cost += ox * oy;
        });
        cost += Math.abs(x - 40) * 0.01 + y * 0.01;     // prefer near the middle-top on ties
        if (cost < best.cost) best = { x: x, y: y, cost: cost };
      }
    }
    return best;
  }

  function pinAt(x, y) {
    if (x == null) { var f = freeSpot(); x = f.x; y = f.y; }
    U.newEntity({ title: "Pin a new card", x: x, y: y, onBoard: true }).then(function (e) {
      if (e && !e.onBoard) S.updateEntity(e.id, { onBoard: true });
    });
  }
  document.getElementById("pin-btn").addEventListener("click", function () { pinAt(); });
  board.addEventListener("dblclick", function (e) {
    if (e.target.closest(".card, .string-tag")) return;
    var b = board.getBoundingClientRect();
    pinAt((e.clientX - b.left - 98) / b.width * 100, (e.clientY - b.top - 20) / b.height * 100);
  });

  /* ---------- filters ---------- */
  chipsBox.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip"); if (!chip) return;
    var t = chip.dataset.type;
    if (hiddenTypes[t]) delete hiddenTypes[t]; else hiddenTypes[t] = true;
    try { localStorage.setItem("redstring-board-hidden", JSON.stringify(hiddenTypes)); } catch (err) { /* ignore */ }
    render();
  });
  S.on(function (what) { if (what !== "quiet") render(); });
  window.addEventListener("resize", drawStrings);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawStrings);
  setTying(false);
  render();
})();
