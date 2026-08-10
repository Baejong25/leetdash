type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export const ONBOARDING_STORAGE_KEY = "leetcode-progress-radar:home-onboarding-version";

export function getStoredOnboardingVersion(storage: StorageReader): string | null {
  try {
    const version = storage.getItem(ONBOARDING_STORAGE_KEY)?.trim();
    return version || null;
  } catch {
    return null;
  }
}

export function saveOnboardingVersion(storage: StorageWriter, version: string): void {
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, version);
  } catch {
    // Browsers may disable storage; the onboarding can still be dismissed for this render.
  }
}
