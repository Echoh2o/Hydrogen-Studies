/**
 * PLAN.md 5.4 — /products is an honest "how hydrogen devices work and what to
 * look for" guide (Josh, 2026-11-04), with Echo's devices listed and labeled
 * as our funder's. One source for the visible copy, the FAQ (visible accordion
 * + FAQPage JSON-LD), page meta and tests.
 *
 * Echo figures are quoted from echowater.com product pages (Shopify Admin API,
 * read 2026-11-04) and attributed to Echo — we have not measured them. Nothing
 * here may claim a device treats, cures or prevents a disease.
 */
import { blogByline, type BlogByline } from "./seo-markup";

export const PRODUCTS_PATH = "/products";
export const PRODUCTS_H1 = "Hydrogen water devices: how they work and what to check";
export const PRODUCTS_LAST_REVIEWED = "2026-11-05";

export function productsByline(): BlogByline {
  return blogByline({ authorName: null, reviewerName: null, updatedAt: PRODUCTS_LAST_REVIEWED });
}

/** The short answer, shown first. */
export const PRODUCTS_SUMMARY =
  "What matters in a hydrogen water device is how much hydrogen is dissolved in the water when you drink it, measured by a proper method, and what else ends up in the water. Ask for a dated test report from an independent lab that shows concentration over time, not just a single peak number. Colour, pH and ORP readings do not tell you how much hydrogen is in the water.";

export interface DeviceType {
  name: string;
  how: string;
  check: string;
  /** Delivery-method hub with the research for this route, when we have one. */
  researchHref?: string;
}

export const DEVICE_TYPES: DeviceType[] = [
  {
    name: "Hydrogen water bottles and machines (electrolysis)",
    how: "An electric current splits water into hydrogen and oxygen. Better designs use a membrane (often called PEM or SPE) so that the oxygen side, and anything else made there, is vented away instead of mixing into the water you drink.",
    check: "Whether the drinking water touches the electrode side, what the electrodes are made of (usually platinum-coated titanium), and whether the maker publishes tests for by-products such as chlorine and ozone.",
    researchHref: "/explore-by-delivery-method",
  },
  {
    name: "Magnesium tablets",
    how: "Magnesium reacts with water to make hydrogen gas and magnesium hydroxide. In a closed bottle this can reach high concentrations.",
    check: "The magnesium you are also drinking with each tablet, and whether you are meant to drink it from a sealed bottle soon after it dissolves. Mild stomach upset is the side effect reported most often with these tablets.",
  },
  {
    name: "Canned or pouched hydrogen water",
    how: "Water is filled with hydrogen at the factory and sealed in an aluminium can or pouch, because hydrogen escapes through plastic.",
    check: "A concentration figure for when the product is opened, not when it was filled, plus the date it was packed.",
  },
  {
    name: "Hydrogen inhalation machines",
    how: "These make hydrogen gas, usually mixed with oxygen, for you to breathe through a cannula or mask. Many hospital studies used inhaled gas rather than water.",
    check: "The gas flow and the hydrogen percentage, and the safety design. Hydrogen is flammable in air from about 4% upwards, so look for built-in safeguards and follow the instructions.",
    researchHref: "/explore-by-delivery-method",
  },
];

export interface Checkpoint {
  title: string;
  body: string;
}

export const CHECKLIST: Checkpoint[] = [
  {
    title: "A concentration number, and how it was measured",
    body: "Concentration is given in parts per million (ppm), which for water is the same as milligrams per litre. It should be measured with a dissolved-hydrogen meter or a titration reagent such as methylene-blue drops. ORP (oxidation-reduction potential) and pH are not measures of hydrogen.",
  },
  {
    title: "Honesty about saturation",
    body: "At normal air pressure and room temperature, water holds about 1.6 ppm of hydrogen. Higher figures are possible only while the water is under pressure in a sealed container, and they start falling once it is opened. A claim above 1.6 ppm is not impossible, but it should come with the conditions under which it was measured.",
  },
  {
    title: "What happens after you open it (outgassing)",
    body: "Hydrogen is the smallest molecule and escapes from water quickly. A useful test report shows the concentration at 0, 5, 15 and 30 minutes after the cycle ends, so you know how soon to drink.",
  },
  {
    title: "An independent, dated test report",
    body: "\"Certified\" should mean a named third-party lab, a stated method, the test date and the conditions (water type, temperature, cycle length). Ask to see the report itself, not just a badge.",
  },
  {
    title: "What the water touches",
    body: "For electrolysis devices, ask whether the drinking water is kept away from the electrodes and whether the maker has tested the water for metals and electrolysis by-products.",
  },
  {
    title: "Claims to be wary of",
    body: "Promises to treat or cure diseases, \"hydrogen deficiency\", and alkaline water sold as if it were hydrogen water. Human research on hydrogen water is still early: most trials are small and short. See the limits of the evidence before you buy anything.",
  },
];

/** Echo devices, figures as Echo states them on its echowater.com product pages. */
export interface EchoDeviceFact {
  key: "flask" | "h2Machine" | "forty" | "one" | "ultimate" | "flow" | "refresh" | "revive";
  type: string;
  echoStates: string;
  /** A published third-party test report, when Echo links one. */
  report?: { label: string; href: string };
}

// Read from the live product pages (not the API description field) on 2026-11-04.
export const ECHO_DEVICE_FACTS: EchoDeviceFact[] = [
  {
    key: "flask",
    type: "Bottle (electrolysis)",
    echoStates: "Up to 8 ppm after a 20-minute cycle, 6 ppm after 10 minutes",
    report: {
      label: "H2 Analytics report H2AR-250116-1 (January 16, 2025): 6.07 mg/L after 10 minutes and 8.25 mg/L after 20 minutes, by gas chromatography in distilled water",
      href: "https://cdn.shopify.com/s/files/1/0828/0083/6914/files/Echo_Flask_H2_Test_Report_H2AR-250116-1.pdf",
    },
  },
  { key: "forty", type: "40 oz tumbler (electrolysis)", echoStates: "4 to 6 ppm (pre-release target; lab test after launch)" },
  { key: "h2Machine", type: "Countertop or under-sink machine with filter", echoStates: "Up to 1.44 ppm, with no change to the water's pH" },
  { key: "flow", type: "Under-sink hydrogen generator (pairs with a home water system)", echoStates: "Up to 1.21 ppm" },
  { key: "ultimate", type: "Multi-water kitchen machine", echoStates: "Up to 1.46 ppm" },
  { key: "one", type: "Under-counter reverse osmosis + hydrogen", echoStates: "2 to 4 ppm (pre-release target; lab test after launch)" },
  { key: "revive", type: "Bath machine", echoStates: "Up to 1.6 ppm in the bath water" },
  { key: "refresh", type: "Inhalation machine", echoStates: "Rated by gas flow, not by a water concentration" },
];

export const ECHO_TESTING_NOTE =
  "Echo has its devices tested by H2 Analytics, a third-party hydrogen testing lab in Las Vegas, and publishes the Flask report linked above. That report gives the concentration at the end of a cycle. It does not show how quickly the hydrogen escapes once the bottle is opened.";

export const PRODUCTS_FAQS: { question: string; answer: string }[] = [
  {
    question: "How much hydrogen should hydrogen water have?",
    answer:
      "There is no agreed dose. In the human trials in our database that report a concentration, about half used water with 0.5 to 1.6 ppm, and most of the rest used more. How much you drink, and how quickly after it is made, matters as much as the peak figure.",
  },
  {
    question: "Is a higher ppm always better?",
    answer:
      "Not necessarily. A higher peak only helps if the hydrogen is still in the water when you drink it. No study has shown that more is better beyond the ranges trials have used, so a test report that shows concentration over time is more useful than a headline number.",
  },
  {
    question: "Can I check a device myself?",
    answer:
      "Yes. Methylene-blue titration drops sold for hydrogen water give a rough concentration at home, and dissolved-hydrogen meters are more precise. ORP meters and pH strips do not measure hydrogen.",
  },
  {
    question: "Why does this page list Echo's devices?",
    answer:
      "Echo Technologies LLC, which makes Echo hydrogen water devices, funds Hydrogen Studies. We list its devices with the figures Echo states, label them as our funder's, and do not rank them against other brands, because we haven't measured other brands ourselves.",
  },
];
