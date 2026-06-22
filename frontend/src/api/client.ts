const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';
export const AUTH_TOKEN_STORAGE_KEY = 'erdal_guda_auth_token';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object | null;
};

type ApiErrorBody = {
  message?: string;
  error?: string;
  errors?: Record<string, string>;
};

async function readError(response: Response) {
  const fallback = `İstek ${response.status} koduyla başarısız oldu.`;

  try {
    const body = (await response.json()) as ApiErrorBody;

    if (body.errors) {
      const details = Object.entries(body.errors)
        .map(([field, message]) => `${field}: ${message}`)
        .join(', ');
      return details ? `${body.message ?? 'Doğrulama başarısız'} (${details})` : body.message ?? fallback;
    }

    return body.message ?? body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  // URL ZIRHI: Bileşenden gelen istekte fazladan '/api' varsa temizler ve adresin kusursuz birleşmesini sağlar.
  const cleanPath = path.startsWith('/api') ? path.replace('/api', '') : path;
  const formattedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  const finalUrl = `${API_BASE_URL}${formattedPath}`;

  const response = await fetch(finalUrl, {
    ...options,
    headers,
    body: body as BodyInit | null | undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      throw new Error('Oturum süreniz dolmuş olabilir. Lütfen tekrar giriş yapın.');
    }

    if (response.status === 403) {
      throw new Error('Bu işlem için yetkiniz bulunmuyor.');
    }

    throw new Error(await readError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  baseUrl: API_BASE_URL,
  request,
};