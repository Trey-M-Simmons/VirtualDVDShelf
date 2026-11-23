BEGIN;

ALTER TABLE account_dvds
    ALTER COLUMN texture_set_id SET NOT NULL;

COMMIT;
