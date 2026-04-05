import { describe, it, expect } from "vitest";
import { buildPipelineDigestText, shouldSendDigest, type DigestInput } from "./pipeline-digest";

// ─── Helpers ────────────────────────────────────────────────────

const NOW = new Date("2026-04-05T08:00:00Z");

function makeInput(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    pipelines: [],
    now: NOW,
    ...overrides,
  };
}

function makeHealthy(id: string, name: string) {
  return {
    pipelineId: id,
    pipelineName: name,
    status: "healthy" as const,
    hoursSinceLastRun: 5,
    lastError: null,
  };
}

function makeWarning(id: string, name: string, hours: number) {
  return {
    pipelineId: id,
    pipelineName: name,
    status: "warning" as const,
    hoursSinceLastRun: hours,
    lastError: null,
  };
}

function makeCritical(id: string, name: string, hours: number, error?: string) {
  return {
    pipelineId: id,
    pipelineName: name,
    status: "critical" as const,
    hoursSinceLastRun: hours,
    lastError: error ?? null,
  };
}

// ─── shouldSendDigest ───────────────────────────────────────────

describe("shouldSendDigest", () => {
  it("returns false when all pipelines are healthy", () => {
    const input = makeInput({
      pipelines: [makeHealthy("a", "A"), makeHealthy("b", "B")],
    });
    expect(shouldSendDigest(input)).toBe(false);
  });

  it("returns true when any pipeline is critical", () => {
    const input = makeInput({
      pipelines: [makeHealthy("a", "A"), makeCritical("b", "B", 100)],
    });
    expect(shouldSendDigest(input)).toBe(true);
  });

  it("returns true when any pipeline is warning", () => {
    const input = makeInput({
      pipelines: [makeHealthy("a", "A"), makeWarning("b", "B", 40)],
    });
    expect(shouldSendDigest(input)).toBe(true);
  });

  it("returns false when empty", () => {
    expect(shouldSendDigest(makeInput())).toBe(false);
  });
});

// ─── buildPipelineDigestText ────────────────────────────────────

describe("buildPipelineDigestText", () => {
  it("includes critical pipelines first", () => {
    const input = makeInput({
      pipelines: [
        makeWarning("a", "Pipeline A", 40),
        makeCritical("b", "Pipeline B", 100, "Connection refused"),
      ],
    });

    const { subject, text } = buildPipelineDigestText(input);

    expect(subject).toContain("1 critique");
    expect(text).toContain("CRITIQUE");
    expect(text).toContain("Pipeline B");
    expect(text).toContain("Connection refused");
  });

  it("includes warning pipelines", () => {
    const input = makeInput({
      pipelines: [makeWarning("a", "Pipeline A", 40)],
    });

    const { subject, text } = buildPipelineDigestText(input);

    expect(subject).toContain("1 en retard");
    expect(text).toContain("RETARD");
    expect(text).toContain("Pipeline A");
  });

  it("shows all-healthy message when no issues", () => {
    const input = makeInput({
      pipelines: [makeHealthy("a", "A"), makeHealthy("b", "B")],
    });

    const { subject, text } = buildPipelineDigestText(input);

    expect(subject).toContain("OK");
    expect(text).toContain("2/2");
  });

  it("formats hours correctly", () => {
    const input = makeInput({
      pipelines: [makeCritical("a", "A", 72)],
    });

    const { text } = buildPipelineDigestText(input);

    // 72 hours = 3 days
    expect(text).toContain("3j");
  });

  it("includes date in subject", () => {
    const input = makeInput({
      pipelines: [makeHealthy("a", "A")],
    });

    const { subject } = buildPipelineDigestText(input);

    expect(subject).toContain("05/04");
  });
});
