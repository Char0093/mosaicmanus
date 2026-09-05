import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "educator", "tutor", "student"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const classrooms = mysqlTable("classrooms", {
  id: int("id").autoincrement().primaryKey(), slug: varchar("slug", { length: 120 }).notNull().unique(), name: varchar("name", { length: 160 }).notNull(), subject: varchar("subject", { length: 120 }).notNull(), kioskCode: varchar("kioskCode", { length: 32 }).notNull().unique(), topics: text("topics").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ slugIndex: uniqueIndex("classrooms_slug_idx").on(table.slug) }));

export const learners = mysqlTable("learners", {
  id: int("id").autoincrement().primaryKey(), classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }), externalId: varchar("externalId", { length: 32 }).notNull(), name: varchar("name", { length: 160 }).notNull(), initials: varchar("initials", { length: 8 }).notNull(), tier: mysqlEnum("tier", ["red", "yellow", "green", "blue"]).notNull(), mastery: int("mastery").notNull().default(0), misconception: text("misconception"), flagged: boolean("flagged").notNull().default(false), confidentWrongCount: int("confidentWrongCount").notNull().default(0), confusedWrongCount: int("confusedWrongCount").notNull().default(0), clearedAt: timestamp("clearedAt"), recent: varchar("recent", { length: 60 }).notNull().default("Just now"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ classroomExternalIndex: uniqueIndex("learners_classroom_external_idx").on(table.classroomId, table.externalId), classroomIndex: index("learners_classroom_idx").on(table.classroomId) }));

export const answers = mysqlTable("answers", {
  id: int("id").autoincrement().primaryKey(), classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }), learnerId: int("learnerId").notNull().references(() => learners.id, { onDelete: "cascade" }), questionId: varchar("questionId", { length: 64 }).notNull(), option: varchar("option", { length: 8 }).notNull(), correct: boolean("correct").notNull(), confidence: mysqlEnum("confidence", ["guessed", "unsure", "knew"]).notNull(), feedback: text("feedback").notNull(), reasoning: text("reasoning"), classifierConfidence: mysqlEnum("classifierConfidence", ["high", "medium", "low"]), teacherOverrideMisconceptionId: varchar("teacherOverrideMisconceptionId", { length: 120 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ answerClassIndex: index("answers_class_idx").on(table.classroomId), answerLearnerIndex: index("answers_learner_idx").on(table.learnerId) }));

export const milestones = mysqlTable("milestones", {
  id: int("id").autoincrement().primaryKey(), classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }), learnerId: int("learnerId").notNull().references(() => learners.id, { onDelete: "cascade" }), misconceptionName: varchar("misconceptionName", { length: 180 }).notNull(), subject: varchar("subject", { length: 120 }).notNull(), topic: varchar("topic", { length: 160 }).notNull(), clearedAt: timestamp("clearedAt").defaultNow().notNull(),
}, (table) => ({ milestoneLearnerIndex: index("milestones_learner_idx").on(table.learnerId) }));

export const pulseSessions = mysqlTable("pulseSessions", {
  id: int("id").autoincrement().primaryKey(), classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }), joinCode: varchar("joinCode", { length: 12 }).notNull().unique(), liveMode: boolean("liveMode").notNull().default(false), launched: boolean("launched").notNull().default(false), questions: text("questions").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const classroomAccess = mysqlTable("classroomAccess", {
  id: int("id").autoincrement().primaryKey(), classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }), userId: int("userId").references(() => users.id, { onDelete: "cascade" }), learnerId: int("learnerId").references(() => learners.id, { onDelete: "cascade" }), accessRole: mysqlEnum("accessRole", ["educator", "tutor", "student"]).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ classroomAccessIndex: index("classroom_access_class_idx").on(table.classroomId), userAccessIndex: index("classroom_access_user_idx").on(table.userId) }));

export const chapters = mysqlTable("chapters", {
  id: int("id").autoincrement().primaryKey(), classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }), title: varchar("title", { length: 180 }).notNull(), description: text("description").notNull(), orderIndex: int("orderIndex").notNull().default(0), published: boolean("published").notNull().default(false), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ chapterClassIndex: index("chapters_class_idx").on(table.classroomId) }));

export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(), classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }), chapterId: int("chapterId").references(() => chapters.id, { onDelete: "set null" }), title: varchar("title", { length: 180 }).notNull(), sourceFilename: varchar("sourceFilename", { length: 240 }), questions: text("questions").notNull(), questionCount: int("questionCount").notNull().default(0), published: boolean("published").notNull().default(false), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ quizClassIndex: index("quizzes_class_idx").on(table.classroomId), quizChapterIndex: index("quizzes_chapter_idx").on(table.chapterId) }));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").references(() => users.id, { onDelete: "cascade" }), learnerId: int("learnerId").references(() => learners.id, { onDelete: "cascade" }), audience: mysqlEnum("audience", ["educator", "tutor", "student", "all"]).notNull(), title: varchar("title", { length: 180 }).notNull(), body: text("body").notNull(), readAt: timestamp("readAt"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ notificationUserIndex: index("notifications_user_idx").on(table.userId), notificationLearnerIndex: index("notifications_learner_idx").on(table.learnerId) }));

export const tutorPerks = mysqlTable("tutorPerks", {
  id: int("id").autoincrement().primaryKey(), code: varchar("code", { length: 50 }).notNull().unique(), title: varchar("title", { length: 160 }).notNull(), description: text("description").notNull(), status: mysqlEnum("status", ["available", "claimed"]).notNull().default("available"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const peerTutoringSessions = mysqlTable("peerTutoringSessions", {
  id: int("id").autoincrement().primaryKey(), classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }), tutorLearnerId: int("tutorLearnerId").notNull().references(() => learners.id, { onDelete: "cascade" }), tuteeLearnerId: int("tuteeLearnerId").notNull().references(() => learners.id, { onDelete: "cascade" }), misconceptionName: varchar("misconceptionName", { length: 180 }).notNull(), status: mysqlEnum("status", ["in_progress", "completed"]).notNull().default("in_progress"), teacherCommended: boolean("teacher_commended").notNull().default(false), completedAt: timestamp("completedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ peerClassIndex: index("peer_tutoring_class_idx").on(table.classroomId), peerStatusIndex: index("peer_tutoring_status_idx").on(table.status) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Classroom = typeof classrooms.$inferSelect;
export type LearnerRow = typeof learners.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;
export type MilestoneRow = typeof milestones.$inferSelect;
export type PulseSessionRow = typeof pulseSessions.$inferSelect;
export type ChapterRow = typeof chapters.$inferSelect;
export type QuizRow = typeof quizzes.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type TutorPerkRow = typeof tutorPerks.$inferSelect;
export type PeerTutoringSessionRow = typeof peerTutoringSessions.$inferSelect;
