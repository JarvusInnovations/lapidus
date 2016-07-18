SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots;

-- ********************************************************
-- The following bits are needed when run outside of Travis
-- ********************************************************
-- DROP DATABASE IF EXISTS jacob;
-- DROP DATABASE IF EXISTS sawyer;

-- DROP ROLE IF EXISTS jacob;
-- DROP ROLE IF EXISTS sawyer;

-- CREATE ROLE jacob LOGIN PASSWORD '2PQM9aiKMJX5chv76gYdFJNi';
-- CREATE ROLE sawyer LOGIN PASSWORD '2PQM9aiKMJX5chv76gYdFJNi';

-- CREATE DATABASE jacob OWNER jacob;
-- CREATE DATABASE sawyer OWNER sawyer;

\c jacob;

CREATE TYPE sex AS ENUM ('M', 'F');

CREATE TABLE "test_table" (
  "id" serial NOT NULL PRIMARY KEY,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(200) NOT NULL,
  "sex" sex DEFAULT NULL,
  "dob" timestamp DEFAULT NULL,
  "nullable" varchar(300) DEFAULT NULL
);
 
\c sawyer;

CREATE TYPE sex AS ENUM ('M', 'F');

CREATE TABLE "test_table" (
  "id" serial NOT NULL PRIMARY KEY,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(200) NOT NULL,
  "sex" sex DEFAULT NULL,
  "dob" timestamp DEFAULT NULL,
  "nullable" varchar(300) DEFAULT NULL
);
