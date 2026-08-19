import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "customer" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await register(form);
      navigate(user.role === "provider" ? "/provider" : "/dashboard");
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-xl border border-border bg-[#030a1c]/70 px-4 py-3 text-sm outline-none transition-colors focus:border-[#2ff2b3]";

  return (
    <div className="grid min-h-[80vh] place-items-center px-5 py-14" data-testid="register-page">
      <div className="glass w-full max-w-md rounded-3xl p-8 sm:p-10">
        <h1 className="text-3xl font-extrabold">Create your account.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Then consider it done.</p>

        <div className="mt-7 grid grid-cols-2 gap-2 rounded-full border border-border p-1">
          {[
            ["customer", "I need tasks done"],
            ["provider", "I'm a pro"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              data-testid={`role-toggle-${value}`}
              onClick={() => setForm({ ...form, role: value })}
              className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${
                form.role === value ? "mint-bg text-[#030a1c]" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <input data-testid="register-name-input" required placeholder="Full name" value={form.name} onChange={set("name")} className={field} />
          <input data-testid="register-email-input" type="email" required placeholder="Email" value={form.email} onChange={set("email")} className={field} />
          <input data-testid="register-phone-input" placeholder="Phone (optional)" value={form.phone} onChange={set("phone")} className={field} />
          <input data-testid="register-password-input" type="password" required minLength={6} placeholder="Password (min 6 chars)" value={form.password} onChange={set("password")} className={field} />
          {error && (
            <p data-testid="register-error" className="text-sm text-rose-400">
              {error}
            </p>
          )}
          <button data-testid="register-submit-btn" disabled={busy} className="btn-mint w-full py-3 text-sm disabled:opacity-60">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" data-testid="go-login-link" className="font-bold mint-text">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
