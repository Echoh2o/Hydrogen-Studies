import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Error thrown for non-2xx HTTP responses. Carries the parsed server message
 * (when available) plus the raw status so UI code can branch on either.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;

  const raw = (await res.text()) || res.statusText;
  let parsed: unknown = undefined;
  let message = raw;

  try {
    parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.error === "string") message = obj.error;
      else if (typeof obj.message === "string") message = obj.message;
    }
  } catch {
    // Not JSON — fall back to raw text as the message.
  }

  throw new ApiError(res.status, message, parsed ?? raw);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  throwOnError: boolean = true,
): Promise<Response> {
  // Make sure method is a valid HTTP method
  const validMethod = method.toUpperCase();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  const res = await fetch(url, {
    method: validMethod,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

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
      // NOTE: no global placeholderData. Keeping previous data across query
      // *key* changes is only safe for paginated/filtered lists — on detail
      // pages it renders the previous entity under the new URL. List queries
      // that want keep-previous-data opt in with a per-query
      // `placeholderData: (prev) => prev`.
      refetchOnMount: false, // Reduce unnecessary requests
    },
    mutations: {
      retry: 1,
    },
  },
});
