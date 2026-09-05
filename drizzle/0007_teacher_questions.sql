CREATE TABLE `teacherQuestions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `teacherId` int,
  `classroomId` int NOT NULL,
  `subject` varchar(120) NOT NULL,
  `topic` varchar(160) NOT NULL,
  `questionText` text NOT NULL,
  `optionA` text NOT NULL,
  `optionB` text NOT NULL,
  `optionC` text NOT NULL,
  `optionD` text NOT NULL,
  `correctOption` enum('A','B','C','D') NOT NULL,
  `misconceptionHints` json DEFAULT ('{}'),
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `teacherQuestions_id` PRIMARY KEY(`id`),
  CONSTRAINT `teacherQuestions_teacherId_users_id_fk` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `teacherQuestions_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `teacher_questions_class_topic_idx` ON `teacherQuestions` (`classroomId`,`topic`);
--> statement-breakpoint
CREATE INDEX `teacher_questions_teacher_idx` ON `teacherQuestions` (`teacherId`); 
