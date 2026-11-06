/**
 * Inhaled-gas dose (migration 034). The one quantity that compares honestly
 * with a flow-rated device such as the Echo Refresh is the H2 flow in mL/min:
 * stated by the authors, or computed from a stated H2 percentage and a stated
 * total gas flow. A percentage alone (closed mask, gas mixed into room air) is
 * not comparable and gives no flow. Hyperbaric or diving studies never match.
 */
export interface GasDose {
  h2_flow_ml_min: number | null;
  h2_flow_kind: "stated" | "computed" | null;
  h2_gas_percent: number | null;
  gas_total_flow_l_min: number | null;
  h2_gas_raw: string | null;
  hyperbaric: boolean;
}

const HYPERBARIC = /(saturation div|hydreliox|hyperbaric chamber|open sea dive|simulated depth|experimental (?:human )?dive|\b\d+(?:\.\d+)?[\s-]*(?:atm|MPa)\b|\b\d+\s*msw\b)/i;
const norm = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null;

/** Validate a model's gas-dose output against the source text. */
export function validateGasDose(raw: any, source: string): GasDose {
  const quote = typeof raw?.h2_gas_raw === "string" && raw.h2_gas_raw.trim() ? raw.h2_gas_raw.trim().slice(0, 300) : null;
  const verbatim = !!quote && norm(source).includes(norm(quote));
  // Diving / pressure-chamber exposures only. A paper that merely mentions
  // "hyperbaric oxygen" as another treatment is not hyperbaric hydrogen.
  const hyperbaric = HYPERBARIC.test(source) || (raw?.hyperbaric === true && HYPERBARIC.test(quote ?? ""));
  const out: GasDose = { h2_flow_ml_min: null, h2_flow_kind: null, h2_gas_percent: null, gas_total_flow_l_min: null, h2_gas_raw: verbatim ? quote : null, hyperbaric };
  // Every number must come from a sentence that is really in the paper.
  if (!verbatim) return out;
  const digits = (n: number) => quote!.replace(/,/g, "").includes(String(n)) || quote!.includes(String(n).replace(/^0\./, "."));
  const pct = num(raw?.h2_gas_percent, 0.0001, 100);
  const total = num(raw?.gas_total_flow_l_min, 0.01, 100);
  const stated = num(raw?.h2_flow_ml_min, 1, 100000);
  out.h2_gas_percent = pct != null && digits(pct) ? pct : null;
  out.gas_total_flow_l_min = total != null && (digits(total) || digits(total * 1000)) ? total : null;
  if (stated != null && (digits(stated) || digits(stated / 1000))) {
    out.h2_flow_ml_min = stated;
    out.h2_flow_kind = "stated";
  } else if (out.h2_gas_percent != null && out.gas_total_flow_l_min != null) {
    out.h2_flow_ml_min = Math.round(out.h2_gas_percent * out.gas_total_flow_l_min * 10); // % × L/min × 1000 / 100
    out.h2_flow_kind = "computed";
  }
  if (out.hyperbaric) { out.h2_flow_ml_min = null; out.h2_flow_kind = null; }
  return out;
}
