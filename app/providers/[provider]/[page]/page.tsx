import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogProblemBrowser } from "@/app/components/catalog-problem-browser";
import { providerLists } from "@/lib/catalog";
import { formatCatalogListTitle } from "@/lib/i18n";
import { getProviderProblemDetail } from "@/lib/progress";

export const dynamicParams = false;

export async function generateStaticParams() {
  return providerLists.flatMap((list) => {
    const totalPages = Math.max(1, Math.ceil(list.items.length / 50));
    return Array.from({ length: totalPages }, (_, index) => ({
      provider: list.key,
      page: String(index + 1),
    }));
  });
}

export default async function ProviderProblemsPage({
  params,
}: {
  params: Promise<{ provider: string; page: string }>;
}) {
  const { provider, page: pageParam } = await params;
  const page = Number(pageParam);
  const detail = Number.isInteger(page) && page > 0 ? await getProviderProblemDetail(provider, page) : null;

  if (!detail) {
    notFound();
  }

  const { list, items, users, pagination } = detail;
  const pageHref = (pageNumber: number) => `/providers/${list.key}/${pageNumber}`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">PROVIDER</p>
          <h1>{formatCatalogListTitle(list.title)}</h1>
          <p className="lede">전체 {pagination.totalItems}개 문제를 페이지별로 확인할 수 있습니다.</p>
        </div>
        <Link className="button" href="/">대시보드로 돌아가기</Link>
      </div>

      <CatalogProblemBrowser items={items} users={users} />

      <nav className="history-pagination" aria-label="Provider 문제 페이지">
        {pagination.currentPage > 1 ? (
          <Link className="button" href={pageHref(pagination.currentPage - 1)}>이전</Link>
        ) : null}
        <span className="muted">{pagination.currentPage} / {pagination.totalPages}</span>
        {pagination.currentPage < pagination.totalPages ? (
          <Link className="button" href={pageHref(pagination.currentPage + 1)}>다음</Link>
        ) : null}
      </nav>
    </div>
  );
}
