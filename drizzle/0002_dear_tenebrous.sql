CREATE TABLE `video_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`uploader_id` text NOT NULL,
	`course_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`upload_id` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`rights` text NOT NULL,
	`parts` text DEFAULT '{}' NOT NULL,
	`state` text DEFAULT 'UPLOADING' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `video_upload_owner_created` ON `video_uploads` (`uploader_id`,`created_at`);