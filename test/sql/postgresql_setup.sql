SET client_min_messages TO WARNING;

-- Drop existing logical replication slots
SELECT pg_drop_replication_slot(slot_name)
  FROM pg_replication_slots
 WHERE database = 'lapidus'
    OR database = 'hurley';

-- Drop existing databases
DROP DATABASE IF EXISTS lapidus;
DROP DATABASE IF EXISTS hurley;

-- Create lapidus role and database
CREATE ROLE lapidus PASSWORD '2PQM9aiKMJX5chv76gYdFJNi' SUPERUSER CREATEDB CREATEROLE INHERIT LOGIN;
CREATE DATABASE lapidus OWNER lapidus;

-- Create hurley role and database
CREATE ROLE hurley PASSWORD '2PQM9aiKMJX5chv76gYdFJNi' SUPERUSER CREATEDB CREATEROLE INHERIT LOGIN;
CREATE DATABASE hurley OWNER hurley;

\c lapidus;

CREATE TYPE sex AS ENUM ('M', 'F');

CREATE TABLE "test_table" (
  "id" serial NOT NULL PRIMARY KEY,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(200) NOT NULL,
  "sex" sex DEFAULT NULL,
  "dob" timestamp DEFAULT NULL,
  "nullable" varchar(300) DEFAULT NULL
);
 
\c hurley;

CREATE TYPE sex AS ENUM ('M', 'F');

CREATE TABLE "test_table" (
  "id" serial NOT NULL PRIMARY KEY,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(200) NOT NULL,
  "sex" sex DEFAULT NULL,
  "dob" timestamp DEFAULT NULL,
  "nullable" varchar(300) DEFAULT NULL
);
