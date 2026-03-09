"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface MutationOptions {
  /** Refresh server components after success */
  refresh?: boolean;
  /** Callback on success */
  onSuccess?: () => void;
}

interface MutationState {
  loading: boolean;
  status: { type: "success" | "error"; message: string } | null;
}

export function useAdminMutation(options?: MutationOptions) {
  const router = useRouter();
  const [state, setState] = useState<MutationState>({ loading: false, status: null });

  const clearStatus = useCallback(() => setState((s) => ({ ...s, status: null })), []);

  const mutate = useCallback(
    async (
      url: string,
      init: RequestInit & { successMessage?: string }
    ): Promise<Response | null> => {
      const { successMessage = "Enregistré", ...fetchInit } = init;
      setState({ loading: true, status: null });

      try {
        const response = await fetch(url, {
          headers: { "Content-Type": "application/json", ...fetchInit.headers },
          ...fetchInit,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const msg = data.error || `Erreur ${response.status}`;
          setState({ loading: false, status: { type: "error", message: msg } });
          return null;
        }

        setState({ loading: false, status: { type: "success", message: successMessage } });
        if (options?.refresh) router.refresh();
        options?.onSuccess?.();

        // Auto-clear success after 3s
        setTimeout(() => {
          setState((s) => (s.status?.type === "success" ? { ...s, status: null } : s));
        }, 3000);

        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setState({ loading: false, status: { type: "error", message: msg } });
        return null;
      }
    },
    [options, router]
  );

  return { ...state, mutate, clearStatus };
}
