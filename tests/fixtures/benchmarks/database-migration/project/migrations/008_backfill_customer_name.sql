-- Backfill the rows migration 007 could not split (single-word names).
UPDATE customers
   SET given_name = name, family_name = ''
 WHERE given_name IS NULL;
