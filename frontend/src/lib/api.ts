import { clearSession, getAccessToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  window.location.replace("/login");
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, auth = false, headers, ...rest } = options;
  const token = auth ? getAccessToken() : null;

  if (auth && !token) {
    clearSession();
    redirectToLogin();
    throw new ApiError(401, "Missing access token");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | T
    | null;

  if (!response.ok) {
    const errorMessage =
      payload !== null && typeof payload === "object" && "message" in payload
        ? (payload as { message?: string | string[] }).message
        : undefined;
    const message = Array.isArray(errorMessage)
      ? errorMessage[0]
      : typeof errorMessage === "string"
        ? errorMessage
        : "Something went wrong";

    if (response.status === 401) {
      clearSession();
      const sessionGone =
        message === "Missing access token" ||
        message === "Invalid or expired session" ||
        message === "Account no longer exists";
      if (sessionGone) {
        redirectToLogin();
      }
    }

    throw new ApiError(response.status, message);
  }

  return payload as T;
}
