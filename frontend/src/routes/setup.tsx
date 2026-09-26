import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HeartPulse, LockKeyhole, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const API = "https://vitals-bget.onrender.com";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [{ title: "Vitals | Setup Credentials" }],
  }),
  component: SetupScreen,
});

function Brand() {
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/15">
        <HeartPulse size={20} strokeWidth={2.2} />
      </span>
      <span className="font-display text-xl font-bold text-foreground">Vitals</span>
    </div>
  );
}

function SetupScreen() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = localStorage.getItem("userId");

    if (!userId) {
      void navigate({ to: "/" });
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/setup-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_db_id: userId,
          username,
          password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.detail || "Failed to set up credentials.");
      
      void navigate({ to: "/dashboard" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't reach Vitals. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell min-h-screen flex items-center justify-center p-5">
      <section className="glass-panel w-full max-w-md p-6 sm:p-8">
        <Brand />
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground">Set up a Custom Login</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a User ID and password so you can log in without Google next time.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive text-center">
            {error}
          </p>
        )}

        <form onSubmit={handleSetup} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold text-foreground">
            Choose a User ID
            <span className="input-wrap mt-2 flex items-center gap-3">
              <UserRound size={18} className="text-muted-foreground" />
              <input
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g., aman123"
                className="w-full bg-transparent py-3 outline-none placeholder:text-muted-foreground/60"
              />
            </span>
          </label>

          <label className="block text-sm font-semibold text-foreground">
            Choose a Password
            <span className="input-wrap mt-2 flex items-center gap-3">
              <LockKeyhole size={18} className="text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a secure password"
                className="w-full bg-transparent py-3 outline-none placeholder:text-muted-foreground/60"
              />
            </span>
          </label>

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? "Saving…" : "Save Credentials"}
          </Button>
        </form>

        <div className="mt-4">
          <Button
            variant="secondary"
            className="w-full bg-transparent border border-border/50 text-muted-foreground hover:bg-muted/50"
            onClick={() => void navigate({ to: "/dashboard" })}
          >
            Skip for now
          </Button>
        </div>
      </section>
    </main>
  );
}