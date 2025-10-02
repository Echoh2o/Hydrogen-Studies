import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  throwOnError: boolean = true,
): Promise<Response> {
  // Make sure method is a valid HTTP method
  const validMethod = method.toUpperCase();

  const res = await fetch(url, {
    method: validMethod,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Only throw if we explicitly want to (default behavior)
  if (throwOnError) {
    await throwIfResNotOk(res);
  }

  // Return the response regardless
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url = queryKey[0] as string;

    // Handle query parameters from queryKey
    if (queryKey.length > 1 && queryKey[1]) {
      const params = new URLSearchParams();
      const filters = queryKey[1] as any;

      // Add all non-empty filter values as query parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== "" &&
          (Array.isArray(value) ? value.length > 0 : true)
        ) {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, String(v)));
          } else {
            params.set(key, String(value));
          }
        }
      });

      if (params.toString()) {
        url += (url.includes("?") ? "&" : "?") + params.toString();
      }
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 10 * 60 * 1000, // 10 minutes for better performance
      retry: 1, // Single retry for better reliability
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
      placeholderData: (previousData: any) => previousData,
      refetchOnMount: false, // Reduce unnecessary requests
    },
    mutations: {
      retry: 1,
    },
  },
});
