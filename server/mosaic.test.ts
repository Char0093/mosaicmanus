import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("mosaic classroom contracts", () => {
  it("returns the complete classroom cohort and tier distribution", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.mosaic.dashboard();

    expect(result.classroom.name).toBe("Form 2 Science");
    expect(result.learners).toHaveLength(20);
    expect(result.counts.green).toBe(5);
    expect(result.counts.blue).toBe(4);
    expect(result.counts.red + result.counts.yellow).toBe(11);
  });

  it("keeps kiosk access public while rejecting invalid class codes", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const valid = await caller.mosaic.kiosk({ code: "MOSAIC01" });
    const invalid = await caller.mosaic.kiosk({ code: "WRONG00" });

    expect(valid.valid).toBe(true);
    if (valid.valid) expect(valid.learners).toHaveLength(20);
    expect(invalid).toEqual({ valid: false, message: "That class code does not match this classroom." });
  });
});
