/**
 * @vitest-environment jsdom
 *
 * Tests for useClientQuery hook — SSR-safe URL query synchronisation
 * that replaces useSearchParams without Suspense.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClientQuery } from "@/app/components/use-client-query";

// Mock next/navigation router
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// ── URL helpers ──────────────────────────────────────────────────────────────

function setLocationSearch(search: string) {
  Object.defineProperty(window, "location", {
    value: {
      ...window.location,
      search,
    },
    writable: true,
    configurable: true,
  });
}

function dispatchPopstate() {
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("useClientQuery", () => {
  afterEach(() => {
    vi.clearAllMocks();
    // Reset location to empty search
    setLocationSearch("");
  });

  it("initialises with null (SSR-safe default, no hydration mismatch)", () => {
    setLocationSearch("");
    const { result } = renderHook(() => useClientQuery());
    const [query] = result.current;
    expect(query).toBeNull();
  });

  it("reads ?user= param from window.location.search after mount", async () => {
    setLocationSearch("?user=alice");
    const { result, rerender } = renderHook(() => useClientQuery());

    // After effect runs, query should be set
    await vi.waitFor(() => {
      const [query] = result.current;
      return query === "alice";
    });

    const [query] = result.current;
    expect(query).toBe("alice");
  });

  it("returns null when ?user= is absent from search", async () => {
    setLocationSearch("?other=value");
    const { result } = renderHook(() => useClientQuery());

    await vi.waitFor(() => {
      const [query] = result.current;
      return query === null;
    });

    const [query] = result.current;
    expect(query).toBeNull();
  });

  it("returns empty string for ?user= (explicit empty, unknown-user)", async () => {
    setLocationSearch("?user=");
    const { result } = renderHook(() => useClientQuery());

    await vi.waitFor(() => {
      const [query] = result.current;
      return query === "";
    });

    const [query] = result.current;
    expect(query).toBe("");
  });

  it("updates on popstate (back/forward navigation)", async () => {
    setLocationSearch("?user=alice");
    const { result } = renderHook(() => useClientQuery());

    await vi.waitFor(() => {
      const [query] = result.current;
      return query === "alice";
    });

    // Simulate back navigation
    setLocationSearch("?user=bob");
    act(() => {
      dispatchPopstate();
    });

    const [query] = result.current;
    expect(query).toBe("bob");
  });

  it("setUser updates local state immediately and calls router.replace", () => {
    setLocationSearch("");
    const { result } = renderHook(() => useClientQuery());

    act(() => {
      const [, setUser] = result.current;
      setUser("charlie");
    });

    const [query] = result.current;
    expect(query).toBe("charlie");
    expect(mockReplace).toHaveBeenCalledWith(
      "?user=charlie",
      { scroll: false },
    );
  });

  it("setUser encodes special characters", () => {
    setLocationSearch("");
    const { result } = renderHook(() => useClientQuery());

    act(() => {
      const [, setUser] = result.current;
      setUser("user with spaces");
    });

    const [query] = result.current;
    expect(query).toBe("user with spaces");
    expect(mockReplace).toHaveBeenCalledWith(
      "?user=user%20with%20spaces",
      { scroll: false },
    );
  });

  it("cleans up popstate listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    setLocationSearch("");

    const { unmount } = renderHook(() => useClientQuery());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "popstate",
      expect.any(Function),
    );
    removeSpy.mockRestore();
  });
});
