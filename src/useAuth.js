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

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function firebaseErrorToMessage(code) {
  switch (code) {
    case "EMAIL_EXISTS":
      return "Account already exists.";
    case "EMAIL_NOT_FOUND":
      return "Account not found.";
    case "INVALID_PASSWORD":
      return "Wrong password.";
    case "INVALID_EMAIL":
      return "Invalid email address.";
    case "MISSING_EMAIL":
      return "Enter an email address.";
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
  const email = session.email || "";
  const display = email.includes("@") ? email.split("@")[0] : "Player";
  return {
    id: session.localId,
    username: display,
    email,
    storageNamespace: session.localId,
    legacyNamespaces: session.legacyLocalUserId
      ? [session.legacyLocalUserId]
      : []
  };
}

async function firebaseAuthRequest(endpoint, body) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
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

  useEffect(() => saveUsers(users), [users]);
  useEffect(() => saveSession(session), [session]);
  useEffect(() => saveFirebaseSession(firebaseSession), [firebaseSession]);

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
          username: localUser.email,
          email: localUser.email,
          storageNamespace: localUser.id,
          legacyNamespaces: []
        }
      : null;

  async function registerLocal(email, password) {
    const normalized = normalizeEmail(email || "");
    if (!normalized || !password) {
      return { ok: false, message: "Enter email and password." };
    }
    if (!looksLikeEmail(normalized)) {
      return { ok: false, message: "Enter a valid email." };
    }

    const exists = users.some(u => u.emailKey === normalized);
    if (exists) {
      return { ok: false, message: "Account already exists." };
    }

    const passwordHash = await sha256Hex(password);
    const newUser = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: normalized,
      emailKey: normalized,
      passwordHash
    };
    setUsers(prev => [...prev, newUser]);
    setSession({ userId: newUser.id });
    return { ok: true };
  }

  async function verifyLocalCredentials(email, password) {
    const normalized = normalizeEmail(email || "");
    if (!normalized || !password) {
      return { ok: false, message: "Enter email and password." };
    }
    const account = users.find(u => u.emailKey === normalized);
    if (!account) return { ok: false, message: "Account not found." };

    const inputHash = await sha256Hex(password);
    if (inputHash !== account.passwordHash) {
      return { ok: false, message: "Wrong password." };
    }

    return { ok: true, account };
  }

  async function loginLocal(email, password) {
    const check = await verifyLocalCredentials(email, password);
    if (!check.ok) return check;
    setSession({ userId: check.account.id });
    return { ok: true };
  }

  async function registerCloud(email, password) {
    const normalized = normalizeEmail(email || "");
    if (!normalized || !password) {
      return { ok: false, message: "Enter email and password." };
    }
    if (!looksLikeEmail(normalized)) {
      return { ok: false, message: "Enter a valid email." };
    }

    const legacyUser = users.find(u => u.emailKey === normalized) || null;
    const result = await firebaseAuthRequest("accounts:signUp", {
      email: normalized,
      password,
      returnSecureToken: true
    });
    if (!result.ok) return result;

    const data = result.data || {};
    if (!data.idToken || !data.localId) {
      return { ok: false, message: "Signup failed (no session returned)." };
    }

    setFirebaseSession({
      idToken: data.idToken,
      refreshToken: data.refreshToken || "",
      localId: data.localId,
      email: data.email || normalized,
      legacyLocalUserId: legacyUser?.id || null
    });
    return { ok: true };
  }

  async function loginCloud(email, password) {
    const normalized = normalizeEmail(email || "");
    if (!normalized || !password) {
      return { ok: false, message: "Enter email and password." };
    }
    if (!looksLikeEmail(normalized)) {
      return { ok: false, message: "Enter a valid email." };
    }

    const legacyUser = users.find(u => u.emailKey === normalized) || null;
    const result = await firebaseAuthRequest("accounts:signInWithPassword", {
      email: normalized,
      password,
      returnSecureToken: true
    });
    if (!result.ok) return result;

    const data = result.data || {};
    if (!data.idToken || !data.localId) {
      return { ok: false, message: "Login failed (no session returned)." };
    }

    setFirebaseSession({
      idToken: data.idToken,
      refreshToken: data.refreshToken || "",
      localId: data.localId,
      email: data.email || normalized,
      legacyLocalUserId: legacyUser?.id || null
    });
    return { ok: true };
  }

  async function requestPasswordReset(email) {
    const normalized = normalizeEmail(email || "");
    if (!normalized) {
      return { ok: false, message: "Enter your email first." };
    }
    if (!looksLikeEmail(normalized)) {
      return { ok: false, message: "Enter a valid email." };
    }

    if (!CLOUD_ENABLED) {
      return { ok: false, message: "Password reset requires cloud auth enabled." };
    }

    const result = await firebaseAuthRequest("accounts:sendOobCode", {
      requestType: "PASSWORD_RESET",
      email: normalized
    });
    if (!result.ok) return result;
    return { ok: true, message: "Password reset email sent." };
  }

  async function register(email, password) {
    if (CLOUD_ENABLED) return registerCloud(email, password);
    return registerLocal(email, password);
  }

  async function login(email, password) {
    if (CLOUD_ENABLED) {
      const cloudLogin = await loginCloud(email, password);
      if (cloudLogin.ok) return cloudLogin;

      const localCheck = await verifyLocalCredentials(email, password);
      if (!localCheck.ok) return cloudLogin;

      const cloudRegister = await registerCloud(email, password);
      if (cloudRegister.ok) return cloudRegister;

      const retry = await loginCloud(email, password);
      if (retry.ok) return retry;
      return cloudLogin;
    }
    return loginLocal(email, password);
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
        if (key && key.startsWith(GAME_SAVE_PREFIX)) keysToDelete.push(key);
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
    requestPasswordReset,
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
