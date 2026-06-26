import { useState, FC, ChangeEvent, FormEvent } from "react";
import type { UseAuth } from "./useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────
type AuthMode = "login" | "signup";

interface AuthPageProps {
  auth: UseAuth;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const FlameIcon: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" style={{ color: "#C49A3C" }}>
    <path d="M12 2C12 2 9 7 9 11C9 13.2 10.3 15 12 15C13.7 15 15 13.2 15 11C15 9 14 7 13 6C13 6 16 8 16 13C16 17.4 14.2 20 12 20C9.8 20 8 17.4 8 13C8 8.5 10 5 12 2Z" fill="currentColor" opacity="0.3"/>
    <path d="M12 22C9.2 22 7 19.5 7 16.5C7 13 9 11 10 9C10 11 11 12.5 12 12.5C13 12.5 14 11 14 9C15 11 17 13 17 16.5C17 19.5 14.8 22 12 22Z" fill="currentColor"/>
  </svg>
);

const EyeIcon: FC<{ show: boolean; onClick: () => void }> = ({ show, onClick }) => (
  <button type="button" onClick={onClick} className="absolute right-3 top-1/2 -translate-y-1/2"
    style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6560", padding: "4px" }}>
    {show ? (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
    )}
  </button>
);

// ── Input field ───────────────────────────────────────────────────────────────
interface InputFieldProps {
  label: string; type: string; value: string; placeholder: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string; autoComplete?: string;
  suffix?: React.ReactNode;
}

const InputField: FC<InputFieldProps> = ({ label, type, value, placeholder, onChange, error, autoComplete, suffix }) => (
  <div className="mb-4">
    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
      style={{ color: "#6B6560" }}>{label}</label>
    <div className="relative">
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={onChange} autoComplete={autoComplete}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
        style={{
          background: "#0F0D0B", border: `1px solid ${error ? "#7A3A2A" : "#2C2820"}`,
          color: "#F5F0E8", fontFamily: "Inter, sans-serif",
        }}
      />
      {suffix}
    </div>
    {error && <p className="text-xs mt-1.5 pl-1" style={{ color: "#E06040" }}>{error}</p>}
  </div>
);

// ── Main AuthPage ─────────────────────────────────────────────────────────────
export default function AuthPage({ auth }: AuthPageProps): JSX.Element {
  const [mode,    setMode]    = useState<AuthMode>("login");
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [showPw,  setShowPw]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverErr, setServerErr] = useState("");

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (mode === "signup" && !name.trim()) e.name = "Name is required.";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email.";
    if (!password) e.password = "Password is required.";
    if (mode === "signup" && password.length < 8) e.password = "Minimum 8 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerErr("");
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "signup") await auth.signup(name.trim(), email.trim(), password);
      else                   await auth.login(email.trim(), password);
    } catch (err: any) {
      setServerErr(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: AuthMode) => {
    setMode(m); setErrors({}); setServerErr("");
    setName(""); setEmail(""); setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0A0908 0%, #0F0D0B 50%, #0A0908 100%)", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #3C3830; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.35s ease forwards; }
      `}</style>

      <div className="w-full max-w-md fade-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-px w-12" style={{ background: "linear-gradient(to right, transparent, #C49A3C)" }} />
            <FlameIcon />
            <div className="h-px w-12" style={{ background: "linear-gradient(to left, transparent, #C49A3C)" }} />
          </div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Playfair Display, serif", color: "#F5F0E8" }}>
            SoapCalc<span style={{ color: "#C49A3C" }}>AI</span>
          </h1>
          <p className="text-xs mt-1" style={{ color: "#6B6560", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Traditional Cold Process · AI-Powered
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: "#141210", border: "1px solid #2C2820" }}>

          {/* Mode toggle */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: "#0F0D0B", border: "1px solid #2C2820" }}>
            {(["login", "signup"] as AuthMode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: mode === m ? "#C49A3C" : "transparent", color: mode === m ? "#0A0908" : "#6B6560" }}>
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {mode === "signup" && (
              <InputField label="Full name" type="text" value={name}
                placeholder="Raquel Bastian" onChange={e => setName(e.target.value)}
                error={errors.name} autoComplete="name" />
            )}
            <InputField label="Email address" type="email" value={email}
              placeholder="you@example.com" onChange={e => setEmail(e.target.value)}
              error={errors.email} autoComplete="email" />
            <InputField label="Password" type={showPw ? "text" : "password"} value={password}
              placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"}
              onChange={e => setPassword(e.target.value)}
              error={errors.password}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              suffix={<EyeIcon show={showPw} onClick={() => setShowPw(v => !v)} />} />

            {serverErr && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#1A0A08", border: "1px solid #7A3A2A", color: "#E06040" }}>
                {serverErr}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #C49A3C, #8B6A2A)", color: "#0A0908" }}>
              {loading
                ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    {mode === "signup" ? "Creating account…" : "Signing in…"}
                  </span>
                )
                : mode === "signup" ? "Create account ✦" : "Sign in →"
              }
            </button>
          </form>

          {mode === "signup" && (
            <p className="text-center text-xs mt-4" style={{ color: "#3C3830" }}>
              By creating an account you agree to our{" "}
              <span style={{ color: "#6B6560", cursor: "pointer", textDecoration: "underline" }}>Terms of Service</span>.
            </p>
          )}
        </div>

        {/* Free tier note */}
        <div className="mt-4 text-center px-4 py-3 rounded-xl" style={{ background: "#141210", border: "1px solid #2C2820" }}>
          <p className="text-xs" style={{ color: "#6B6560" }}>
            ✦ Free plan includes recipe builder, 2 saved recipes, and 5 AI generations/month.
          </p>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "#2C2820" }}>
          SoapCalcAI · Handle lye with care.
        </p>
      </div>
    </div>
  );
}
