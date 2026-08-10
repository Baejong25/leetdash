"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredOnboardingVersion, saveOnboardingVersion } from "@/lib/onboarding";

const CURRENT_ONBOARDING_VERSION = "v1";

export type OnboardingSlide = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

type HomeOnboardingProps = {
  slides: readonly OnboardingSlide[];
};

export function HomeOnboarding({ slides }: HomeOnboardingProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (slides.length === 0) return;

    if (getStoredOnboardingVersion(window.localStorage) !== CURRENT_ONBOARDING_VERSION) {
      setOpen(true);
    }
  }, [slides.length]);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (slides.length === 0) return null;

  const slide = slides[activeIndex];
  const isLastSlide = activeIndex === slides.length - 1;
  const isExternalLink = slide.href.startsWith("http");

  function dismiss() {
    saveOnboardingVersion(window.localStorage, CURRENT_ONBOARDING_VERSION);
    setOpen(false);
    window.setTimeout(() => helpButtonRef.current?.focus(), 0);
  }

  function handleNext() {
    if (isLastSlide) {
      dismiss();
      return;
    }

    setActiveIndex((index) => index + 1);
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) dismiss();
  }

  return (
    <>
      <button
        ref={helpButtonRef}
        className="home-help-button"
        type="button"
        onClick={() => {
          setActiveIndex(0);
          setOpen(true);
        }}
      >
        도움말 다시 보기
      </button>

      {open ? (
        <div
          className="home-onboarding-backdrop"
          role="presentation"
          onClick={handleBackdropClick}
        >
          <section
            className="home-onboarding-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-onboarding-title"
            aria-describedby="home-onboarding-description"
          >
            <div className="home-onboarding-progress" aria-label={`전체 ${slides.length}단계 중 ${activeIndex + 1}단계`}>
              <span>{activeIndex + 1} / {slides.length}</span>
              <div className="home-onboarding-dots" aria-hidden="true">
                {slides.map((item, index) => (
                  <span className={index === activeIndex ? "active" : ""} key={item.title} />
                ))}
              </div>
            </div>

            <div className="home-onboarding-content">
              <p className="eyebrow">처음 방문하셨나요?</p>
              <h2 id="home-onboarding-title">{slide.title}</h2>
              <p id="home-onboarding-description">{slide.description}</p>
              <a
                className="button primary"
                href={slide.href}
                target={isExternalLink ? "_blank" : undefined}
                rel={isExternalLink ? "noreferrer" : undefined}
                onClick={dismiss}
              >
                {slide.cta}
              </a>
            </div>

            <div className="home-onboarding-actions">
              <button ref={closeButtonRef} className="button" type="button" onClick={dismiss}>
                닫기
              </button>
              <div className="home-onboarding-navigation">
                <button
                  className="button"
                  type="button"
                  onClick={() => setActiveIndex((index) => index - 1)}
                  disabled={activeIndex === 0}
                >
                  이전
                </button>
                <button className="button primary" type="button" onClick={handleNext}>
                  {isLastSlide ? "시작하기" : "다음"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
