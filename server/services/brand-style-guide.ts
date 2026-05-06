/**
 * Brand style guide for AI-generated hero images.
 *
 * Single source of truth for the visual language so generated images
 * across blogs, studies, and health-benefit pages share a consistent
 * look. Was previously duplicated across three prompt construction
 * sites in image-generator.ts, drifting independently each time someone
 * tweaked one.
 *
 * Phase C visual depth — the plan called this out explicitly:
 *   "One brand style guide JSON, used for every blog hero."
 *
 * Editing this file changes the look of every newly-generated image.
 * Existing images aren't regenerated — admins re-roll individually
 * via the editor when they want to refresh.
 */

export const BRAND_STYLE_GUIDE = {
  /** Editorial palette — soft, scientific, calm. Avoid neon/saturated. */
  colors: {
    primary: "soft teal",
    secondary: "muted sage green",
    accent: "warm sand",
    background: "off-white with subtle gradient",
  },

  /** Mood + tone words that modify the image without being too on-the-nose. */
  mood: [
    "calm",
    "research-grade",
    "trustworthy",
    "modern editorial",
    "approachable but credible",
  ],

  /** Composition rules. */
  composition: {
    aspectRatio: "16:9",
    lighting: "soft natural light, gentle highlights, no harsh shadows",
    depth: "shallow depth of field with a clear focal point",
    framing: "rule-of-thirds, balanced negative space",
  },

  /** Style references — anchor the model away from generic AI mush. */
  styleReferences: [
    "modern health magazine cover",
    "scientific journal feature illustration",
    "subtle minimalist medical photography",
  ],

  /** Hard constraints — what the image must NOT contain. */
  exclude: [
    "no text, captions, labels, or watermarks",
    "no logos or brand marks",
    "no human faces in close-up unless contextually essential",
    "no fake-looking molecular diagrams or hand-drawn scientific notation",
    "no generic stock-photo aesthetics (handshakes, doctors with clipboards, etc.)",
    "no glowing 3D molecules — they always look fake",
  ],
} as const;

/**
 * Compose the brand style guide into a string suffix that gets
 * appended to every generation prompt. Kept terse so the AI doesn't
 * exhaust its attention on style instructions vs. subject matter.
 */
export function brandStylePromptSuffix(): string {
  const styles = BRAND_STYLE_GUIDE.styleReferences.join(", ");
  const moodWords = BRAND_STYLE_GUIDE.mood.join(", ");
  const exclude = BRAND_STYLE_GUIDE.exclude.join("; ");

  return [
    `Style: ${styles}.`,
    `Palette: ${BRAND_STYLE_GUIDE.colors.primary} primary with ${BRAND_STYLE_GUIDE.colors.secondary} accents on a ${BRAND_STYLE_GUIDE.colors.background} background.`,
    `Mood: ${moodWords}.`,
    `Composition: ${BRAND_STYLE_GUIDE.composition.aspectRatio}, ${BRAND_STYLE_GUIDE.composition.lighting}, ${BRAND_STYLE_GUIDE.composition.depth}.`,
    `Avoid: ${exclude}.`,
  ].join(" ");
}
