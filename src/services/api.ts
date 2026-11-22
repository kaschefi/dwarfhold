import type { ExpeditionResult } from "../types";

  export interface ExpeditionOptions {
    timeoutMs?: number;
    signal?: AbortSignal;
  }

  const DEFAULT_TIMEOUT_MS = 7000;

  export async function beginExpedition(
    dwarfId: string,
    destination: string,
    options?: ExpeditionOptions,
  ): Promise<ExpeditionResult> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error("EXPEDITION_TIMEOUT"));
    }, timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        controller.abort(options.signal?.reason);
      });
    }

    try {
      const response = await fetch("/api/expeditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dwarfId, destination }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `Expedition failed (${response.status})`;
        try {
          const errorData = (await response.json()) as { error?: string };
          if (errorData?.error) errorMessage = errorData.error;
        } catch {
          // Fallback to HTTP status if body is not valid JSON
        }
        throw new Error(errorMessage);
      }

      return (await response.json()) as ExpeditionResult;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Expedition timed out. The scout lost the trail and returned safely.");
      }
      if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
        throw new Error("Cannot reach the expedition outpost. Check network connection.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
