.PHONY: help up down install migrate deploy seed dev logs reset db-create

help:
	@echo "make install   — install dependencies for both apps"
	@echo "make up        — start postgres + redis (needs Docker)"
	@echo "make db-create — create role+database on an already-installed postgres"
	@echo "make migrate   — create the schema (dev, generates a migration)"
	@echo "make deploy    — apply existing migrations (other machines, CI, prod)"
	@echo "make seed      — load the catalogue, pujas, pandits and demo accounts"
	@echo "make dev       — run api (:4000) and web (:3000)"
	@echo "make reset     — drop the database and re-seed"

install:
	cd apps/api && npm install && npx prisma generate
	cd apps/web && npm install

up:
	docker compose -f infra/docker-compose.yml up -d postgres redis

down:
	docker compose -f infra/docker-compose.yml down

# For a Postgres installed directly on the host rather than via Docker.
# Runs as the superuser; harmless to re-run, it just reports "already exists".
db-create:
	psql -U postgres -h 127.0.0.1 -c "CREATE ROLE divyaloka WITH LOGIN PASSWORD 'divyaloka' CREATEDB;" || true
	psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE divyaloka OWNER divyaloka;" || true

migrate:
	cd apps/api && npx prisma migrate dev

# Use this on any machine that is not authoring schema changes — it applies the
# committed migrations exactly, and never invents a new one.
deploy:
	cd apps/api && npx prisma migrate deploy

seed:
	cd apps/api && npm run seed

dev:
	npx concurrently -n api,web -c yellow,cyan "cd apps/api && npm run dev" "cd apps/web && npm run dev"

logs:
	docker compose -f infra/docker-compose.yml logs -f

reset:
	cd apps/api && npx prisma migrate reset --force && npm run seed
