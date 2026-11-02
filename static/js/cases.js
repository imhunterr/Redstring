/* redstring — one case file: read, write and wire it up */
(function () {
  "use strict";
  var S = window.RS.store, U = window.RS.ui, h = U.h;
  var fileView = document.getElementById("file-view");
  var state = { notesMode: "read", factsEdit: false };

  function currentId() { return decodeURIComponent(location.hash.replace(/^#/, "")); }

  /* =================== open file =================== */
  function renderFile(e) {
    fileView.innerHTML = "";
    var sheet = h("div", { class: "sheet" });
    var file = h("article", { class: "casefile", "data-tab": e.type.toUpperCase() + " · " + e.no }, sheet);

    // --- head ---
    var stampBtn = h("button", { class: "stamp-btn", type: "button", title: "Click to change the stamp" },
      e.status ? h("span", { class: "stamp big " + e.status }, S.STATUS_LABEL[e.status]) : h("span", { class: "stamp big none" }, "stamp it"));
    stampBtn.addEventListener("click", function () {
      var order = ["", "verified", "inferred", "lead"];
      S.updateEntity(e.id, { status: order[(order.indexOf(e.status) + 1) % order.length] });
    });
    var actions = h("div", { class: "file-actions" },
      h("button", { class: "btn ghost sm", type: "button", onclick: editDetails }, "edit details"),
      h("a", { class: "btn ghost sm", href: "map.html#" + encodeURIComponent(e.id) }, "◎ view on map"),
      h("button", { class: "btn ghost sm", type: "button", onclick: function () { U.jot([e.id]); } }, "+ finding"),
      h("button", { class: "btn ghost sm danger", type: "button", onclick: function () {
        U.confirm("Shred " + e.name + "?", "The file, its strings and its tags on findings will be removed. Findings themselves stay.", "Shred it").then(function (y) {
          if (y) { S.deleteEntity(e.id); U.toast("File shredded"); location.hash = ""; }
        });
      } }, "shred"));

    sheet.appendChild(h("div", { class: "case-head" },
      h("div", { class: "case-title" },
        h("span", { class: "case-no" }, "FILE " + e.no),
        h("h1", null, e.name),
        h("span", { class: "label" }, e.blurb || "no summary yet"),
        actions),
      stampBtn));

    if (e.type === "idea") {
      var stage = h("div", { class: "stage-track" });
      S.STAGES.forEach(function (st) {
        stage.appendChild(h("button", { type: "button", class: "stage-step" + (e.stage === st ? " on" : ""), onclick: function () { S.updateEntity(e.id, { stage: st }); } }, st));
      });
      sheet.appendChild(h("div", { class: "stage-row" }, h("span", { class: "label" }, "stage"), stage));
    }

    var left = h("div", { class: "case-main" }), right = h("aside", { class: "case-side" });
    sheet.appendChild(h("div", { class: "case-grid" }, left, right));

    left.appendChild(notesBlock(e));
    right.appendChild(factsBlock(e));
    right.appendChild(connectionsBlock(e));
    right.appendChild(findingsBlock(e));

    sheet.appendChild(commentsBlock(e));

    fileView.appendChild(h("a", { class: "back", href: "index.html" }, "← all files"));
    fileView.appendChild(file);

    function editDetails() {
      U.modal({
        title: "Edit " + e.name, kicker: "file " + e.no, submit: "Save",
        fields: [
          { name: "name", label: "Name", value: e.name, required: true },
          { name: "type", label: "Type", type: "select", options: U.typeOptions, value: e.type },
          { name: "blurb", label: "One-line summary", value: e.blurb },
          { name: "status", label: "Stamp", type: "select", options: U.statusOptions, value: e.status }
        ]
      }).then(function (v) {
        if (!v) return;
        var clash = S.byName(v.name);
        if (clash && clash.id !== e.id) { U.toast("Another file already has that name.", "bad"); return; }
        S.updateEntity(e.id, v); U.toast("Saved");
      });
    }
  }

  /* --- facts --- */
  function factsBlock(e) {
    var box = h("section", { class: "block" });
    var head = h("div", { class: "block-head" }, h("h3", null, "Facts"),
      h("span", { class: "block-tools" },
        h("button", { class: "linkbtn", type: "button", onclick: function () { state.factsEdit = !state.factsEdit; render(); } }, state.factsEdit ? "done" : "edit")));
    box.appendChild(head);

    if (!state.factsEdit) {
      if (!e.facts.length) { box.appendChild(h("p", { class: "muted" }, "No facts yet. Click edit to add one, e.g. Launched · Aug 2024.")); return box; }
      var dl = h("dl", { class: "facts" });
      dl.appendChild(h("dt", null, "Type")); dl.appendChild(h("dd", null, e.type));
      e.facts.forEach(function (f) {
        dl.appendChild(h("dt", null, h("span", null, f.k || "—"), U.stamp(f.s)));
        dl.appendChild(h("dd", null, f.v));
      });
      box.appendChild(dl);
      return box;
    }

    var rows = h("div", { class: "facts-edit" });
    var draft = e.facts.map(function (f) { return { k: f.k, v: f.v, s: f.s }; });
    function row(f, i) {
      var k = h("input", { class: "input", value: f.k, placeholder: "label", "aria-label": "Fact label" });
      var v = h("input", { class: "input", value: f.v, placeholder: "value", "aria-label": "Fact value" });
      var s = h("select", { class: "input", "aria-label": "Fact stamp" }, U.statusOptions.map(function (o) { return h("option", { value: o[0], selected: f.s === o[0] }, o[1]); }));
      function sync() { draft[i] = { k: k.value, v: v.value, s: s.value }; }
      [k, v].forEach(function (x) { x.addEventListener("input", sync); x.addEventListener("change", save); });
      s.addEventListener("change", function () { sync(); save(); });
      return h("div", { class: "fact-row" }, k, v, s,
        h("button", { class: "icon-btn", type: "button", title: "Remove fact", "aria-label": "Remove fact", onclick: function () { draft.splice(i, 1); save(); render(); } }, "×"));
    }
    function save() { S.updateEntity(e.id, { facts: draft.filter(function (f) { return f.k.trim() || f.v.trim(); }) }, true); }
    draft.forEach(function (f, i) { rows.appendChild(row(f, i)); });
    box.appendChild(rows);
    box.appendChild(h("button", { class: "btn ghost sm", type: "button", onclick: function () {
      draft.push({ k: "", v: "", s: "" }); S.updateEntity(e.id, { facts: draft }, true); render();
      var inputs = fileView.querySelectorAll(".fact-row input"); if (inputs.length) inputs[inputs.length - 2].focus();
    } }, "+ add fact"));
    return box;
  }

  /* --- notes: the main writing space --- */
  function notesBlock(e) {
    var box = h("section", { class: "block notes-block" });
    var saved = h("span", { class: "saved-ind" });
    var writing = state.notesMode === "write";
    var toggle = h("button", { class: "btn sm " + (writing ? "" : "ghost"), type: "button", onclick: function () {
      state.notesMode = writing ? "read" : "write"; render(); if (!writing) focusNotes();
    } }, writing ? "✓ done" : "✎ write");
    box.appendChild(h("div", { class: "block-head" }, h("h3", null, "Notes"), h("span", { class: "block-tools" }, saved, toggle)));

    if (!writing) {
      if (!e.notes.trim()) {
        box.appendChild(h("button", { class: "empty clickable notes-empty", type: "button", onclick: function () { state.notesMode = "write"; render(); focusNotes(); } },
          h("strong", null, "Blank page."), "Click to start writing."));
      } else {
        box.appendChild(h("div", { class: "md notes-read", html: U.markdown(e.notes), ondblclick: function () { state.notesMode = "write"; render(); focusNotes(); } }));
      }
      return box;
    }
    var ta = h("textarea", { class: "notes-input", id: "notes-input", spellcheck: "true",
      placeholder: "Start writing…\n\n# Heading   - list   **bold**   [[PkeyFx]] links a file" });
    ta.value = e.notes;
    function grow() { ta.style.height = "auto"; ta.style.height = Math.max(ta.scrollHeight + 2, window.innerHeight * 0.6) + "px"; }
    var t = 0;
    function saveNow() { clearTimeout(t); S.updateEntity(e.id, { notes: ta.value }, true); saved.textContent = "saved ✓"; }
    ta.addEventListener("input", function () {
      grow(); saved.textContent = "saving…";
      clearTimeout(t); t = setTimeout(saveNow, 400);
    });
    ta.addEventListener("keydown", function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); saveNow(); }
      if (ev.key === "Escape") { saveNow(); state.notesMode = "read"; render(); }
      if (ev.key === "Tab" && !ev.shiftKey) { ev.preventDefault(); var p = ta.selectionStart; ta.setRangeText("  ", p, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
    });
    ta.addEventListener("blur", function () { if (ta.value !== (S.entity(e.id) || {}).notes) saveNow(); });
    box.appendChild(ta);
    box.appendChild(h("p", { class: "hint" }, "Saves as you type · Esc or ✓ done to read · [[Name]] links another file"));
    setTimeout(grow, 0);
    return box;
  }
  function focusNotes() { var ta = document.getElementById("notes-input"); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }

  /* --- connections: one grouped list, plus untied names from the notes --- */
  function connectionsBlock(e) {
    var box = h("section", { class: "block" });
    box.appendChild(h("div", { class: "block-head" }, h("h3", null, "Connections"),
      h("button", { class: "linkbtn", type: "button", onclick: function () { connect(e); } }, "+ connect")));

    // group by how the relation reads from this file
    var groups = {}, order = [];
    S.linksOf(e.id).forEach(function (l) {
      var out = l.from === e.id, other = S.entity(out ? l.to : l.from); if (!other) return;
      var label = out ? l.rel : S.RELS[l.rel];
      if (!groups[label]) { groups[label] = []; order.push(label); }
      groups[label].push({ link: l, other: other });
    });
    if (!order.length) {
      box.appendChild(h("p", { class: "muted" }, "Not connected to anything yet."));
    } else {
      var wrap = h("div", { class: "threads" });
      order.forEach(function (label) {
        var items = groups[label];
        wrap.appendChild(h("div", { class: "thread" },
          h("div", { class: "thread-label" }, label, h("span", { class: "thread-count" }, items.length)),
          h("ul", { class: "thread-items" }, items.map(function (g) {
            return h("li", { class: "t-" + g.other.type },
              h("span", { class: "pin-dot" }),
              h("a", { href: "#" + encodeURIComponent(g.other.id) }, g.other.name),
              h("button", { class: "icon-btn", type: "button", title: "Disconnect", "aria-label": "Disconnect " + g.other.name, onclick: function () { S.deleteLink(g.link.id); U.toast("Disconnected"); } }, "×"));
          }))));
      });
      box.appendChild(wrap);
    }

    // names in either file's notes that aren't connected yet
    var seen = {}, loose = [];
    S.mentions(e.notes).map(S.byName).concat(S.mentionedIn(e.id)).forEach(function (o) {
      if (!o || o.id === e.id || seen[o.id] || S.linked(e.id, o.id)) return;
      seen[o.id] = true; loose.push(o);
    });
    if (loose.length) {
      box.appendChild(h("div", { class: "suggest" },
        h("span", { class: "label" }, "in your notes, not connected:"),
        loose.map(function (o) {
          return h("button", { class: "suggest-chip t-" + o.type, type: "button", title: "Connect as 'related to'", onclick: function () {
            S.addLink(e.id, o.id, "related to"); U.toast("Connected to " + o.name);
          } }, "+ " + o.name);
        })));
    }
    return box;
  }

  function connect(e) {
    var rels = [];
    Object.keys(S.RELS).forEach(function (r) {
      rels.push(["out|" + r, r]);
      if (S.RELS[r] !== r) rels.push(["in|" + r, "is " + S.RELS[r]]);
    });
    var others = S.entities().filter(function (o) { return o.id !== e.id; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    U.modal({
      title: "Connect " + e.name, kicker: "new connection", submit: "Connect",
      fields: [
        { name: "rel", label: e.name + " …", type: "select", options: rels, value: "out|related to" },
        { name: "to", label: "… which file?", type: "select", value: "",
          options: [["", "pick a file"]].concat(others.map(function (o) { return [o.id, o.name + "  ·  " + o.type]; }), [["__new", "+ new file…"]]) }
      ]
    }).then(function (v) {
      if (!v || !v.to) return;
      var parts = v.rel.split("|");
      function done(id) {
        if (parts[0] === "out") S.addLink(e.id, id, parts[1]); else S.addLink(id, e.id, parts[1]);
        U.toast("Connected");
      }
      if (v.to === "__new") U.newEntity().then(function (n) { if (n) done(n.id); });
      else done(v.to);
    });
  }

  /* --- comments: a running thread under the card, each with a bin --- */
  function commentsBlock(e) {
    var box = h("section", { class: "comments", id: "comments" });
    box.appendChild(h("div", { class: "block-head" },
      h("h3", null, "Comments ", h("span", { class: "thread-count" }, e.comments.length)),
      h("span")));
    var ul = h("ul", { class: "comment-list" });
    if (!e.comments.length) ul.appendChild(h("li", { class: "muted comment-empty" }, "No comments yet. Add the first one below."));
    e.comments.forEach(function (c) {
      ul.appendChild(h("li", { class: "comment", id: c.id },
        h("div", { class: "comment-text md", html: U.inline(c.text).replace(/\n/g, "<br>") }),
        h("button", { class: "bin", type: "button", title: "Delete comment", "aria-label": "Delete comment", html: U.BIN, onclick: function () {
          var removed = S.deleteComment(e.id, c.id);
          U.toast("Comment deleted", { action: "undo", ms: 5000, onAction: function () { S.restoreComment(e.id, removed); U.toast("Comment restored"); } });
        } })));
    });
    box.appendChild(ul);

    var ta = h("textarea", { class: "input comment-input", rows: 2, id: "comment-input", placeholder: "Write a comment…  Enter to post · Shift+Enter for a new line", "aria-label": "Write a comment" });
    function post() {
      if (!ta.value.trim()) { ta.focus(); return; }
      S.addComment(e.id, ta.value);
      var t = document.getElementById("comment-input"); if (t) t.focus();
    }
    ta.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); post(); }
    });
    box.appendChild(h("div", { class: "comment-compose" }, ta, h("button", { class: "btn red sm", type: "button", onclick: post }, "post")));
    return box;
  }

  /* --- findings on this file --- */
  function findingsBlock(e) {
    var box = h("section", { class: "block" });
    var fs = S.findingsOf(e.id);
    box.appendChild(h("div", { class: "block-head" }, h("h3", null, "Findings"), h("a", { class: "label", href: "findings.html" }, fs.length ? "see all " + fs.length + " →" : "")));
    var input = h("input", { class: "input quick", type: "text", placeholder: "Add a finding, press Enter", "aria-label": "Add a finding about " + e.name });
    input.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" || !input.value.trim()) return;
      ev.preventDefault();
      S.addFinding({ text: input.value, entityIds: [e.id] });
      U.toast("Finding logged");
    });
    box.appendChild(input);
    if (fs.length) {
      var ul = h("ul", { class: "mini-log" });
      fs.slice(0, 5).forEach(function (f) {
        ul.appendChild(h("li", null, f.status ? h("div", { class: "f-meta" }, U.stamp(f.status, "xs")) : null, h("span", { html: U.inline(f.text) })));
      });
      box.appendChild(ul);
    }
    return box;
  }

  /* =================== routing =================== */
  function render() {
    var id = currentId();
    if (!id) { location.replace("index.html"); return; }
    var e = S.entity(id);
    fileView.hidden = false;
    if (!e) {
      fileView.innerHTML = "";
      fileView.appendChild(h("a", { class: "back", href: "index.html" }, "← all files"));
      fileView.appendChild(h("div", { class: "empty" }, h("strong", null, "File not found."), "It may have been shredded."));
      return;
    }
    var active = document.activeElement && document.activeElement.id === "notes-input";
    var commenting = document.activeElement && document.activeElement.id === "comment-input";
    document.title = e.name + " · redstring";
    if (active) return;
    var y = window.scrollY;
    renderFile(e);
    if (commenting) { window.scrollTo(0, y); var ci = document.getElementById("comment-input"); if (ci) ci.focus({ preventScroll: true }); }
  }
  window.addEventListener("hashchange", function () { state.notesMode = "read"; state.factsEdit = false; render(); window.scrollTo(0, 0); });
  S.on(function (what) { if (what !== "quiet") render(); });
  render();
})();
