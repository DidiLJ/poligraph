import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { upsertSubscriber } from "../subscribe";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    subscriber: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const findUniqueMock = db.subscriber.findUnique as unknown as Mock;
const createMock = db.subscriber.create as unknown as Mock;
const updateMock = db.subscriber.update as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertSubscriber", () => {
  const baseInput = {
    email: "test@example.com",
    source: "FOOTER" as const,
    consentedAt: new Date("2026-05-06"),
  };

  it("creates a new subscriber when none exists", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({
      id: "id-1",
      email: baseInput.email,
      status: "PENDING_CONFIRMATION",
      confirmationToken: "abc",
    });

    const result = await upsertSubscriber(baseInput);
    expect(result.created).toBe(true);
    expect(result.alreadyConfirmed).toBe(false);
    expect(db.subscriber.create).toHaveBeenCalled();
  });

  it("returns alreadyConfirmed when subscriber is CONFIRMED", async () => {
    findUniqueMock.mockResolvedValue({
      id: "id-1",
      email: baseInput.email,
      status: "CONFIRMED",
    });

    const result = await upsertSubscriber(baseInput);
    expect(result.created).toBe(false);
    expect(result.alreadyConfirmed).toBe(true);
    expect(db.subscriber.create).not.toHaveBeenCalled();
    expect(db.subscriber.update).not.toHaveBeenCalled();
  });

  it("reactivates UNSUBSCRIBED subscriber to PENDING_CONFIRMATION", async () => {
    findUniqueMock.mockResolvedValue({
      id: "id-1",
      email: baseInput.email,
      status: "UNSUBSCRIBED",
    });
    updateMock.mockResolvedValue({
      id: "id-1",
      status: "PENDING_CONFIRMATION",
      confirmationToken: "new-token",
    });

    const result = await upsertSubscriber(baseInput);
    expect(result.created).toBe(false);
    expect(result.reactivated).toBe(true);
    expect(db.subscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING_CONFIRMATION" }),
      })
    );
  });

  it("returns alreadyPending when subscriber is PENDING", async () => {
    findUniqueMock.mockResolvedValue({
      id: "id-1",
      email: baseInput.email,
      status: "PENDING_CONFIRMATION",
      confirmationToken: "existing",
    });

    const result = await upsertSubscriber(baseInput);
    expect(result.created).toBe(false);
    expect(result.alreadyPending).toBe(true);
  });
});
