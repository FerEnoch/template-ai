# ADR — Stack tecnológico MVP `template-ai`

## Estado
**Aceptado** (MVP).

## Contexto
`template-ai` necesita procesar documentos legales para detectar estructura y datos variables, con revisión humana obligatoria, biblioteca de plantillas reutilizables, generación de nuevos documentos y foco en confianza (trazabilidad, confidencialidad y borrado claro). Se prioriza velocidad de entrega sin comprometer reemplazo futuro de proveedores.

## Decisiones
- **Frontend**: Next.js.
- **Backend**: NestJS.
- **Base de datos de dominio**: PostgreSQL (fuente de verdad única del estado de negocio).
- **Object storage**: Cloud Storage for Firebase (archivos originales y artefactos binarios).
- **Autenticación MVP**: Google OAuth únicamente.
- **OCR / extracción inicial**: OpenRouter, encapsulado detrás de interfaces.
- **Ruteo de proveedores LLM inicial**: OpenRouter, encapsulado detrás de interfaces.
- **Trabajos async**: BullMQ + Redis **solo** para cargas pesadas o diferidas.
- **Tooling base**: pnpm, TypeScript, Node.js, Vitest, ESLint, Docker y Docker Compose.
- **i18n**: arquitectura preparada para internacionalización; MVP en español.
- **Estrategia de entornos**: desarrollo y testing se operan explícitamente separados de producción en configuración, datos y ejecución.
- **Ejecución con Docker por entorno**: se lanzan stacks/instancias distintas por entorno (por ejemplo, `docker-compose` con archivos o perfiles por entorno), evitando compartir runtime y dependencias entre dev/test/prod.
- **Entry point operativo**: se estandariza un **Makefile** como interfaz principal para comandos frecuentes (dev, test, DB y ciclo de vida Docker).

## Principio arquitectónico clave
Todo acceso a servicios externos (auth, storage, OCR/extracción, LLM) se define por **puertos/interfaces** en dominio/aplicación. Los adaptadores de proveedor se implementan en infraestructura para evitar lock-in y habilitar reemplazo gradual sin romper casos de uso.

## Consecuencias positivas
- Reduce riesgo de dependencia temprana de vendor.
- Mantiene el modelo de dominio consistente en PostgreSQL.
- Permite iterar rápido en MVP y cambiar proveedor luego con impacto acotado.
- Facilita testing (mocks/fakes por interfaz).

## Tradeoffs / Costos
- Mayor costo inicial de diseño (interfaces + adaptadores) versus integración directa.
- Más componentes y contratos para mantener.
- OpenRouter agrega una capa extra operacional y de diagnóstico.
- BullMQ/Redis introduce complejidad si se activa prematuramente.
- Separar entornos y stacks agrega mantenimiento operativo (más configuración), pero reduce riesgo de contaminación de datos y "drift" entre ejecución local y pipelines.

## Estrategia operativa mínima por entorno (MVP)
- **Dev**: stack local con recarga rápida y datos no productivos.
- **Test**: stack aislado para pruebas automatizadas (idealmente efímero), sin reutilizar base de datos de dev.
- **Prod**: stack endurecido, con configuración y credenciales independientes.
- **Docker Compose**: usar archivos/perfiles por entorno (`compose.dev`, `compose.test`, `compose.prod` o equivalente) según necesidad real, sin sobrediseñar infraestructura en MVP.
- **Makefile obligatorio**: exponer comandos estándar y reproducibles (`make dev`, `make test`, `make db-*`, `make docker-up/down/logs`, etc.) para reducir dependencia de conocimiento tribal.

## Próximo paso recomendado
Definir y documentar contratos mínimos de puertos (`AuthPort`, `ObjectStoragePort`, `ExtractionPort`, `LLMPort`) y criterios de aceptación por caso de uso antes de implementación detallada.
