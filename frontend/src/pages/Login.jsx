import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { CheckCheck } from "lucide-react";

const dashPath = (role) =>
  role === "admin" ? "/admin" : role === "provider" ? "/provider" : "/dashboard";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email, password);
      navigate(location.state?.from || dashPath(user.role));
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[80vh] place-items-center px-5 py-14" data-testid="login-page">
      <div className="glass w-full max-w-md rounded-3xl p-8 sm:p-10">
        <span className="grid h-10 w-10 place-items-center rounded-xl mint-bg text-[#030a1c]">
          <CheckCheck size={20} strokeWidth={3} />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold">Welcome back.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to track everything getting done.</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            data-testid="login-email-input"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-[#030a1c]/70 px-4 py-3 text-sm outline-none transition-colors focus:border-[#2ff2b3]"
          />
          <input
            data-testid="login-password-input"
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-[#030a1c]/70 px-4 py-3 text-sm outline-none transition-colors focus:border-[#2ff2b3]"
          />
          {error && (
            <p data-testid="login-error" className="text-sm text-rose-400">
              {error}
            </p>
          )}
          <button data-testid="login-submit-btn" disabled={busy} className="btn-mint w-full py-3 text-sm disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" data-testid="go-register-link" className="font-bold mint-text">
            Create an account
          </Link>
        </p>
        <div className="mt-7 rounded-xl border border-border bg-[#030a1c]/50 p-4 text-xs text-muted-foreground">
          <div className="font-bold uppercase tracking-wider">Demo accounts</div>
          <div className="mt-2 space-y-1">
            <div>customer@buntooz.com · Customer@123</div>
            <div>pro@buntooz.com · Pro@123</div>
            <div>admin@buntooz.com · Admin@123</div>
          </div>
        </div>
      </div>
    </div>
  );
}
