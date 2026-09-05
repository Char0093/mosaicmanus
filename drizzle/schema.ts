import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const classrooms = mysqlTable("classrooms", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  subject: varchar("subject", { length: 120 }).notNull(),
  kioskCode: varchar("kioskCode", { length: 32 }).notNull().unique(),
  topics: text("topics").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ slugIndex: uniqueIndex("classrooms_slug_idx").on(table.slug) }));

export const learners = mysqlTable("learners", {
  id: int("id").autoincrement().primaryKey(),
  classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }),
  externalId: varchar("externalId", { length: 32 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  initials: varchar("initials", { length: 8 }).notNull(),
  tier: mysqlEnum("tier", ["red", "yellow", "green", "blue"]).notNull(),
  mastery: int("mastery").notNull().default(0),
  misconception: text("misconception"),
  flagged: boolean("flagged").notNull().default(false),
  recent: varchar("recent", { length: 60 }).notNull().default("Just now"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ classroomExternalIndex: uniqueIndex("learners_classroom_external_idx").on(table.classroomId, table.externalId), classroomIndex: index("learners_classroom_idx").on(table.classroomId) }));

export const answers = mysqlTable("answers", {
  id: int("id").autoincrement().primaryKey(),
  classroomId: int("classroomId").notNull().references(() => classrooms.id, { onDelete: "cascade" }),
  learnerId: int("learnerId").notNull().references(() => learners.id, { onDelete: "cascade" }),
  questionId: varchar("questionId", { length: 64 }).notNull(),
  option: varchar("option", { length: 8 }).notNull(),
  correct: boolean("correct").notNull(),
  confidence: mysqlEnum("confidence", ["guessed", "unsure", "knew"]).notNull(),
  feedback: text("feedback").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ answerClassIndex: index("answers_class_idx").on(table.classroomId), answerLearnerIndex: index("answers_learner_idx").on(table.learnerId) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Classroom = typeof classrooms.$inferSelect;
export type LearnerRow = typeof learners.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;
