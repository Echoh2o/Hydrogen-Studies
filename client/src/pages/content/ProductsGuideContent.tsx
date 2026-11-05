"use client";
/**
 * /products body (PLAN 5.4): an honest guide to hydrogen water devices, with
 * Echo's devices listed and labeled as our funder's. Shared by the SPA route
 * and the Next page (web/app/products). Copy lives in shared/products-guide.ts.
 */
import { Link } from "wouter";
import { Byline } from "@/components/blog/Byline";
import { trackOutboundClick } from "@/lib/analytics";
import { ECHO_PRODUCTS, echoProductUrl, pageContextFromPath } from "@shared/echo-products";
import {
  CHECKLIST,
  DEVICE_TYPES,
  ECHO_DEVICE_FACTS,
  ECHO_TESTING_NOTE,
  PRODUCTS_FAQS,
  PRODUCTS_H1,
  PRODUCTS_PATH,
  PRODUCTS_SUMMARY,
  productsByline,
} from "@shared/products-guide";

const UTM = pageContextFromPath(PRODUCTS_PATH);

export function ProductsGuideContent() {
  return (
    <main className="bg-white">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-gray-700">{PRODUCTS_H1}</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{PRODUCTS_H1}</h1>
        <Byline byline={productsByline()} className="byline mt-3 text-sm text-gray-600" />

        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Disclosure:</strong> Hydrogen Studies is funded by Echo Technologies LLC, which makes the Echo
          hydrogen water devices listed further down this page. The checklist applies to every device, Echo's
          included. <Link href="/editorial-policy" className="underline">How we keep the research independent</Link>.
        </p>

        <p className="mt-6 text-lg leading-relaxed text-gray-800">{PRODUCTS_SUMMARY}</p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900">How hydrogen devices work</h2>
          <div className="mt-4 space-y-5">
            {DEVICE_TYPES.map((d) => (
              <div key={d.name} className="rounded-lg border border-gray-200 p-5">
                <h3 className="text-lg font-semibold text-gray-900">{d.name}</h3>
                <p className="mt-2 text-gray-700">{d.how}</p>
                <p className="mt-2 text-gray-700"><strong>Check:</strong> {d.check}</p>
                {d.researchHref && (
                  <p className="mt-2 text-sm">
                    <Link href={d.researchHref} className="text-teal-700 underline">See the studies by delivery method</Link>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900">What to check before you buy</h2>
          <ol className="mt-4 list-decimal space-y-4 pl-6">
            {CHECKLIST.map((c) => (
              <li key={c.title} className="text-gray-700">
                <strong className="text-gray-900">{c.title}.</strong> {c.body}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-gray-600">
            Before buying anything, read{" "}
            <Link href="/limits-of-the-evidence" className="text-teal-700 underline">the limits of the evidence</Link>{" "}
            and{" "}
            <Link href="/is-hydrogen-water-a-scam" className="text-teal-700 underline">is hydrogen water a scam?</Link>
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900">Our funder's devices (Echo)</h2>
          <p className="mt-3 text-gray-700">
            These are Echo's devices, with the concentration figures Echo states on its own product pages. We have not
            measured them ourselves yet, and we do not rank them against other brands.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-gray-900">
                  <th scope="col" className="py-2 pr-4 font-semibold">Device</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Type</th>
                  <th scope="col" className="py-2 font-semibold">Concentration Echo states</th>
                </tr>
              </thead>
              <tbody>
                {ECHO_DEVICE_FACTS.map((f) => {
                  const p = ECHO_PRODUCTS[f.key];
                  const href = echoProductUrl(p, UTM);
                  return (
                    <tr key={f.key} className="border-b border-gray-200 align-top">
                      <td className="py-2 pr-4">
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener sponsored"
                          className="text-teal-700 underline"
                          onClick={() => trackOutboundClick(href, "products-guide")}
                        >
                          {p.title}
                        </a>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{f.type}</td>
                      <td className="py-2 text-gray-700">{f.echoStates ?? "No figure on the product page"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-gray-700">{ECHO_TESTING_NOTE}</p>
          <p className="mt-2 text-xs text-gray-500">
            Echo figures read from echowater.com on November 4, 2026. Links go to echowater.com.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900">Questions</h2>
          {/* Native disclosure: answers stay in the server HTML (FAQPage = visible). */}
          <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
            {PRODUCTS_FAQS.map((f) => (
              <details key={f.question} className="group py-3">
                <summary className="cursor-pointer font-medium text-gray-900">
                  {f.question}
                </summary>
                <p className="mt-2 text-gray-700">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
