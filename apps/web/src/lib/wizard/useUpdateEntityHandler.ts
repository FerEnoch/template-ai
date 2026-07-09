import { useCallback } from "react";
import type { Entity } from "@template-ai/contracts";

interface UseUpdateEntityHandlerOptions {
  analysisResultId: string | null;
  getEntityById: (id: string) => Entity | undefined;
  updateEntity: (entity: Entity) => void;
  onError: (message: string) => void;
}

interface UpdateEntityBody {
  reviewed: boolean;
  value: string;
  excluded?: boolean;
}

/**
 * Hook that encapsulates the entity update persistence flow.
 *
 * The UI updates optimistically for responsiveness, but if the backend rejects
 * the request we roll back to the previous entity state and surface the error.
 */
export function useUpdateEntityHandler({
  analysisResultId,
  getEntityById,
  updateEntity,
  onError,
}: UseUpdateEntityHandlerOptions) {
  return useCallback(
    async (entity: Entity) => {
      if (!analysisResultId) {
        onError("No se encontró el documento en revisión");
        return;
      }

      const previousEntity = getEntityById(entity.id);
      // Optimistic update for responsive UI
      updateEntity(entity);

      const body: UpdateEntityBody = {
        reviewed: entity.reviewed,
        value: entity.value,
        ...(entity.excluded !== undefined && { excluded: entity.excluded }),
      };

      try {
        const response = await fetch(
          `/api/review/${analysisResultId}/entities/${entity.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          let message = "Error al actualizar la entidad";
          try {
            const error = await response.json();
            message = error.error || message;
          } catch {
            message = `Error del servidor (${response.status})`;
          }
          throw new Error(message);
        }
      } catch (err) {
        // Rollback optimistic update so UI stays consistent with backend
        if (previousEntity) {
          updateEntity(previousEntity);
        }
        onError(
          err instanceof Error
            ? err.message
            : "Error al actualizar la entidad"
        );
      }
    },
    [analysisResultId, getEntityById, updateEntity, onError]
  );
}
