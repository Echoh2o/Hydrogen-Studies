import base from "../tailwind.config";

// Same theme as the SPA. Scan the Next app's own files AND the shared client
// components/pages it renders (content bodies, learn sections, Byline) —
// without client/src, classes used only there (text-4xl, bg-teal-100,
// gradients…) were missing from the Next stylesheet, so SSR'd /learn, /about
// etc. rendered with 16px H1s and no badge colours (found 2026-11-04).
export default {
  ...base,
  content: [
    `${__dirname}/app/**/*.{ts,tsx}`,
    `${__dirname}/components/**/*.{ts,tsx}`,
    `${__dirname}/lib/**/*.{ts,tsx}`,
    `${__dirname}/../client/src/**/*.{ts,tsx}`,
    `${__dirname}/../shared/**/*.ts`,
  ],
};
