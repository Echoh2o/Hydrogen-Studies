/**
 * TRUST-BADGE-PLAN Phase 2.4 — the click-to-open evidence modal for
 * echowater.com, served from /embed/evidence-modal.js (any origin). Plain
 * script, no dependencies, ~4 KB. Binds to any element with
 * data-hs-evidence="<product>" (optionally data-hs-topic="<topic>"), fetches
 * the public API on first click, and shows a native <dialog> (focus handling
 * and Esc for free). Every value is written with textContent — never HTML.
 */
export function buildEvidenceModalScript(siteUrl: string): string {
  return `/* Hydrogen Studies evidence modal — ${siteUrl}/embed/evidence-modal.js */
(function () {
  "use strict";
  if (window.HSEvidence) return;
  var ORIGIN = ${JSON.stringify(siteUrl)};
  var CSS = "dialog.hs-ev{max-width:720px;width:calc(100% - 32px);border:1px solid #cbd5e1;border-radius:12px;padding:0;color:#0f172a;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
    "dialog.hs-ev::backdrop{background:rgba(15,23,42,.55)}.hs-ev .b{padding:20px 22px;max-height:80vh;overflow:auto}.hs-ev h2{font-size:19px;margin:0 0 8px}" +
    ".hs-ev h3{font-size:15px;margin:18px 0 6px}.hs-ev p{margin:6px 0}.hs-ev .m{color:#475569;font-size:13px}.hs-ev table{width:100%;border-collapse:collapse;font-size:13px}" +
    ".hs-ev th,.hs-ev td{text-align:left;border-bottom:1px solid #e2e8f0;padding:6px 4px;vertical-align:top}.hs-ev a{color:#0f766e}" +
    ".hs-ev .x{position:sticky;top:0;float:right;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 10px;cursor:pointer}" +
    "@media (prefers-reduced-motion:no-preference){dialog.hs-ev[open]{animation:hsf .15s ease-out}}@keyframes hsf{from{opacity:0}to{opacity:1}}";
  var RESULT = { improved: "Improved", no_clear_effect: "No clear effect", worsened: "Worsened", mixed: "Mixed", not_reported: "Not reported" };
  function el(tag, text, attrs) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = String(text);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function link(text, href) {
    var a = el("a", text, { href: href, target: "_blank", rel: "noopener" });
    return a;
  }
  function utm(url, slug) {
    return url + (url.indexOf("?") < 0 ? "?" : "&") + "utm_source=echowater&utm_medium=badge&utm_campaign=evidence_profile&utm_content=" + encodeURIComponent(slug);
  }
  var dlg = null;
  function shell() {
    if (dlg) return dlg;
    var style = el("style", CSS);
    document.head.appendChild(style);
    dlg = el("dialog", null, { "class": "hs-ev", "aria-label": "Research behind this product" });
    document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    return dlg;
  }
  function render(d, data, topicData, slug) {
    d.textContent = "";
    var b = el("div", null, { "class": "b" });
    var x = el("button", "Close", { "class": "x", type: "button" });
    x.addEventListener("click", function () { d.close(); });
    b.appendChild(x);
    if (topicData) {
      b.appendChild(el("h2", "Research on " + topicData.label));
      b.appendChild(el("p", topicData.line));
      b.appendChild(el("p", topicData.rule, { "class": "m" }));
    } else {
      b.appendChild(el("h2", data.copy.badgeLine1 + " · " + data.copy.badgeLine2));
      b.appendChild(el("p", data.copy.summary));
      b.appendChild(el("p", data.copy.echoDevice + " " + data.copy.echoFunding));
    }
    if (data.product && data.product.reportId) {
      var p = el("p", null, { "class": "m" });
      p.appendChild(document.createTextNode((data.copy.measuredBy || "Concentration measured by") + " " + data.product.lab + ", report " + data.product.reportId + " (" + data.product.testDate + "). "));
      if (data.product.reportUrl) p.appendChild(link("Read the lab report", data.product.reportUrl));
      b.appendChild(p);
    }
    b.appendChild(el("h3", "How this count is made"));
    b.appendChild(el("p", topicData ? topicData.rule : data.rule.text, { "class": "m" }));
    var rows = topicData ? topicData.studies : data.matched;
    b.appendChild(el("h3", "The studies (" + rows.length + ")"));
    var t = el("table"), hr = el("tr");
    ["Study", "Year", "Result", "Source"].forEach(function (h) { hr.appendChild(el("th", h, { scope: "col" })); });
    var th = el("thead"); th.appendChild(hr); t.appendChild(th);
    var tb = el("tbody");
    rows.forEach(function (s) {
      var tr = el("tr"), c1 = el("td");
      c1.appendChild(link(s.title, utm(s.url, slug)));
      tr.appendChild(c1);
      tr.appendChild(el("td", s.year || ""));
      tr.appendChild(el("td", RESULT[s.result] || s.result));
      var c4 = el("td");
      if (s.source) c4.appendChild(link(s.source.indexOf("pubmed") >= 0 ? "PubMed" : "DOI", s.source));
      tr.appendChild(c4);
      tb.appendChild(tr);
    });
    t.appendChild(tb); b.appendChild(t);
    var more = topicData ? topicData.moreNote : data.copy.moreNote;
    if (more) {
      var mp = el("p", more + " ", { "class": "m" });
      mp.appendChild(link(data.copy.fullProfile || "See all studies", utm(data.evidencePage, slug)));
      b.appendChild(mp);
    }
    var foot = el("p", null, { "class": "m" });
    foot.appendChild(document.createTextNode("Reviewed by " + data.reviewer.name + ", " + data.reviewer.title + ". " + data.copy.notAdvice + " "));
    foot.appendChild(link("Methodology", utm(data.methodology, slug)));
    foot.appendChild(document.createTextNode(" · "));
    foot.appendChild(link("Read the full profile", utm(data.evidencePage, slug)));
    b.appendChild(foot);
    b.appendChild(el("p", data.copy.disclosure, { "class": "m" }));
    d.appendChild(b);
  }
  function getJson(url) {
    return fetch(url, { credentials: "omit" }).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }
  function open(slug, topic) {
    var d = shell();
    d.textContent = "";
    d.appendChild(el("div", "Loading…", { "class": "b" }));
    if (!d.open) d.showModal();
    var base = ORIGIN + "/api/evidence/" + encodeURIComponent(slug);
    Promise.all([getJson(base), topic ? getJson(base + "/topic/" + encodeURIComponent(topic)) : Promise.resolve(null)])
      .then(function (r) { render(d, r[0], r[1], slug); })
      .catch(function () {
        // The badge link still works without the modal.
        d.close();
        window.open(utm(ORIGIN + "/evidence/" + slug, slug), "_blank", "noopener");
      });
  }
  window.HSEvidence = { open: open };
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-hs-evidence]") : null;
    if (!t) return;
    if (typeof HTMLDialogElement === "undefined") return; // old browsers follow the link
    e.preventDefault();
    open(t.getAttribute("data-hs-evidence"), t.getAttribute("data-hs-topic"));
  });
})();
`;
}
