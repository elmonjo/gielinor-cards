import { useEffect, useMemo, useState } from "react";

const USERS_KEY = "gielinor_auth_users_v1";
const SESSION_KEY = "gielinor_auth_session_v1";
const CLOUD_SESSION_KEY = "gielinor_auth_cloud_session_v1";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";
const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function usernameToEmail(username) {
  const key = normalizeUsername(username).replace(/[^a-z0-9._-]/g, "_");
  return `${key}@gielinor.cards.local`;
}

async function sha256Hex(input) {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.subtle &&
    window.TextEncoder
  ) {
    const bytes = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  return `plain:${input}`;
}

function loadUsers() {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(USERS_KEY), []);
}

function saveUsers(users) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSession() {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(SESSION_KEY), null);
}

function saveSession(session) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadCloudSession() {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(CLOUD_SESSION_KEY), null);
}

function saveCloudSession(session) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(CLOUD_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
}

function toCloudUser(session) {
  const user = session?.user;
  if (!user?.id) return null;

  const username =
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    "Player";

  return {
    id: user.id,
    username,
    storageNamespace: user.id,
    legacyNamespaces: session.legacyLocalUserId
      ? [session.legacyLocalUserId]
      : []
  };
}

async function supabaseAuthRequest(path, body) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      message: json?.msg || json?.error_description || json?.message || "Auth request failed."
    };
  }

  return { ok: true, data: json };
}

export function useAuth() {
  const [users, setUsers] = useState(() => loadUsers());
  const [session, setSession] = useState(() => loadSession());
  const [cloudSession, setCloudSession] = useState(() =>
    CLOUD_ENABLED ? loadCloudSession() : null
  );

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    saveCloudSession(cloudSession);
  }, [cloudSession]);

  const localUser = useMemo(() => {
    if (!session) return null;
    return users.find(u => u.id === session.userId) || null;
  }, [session, users]);

  const cloudUser = useMemo(() => {
    if (!CLOUD_ENABLED) return null;
    return toCloudUser(cloudSession);
  }, [cloudSession]);

  const user = CLOUD_ENABLED
    ? cloudUser
    : localUser
      ? {
          id: localUser.id,
          username: localUser.username,
          storageNamespace: localUser.id,
          legacyNamespaces: []
        }
      : null;

  async function registerLocal(username, password) {
    const trimmed = username?.trim();
    if (!trimmed || !password) {
      return { ok: false, message: "Enter username and password." };
    }

    const key = normalizeUsername(trimmed);
    const exists = users.some(u => u.usernameKey === key);
    if (exists) {
      return { ok: false, message: "Username already exists." };
    }

    const passwordHash = await sha256Hex(password);
    const newUser = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username: trimmed,
      usernameKey: key,
      passwordHash
    };

    setUsers(prev => [...prev, newUser]);
    setSession({ userId: newUser.id });
    return { ok: true };
  }

  async function loginLocal(username, password) {
    const trimmed = username?.trim();
    if (!trimmed || !password) {
      return { ok: false, message: "Enter username and password." };
    }

    const key = normalizeUsername(trimmed);
    const account = users.find(u => u.usernameKey === key);
    if (!account) {
      return { ok: false, message: "Account not found." };
    }

    const inputHash = await sha256Hex(password);
    if (inputHash !== account.passwordHash) {
      return { ok: false, message: "Wrong password." };
    }

    setSession({ userId: account.id });
    return { ok: true };
  }

  async function registerCloud(username, password) {
    const trimmed = username?.trim();
    if (!trimmed || !password) {
      return { ok: false, message: "Enter username and password." };
    }

    const usernameKey = normalizeUsername(trimmed);
    const legacyUser = users.find(u => u.usernameKey === usernameKey) || null;

    const result = await supabaseAuthRequest("/auth/v1/signup", {
      email: usernameToEmail(trimmed),
      password,
      data: { username: trimmed }
    });
    if (!result.ok) return result;

    const data = result.data || {};
    if (!data.access_token || !data.user?.id) {
      return {
        ok: false,
        message: "Signup created but no session was returned. Disable email confirmation in Supabase Auth settings."
      };
    }

    setCloudSession({
      ...data,
      legacyLocalUserId: legacyUser?.id || null
    });

    return { ok: true };
  }

  async function loginCloud(username, password) {
    const trimmed = username?.trim();
    if (!trimmed || !password) {
      return { ok: false, message: "Enter username and password." };
    }

    const usernameKey = normalizeUsername(trimmed);
    const legacyUser = users.find(u => u.usernameKey === usernameKey) || null;

    const result = await supabaseAuthRequest("/auth/v1/token?grant_type=password", {
      email: usernameToEmail(trimmed),
      password
    });
    if (!result.ok) return result;

    const data = result.data || {};
    if (!data.access_token || !data.user?.id) {
      return { ok: false, message: "Login failed (no session returned)." };
    }

    setCloudSession({
      ...data,
      legacyLocalUserId: legacyUser?.id || null
    });

    return { ok: true };
  }

  async function register(username, password) {
    if (CLOUD_ENABLED) return registerCloud(username, password);
    return registerLocal(username, password);
  }

  async function login(username, password) {
    if (CLOUD_ENABLED) return loginCloud(username, password);
    return loginLocal(username, password);
  }

  function logout() {
    if (CLOUD_ENABLED) {
      setCloudSession(null);
      return;
    }
    setSession(null);
  }

  return {
    user,
    login,
    register,
    logout,
    cloud: {
      enabled: CLOUD_ENABLED,
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      accessToken: cloudSession?.access_token || null,
      userId: cloudSession?.user?.id || null
    }
  };
}
