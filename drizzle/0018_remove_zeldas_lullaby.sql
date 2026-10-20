-- Remove the piece from the catalog while retaining past practice results.
DELETE FROM practice_exercises WHERE number = 7002 AND collection = 'repertoire';
