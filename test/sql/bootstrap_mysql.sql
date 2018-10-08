-- CREATE USER IF NOT EXISTS jacob IDENTIFIED BY '2PQM9aiKMJX5chv76gYdFJNi';
-- CREATE USER IF NOT EXISTS sawyer IDENTIFIED BY '2PQM9aiKMJX5chv76gYdFJNi';

CREATE DATABASE IF NOT EXISTS jacob;
CREATE DATABASE IF NOT EXISTS sawyer;

-- Uncomment these lines for MariaDB
-- SET GLOBAL binlog_format=ROW;
-- SET sql_log_bin = 1;
-- SET GLOBAL binlog_annotate_row_events=ON;

SET GLOBAL time_zone="+00:00";

USE jacob;

DROP TABLE IF EXISTS `test_table`;

CREATE TABLE IF NOT EXISTS `test_table` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(200) NOT NULL,
  `sex` enum('M','F') DEFAULT NULL,
  `dob` datetime DEFAULT NULL,
  `nullable` varchar(300) DEFAULT NULL,
   PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

GRANT REPLICATION SLAVE, REPLICATION CLIENT, USAGE, SELECT ON *.* TO 'jacob'@'localhost' IDENTIFIED BY '2PQM9aiKMJX5chv76gYdFJNi';
GRANT ALL PRIVILEGES ON *.* TO 'jacob'@'localhost' IDENTIFIED BY '2PQM9aiKMJX5chv76gYdFJNi';

FLUSH PRIVILEGES;

USE sawyer;

DROP TABLE IF EXISTS `test_table`;

CREATE TABLE IF NOT EXISTS `test_table` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(200) NOT NULL,
  `sex` enum('M','F') DEFAULT NULL,
  `dob` datetime DEFAULT NULL,
  `nullable` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

GRANT REPLICATION SLAVE, REPLICATION CLIENT, USAGE, SELECT ON *.* TO 'sawyer'@'localhost' IDENTIFIED BY '2PQM9aiKMJX5chv76gYdFJNi';
GRANT ALL PRIVILEGES ON *.* TO 'sawyer'@'localhost' IDENTIFIED BY '2PQM9aiKMJX5chv76gYdFJNi';

FLUSH PRIVILEGES;

