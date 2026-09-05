CREATE TABLE `chapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`orderIndex` int NOT NULL DEFAULT 0,
	`published` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chapters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classroomAccess` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`userId` int,
	`learnerId` int,
	`accessRole` enum('educator','tutor','student') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classroomAccess_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`learnerId` int,
	`audience` enum('educator','tutor','student','all') NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`chapterId` int,
	`title` varchar(180) NOT NULL,
	`sourceFilename` varchar(240),
	`questions` text NOT NULL,
	`questionCount` int NOT NULL DEFAULT 0,
	`published` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutorPerks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`status` enum('available','claimed') NOT NULL DEFAULT 'available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorPerks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tutorPerks_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','educator','tutor','student') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `chapters` ADD CONSTRAINT `chapters_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classroomAccess` ADD CONSTRAINT `classroomAccess_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classroomAccess` ADD CONSTRAINT `classroomAccess_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classroomAccess` ADD CONSTRAINT `classroomAccess_learnerId_learners_id_fk` FOREIGN KEY (`learnerId`) REFERENCES `learners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_learnerId_learners_id_fk` FOREIGN KEY (`learnerId`) REFERENCES `learners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_chapterId_chapters_id_fk` FOREIGN KEY (`chapterId`) REFERENCES `chapters`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chapters_class_idx` ON `chapters` (`classroomId`);--> statement-breakpoint
CREATE INDEX `classroom_access_class_idx` ON `classroomAccess` (`classroomId`);--> statement-breakpoint
CREATE INDEX `classroom_access_user_idx` ON `classroomAccess` (`userId`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `notifications_learner_idx` ON `notifications` (`learnerId`);--> statement-breakpoint
CREATE INDEX `quizzes_class_idx` ON `quizzes` (`classroomId`);--> statement-breakpoint
CREATE INDEX `quizzes_chapter_idx` ON `quizzes` (`chapterId`);