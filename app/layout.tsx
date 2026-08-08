import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, GitFork, UserRoundCheck, Users } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetCode 진행 레이더",
  description: "GitHub 저장소 기반 LeetCode 스터디 진행 현황 대시보드",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://raw.githubusercontent.com" />
        <style dangerouslySetInnerHTML={{__html: `:root{--bg:#f6f7f9;--text:#18202a;--accent:#0f766e}html{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--text)}body{margin:0}h1{font-size:32px;font-weight:700;line-height:1.15}.page-header{padding:32px 24px 28px}.shell-header{align-items:center;background:hsla(0,0%,100%,.92);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border-bottom:1px solid #d9dee7;display:flex;gap:8px;height:56px;justify-content:space-between;padding:4px 24px;position:sticky;top:0;z-index:40}.brand{align-items:center;color:var(--text);display:flex;font-size:16px;font-weight:760;gap:8px;text-decoration:none}a{color:var(--accent)}`}} />
      </head>
      <body>
        <header className="shell-header">
          <Link className="brand" href="/">
            <BarChart3 size={22} aria-hidden="true" />
            <span>LeetCode 진행 레이더</span>
          </Link>
          <nav className="top-nav" aria-label="주요 내비게이션">
            <Link href="/">
              <BarChart3 size={16} aria-hidden="true" />
              대시보드
            </Link>
            <Link href="/admin">
              <Users size={16} aria-hidden="true" />
              참가자
            </Link>
            <Link href="/myprofile">
              <UserRoundCheck size={16} aria-hidden="true" />
              내상태
            </Link>
            <a href="https://github.com/whoisyourbias/leetdash" target="_blank" rel="noreferrer">
              <GitFork size={16} aria-hidden="true" />
              GitHub
            </a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
