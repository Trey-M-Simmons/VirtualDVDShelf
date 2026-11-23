BEGIN;

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

COMMIT;
