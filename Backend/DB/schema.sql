CREATE TABLE dvds (
    dvd_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    actors text[] NOT NULL DEFAULT '{}',
    directors text[] NOT NULL DEFAULT '{}',
    description text NOT NULL DEFAULT ''
);

CREATE FUNCTION dvd_normalize_text(value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    RETURN lower(regexp_replace(value, '^\s+|\s+$', '', 'g'));

CREATE FUNCTION dvd_normalize_names(names text[]) RETURNS text[]
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    RETURN ARRAY(
        SELECT dvd_normalize_text(name)
        FROM unnest(names) AS name
        ORDER BY dvd_normalize_text(name) COLLATE "C"
    );

CREATE UNIQUE INDEX dvds_identity_idx ON dvds (
    dvd_normalize_text(title), dvd_normalize_names(actors), dvd_normalize_names(directors)
);

CREATE TABLE accounts (
    user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text NOT NULL UNIQUE
);

CREATE TABLE texture_sets (
    texture_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dvd_id uuid NOT NULL REFERENCES dvds (dvd_id) ON DELETE CASCADE,
    front_face text NOT NULL,
    back_face text NOT NULL,
    spine text NOT NULL,
    UNIQUE (dvd_id, texture_set_id)
);

CREATE TABLE account_dvds (
    user_id uuid NOT NULL REFERENCES accounts (user_id) ON DELETE CASCADE,
    dvd_id uuid NOT NULL REFERENCES dvds (dvd_id) ON DELETE CASCADE,
    texture_set_id uuid NOT NULL,
    PRIMARY KEY (user_id, dvd_id),
    FOREIGN KEY (dvd_id, texture_set_id)
        REFERENCES texture_sets (dvd_id, texture_set_id)
);

CREATE INDEX account_dvds_dvd_id_idx ON account_dvds (dvd_id);
