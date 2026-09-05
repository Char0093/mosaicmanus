CREATE TABLE `milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`learnerId` int NOT NULL,
	`misconceptionName` varchar(180) NOT NULL,
	`subject` varchar(120) NOT NULL,
	`topic` varchar(160) NOT NULL,
	`clearedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pulseSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`joinCode` varchar(12) NOT NULL,
	`liveMode` boolean NOT NULL DEFAULT false,
	`launched` boolean NOT NULL DEFAULT false,
	`questions` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pulseSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pulseSessions_joinCode_unique` UNIQUE(`joinCode`)
);
--> statement-breakpoint
ALTER TABLE `answers` ADD `reasoning` text;--> statement-breakpoint
ALTER TABLE `answers` ADD `classifierConfidence` enum('high','medium','low');--> statement-breakpoint
ALTER TABLE `answers` ADD `teacherOverrideMisconceptionId` varchar(120);--> statement-breakpoint
ALTER TABLE `learners` ADD `confidentWrongCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `learners` ADD `confusedWrongCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `learners` ADD `clearedAt` timestamp;--> statement-breakpoint
ALTER TABLE `milestones` ADD CONSTRAINT `milestones_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `milestones` ADD CONSTRAINT `milestones_learnerId_learners_id_fk` FOREIGN KEY (`learnerId`) REFERENCES `learners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pulseSessions` ADD CONSTRAINT `pulseSessions_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `milestones_learner_idx` ON `milestones` (`learnerId`);