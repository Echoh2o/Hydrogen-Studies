import base from "../tailwind.config";

// Same theme as the SPA; scan the Next app's own files.
export default {
  ...base,
  content: [`${__dirname}/app/**/*.{ts,tsx}`, `${__dirname}/components/**/*.{ts,tsx}`],
};
