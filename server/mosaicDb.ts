import { and, asc, eq } from "drizzle-orm";
import { answers, classrooms, learners } from "../drizzle/schema";
import { CLASSROOM, DEMO_LEARNERS, type Learner } from "../shared/mosaic";
import { getDb } from "./db";

let seedPromise: Promise<void> | null = null;

type ClassroomRow = typeof classrooms.$inferSelect;
type LearnerRow = typeof learners.$inferSelect;

function toLearner(row: LearnerRow): Learner {
  return {
    id: row.externalId,
    name: row.name,
    initials: row.initials,
    tier: row.tier,
    mastery: row.mastery,
    misconception: row.misconception ?? undefined,
    flagged: row.flagged,
    recent: row.recent,
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
        await db.insert(classrooms).values({
          slug: CLASSROOM.id,
          name: CLASSROOM.name,
          subject: CLASSROOM.subject,
          kioskCode: CLASSROOM.kioskCode,
          topics: JSON.stringify(CLASSROOM.topics),
        });
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
          misconception: learner.misconception ?? null,
          flagged: learner.flagged ?? false,
          recent: learner.recent,
        })));
      }
    })().catch((error) => {
      seedPromise = null;
      console.warn("[Mosaic DB] Demo seed unavailable; continuing with server fallback.", error);
    });
  }
  await seedPromise;
}

export async function getDemoClassroom(): Promise<{ classroom: ClassroomRow | null; learners: Learner[] }> {
  await ensureMosaicData();
  const db = await getDb();
  if (!db) return { classroom: null, learners: [] };
  const classroom = (await db.select().from(classrooms).where(eq(classrooms.slug, CLASSROOM.id)).limit(1))[0] ?? null;
  if (!classroom) return { classroom: null, learners: [] };
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

export async function persistAnswer(input: { learnerId: string; option: string; correct: boolean; confidence: "guessed" | "unsure" | "knew"; feedback: string; questionId: string }) {
  await ensureMosaicData();
  const db = await getDb();
  if (!db) return null;
  const classroom = (await db.select().from(classrooms).where(eq(classrooms.slug, CLASSROOM.id)).limit(1))[0];
  if (!classroom) return null;
  const learner = (await db.select().from(learners).where(and(eq(learners.classroomId, classroom.id), eq(learners.externalId, input.learnerId))).limit(1))[0];
  if (!learner) return null;
  const nextTier = input.correct ? learner.tier : "red";
  const nextMastery = input.correct ? Math.min(100, learner.mastery + 6) : Math.max(28, learner.mastery - 13);
  await db.update(learners).set({
    tier: nextTier,
    mastery: nextMastery,
    misconception: input.correct ? learner.misconception : "Mass and weight are the same thing",
    flagged: input.correct ? learner.flagged : true,
    recent: "Just now",
  }).where(eq(learners.id, learner.id));
  await db.insert(answers).values({
    classroomId: classroom.id,
    learnerId: learner.id,
    questionId: input.questionId,
    option: input.option,
    correct: input.correct,
    confidence: input.confidence,
    feedback: input.feedback,
  });
  const updated = (await db.select().from(learners).where(eq(learners.id, learner.id)).limit(1))[0];
  return updated ? toLearner(updated) : null;
}
