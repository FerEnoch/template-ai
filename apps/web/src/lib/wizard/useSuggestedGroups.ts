"use client";

import { useCallback, useEffect, useState } from "react";

export interface SuggestedGroupsState {
  suggestedGroupsStatus: Record<string, "pending" | "approved" | "rejected">;
  isLoading: boolean;
  error: string | null;
}

export function useSuggestedGroups(documentId: string | null | undefined) {
  const [state, setState] = useState<SuggestedGroupsState>({
    suggestedGroupsStatus: {},
    isLoading: false,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    if (!documentId) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/review/${documentId}/suggested-groups`);
      if (!response.ok) {
        throw new Error("Error al obtener los grupos sugeridos");
      }
      const data = (await response.json()) as {
        suggestedGroupsStatus?: Record<string, string>;
      };
      const status = data.suggestedGroupsStatus ?? {};
      // Narrow raw strings to the expected union.
      const narrowed: Record<string, "pending" | "approved" | "rejected"> = {};
      for (const [group, value] of Object.entries(status)) {
        if (value === "pending" || value === "approved" || value === "rejected") {
          narrowed[group] = value;
        }
      }
      setState({ suggestedGroupsStatus: narrowed, isLoading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      }));
    }
  }, [documentId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const updateStatus = useCallback(
    (group: string, next: "pending" | "approved" | "rejected") => {
      setState((prev) => ({
        ...prev,
        suggestedGroupsStatus: { ...prev.suggestedGroupsStatus, [group]: next },
      }));
    },
    []
  );

  return { ...state, fetchStatus, updateStatus };
}
