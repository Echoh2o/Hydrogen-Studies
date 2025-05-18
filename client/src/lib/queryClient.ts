import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  methodOrUrl: string,
  urlOrData?: string | unknown,
  data?: unknown | undefined,
  throwOnError: boolean = true
): Promise<Response> {
  // Handle case where apiRequest is called with just a URL
  // This allows both apiRequest('GET', '/api/endpoint') and apiRequest('/api/endpoint')
  let method: string;
  let url: string;
  let bodyData: unknown | undefined;
  
  if (!urlOrData || typeof urlOrData !== 'string') {
    // apiRequest(url, data?) format
    method = 'GET'; // Default to GET
    url = methodOrUrl;
    bodyData = urlOrData;
  } else {
    // apiRequest(method, url, data?) format
    method = methodOrUrl;
    url = urlOrData;
    bodyData = data;
  }

  // Make sure method is a valid HTTP method
  const validMethod = method.toUpperCase();
  
  const res = await fetch(url, {
    method: validMethod,
    headers: bodyData ? { "Content-Type": "application/json" } : {},
    body: bodyData ? JSON.stringify(bodyData) : undefined,
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
    const res = await fetch(queryKey[0] as string, {
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
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity for better cache management
      retry: false,
      cacheTime: 10 * 60 * 1000, // 10 minutes
      // Add performance optimization options
      keepPreviousData: true, // Reduce loading flashes
      refetchOnMount: true, // Fetch fresh data on component mount for improved data accuracy
    },
    mutations: {
      retry: false,
    },
  },
});
