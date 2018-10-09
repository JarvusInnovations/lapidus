#!/bin/sh

sudo cp test/sql/bootstrap_postgresql.sql /tmp/bootstrap_postgresql.sql
sudo chown postgres:postgres /tmp/bootstrap_postgresql.sql
echo "Bootstrapping PostgreSQL 11"
sudo su postgres -c "psql -p5432 -f /tmp/bootstrap_postgresql.sql"
echo "Bootstrapping PostgreSQL 10"
sudo su postgres -c "psql -p5433 -f /tmp/bootstrap_postgresql.sql"
echo "Bootstrapping PostgreSQL 9.6"
sudo su postgres -c "psql -p5434 -f /tmp/bootstrap_postgresql.sql"

sudo curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable
sudo ln -s ~/.cargo/bin/cargo /usr/local/bin/cargo
sudo ln -s ~/.cargo/bin/rustc /usr/local/bin/rustc
sudo apt-get install -y pgxnclient
sudo bash -c "pgxn install jsoncdc --testing"

pgxn install jsoncdc --testing --pg_config /usr/lib/postgresql/11/bin/pg_config
pgxn install jsoncdc --testing --pg_config /usr/lib/postgresql/10/bin/pg_config
pgxn install jsoncdc --testing --pg_config /usr/lib/postgresql/9.6/bin/pg_config

