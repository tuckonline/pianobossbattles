-- Remove both Czerny collections; keep the user's historical attempts.
DELETE FROM practice_exercises WHERE collection IN ('czerny-op599', 'czerny-op481');
