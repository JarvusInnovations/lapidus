\set ON_ERROR_STOP true
SET client_min_messages TO WARNING;

SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots;

\c lapidus;

DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sex') THEN
      CREATE TYPE sex AS ENUM ('M', 'F');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "test_table" (
  "id" serial NOT NULL PRIMARY KEY,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(200) NOT NULL,
  "sex" sex DEFAULT NULL,
  "dob" timestamp DEFAULT NULL,
  "nullable" varchar(300) DEFAULT NULL
);
 
\c hurley;

DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sex') THEN
      CREATE TYPE sex AS ENUM ('M', 'F');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS "test_table" (
  "id" serial NOT NULL PRIMARY KEY,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(200) NOT NULL,
  "sex" sex DEFAULT NULL,
  "dob" timestamp DEFAULT NULL,
  "nullable" varchar(300) DEFAULT NULL
);
