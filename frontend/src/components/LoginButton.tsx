import { useAuth } from "../hooks/useAuth";

export function LoginButton() {
  const { login, isLoading } = useAuth();

  return (
    <button onClick={login} disabled={isLoading} className="btn-primary">
      {isLoading ? "Signing in..." : "Sign in with Microsoft"}
    </button>
  );
}
