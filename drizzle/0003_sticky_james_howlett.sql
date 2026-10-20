CREATE TABLE `sight_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exercise_number` integer NOT NULL,
	`hand` text NOT NULL,
	`accuracy` integer NOT NULL,
	`mistakes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sight_attempt_user_created` ON `sight_attempts` (`user_id`,`created_at`);