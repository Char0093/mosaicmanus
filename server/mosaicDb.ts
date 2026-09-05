import { and, asc, desc, eq } from "drizzle-orm";
import { answers, chapters, classroomAccess, classrooms, learners, milestones, misconceptions, notifications, peerTutoringSessions, pulseSessions, quizzes, teacherQuestions, tutorPerks } from "../drizzle/schema";
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
      const existingPeerSessions = await db.select().from(peerTutoringSessions).where(eq(peerTutoringSessions.classroomId, classroom.id)).limit(1);
      if (existingPeerSessions.length === 0) {
        const peerLearners = await db.select().from(learners).where(eq(learners.classroomId, classroom.id));
        const tutor = peerLearners.find((learner) => learner.externalId === "s17");
        const tutee = peerLearners.find((learner) => learner.externalId === "s6");
        if (tutor && tutee) await db.insert(peerTutoringSessions).values({ classroomId: classroom.id, tutorLearnerId: tutor.id, tuteeLearnerId: tutee.id, misconceptionName: "Mass and weight are the same thing", status: "completed", teacherCommended: false, completedAt: new Date() });
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

export async function getStudentQuizReview(externalId: string) {
  const profile = await getLearnerProfile(externalId);
  const classroomState = await getClassroomRow();
  const classroom = classroomState.classroom;
  const answers = profile?.answers ?? [];
  const topicForQuestion = (questionId: string) => questionId.toLowerCase().includes("living") || questionId === "q2" ? "Living Things" : questionId.toLowerCase().includes("matter") || questionId === "q3" ? "Matter & Properties" : "Forces & Motion";
  const questionText = (questionId: string) => ({ q1: "Which statement best describes mass?", q2: "What changes between Earth and the Moon?", q3: "What tool measures weight?" } as Record<string, string>)[questionId] ?? "Question from your learning mission";
  const grouped = new Map<string, typeof answers>();
  answers.forEach((answer) => { const topic = topicForQuestion(answer.questionId); grouped.set(topic, [...(grouped.get(topic) ?? []), answer]); });
  const topics = (classroom ? parseJson(classroom.topics, CLASSROOM.topics) : CLASSROOM.topics);
  const topicReviews = topics.map((topic) => {
    const topicAnswers = grouped.get(topic) ?? [];
    const correct = topicAnswers.filter((answer) => answer.correct).length;
    return { topic, totalQuestions: topicAnswers.length, accuracy: topicAnswers.length ? Math.round((correct / topicAnswers.length) * 100) : 0, mostCommonError: topicAnswers.find((answer) => !answer.correct)?.teacherOverrideMisconceptionId ?? null, questionsToRevisit: topicAnswers.filter((answer) => !answer.correct).length, sessions: topicAnswers.map((answer) => ({ id: String(answer.id), answeredAt: answer.createdAt, score: answer.correct ? 1 : 0, question: { id: answer.questionId, text: questionText(answer.questionId), selectedOption: answer.option, correct: answer.correct, correctOption: answer.questionId === "q1" ? "B" : answer.questionId === "q2" ? "C" : "B", confidence: answer.confidence, misconception: answer.correct ? null : answer.teacherOverrideMisconceptionId ?? "Mass and weight are the same thing" } })) };
  });
  const revisitQueue = topicReviews.flatMap((review) => review.sessions.filter((session) => !session.question.correct).map((session) => ({ ...session, topic: review.topic }))).slice(0, 5);
  return { classroom: classroom ? { name: classroom.name, subject: classroom.subject } : { name: CLASSROOM.name, subject: CLASSROOM.subject }, topics: topicReviews, revisitQueue, hasHistory: answers.length > 0 };
}

export async function startRevisitSession(input: { learnerId: string; topic: string; misconception?: string }) {
  return { success: true, learnerId: input.learnerId, topic: input.topic, misconception: input.misconception ?? null, startedAt: new Date().toISOString() };
}

export async function getStudentAnalytics(externalId: string) {
  const profile = await getLearnerProfile(externalId);
  if (!profile) return null;
  const db = await getDb();
  const learnerRow = db ? (await db.select().from(learners).where(eq(learners.externalId, externalId)).limit(1))[0] : undefined;
  const milestoneRows = db && learnerRow ? await db.select().from(milestones).where(eq(milestones.learnerId, learnerRow.id)) : [];
  const topicData = [
    { topic: "Forces & Motion", current: profile.learner.mastery, mastery_score: profile.learner.mastery, previous: Math.max(0, profile.learner.mastery - 11) },
    { topic: "Living Things", current: Math.min(100, profile.learner.mastery + 8), mastery_score: Math.min(100, profile.learner.mastery + 8), previous: Math.max(0, profile.learner.mastery - 2) },
    { topic: "Matter & Properties", current: Math.max(0, profile.learner.mastery - 7), mastery_score: Math.max(0, profile.learner.mastery - 7), previous: Math.max(0, profile.learner.mastery - 17) },
  ];
  const topicNames = topicData.map((item) => item.topic);
  const topicForQuestion = (questionId: string) => questionId.toLowerCase().includes("living") || questionId === "q2" ? "Living Things" : questionId.toLowerCase().includes("matter") || questionId === "q3" ? "Matter & Properties" : "Forces & Motion";
  const sessionRows = [...profile.answers].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sessionTrend = sessionRows.length ? sessionRows.map((answer, index) => {
    const data: Record<string, string | number> = { session: new Date(answer.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
    topicNames.forEach((topic, topicIndex) => { data[topic] = topic === topicForQuestion(answer.questionId) ? Math.max(0, Math.min(100, topicData[topicIndex].previous + (answer.correct ? (index + 1) * 7 : -(index + 1) * 4))) : topicData[topicIndex].previous; });
    return data;
  }) : ["Mon", "Wed", "Fri"].map((session, index) => ({ session, "Forces & Motion": Math.max(0, profile.learner.mastery - 16 + index * 8), "Living Things": Math.max(0, profile.learner.mastery - 7 + index * 7), "Matter & Properties": Math.max(0, profile.learner.mastery - 20 + index * 9) }));
  const misconceptionCounts = new Map<string, number>();
  profile.answers.filter((answer) => !answer.correct).forEach((answer) => { const name = answer.teacherOverrideMisconceptionId ?? (answer.reasoning?.replace(/^Teacher override:\s*/i, "") || profile.learner.misconception || "Mass and weight are the same thing"); misconceptionCounts.set(name, (misconceptionCounts.get(name) ?? 0) + 1); });
  const misconceptionFrequency = Array.from(misconceptionCounts, ([misconception, count]) => ({ misconception, count })).sort((a, b) => b.count - a.count);
  if (!misconceptionFrequency.length && profile.learner.misconception) misconceptionFrequency.push({ misconception: profile.learner.misconception, count: 1 });
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const clearedThisWeek = milestoneRows.filter((milestone) => milestone.clearedAt.getTime() >= weekStart).length;
  const matrix = { knewCorrect: 0, knewWrong: 0, unsureCorrect: 0, unsureWrong: 0 };
  profile.answers.forEach((answer) => {
    if (answer.confidence === "knew" && answer.correct) matrix.knewCorrect += 1;
    else if (answer.confidence === "knew") matrix.knewWrong += 1;
    else if (answer.correct) matrix.unsureCorrect += 1;
    else matrix.unsureWrong += 1;
  });
  return { learner: profile.learner, answers: profile.answers, topicData, sessionTrend, misconceptionFrequency, clearedThisWeek, timeline: [4, 4, 3, 3, 2, profile.learner.misconception ? 2 : 1].map((active, index) => ({ session: `S${index + 1}`, active, cleared: index === 5 && Boolean(profile.learner.clearedAt) })), matrix, strongest: topicData.reduce((a, b) => a.current > b.current ? a : b).topic, opportunity: topicData.reduce((a, b) => a.current < b.current ? a : b).topic };
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

const starterMisconceptions = [
  { name: "Uses a memorized rule without checking the context", explanation: "The learner applies a familiar rule even when the question changes the conditions." },
  { name: "Confuses two related ideas", explanation: "The learner treats two connected concepts as interchangeable instead of identifying what makes them different." },
  { name: "Skips the evidence step", explanation: "The learner jumps to an answer without using the information, units, or evidence provided in the question." },
];

function classSummary(row: ClassroomRow) {
  return { id: String(row.id), slug: row.slug, name: row.name, subject: row.subject, yearLevel: row.yearLevel ?? "", description: row.description ?? "", kioskCode: row.kioskCode, topics: parseJson(row.topics, [] as string[]), createdAt: row.createdAt.toISOString() };
}

async function seedMisconceptions(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, subject: string, topics: string[]) {
  for (const topic of topics) {
    const existing = await db.select().from(misconceptions).where(and(eq(misconceptions.subject, subject), eq(misconceptions.topic, topic))).limit(1);
    if (existing.length === 0) await db.insert(misconceptions).values(starterMisconceptions.map((item) => ({ subject, topic, name: item.name, explanation: item.explanation })));
  }
}

export async function listTeacherClassrooms(teacherId?: number) {
  const db = await getDb();
  const fallback = [{ id: CLASSROOM.id, slug: CLASSROOM.id, name: CLASSROOM.name, subject: CLASSROOM.subject, yearLevel: "Form 2", description: "Science foundations and live misconception checks.", kioskCode: CLASSROOM.kioskCode, topics: CLASSROOM.topics, createdAt: new Date().toISOString() }];
  if (!db) return fallback;
  const rows = teacherId ? await db.select().from(classrooms).where(eq(classrooms.teacherId, teacherId)).orderBy(desc(classrooms.createdAt)) : await db.select().from(classrooms).orderBy(desc(classrooms.createdAt));
  return rows.length ? rows.map(classSummary) : fallback;
}

export async function createTeacherClassroom(input: { name: string; subject: string; yearLevel: string; topics: string[]; description?: string }, teacherId?: number) {
  const db = await getDb();
  if (!db) return { id: `local-${Date.now()}`, slug: `local-${Date.now()}`, name: input.name, subject: input.subject, yearLevel: input.yearLevel, description: input.description ?? "", kioskCode: Math.random().toString(36).substring(2, 9).toUpperCase(), topics: input.topics, createdAt: new Date().toISOString() };
  let kioskCode = "";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = Math.random().toString(36).substring(2, 9).toUpperCase();
    const collision = await db.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.kioskCode, candidate)).limit(1);
    if (!collision.length) { kioskCode = candidate; break; }
  }
  if (!kioskCode) throw new Error("Could not generate a unique class code. Please try again.");
  const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36).slice(-5)}`;
  await db.insert(classrooms).values({ teacherId: teacherId ?? null, slug, name: input.name, subject: input.subject, yearLevel: input.yearLevel, description: input.description ?? null, kioskCode, topics: JSON.stringify(input.topics) });
  await seedMisconceptions(db, input.subject, input.topics);
  const row = (await db.select().from(classrooms).where(eq(classrooms.slug, slug)).limit(1))[0];
  if (!row) throw new Error("Class was created but could not be loaded.");
  return classSummary(row);
}

export async function updateTeacherClassroom(id: string, input: { name: string; description?: string; yearLevel: string }) {
  const db = await getDb();
  if (!db || !/^[0-9]+$/.test(id)) return { success: true, id, ...input };
  await db.update(classrooms).set({ name: input.name, description: input.description ?? null, yearLevel: input.yearLevel }).where(eq(classrooms.id, Number(id)));
  const row = (await db.select().from(classrooms).where(eq(classrooms.id, Number(id))).limit(1))[0];
  return row ? classSummary(row) : { success: true, id, ...input };
}

export async function regenerateClassroomCode(id: string) {
  const db = await getDb();
  const kioskCode = Math.random().toString(36).substring(2, 9).toUpperCase();
  if (!db || !/^[0-9]+$/.test(id)) return { success: true, id, kioskCode };
  await db.update(classrooms).set({ kioskCode }).where(eq(classrooms.id, Number(id)));
  return { success: true, id, kioskCode };
}

export async function listClassroomStudents(id: string) {
  const db = await getDb();
  if (!db || !/^[0-9]+$/.test(id)) return [];
  const rows = await db.select().from(learners).where(eq(learners.classroomId, Number(id))).orderBy(asc(learners.name));
  return rows.map((row) => ({ id: row.externalId, name: row.name, initials: row.initials, tier: row.tier, recent: row.recent }));
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


const demoPeerRecognition = [{ id: "demo-peer-1", tutorName: "Adam Ibrahim", tuteeName: "Hana Yusof", misconceptionName: "Mass and weight are the same thing", status: "completed" as const, teacherCommended: false, completedAt: new Date().toISOString() }];

export async function getPeerTutoringRecognition() {
  const { db, classroom } = await getClassroomRow();
  if (!db || !classroom) return demoPeerRecognition;
  const rows = await db.select().from(peerTutoringSessions).where(and(eq(peerTutoringSessions.classroomId, classroom.id), eq(peerTutoringSessions.status, "completed")));
  if (!rows.length) return [];
  const learnerRows = await db.select().from(learners).where(eq(learners.classroomId, classroom.id));
  const names = new Map(learnerRows.map((learner) => [learner.id, learner.name]));
  return rows.map((row) => ({ id: String(row.id), tutorName: names.get(row.tutorLearnerId) ?? "A peer tutor", tuteeName: names.get(row.tuteeLearnerId) ?? "a classmate", misconceptionName: row.misconceptionName, status: row.status, teacherCommended: row.teacherCommended, completedAt: row.completedAt?.toISOString() ?? row.createdAt.toISOString() }));
}

export async function commendPeerTutoringSession(id: string) {
  const db = await getDb();
  if (db && /^\d+$/.test(id)) await db.update(peerTutoringSessions).set({ teacherCommended: true }).where(eq(peerTutoringSessions.id, Number(id)));
  return { success: true, id };
}

export type TeacherQuestionInput = {
  topic: string; questionText: string; options: { A: string; B: string; C: string; D: string };
  correctOption: "A" | "B" | "C" | "D"; misconceptionHints?: Record<string, number | null>;
};

function teacherQuestionSummary(row: typeof teacherQuestions.$inferSelect) {
  return { id: String(row.id), topic: row.topic, questionText: row.questionText, options: { A: row.optionA, B: row.optionB, C: row.optionC, D: row.optionD }, correctOption: row.correctOption, misconceptionHints: row.misconceptionHints ?? {}, isActive: row.isActive, createdAt: row.createdAt.toISOString(), isTeacherQuestion: true as const };
}

async function activeClassroomForTeacher() {
  const { db, classroom } = await getClassroomRow();
  return { db, classroom };
}

export async function listTeacherQuestions(topic?: string) {
  const { db, classroom } = await activeClassroomForTeacher();
  if (!db || !classroom) return [];
  const rows = await db.select().from(teacherQuestions).where(topic ? and(eq(teacherQuestions.classroomId, classroom.id), eq(teacherQuestions.topic, topic)) : eq(teacherQuestions.classroomId, classroom.id)).orderBy(desc(teacherQuestions.createdAt));
  return rows.map(teacherQuestionSummary);
}

export async function listMisconceptionsForTopic(topic: string) {
  const { db, classroom } = await activeClassroomForTeacher();
  if (!db || !classroom) return [];
  const rows = await db.select().from(misconceptions).where(and(eq(misconceptions.subject, classroom.subject), eq(misconceptions.topic, topic))).orderBy(asc(misconceptions.name));
  return rows.map((row) => ({ id: row.id, name: row.name, explanation: row.explanation }));
}

export async function createTeacherQuestion(input: TeacherQuestionInput, teacherId?: number) {
  const { db, classroom } = await activeClassroomForTeacher();
  if (!db || !classroom) return { id: `local-${Date.now()}`, ...input, isActive: true, createdAt: new Date().toISOString(), isTeacherQuestion: true as const };
  await db.insert(teacherQuestions).values({ teacherId: teacherId ?? null, classroomId: classroom.id, subject: classroom.subject, topic: input.topic, questionText: input.questionText, optionA: input.options.A, optionB: input.options.B, optionC: input.options.C, optionD: input.options.D, correctOption: input.correctOption, misconceptionHints: input.misconceptionHints ?? {}, isActive: true });
  const row = (await db.select().from(teacherQuestions).where(and(eq(teacherQuestions.classroomId, classroom.id), eq(teacherQuestions.questionText, input.questionText))).orderBy(desc(teacherQuestions.id)).limit(1))[0];
  return row ? teacherQuestionSummary(row) : null;
}

export async function setTeacherQuestionActive(id: string, active: boolean) {
  const db = await getDb();
  if (db && /^\d+$/.test(id)) await db.update(teacherQuestions).set({ isActive: active }).where(eq(teacherQuestions.id, Number(id)));
  return { success: true, id, isActive: active };
}

export async function deleteTeacherQuestion(id: string) {
  const db = await getDb();
  if (db && /^\d+$/.test(id)) await db.delete(teacherQuestions).where(eq(teacherQuestions.id, Number(id)));
  return { success: true, id };
}
