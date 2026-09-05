import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getClassroomByKioskCode, getDemoClassroom, persistAnswer } from "./mosaicDb";
import { CLASSROOM, DEMO_LEARNERS, PULSE_QUESTIONS, tierMeta, type Learner } from "../shared/mosaic";

let fallbackLearners: Learner[] = DEMO_LEARNERS.map((learner) => ({ ...learner }));
let pulseStartedAt: number | null = null;

function cohortSummary(currentLearners: Learner[]) {
  const counts = (Object.keys(tierMeta) as Array<keyof typeof tierMeta>).reduce(
    (result, tier) => ({ ...result, [tier]: currentLearners.filter((learner) => learner.tier === tier).length }),
    {} as Record<keyof typeof tierMeta, number>,
  );
  const massWeightCount = currentLearners.filter((learner) => learner.misconception?.includes("Mass and weight")).length;
  return { counts, massWeightCount };
}

function classroomForFrontend(row?: { slug: string; name: string; subject: string; kioskCode: string; topics: string } | null) {
  if (!row) return CLASSROOM;
  let topics = CLASSROOM.topics;
  try {
    const parsed = JSON.parse(row.topics);
    if (Array.isArray(parsed) && parsed.every((topic) => typeof topic === "string")) topics = parsed;
  } catch {
    // Keep the static subject-agnostic fallback if a legacy row has malformed topics.
  }
  return { id: row.slug, name: row.name, subject: row.subject, kioskCode: row.kioskCode, topics };
}

async function readClassroomState() {
  try {
    const state = await getDemoClassroom();
    if (state.classroom && state.learners.length) return { classroom: classroomForFrontend(state.classroom), learners: state.learners };
  } catch (error) {
    console.warn("[Mosaic] Database read failed; using fallback demo state.", error);
  }
  return { classroom: CLASSROOM, learners: fallbackLearners };
}

function deterministicFeedback(correct: boolean) {
  return correct
    ? "Good thinking. Mass is the amount of matter in an object; it stays the same even when gravity changes."
    : "You might be thinking mass and weight are the same thing. Mass is the amount of matter. Weight is the pull of gravity on that matter.";
}

async function generateAdaptiveFeedback(input: { subject: string; topic: string; option: string; correct: boolean; confidence: string }) {
  const fallback = deterministicFeedback(input.correct);
  try {
    const result = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You are an adaptive classroom feedback coach. Return ONLY valid JSON, no markdown fences, no preamble. Never mention or infer a learner name. Keep feedback kind, concrete, and under 55 words. Use the supplied subject and topic; do not assume any other subject.",
        },
        {
          role: "user",
          content: JSON.stringify({
            subject: input.subject,
            topic: input.topic,
            selected_option: input.option,
            is_correct: input.correct,
            confidence: input.confidence,
            task: "Explain the thinking clue and give one actionable next step for this learner.",
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "adaptive_feedback",
          strict: true,
          schema: {
            type: "object",
            properties: { feedback: { type: "string" } },
            required: ["feedback"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content) as { feedback?: unknown };
      if (typeof parsed.feedback === "string" && parsed.feedback.trim()) return parsed.feedback.trim();
    }
  } catch (error) {
    console.warn("[Mosaic AI] Feedback fallback used.", error instanceof Error ? error.message : error);
  }
  return fallback;
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
    dashboard: publicProcedure.query(async () => {
      const state = await readClassroomState();
      const { counts, massWeightCount } = cohortSummary(state.learners);
      return {
        classroom: state.classroom,
        learners: state.learners,
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
    kiosk: publicProcedure.input(z.object({ code: z.string().trim().min(1) })).query(async ({ input }) => {
      const state = input.code.toUpperCase() === CLASSROOM.kioskCode ? await getClassroomByKioskCode(CLASSROOM.kioskCode) : null;
      const current = state ?? (input.code.toUpperCase() === CLASSROOM.kioskCode ? { classroom: CLASSROOM, learners: fallbackLearners } : null);
      return current ? { valid: true, classroom: "slug" in current.classroom ? classroomForFrontend(current.classroom) : current.classroom, learners: current.learners } : { valid: false, message: "That class code does not match this classroom." };
    }),
    syncOffline: publicProcedure.input(z.object({
      answers: z.array(z.object({ learnerId: z.string(), option: z.string(), confidence: z.enum(["guessed", "unsure", "knew"]) })),
    })).mutation(async ({ input }) => {
      let synced = 0;
      for (const answer of input.answers) {
        const correct = answer.option === "B";
        const feedback = deterministicFeedback(correct);
        const persisted = await persistAnswer({ learnerId: answer.learnerId, option: answer.option, correct, confidence: answer.confidence, feedback, questionId: PULSE_QUESTIONS[0].id });
        if (persisted) synced += 1;
      }
      return { synced };
    }),
    answerQuiz: publicProcedure.input(z.object({
      learnerId: z.string(),
      option: z.string(),
      confidence: z.enum(["guessed", "unsure", "knew"]),
    })).mutation(async ({ input }) => {
      const correct = input.option === "B";
      const state = await readClassroomState();
      const feedback = await Promise.race([
        generateAdaptiveFeedback({ subject: state.classroom.subject, topic: "Forces & Motion", option: input.option, correct, confidence: input.confidence }),
        new Promise<string>((resolve) => setTimeout(() => resolve(deterministicFeedback(correct)), 7000)),
      ]);
      const persisted = await persistAnswer({ learnerId: input.learnerId, option: input.option, correct, confidence: input.confidence, feedback, questionId: PULSE_QUESTIONS[0].id });
      if (persisted) {
        fallbackLearners = fallbackLearners.map((learner) => learner.id === input.learnerId ? persisted : learner);
      } else {
        fallbackLearners = fallbackLearners.map((learner) => learner.id === input.learnerId
          ? { ...learner, tier: correct ? learner.tier : "red", mastery: correct ? Math.min(100, learner.mastery + 6) : Math.max(28, learner.mastery - 13), misconception: correct ? learner.misconception : "Mass and weight are the same thing", flagged: correct ? learner.flagged : true, recent: "Just now" }
          : learner);
      }
      return { correct, learner: persisted ?? fallbackLearners.find((learner) => learner.id === input.learnerId), feedback };
    }),
    groups: publicProcedure.query(async () => {
      const state = await readClassroomState();
      return (Object.keys(tierMeta) as Array<keyof typeof tierMeta>).map((tier) => ({ tier, ...tierMeta[tier], learners: state.learners.filter((learner) => learner.tier === tier) }));
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
