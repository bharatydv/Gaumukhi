.PHONY: help up down install migrate seed dev logs reset

help:
	@echo "make install   — install dependencies for both apps"
	@echo "make up        — start postgres + redis"
	@echo "make migrate   — create the schema"
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

migrate:
	cd apps/api && npx prisma migrate dev --name init

seed:
	cd apps/api && npm run seed

dev:
	npx concurrently -n api,web -c yellow,cyan "cd apps/api && npm run dev" "cd apps/web && npm run dev"

logs:
	docker compose -f infra/docker-compose.yml logs -f

reset:
	cd apps/api && npx prisma migrate reset --force && npm run seed
