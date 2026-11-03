import { QueryClient, dehydrate, type DehydratedState } from "@tanstack/react-query";
import { expressJson } from "@web/lib/page-data";

/**
 * Fetch Express JSON on the server and hand it to React Query on the client
 * (ClientProviders dehydratedState). Each key must be exactly the queryKey
 * the SPA component uses — the API path — so useQuery finds it. A failed
 * fetch is skipped: the component falls back to fetching in the browser.
 */
export async function prefetchQueries(paths: readonly string[], revalidate: number, tags: string[]): Promise<DehydratedState> {
  const qc = new QueryClient();
  await Promise.all(
    paths.map(async (p) => {
      try {
        qc.setQueryData([p], await expressJson<unknown>(p, revalidate, tags));
      } catch {
        // the client fetches it instead
      }
    }),
  );
  return dehydrate(qc);
}
