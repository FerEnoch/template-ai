import type { Template, UpdateTemplateName } from "@template-ai/contracts";
import { safeFetch, handleResponse, ApiError } from "./cases";

export { ApiError };

export async function fetchTemplates(): Promise<Template[]> {
  const response = await safeFetch("/api/templates");
  return handleResponse<Template[]>(response);
}

export async function updateTemplateName(
  id: string,
  name: string,
  signal?: AbortSignal
): Promise<Template> {
  const response = await safeFetch(`/api/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name } satisfies UpdateTemplateName),
    signal,
  });
  return handleResponse<Template>(response);
}
