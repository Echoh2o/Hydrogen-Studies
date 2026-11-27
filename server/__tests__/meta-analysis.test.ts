import { describe, expect, it } from "vitest";
import {
  hedgesG,
  magnitudeLabel,
  normalCdf,
  poolDerSimonianLaird,
  poolRandomEffects,
  tCdf,
  tQuantile,
  toSd,
} from "../../shared/meta-analysis";

// metafor::dat.bcg (Colditz et al. 1994): tpos, tneg, cpos, cneg
const BCG: [number, number, number, number][] = [
  [4, 119, 11, 128],
  [6, 300, 29, 274],
  [3, 228, 11, 209],
  [62, 13536, 248, 12619],
  [33, 5036, 47, 5761],
  [180, 1361, 372, 1079],
  [8, 2537, 10, 619],
  [505, 87886, 499, 87892],
  [29, 7470, 45, 7232],
  [17, 1699, 65, 1600],
  [186, 50448, 141, 27197],
  [5, 2493, 3, 2338],
  [27, 16886, 29, 17825],
];
const yi = BCG.map(([a, b, c, d]) => Math.log(a / (a + b) / (c / (c + d))));
const vi = BCG.map(([a, b, c, d]) => 1 / a - 1 / (a + b) + 1 / c - 1 / (c + d));

describe("distributions", () => {
  it("t quantiles match tables", () => {
    expect(tQuantile(0.975, 1)).toBeCloseTo(12.706, 2);
    expect(tQuantile(0.975, 5)).toBeCloseTo(2.5706, 3);
    expect(tQuantile(0.975, 12)).toBeCloseTo(2.1788, 3);
    expect(tQuantile(0.975, 30)).toBeCloseTo(2.0423, 3);
  });
  it("t and normal CDFs are symmetric and sane", () => {
    expect(tCdf(0, 7)).toBeCloseTo(0.5, 10);
    expect(tCdf(2.1788, 12)).toBeCloseTo(0.975, 3);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
  });
});

describe("Hedges' g (Borenstein 2009, worked example ch. 4)", () => {
  const h2 = { mean: 103, dispersion: 5.5, n: 50 };
  const ctl = { mean: 100, dispersion: 4.5, n: 50 };
  it("matches g = 0.5924, Vg = 0.0412", () => {
    const es = hedgesG(h2, ctl, { higherIsBetter: true });
    expect(es.g).toBeCloseTo(0.5924, 3);
    expect(es.v).toBeCloseTo(0.0412, 3);
  });
  it("flips sign when lower is better", () => {
    const es = hedgesG(h2, ctl, { higherIsBetter: false });
    expect(es.g).toBeCloseTo(-0.5924, 3);
  });
  it("converts SE and CI to SD", () => {
    expect(toSd({ mean: 0, dispersion: 2, n: 100 }, "SE")).toBeCloseTo(20, 10);
    // n ≥ 60: z-based. width 3.92 → SD = √n
    expect(toSd({ mean: 0, dispersion: [-1.959964, 1.959964], n: 64 }, "CI95")).toBeCloseTo(8, 4);
  });
});

describe("random-effects pooling vs metafor dat.bcg (method='DL')", () => {
  it("DL matches metafor: est −0.7141, se 0.1787, τ² 0.3088, Q 152.23, I² 92.12%", () => {
    const r = poolDerSimonianLaird(yi, vi);
    expect(r.estimate).toBeCloseTo(-0.7141, 3);
    expect(r.se).toBeCloseTo(0.1787, 3);
    expect(r.tau2).toBeCloseTo(0.3088, 3);
    expect(r.q).toBeCloseTo(152.233, 2);
    expect(r.i2).toBeCloseTo(92.12, 1);
  });
  it("HKSJ keeps the DL estimate and rescales its SE by the weighted residual mean square", () => {
    const dl = poolDerSimonianLaird(yi, vi);
    const r = poolRandomEffects(yi, vi);
    expect(r.estimate).toBeCloseTo(dl.estimate, 10);
    const ws = vi.map((v) => 1 / (v + dl.tau2));
    const qStar = ws.reduce((a, w, i) => a + w * (yi[i] - dl.estimate) ** 2, 0) / (yi.length - 1);
    expect(r.se).toBeCloseTo(dl.se * Math.sqrt(qStar), 10);
    expect(r.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 8);
    expect(r.piLow!).toBeLessThan(r.ciLow);
    expect(r.piHigh!).toBeGreaterThan(r.ciHigh);
  });
  it("homogeneous studies → τ² = 0, I² = 0", () => {
    const r = poolRandomEffects([0.3, 0.3, 0.3], [0.05, 0.08, 0.1]);
    expect(r.tau2).toBe(0);
    expect(r.i2).toBe(0);
    expect(r.estimate).toBeCloseTo(0.3, 10);
  });
  it("rejects k < 2", () => {
    expect(() => poolRandomEffects([0.1], [0.1])).toThrow();
  });
});

describe("magnitudeLabel", () => {
  it("uses Cohen's cut-offs on |g|", () => {
    expect(magnitudeLabel(0.1)).toBe("negligible");
    expect(magnitudeLabel(-0.3)).toBe("small");
    expect(magnitudeLabel(0.6)).toBe("moderate");
    expect(magnitudeLabel(1.2)).toBe("large");
  });
});
