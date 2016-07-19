\set ON_ERROR_STOP true

SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots;

DROP DATABASE IF EXISTS hurley;
DROP DATABASE IF EXISTS lapidus;

DROP ROLE IF EXISTS lapidus;
DROP ROLE IF EXISTS hurley;

CREATE ROLE lapidus PASSWORD '2PQM9aiKMJX5chv76gYdFJNi' SUPERUSER CREATEDB CREATEROLE INHERIT LOGIN;
CREATE DATABASE lapidus OWNER lapidus;

CREATE ROLE hurley PASSWORD '2PQM9aiKMJX5chv76gYdFJNi' SUPERUSER CREATEDB CREATEROLE INHERIT LOGIN;
CREATE DATABASE hurley OWNER hurley;

\c lapidus;

CREATE TYPE sex AS ENUM ('M', 'F');

CREATE TABLE IF NOT EXISTS "test_table" (
  "id" serial NOT NULL PRIMARY KEY,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(200) NOT NULL,
  "sex" sex DEFAULT NULL,
  "dob" timestamp DEFAULT NULL,
  "nullable" varchar(300) DEFAULT NULL
);
 
\c hurley;

CREATE TYPE sex AS ENUM ('M', 'F');

CREATE TABLE IF NOT EXISTS "test_table" (
  "id" serial NOT NULL PRIMARY KEY,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(200) NOT NULL,
  "sex" sex DEFAULT NULL,
  "dob" timestamp DEFAULT NULL,
  "nullable" varchar(300) DEFAULT NULL
);
