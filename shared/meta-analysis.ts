/**
 * Meta-analysis engine for the living systematic reviews (PLAN 6.1).
 *
 * Pure functions, no I/O. Methods follow the Cochrane Handbook (v6.4) and
 * Borenstein et al., "Introduction to Meta-Analysis" (2009):
 *
 * - Effect size: standardized mean difference with Hedges' small-sample
 *   correction (g). Sign is oriented so a POSITIVE g always favours hydrogen,
 *   whatever the outcome's direction (lower lactate = better, higher power =
 *   better).
 * - Dispersion: SD is used as reported. SE → SD (SD = SE·√n) and 95% CI → SD
 *   (Handbook 6.5.2.2, t-based for n < 60) are converted here, never in the
 *   extraction data, so the raw reported numbers stay auditable.
 * - Crossover trials are analysed as if parallel (Handbook 23.2.6). That
 *   ignores the within-person correlation and so overstates the variance:
 *   conservative, and the methods section says so.
 * - Pooling: random-effects, DerSimonian–Laird τ², with the
 *   Hartung–Knapp–Sidik–Jonkman (HKSJ) confidence interval, which keeps
 *   nominal coverage when k is small (IntHout et al. 2014). A 95% prediction
 *   interval (t, k−2 df) is reported when k ≥ 3.
 *
 * Verified against metafor's dat.bcg DerSimonian–Laird results and Borenstein's
 * worked SMD example in server/__tests__/meta-analysis.test.ts.
 */

export type DispersionType = "SD" | "SE" | "CI95";

export interface ArmSummary {
  mean: number;
  /** SD, SE, or the full CI width depending on dispersionType (CI95: [lower, upper]) */
  dispersion: number | [number, number];
  n: number;
}

export interface EffectSize {
  /** Hedges' g, positive = favours hydrogen */
  g: number;
  /** variance of g */
  v: number;
  se: number;
  ciLow: number;
  ciHigh: number;
}

// ---------- distributions ----------

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf, |err| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2));
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

function logGamma(x: number): number {
  // Lanczos approximation (g = 7, n = 9)
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularized incomplete beta I_x(a, b), continued fraction (Numerical Recipes 6.4). */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx: number, aa: number, bb: number) => {
    const EPS = 1e-14;
    const FPMIN = 1e-300;
    let c = 1;
    let d = 1 - ((aa + bb) * xx) / (aa + 1);
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let num = (m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2));
      d = 1 + num * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + num / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;
      num = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1));
      d = 1 + num * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + num / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}

/** Student t CDF with df degrees of freedom. */
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Inverse CDF by bisection: returns q with cdf(q) = p. */
function invert(cdf: (q: number) => number, p: number): number {
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const tQuantile = (p: number, df: number) => invert((q) => tCdf(q, df), p);
export const normalQuantile = (p: number) => invert(normalCdf, p);

// ---------- effect sizes ----------

/** Convert a reported dispersion to an SD (Cochrane Handbook 6.5.2). */
export function toSd(arm: ArmSummary, type: DispersionType): number {
  if (type === "SD") return arm.dispersion as number;
  if (type === "SE") return (arm.dispersion as number) * Math.sqrt(arm.n);
  const [lo, hi] = arm.dispersion as [number, number];
  const crit = arm.n < 60 ? tQuantile(0.975, arm.n - 1) : 1.959964;
  return (Math.sqrt(arm.n) * (hi - lo)) / (2 * crit);
}

/**
 * Hedges' g for H2 vs control, oriented so positive favours hydrogen.
 * higherIsBetter=false flips the sign (e.g. lactate, RPE, CK, soreness).
 */
export function hedgesG(
  h2: ArmSummary,
  control: ArmSummary,
  opts: { higherIsBetter: boolean; dispersionType?: DispersionType },
): EffectSize {
  const type = opts.dispersionType ?? "SD";
  const s1 = toSd(h2, type);
  const s2 = toSd(control, type);
  const n1 = h2.n;
  const n2 = control.n;
  const df = n1 + n2 - 2;
  const sPooled = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / df);
  if (!(sPooled > 0)) throw new Error("pooled SD must be > 0");
  const d = ((h2.mean - control.mean) / sPooled) * (opts.higherIsBetter ? 1 : -1);
  const vd = (n1 + n2) / (n1 * n2) + (d * d) / (2 * (n1 + n2));
  const j = 1 - 3 / (4 * df - 1);
  const g = j * d;
  const v = j * j * vd;
  const se = Math.sqrt(v);
  return { g, v, se, ciLow: g - 1.959964 * se, ciHigh: g + 1.959964 * se };
}

// ---------- pooling ----------

export interface PooledResult {
  k: number;
  estimate: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  /** two-sided p for the pooled estimate (HKSJ t-test, k−1 df) */
  p: number;
  tau2: number;
  q: number;
  /** I² in percent */
  i2: number;
  /** 95% prediction interval, null when k < 3 */
  piLow: number | null;
  piHigh: number | null;
  /** random-effects weights, in percent, same order as input */
  weights: number[];
  method: "DL+HKSJ";
}

/** DerSimonian–Laird random-effects with HKSJ CI. yi = effects, vi = variances. */
export function poolRandomEffects(yi: number[], vi: number[]): PooledResult {
  const k = yi.length;
  if (k < 2) throw new Error("need at least 2 studies to pool");
  if (vi.length !== k) throw new Error("yi and vi length mismatch");
  const w = vi.map((v) => 1 / v);
  const sw = w.reduce((a, b) => a + b, 0);
  const fixed = w.reduce((a, wi, i) => a + wi * yi[i], 0) / sw;
  const q = w.reduce((a, wi, i) => a + wi * (yi[i] - fixed) ** 2, 0);
  const c = sw - w.reduce((a, wi) => a + wi * wi, 0) / sw;
  const tau2 = Math.max(0, (q - (k - 1)) / c);
  const i2 = q > 0 ? Math.max(0, ((q - (k - 1)) / q) * 100) : 0;

  const ws = vi.map((v) => 1 / (v + tau2));
  const sws = ws.reduce((a, b) => a + b, 0);
  const estimate = ws.reduce((a, wi, i) => a + wi * yi[i], 0) / sws;

  // HKSJ: scale the variance by the weighted residual mean square, t with k−1 df.
  const qStar = ws.reduce((a, wi, i) => a + wi * (yi[i] - estimate) ** 2, 0) / (k - 1);
  const se = Math.sqrt(qStar / sws);
  const tCrit = tQuantile(0.975, k - 1);
  const tStat = estimate / se;
  const p = 2 * (1 - tCdf(Math.abs(tStat), k - 1));

  let piLow: number | null = null;
  let piHigh: number | null = null;
  if (k >= 3) {
    const tPi = tQuantile(0.975, k - 2);
    const half = tPi * Math.sqrt(tau2 + se * se);
    piLow = estimate - half;
    piHigh = estimate + half;
  }

  return {
    k,
    estimate,
    se,
    ciLow: estimate - tCrit * se,
    ciHigh: estimate + tCrit * se,
    p,
    tau2,
    q,
    i2,
    piLow,
    piHigh,
    weights: ws.map((wi) => (wi / sws) * 100),
    method: "DL+HKSJ",
  };
}

/** Plain DL (Wald z CI) — exposed for the reference test against metafor. */
export function poolDerSimonianLaird(yi: number[], vi: number[]) {
  const k = yi.length;
  const w = vi.map((v) => 1 / v);
  const sw = w.reduce((a, b) => a + b, 0);
  const fixed = w.reduce((a, wi, i) => a + wi * yi[i], 0) / sw;
  const q = w.reduce((a, wi, i) => a + wi * (yi[i] - fixed) ** 2, 0);
  const c = sw - w.reduce((a, wi) => a + wi * wi, 0) / sw;
  const tau2 = Math.max(0, (q - (k - 1)) / c);
  const ws = vi.map((v) => 1 / (v + tau2));
  const sws = ws.reduce((a, b) => a + b, 0);
  const estimate = ws.reduce((a, wi, i) => a + wi * yi[i], 0) / sws;
  return { estimate, se: Math.sqrt(1 / sws), tau2, q, i2: Math.max(0, ((q - (k - 1)) / q) * 100) };
}

/** Conventional SMD magnitude label (Cohen): used in plain-language copy only. */
export function magnitudeLabel(g: number): "negligible" | "small" | "moderate" | "large" {
  const a = Math.abs(g);
  if (a < 0.2) return "negligible";
  if (a < 0.5) return "small";
  if (a < 0.8) return "moderate";
  return "large";
}
