import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  name: string;
  email: string;
  plan: "free" | "premium";
  role: "user" | "admin";
}

export interface UseAuth {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const API = "http://localhost:3001";
const TOKEN_KEY = "soapcalcai_token";

export function useAuth(): UseAuth {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [token, setToken]     = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setLoading(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setUser(data.user); setToken(stored); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  const persist = (t: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t); setUser(u);
  };

  const signup = useCallback(async (name: string, email: string, password: string): Promise<void> => {
    const res  = await fetch(`${API}/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Signup failed.");
    persist(data.token, data.user);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res  = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed.");
    persist(data.token, data.user);
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null); setUser(null);
  }, []);

  return { user, token, loading, signup, login, logout, isAuthenticated: !!user };
}
