CREATE TABLE `obs_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`snapshot` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
