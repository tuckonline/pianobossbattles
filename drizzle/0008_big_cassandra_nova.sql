CREATE TABLE `practice_stream_stats` (
	`user_id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
