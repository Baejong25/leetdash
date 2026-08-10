"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * SSR-safe URL query synchronisation hook — replaces `useSearchParams`
 * so the explorer can server-render without a Suspense boundary.
 *
 * Server render: query is `null` → resolveSelection picks the first solver.
 * Client mount: reads `window.location.search` (no hydration mismatch
 * because both server and initial client render use null/default-first).
 * Popstate: re-reads URL so back/forward restores selection.
 *
 * Returns [query, setUser] where:
 * - `query` is `string | null` (null = server default)
 * - `setUser(userId)` updates local state immediately AND calls
 *   `router.replace(..., { scroll: false })`
 */
export function useClientQuery(): [string | null, (userId: string) => void] {
  const router = useRouter();
  const [query, setQuery] = useState<string | null>(null);

  // After hydration, read the real URL and listen for popstate.
  useEffect(() => {
    const readQuery = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("user"));
    };

    readQuery();
    window.addEventListener("popstate", readQuery);
    return () => window.removeEventListener("popstate", readQuery);
  }, []);

  const setUser = useCallback(
    (userId: string) => {
      setQuery(userId);
      router.replace(`?user=${encodeURIComponent(userId)}`, { scroll: false });
    },
    [router],
  );

  return [query, setUser];
}
