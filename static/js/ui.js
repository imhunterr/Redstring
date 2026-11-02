/* redstring — shared UI: header, footer, night shift, search, modals, toasts, markdown, quick jot */
(function () {
  "use strict";
  var S = window.RS.store;
  var root = document.documentElement;

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;            // only ever used with escaped/rendered markup
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k === "style") el.setAttribute("style", v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function stamp(status, extra) {
    if (!status) return null;
    return h("span", { class: "stamp " + status + (extra ? " " + extra : "") }, S.STATUS_LABEL[status]);
  }
  function pinDot(type) { return h("span", { class: "pin-dot t-" + type }); }
  function caseUrl(id) { return "cases.html#" + encodeURIComponent(id); }

  function fmtDate(iso, withTime) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var m = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()];
    var s = String(d.getDate()).padStart(2, "0") + " " + m + " " + d.getFullYear();
    if (withTime) s += " · " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return s;
  }
  function ago(iso) {
    if (!iso) return "never";
    var s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    return Math.floor(s / 86400) + " d ago";
  }

  /* ---------- markdown (safe: escape first, then format) ---------- */
  function inline(s) {
    s = esc(s);
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = s.replace(/\[\[([^\]\n]{1,200})\]\]/g, function (_, name) {
      var raw = name.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      var e = S.byName(raw);
      if (e) return '<a class="wikilink t-' + e.type + '" href="' + caseUrl(e.id) + '">' + name + "</a>";
      return '<a class="wikilink missing" href="#" data-new="' + name + '" title="No file yet. Click to open one.">' + name + "</a>";
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, url) {
      var u = url.replace(/&amp;/g, "&");
      if (!/^(https?:\/\/|mailto:|\/|#|[\w-]+\.html)/i.test(u)) return t;
      var ext = /^https?:/i.test(u);
      return '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + t + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return "<code>" + codes[i] + "</code>"; });
    return s;
  }
  function markdown(src) {
    var lines = String(src || "").replace(/\r/g, "").split("\n");
    var out = [], i = 0, para = [];
    function flush() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
    while (i < lines.length) {
      var ln = lines[i];
      if (/^```/.test(ln)) {
        flush(); var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++; out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); continue;
      }
      var m;
      if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) { flush(); var lv = m[1].length + 1; out.push("<h" + lv + ">" + inline(m[2]) + "</h" + lv + ">"); i++; continue; }
      if (/^\s*(---|\*\*\*)\s*$/.test(ln)) { flush(); out.push("<hr>"); i++; continue; }
      if (/^>\s?/.test(ln)) {
        flush(); var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
        out.push("<blockquote>" + inline(q.join(" ")) + "</blockquote>"); continue;
      }
      if (/^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) {
        flush(); var ordered = /^\s*\d+\./.test(ln), items = [];
        while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
          var it = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, "");
          var box = it.match(/^\[( |x)\]\s+(.*)$/i);
          items.push(box ? '<li class="task' + (box[1] !== " " ? " done" : "") + '"><span class="box">' + (box[1] !== " " ? "✓" : "") + "</span>" + inline(box[2]) + "</li>" : "<li>" + inline(it) + "</li>");
        }
        out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>")); continue;
      }
      if (!ln.trim()) { flush(); i++; continue; }
      para.push(ln.trim()); i++;
    }
    flush();
    return out.join("\n");
  }

  /* ---------- toasts ---------- */
  var toastBox;
  // toast(msg, kind) or toast(msg, { action: "undo", onAction: fn, ms: 5000 })
  function toast(msg, kind) {
    if (!toastBox) { toastBox = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.appendChild(toastBox); }
    var opts = typeof kind === "object" && kind ? kind : { kind: kind };
    var t = h("div", { class: "toast" + (opts.kind ? " " + opts.kind : "") + (opts.action ? " has-action" : "") }, msg);
    if (opts.action) {
      t.appendChild(h("button", { class: "toast-action", type: "button", onclick: function () { t.remove(); opts.onAction(); } }, opts.action));
    }
    toastBox.appendChild(t);
    var ms = opts.ms || 2200;
    setTimeout(function () { t.classList.add("out"); }, ms);
    setTimeout(function () { t.remove(); }, ms + 400);
  }
  var BIN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

  /* ---------- modal forms ---------- */
  // fields: [{name, label, type:'text'|'textarea'|'select', options:[[value,label]], value, required, placeholder, hint}]
  function modal(o) {
    return new Promise(function (resolve) {
      var dlg = h("dialog", { class: "modal" + (o.wide ? " wide" : "") });
      var form = h("form", { method: "dialog" });
      form.appendChild(h("div", { class: "modal-head" },
        h("span", { class: "label" }, o.kicker || "redstring"),
        h("h2", null, o.title)));
      if (o.message) form.appendChild(h("p", { class: "modal-msg" }, o.message));
      var first = null;
      (o.fields || []).forEach(function (f) {
        var input;
        if (f.type === "select") {
          input = h("select", { name: f.name, id: "mf-" + f.name });
          (f.options || []).forEach(function (op) {
            input.appendChild(h("option", { value: op[0], selected: String(op[0]) === String(f.value == null ? "" : f.value) }, op[1]));
          });
        } else if (f.type === "textarea") {
          input = h("textarea", { name: f.name, id: "mf-" + f.name, rows: f.rows || 5, placeholder: f.placeholder || "", required: f.required });
          input.value = f.value || "";
        } else {
          input = h("input", { type: "text", name: f.name, id: "mf-" + f.name, placeholder: f.placeholder || "", required: f.required, autocomplete: "off", list: f.list });
          input.value = f.value || "";
        }
        if (!first && f.type !== "select") first = input;
        form.appendChild(h("label", { class: "field", for: "mf-" + f.name },
          h("span", { class: "label" }, f.label), input, f.hint ? h("small", { class: "hint" }, f.hint) : null));
      });
      var ok = h("button", { class: "btn " + (o.danger ? "red" : ""), type: "submit", value: "ok" }, o.submit || "Save");
      var cancel = h("button", { class: "btn ghost", type: "button", onclick: function () { dlg.close("cancel"); } }, o.cancel || "Cancel");
      form.appendChild(h("div", { class: "modal-actions" }, cancel, ok));
      dlg.appendChild(form);
      form.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); form.requestSubmit(ok); }
      });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var vals = {};
        (o.fields || []).forEach(function (f) { vals[f.name] = form.elements[f.name].value; });
        settled = true; resolve(vals); dlg.close("ok"); setTimeout(function () { dlg.remove(); }, 0);
      });
      var settled = false;
      function finish(val) { if (settled) return; settled = true; resolve(val); setTimeout(function () { dlg.remove(); }, 0); }
      dlg.addEventListener("close", function () { finish(null); });
      dlg.addEventListener("cancel", function () { finish(null); });
      dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close("cancel"); });
      document.body.appendChild(dlg);
      dlg.showModal();
      if (first) { first.focus(); if (first.select && o.selectFirst) first.select(); } else ok.focus();
    });
  }
  function confirmBox(title, message, yes) {
    return modal({ title: title, message: message, submit: yes || "Yes", danger: true, kicker: "are you sure?" })
      .then(function (v) { return v !== null; });
  }

  var typeOptions = S.TYPES.map(function (t) { return [t, t]; });
  var statusOptions = [["", "no stamp"], ["verified", "verified"], ["inferred", "inferred"], ["lead", "active lead"]];

  function newEntity(prefill) {
    prefill = prefill || {};
    return modal({
      title: prefill.title || "Open a new file", kicker: "new case file", submit: "Open file",
      fields: [
        { name: "name", label: "Name", value: prefill.name, required: true, placeholder: "e.g. CyberArk, Passkeys, OAM" },
        { name: "type", label: "Type", type: "select", options: typeOptions, value: prefill.type || "concept" },
        { name: "blurb", label: "One-line summary", value: prefill.blurb, placeholder: "what it is, in a few words" },
        { name: "status", label: "Stamp", type: "select", options: statusOptions, value: prefill.status || "" }
      ]
    }).then(function (v) {
      if (!v) return null;
      var existing = S.byName(v.name);
      if (existing) { toast("That file already exists. Opened it."); return existing; }
      var e = S.addEntity({ name: v.name, type: v.type, blurb: v.blurb, status: v.status,
        x: prefill.x, y: prefill.y, onBoard: prefill.onBoard, stage: prefill.stage });
      toast("File " + e.no + " opened");
      return e;
    });
  }

  /* ---------- quick jot (a finding from anywhere) ---------- */
  function entityDatalist() {
    var dl = document.getElementById("rs-entities");
    if (!dl) { dl = h("datalist", { id: "rs-entities" }); document.body.appendChild(dl); }
    dl.innerHTML = "";
    S.entities().forEach(function (e) { dl.appendChild(h("option", { value: e.name })); });
    return dl;
  }
  function jot(prefillIds) {
    entityDatalist();
    var names = (prefillIds || []).map(function (id) { var e = S.entity(id); return e ? e.name : ""; }).filter(Boolean);
    return modal({
      title: "Jot a finding", kicker: "findings log", submit: "Log it",
      fields: [
        { name: "text", label: "What did you find?", type: "textarea", rows: 4, required: true,
          placeholder: "Write it plainly. Use [[Name]] to tag a file, e.g. [[PkeyFx]].", hint: "Ctrl/⌘ + Enter to save" },
        { name: "tags", label: "Tag files (comma separated)", value: names.join(", "), list: "rs-entities", placeholder: "PkeyFx, ORSUS suite" },
        { name: "status", label: "Stamp", type: "select", options: statusOptions, value: "" }
      ]
    }).then(function (v) {
      if (!v) return null;
      var ids = [], missing = [];
      v.tags.split(",").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (n) {
        var e = S.byName(n); if (e) ids.push(e.id); else missing.push(n);
      });
      var f = S.addFinding({ text: v.text, entityIds: ids, status: v.status });
      if (f) toast(missing.length ? "Logged. No file named: " + missing.join(", ") : "Finding logged");
      return f;
    });
  }

  /* ---------- header & footer ---------- */
  var PAGES = [["index.html", "files", "Files"], ["findings.html", "findings", "Findings"], ["ideas.html", "ideas", "Ideas"], ["map.html", "map", "Map"]];

  function renderHeader() {
    var page = document.body.getAttribute("data-page");
    if (page === "cases") page = "files";              // a case file lives under Files
    var top = document.getElementById("topbar"); if (!top) return;
    var logo = '<svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true"><path d="M5 7 L29 15" fill="none" stroke="var(--string)" stroke-width="2.4" stroke-linecap="round"/><circle cx="5" cy="7" r="4.2" fill="var(--ink)"/><circle cx="29" cy="15" r="4.2" fill="var(--string)"/></svg>';
    var nav = h("nav", { class: "nav", "aria-label": "Main" });
    PAGES.forEach(function (p) { nav.appendChild(h("a", { href: p[0], "aria-current": p[1] === page ? "page" : null }, p[2])); });

    var input = h("input", { type: "search", placeholder: "search the evidence…", "aria-label": "Search everything", autocomplete: "off", id: "rs-search" });
    var pop = h("div", { class: "search-pop", role: "listbox", hidden: true });
    var search = h("div", { class: "search-wrap" },
      h("label", { class: "search" },
        h("span", { class: "search-ic", html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>' }),
        input, h("span", { class: "kbd" }, "/")),
      pop);

    var wrap = h("div", { class: "wrap" },
      h("a", { class: "brand", href: "index.html", "aria-label": "redstring home" }, h("span", { html: logo }), h("span", { class: "brand-word", html: "red<b>string</b>" })),
      nav,
      h("span", { class: "spacer" }),
      search,
      h("button", { class: "btn red jot-btn", type: "button", title: "Jot a finding (N)", onclick: function () { jot(); } }, "+ jot"),
      h("button", { class: "btn ghost toggle-night", type: "button", "data-toggle-night": true, "aria-label": "Toggle night shift", title: "Night shift" },
        h("span", { class: "sun" }, "☀"), h("span", { class: "moon" }, "☾")));
    top.className = "topbar";
    top.innerHTML = "";
    top.appendChild(wrap);
    wireSearch(input, pop);
  }

  function renderFooter() {
    var f = document.getElementById("footer"); if (!f) return;
    var file = h("input", { type: "file", accept: "application/json,.json", hidden: true });
    file.addEventListener("change", function () {
      var fl = file.files[0]; if (!fl) return;
      var r = new FileReader();
      r.onload = function () {
        confirmBox("Restore this backup?", "Everything in this browser will be replaced by " + fl.name + ".", "Restore").then(function (yes) {
          if (!yes) return;
          try { S.importData(r.result); toast("Backup restored"); setTimeout(function () { location.reload(); }, 400); }
          catch (e) { toast("That file isn't a redstring backup.", "bad"); }
        });
        file.value = "";
      };
      r.readAsText(fl);
    });
    var st = S.stats();
    var info = h("span", { class: "foot-info" },
      st.persistent ? "saved in this browser" : "⚠ this browser is not saving. Back up now!",
      " · " + st.entities + " files · " + st.links + " connections · " + st.findings + " findings" + (st.lastBackup ? "" : " · not backed up yet"));
    f.className = "foot";
    f.innerHTML = "";
    f.appendChild(h("div", { class: "wrap foot-row" },
      h("span", null, "redstring · private · public sources only · no confidential data, ever."),
      h("span", { class: "foot-tools" },
        info,
        h("button", { class: "linkbtn", type: "button", onclick: backup }, "backup"),
        h("button", { class: "linkbtn", type: "button", onclick: function () { file.click(); } }, "restore"),
        h("button", { class: "linkbtn", type: "button", onclick: function () {
          confirmBox("Reset to the sample case?", "Your files, strings and findings in this browser will be wiped. Back up first if you need them.", "Wipe & reset").then(function (y) {
            if (y) { S.reset(); toast("Reset to sample case"); setTimeout(function () { location.reload(); }, 400); }
          });
        } }, "reset"),
        file)));
  }
  function backup() {
    var data = S.exportData();
    var blob = new Blob([data], { type: "application/json" });
    var a = h("a", { href: URL.createObjectURL(blob), download: "redstring-backup-" + new Date().toISOString().slice(0, 10) + ".json" });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("Backup downloaded");
    renderFooter();
  }

  /* ---------- global search ---------- */
  function highlight(text, q) {
    var t = String(text || "").replace(/\[\[|\]\]/g, "").replace(/[#*`>]/g, "").replace(/\s+/g, " ").trim();
    var words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var lower = t.toLowerCase(), at = -1;
    words.some(function (w) { at = lower.indexOf(w); return at >= 0; });
    var start = Math.max(0, at - 30);
    var snip = (start > 0 ? "…" : "") + t.slice(start, start + 110) + (t.length > start + 110 ? "…" : "");
    var html = esc(snip);
    words.forEach(function (w) {
      var re = new RegExp("(" + esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  }
  function wireSearch(input, pop) {
    var active = -1, results = [];
    function go(r) {
      if (!r) return;
      location.href = r.kind === "entity" ? caseUrl(r.item.id) : "findings.html#" + r.item.id;
      pop.hidden = true;
    }
    function render() {
      var q = input.value;
      results = S.search(q, 10);
      pop.innerHTML = "";
      active = results.length ? 0 : -1;
      if (!q.trim()) { pop.hidden = true; return; }
      if (!results.length) {
        pop.appendChild(h("div", { class: "sr-empty" }, "No trace of “" + q + "”. ",
          h("button", { class: "linkbtn", type: "button", onclick: function () {
            pop.hidden = true;
            newEntity({ name: q.trim() }).then(function (e) { if (e) location.href = caseUrl(e.id); });
          } }, "Open a file for it →")));
      }
      results.forEach(function (r, i) {
        var isE = r.kind === "entity";
        var row = h("a", { class: "sr" + (i === 0 ? " on" : ""), href: isE ? caseUrl(r.item.id) : "findings.html#" + r.item.id, role: "option" },
          isE ? pinDot(r.item.type) : h("span", { class: "sr-ic" }, "✎"),
          h("span", { class: "sr-main" },
            h("span", { class: "sr-title" }, isE ? r.item.name : "Finding"),
            h("span", { class: "sr-snip", html: highlight(isE ? (r.item.blurb + " " + r.item.notes) : r.item.text, q) })),
          h("span", { class: "sr-kind" }, isE ? r.item.type : "finding"));
        pop.appendChild(row);
      });
      pop.hidden = false;
    }
    function move(d) {
      var rows = pop.querySelectorAll(".sr"); if (!rows.length) return;
      active = (active + d + rows.length) % rows.length;
      rows.forEach(function (r, i) { r.classList.toggle("on", i === active); });
      rows[active].scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("input", render);
    input.addEventListener("focus", function () { if (input.value.trim()) render(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
      else if (e.key === "Escape") { input.value = ""; pop.hidden = true; input.blur(); }
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".search-wrap")) pop.hidden = true; });
  }

  /* ---------- night shift ---------- */
  var KEY = "redstring-theme";
  function applyTheme(t) { root.setAttribute("data-theme", t); }
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-toggle-night]")) return;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(KEY, next); } catch (err) { /* private mode */ }
  });

  /* ---------- global keys & missing wikilinks ---------- */
  function typing(e) {
    var t = e.target;
    if (document.querySelector("dialog[open]")) return true;
    return t && t.closest && t.closest("input, textarea, select, [contenteditable]");
  }
  document.addEventListener("keydown", function (e) {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/") { var s = document.getElementById("rs-search"); if (s) { e.preventDefault(); s.focus(); } }
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); jot(); }
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a.wikilink.missing"); if (!a) return;
    e.preventDefault();
    newEntity({ name: a.getAttribute("data-new") }).then(function (ent) { if (ent) location.href = caseUrl(ent.id); });
  });

  S.on(function (what) { if (what !== "quiet") renderFooter(); });

  window.RS.ui = {
    h: h, esc: esc, stamp: stamp, pinDot: pinDot, caseUrl: caseUrl, fmtDate: fmtDate, ago: ago,
    markdown: markdown, inline: inline, toast: toast, BIN: BIN, modal: modal, confirm: confirmBox,
    newEntity: newEntity, jot: jot, typeOptions: typeOptions, statusOptions: statusOptions, entityDatalist: entityDatalist
  };

  renderHeader();
  renderFooter();
})();
