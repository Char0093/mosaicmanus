import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { CLASSROOM, DEMO_LEARNERS, PULSE_QUESTIONS, tierMeta, type Learner } from "../shared/mosaic";

let learners: Learner[] = DEMO_LEARNERS.map((learner) => ({ ...learner }));
let pulseStartedAt: number | null = null;

function cohortSummary() {
  const counts = (Object.keys(tierMeta) as Array<keyof typeof tierMeta>).reduce(
    (result, tier) => ({ ...result, [tier]: learners.filter((learner) => learner.tier === tier).length }),
    {} as Record<keyof typeof tierMeta, number>,
  );
  const massWeightCount = learners.filter((learner) => learner.misconception?.includes("Mass and weight")).length;
  return { counts, massWeightCount };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  mosaic: router({
    dashboard: publicProcedure.query(() => {
      const { counts, massWeightCount } = cohortSummary();
      return {
        classroom: CLASSROOM,
        learners,
        counts,
        pulse: pulseStartedAt ? { active: true, startedAt: pulseStartedAt, questions: PULSE_QUESTIONS } : { active: false, questions: PULSE_QUESTIONS },
        actionCard: {
          title: massWeightCount > 5 ? "Hana’s response needs a reset" : "A concept needs a class-wide reset",
          summary: `${massWeightCount} students are confusing mass with weight in Forces & Motion.`,
          recommendation: "Start with a two-column sort: ‘amount of matter’ and ‘gravity’s pull’. Then ask students to explain one choice to a partner.",
          affected: massWeightCount,
          topic: "Forces & Motion",
        },
      };
    }),
    startPulse: publicProcedure.mutation(() => {
      pulseStartedAt = Date.now();
      return { startedAt: pulseStartedAt, questions: PULSE_QUESTIONS };
    }),
    kiosk: publicProcedure.input(z.object({ code: z.string().trim().min(1) })).query(({ input }) => {
      const valid = input.code.toUpperCase() === CLASSROOM.kioskCode;
      return valid ? { valid: true, classroom: CLASSROOM, learners } : { valid: false, message: "That class code does not match this classroom." };
    }),
    answerQuiz: publicProcedure.input(z.object({
      learnerId: z.string(),
      option: z.string(),
      confidence: z.enum(["guessed", "unsure", "knew"]),
    })).mutation(({ input }) => {
      const correct = input.option === "B";
      const learner = learners.find((item) => item.id === input.learnerId);
      if (!learner) throw new Error("Learner not found");

      if (!correct) {
        learners = learners.map((item) => item.id === input.learnerId
          ? { ...item, tier: "red", mastery: Math.max(28, item.mastery - 13), misconception: "Mass and weight are the same thing", flagged: true, recent: "Just now" }
          : item);
      } else {
        learners = learners.map((item) => item.id === input.learnerId
          ? { ...item, mastery: Math.min(100, item.mastery + 6), recent: "Just now" }
          : item);
      }

      return {
        correct,
        learner: learners.find((item) => item.id === input.learnerId),
        feedback: correct
          ? "Good thinking. Mass is the amount of matter in an object; it stays the same even when gravity changes."
          : "You might be thinking mass and weight are the same thing. Mass is the amount of matter. Weight is the pull of gravity on that matter.",
      };
    }),
    groups: publicProcedure.query(() => {
      return (Object.keys(tierMeta) as Array<keyof typeof tierMeta>).map((tier) => ({
        tier,
        ...tierMeta[tier],
        learners: learners.filter((learner) => learner.tier === tier),
      }));
    }),
    tutor: publicProcedure.input(z.object({ message: z.string().min(1).max(400) })).mutation(({ input }) => {
      const message = input.message.toLowerCase();
      const response = message.includes("weight") || message.includes("mass")
        ? "Try this: imagine taking a backpack to the Moon. Its mass—how much matter is in it—stays the same. Its weight changes because the Moon’s gravity pulls less strongly."
        : "Tell me which part feels confusing. We can sort what stays the same from what changes, one idea at a time.";
      return { response };
    }),
  }),
});

export type AppRouter = typeof appRouter;
