-- Split customers.name into given_name and family_name.
--
-- This migration is expand-only on purpose: it adds the new columns and
-- backfills them, but does NOT drop customers.name. The old column is removed
-- by migration 009, after every reader has shipped. See docs/migrations.md.
ALTER TABLE customers ADD COLUMN given_name TEXT;
ALTER TABLE customers ADD COLUMN family_name TEXT;

UPDATE customers
   SET given_name  = substr(name, 1, instr(name, ' ') - 1),
       family_name = substr(name, instr(name, ' ') + 1)
 WHERE name LIKE '% %' AND given_name IS NULL;
