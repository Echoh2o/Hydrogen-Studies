/**
 * The "About Hydrogen Studies" modal behind the store's trust badge (footer
 * and product badge on echowater.com / business.echowater.com), served from
 * /embed/trust-modal.js. Binds to any element with data-hs-trust — normally
 * the badge's <a>, whose href (with its UTM tags) becomes the modal's "Visit
 * Hydrogen Studies" button, so without JS or <dialog> the badge is still a
 * plain link. Copy is TRUST_MODAL (shared/evidence-badge-copy.ts); the live
 * counts come from /embed/stats.json and are left out if that fails. Every
 * value is written with textContent — never HTML.
 */
import { TRUST_MODAL } from "../../shared/evidence-badge-copy";
import { STUDY_REVIEWER } from "../../shared/reviewer";

export function buildTrustModalScript(siteUrl: string): string {
  const copy = {
    ...TRUST_MODAL,
    reviewer: `${STUDY_REVIEWER.name}, ${STUDY_REVIEWER.postNominal}, ${STUDY_REVIEWER.relationship}`,
  };
  const script = `/* Hydrogen Studies trust modal — ${siteUrl}/embed/trust-modal.js */
(function () {
  "use strict";
  if (window.HSTrust) return;
  var ORIGIN = ${JSON.stringify(siteUrl)};
  var COPY = ${JSON.stringify(copy)};
  var CSS = "dialog.hs-tr{max-width:520px;width:calc(100% - 32px);max-height:min(720px,calc(100vh - 32px));border:1px solid #cbd5e1;border-radius:14px;padding:0;overflow:hidden;background:#fff;color:#0f172a;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-shadow:0 20px 50px rgba(15,23,42,.25)}" +
    "dialog.hs-tr::backdrop{background:rgba(15,23,42,.55)}dialog.hs-tr[open]{display:flex;flex-direction:column}.hs-tr .b{padding:22px 24px 8px;overflow:auto;min-height:0;flex:1 1 auto}" +
    ".hs-tr .hd{display:flex;align-items:center;gap:12px;margin:0 0 14px}.hs-tr .mk{flex:none;width:44px;height:44px;border-radius:50%;background:#00a6b5;color:#fff;font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center}" +
    ".hs-tr .mk sub{font-size:10px;margin-left:1px}.hs-tr h2{font-size:19px;line-height:1.25;margin:0}.hs-tr .sb{margin:2px 0 0;color:#475569;font-size:13px}" +
    ".hs-tr h3{font-size:14px;margin:18px 0 6px}.hs-tr p{margin:8px 0}.hs-tr .m{color:#475569;font-size:13px}.hs-tr ul{margin:6px 0;padding-left:20px}.hs-tr li{margin:4px 0}" +
    ".hs-tr .st{display:flex;gap:10px;margin:14px 0}.hs-tr .st div{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}.hs-tr .st strong{display:block;font-size:20px;color:#007c88}.hs-tr .st span{font-size:12px;color:#475569}" +
    ".hs-tr a{color:#0f766e}.hs-tr .ac{flex:none;display:flex;flex-wrap:wrap;gap:10px;padding:14px 24px 18px;border-top:1px solid #e2e8f0;background:#fff}" +
    ".hs-tr .go{flex:1 1 180px;text-align:center;background:#007c88;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;padding:11px 16px}.hs-tr .go:hover{background:#00646e}" +
    ".hs-tr .cl{flex:0 1 auto;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;padding:10px 16px;font:inherit;cursor:pointer}" +
    ".hs-tr .go:focus-visible,.hs-tr .cl:focus-visible{outline:2px solid #0f766e;outline-offset:2px}" +
    "@media (prefers-reduced-motion:no-preference){dialog.hs-tr[open]{animation:hstf .15s ease-out}}@keyframes hstf{from{opacity:0}to{opacity:1}}";
  function el(tag, text, attrs) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = String(text);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  /** The badge's own link if it points at Hydrogen Studies, else a tagged home link. */
  function visitUrl(trigger) {
    var href = trigger && trigger.getAttribute("href");
    try {
      var u = new URL(href || "", ORIGIN);
      if (u.origin === ORIGIN) return u;
    } catch (e) {}
    return new URL(ORIGIN + "/?utm_source=echowater&utm_medium=referral&utm_campaign=trust_modal");
  }
  /** Same UTM tags as the badge, on another Hydrogen Studies path. */
  function sameTags(base, path) {
    var u = new URL(path, ORIGIN);
    u.search = base.search;
    return u.toString();
  }
  var dlg = null;
  function shell() {
    if (dlg) return dlg;
    document.head.appendChild(el("style", CSS));
    dlg = el("dialog", null, { "class": "hs-tr", "aria-label": COPY.ariaLabel });
    document.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    return dlg;
  }
  function stats(box) {
    fetch(ORIGIN + "/embed/stats.json", { credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) {
        if (!s || !(s.totalStudies > 0)) return;
        [[s.totalStudies, COPY.statStudies], [s.humanTrials, COPY.statHuman]].forEach(function (p) {
          if (!(p[0] > 0)) return;
          var d = el("div");
          d.appendChild(el("strong", p[0].toLocaleString("en-US")));
          d.appendChild(el("span", p[1]));
          box.appendChild(d);
        });
      })
      .catch(function () {});
  }
  function open(trigger) {
    var d = shell(), visit = visitUrl(trigger);
    d.textContent = "";
    var b = el("div", null, { "class": "b" });
    var hd = el("div", null, { "class": "hd" });
    var mk = el("div", "H", { "class": "mk", "aria-hidden": "true" });
    mk.appendChild(el("sub", "2"));
    hd.appendChild(mk);
    var tt = el("div");
    tt.appendChild(el("h2", COPY.title));
    tt.appendChild(el("p", COPY.subtitle, { "class": "sb" }));
    hd.appendChild(tt);
    b.appendChild(hd);
    b.appendChild(el("p", COPY.intro));
    var st = el("div", null, { "class": "st" });
    b.appendChild(st);
    stats(st);
    b.appendChild(el("h3", COPY.howHeading));
    var ul = el("ul");
    COPY.points.forEach(function (t) { ul.appendChild(el("li", t)); });
    b.appendChild(ul);
    b.appendChild(el("p", COPY.reviewerLabel + ": " + COPY.reviewer, { "class": "m" }));
    b.appendChild(el("p", COPY.disclosure, { "class": "m" }));
    var lk = el("p", null, { "class": "m" });
    lk.appendChild(el("a", COPY.editorialPolicy, { href: sameTags(visit, "/editorial-policy"), target: "_blank", rel: "noopener" }));
    lk.appendChild(document.createTextNode(" · "));
    lk.appendChild(el("a", COPY.methodology, { href: sameTags(visit, "/methodology"), target: "_blank", rel: "noopener" }));
    b.appendChild(lk);
    var ac = el("div", null, { "class": "ac" });
    ac.appendChild(el("a", COPY.visit + " \\u2192", { "class": "go", href: visit.toString(), target: "_blank", rel: "noopener", autofocus: "" }));
    var cl = el("button", COPY.close, { "class": "cl", type: "button" });
    cl.addEventListener("click", function () { d.close(); });
    ac.appendChild(cl);
    d.appendChild(b);
    d.appendChild(ac);
    if (!d.open) d.showModal();
  }
  window.HSTrust = { open: open };
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-hs-trust]") : null;
    if (!t) return;
    if (typeof HTMLDialogElement === "undefined" || typeof URL === "undefined") return; // old browsers follow the link
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // new-tab clicks keep working
    e.preventDefault();
    open(t);
  });
})();
`;
  // ASCII only, so the copy survives a store page that doesn't decode the script as UTF-8.
  return script.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
