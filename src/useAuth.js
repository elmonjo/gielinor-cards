import { useEffect, useMemo, useState } from "react";

const USERS_KEY = "gielinor_auth_users_v1";
const SESSION_KEY = "gielinor_auth_session_v1";
const FIREBASE_SESSION_KEY = "gielinor_auth_firebase_session_v1";
const GAME_SAVE_PREFIX = "gielinor_runtime_profiles_v1:";

const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY?.trim() || "";
const FIREBASE_DATABASE_URL = import.meta.env.VITE_FIREBASE_DATABASE_URL?.trim() || "";
const CLOUD_ENABLED = Boolean(FIREBASE_API_KEY && FIREBASE_DATABASE_URL);

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
  return `${key}@gielinorcards.app`;
}

function firebaseErrorToMessage(code) {
  switch (code) {
    case "EMAIL_EXISTS":
      return "Username already exists.";
    case "EMAIL_NOT_FOUND":
      return "Account not found.";
    case "INVALID_PASSWORD":
      return "Wrong password.";
    case "INVALID_EMAIL":
      return "Invalid username format.";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "Too many attempts. Try again later.";
    default:
      return code || "Auth request failed.";
  }
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

function loadFirebaseSession() {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(FIREBASE_SESSION_KEY), null);
}

function saveFirebaseSession(session) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(FIREBASE_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(FIREBASE_SESSION_KEY, JSON.stringify(session));
}

function toCloudUser(session) {
  if (!session?.localId) return null;
  return {
    id: session.localId,
    username: session.username || "Player",
    storageNamespace: session.localId,
    legacyNamespaces: session.legacyLocalUserId
      ? [session.legacyLocalUserId]
      : []
  };
}

async function firebaseAuthRequest(method, email, password) {
  const endpoint =
    method === "signup"
      ? "accounts:signUp"
      : "accounts:signInWithPassword";

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    }
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      message: firebaseErrorToMessage(json?.error?.message)
    };
  }

  return { ok: true, data: json };
}

export function useAuth() {
  const [users, setUsers] = useState(() => loadUsers());
  const [session, setSession] = useState(() => loadSession());
  const [firebaseSession, setFirebaseSession] = useState(() =>
    CLOUD_ENABLED ? loadFirebaseSession() : null
  );

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    saveFirebaseSession(firebaseSession);
  }, [firebaseSession]);

  const localUser = useMemo(() => {
    if (!session) return null;
    return users.find(u => u.id === session.userId) || null;
  }, [session, users]);

  const cloudUser = useMemo(() => {
    if (!CLOUD_ENABLED) return null;
    return toCloudUser(firebaseSession);
  }, [firebaseSession]);

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

  async function verifyLocalCredentials(username, password) {
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

    return { ok: true, account };
  }

  async function loginLocal(username, password) {
    const check = await verifyLocalCredentials(username, password);
    if (!check.ok) return check;
    setSession({ userId: check.account.id });
    return { ok: true };
  }

  async function registerCloud(username, password) {
    const trimmed = username?.trim();
    if (!trimmed || !password) {
      return { ok: false, message: "Enter username and password." };
    }

    const usernameKey = normalizeUsername(trimmed);
    const legacyUser = users.find(u => u.usernameKey === usernameKey) || null;

    const result = await firebaseAuthRequest(
      "signup",
      usernameToEmail(trimmed),
      password
    );
    if (!result.ok) return result;

    const data = result.data || {};
    if (!data.idToken || !data.localId) {
      return { ok: false, message: "Signup failed (no session returned)." };
    }

    setFirebaseSession({
      idToken: data.idToken,
      refreshToken: data.refreshToken || "",
      localId: data.localId,
      username: trimmed,
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

    const result = await firebaseAuthRequest(
      "signin",
      usernameToEmail(trimmed),
      password
    );
    if (!result.ok) return result;

    const data = result.data || {};
    if (!data.idToken || !data.localId) {
      return { ok: false, message: "Login failed (no session returned)." };
    }

    setFirebaseSession({
      idToken: data.idToken,
      refreshToken: data.refreshToken || "",
      localId: data.localId,
      username: trimmed,
      legacyLocalUserId: legacyUser?.id || null
    });
    return { ok: true };
  }

  async function register(username, password) {
    if (CLOUD_ENABLED) return registerCloud(username, password);
    return registerLocal(username, password);
  }

  async function login(username, password) {
    if (CLOUD_ENABLED) {
      const cloudLogin = await loginCloud(username, password);
      if (cloudLogin.ok) return cloudLogin;

      const localCheck = await verifyLocalCredentials(username, password);
      if (!localCheck.ok) return cloudLogin;

      const cloudRegister = await registerCloud(username, password);
      if (cloudRegister.ok) return cloudRegister;

      const retry = await loginCloud(username, password);
      if (retry.ok) return retry;
      return cloudLogin;
    }
    return loginLocal(username, password);
  }

  function logout() {
    if (CLOUD_ENABLED) {
      setFirebaseSession(null);
      return;
    }
    setSession(null);
  }

  function clearAllLocalAccounts() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USERS_KEY);
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(FIREBASE_SESSION_KEY);

      const keysToDelete = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && key.startsWith(GAME_SAVE_PREFIX)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => window.localStorage.removeItem(key));
    }

    setUsers([]);
    setSession(null);
    setFirebaseSession(null);
  }

  return {
    user,
    login,
    register,
    logout,
    clearAllLocalAccounts,
    cloud: {
      enabled: CLOUD_ENABLED,
      apiKey: FIREBASE_API_KEY,
      databaseUrl: FIREBASE_DATABASE_URL,
      accessToken: firebaseSession?.idToken || null,
      userId: firebaseSession?.localId || null
    }
  };
}
