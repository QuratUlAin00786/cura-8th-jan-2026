import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { isPermissionError, showPermissionDenied } from "./permission-error-handler";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const DEFAULT_DEV_API = "http://localhost:1100";

function buildUrl(path: string) {
  if (path.startsWith("http")) {
    return path;
  }
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
  }
  if (import.meta.env.DEV) {
    return `${DEFAULT_DEV_API}${path}`;
  }
  return path;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    
    if (res.status === 403 || isPermissionError(error)) {
      showPermissionDenied();
      throw error;
    }
    
    throw error;
  }
}

// Helper function to get the correct tenant subdomain
export function getTenantSubdomain(): string {
  // PRIMARY SOURCE: authenticated user's stored subdomain (keeps routes like /billing from overriding tenant)
  const userSubdomain = localStorage.getItem('user_subdomain');
  if (userSubdomain) {
    return userSubdomain;
  }

  // BACKWARD COMPATIBILITY: allow explicit ?subdomain=... parameters
  const urlParams = new URLSearchParams(window.location.search);
  const subdomainParam = urlParams.get('subdomain');
  if (subdomainParam) {
    return subdomainParam;
  }

  const pathname = window.location.pathname;
  const pathParts = pathname.split('/').filter(Boolean);

  // PRIORITY: Path contains subdomain as first segment (e.g., /cura/forms ...)
  if (pathParts.length >= 1) {
    const candidate = pathParts[0];
    if (candidate && candidate !== "api" && candidate !== "__vite_ping") {
      return candidate;
    }
  }

  // Legacy auth path detection
  if (pathParts.length >= 2 && pathParts[1] === 'auth' && pathParts[2] === 'login') {
    const subdomainFromPath = pathParts[0];
    if (subdomainFromPath) {
      return subdomainFromPath;
    }
  }

  const hostname = window.location.hostname;

  // Development/replit fallback
  if (
    hostname.includes('.replit.app') ||
    hostname.includes('localhost') ||
    hostname.includes('replit.dev') ||
    hostname.includes('127.0.0.1')
  ) {
    return 'demo';
  }

  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts[0] || 'demo';
  }

  return 'demo';
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'X-Tenant-Subdomain': getTenantSubdomain()
  };
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'X-Tenant-Subdomain': getTenantSubdomain()
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log("Making request to:", queryKey[0], "with auth token:", !!token);
    console.log("Request headers:", headers);
    
    // Debug for patients specifically
    if (queryKey[0] === "/api/patients") {
      console.log("Patients request - token exists:", !!token);
      console.log("Patients request - headers:", headers);
    }
    
    const res = await fetch(buildUrl(queryKey[0] as string), {
      credentials: "include",
      headers
    });

    console.log("Query response status:", res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Query failed:", res.status, errorText);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
      
      await throwIfResNotOk(res);
      return null;
    }
    const data = await res.json();
    console.log("Query response data:", data);
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
