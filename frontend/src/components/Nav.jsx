import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CheckCheck, LogOut } from "lucide-react";

const dashPath = (role) =>
  role === "admin" ? "/admin" : role === "provider" ? "/provider" : "/dashboard";

export const Nav = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 glass" data-testid="main-nav">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg mint-bg text-[#030a1c]">
            <CheckCheck size={18} strokeWidth={3} />
          </span>
          <span className="display text-lg font-extrabold tracking-tight">Buntooz</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/post"
            data-testid="nav-post-link"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Post a request
          </Link>
          {user ? (
            <>
              <Link
                to={dashPath(user.role)}
                data-testid="nav-dashboard-link"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <button
                data-testid="nav-logout-btn"
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
                className="btn-ghost-mint flex items-center gap-1.5 px-4 py-2 text-sm"
              >
                <LogOut size={14} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                data-testid="nav-login-link"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link to="/post" data-testid="nav-post-btn" className="btn-mint px-5 py-2 text-sm">
                Post a request
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
