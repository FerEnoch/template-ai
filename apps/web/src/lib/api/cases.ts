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

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(body || response.statusText, response.status);
  }
  return response.json() as Promise<T>;
}

export async function fetchTemplate(id: string): Promise<Template> {
  const response = await fetch(`/api/templates/${id}`);
  return handleResponse<Template>(response);
}

export async function createCase(templateId: string): Promise<Case> {
  const response = await fetch("/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId } satisfies CreateCaseRequest),
  });
  return handleResponse<Case>(response);
}

export async function fetchCase(id: string): Promise<CaseWithTemplate> {
  const response = await fetch(`/api/cases/${id}`);
  return handleResponse<CaseWithTemplate>(response);
}

export async function updateCase(
  id: string,
  data: UpdateCaseFormData
): Promise<Case> {
  const response = await fetch(`/api/cases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Case>(response);
}

export async function generateCase(id: string): Promise<Case> {
  const response = await fetch(`/api/cases/${id}/generate`, {
    method: "POST",
  });
  return handleResponse<Case>(response);
}

export async function fetchExtractedText(
  id: string
): Promise<ExtractedTextResponse> {
  const response = await fetch(`/api/templates/${id}/extracted-text`);
  return handleResponse<ExtractedTextResponse>(response);
}
