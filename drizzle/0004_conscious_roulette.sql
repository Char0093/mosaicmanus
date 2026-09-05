CREATE TABLE `peerTutoringSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`tutorLearnerId` int NOT NULL,
	`tuteeLearnerId` int NOT NULL,
	`misconceptionName` varchar(180) NOT NULL,
	`status` enum('in_progress','completed') NOT NULL DEFAULT 'in_progress',
	`teacher_commended` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `peerTutoringSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `peerTutoringSessions` ADD CONSTRAINT `peerTutoringSessions_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `peerTutoringSessions` ADD CONSTRAINT `peerTutoringSessions_tutorLearnerId_learners_id_fk` FOREIGN KEY (`tutorLearnerId`) REFERENCES `learners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `peerTutoringSessions` ADD CONSTRAINT `peerTutoringSessions_tuteeLearnerId_learners_id_fk` FOREIGN KEY (`tuteeLearnerId`) REFERENCES `learners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `peer_tutoring_class_idx` ON `peerTutoringSessions` (`classroomId`);--> statement-breakpoint
CREATE INDEX `peer_tutoring_status_idx` ON `peerTutoringSessions` (`status`);