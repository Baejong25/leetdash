/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HomeOnboarding } from "@/app/components/home-onboarding";
import {
  ONBOARDING_STORAGE_KEY,
  getStoredOnboardingVersion,
  saveOnboardingVersion,
} from "@/lib/onboarding";

const slides = [
  {
    title: "참여자 등록",
    description: "GitHub 아이디를 운영자에게 전달해 참여자로 등록하세요.",
    href: "/admin",
    cta: "등록 안내 보기",
  },
  {
    title: "문제 선택",
    description: "카탈로그에서 풀고 싶은 문제를 찾아보세요.",
    href: "/catalog/top-interview-easy",
    cta: "카탈로그 보기",
  },
  {
    title: "GitHub에 풀이 업로드",
    description: "Fork한 저장소에 풀이를 추가하고 Pull Request를 보내세요.",
    href: "https://github.com/whoisyourbias/leetdash",
    cta: "제출 방법 보기",
  },
] as const;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("onboarding storage", () => {
  it("returns null when no onboarding version has been saved", () => {
    expect(getStoredOnboardingVersion(window.localStorage)).toBeNull();
  });

  it("saves and reads the onboarding version", () => {
    saveOnboardingVersion(window.localStorage, "v1");

    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("v1");
    expect(getStoredOnboardingVersion(window.localStorage)).toBe("v1");
  });

  it("does not throw when storage is unavailable", () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };

    expect(getStoredOnboardingVersion(brokenStorage)).toBeNull();
    expect(() => saveOnboardingVersion(brokenStorage, "v1")).not.toThrow();
  });
});

describe("HomeOnboarding", () => {
  it("opens automatically for a first-time visitor", async () => {
    render(<HomeOnboarding slides={slides} />);

    expect(await screen.findByRole("dialog")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "참여자 등록" })).not.toBeNull();
    expect(screen.getByText("1 / 3")).not.toBeNull();
  });

  it("moves between slides and exposes the slide CTA", async () => {
    render(<HomeOnboarding slides={slides} />);

    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByRole("heading", { name: "문제 선택" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "카탈로그 보기" }).getAttribute("href")).toBe(
      "/catalog/top-interview-easy",
    );
  });

  it("marks the onboarding complete when it is dismissed", async () => {
    render(<HomeOnboarding slides={slides} />);

    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getStoredOnboardingVersion(window.localStorage)).toBe("v1");
    expect(screen.getByRole("button", { name: "도움말 다시 보기" })).not.toBeNull();
  });

  it("closes and remembers the onboarding when Escape is pressed", async () => {
    render(<HomeOnboarding slides={slides} />);

    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getStoredOnboardingVersion(window.localStorage)).toBe("v1");
  });

  it("does not open automatically after the current version was completed", async () => {
    saveOnboardingVersion(window.localStorage, "v1");

    render(<HomeOnboarding slides={slides} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "도움말 다시 보기" }));
    expect(await screen.findByRole("dialog")).not.toBeNull();
  });
});
