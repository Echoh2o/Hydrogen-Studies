/**
 * PLAN 4.7 follow-up — one OpenAlex identity per author-name key, only when
 * the evidence is unambiguous.
 */
import { describe, it, expect } from "vitest";
import { decideIdentities, normalizeOrcid, type AuthorshipOccurrence } from "../../shared/author-identity";

const occ = (authorKey: string, id: string | null, extra: Partial<AuthorshipOccurrence> = {}): AuthorshipOccurrence => ({
  authorKey, rawName: authorKey, openalexAuthorId: id, displayName: id ? `Name ${id}` : null, orcid: null, institution: null, institutionCountry: null, institutionRor: null, ...extra,
});

describe("decideIdentities", () => {
  it("resolves a key when one author id carries most occurrences, taking the modal ORCID and institution", () => {
    const rows = [
      occ("xuejun sun", "A1", { orcid: "https://orcid.org/0000-0001-2345-6789", institution: "Naval Medical University", institutionCountry: "CN" }),
      occ("xuejun sun", "A1", { orcid: "0000-0001-2345-6789", institution: "Naval Medical University", institutionCountry: "CN" }),
      occ("xuejun sun", "A1", { institution: "Second Military Medical University", institutionCountry: "CN" }),
      occ("xuejun sun", "A9"),
    ];
    const [id] = decideIdentities(rows);
    expect(id).toMatchObject({ authorKey: "xuejun sun", openalexAuthorId: "A1", orcid: "0000-0001-2345-6789", institution: "Naval Medical University", institutionCountry: "CN", occurrences: 3, share: 0.75 });
  });

  it("gives nothing to a shared name split across authors, or to a single occurrence", () => {
    expect(decideIdentities([occ("yang yu", "A1"), occ("yang yu", "A2"), occ("yang yu", "A3"), occ("yang yu", "A1")])).toEqual([]); // 2/4 = 50% < 60%
    expect(decideIdentities([occ("solo author", "A1")])).toEqual([]);
    expect(decideIdentities([occ("no id", null), occ("no id", null)])).toEqual([]);
  });

  it("counts occurrences without an author id against the share", () => {
    const rows = [occ("k", "A1"), occ("k", "A1"), occ("k", null), occ("k", null), occ("k", null)];
    expect(decideIdentities(rows)).toEqual([]); // 2/5 = 40%
  });

  it("normalizes ORCIDs", () => {
    expect(normalizeOrcid("https://orcid.org/0000-0002-0758-1907")).toBe("0000-0002-0758-1907");
    expect(normalizeOrcid("0000-0002-0758-190X")).toBe("0000-0002-0758-190X");
    expect(normalizeOrcid("n/a")).toBeNull();
  });
});
