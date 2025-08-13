const API = '/api';

export async function login(username, password) {
  const r = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  if (!r.ok) throw new Error('Login failed');
  return r.json();
}

export async function logout() {
  await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
}

export async function me() {
  const r = await fetch(`${API}/me`, { credentials: 'include' });
  if (!r.ok) return { username: null, tier: 'guest', name: 'Guest' };
  return r.json();
}

// Optional: if you keep signup disabled on server, keep this a hard fail
export async function signup() {
  throw new Error('Signup disabled');
}
