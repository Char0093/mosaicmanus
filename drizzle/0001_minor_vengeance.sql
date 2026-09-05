CREATE TABLE `answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`learnerId` int NOT NULL,
	`questionId` varchar(64) NOT NULL,
	`option` varchar(8) NOT NULL,
	`correct` boolean NOT NULL,
	`confidence` enum('guessed','unsure','knew') NOT NULL,
	`feedback` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(160) NOT NULL,
	`subject` varchar(120) NOT NULL,
	`kioskCode` varchar(32) NOT NULL,
	`topics` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `classrooms_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `classrooms_kioskCode_unique` UNIQUE(`kioskCode`),
	CONSTRAINT `classrooms_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `learners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`externalId` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`initials` varchar(8) NOT NULL,
	`tier` enum('red','yellow','green','blue') NOT NULL,
	`mastery` int NOT NULL DEFAULT 0,
	`misconception` text,
	`flagged` boolean NOT NULL DEFAULT false,
	`recent` varchar(60) NOT NULL DEFAULT 'Just now',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learners_id` PRIMARY KEY(`id`),
	CONSTRAINT `learners_classroom_external_idx` UNIQUE(`classroomId`,`externalId`)
);
--> statement-breakpoint
ALTER TABLE `answers` ADD CONSTRAINT `answers_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `answers` ADD CONSTRAINT `answers_learnerId_learners_id_fk` FOREIGN KEY (`learnerId`) REFERENCES `learners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learners` ADD CONSTRAINT `learners_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `answers_class_idx` ON `answers` (`classroomId`);--> statement-breakpoint
CREATE INDEX `answers_learner_idx` ON `answers` (`learnerId`);--> statement-breakpoint
CREATE INDEX `learners_classroom_idx` ON `learners` (`classroomId`);