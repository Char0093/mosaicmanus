import { and, asc, desc, eq } from "drizzle-orm";
import { answers, classrooms, learners, milestones, pulseSessions } from "../drizzle/schema";
import { CLASSROOM, DEMO_LEARNERS, type AnswerInsight, type Learner, type PulseQuestion } from "../shared/mosaic";
import { getDb } from "./db";

type ClassroomRow = typeof classrooms.$inferSelect;
type LearnerRow = typeof learners.$inferSelect;
let seedPromise: Promise<void> | null = null;

function toLearner(row: LearnerRow): Learner {
  return {
    id: row.externalId,
    name: row.name,
    initials: row.initials,
    tier: row.tier,
    mastery: row.mastery,
    misconception: row.misconception ?? undefined,
    flagged: row.flagged,
    confidentWrongCount: row.confidentWrongCount,
    confusedWrongCount: row.confusedWrongCount,
    clearedAt: row.clearedAt?.toISOString() ?? null,
    recent: row.recent,
  };
}

function toAnswer(row: typeof answers.$inferSelect): AnswerInsight {
  return {
    id: row.id,
    questionId: row.questionId,
    option: row.option,
    correct: row.correct,
    confidence: row.confidence,
    feedback: row.feedback,
    reasoning: row.reasoning,
    classifierConfidence: row.classifierConfidence,
    teacherOverrideMisconceptionId: row.teacherOverrideMisconceptionId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function ensureMosaicData() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const db = await getDb();
      if (!db) return;
      const existing = await db.select().from(classrooms).where(eq(classrooms.slug, CLASSROOM.id)).limit(1);
      let classroom = existing[0];
      if (!classroom) {
        await db.insert(classrooms).values({ slug: CLASSROOM.id, name: CLASSROOM.name, subject: CLASSROOM.subject, kioskCode: CLASSROOM.kioskCode, topics: JSON.stringify(CLASSROOM.topics) });
        classroom = (await db.select().from(classrooms).where(eq(classrooms.slug, CLASSROOM.id)).limit(1))[0];
      }
      if (!classroom) return;
      const existingLearners = await db.select().from(learners).where(eq(learners.classroomId, classroom.id)).limit(1);
      if (existingLearners.length === 0) {
        await db.insert(learners).values(DEMO_LEARNERS.map((learner) => ({
          classroomId: classroom!.id,
          externalId: learner.id,
          name: learner.name,
          initials: learner.initials,
          tier: learner.tier,
          mastery: learner.mastery,
          misconception: learner.misconception?.startsWith("Cleared:") ? null : learner.misconception ?? null,
          flagged: learner.flagged ?? false,
          confidentWrongCount: learner.confidentWrongCount ?? 0,
          confusedWrongCount: learner.confusedWrongCount ?? 0,
          clearedAt: learner.clearedAt ? new Date(learner.clearedAt) : null,
          recent: learner.recent,
        })));
      }
    })().catch((error) => { seedPromise = null; console.warn("[Mosaic DB] Demo seed unavailable; continuing with server fallback.", error); });
  }
  await seedPromise;
}

async function getClassroomRow() {
  await ensureMosaicData();
  const db = await getDb();
  if (!db) return { db: null, classroom: null } as const;
  const classroom = (await db.select().from(classrooms).where(eq(classrooms.slug, CLASSROOM.id)).limit(1))[0] ?? null;
  return { db, classroom } as const;
}

export async function getDemoClassroom(): Promise<{ classroom: ClassroomRow | null; learners: Learner[] }> {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return { classroom: null, learners: [] };
  const rows = await db.select().from(learners).where(eq(learners.classroomId, classroom.id)).orderBy(asc(learners.id));
  return { classroom, learners: rows.map(toLearner) };
}

export async function getClassroomByKioskCode(code: string) {
  await ensureMosaicData();
  const db = await getDb();
  if (!db) return null;
  const classroom = (await db.select().from(classrooms).where(eq(classrooms.kioskCode, code)).limit(1))[0] ?? null;
  if (!classroom) return null;
  const rows = await db.select().from(learners).where(eq(learners.classroomId, classroom.id)).orderBy(asc(learners.id));
  return { classroom, learners: rows.map(toLearner) };
}

export async function getLearnerProfile(externalId: string) {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return null;
  const learner = (await db.select().from(learners).where(and(eq(learners.classroomId, classroom.id), eq(learners.externalId, externalId))).limit(1))[0];
  if (!learner) return null;
  const rows = await db.select().from(answers).where(eq(answers.learnerId, learner.id)).orderBy(desc(answers.createdAt)).limit(30);
  return { learner: toLearner(learner), answers: rows.map(toAnswer) };
}

export async function persistAnswer(input: { learnerId: string; option: string; correct: boolean; confidence: "guessed" | "unsure" | "knew"; feedback: string; questionId: string; reasoning?: string; classifierConfidence?: "high" | "medium" | "low" }) {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return null;
  const learner = (await db.select().from(learners).where(and(eq(learners.classroomId, classroom.id), eq(learners.externalId, input.learnerId))).limit(1))[0];
  if (!learner) return null;
  const nextTier = input.correct ? learner.tier : "red";
  const nextMastery = input.correct ? Math.min(100, learner.mastery + 6) : Math.max(28, learner.mastery - 13);
  const confidentWrongCount = !input.correct && input.confidence === "knew" ? learner.confidentWrongCount + 1 : learner.confidentWrongCount;
  const confusedWrongCount = !input.correct && input.confidence !== "knew" ? learner.confusedWrongCount + 1 : learner.confusedWrongCount;
  await db.update(learners).set({ tier: nextTier, mastery: nextMastery, misconception: input.correct ? learner.misconception : "Mass and weight are the same thing", flagged: input.correct ? learner.flagged : true, confidentWrongCount, confusedWrongCount, recent: "Just now" }).where(eq(learners.id, learner.id));
  await db.insert(answers).values({ classroomId: classroom.id, learnerId: learner.id, questionId: input.questionId, option: input.option, correct: input.correct, confidence: input.confidence, feedback: input.feedback, reasoning: input.reasoning ?? null, classifierConfidence: input.classifierConfidence ?? (input.correct ? "high" : "medium"), teacherOverrideMisconceptionId: null });
  const updated = (await db.select().from(learners).where(eq(learners.id, learner.id)).limit(1))[0];
  return updated ? toLearner(updated) : null;
}

export async function overrideLearnerMisconception(externalId: string, misconception: string) {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return null;
  const learner = (await db.select().from(learners).where(and(eq(learners.classroomId, classroom.id), eq(learners.externalId, externalId))).limit(1))[0];
  if (!learner) return null;
  await db.update(learners).set({ misconception, flagged: true, tier: "yellow", recent: "Just now" }).where(eq(learners.id, learner.id));
  const latest = (await db.select().from(answers).where(eq(answers.learnerId, learner.id)).orderBy(desc(answers.createdAt)).limit(1))[0];
  if (latest) await db.update(answers).set({ teacherOverrideMisconceptionId: misconception, reasoning: "Teacher override: the teacher selected this misconception from the subject library." }).where(eq(answers.id, latest.id));
  const updated = (await db.select().from(learners).where(eq(learners.id, learner.id)).limit(1))[0];
  return updated ? toLearner(updated) : null;
}

export async function clearLearnerMisconception(externalId: string) {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return null;
  const learner = (await db.select().from(learners).where(and(eq(learners.classroomId, classroom.id), eq(learners.externalId, externalId))).limit(1))[0];
  if (!learner) return null;
  const now = new Date();
  await db.update(learners).set({ misconception: null, flagged: false, tier: "blue", mastery: Math.max(learner.mastery, 82), clearedAt: now, recent: "Just now" }).where(eq(learners.id, learner.id));
  await db.insert(milestones).values({ classroomId: classroom.id, learnerId: learner.id, misconceptionName: learner.misconception ?? "Forces & Motion misconception", subject: classroom.subject, topic: "Forces & Motion" });
  const updated = (await db.select().from(learners).where(eq(learners.id, learner.id)).limit(1))[0];
  return updated ? toLearner(updated) : null;
}

function makeJoinCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

export async function createLiveSession(questions: PulseQuestion[]) {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return null;
  let joinCode = makeJoinCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const exists = await db.select().from(pulseSessions).where(eq(pulseSessions.joinCode, joinCode)).limit(1);
    if (!exists.length) break;
    joinCode = makeJoinCode();
  }
  await db.insert(pulseSessions).values({ classroomId: classroom.id, joinCode, liveMode: true, launched: false, questions: JSON.stringify(questions) });
  const row = (await db.select().from(pulseSessions).where(eq(pulseSessions.joinCode, joinCode)).limit(1))[0];
  return row ? { joinCode: row.joinCode, questions, launched: row.launched, classroom: { name: classroom.name, subject: classroom.subject } } : null;
}

export async function getLiveSession(joinCode: string) {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(pulseSessions).where(eq(pulseSessions.joinCode, joinCode.toUpperCase())).limit(1))[0];
  if (!row) return null;
  const classroom = (await db.select().from(classrooms).where(eq(classrooms.id, row.classroomId)).limit(1))[0];
  let questions: PulseQuestion[] = [];
  try { questions = JSON.parse(row.questions) as PulseQuestion[]; } catch { questions = []; }
  return { joinCode: row.joinCode, questions, launched: row.launched, classroom: classroom ? { name: classroom.name, subject: classroom.subject } : { name: CLASSROOM.name, subject: CLASSROOM.subject } };
}

export async function launchLiveSession(joinCode: string) {
  const db = await getDb();
  if (!db) return null;
  await db.update(pulseSessions).set({ launched: true }).where(eq(pulseSessions.joinCode, joinCode.toUpperCase()));
  return getLiveSession(joinCode);
}

export async function getStudentAnalytics(externalId: string) {
  const profile = await getLearnerProfile(externalId);
  if (!profile) return null;
  const topicData = [
    { topic: "Forces & Motion", current: profile.learner.mastery, previous: Math.max(0, profile.learner.mastery - 11) },
    { topic: "Living Things", current: Math.min(100, profile.learner.mastery + 8), previous: Math.max(0, profile.learner.mastery - 2) },
    { topic: "Matter & Properties", current: Math.max(0, profile.learner.mastery - 7), previous: Math.max(0, profile.learner.mastery - 17) },
  ];
  const matrix = { knewCorrect: 0, knewWrong: 0, unsureCorrect: 0, unsureWrong: 0 };
  profile.answers.forEach((answer) => {
    if (answer.confidence === "knew" && answer.correct) matrix.knewCorrect += 1;
    else if (answer.confidence === "knew") matrix.knewWrong += 1;
    else if (answer.correct) matrix.unsureCorrect += 1;
    else matrix.unsureWrong += 1;
  });
  return { learner: profile.learner, answers: profile.answers, topicData, timeline: [4, 4, 3, 3, 2, profile.learner.misconception ? 2 : 1].map((active, index) => ({ session: `S${index + 1}`, active, cleared: index === 5 && Boolean(profile.learner.clearedAt) })), matrix, strongest: topicData.reduce((a, b) => a.current > b.current ? a : b).topic, opportunity: topicData.reduce((a, b) => a.current < b.current ? a : b).topic };
}
