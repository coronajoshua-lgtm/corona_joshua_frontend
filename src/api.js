const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api')
  .replace(/\/+$/, '');

async function readResponse(response) {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    const reason = /^\s*</.test(body) ? 'an HTML page' : body.trim() ? 'invalid JSON' : 'an empty response';
    const error = new Error(`The API returned ${reason} (HTTP ${response.status}) instead of JSON. Check the backend server logs and VITE_API_URL (${API_URL}).`);
    error.status = response.status;
    throw error;
  }
}

export async function request(path, options = {}, retry = true) {
  const publicAuthRequest = path === '/auth/login' || path === '/auth/register';
  const accessToken = publicAuthRequest ? null : localStorage.getItem('accessToken');
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach the LavaLust API at ${API_URL}. In the backend folder, run "php lava serve --port=3000" and try again.`);
    }
    throw error;
  }

  if (response.status === 401 && retry && !publicAuthRequest && localStorage.getItem('refreshToken')) {
    const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: localStorage.getItem('refreshToken') }),
    });
    if (refreshResponse.ok) {
      const refreshed = await readResponse(refreshResponse);
      localStorage.setItem('accessToken', refreshed.tokens.access_token);
      localStorage.setItem('refreshToken', refreshed.tokens.refresh_token);
      return request(path, options, false);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  const data = await readResponse(response);
  if (!response.ok) {
    const error = new Error(data.error || data.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function saveTokens(tokens) {
  localStorage.setItem('accessToken', tokens.access_token);
  localStorage.setItem('refreshToken', tokens.refresh_token);
}
