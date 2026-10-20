CREATE TRIGGER reject_failed_mutation_guard
BEFORE INSERT ON mutation_guards
WHEN NEW.accepted <> 1
BEGIN
  SELECT RAISE(ABORT, 'mutation guard failed');
END;
--> statement-breakpoint
CREATE TRIGGER preserve_published_versions
BEFORE UPDATE ON versions
WHEN OLD.status = 'PUBLISHED'
BEGIN
  SELECT RAISE(ABORT, 'published versions are immutable');
END;
