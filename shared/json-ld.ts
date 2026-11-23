/**
 * Serialize a value for embedding inside a <script type="application/ld+json">
 * block. JSON.stringify does NOT escape `<` or `/`, so a field containing the
 * literal `</script>` would break out of the block and inject markup. Escaping
 * `<`, `>` and `&` to their \uXXXX forms keeps the payload inert while staying
 * valid JSON.
 *
 * Shared by the Express renderers (re-exported from server/utils/html-safety)
 * and the Next app (web/). Dependency-free.
 */
export function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
