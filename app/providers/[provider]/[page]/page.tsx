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

      <CatalogProblemBrowser
        key={`${list.key}:${pagination.currentPage}`}
        items={items}
        users={users}
        providerPagination={{
          provider: items[0]?.problem.provider ?? "leetcode",
          currentPage: pagination.currentPage,
          totalPages: pagination.totalPages,
          pageSize: pagination.pageSize,
          totalItems: pagination.totalItems,
        }}
      />
    </div>
  );
}
