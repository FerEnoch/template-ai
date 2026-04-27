COMPOSE_BASE = docker compose -f compose.yaml
COMPOSE_DEV = $(COMPOSE_BASE) -f compose.dev.yaml --project-name template_ai_dev
COMPOSE_TEST = $(COMPOSE_BASE) -f compose.test.yaml --project-name template_ai_test
WAIT_RETRIES ?= 30
WAIT_SLEEP ?= 2

.PHONY: \
	env-dev-init env-test-init env-init preflight-env-dev preflight-env-test \
	wait-postgres-dev wait-postgres-test \
	dev dev-down dev-logs dev-ps db-dev-shell db-dev-reset \
	test-db-up test-db-down test-db-logs test-db-ps db-test-shell db-test-reset \
	smoke test help

define wait_for_postgres
	@attempt=1; \
	while [ $$attempt -le $(WAIT_RETRIES) ]; do \
		if $(1) exec -T postgres sh -lc 'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' >/dev/null 2>&1; then \
			printf "PostgreSQL is ready for %s (attempt %s/%s).\n" "$(2)" "$$attempt" "$(WAIT_RETRIES)"; \
			exit 0; \
		fi; \
		printf "Waiting for PostgreSQL (%s): attempt %s/%s...\n" "$(2)" "$$attempt" "$(WAIT_RETRIES)"; \
		attempt=$$((attempt + 1)); \
		sleep $(WAIT_SLEEP); \
	done; \
	printf "ERROR: PostgreSQL readiness timed out for %s after %ss (%s attempts x %ss).\n" "$(2)" "$$(( $(WAIT_RETRIES) * $(WAIT_SLEEP) ))" "$(WAIT_RETRIES)" "$(WAIT_SLEEP)" >&2; \
	printf "Hint: inspect status with '%s ps' and logs with '%s logs postgres'.\n" "$(1)" "$(1)" >&2; \
	exit 1
endef

help:
	@printf "Local operations (PostgreSQL only):\n"
	@printf "  NOTE: App install/dev/lint/typecheck run via pnpm (workspace scripts), not Make.\n"
	@printf "  make env-dev-init   # Create .env.dev from example if missing\n"
	@printf "  make env-test-init  # Create .env.test from example if missing\n"
	@printf "  make env-init       # Initialize both env files if missing\n"
	@printf "  make dev            # Start dev PostgreSQL stack\n"
	@printf "  make dev-down       # Stop dev stack\n"
	@printf "  make dev-logs       # Show dev PostgreSQL logs\n"
	@printf "  make dev-ps         # Show dev stack status\n"
	@printf "  make db-dev-shell   # Open psql in dev DB\n"
	@printf "  make db-dev-reset   # Recreate dev DB storage\n"
	@printf "  make test-db-up     # Start test PostgreSQL stack\n"
	@printf "  make test-db-down   # Stop test stack\n"
	@printf "  make test-db-logs   # Show test PostgreSQL logs\n"
	@printf "  make test-db-ps     # Show test stack status\n"
	@printf "  make db-test-shell  # Open psql in test DB\n"
	@printf "  make db-test-reset  # Recreate test DB storage\n"
	@printf "  make smoke          # Run local PostgreSQL smoke contract checks\n"
	@printf "  make preflight-env-dev  # Verify .env.dev exists\n"
	@printf "  make preflight-env-test # Verify .env.test exists\n"
	@printf "  make test           # Reserved test runner target\n"

smoke:
	@./scripts/smoke-local.sh

env-dev-init:
	@if [ -f .env.dev ]; then \
		printf ".env.dev already exists. Keeping current file.\n"; \
	else \
		cp .env.dev.example .env.dev; \
		printf "Created .env.dev from .env.dev.example\n"; \
	fi

env-test-init:
	@if [ -f .env.test ]; then \
		printf ".env.test already exists. Keeping current file.\n"; \
	else \
		cp .env.test.example .env.test; \
		printf "Created .env.test from .env.test.example\n"; \
	fi

env-init: env-dev-init env-test-init

preflight-env-dev:
	@if [ ! -f .env.dev ]; then \
		printf "Missing .env.dev. Run 'make env-dev-init' (or copy .env.dev.example to .env.dev) before starting compose targets.\n" >&2; \
		exit 1; \
	fi

preflight-env-test:
	@if [ ! -f .env.test ]; then \
		printf "Missing .env.test. Run 'make env-test-init' (or copy .env.test.example to .env.test) before starting compose targets.\n" >&2; \
		exit 1; \
	fi

wait-postgres-dev: preflight-env-dev
	$(call wait_for_postgres,$(COMPOSE_DEV),dev)

wait-postgres-test: preflight-env-test
	$(call wait_for_postgres,$(COMPOSE_TEST),test)

dev: preflight-env-dev
	$(COMPOSE_DEV) up -d postgres
	$(MAKE) wait-postgres-dev

dev-down: preflight-env-dev
	$(COMPOSE_DEV) down

dev-logs: preflight-env-dev
	$(COMPOSE_DEV) logs postgres

dev-ps: preflight-env-dev
	$(COMPOSE_DEV) ps

db-dev-shell: preflight-env-dev
	$(COMPOSE_DEV) exec postgres sh -lc 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

db-dev-reset: preflight-env-dev
	$(COMPOSE_DEV) down -v
	$(COMPOSE_DEV) up -d postgres
	$(MAKE) wait-postgres-dev

test-db-up: preflight-env-test
	$(COMPOSE_TEST) up -d postgres
	$(MAKE) wait-postgres-test

test-db-down: preflight-env-test
	$(COMPOSE_TEST) down

test-db-logs: preflight-env-test
	$(COMPOSE_TEST) logs postgres

test-db-ps: preflight-env-test
	$(COMPOSE_TEST) ps

db-test-shell: preflight-env-test
	$(COMPOSE_TEST) exec postgres sh -lc 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

db-test-reset: preflight-env-test
	$(COMPOSE_TEST) down -v
	$(COMPOSE_TEST) up -d postgres
	$(MAKE) wait-postgres-test

test:
	@printf "test runner not implemented yet. Use make test-db-up for local DB setup.\n" >&2
	@exit 1
