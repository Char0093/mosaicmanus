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

  it("returns a student dashboard with a three-domain mastery map", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.mosaic.studentDashboard({ learnerId: "s6" });

    expect(result.classroom.name).toBe("Form 2 Science");
    expect(result.learner.name).toBe("Hana Yusof");
    expect(result.masteryMap).toHaveLength(3);
  });

  it("returns the lightweight analytics sections and confidence matrix", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.mosaic.studentAnalytics({ learnerId: "s6" });

    expect(result.topicData).toHaveLength(3);
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.matrix).toHaveProperty("knewWrong");
    expect(result.strongest).toBeTruthy();
    expect(result.opportunity).toBeTruthy();
  });
});
