import { and, asc, desc, eq } from "drizzle-orm";
import { answers, chapters, classroomAccess, classrooms, learners, milestones, notifications, pulseSessions, quizzes, tutorPerks } from "../drizzle/schema";
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


const demoChapters = [
  { id: "demo-chapter-1", title: "Forces & Motion", description: "Build a clear distinction between mass, weight, force, and motion.", orderIndex: 1, published: true },
  { id: "demo-chapter-2", title: "Living Things", description: "Compare systems, structures, and the jobs they do.", orderIndex: 2, published: false },
];

const demoQuizzes = [
  { id: "demo-quiz-1", chapterId: "demo-chapter-1", title: "Mass & Weight Quick Check", sourceFilename: "built-in", questionCount: 3, published: true, questions: [{ id: "q1", prompt: "Which statement best describes mass?", options: ["The pull of gravity", "The amount of matter", "A push or pull", "How fast something moves"] }, { id: "q2", prompt: "What changes between Earth and the Moon?", options: ["Mass", "The amount of matter", "Weight", "The object itself"] }, { id: "q3", prompt: "What tool measures weight?", options: ["Balance", "Spring scale", "Ruler", "Thermometer"] }] },
];

const demoNotifications = [
  { id: "demo-notification-1", audience: "educator" as const, title: "Classroom ready", body: "Your Form 2 Science classroom is open. Add a chapter or publish a quick check.", readAt: null, createdAt: new Date().toISOString() },
  { id: "demo-notification-2", audience: "student" as const, title: "Your next small step", body: "A new Forces & Motion quick check is ready in your personal dashboard.", readAt: null, createdAt: new Date().toISOString() },
  { id: "demo-notification-3", audience: "tutor" as const, title: "Mentor perk unlocked", body: "You can claim a free classroom planning clinic from the Tutor Circle.", readAt: null, createdAt: new Date().toISOString() },
];

const demoPerks = [
  { id: "perk-1", code: "TUTOR-CLINIC", title: "Free planning clinic", description: "Book one 25-minute curriculum planning clinic with an experienced Mosaic mentor.", status: "available" as const },
  { id: "perk-2", code: "TUTOR-PRINT", title: "Priority print pack", description: "Unlock a monthly printable answer-slip pack for your mentoring groups.", status: "available" as const },
  { id: "perk-3", code: "TUTOR-BADGE", title: "Verified mentor badge", description: "Add a verified mentor badge to your tutor profile after your first active classroom.", status: "available" as const },
];

async function ensureWorkspaceSeed(classroomId: number) {
  const db = await getDb();
  if (!db) return;
  const existingChapters = await db.select().from(chapters).where(eq(chapters.classroomId, classroomId)).limit(1);
  if (existingChapters.length === 0) {
    await db.insert(chapters).values(demoChapters.map((chapter) => ({ classroomId, title: chapter.title, description: chapter.description, orderIndex: chapter.orderIndex, published: chapter.published })));
  }
  const currentChapters = await db.select().from(chapters).where(eq(chapters.classroomId, classroomId)).orderBy(asc(chapters.orderIndex));
  const existingQuizzes = await db.select().from(quizzes).where(eq(quizzes.classroomId, classroomId)).limit(1);
  if (existingQuizzes.length === 0 && currentChapters[0]) {
    const quiz = demoQuizzes[0];
    await db.insert(quizzes).values({ classroomId, chapterId: currentChapters[0].id, title: quiz.title, sourceFilename: quiz.sourceFilename, questions: JSON.stringify(quiz.questions), questionCount: quiz.questionCount, published: quiz.published });
  }
  const existingPerks = await db.select().from(tutorPerks).limit(1);
  if (existingPerks.length === 0) await db.insert(tutorPerks).values(demoPerks.map(({ id: _id, ...perk }) => perk));
}

export async function getWorkspace() {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return { classroom: CLASSROOM, chapters: demoChapters, quizzes: demoQuizzes };
  await ensureWorkspaceSeed(classroom.id);
  const chapterRows = await db.select().from(chapters).where(eq(chapters.classroomId, classroom.id)).orderBy(asc(chapters.orderIndex));
  const quizRows = await db.select().from(quizzes).where(eq(quizzes.classroomId, classroom.id)).orderBy(desc(quizzes.createdAt));
  return {
    classroom: classroomForWorkspace(classroom),
    chapters: chapterRows.map((row) => ({ id: String(row.id), title: row.title, description: row.description, orderIndex: row.orderIndex, published: row.published })),
    quizzes: quizRows.map((row) => ({ id: String(row.id), chapterId: row.chapterId ? String(row.chapterId) : null, title: row.title, sourceFilename: row.sourceFilename, questionCount: row.questionCount, published: row.published, questions: parseJson(row.questions, []) })),
  };
}

function parseJson<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function classroomForWorkspace(row: ClassroomRow) { return { id: row.slug, name: row.name, subject: row.subject, kioskCode: row.kioskCode, topics: parseJson(row.topics, CLASSROOM.topics) }; }

export async function createClassroom(input: { name: string; subject: string; topics: string[] }) {
  const db = await getDb();
  if (!db) return { classroom: { ...CLASSROOM, name: input.name, subject: input.subject, topics: input.topics }, created: false };
  const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36).slice(-5)}`;
  const kioskCode = `M${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  await db.insert(classrooms).values({ slug, name: input.name, subject: input.subject, kioskCode, topics: JSON.stringify(input.topics) });
  const row = (await db.select().from(classrooms).where(eq(classrooms.slug, slug)).limit(1))[0];
  return { classroom: row ? classroomForWorkspace(row) : { ...CLASSROOM, id: slug, name: input.name, subject: input.subject, kioskCode, topics: input.topics }, created: true };
}

export async function createChapter(input: { title: string; description: string; published: boolean }) {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return { id: `demo-chapter-${Date.now()}`, ...input, orderIndex: 99 };
  const count = (await db.select().from(chapters).where(eq(chapters.classroomId, classroom.id))).length;
  await db.insert(chapters).values({ classroomId: classroom.id, title: input.title, description: input.description, orderIndex: count + 1, published: input.published });
  const row = (await db.select().from(chapters).where(and(eq(chapters.classroomId, classroom.id), eq(chapters.title, input.title))).orderBy(desc(chapters.id)).limit(1))[0];
  return row ? { id: String(row.id), title: row.title, description: row.description, orderIndex: row.orderIndex, published: row.published } : null;
}

export async function createQuiz(input: { title: string; chapterId?: string | null; sourceFilename?: string; questions: unknown[]; published: boolean }) {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return { id: `demo-quiz-${Date.now()}`, ...input, questionCount: input.questions.length };
  const numericChapterId = input.chapterId && /^\d+$/.test(input.chapterId) ? Number(input.chapterId) : null;
  await db.insert(quizzes).values({ classroomId: classroom.id, chapterId: numericChapterId, title: input.title, sourceFilename: input.sourceFilename ?? null, questions: JSON.stringify(input.questions), questionCount: input.questions.length, published: input.published });
  const row = (await db.select().from(quizzes).where(and(eq(quizzes.classroomId, classroom.id), eq(quizzes.title, input.title))).orderBy(desc(quizzes.id)).limit(1))[0];
  return row ? { id: String(row.id), chapterId: row.chapterId ? String(row.chapterId) : null, title: row.title, sourceFilename: row.sourceFilename, questionCount: row.questionCount, published: row.published, questions: parseJson(row.questions, []) } : null;
}

export async function getNotifications(audience: "educator" | "tutor" | "student", learnerExternalId?: string) {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return demoNotifications.filter((item) => item.audience === audience);
  const learnerRows = learnerExternalId ? await db.select().from(learners).where(and(eq(learners.classroomId, classroom.id), eq(learners.externalId, learnerExternalId))).limit(1) : [];
  const learner: typeof learners.$inferSelect | undefined = learnerRows[0];
  const rows = await db.select().from(notifications).where(learner ? eq(notifications.learnerId, learner.id) : eq(notifications.audience, audience)).orderBy(desc(notifications.createdAt)).limit(20);
  if (rows.length === 0) return demoNotifications.filter((item) => item.audience === audience);
  return rows.map((row) => ({ id: String(row.id), audience: row.audience, title: row.title, body: row.body, readAt: row.readAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() }));
}

export async function markNotificationRead(id: string) {
  const db = await getDb();
  if (db && /^\d+$/.test(id)) await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, Number(id)));
  return { success: true, id };
}

export async function getTutorPerks() {
  const db = await getDb();
  if (!db) return demoPerks;
  const rows = await db.select().from(tutorPerks).orderBy(asc(tutorPerks.id));
  return rows.length ? rows.map((row) => ({ id: String(row.id), code: row.code, title: row.title, description: row.description, status: row.status })) : demoPerks;
}

export async function claimTutorPerk(id: string) {
  const db = await getDb();
  if (db && /^\d+$/.test(id)) await db.update(tutorPerks).set({ status: "claimed" }).where(eq(tutorPerks.id, Number(id)));
  return { success: true, id };
}
