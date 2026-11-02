/* redstring — findings log: write, tag, stamp, filter, edit */
(function () {
  "use strict";
  var S = window.RS.store, U = window.RS.ui, h = U.h;
  var composer = document.getElementById("composer");
  var listBox = document.getElementById("findings-list");
  var filterBox = document.getElementById("findings-filters");

  var filt = { q: "", entity: "", status: "" };
  var editing = null;
  var tags = [];                // entity ids picked in the composer

  /* ---------- composer ---------- */
  function renderComposer() {
    composer.innerHTML = "";
    U.entityDatalist();
    var ta = h("textarea", { class: "input composer-text", rows: 3, id: "composer-text",
      placeholder: "What did you find? Write it plainly. [[PkeyFx]] tags a file automatically." });
    var chipRow = h("div", { class: "tag-picker" });
    var tagIn = h("input", { class: "input tag-in", list: "rs-entities", placeholder: "+ tag a file", "aria-label": "Tag a file" });
    var status = h("select", { class: "input", "aria-label": "Stamp" }, U.statusOptions.map(function (o) { return h("option", { value: o[0] }, o[1]); }));
    var save = h("button", { class: "btn red", type: "button" }, "log it");

    function drawChips() {
      chipRow.querySelectorAll(".tag-chip").forEach(function (c) { c.remove(); });
      tags.forEach(function (id) {
        var e = S.entity(id); if (!e) return;
        chipRow.insertBefore(h("span", { class: "tag-chip t-" + e.type }, h("span", { class: "pin-dot" }), e.name,
          h("button", { type: "button", "aria-label": "Remove tag " + e.name, onclick: function () { tags = tags.filter(function (x) { return x !== id; }); drawChips(); } }, "×")), tagIn);
      });
    }
    function addTag() {
      var v = tagIn.value.trim(); if (!v) return;
      var e = S.byName(v);
      if (!e) {
        U.newEntity({ name: v }).then(function (n) { if (n) { tags.push(n.id); renderComposer(); restore(); } });
        return;
      }
      if (tags.indexOf(e.id) < 0) tags.push(e.id);
      tagIn.value = ""; drawChips();
    }
    tagIn.addEventListener("change", addTag);
    tagIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addTag(); } });

    var draftKey = "redstring-finding-draft";
    try { ta.value = localStorage.getItem(draftKey) || ""; } catch (e) { /* ignore */ }
    function restore() { var t = document.getElementById("composer-text"); if (t) t.value = ta.value; }
    ta.addEventListener("input", function () { try { localStorage.setItem(draftKey, ta.value); } catch (e) { /* ignore */ } });

    function submit() {
      if (!ta.value.trim()) { ta.focus(); return; }
      var f = S.addFinding({ text: ta.value, entityIds: tags, status: status.value });
      if (f) {
        tags = []; ta.value = "";
        try { localStorage.removeItem(draftKey); } catch (e) { /* ignore */ }
        U.toast("Finding logged");
        renderComposer();
        var t = document.getElementById("composer-text"); if (t) t.focus();
      }
    }
    save.addEventListener("click", submit);
    ta.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } });

    chipRow.appendChild(tagIn);
    composer.appendChild(h("div", { class: "composer" },
      ta,
      h("div", { class: "composer-row" }, chipRow, h("span", { class: "spacer" }), status, save),
      h("p", { class: "hint" }, "Ctrl/⌘ + Enter to log · drafts are kept if you leave the page")));
    drawChips();
  }

  /* ---------- filters ---------- */
  function renderFilters() {
    filterBox.innerHTML = "";
    var q = h("input", { type: "search", class: "input", placeholder: "filter findings…", value: filt.q, "aria-label": "Filter findings" });
    q.addEventListener("input", function () { filt.q = q.value; renderList(); });
    var ents = S.entities().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var en = h("select", { class: "input", "aria-label": "File" }, h("option", { value: "" }, "all files"),
      ents.map(function (e) { return h("option", { value: e.id, selected: filt.entity === e.id }, e.name); }),
      h("option", { value: "__none", selected: filt.entity === "__none" }, "untagged"));
    en.addEventListener("change", function () { filt.entity = en.value; renderList(); });
    var st = h("select", { class: "input", "aria-label": "Stamp" },
      [["", "any stamp"], ["__none", "no stamp"], ["verified", "verified"], ["inferred", "inferred"], ["lead", "active lead"]].map(function (o) {
        return h("option", { value: o[0], selected: filt.status === o[0] }, o[1]);
      }));
    st.addEventListener("change", function () { filt.status = st.value; renderList(); });
    filterBox.appendChild(h("div", { class: "toolbar" }, q, en, st, h("span", { class: "spacer" }), h("span", { class: "label", id: "f-count" })));
  }

  /* ---------- list ---------- */
  function renderList() {
    var all = S.findings(), list = all;
    var q = filt.q.trim().toLowerCase();
    if (q) list = list.filter(function (f) { return f.text.toLowerCase().indexOf(q) >= 0; });
    if (filt.entity === "__none") list = list.filter(function (f) { return !f.entityIds.length; });
    else if (filt.entity) list = list.filter(function (f) { return f.entityIds.indexOf(filt.entity) >= 0; });
    if (filt.status === "__none") list = list.filter(function (f) { return !f.status; });
    else if (filt.status) list = list.filter(function (f) { return f.status === filt.status; });
    var c = document.getElementById("f-count"); if (c) c.textContent = list.length + " of " + all.length;

    listBox.innerHTML = "";
    if (!list.length) {
      listBox.appendChild(h("div", { class: "empty" }, h("strong", null, all.length ? "No findings match." : "The logbook is empty."),
        all.length ? "Loosen the filters." : "Every case starts with one small note. Write it above."));
      return;
    }
    var ul = h("ul", { class: "flist" });
    list.forEach(function (f) { ul.appendChild(editing === f.id ? editRow(f) : viewRow(f)); });
    listBox.appendChild(ul);
    var target = location.hash.slice(1);
    if (target) {
      var el = document.getElementById(target);
      if (el) { el.classList.add("flash"); el.scrollIntoView({ block: "center" }); history.replaceState(null, "", location.pathname); }
    }
  }
  function viewRow(f) {
    return h("li", { id: f.id },
      f.status ? h("div", { class: "f-meta" }, U.stamp(f.status, "xs")) : null,
      h("div", { class: "f-body md", html: U.markdown(f.text) }),
      h("div", { class: "tags" },
        f.entityIds.map(function (id) { var e = S.entity(id); return e ? h("a", { class: "tag t-" + e.type, href: U.caseUrl(e.id) }, h("span", { class: "pin-dot" }), e.name) : null; }),
        h("span", { class: "f-tools" },
          h("button", { class: "linkbtn", type: "button", onclick: function () { editing = f.id; renderList(); var t = document.getElementById("edit-" + f.id); if (t) t.focus(); } }, "edit"),
          h("button", { class: "linkbtn danger", type: "button", onclick: function () {
            U.confirm("Tear out this finding?", f.text.slice(0, 140), "Tear it out").then(function (y) { if (y) { S.deleteFinding(f.id); U.toast("Finding removed"); } });
          } }, "delete"))));
  }
  function editRow(f) {
    var ta = h("textarea", { class: "input", rows: 3, id: "edit-" + f.id }); ta.value = f.text;
    var st = h("select", { class: "input", "aria-label": "Stamp" }, U.statusOptions.map(function (o) { return h("option", { value: o[0], selected: f.status === o[0] }, o[1]); }));
    var tagsIn = h("input", { class: "input", list: "rs-entities", "aria-label": "Tags",
      value: f.entityIds.map(function (id) { var e = S.entity(id); return e ? e.name : ""; }).filter(Boolean).join(", ") });
    function save() {
      var ids = tagsIn.value.split(",").map(function (s) { return S.byName(s.trim()); }).filter(Boolean).map(function (e) { return e.id; });
      editing = null;
      S.updateFinding(f.id, { text: ta.value, status: st.value, entityIds: ids });
      U.toast("Finding updated");
    }
    ta.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") { editing = null; renderList(); }
    });
    return h("li", { id: f.id, class: "editing" },
      ta,
      h("div", { class: "composer-row" }, h("label", { class: "inline-label" }, h("span", { class: "label" }, "tags"), tagsIn), st,
        h("button", { class: "btn ghost sm", type: "button", onclick: function () { editing = null; renderList(); } }, "cancel"),
        h("button", { class: "btn sm", type: "button", onclick: save }, "save")));
  }

  S.on(function (what) {
    if (what === "quiet") return;
    var a = document.activeElement;
    if (a && composer.contains(a)) { renderList(); return; }      // keep typing in the composer
    renderFilters(); renderList();
  });
  renderComposer();
  renderFilters();
  renderList();
})();
