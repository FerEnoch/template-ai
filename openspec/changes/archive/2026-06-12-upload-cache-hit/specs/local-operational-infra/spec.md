# Delta for local-operational-infra

## MODIFIED Requirements

### Requirement: Explicit non-goals

This change MUST NOT introduce app containers, Dockerfiles, workers, migrations or seed containers, CI/CD workflows, or production deployment assets. Redis MUST remain a dev-only dependency declared exclusively in `compose.dev.yaml` and MUST NOT appear in the shared `compose.yaml` baseline. Redis now serves a dual role (BullMQ broker + cache store); key namespace and client wiring MUST prevent collisions without requiring a second Redis instance. This change MUST NOT silently create `.env.dev` or `.env.test` from normal start/reset commands, and it MUST NOT expand image pinning beyond an exact patch-level Alpine tag.
(Previously: Redis was introduced only as a BullMQ broker; its scope excluded any caching role.)

#### Scenario: Scope remains minimal

- GIVEN the completed change
- WHEN the infrastructure files are reviewed
- THEN only PostgreSQL-focused local operational assets and the dev-only Redis override are introduced
- AND no production or application runtime stack is added

#### Scenario: Redis lives only in the dev override

- GIVEN the completed change
- WHEN `compose.yaml` and `compose.dev.yaml` are reviewed
- THEN the shared `compose.yaml` baseline does not declare a Redis service
- AND `compose.dev.yaml` adds Redis only for local development

## ADDED Requirements

### Requirement: Redis cache key namespace isolation

Redis keys used for AI caching MUST use the `ai:resp:` and `ai:text:` prefixes. Keys used by BullMQ MUST remain under the default `bull:` namespace (or the `analysis-queue` prefix already established). No cache key prefix MUST overlap with any BullMQ key namespace. The single Redis client instance MUST be shared across all consumers (BullMQ, text cache, AI response cache) without introducing a second Redis connection.

#### Scenario: Cache and queue keys do not collide

- GIVEN the dev stack is running with Redis
- WHEN a cache write (`ai:text:abc123`) and a BullMQ job enqueue occur concurrently
- THEN no key collision occurs
- AND both systems operate from the same Redis instance

#### Scenario: Single client serves all consumers

- GIVEN the NestJS application is booted
- WHEN `CachePort` is resolved and `BullModule` is initialized
- THEN both use the same underlying Redis connection
- AND no second Redis client is instantiated

### Requirement: Cache-specific env vars in dev example

`.env.dev.example` MUST declare `AI_CACHE_ENABLED`, `AI_RESPONSE_CACHE_TTL`, and `AI_TEXT_CACHE_TTL` with dev-safe defaults (`true`, `604800`, `604800`). The values MUST be safe to commit. The dev bootstrap preflight MUST continue to verify `.env.dev` exists before starting Compose.

#### Scenario: Operator sees cache vars in the example

- GIVEN a fresh clone
- WHEN the operator opens `.env.dev.example`
- THEN `AI_CACHE_ENABLED`, `AI_RESPONSE_CACHE_TTL`, and `AI_TEXT_CACHE_TTL` are present with example values
- AND copying to `.env.dev` produces a working dev configuration
