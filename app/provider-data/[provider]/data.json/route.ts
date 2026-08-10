import { providerLists } from "@/lib/catalog";
import { getProviderProblemIndex } from "@/lib/progress";

export const dynamicParams = false;

export function generateStaticParams() {
  return providerLists.map((list) => ({ provider: list.key }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const data = await getProviderProblemIndex(provider);

  if (!data) {
    return Response.json({ error: "Provider not found" }, { status: 404 });
  }

  return Response.json(data, {
    headers: {
      "Cache-Control": "public, max-age=600",
    },
  });
}
