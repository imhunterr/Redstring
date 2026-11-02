/* redstring — ideas: one row per idea, progress shown as a red string you pull knot by knot */
(function () {
  "use strict";
  var S = window.RS.store, U = window.RS.ui, h = U.h;
  var box = document.getElementById("ideas-board");
  var summary = document.getElementById("ideas-summary");
  var TRACK = ["proposed", "prototyping", "pitched", "accepted"];

  function ties(e) {
    return S.linksOf(e.id).map(function (l) { return S.entity(l.from === e.id ? l.to : l.from); })
      .filter(function (o, i, arr) { return o && arr.indexOf(o) === i; });
  }

  function track(e) {
    var at = TRACK.indexOf(e.stage);
    var ol = h("ol", { class: "track", style: "--at:" + Math.max(at, 0), "aria-label": "Stage" });
    TRACK.forEach(function (st, i) {
      ol.appendChild(h("li", { class: i < at ? "done" : i === at ? "now" : "" },
        h("button", { type: "button", "aria-pressed": String(i === at), title: "Move to " + st,
          onclick: function () { if (e.stage !== st) { S.updateEntity(e.id, { stage: st }); U.toast(e.name + " → " + st); } } },
          h("span", { class: "knot" }), h("span", { class: "knot-label" }, st))));
    });
    return ol;
  }

  function row(e) {
    var dropped = e.stage === "dropped";
    var next = h("input", { class: "next-input", type: "text", value: e.next || "", placeholder: "what's the next move?", "aria-label": "Next move for " + e.name });
    function saveNext() { if (next.value !== (e.next || "")) { S.updateEntity(e.id, { next: next.value }, true); U.toast("Next move saved"); } }
    next.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); next.blur(); } });
    next.addEventListener("blur", saveNext);

    var t = ties(e);
    return h("article", { class: "idea-row" + (dropped ? " is-dropped" : ""), "data-id": e.id },
      h("div", { class: "idea-main" },
        h("div", { class: "idea-top" },
          h("a", { class: "idea-name", href: U.caseUrl(e.id) }, e.name),
          U.stamp(e.status, "xs")),
        e.blurb ? h("p", { class: "idea-gap" }, e.blurb) : null,
        h("div", { class: "idea-ties" },
          h("span", { class: "label" }, "ties"),
          t.length ? t.map(function (o) { return h("a", { class: "tie t-" + o.type, href: U.caseUrl(o.id) }, h("span", { class: "pin-dot" }), o.name); })
            : h("span", { class: "muted" }, "nothing yet. Connect it from its case file.")),
        h("label", { class: "idea-next" }, h("span", { class: "label" }, "next move"), next)),
      h("div", { class: "idea-side" },
        dropped ? h("p", { class: "muted" }, "dropped") : track(e),
        h("button", { class: "linkbtn" + (dropped ? "" : " danger"), type: "button", onclick: function () {
          S.updateEntity(e.id, { stage: dropped ? "proposed" : "dropped" });
          U.toast(dropped ? e.name + " revived" : e.name + " dropped");
        } }, dropped ? "revive" : "drop")));
  }

  function render() {
    var ideas = S.entities().filter(function (e) { return e.type === "idea"; });
    var live = ideas.filter(function (e) { return e.stage !== "dropped"; })
      .sort(function (a, b) { return TRACK.indexOf(b.stage) - TRACK.indexOf(a.stage) || (a.updatedAt < b.updatedAt ? 1 : -1); });
    var dropped = ideas.filter(function (e) { return e.stage === "dropped"; });

    var pitched = live.filter(function (e) { return e.stage === "pitched" || e.stage === "accepted"; }).length;
    summary.textContent = live.length + " live idea" + (live.length === 1 ? "" : "s") + " · " + pitched + " pitched or accepted";

    box.innerHTML = "";
    if (!live.length) box.appendChild(h("div", { class: "empty" }, h("strong", null, "The bench is clear."), "Spot a gap in the suite and add it as an idea."));
    live.forEach(function (e) { box.appendChild(row(e)); });
    if (dropped.length) {
      var d = h("details", { class: "dropped-box" }, h("summary", null, "Dropped (" + dropped.length + ")"));
      dropped.forEach(function (e) { d.appendChild(row(e)); });
      box.appendChild(d);
    }
  }

  function addIdea() {
    U.modal({
      title: "New idea", kicker: "workbench", submit: "Add idea",
      fields: [
        { name: "name", label: "Idea", required: true, placeholder: "e.g. 47-Day Ready: ACME automation for PkeyFx" },
        { name: "blurb", label: "What gap does it close?", placeholder: "who needs it, and why now" },
        { name: "next", label: "First next move", placeholder: "e.g. read PkeyFx datasheet on ACME" }
      ]
    }).then(function (v) {
      if (!v) return;
      if (S.byName(v.name)) { U.toast("An idea with that name already exists.", "bad"); return; }
      S.addEntity({ type: "idea", name: v.name, blurb: v.blurb, next: v.next, stage: "proposed", onBoard: true });
      U.toast("Idea added");
    });
  }
  document.getElementById("add-idea-btn").addEventListener("click", addIdea);

  S.on(function (what) {
    if (what === "quiet") return;
    if (document.activeElement && document.activeElement.classList.contains("next-input")) return;
    render();
  });
  render();
})();
