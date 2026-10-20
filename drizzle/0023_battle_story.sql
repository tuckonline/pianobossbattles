CREATE TABLE battle_story_attempts (
 user_id text NOT NULL REFERENCES users(id),
 attempt_id text NOT NULL,
 challenge_key text NOT NULL,
 challenge text NOT NULL,
 result text NOT NULL,
 PRIMARY KEY(user_id,attempt_id)
);
--> statement-breakpoint
CREATE TABLE battle_story_records (
 user_id text NOT NULL REFERENCES users(id),
 challenge_key text NOT NULL,
 last_result text NOT NULL,
 best_result text NOT NULL,
 PRIMARY KEY(user_id,challenge_key)
);
