import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderStudyDoseModuleHtml, type StudyDoseModule as Model } from "@shared/study-dose-module";
import { StudyDoseModule } from "../StudyDoseModule";

const model: Model = {
  topic: "exercise-recovery",
  line: "This study used hydrogen-rich water at 1.6 ppm, 1.5 L a day for 4 weeks. Concentration as reported by the authors.",
  deviceIntro: "Echo Water funds Hydrogen Studies. These Echo devices reached at least 1.6 ppm when H2 Analytics (Las Vegas) measured them:",
  devices: [
    { name: "Echo Flask", ppm: "8.25 ppm", href: "https://echowater.com/products/echo-flask?utm_source=hydrogenstudies&utm_medium=referral&utm_campaign=study&utm_content=x", reportId: "H2AR-250116-1", reportUrl: "https://support.echowater.com/hc/en-us/articles/1", lab: "H2 Analytics (Las Vegas)" },
    { name: "Echo H2 Machine", ppm: "1.43 ppm", href: "https://echowater.com/products/h2?utm_source=hydrogenstudies&utm_medium=referral&utm_campaign=study&utm_content=x", reportId: "H2A-240603-3", reportUrl: null, lab: "H2 Analytics (Las Vegas)" },
  ],
  echoNote: "This study did not use an Echo device. The measurements above come from Echo's lab reports, not from this study.",
  disclaimer: "Drinking water at the same concentration does not mean you will get the same result as the people in this study.",
};

describe("PLAN 5.1 — one HTML for every visitor and crawler", () => {
  it("the React view (Next + SPA) is byte-identical to the crawler renderer's HTML", () => {
    expect(renderToStaticMarkup(<StudyDoseModule module={model} />)).toBe(renderStudyDoseModuleHtml(model));
  });
});
