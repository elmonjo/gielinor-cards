import { useEffect, useState } from "react";

const USERS_KEY = "gielinor_auth_users_v1";
const SESSION_KEY = "gielinor_auth_session_v1";

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

export function useAuth() {
  const [users, setUsers] = useState(() => loadUsers());
  const [session, setSession] = useState(() => loadSession());

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const user =
    session && users.find(u => u.id === session.userId)
      ? users.find(u => u.id === session.userId)
      : null;

  async function register(username, password) {
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

  async function login(username, password) {
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

  function logout() {
    setSession(null);
  }

  return {
    user,
    login,
    register,
    logout
  };
}

