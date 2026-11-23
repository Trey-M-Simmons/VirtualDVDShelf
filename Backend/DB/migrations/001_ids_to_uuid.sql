BEGIN;

ALTER TABLE account_dvds
    DROP CONSTRAINT account_dvds_user_id_fkey,
    DROP CONSTRAINT account_dvds_dvd_id_fkey,
    DROP CONSTRAINT account_dvds_dvd_id_texture_set_id_fkey;
ALTER TABLE texture_sets DROP CONSTRAINT texture_sets_dvd_id_fkey;

ALTER TABLE dvds
    ALTER COLUMN dvd_id DROP DEFAULT,
    ALTER COLUMN dvd_id TYPE uuid USING dvd_id::uuid,
    ALTER COLUMN dvd_id SET DEFAULT gen_random_uuid();
ALTER TABLE accounts
    ALTER COLUMN user_id DROP DEFAULT,
    ALTER COLUMN user_id TYPE uuid USING user_id::uuid,
    ALTER COLUMN user_id SET DEFAULT gen_random_uuid();
ALTER TABLE texture_sets
    ALTER COLUMN texture_set_id DROP DEFAULT,
    ALTER COLUMN texture_set_id TYPE uuid USING texture_set_id::uuid,
    ALTER COLUMN texture_set_id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN dvd_id TYPE uuid USING dvd_id::uuid;
ALTER TABLE account_dvds
    ALTER COLUMN user_id TYPE uuid USING user_id::uuid,
    ALTER COLUMN dvd_id TYPE uuid USING dvd_id::uuid,
    ALTER COLUMN texture_set_id TYPE uuid USING texture_set_id::uuid;

ALTER TABLE texture_sets
    ADD CONSTRAINT texture_sets_dvd_id_fkey
        FOREIGN KEY (dvd_id) REFERENCES dvds (dvd_id) ON DELETE CASCADE;
ALTER TABLE account_dvds
    ADD CONSTRAINT account_dvds_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES accounts (user_id) ON DELETE CASCADE,
    ADD CONSTRAINT account_dvds_dvd_id_fkey
        FOREIGN KEY (dvd_id) REFERENCES dvds (dvd_id) ON DELETE CASCADE,
    ADD CONSTRAINT account_dvds_dvd_id_texture_set_id_fkey
        FOREIGN KEY (dvd_id, texture_set_id)
        REFERENCES texture_sets (dvd_id, texture_set_id);

COMMIT;
