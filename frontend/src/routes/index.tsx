import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HeartPulse, LockKeyhole, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const API = "https://vitals-bget.onrender.com";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vitals | Family medicine, kept simple" },
      { name: "description", content: "Sign in to Vitals to manage family medicines, dose schedules, and stock." },
      { property: "og:title", content: "Vitals | Family medicine, kept simple" },
      { property: "og:description", content: "A calm, clear way to manage family medicines and doses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginScreen,
});

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/15">
        <HeartPulse size={20} strokeWidth={2.2} />
      </span>
      <span className="font-display text-lg font-bold text-foreground">Vitals</span>
    </div>
  );
}

function LoginScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userId = new URLSearchParams(window.location.search).get("userId");
    if (userId) {
      localStorage.setItem("userId", userId);
      void navigate({ to: "/setup" });
    }
  }, [navigate]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/login/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "That ID or password doesn't match.");
      localStorage.setItem("userId", data.userId);
      await navigate({ to: "/dashboard" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't reach Vitals. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.08fr_.92fr] lg:px-8">
        <section className="hidden lg:block">
          <Brand />
          <p className="mt-24 font-display text-sm font-semibold text-primary">Family care, without the clutter.</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl font-bold leading-[1.08] text-foreground">
            Every medicine.<br />Every person.<br /><span className="text-primary">One calm place.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
            Keep track of doses, timing, and stock for everyone you care for.
          </p>
          <div className="mt-12 flex max-w-lg items-center gap-4 border-t border-border/70 pt-6 text-sm text-muted-foreground">
            <span className="grid size-10 place-items-center rounded-full bg-accent/20 text-accent-foreground"><HeartPulse size={18} /></span>
            Designed to make the next important action obvious.
          </div>
        </section>

        <section className="glass-panel mx-auto w-full max-w-md p-6 sm:p-8">
          <div className="mb-8 lg:hidden"><Brand /></div>
          <div>
            <p className="font-display text-sm font-semibold text-primary">Welcome back</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-foreground">Sign in to Vitals</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your family's daily care is waiting.</p>
          </div>

          {error && <p role="alert" className="mt-5 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</p>}

          <form onSubmit={handleLogin} className="mt-7 space-y-5">
            <label className="block text-sm font-semibold text-foreground">
              User ID
              <span className="input-wrap mt-2 flex items-center gap-3">
                <UserRound size={18} className="text-muted-foreground" />
                <input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your User ID" className="w-full bg-transparent py-3 outline-none placeholder:text-muted-foreground/60" />
              </span>
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Password
              <span className="input-wrap mt-2 flex items-center gap-3">
                <LockKeyhole size={18} className="text-muted-foreground" />
                <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full bg-transparent py-3 outline-none placeholder:text-muted-foreground/60" />
              </span>
            </label>
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in…" : "Sign in"}</Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-muted-foreground"><span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" /></div>
          <Button variant="secondary" className="w-full" onClick={() => { window.location.href = `${API}/auth/login`; }}>
            <span className="font-display text-base font-bold text-primary">G</span> Continue with Google
          </Button>
          <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">By continuing, you agree to keep your account details secure.</p>
        </section>
      </div>
    </main>
  );
}