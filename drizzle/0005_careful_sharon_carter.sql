ALTER TABLE `classrooms` ADD `teacherId` int;--> statement-breakpoint
ALTER TABLE `classrooms` ADD `yearLevel` varchar(40);--> statement-breakpoint
ALTER TABLE `classrooms` ADD `description` text;--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_teacherId_users_id_fk` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;