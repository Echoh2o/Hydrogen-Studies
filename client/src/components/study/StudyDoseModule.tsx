/**
 * PLAN 5.1 "studied dose" module — the React view of a StudyDoseModule
 * (shared/study-dose-module.ts). Used by the Next study page and the SPA; the
 * crawler renderer emits renderStudyDoseModuleHtml(), and a test keeps the two
 * byte-identical. The model is null unless the study's topic is allowed.
 */
import { DOSE_MODULE } from "@shared/evidence-badge-copy";
import type { StudyDoseModule as Model } from "@shared/study-dose-module";

export function StudyDoseModule({ module: m }: { module: Model }) {
  return (
    <section className="dose-module mb-8" aria-labelledby="dose-module-heading">
      <h2 id="dose-module-heading" className="mb-3 text-xl font-semibold text-neutral-900">{DOSE_MODULE.heading}</h2>
      <p className="leading-relaxed text-neutral-700">{m.line}</p>
      <aside className="sponsor mt-4 rounded-lg border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-700" aria-label="Sponsor">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{DOSE_MODULE.sponsorLabel}</p>
        <p className="mb-2">{m.deviceIntro}</p>
        <ul className="mb-2 list-disc pl-5">
          {m.devices.map((d) => (
            <li key={d.href}>
              <a href={d.href} rel="sponsored noopener" className="text-primary underline">{d.name}</a>{`: ${d.ppm}`}
              {d.reportUrl ? (
                <>
                  {" ("}
                  <a href={d.reportUrl} rel="noopener" className="underline">{`${d.lab} report ${d.reportId}`}</a>
                  {")"}
                </>
              ) : (
                ` (${d.lab} report ${d.reportId})`
              )}
            </li>
          ))}
        </ul>
        <p className="mb-2">{m.echoNote}</p>
        <p className="text-xs text-neutral-500">{m.disclaimer}</p>
      </aside>
    </section>
  );
}
