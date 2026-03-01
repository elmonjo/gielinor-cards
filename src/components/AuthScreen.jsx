import { useState } from "react";

export default function AuthScreen({ auth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    const result =
      mode === "login"
        ? await auth.login(email, password)
        : await auth.register(email, password);

    if (!result.ok) {
      setMessage(result.message || "Failed.");
      return;
    }

    setMessage("");
    setPassword("");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Gielinor Cards</div>
        <div className="auth-subtitle">
          {mode === "login" ? "Sign In" : "Create Account"}
        </div>
        {auth?.cloud?.enabled && (
          <div className="auth-subtitle">Cloud sync enabled</div>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </label>

        {message && <div className="auth-message">{message}</div>}

        <button type="button" onClick={submit}>
          {mode === "login" ? "Login" : "Create Account"}
        </button>

        {mode === "login" && (
          <button
            type="button"
            className="auth-secondary"
            onClick={async () => {
              const result = await auth.requestPasswordReset(email);
              setMessage(result.message || (result.ok ? "Reset email sent." : "Failed."));
            }}
          >
            Forgot Password
          </button>
        )}

        <button
          type="button"
          className="auth-secondary"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setMessage("");
          }}
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}
