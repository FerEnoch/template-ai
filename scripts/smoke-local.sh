#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

STARTED_DEV=0
STARTED_TEST=0

log_phase() {
  printf "\n==> [%s] %s\n" "$1" "$2"
}

fail() {
  printf "ERROR: %s\n" "$1" >&2
  exit 1
}

compose_dev() {
  docker compose -f compose.yaml -f compose.dev.yaml --project-name template_ai_dev "$@"
}

compose_test() {
  docker compose -f compose.yaml -f compose.test.yaml --project-name template_ai_test "$@"
}

is_running() {
  local env="$1"
  local cid=""

  if [ "$env" = "dev" ]; then
    cid="$(compose_dev ps -q postgres 2>/dev/null || true)"
  else
    cid="$(compose_test ps -q postgres 2>/dev/null || true)"
  fi

  if [ -z "$cid" ]; then
    return 1
  fi

  [ "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || true)" = "true" ]
}

run_sql_dev() {
  printf '%s\n' "$1" | compose_dev exec -T postgres sh -lc 'PGOPTIONS="-c client_min_messages=warning" psql -q -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA'
}

run_sql_test() {
  printf '%s\n' "$1" | compose_test exec -T postgres sh -lc 'PGOPTIONS="-c client_min_messages=warning" psql -q -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA'
}

trim_line() {
  local value="$1"
  value="${value//$'\n'/}"
  value="${value//$'\r'/}"
  printf "%s" "$value"
}

assert_eq() {
  local actual expected message
  actual="$(trim_line "$1")"
  expected="$2"
  message="$3"

  if [ "$actual" != "$expected" ]; then
    fail "$message (expected '$expected', got '$actual')"
  fi
}

host_port() {
  local env="$1"
  local raw first_line=""

  if [ "$env" = "dev" ]; then
    raw="$(compose_dev port postgres 5432 2>/dev/null || true)"
  else
    raw="$(compose_test port postgres 5432 2>/dev/null || true)"
  fi

  while IFS= read -r line; do
    first_line="$line"
    break
  done <<< "$raw"

  [ -n "$first_line" ] || fail "Could not resolve published host port for $env postgres"
  printf "%s" "${first_line##*:}"
}

cleanup() {
  local status="$?"
  local cleanup_status=0
  trap - EXIT

  log_phase "cleanup" "Stopping only stacks started by smoke"

  if [ "$STARTED_TEST" -eq 1 ]; then
    printf '%s\n' "- test stack was started by smoke; stopping with make test-db-down"
    if ! make test-db-down >/dev/null; then
      printf "ERROR: failed to stop smoke-started test stack\n" >&2
      cleanup_status=1
    fi
  else
    printf '%s\n' "- test stack was not started by smoke; leaving it untouched"
  fi

  if [ "$STARTED_DEV" -eq 1 ]; then
    printf '%s\n' "- dev stack was started by smoke; stopping with make dev-down"
    if ! make dev-down >/dev/null; then
      printf "ERROR: failed to stop smoke-started dev stack\n" >&2
      cleanup_status=1
    fi
  else
    printf '%s\n' "- dev stack was not started by smoke; leaving it untouched"
  fi

  if [ "$status" -eq 0 ] && [ "$cleanup_status" -eq 0 ]; then
    printf "\nSMOKE RESULT: PASS\n"
    exit 0
  fi

  printf "\nSMOKE RESULT: FAIL\n" >&2
  if [ "$status" -ne 0 ]; then
    exit "$status"
  fi
  exit "$cleanup_status"
}

trap cleanup EXIT

log_phase "preflight" "Checking required tools and env files"
command -v docker >/dev/null 2>&1 || fail "docker is required. Install Docker Engine with Compose plugin first."
docker compose version >/dev/null 2>&1 || fail "docker compose is required. Install Docker Compose plugin first."
[ -f .env.dev ] || fail "Missing .env.dev. Run 'make env-dev-init' (or copy .env.dev.example to .env.dev) before running smoke."
[ -f .env.test ] || fail "Missing .env.test. Run 'make env-test-init' (or copy .env.test.example to .env.test) before running smoke."

log_phase "compose-config" "Validating dev/test compose file pairing"
compose_dev config >/dev/null
compose_test config >/dev/null

log_phase "startup/readiness" "Ensuring both stacks are running"
if is_running dev; then
  printf '%s\n' "- dev stack already running; will preserve it"
else
  printf '%s\n' "- starting dev stack via make dev"
  make dev >/dev/null
  STARTED_DEV=1
fi

if is_running test; then
  printf '%s\n' "- test stack already running; will preserve it"
else
  printf '%s\n' "- starting test stack via make test-db-up"
  make test-db-up >/dev/null
  STARTED_TEST=1
fi

is_running dev || fail "Dev stack is not running after startup phase"
is_running test || fail "Test stack is not running after startup phase"

log_phase "isolation" "Checking DB identity, host ports, and concurrent status"
dev_db="$(run_sql_dev "SELECT current_database();")"
test_db="$(run_sql_test "SELECT current_database();")"
assert_eq "$dev_db" "template_ai_dev" "Dev database identity mismatch"
assert_eq "$test_db" "template_ai_test" "Test database identity mismatch"

assert_eq "$(host_port dev)" "5432" "Dev host port mismatch"
assert_eq "$(host_port test)" "5433" "Test host port mismatch"
is_running dev || fail "Dev stack lost running status during isolation checks"
is_running test || fail "Test stack lost running status during isolation checks"

log_phase "reset-scope" "Verifying db-test-reset only affects test"
run_id="smoke_$(date +%s)"

run_sql_dev "CREATE TABLE IF NOT EXISTS public._smoke_sentinel (env text PRIMARY KEY, token text NOT NULL);"
run_sql_test "CREATE TABLE IF NOT EXISTS public._smoke_sentinel (env text PRIMARY KEY, token text NOT NULL);"
run_sql_dev "INSERT INTO public._smoke_sentinel (env, token) VALUES ('dev', '$run_id') ON CONFLICT (env) DO UPDATE SET token = EXCLUDED.token;"
run_sql_test "INSERT INTO public._smoke_sentinel (env, token) VALUES ('test', '$run_id') ON CONFLICT (env) DO UPDATE SET token = EXCLUDED.token;"

printf '%s\n' "- running make db-test-reset"
make db-test-reset >/dev/null
make wait-postgres-test >/dev/null

dev_sentinel="$(run_sql_dev "SELECT count(*) FROM public._smoke_sentinel WHERE env = 'dev' AND token = '$run_id';")"
test_table_present="$(run_sql_test "SELECT COALESCE(to_regclass('public._smoke_sentinel')::text, '');")"
if [ -n "$(trim_line "$test_table_present")" ]; then
  test_sentinel="$(run_sql_test "SELECT count(*) FROM public._smoke_sentinel WHERE env = 'test' AND token = '$run_id';")"
else
  test_sentinel="0"
fi

assert_eq "$dev_sentinel" "1" "Dev sentinel was modified by db-test-reset"
assert_eq "$test_sentinel" "0" "Test sentinel still exists after db-test-reset"
