import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, GitFork, House, UserRoundCheck, Users } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetCode 진행 레이더",
  description: "GitHub 저장소 기반 LeetCode 스터디 진행 현황 대시보드",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <header className="shell-header">
          <Link className="brand" href="/">
            <BarChart3 size={22} aria-hidden="true" />
            <span>LeetCode 진행 레이더</span>
          </Link>
          <nav className="top-nav" aria-label="주요 내비게이션">
            <Link href="/">
              <House size={16} aria-hidden="true" />
              홈
            </Link>
            <Link href="/statistics">
              <BarChart3 size={16} aria-hidden="true" />
              통계
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
