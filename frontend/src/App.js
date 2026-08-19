import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Nav } from "@/components/Nav";
import Landing from "@/pages/Landing";
import PostRequest from "@/pages/PostRequest";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import CustomerDashboard from "@/pages/CustomerDashboard";
import ProviderDashboard from "@/pages/ProviderDashboard";
import AdminDashboard from "@/pages/AdminDashboard";

const Protected = ({ roles, children }) => {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Nav />
        <main className="min-h-screen">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/post" element={<PostRequest />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <Protected roles={["customer", "admin"]}>
                  <CustomerDashboard />
                </Protected>
              }
            />
            <Route
              path="/provider"
              element={
                <Protected roles={["provider"]}>
                  <ProviderDashboard />
                </Protected>
              }
            />
            <Route
              path="/admin"
              element={
                <Protected roles={["admin"]}>
                  <AdminDashboard />
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="border-t border-border px-5 py-10 text-center text-xs text-muted-foreground sm:px-8">
          Buntooz · Post it once. Local pros come to you. No commission, ever.
        </footer>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
