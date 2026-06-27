import type {
  Template,
  Case,
  CreateCaseRequest,
  UpdateCaseFormData,
} from "@template-ai/contracts";

export interface CaseWithTemplate extends Case {
  template: Template;
}

export interface ExtractedTextResponse {
  extractedText: string | null;
}

/**
 * Error thrown by all API functions. Carries a user-friendly message
 * (already parsed from the backend JSON or a Spanish fallback) and the
 * HTTP status. Status 0 indicates a network/connection failure.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Spanish fallback messages for HTTP status codes.
 * Used when the backend response body is empty, not JSON, or lacks an
 * explicit error field.
 */
function fallbackMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Los datos enviados no son válidos. Revisá los campos e intentá nuevamente.";
    case 401:
      return "Tu sesión expiró. Recargá la página e iniciá sesión nuevamente.";
    case 403:
      return "No tenés permisos para realizar esta acción.";
    case 404:
      return "El recurso solicitado no existe o fue eliminado.";
    case 409:
      return "El recurso no puede modificarse porque está bloqueado o en uso.";
    case 422:
      return "Los datos no pasaron la validación. Revisá los campos.";
    case 429:
      return "Demasiadas solicitudes. Esperá unos segundos e intentá nuevamente.";
    case 503:
      return "El servicio no está disponible temporalmente. Intentá nuevamente en unos momentos.";
    case 504:
      return "La solicitud tardó demasiado. Intentá nuevamente.";
    default:
      return "Ocurrió un error inesperado. Intentá nuevamente.";
  }
}

/**
 * Parse a non-OK response body into a user-friendly message.
 *
 * The backend exception filter returns `{ error: "..." }` JSON. We extract
 * that field. If the body isn't JSON or has no error field, we fall back to
 * a status-based Spanish message so the user never sees raw JSON or an
 * unhelpful English status text.
 */
async function parseErrorResponse(response: Response): Promise<string> {
  let body: string;
  try {
    body = await response.text();
  } catch {
    return fallbackMessageForStatus(response.status);
  }

  if (body.trim()) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error;
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      // Body is plain text — use it directly if it's short and readable
      const text = body.trim();
      if (text.length > 0 && text.length <= 200) {
        return text;
      }
    }
  }

  return fallbackMessageForStatus(response.status);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await parseErrorResponse(response);
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

/**
 * Wrap fetch() to catch network-level failures (ECONNRESET, DNS errors,
 * server down) that never produce a Response object. These surface as
 * TypeError from fetch() and would otherwise show "fetch failed" to the
 * user.
 */
async function safeFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor. Verificá tu conexión e intentá nuevamente.",
      0
    );
  }
}

export async function fetchTemplate(id: string): Promise<Template> {
  const response = await safeFetch(`/api/templates/${id}`);
  return handleResponse<Template>(response);
}

export async function createCase(templateId: string): Promise<Case> {
  const response = await safeFetch("/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId } satisfies CreateCaseRequest),
  });
  return handleResponse<Case>(response);
}

export async function fetchCase(id: string): Promise<CaseWithTemplate> {
  const response = await safeFetch(`/api/cases/${id}`);
  return handleResponse<CaseWithTemplate>(response);
}

export async function updateCase(
  id: string,
  data: UpdateCaseFormData
): Promise<Case> {
  const response = await safeFetch(`/api/cases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Case>(response);
}

export async function generateCase(id: string): Promise<Case> {
  const response = await safeFetch(`/api/cases/${id}/generate`, {
    method: "POST",
  });
  return handleResponse<Case>(response);
}

export async function fetchExtractedText(
  id: string
): Promise<ExtractedTextResponse> {
  const response = await safeFetch(`/api/templates/${id}/extracted-text`);
  return handleResponse<ExtractedTextResponse>(response);
}
