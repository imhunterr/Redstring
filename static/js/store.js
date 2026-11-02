/* redstring — data store
   Local-first: everything lives in this browser (localStorage) and can be
   exported/imported as JSON. Swap this file for API calls when the backend lands. */
(function () {
  "use strict";

  var KEY = "redstring:v1";
  var VERSION = 1;

  var TYPES = ["product", "concept", "competitor", "trend", "idea", "person", "source"];
  var PREFIX = { product: "PRD", concept: "CON", competitor: "CMP", trend: "TRD", idea: "IDA", person: "PER", source: "SRC" };
  var STATUSES = ["verified", "inferred", "lead", ""];
  var STATUS_LABEL = { verified: "verified", inferred: "inferred", lead: "active lead", "": "unstamped" };
  var STAGES = ["proposed", "prototyping", "pitched", "accepted", "dropped"];
  // relation -> how it reads from the other end
  var RELS = {
    "competes with": "competes with",
    "extends": "extended by",
    "drives": "driven by",
    "part of": "has part",
    "explains": "explained by",
    "sourced from": "source for",
    "related to": "related to"
  };

  var db = null;
  var persistent = true;
  var listeners = [];

  function now() { return new Date().toISOString(); }
  function uid(p) { return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function str(v, max) { v = v == null ? "" : String(v); return max ? v.slice(0, max) : v; }
  function num(v, d, lo, hi) { v = Number(v); if (!isFinite(v)) v = d; return Math.min(hi, Math.max(lo, v)); }

  /* ---------- sample case (public facts only) ---------- */
  function seed() {
    var t = "2026-11-02T12:00:00.000Z";
    function E(id, type, no, name, blurb, status, x, y, tilt, extra) {
      var e = { id: id, type: type, no: no, name: name, blurb: blurb, status: status,
        x: x, y: y, tilt: tilt, onBoard: true, notes: "", facts: [], comments: [], stage: type === "idea" ? "proposed" : "",
        createdAt: t, updatedAt: t };
      for (var k in extra) e[k] = extra[k];
      return e;
    }
    return {
      version: VERSION,
      counters: { PRD: 4, CON: 1, CMP: 1, TRD: 2, IDA: 2, PER: 0, SRC: 1 },
      lastBackup: null,
      entities: [
        E("orsus", "product", "ORS-01", "ORSUS suite", "identity governance, SSO, vendor identity", "verified", 5, 9, -2, {
          notes: "ISSQUARED's identity suite.\n\n## Modules\n- [[OLM / IAG]]: identity governance\n- OAM: SSO + MFA\n- [[EIAG]]: third-party identity\n- ODS: LDAP virtual directory\n- ISM / EBIS: business admin data\n\n> Public docs are thin. Most module detail is from datasheets." }),
        E("olm", "product", "ORS-02", "OLM / IAG", "joiner-mover-leaver, access reviews, SoD", "verified", 3, 56, 1.5, {
          notes: "Identity governance inside [[ORSUS suite]].\n\n- Lifecycle: [[Joiner-Mover-Leaver]]\n- Access reviews / certifications\n- Separation of duties (SoD) checks" }),
        E("eiag", "product", "ORS-03", "EIAG", "third-party / vendor identity", "inferred", 27, 30, 2, {
          notes: "Governs identities of people who are *not* employees: vendors, contractors, partners.\n\nLooks like the most differentiated part of [[ORSUS suite]]." }),
        E("jml", "concept", "CON-01", "Joiner-Mover-Leaver", "access follows the person's job", "", 25, 72, -1.5, {
          notes: "**Joiner** gets access on day one, **mover** gets it changed when the role changes, **leaver** loses it on exit.\n\nThe core loop of any IGA product, including [[OLM / IAG]]." }),
        E("saviynt", "competitor", "CMP-01", "Saviynt", "cloud IGA, PAM, time-bound access", "inferred", 46, 62, 2.5, {
          notes: "Cloud identity platform. Strong on privileged access and *time-bound* (just-in-time) access.\n\nCompare against [[OLM / IAG]]." }),
        E("lifecycle", "idea", "IDA-01", "One governed lifecycle", "ORSUS owners + PkeyFx credentials", "lead", 45, 8, -1, {
          next: "Map which ORSUS owner fields could sit on a PkeyFx certificate",
          notes: "Join [[ORSUS suite]] (who owns what) with [[PkeyFx]] (the credentials) so people, services, certificates and AI agents share one governed lifecycle." }),
        E("pkeyfx", "product", "PKF-01", "PkeyFx", "private CA + cert lifecycle on HSM", "verified", 66, 36, 1, {
          notes: "Issues and renews certificates for private PKI. [[47-day TLS certs]] and [[Post-quantum]] migration both push customers toward automation, and this product sits right in that path.",
          facts: [
            { k: "Launched", v: "Aug 2024", s: "verified" },
            { k: "Runs on", v: "HSM appliances", s: "verified" },
            { k: "Built with", v: "Java / Spring, from job posts", s: "inferred" },
            { k: "Talks to ORSUS?", v: "no public integration found", s: "lead" }
          ] }),
        E("tls47", "trend", "TRD-01", "47-day TLS certs", "max cert lifetime by 2029", "verified", 62, 76, -2, {
          notes: "Public TLS certificate lifetimes step down to **47 days** by 2029. Manual renewal stops being realistic." }),
        E("pqc", "trend", "TRD-02", "Post-quantum", "RSA/ECC phase-out", "", 86, 66, 2, {
          notes: "RSA and ECC are expected to be phased out after 2030. Step one for customers is knowing where their crypto is." }),
        E("idc", "source", "SRC-01", "IDC \"Vendor to Watch\"", "2026 · PkeyFx", "", 84, 4, 3, {
          notes: "IDC named [[PkeyFx]] a 2026 \"Vendor to Watch\"." }),
        E("eventbus", "idea", "IDA-02", "Cross-product event bus", "all products publish lifecycle events", "", 30, 8, 0, {
          onBoard: false, next: "List the events each product would publish",
          notes: "One RabbitMQ-style bus so the products can react to each other's events." })
      ],
      links: [
        { id: "l1", from: "olm", to: "orsus", rel: "part of" },
        { id: "l2", from: "eiag", to: "orsus", rel: "part of" },
        { id: "l3", from: "jml", to: "olm", rel: "explains" },
        { id: "l4", from: "saviynt", to: "olm", rel: "competes with" },
        { id: "l5", from: "tls47", to: "pkeyfx", rel: "drives" },
        { id: "l6", from: "pqc", to: "pkeyfx", rel: "drives" },
        { id: "l7", from: "pkeyfx", to: "idc", rel: "sourced from" },
        { id: "l8", from: "lifecycle", to: "orsus", rel: "extends" },
        { id: "l9", from: "lifecycle", to: "pkeyfx", rel: "extends" }
      ],
      findings: [
        { id: "f1", text: "No public docs show [[PkeyFx]] and [[ORSUS suite]] sharing an owner or approval flow.", entityIds: ["pkeyfx", "orsus"], status: "lead", at: "2026-11-02T16:10:00.000Z" },
        { id: "f2", text: "[[EIAG]] is the only ORSUS module aimed at third-party identities. It looks like the most differentiated one.", entityIds: ["eiag"], status: "inferred", at: "2026-11-01T12:35:00.000Z" },
        { id: "f3", text: "IDC named [[PkeyFx]] a 2026 \"Vendor to Watch\".", entityIds: ["pkeyfx", "idc"], status: "verified", at: "2026-10-30T05:42:00.000Z" }
      ]
    };
  }

  /* ---------- validation (also used on import) ---------- */
  function clean(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Not a redstring backup.");
    var out = { version: VERSION, counters: {}, lastBackup: raw.lastBackup ? str(raw.lastBackup, 40) : null, entities: [], links: [], findings: [] };
    Object.keys(PREFIX).forEach(function (t) { out.counters[PREFIX[t]] = num(raw.counters && raw.counters[PREFIX[t]], 0, 0, 1e6); });
    var ids = {};
    (Array.isArray(raw.entities) ? raw.entities : []).forEach(function (e) {
      if (!e || !e.id || ids[e.id]) return;
      var type = TYPES.indexOf(e.type) >= 0 ? e.type : "concept";
      var id = str(e.id, 64);
      ids[id] = true;
      out.entities.push({
        id: id, type: type, no: str(e.no, 16) || "", name: str(e.name, 200) || "Untitled",
        blurb: str(e.blurb, 300), status: STATUSES.indexOf(e.status) >= 0 ? e.status : "",
        x: num(e.x, 40, 0, 100), y: num(e.y, 40, 0, 100), tilt: num(e.tilt, 0, -6, 6),
        onBoard: e.onBoard !== false, notes: str(e.notes, 200000),
        facts: (Array.isArray(e.facts) ? e.facts : []).slice(0, 100).map(function (f) {
          return { k: str(f && f.k, 120), v: str(f && f.v, 1000), s: STATUSES.indexOf(f && f.s) >= 0 ? f.s : "" };
        }),
        stage: type === "idea" ? (STAGES.indexOf(e.stage) >= 0 ? e.stage : "proposed") : "",
        next: str(e.next, 300),
        comments: (Array.isArray(e.comments) ? e.comments : []).slice(0, 2000).filter(function (c) { return c && str(c.text).trim(); }).map(function (c) {
          return { id: str(c.id, 64) || uid("c"), text: str(c.text, 5000), at: str(c.at, 40) || now() };
        }),
        createdAt: str(e.createdAt, 40) || now(), updatedAt: str(e.updatedAt, 40) || now()
      });
    });
    var seen = {};
    (Array.isArray(raw.links) ? raw.links : []).forEach(function (l) {
      if (!l || !ids[l.from] || !ids[l.to] || l.from === l.to) return;
      var rel = RELS.hasOwnProperty(l.rel) ? l.rel : "related to";
      var k = l.from + "|" + l.to + "|" + rel;
      if (seen[k]) return; seen[k] = true;
      out.links.push({ id: str(l.id, 64) || uid("l"), from: l.from, to: l.to, rel: rel });
    });
    (Array.isArray(raw.findings) ? raw.findings : []).forEach(function (f) {
      if (!f || !str(f.text).trim()) return;
      out.findings.push({
        id: str(f.id, 64) || uid("f"), text: str(f.text, 20000),
        entityIds: (Array.isArray(f.entityIds) ? f.entityIds : []).filter(function (i) { return ids[i]; }),
        status: STATUSES.indexOf(f.status) >= 0 ? f.status : "", at: str(f.at, 40) || now()
      });
    });
    return out;
  }

  /* ---------- persistence ---------- */
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { persistent = false; }
    if (raw) {
      try { db = clean(JSON.parse(raw)); return; } catch (e) { /* fall through to seed */ }
    }
    db = seed();
    write();
  }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); persistent = true; }
    catch (e) { persistent = false; }
  }
  function commit(what) {
    write();
    listeners.forEach(function (fn) { try { fn(what || "change"); } catch (e) { console.error(e); } });
  }
  // keep tabs in sync
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY || !e.newValue) return;
    try { db = clean(JSON.parse(e.newValue)); commit("sync"); } catch (err) { /* ignore */ }
  });

  /* ---------- queries ---------- */
  function entities() { return db.entities.slice(); }
  function entity(id) { for (var i = 0; i < db.entities.length; i++) if (db.entities[i].id === id) return db.entities[i]; return null; }
  function byName(name) {
    name = str(name).trim().toLowerCase();
    for (var i = 0; i < db.entities.length; i++) if (db.entities[i].name.toLowerCase() === name) return db.entities[i];
    return null;
  }
  function links() { return db.links.slice(); }
  function linksOf(id) { return db.links.filter(function (l) { return l.from === id || l.to === id; }); }
  function linked(a, b) { return db.links.some(function (l) { return (l.from === a && l.to === b) || (l.from === b && l.to === a); }); }
  function findings() {
    return db.findings.slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  function findingsOf(id) { return findings().filter(function (f) { return f.entityIds.indexOf(id) >= 0; }); }

  // [[wiki links]] inside text
  function mentions(text) {
    var out = [], re = /\[\[([^\]\n]{1,200})\]\]/g, m;
    while ((m = re.exec(text || ""))) out.push(m[1].trim());
    return out;
  }
  function mentionedIn(id) {
    var e = entity(id); if (!e) return [];
    var n = e.name.toLowerCase();
    return db.entities.filter(function (o) {
      return o.id !== id && mentions(o.notes).some(function (x) { return x.toLowerCase() === n; });
    });
  }

  /* ---------- mutations ---------- */
  function nextNo(type) {
    var p = PREFIX[type] || "ENT";
    db.counters[p] = (db.counters[p] || 0) + 1;
    return p + "-" + String(db.counters[p]).padStart(2, "0");
  }
  function addEntity(d) {
    var type = TYPES.indexOf(d.type) >= 0 ? d.type : "concept";
    var e = {
      id: uid("e"), type: type, no: nextNo(type), name: str(d.name, 200).trim() || "Untitled",
      blurb: str(d.blurb, 300).trim(), status: STATUSES.indexOf(d.status) >= 0 ? d.status : "",
      x: num(d.x, 20 + Math.random() * 55, 0, 100), y: num(d.y, 15 + Math.random() * 55, 0, 100),
      tilt: Math.round((Math.random() * 5 - 2.5) * 10) / 10,
      onBoard: d.onBoard !== false, notes: str(d.notes), facts: [], comments: [], next: str(d.next, 300),
      stage: type === "idea" ? (STAGES.indexOf(d.stage) >= 0 ? d.stage : "proposed") : "",
      createdAt: now(), updatedAt: now()
    };
    db.entities.push(e);
    commit("entity");
    return e;
  }
  function updateEntity(id, patch, quiet) {
    var e = entity(id); if (!e) return null;
    Object.keys(patch).forEach(function (k) {
      var v = patch[k];
      if (k === "name") v = str(v, 200).trim() || e.name;
      if (k === "blurb") v = str(v, 300);
      if (k === "type") { v = TYPES.indexOf(v) >= 0 ? v : e.type; }
      if (k === "status" && STATUSES.indexOf(v) < 0) v = "";
      if (k === "stage" && STAGES.indexOf(v) < 0) v = "proposed";
      if (k === "next") v = str(v, 300);
      if (k === "x" || k === "y") v = num(v, e[k], 0, 100);
      e[k] = v;
    });
    if (e.type === "idea" && !e.stage) e.stage = "proposed";
    if (e.type !== "idea") e.stage = "";
    e.updatedAt = now();
    commit(quiet ? "quiet" : "entity");
    return e;
  }
  function deleteEntity(id) {
    db.entities = db.entities.filter(function (e) { return e.id !== id; });
    db.links = db.links.filter(function (l) { return l.from !== id && l.to !== id; });
    db.findings.forEach(function (f) { f.entityIds = f.entityIds.filter(function (i) { return i !== id; }); });
    commit("entity");
  }
  function addLink(from, to, rel) {
    if (!entity(from) || !entity(to) || from === to) return null;
    rel = RELS.hasOwnProperty(rel) ? rel : "related to";
    var dup = db.links.filter(function (l) { return l.from === from && l.to === to && l.rel === rel; })[0];
    if (dup) return dup;
    var l = { id: uid("l"), from: from, to: to, rel: rel };
    db.links.push(l);
    touch(from); touch(to);
    commit("link");
    return l;
  }
  function deleteLink(id) {
    db.links = db.links.filter(function (l) { return l.id !== id; });
    commit("link");
  }
  function touch(id) { var e = entity(id); if (e) e.updatedAt = now(); }

  function addFinding(d) {
    var text = str(d.text, 20000).trim(); if (!text) return null;
    var ids = (d.entityIds || []).slice();
    // [[Name]] in the text tags that entity automatically
    mentions(text).forEach(function (n) { var e = byName(n); if (e && ids.indexOf(e.id) < 0) ids.push(e.id); });
    ids = ids.filter(function (i) { return !!entity(i); });
    var f = { id: uid("f"), text: text, entityIds: ids, status: STATUSES.indexOf(d.status) >= 0 ? d.status : "", at: now() };
    db.findings.push(f);
    ids.forEach(touch);
    commit("finding");
    return f;
  }
  function updateFinding(id, patch) {
    var f = db.findings.filter(function (x) { return x.id === id; })[0]; if (!f) return null;
    if ("text" in patch) {
      f.text = str(patch.text, 20000);
      mentions(f.text).forEach(function (n) { var e = byName(n); if (e && f.entityIds.indexOf(e.id) < 0) f.entityIds.push(e.id); });
    }
    if ("status" in patch) f.status = STATUSES.indexOf(patch.status) >= 0 ? patch.status : "";
    if ("entityIds" in patch) f.entityIds = patch.entityIds.filter(function (i) { return !!entity(i); });
    commit("finding");
    return f;
  }
  /* comments on a file */
  function addComment(entityId, text) {
    var e = entity(entityId); text = str(text, 5000).trim();
    if (!e || !text) return null;
    var c = { id: uid("c"), text: text, at: now() };
    e.comments.push(c); e.updatedAt = now();
    commit("comment");
    return c;
  }
  function deleteComment(entityId, commentId) {
    var e = entity(entityId); if (!e) return null;
    var i = -1;
    e.comments.forEach(function (c, k) { if (c.id === commentId) i = k; });
    if (i < 0) return null;
    var removed = e.comments.splice(i, 1)[0];
    commit("comment");
    return { comment: removed, index: i };
  }
  function restoreComment(entityId, removed) {
    var e = entity(entityId); if (!e || !removed) return;
    e.comments.splice(Math.min(removed.index, e.comments.length), 0, removed.comment);
    commit("comment");
  }

  function deleteFinding(id) {
    db.findings = db.findings.filter(function (f) { return f.id !== id; });
    commit("finding");
  }

  /* ---------- search ---------- */
  function search(q, limit) {
    q = str(q).trim().toLowerCase();
    if (!q) return [];
    var words = q.split(/\s+/);
    function score(fields) {
      var total = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], hit = 0;
        for (var j = 0; j < fields.length; j++) {
          var t = fields[j][0].toLowerCase(), weight = fields[j][1];
          var at = t.indexOf(w);
          if (at >= 0) hit = Math.max(hit, weight * (at === 0 ? 1.5 : 1));
        }
        if (!hit) return 0;          // every word must match somewhere
        total += hit;
      }
      return total;
    }
    var out = [];
    db.entities.forEach(function (e) {
      var facts = e.facts.map(function (f) { return f.k + " " + f.v; }).join(" ");
      var comments = e.comments.map(function (c) { return c.text; }).join(" ");
      var s = score([[e.name, 10], [e.no, 6], [e.type, 3], [e.blurb, 4], [facts, 3], [e.notes, 2], [comments, 1.5]]);
      if (s) out.push({ kind: "entity", score: s, item: e, text: e.blurb || e.notes });
    });
    db.findings.forEach(function (f) {
      var s = score([[f.text, 2]]);
      if (s) out.push({ kind: "finding", score: s * 0.9, item: f, text: f.text });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit || 12);
  }

  /* ---------- backup ---------- */
  function exportData() {
    db.lastBackup = now(); write(); commit("quiet");
    return JSON.stringify(db, null, 2);
  }
  function importData(json) {
    var parsed = typeof json === "string" ? JSON.parse(json) : json;
    db = clean(parsed);
    commit("import");
  }
  function reset() { db = seed(); commit("import"); }
  function stats() {
    return { entities: db.entities.length, links: db.links.length, findings: db.findings.length,
      persistent: persistent, lastBackup: db.lastBackup };
  }

  load();
  // ask the browser not to evict this data under storage pressure
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }

  window.RS = window.RS || {};
  window.RS.store = {
    TYPES: TYPES, STATUSES: STATUSES, STATUS_LABEL: STATUS_LABEL, STAGES: STAGES, RELS: RELS,
    on: function (fn) { listeners.push(fn); },
    entities: entities, entity: entity, byName: byName, links: links, linksOf: linksOf, linked: linked,
    findings: findings, findingsOf: findingsOf, mentions: mentions, mentionedIn: mentionedIn,
    addEntity: addEntity, updateEntity: updateEntity, deleteEntity: deleteEntity,
    addLink: addLink, deleteLink: deleteLink,
    addFinding: addFinding, updateFinding: updateFinding, deleteFinding: deleteFinding,
    addComment: addComment, deleteComment: deleteComment, restoreComment: restoreComment,
    search: search, exportData: exportData, importData: importData, reset: reset, stats: stats
  };
})();
