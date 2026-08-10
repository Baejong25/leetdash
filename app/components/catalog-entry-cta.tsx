"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredDashboardViewerId, saveStoredDashboardViewerId } from "@/lib/dashboard-viewer";

type User = { id: string; displayName: string; githubUsername: string };

export function CatalogEntryCta({ href, users, className, children }: { href: string; users: User[]; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  function handleClick() {
    const storedId = getStoredDashboardViewerId(window.localStorage);
    if (storedId && users.some((user) => user.id === storedId)) {
      router.push(href);
      return;
    }
    setOpen(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) return;
    saveStoredDashboardViewerId(window.localStorage, selectedUserId);
    router.push(href);
  }

  return <>
    <button className={className} type="button" onClick={handleClick}>{children}</button>
    {open ? <div className="user-selection-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-entry-user-title">
      <form className="panel" onSubmit={handleSubmit}>
        <h2 id="catalog-entry-user-title">사용자 선택</h2>
        <p className="panel-subtitle">문제 풀이 상태를 확인할 닉네임을 선택해 주세요.</p>
        <div className="viewer-control"><label htmlFor="catalog-entry-user">닉네임</label><select id="catalog-entry-user" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">사용자 선택</option>{users.map((user) => <option value={user.id} key={user.id}>{user.displayName} (@{user.githubUsername})</option>)}</select></div>
        <p className="muted">닉네임을 모르겠다면 관리자에게 문의하세요.</p>
        <div className="actions"><button className="button primary" type="submit" disabled={!selectedUserId}>선택하고 이동</button><button className="button" type="button" onClick={() => setOpen(false)}>취소</button></div>
      </form>
    </div> : null}
  </>;
}
