import { describe, it, expect } from "vitest";
import {
  normalizeForChange,
  textReallyChanged,
  diffAmendmentRow,
  type AmendmentComparable,
} from "@/services/sync/amendments-an/change-detection";

const base = (over: Partial<AmendmentComparable> = {}): AmendmentComparable => ({
  number: "1",
  texteRef: null,
  article: null,
  content: null,
  summary: null,
  status: "DEPOSE",
  authorType: null,
  authorName: null,
  legislature: 17,
  chamber: "AN",
  dossierId: null,
  ...over,
});

describe("normalizeForChange / textReallyChanged", () => {
  it("treats identical text as unchanged", () => {
    expect(textReallyChanged("Article L. 2312-59", "Article L. 2312-59")).toBe(false);
  });

  it("treats NFC vs NFD accents as unchanged (re-encoding is not a real change)", () => {
    const nfc = "modalités"; // é precomposed
    const nfd = "modalités"; // e + combining acute
    expect(nfc).not.toBe(nfd); // raw strings differ
    expect(textReallyChanged(nfc, nfd)).toBe(false); // but not a real change
  });

  it("treats whitespace-only differences as unchanged", () => {
    expect(textReallyChanged("le  texte\n  officiel", "le texte officiel")).toBe(false);
  });

  it("treats null vs null as unchanged", () => {
    expect(textReallyChanged(null, null)).toBe(false);
    expect(normalizeForChange(null)).toBeNull();
  });

  it("flags null -> non-null and non-null -> null as changed", () => {
    expect(textReallyChanged(null, "x")).toBe(true);
    expect(textReallyChanged("x", null)).toBe(true);
  });

  it("flags a genuine content change", () => {
    const before = "droit d'alerte specifique lorsque la situation";
    const after =
      "droit d'alerte specifique, nonobstant l'article L. 2312-59, lorsque la situation";
    expect(textReallyChanged(before, after)).toBe(true);
  });
});

describe("diffAmendmentRow", () => {
  it("identical row -> no content change, no metadata change, empty data", () => {
    const existing = base({ content: "le dispositif", summary: "l'expose", status: "ADOPTE" });
    const incoming = base({ content: "le dispositif", summary: "l'expose", status: "ADOPTE" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.contentChanged).toBe(false);
    expect(diff.summaryChanged).toBe(false);
    expect(diff.substanceChanged).toBe(false);
    expect(diff.metadataChanged).toBe(false);
    expect(diff.data).toEqual({});
  });

  it("metadata change without substance change -> metadata only, no substance signal", () => {
    const existing = base({ content: "le dispositif", summary: "l'expose", status: "DEPOSE" });
    const incoming = base({ content: "le dispositif", summary: "l'expose", status: "ADOPTE" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.contentChanged).toBe(false);
    expect(diff.summaryChanged).toBe(false);
    expect(diff.substanceChanged).toBe(false);
    expect(diff.metadataChanged).toBe(true);
    expect(diff.data).toEqual({ status: "ADOPTE" });
  });

  it("real content change (summary unchanged) -> contentChanged + substanceChanged", () => {
    const existing = base({ content: "ancien dispositif", summary: "expose stable" });
    const incoming = base({ content: "nouveau dispositif complete", summary: "expose stable" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.contentChanged).toBe(true);
    expect(diff.summaryChanged).toBe(false);
    expect(diff.substanceChanged).toBe(true);
    expect(diff.data.content).toBe("nouveau dispositif complete");
    expect(diff.data.summary).toBeUndefined();
  });

  it("content null -> non-null counts as a content change", () => {
    const existing = base({ content: null });
    const incoming = base({ content: "le dispositif" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.contentChanged).toBe(true);
    expect(diff.data.content).toBe("le dispositif");
  });

  it("content non-null -> null counts as a content change", () => {
    const existing = base({ content: "le dispositif" });
    const incoming = base({ content: null });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.contentChanged).toBe(true);
    expect(diff.data.content).toBeNull();
  });

  it("NFC-only re-encoding of content is NOT flagged as a change", () => {
    const existing = base({ content: "modalités de calcul" });
    const incoming = base({ content: "modalités de calcul" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.contentChanged).toBe(false);
    expect(diff.substanceChanged).toBe(false);
    expect(diff.data).toEqual({});
  });

  it("never nulls an existing dossier link from an unresolved run", () => {
    const existing = base({ dossierId: "dossier_abc" });
    const incoming = base({ dossierId: null }); // this run failed to resolve the dossier
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.metadataChanged).toBe(false);
    expect(diff.data).toEqual({});
  });

  it("adopts a newly resolved dossier link", () => {
    const existing = base({ dossierId: null });
    const incoming = base({ dossierId: "dossier_abc" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.metadataChanged).toBe(true);
    expect(diff.data).toEqual({ dossierId: "dossier_abc" });
  });
});

describe("diffAmendmentRow - summary as substance", () => {
  it("summary identical with whitespace-only difference -> no change", () => {
    const existing = base({ summary: "expose  des  motifs\n  detailles" });
    const incoming = base({ summary: "expose des motifs detailles" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.summaryChanged).toBe(false);
    expect(diff.substanceChanged).toBe(false);
    expect(diff.data).toEqual({});
  });

  it("summary null -> non-null -> summaryChanged + substanceChanged", () => {
    const existing = base({ summary: null });
    const incoming = base({ summary: "nouvel expose" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.summaryChanged).toBe(true);
    expect(diff.substanceChanged).toBe(true);
    expect(diff.contentChanged).toBe(false);
    expect(diff.data.summary).toBe("nouvel expose");
  });

  it("summary non-null -> null -> summaryChanged + substanceChanged", () => {
    const existing = base({ summary: "ancien expose" });
    const incoming = base({ summary: null });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.summaryChanged).toBe(true);
    expect(diff.substanceChanged).toBe(true);
    expect(diff.data.summary).toBeNull();
  });

  it("content unchanged but summary changed -> substance signal", () => {
    const existing = base({ content: "dispositif stable", summary: "ancien expose" });
    const incoming = base({ content: "dispositif stable", summary: "expose reecrit" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.contentChanged).toBe(false);
    expect(diff.summaryChanged).toBe(true);
    expect(diff.substanceChanged).toBe(true);
    expect(diff.data).toEqual({ summary: "expose reecrit" });
  });

  it("content and summary both changed -> one substance change, both in data", () => {
    const existing = base({ content: "ancien dispositif", summary: "ancien expose" });
    const incoming = base({ content: "nouveau dispositif", summary: "nouvel expose" });
    const diff = diffAmendmentRow(existing, incoming);
    expect(diff.contentChanged).toBe(true);
    expect(diff.summaryChanged).toBe(true);
    expect(diff.substanceChanged).toBe(true); // single boolean, not double-counted
    expect(diff.data).toEqual({ content: "nouveau dispositif", summary: "nouvel expose" });
  });
});
