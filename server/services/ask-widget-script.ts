/**
 * TRUST-BADGE-PLAN 3.8 — "Ask the research" widget, served at /embed/ask.js.
 * Add <div data-hs-ask data-site="echowater" data-product="echo-flask"></div>
 * anywhere; the script renders a question box, posts to /api/ask, and shows
 * the answer as text with [study:ID] turned into numbered links. All text via
 * textContent; no HTML from the API is ever inserted.
 */
export function buildAskWidgetScript(siteUrl: string): string {
  return `/* Hydrogen Studies "Ask the research" — ${siteUrl}/embed/ask.js */
(function () {
  "use strict";
  if (window.__hsAsk) return;
  window.__hsAsk = true;
  var ORIGIN = ${JSON.stringify(siteUrl)};
  var CSS = ".hs-ask{font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;border:1px solid #cbd5e1;border-radius:12px;padding:16px;max-width:640px}" +
    ".hs-ask form{display:flex;gap:8px}.hs-ask input{flex:1;padding:8px 10px;border:1px solid #94a3b8;border-radius:8px;font:inherit}.hs-ask button{padding:8px 14px;border:0;border-radius:8px;background:#0f766e;color:#fff;font:inherit;cursor:pointer}" +
    ".hs-ask .a{margin-top:12px}.hs-ask .m{color:#475569;font-size:13px}.hs-ask ol{padding-left:20px;font-size:13px}.hs-ask a{color:#0f766e}";
  function el(tag, text, attrs) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = String(text);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function utm(url, site, product) {
    if (url.indexOf(ORIGIN) !== 0) return url;
    return url + (url.indexOf("?") < 0 ? "?" : "&") + "utm_source=" + (site === "echowater" ? "echowater" : "hydrogenstudies") + "&utm_medium=ask&utm_campaign=ask_the_research&utm_content=" + encodeURIComponent(product || "site");
  }
  function renderAnswer(box, data, site, product) {
    box.textContent = "";
    var order = [];
    var p = el("p");
    String(data.answer || "").split(/(\\[[^\\]]*study:[^\\]]*\\])/).forEach(function (part) {
      var ids = part.match(/study:\\s*(\\d+)/g);
      if (part.charAt(0) === "[" && ids) {
        ids.forEach(function (m) {
          var id = Number(m.replace(/\\D/g, ""));
          var n = order.indexOf(id) + 1 || order.push(id);
          var c = (data.citations || []).filter(function (x) { return x.id === id; })[0];
          var a = el("a", "[" + n + "]", { href: c ? utm(c.url, site, product) : "#", target: "_blank", rel: "noopener" });
          p.appendChild(a);
        });
      } else p.appendChild(document.createTextNode(part));
    });
    box.appendChild(p);
    if (order.length) {
      var ol = el("ol");
      order.forEach(function (id) {
        var c = (data.citations || []).filter(function (x) { return x.id === id; })[0];
        if (!c) return;
        var li = el("li"); li.appendChild(el("a", c.title, { href: utm(c.url, site, product), target: "_blank", rel: "noopener" })); ol.appendChild(li);
      });
      box.appendChild(ol);
    } else if ((data.studies || []).length) {
      var ol2 = el("ol");
      data.studies.forEach(function (s) { var li = el("li"); li.appendChild(el("a", s.title, { href: utm(s.url, site, product), target: "_blank", rel: "noopener" })); ol2.appendChild(li); });
      box.appendChild(ol2);
    }
    if ((data.supportArticles || []).length) {
      var ul = el("ul");
      data.supportArticles.forEach(function (a) { var li = el("li"); li.appendChild(el("a", a.title, { href: a.url, target: "_blank", rel: "noopener" })); ul.appendChild(li); });
      box.appendChild(ul);
    }
    box.appendChild(el("p", "Answers come only from studies in the Hydrogen Studies database, which Echo Water funds. Not medical advice.", { "class": "m" }));
  }
  function mount(root) {
    if (root.__hsAskMounted) return;
    root.__hsAskMounted = true;
    var site = root.getAttribute("data-site") === "echowater" ? "echowater" : "hydrogenstudies";
    var product = root.getAttribute("data-product") || null;
    var wrap = el("div", null, { "class": "hs-ask" });
    wrap.appendChild(el("p", "Ask what the research says", { "class": "m" }));
    var form = el("form"), input = el("input", null, { type: "text", maxlength: "500", "aria-label": "Your question", placeholder: "e.g. Does hydrogen water help exercise recovery?" }), btn = el("button", "Ask", { type: "submit" });
    form.appendChild(input); form.appendChild(btn); wrap.appendChild(form);
    var box = el("div", null, { "class": "a", "aria-live": "polite" }); wrap.appendChild(box);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (q.length < 3) return;
      btn.disabled = true; box.textContent = "Looking through the studies…";
      fetch(ORIGIN + "/api/ask", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, site: site, product: product, page: location.pathname }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) { if (!x.ok) { box.textContent = (x.d && x.d.error) || "Something went wrong."; return; } renderAnswer(box, x.d, site, product); })
        .catch(function () { box.textContent = "Something went wrong. Please try again."; })
        .then(function () { btn.disabled = false; });
    });
    if (!document.getElementById("hs-ask-css")) { var st = el("style", CSS, { id: "hs-ask-css" }); document.head.appendChild(st); }
    root.appendChild(wrap);
  }
  function run() { var roots = document.querySelectorAll("[data-hs-ask]"); for (var i = 0; i < roots.length; i++) mount(roots[i]); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
`;
}
