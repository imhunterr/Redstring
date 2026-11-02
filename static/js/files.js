/* redstring — Files: the home page. Every file, grouped by type, easy to scan at any size. */
(function () {
  "use strict";
  var S = window.RS.store, U = window.RS.ui, h = U.h;
  var box = document.getElementById("files");
  var bar = document.getElementById("files-bar");

  var ORDER = ["product", "competitor", "concept", "trend", "idea", "person", "source"];
  var PLURAL = { product: "Products", competitor: "Competitors", concept: "Concepts", trend: "Trends", idea: "Ideas", person: "People", source: "Sources" };
  var state = { q: "", type: "", sort: "az" };
  try { state.sort = localStorage.getItem("redstring-files-sort") || "az"; state.type = localStorage.getItem("redstring-files-type") || ""; } catch (e) { /* ignore */ }

  function matches(e, q) {
    if (!q) return true;
    var facts = e.facts.map(function (f) { return f.k + " " + f.v; }).join(" ");
    return (e.name + " " + e.blurb + " " + e.no + " " + facts + " " + e.notes).toLowerCase().indexOf(q) >= 0;
  }

  function renderBar() {
    bar.innerHTML = "";
    var counts = {};
    S.entities().forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
    var q = h("input", { type: "search", class: "input files-search", placeholder: "filter files…", value: state.q, "aria-label": "Filter files" });
    q.addEventListener("input", function () { state.q = q.value; renderList(); });
    var chips = h("div", { class: "chips", role: "group", "aria-label": "Show type" },
      h("button", { class: "chip", type: "button", "aria-pressed": String(!state.type), onclick: function () { setType(""); } }, "all ", h("span", { class: "count" }, S.entities().length)),
      ORDER.filter(function (t) { return counts[t]; }).map(function (t) {
        return h("button", { class: "chip t-" + t, type: "button", "aria-pressed": String(state.type === t), onclick: function () { setType(state.type === t ? "" : t); } },
          h("span", { class: "pin-dot" }), PLURAL[t].toLowerCase() + " ", h("span", { class: "count" }, counts[t]));
      }));
    var sort = h("select", { class: "input", "aria-label": "Sort" },
      [["az", "A–Z"], ["recent", "recently edited"], ["linked", "most connected"]].map(function (o) { return h("option", { value: o[0], selected: state.sort === o[0] }, o[1]); }));
    sort.addEventListener("change", function () { state.sort = sort.value; try { localStorage.setItem("redstring-files-sort", sort.value); } catch (e) { /* ignore */ } renderList(); });
    bar.appendChild(h("div", { class: "toolbar" }, q, sort, h("span", { class: "spacer" }),
      h("button", { class: "btn red", type: "button", onclick: function () { U.newEntity().then(function (e) { if (e) location.href = U.caseUrl(e.id); }); } }, "+ new file")));
    bar.appendChild(chips);
  }
  function setType(t) {
    state.type = t;
    try { localStorage.setItem("redstring-files-type", t); } catch (e) { /* ignore */ }
    renderBar(); renderList();
  }

  function card(e) {
    var links = S.linksOf(e.id).length, finds = S.findingsOf(e.id).length;
    var meta = [];
    if (links) meta.push(links + (links === 1 ? " connection" : " connections"));
    if (finds) meta.push(finds + (finds === 1 ? " finding" : " findings"));
    return h("a", { class: "file-card t-" + e.type, href: U.caseUrl(e.id) },
      h("div", { class: "fc-top" }, h("span", { class: "fc-name" }, e.name), U.stamp(e.status, "xs")),
      e.blurb ? h("p", { class: "fc-blurb" }, e.blurb) : h("p", { class: "fc-blurb muted" }, "no summary yet"),
      h("div", { class: "fc-meta" }, meta.length ? meta.join(" · ") : "not connected yet",
        e.type === "idea" && e.stage ? h("span", { class: "fc-stage" }, e.stage) : null));
  }

  function renderList() {
    var q = state.q.trim().toLowerCase();
    var list = S.entities().filter(function (e) { return matches(e, q) && (!state.type || e.type === state.type); });
    list.sort(function (a, b) {
      if (state.sort === "recent") return a.updatedAt < b.updatedAt ? 1 : -1;
      if (state.sort === "linked") return S.linksOf(b.id).length - S.linksOf(a.id).length || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    box.innerHTML = "";
    if (!list.length) {
      box.appendChild(h("div", { class: "empty" },
        h("strong", null, S.entities().length ? "Nothing matches." : "No files yet."),
        S.entities().length ? "Try another filter." : "Open the first one with + new file."));
      return;
    }
    ORDER.forEach(function (t) {
      var group = list.filter(function (e) { return e.type === t; });
      if (!group.length) return;
      box.appendChild(h("section", { class: "file-group t-" + t },
        h("h2", { class: "group-head" }, h("span", { class: "pin-dot" }), PLURAL[t], h("span", { class: "count" }, group.length)),
        h("div", { class: "file-grid" }, group.map(card))));
    });
  }

  S.on(function (what) {
    if (what === "quiet") return;
    var a = document.activeElement;
    if (a && a.classList && a.classList.contains("files-search")) { renderList(); return; }
    renderBar(); renderList();
  });
  renderBar();
  renderList();
})();
