import { useCallback } from "react";
import type { Entity } from "@template-ai/contracts";

interface UseCreateEntityHandlerOptions {
  analysisResultId: string | null;
  addEntity: (entity: Entity) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

/**
 * Hook that encapsulates the manual entity persistence flow.
 *
 * IMPORTANT: the entity is added to the wizard state ONLY after the backend
 * confirms the creation. This prevents phantom entities when the API rejects
 * the request (e.g. MANUAL_ENTITY_LIMIT_REACHED).
 */
export function useCreateEntityHandler({
  analysisResultId,
  addEntity,
  onSuccess,
  onError,
}: UseCreateEntityHandlerOptions) {
  return useCallback(
    async (entity: Entity) => {
      if (!analysisResultId) {
        onError("No se encontró el documento en revisión");
        return;
      }

      try {
        const response = await fetch(
          `/api/review/${analysisResultId}/entities`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entity),
          }
        );

        if (!response.ok) {
          let message = "Error al guardar la entidad";
          try {
            const error = await response.json();
            message = error.error || message;
          } catch {
            message = `Error del servidor (${response.status})`;
          }
          throw new Error(message);
        }

        let data: { entity?: Entity };
        try {
          data = await response.json();
        } catch {
          throw new Error("Respuesta del servidor inválida");
        }
        addEntity(data.entity ?? entity);
        onSuccess();
      } catch (err) {
        onError(
          err instanceof Error ? err.message : "Error al guardar la entidad"
        );
      }
    },
    [analysisResultId, addEntity, onSuccess, onError]
  );
}
