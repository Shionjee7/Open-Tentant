/**
 * Talking to PocketBase.
 *
 * PocketBase serves this file and answers its own REST API on the same origin,
 * so there is no second server and no CORS to arrange. The auth token lives in
 * localStorage; every request carries it.
 */

const TOKEN_KEY = "opentenant_token";
const USER_KEY = "opentenant_user";

export function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function signedIn() {
  return Boolean(token());
}

function store(auth) {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.record));
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Raised for anything the API refuses, so callers can show the real reason. */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token()) headers.Authorization = token();
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    // The token expired or was revoked; make the app ask again rather than
    // showing a page full of errors.
    if (signedIn()) {
      signOut();
      location.reload();
    }
    throw new ApiError("Please sign in again.", response.status, null);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status, data);
  }
  return data;
}

export async function signIn(email, password) {
  const auth = await request("/collections/owners/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: email, password }),
  });
  store(auth);
  return auth.record;
}

/** First run: no owner exists yet, so the first person to arrive creates one. */
export async function ownerCount() {
  const data = await fetch("/api/collections/owners/records?perPage=1", {
    headers: token() ? { Authorization: token() } : {},
  });
  if (!data.ok) return null; // listing is closed to strangers; treat as unknown
  const json = await data.json();
  return json.totalItems ?? 0;
}

export async function createOwner(email, password, name) {
  await request("/collections/owners/records", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      name: name || "",
      emailVisibility: true,
    }),
  });
  return signIn(email, password);
}

/** Every record in a collection. Portfolios are small; one page is plenty. */
export async function list(collection, params = {}) {
  const query = new URLSearchParams({ perPage: "500", ...params });
  const data = await request(`/collections/${collection}/records?${query}`);
  return data.items ?? [];
}

export async function one(collection, id) {
  if (!id) return null;
  try {
    return await request(`/collections/${collection}/records/${id}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export function create(collection, body) {
  return request(`/collections/${collection}/records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function update(collection, id, body) {
  return request(`/collections/${collection}/records/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function remove(collection, id) {
  return request(`/collections/${collection}/records/${id}`, { method: "DELETE" });
}
