CREATE TABLE `misconceptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject` varchar(120) NOT NULL,
	`topic` varchar(160) NOT NULL,
	`name` varchar(180) NOT NULL,
	`explanation` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `misconceptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `misconceptions_subject_topic_idx` ON `misconceptions` (`subject`,`topic`);