# Template AI

Plataforma para abogados que transforma documentos legales existentes en plantillas inteligentes reutilizables. Sube un escrito judicial o contrato, la IA detecta su estructura y datos variables, un humano revisa y valida el resultado, y el sistema genera documentos finales por caso con exportacion a PDF y DOCX.

## Que resuelve

Los abogados redactan una y otra vez documentos con la misma estructura y solo cambian los datos concretos: nombres de las partes, fechas, juzgados, montos. Template AI automatiza ese ciclo sin sacrificar el control profesional: la revision humana es obligatoria en cada paso.

## Funcionalidades principales

- Carga de documentos legales (PDF, DOCX, JPG) con deteccion de duplicados.
- Analisis con IA que identifica la estructura fija del documento y los campos variables.
- Revision humana de las entidades detectadas antes de guardar.
- Biblioteca personal de plantillas reutilizables.
- Creacion de casos nuevos completando un formulario derivado de la plantilla.
- Generacion de documentos finales con exportacion a PDF y DOCX.

## Stack

| Capa | Tecnologia |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| Backend | NestJS 10, TypeScript, BullMQ |
| Base de datos | PostgreSQL 16, Row-Level Security |
| Cache y colas | Redis 7, BullMQ |
| IA | OpenRouter (OpenAI SDK), detras de interfaz propia |
| Testing | Vitest, Playwright, MSW |
| Infraestructura | Docker Compose, pnpm workspace |
| Diseno | Design tokens en Stitch, Tailwind CSS v4 |

## Requisitos

- Node.js >= 22 < 23
- pnpm 11.5.1
- Docker y Docker Compose

## Onboarding

### 1. Clonar e instalar

```bash
git clone <repo-url> template-ai
cd template-ai
pnpm install
```

### 2. Configurar variables de entorno

```bash
make env-init
```

Esto crea `.env.dev` y `.env.test` a partir de los templates `.env.dev.example` y `.env.test.example`. Edita ambos archivos con tus valores reales (credenciales de base de datos, API key de OpenRouter, etc.).

### 3. Levantar infraestructura local

```bash
make dev          # PostgreSQL (5432) + Redis (6379) para desarrollo
```

Para tests:

```bash
make test-db-up   # PostgreSQL (5433) + Redis (6380) aislados
make smoke        # Verifica que los entornos no se pisen
```

### 4. Ejecutar la aplicacion

```bash
pnpm dev:api      # Backend NestJS en modo watch
pnpm dev:web      # Frontend Next.js en http://localhost:3000
```

El frontend hace proxy de `/api/*` al backend via `next.config.ts`.

### 5. Correr migraciones

```bash
cd apps/api
pnpm db:migrate
```

### 6. Ejecutar tests

```bash
pnpm --filter @template-ai/api test        # Tests unitarios y de integracion del backend
pnpm --filter @template-ai/web test        # Tests unitarios del frontend
pnpm --filter @template-ai/web test:e2e    # Tests end-to-end con Playwright
pnpm --filter @template-ai/contracts test  # Tests de schemas compartidos
pnpm typecheck                              # TypeScript en todo el monorepo
pnpm lint                                   # ESLint en todo el monorepo
```

## Estructura del proyecto

```
apps/api/           Backend NestJS (TypeScript)
apps/web/           Frontend Next.js (React + TypeScript)
packages/contracts/ Schemas Zod compartidos entre API y Web
docs/               Documentacion del proyecto
  architecture/     ADR del stack y modelo de dominio
  database/         Esquema PostgreSQL y DDL
  product/          PRD del MVP
  infrastructure/   Guia de infraestructura local
  design/           Prompts de diseno y mockups
openspec/           Especificaciones SDD (24 specs canonicas)
.stitch/            Sistema de diseno en Stitch
.atl/               Guias para agentes AI del proyecto
scripts/            Scripts auxiliares (smoke tests)
```

## Documentacion

El proyecto tiene documentacion extensa en la carpeta `docs/`:

- **[PRD del MVP](docs/product/prd-mvp-template-ai.md)** — problema, usuarios, flows, metricas y riesgos.
- **[ADR del stack](docs/architecture/stack-technological-adr.md)** — decisiones de arquitectura, tradeoffs y consecuencias.
- **[Modelo de dominio](docs/architecture/domain-conceptual-model.md)** — bounded contexts, entidades, relaciones e invariantes.
- **[Esquema de base de datos](docs/database/example_initial_schema.sql)** — DDL completo con RLS, indices y comentarios.
- **[Arquitectura de cacheo](apps/api/docs/caching.md)** — cacheo en 3 capas con Redis.
- **[Guia de infraestructura local](docs/infrastructure/local-operational-infra.md)** — Makefile, Docker y smoke tests.

## Arquitectura

El proyecto sigue una arquitectura de **Puertos y Adaptadores (Hexagonal)**. Toda dependencia externa (IA, storage, OCR, cache) se encuentra detras de interfaces definidas en el dominio, con adaptadores concretos en `apps/api/src/infrastructure/`. Esto permite cambiar proveedores sin tocar la logica de negocio.

## Contribuir

Este es un proyecto privado. Si formas parte del equipo:

1. Parti de `main` y crea una rama con prefijo segun el tipo de cambio: `feature/`, `fix/`, `docs/`, `chore/`.
2. Mantene los tests verdes. Agrega tests para codigo nuevo.
3. Usa commits convencionales (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
4. El codigo se escribe en ingles; la documentacion y los prompts de IA van en espanol.
5. Antes de abrir un PR, corre `pnpm typecheck && pnpm lint` en la raiz del proyecto.
6. Las migraciones de base de datos son SQL crudo. No uses un ORM para definir el esquema.
7. Para cambios que toquen la IA, lee primero `docs/architecture/stack-technological-adr.md` y las specs en `openspec/specs/ai-*/`.

Las decisiones de arquitectura se documentan en la carpeta `docs/architecture/` y las specs funcionales en `openspec/specs/`.
