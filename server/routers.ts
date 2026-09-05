import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  clearLearnerMisconception,
  claimTutorPerk,
  createChapter,
  createClassroom,
  createQuiz,
  createLiveSession,
  getClassroomByKioskCode,
  getDemoClassroom,
  getLearnerProfile,
  getLiveSession,
  getNotifications,
  getPeerTutoringRecognition,
  getStudentAnalytics,
  launchLiveSession,
  overrideLearnerMisconception,
  persistAnswer,
  getTutorPerks,
  getWorkspace,
  markNotificationRead,
  commendPeerTutoringSession,
} from "./mosaicDb";
import { CLASSROOM, DEMO_LEARNERS, PULSE_QUESTIONS, tierMeta, type Learner } from "../shared/mosaic";

let fallbackLearners: Learner[] = DEMO_LEARNERS.map((learner) => ({ ...learner }));
let pulseStartedAt: number | null = null;

function cohortSummary(currentLearners: Learner[]) {
  const counts = (Object.keys(tierMeta) as Array<keyof typeof tierMeta>).reduce((result, tier) => ({ ...result, [tier]: currentLearners.filter((learner) => learner.tier === tier).length }), {} as Record<keyof typeof tierMeta, number>);
  const massWeightCount = currentLearners.filter((learner) => learner.misconception?.includes("Mass and weight")).length;
  const confidentErrors = currentLearners.reduce((sum, learner) => sum + (learner.confidentWrongCount ?? 0), 0);
  const confusedAttempts = currentLearners.reduce((sum, learner) => sum + (learner.confusedWrongCount ?? 0), 0);
  return { counts, massWeightCount, confidentErrors, confusedAttempts };
}

function classroomForFrontend(row?: { slug: string; name: string; subject: string; kioskCode: string; topics: string } | null) {
  if (!row) return CLASSROOM;
  let topics = CLASSROOM.topics;
  try { const parsed = JSON.parse(row.topics); if (Array.isArray(parsed) && parsed.every((topic) => typeof topic === "string")) topics = parsed; } catch { /* fallback */ }
  return { id: row.slug, name: row.name, subject: row.subject, kioskCode: row.kioskCode, topics };
}

async function readClassroomState() {
  try {
    const state = await getDemoClassroom();
    if (state.classroom && state.learners.length) return { classroom: classroomForFrontend(state.classroom), learners: state.learners };
  } catch (error) { console.warn("[Mosaic] Database read failed; using fallback demo state.", error); }
  return { classroom: CLASSROOM, learners: fallbackLearners };
}

function deterministicFeedback(correct: boolean) {
  return correct ? "Good thinking. Mass is the amount of matter in an object; it stays the same even when gravity changes." : "You might be thinking mass and weight are the same thing. Mass is the amount of matter. Weight is the pull of gravity on that matter.";
}

function classifyAnswer(option: string, correct: boolean) {
  if (correct) return { reasoning: "The selected option matches the answer key and shows the core distinction between mass and weight.", classifierConfidence: "high" as const };
  return { reasoning: `The selected option ${option} is the distractor pattern for confusing mass with weight: the learner is treating a push/pull or gravity effect as the amount of matter.`, classifierConfidence: option === "A" || option === "C" ? "high" as const : "medium" as const };
}

async function generateAdaptiveFeedback(input: { subject: string; topic: string; option: string; correct: boolean; confidence: string }) {
  const fallback = deterministicFeedback(input.correct);
  try {
    const result = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are an adaptive classroom feedback coach. Return ONLY valid JSON, no markdown fences, no preamble. Never mention or infer a learner name. Keep feedback kind, concrete, and under 55 words." },
        { role: "user", content: JSON.stringify({ subject: input.subject, topic: input.topic, selected_option: input.option, is_correct: input.correct, confidence: input.confidence, task: "Explain the thinking clue and give one actionable next step." }) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "adaptive_feedback", strict: true, schema: { type: "object", properties: { feedback: { type: "string" } }, required: ["feedback"], additionalProperties: false } } },
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") { const parsed = JSON.parse(content) as { feedback?: unknown }; if (typeof parsed.feedback === "string" && parsed.feedback.trim()) return parsed.feedback.trim(); }
  } catch (error) { console.warn("[Mosaic AI] Feedback fallback used.", error instanceof Error ? error.message : error); }
  return fallback;
}

function fuzzyLearner(name: string, learners: Learner[]) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return learners.find((learner) => learner.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized)
    ?? learners.find((learner) => learner.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(learner.name.toLowerCase()))
    ?? null;
}

const scanInput = z.object({ imageBase64: z.string().min(20), imageType: z.enum(["jpeg", "png", "webp"]), questionLabels: z.array(z.string()).length(3), correctAnswers: z.record(z.string(), z.enum(["A", "B", "C", "D"])), questionTexts: z.array(z.string()).length(3) });
const scanResult = z.object({ student_name: z.string(), answers: z.record(z.string(), z.union([z.enum(["A", "B", "C", "D"]), z.null()])) });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  mosaic: router({
    dashboard: publicProcedure.query(async () => {
      const state = await readClassroomState();
      const { counts, massWeightCount, confidentErrors, confusedAttempts } = cohortSummary(state.learners);
      return { classroom: state.classroom, learners: state.learners, counts, confidenceSignals: { confidentErrors, confusedAttempts }, pulse: pulseStartedAt ? { active: true, startedAt: pulseStartedAt, questions: PULSE_QUESTIONS } : { active: false, questions: PULSE_QUESTIONS }, actionCard: { title: massWeightCount > 5 ? "Hana’s response needs a reset" : "A concept needs a class-wide reset", summary: `${massWeightCount} students are confusing mass with weight in Forces & Motion.`, recommendation: confidentErrors > confusedAttempts ? "Use a counterexample: move the same backpack from Earth to the Moon and ask what actually changes." : "Start with a two-column sort: ‘amount of matter’ and ‘gravity’s pull’. Then ask students to explain one choice to a partner.", affected: massWeightCount, topic: "Forces & Motion", interventionType: confidentErrors > confusedAttempts ? "Confrontational correction" : "Scaffolded confidence building" } };
    }),
    studentDashboard: publicProcedure.input(z.object({ learnerId: z.string().default("s6") })).query(async () => {
      const studentId = "s6";
      const profile = await getLearnerProfile(studentId);
      const learner = profile?.learner ?? fallbackLearners.find((item) => item.id === studentId) ?? fallbackLearners[5];
      return { classroom: CLASSROOM, learner, answers: profile?.answers ?? [], masteryMap: CLASSROOM.topics.map((topic, index) => ({ topic, mastery: Math.max(25, Math.min(100, learner.mastery + (index === 0 ? 0 : index === 1 ? 9 : -6))), cleared: Boolean(learner.clearedAt && index === 0) })) };
    }),
    studentAnalytics: publicProcedure.input(z.object({ learnerId: z.string().default("s6") })).query(async () => getStudentAnalytics("s6") ?? { learner: fallbackLearners[5], answers: [], topicData: [], timeline: [], matrix: { knewCorrect: 0, knewWrong: 0, unsureCorrect: 0, unsureWrong: 0 }, strongest: "Forces & Motion", opportunity: "Matter & Properties" }),
    learnerProfile: publicProcedure.input(z.object({ learnerId: z.string() })).query(async ({ input }) => {
      const profile = await getLearnerProfile(input.learnerId);
      return profile ?? { learner: fallbackLearners.find((item) => item.id === input.learnerId) ?? fallbackLearners[0], answers: [] };
    }),
    startPulse: publicProcedure.mutation(() => { pulseStartedAt = Date.now(); return { startedAt: pulseStartedAt, questions: PULSE_QUESTIONS }; }),
    createLiveSession: publicProcedure.mutation(async () => createLiveSession(PULSE_QUESTIONS) ?? { joinCode: "MOS3K7", questions: PULSE_QUESTIONS, launched: false, classroom: { name: CLASSROOM.name, subject: CLASSROOM.subject } }),
    launchLiveSession: publicProcedure.input(z.object({ joinCode: z.string().length(6) })).mutation(async ({ input }) => launchLiveSession(input.joinCode)),
    joinLiveSession: publicProcedure.input(z.object({ joinCode: z.string().length(6), studentName: z.string().min(2).max(120) })).query(async ({ input }) => { const session = await getLiveSession(input.joinCode); return session ? { valid: true, ...session, studentName: input.studentName } : { valid: false, message: "That live session is no longer active." }; }),
    kiosk: publicProcedure.input(z.object({ code: z.string().trim().min(1) })).query(async ({ input }) => { const state = input.code.toUpperCase() === CLASSROOM.kioskCode ? await getClassroomByKioskCode(CLASSROOM.kioskCode) : null; const current = state ?? (input.code.toUpperCase() === CLASSROOM.kioskCode ? { classroom: CLASSROOM, learners: fallbackLearners } : null); return current ? { valid: true, classroom: "slug" in current.classroom ? classroomForFrontend(current.classroom) : current.classroom, learners: current.learners } : { valid: false, message: "That class code does not match this classroom." }; }),
    syncOffline: publicProcedure.input(z.object({ answers: z.array(z.object({ learnerId: z.string(), option: z.string(), confidence: z.enum(["guessed", "unsure", "knew"]) })) })).mutation(async ({ input }) => { let synced = 0; for (const answer of input.answers) { const correct = answer.option === "B"; const classification = classifyAnswer(answer.option, correct); const persisted = await persistAnswer({ learnerId: answer.learnerId, option: answer.option, correct, confidence: answer.confidence, feedback: deterministicFeedback(correct), questionId: PULSE_QUESTIONS[0].id, ...classification }); if (persisted) synced += 1; } return { synced }; }),
    answerQuiz: publicProcedure.input(z.object({ learnerId: z.string(), option: z.string(), confidence: z.enum(["guessed", "unsure", "knew"]) })).mutation(async ({ input }) => { const correct = input.option === "B"; const state = await readClassroomState(); const feedback = await Promise.race([generateAdaptiveFeedback({ subject: state.classroom.subject, topic: "Forces & Motion", option: input.option, correct, confidence: input.confidence }), new Promise<string>((resolve) => setTimeout(() => resolve(deterministicFeedback(correct)), 7000))]); const classification = classifyAnswer(input.option, correct); const persisted = await persistAnswer({ learnerId: input.learnerId, option: input.option, correct, confidence: input.confidence, feedback, questionId: PULSE_QUESTIONS[0].id, ...classification }); if (persisted) fallbackLearners = fallbackLearners.map((learner) => learner.id === input.learnerId ? persisted : learner); else fallbackLearners = fallbackLearners.map((learner) => learner.id === input.learnerId ? { ...learner, tier: correct ? learner.tier : "red", mastery: correct ? Math.min(100, learner.mastery + 6) : Math.max(28, learner.mastery - 13), misconception: correct ? learner.misconception : "Mass and weight are the same thing", flagged: !correct, recent: "Just now" } : learner); return { correct, learner: persisted ?? fallbackLearners.find((learner) => learner.id === input.learnerId), feedback, reasoning: classification.reasoning, classifierConfidence: classification.classifierConfidence }; }),
    teacherOverride: publicProcedure.input(z.object({ learnerId: z.string(), misconception: z.string().min(3) })).mutation(async ({ input }) => overrideLearnerMisconception(input.learnerId, input.misconception)),
    markResolved: publicProcedure.input(z.object({ learnerId: z.string() })).mutation(async ({ input }) => clearLearnerMisconception(input.learnerId)),
    scanPaper: publicProcedure.input(scanInput).mutation(async ({ input }) => {
      try {
        const prompt = `You are an answer sheet reader for Mosaic Classroom. The image shows completed student answer slips. Read each handwritten student name exactly as written and selected answer for ${input.questionLabels.join(", ")}. If unclear, make your best inference. If blank, use null. Return ONLY JSON array with student_name and answers object.`;
        const result = await invokeLLM({ model: "gemini-3-flash-preview", messages: [{ role: "user", content: [{ type: "text", text: `${prompt}\nQuestions: ${input.questionTexts.join(" | ")}` }, { type: "image_url", image_url: { url: `data:image/${input.imageType};base64,${input.imageBase64}`, detail: "high" } }] }], response_format: { type: "json_schema", json_schema: { name: "answer_slips", strict: true, schema: { type: "array", items: { type: "object", properties: { student_name: { type: "string" }, answers: { type: "object", additionalProperties: { type: ["string", "null"] } } }, required: ["student_name", "answers"], additionalProperties: false } } } } });
        const content = result.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? z.array(scanResult).parse(JSON.parse(content)) : [];
        const state = await readClassroomState();
        const results = parsed.map((entry) => { const matched = fuzzyLearner(entry.student_name, state.learners); const misconceptions = Object.entries(entry.answers).filter(([label, option]) => option && option !== input.correctAnswers[label]).map(([label, option]) => ({ label, option, name: "Mass and weight are the same thing" })); return { ...entry, matched_student_id: matched?.id ?? null, misconceptions_detected: misconceptions }; });
        return { results, unmatched_names: results.filter((item) => !item.matched_student_id).map((item) => item.student_name), total_slips_detected: results.length, processed_at: new Date().toISOString() };
      } catch (error) { console.warn("[Mosaic scanner] scan failed", error); return { results: [], unmatched_names: [], total_slips_detected: 0, processed_at: new Date().toISOString(), error: "scan_failed", message: "Could not read the slips clearly. Try better lighting or a steadier image." }; }
    }),
    confirmScan: publicProcedure.input(z.object({ results: z.array(z.object({ matched_student_id: z.string().nullable(), answers: z.record(z.string(), z.union([z.enum(["A", "B", "C", "D"]), z.null()])) })), correctAnswers: z.record(z.string(), z.enum(["A", "B", "C", "D"])) })).mutation(async ({ input }) => { let processed = 0; for (const result of input.results) { if (!result.matched_student_id) continue; for (const [questionId, option] of Object.entries(result.answers)) { if (!option) continue; const correct = option === input.correctAnswers[questionId]; const classification = classifyAnswer(option, correct); await persistAnswer({ learnerId: result.matched_student_id, option, correct, confidence: "unsure", feedback: deterministicFeedback(correct), questionId, ...classification }); } processed += 1; } return { processed }; }),
    peerTutoringRecognition: publicProcedure.query(() => getPeerTutoringRecognition()),
    commendPeerTutoringSession: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => commendPeerTutoringSession(input.id)),
    workspace: publicProcedure.query(async () => getWorkspace()),
    openClassroom: publicProcedure.input(z.object({ name: z.string().min(3).max(160), subject: z.string().min(2).max(120), topics: z.array(z.string().min(2)).min(1).max(12) })).mutation(({ input }) => createClassroom(input)),
    createChapter: publicProcedure.input(z.object({ title: z.string().min(2).max(180), description: z.string().min(5).max(500), published: z.boolean().default(false) })).mutation(({ input }) => createChapter(input)),
    uploadQuiz: publicProcedure.input(z.object({ title: z.string().min(2).max(180), chapterId: z.string().nullable().optional(), sourceFilename: z.string().max(240).optional(), questions: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()).min(2).max(6) })).min(1).max(50), published: z.boolean().default(false) })).mutation(({ input }) => createQuiz(input)),
    notifications: publicProcedure.input(z.object({ audience: z.enum(["educator", "tutor", "student"]), learnerId: z.string().optional() })).query(({ input }) => getNotifications(input.audience, input.learnerId)),
    markNotificationRead: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => markNotificationRead(input.id)),
    tutorPerks: publicProcedure.query(() => getTutorPerks()),
    claimTutorPerk: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => claimTutorPerk(input.id)),
    groups: publicProcedure.query(async () => { const state = await readClassroomState(); return (Object.keys(tierMeta) as Array<keyof typeof tierMeta>).map((tier) => ({ tier, ...tierMeta[tier], learners: state.learners.filter((learner) => learner.tier === tier) })); }),
    tutor: publicProcedure.input(z.object({ message: z.string().min(1).max(400) })).mutation(({ input }) => ({ response: input.message.toLowerCase().includes("weight") || input.message.toLowerCase().includes("mass") ? "Try this: imagine taking a backpack to the Moon. Its mass—how much matter is in it—stays the same. Its weight changes because the Moon’s gravity pulls less strongly." : "Tell me which part feels confusing. We can sort what stays the same from what changes, one idea at a time." })),
  }),
});

export type AppRouter = typeof appRouter;
