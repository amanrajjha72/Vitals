import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, HeartPulse, LogOut, Plus, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const API = "https://vitals-bget.onrender.com";

type Medicine = { id: string | number; name: string; stockAvailable: number; intervalHours: number; nextDoseTime?: string };
type FamilyMember = { id: string | number; name: string; medicines?: Medicine[] };

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Today | Vitals" },
    { name: "description", content: "View today's family medicine schedule, stock, and dose status." },
    { property: "og:title", content: "Today | Vitals" },
    { property: "og:description", content: "Your family's daily medicine schedule in one clear view." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Dashboard,
});

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function doseTime(value?: string) { return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not scheduled"; }

function Dashboard() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"member" | "medicine" | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | number | null>(null);

  const load = useCallback(async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { await navigate({ to: "/" }); return; }
    try {
      const response = await fetch(`${API}/user/${userId}/family`);
      if (!response.ok) throw new Error();
      setMembers(await response.json());
    } catch { setMessage("We couldn't refresh your care list. Please try again."); }
    finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  const medicines = useMemo(() => members.flatMap((member) => (member.medicines || []).map((medicine) => ({ ...medicine, memberName: member.name }))), [members]);
  const sorted = useMemo(() => [...medicines].sort((a, b) => new Date(a.nextDoseTime || 8640000000000000).getTime() - new Date(b.nextDoseTime || 8640000000000000).getTime()), [medicines]);

  function openMedicine(memberId?: string | number) { setSelectedMember(memberId ?? members[0]?.id ?? null); setDialog("medicine"); }
  function logout() { localStorage.removeItem("userId"); void navigate({ to: "/" }); }

  if (loading) return <main className="app-shell grid min-h-screen place-items-center"><div className="text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground"><HeartPulse className="animate-pulse" /></span><p className="mt-4 text-sm font-semibold text-muted-foreground">Preparing today's care…</p></div></main>;

  return (
    <main className="app-shell min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/15"><HeartPulse size={20} /></span><span className="font-display text-lg font-bold">Vitals</span></div>
          <nav className="order-3 flex w-full justify-center gap-1 rounded-full bg-glass p-1.5 shadow-sm ring-1 ring-glass-border md:order-2 md:w-auto">
            <a href="#today" className="rounded-full bg-glass-strong px-4 py-2 text-sm font-semibold text-primary shadow-sm">Today</a><a href="#family" className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground">Family</a><a href="#inventory" className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground">Stock</a>
          </nav>
          <div className="order-2 flex items-center gap-2 md:order-3"><span className="hidden text-sm font-medium text-muted-foreground sm:block">{new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span><Button variant="ghost" aria-label="Log out" title="Log out" onClick={logout} className="size-10 px-0"><LogOut size={18} /></Button></div>
        </header>

        {message && <div className="mt-5 flex items-center justify-between rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive"><span>{message}</span><Button variant="ghost" aria-label="Dismiss" onClick={() => setMessage("")} className="size-8 min-h-8 px-0"><X size={16} /></Button></div>}

        <section id="today" className="mt-7 grid gap-5 lg:grid-cols-3">
          <div className="glass-panel p-5 sm:p-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-primary">Daily timeline</p><h1 className="mt-1 font-display text-2xl font-bold">Next up</h1><p className="mt-1 text-sm text-muted-foreground">{medicines.length ? `${medicines.length} medicines across ${members.length} family members` : "Your care schedule starts here"}</p></div><Button onClick={() => openMedicine()} disabled={!members.length}><Plus size={17} /> Add medicine</Button></div>
            <div className="mt-6 space-y-3">
              {sorted.map((medicine) => <DoseRow key={medicine.id} medicine={medicine} onLogged={load} />)}
              {!sorted.length && <EmptyState onAdd={() => members.length ? openMedicine() : setDialog("member")} />}
            </div>
          </div>

          <section id="inventory" className="glass-panel p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Medicine inventory</h2><p className="mt-1 text-sm text-muted-foreground">Stock across the household</p>
            <div className="mt-6 space-y-5">
              {medicines.slice(0, 6).map((medicine) => { const amount = Math.max(0, Math.min(100, medicine.stockAvailable)); return <div key={medicine.id}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold">{medicine.name}</span><span className={medicine.stockAvailable <= 5 ? "font-bold text-destructive" : "font-semibold text-primary"}>{medicine.stockAvailable} left</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={medicine.stockAvailable <= 5 ? "h-full bg-destructive" : "h-full bg-primary"} style={{ width: `${amount}%` }} /></div></div>; })}
              {!medicines.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Stock appears here once medicines are added.</p>}
            </div>
          </section>
        </section>

        <section id="family" className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <div className="glass-panel p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-display text-lg font-bold">Family members</h2><p className="text-sm text-muted-foreground">Care at a glance</p></div><Button variant="secondary" onClick={() => setDialog("member")}><Plus size={17} /> Add member</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{members.map((member) => <div key={member.id} className="rounded-lg bg-glass-strong p-4 ring-1 ring-glass-border"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-accent/25 text-sm font-bold text-accent-foreground">{initials(member.name)}</span><div className="min-w-0"><h3 className="truncate font-display text-sm font-semibold">{member.name}</h3><p className="text-xs text-muted-foreground">{member.medicines?.length || 0} medicines</p></div></div><Button variant="ghost" className="mt-3 w-full" onClick={() => openMedicine(member.id)}><Plus size={15} /> Add medicine</Button></div>)}</div></div>
          <div className="glass-panel p-5 sm:p-6"><h2 className="font-display text-lg font-bold">This week's rhythm</h2><p className="text-sm text-muted-foreground">A simple view of consistency</p><div className="mt-8 flex h-28 items-end gap-3">{[55, 78, 68, 92, 84, 42, 25].map((height, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-primary/70" style={{ height: `${height}%`, opacity: .38 + index * .08 }} /><span className="text-[10px] font-semibold text-muted-foreground">{"MTWTFSS"[index]}</span></div>)}</div></div>
        </section>
      </div>
      {dialog && <CareDialog kind={dialog} members={members} selectedMember={selectedMember} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); }} />}
    </main>
  );
}

function DoseRow({ medicine, onLogged }: { medicine: Medicine & { memberName: string }; onLogged: () => Promise<void> }) {
  const [taking, setTaking] = useState(false);
  const overdue = Boolean(medicine.nextDoseTime && new Date(medicine.nextDoseTime) < new Date());
  const empty = medicine.stockAvailable <= 0;
  async function take() { setTaking(true); try { const response = await fetch(`${API}/medicine/${medicine.id}/take`, { method: "PUT" }); if (!response.ok) throw new Error(); await onLogged(); } finally { setTaking(false); } }
  return <article className={overdue ? "dose-row border-destructive/25 bg-destructive-soft/55" : "dose-row"}><span className={overdue ? "grid size-11 shrink-0 place-items-center rounded-lg bg-destructive-soft text-destructive" : "grid size-11 shrink-0 place-items-center rounded-lg bg-accent/25 text-accent-foreground"}>{overdue ? <AlertTriangle size={19} /> : <HeartPulse size={19} />}</span><div className="min-w-0 flex-1"><h3 className="truncate font-display font-semibold">{medicine.name}</h3><p className="mt-1 text-sm text-muted-foreground">{medicine.memberName} · every {medicine.intervalHours}h · {medicine.stockAvailable} left</p></div><div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end"><span className={overdue ? "status-chip bg-destructive-soft text-destructive" : "status-chip bg-primary/10 text-primary"}>{overdue ? "Overdue" : doseTime(medicine.nextDoseTime)}</span><Button disabled={empty || taking} onClick={take}>{empty ? "Out of stock" : taking ? "Logging…" : "Log dose"}</Button></div></article>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) { return <div className="rounded-lg border border-dashed border-border px-5 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-accent/20 text-accent-foreground"><HeartPulse size={21} /></span><h3 className="mt-4 font-display font-semibold">A clear day starts here</h3><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Add a family member and their medicine to build today's schedule.</p><Button className="mt-5" onClick={onAdd}><Plus size={17} /> Add first item</Button></div>; }

function CareDialog({ kind, members, selectedMember, onClose, onSaved }: { kind: "member" | "medicine"; members: FamilyMember[]; selectedMember: string | number | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(""); const [memberId, setMemberId] = useState(String(selectedMember ?? members[0]?.id ?? "")); const [stock, setStock] = useState("30"); const [interval, setInterval] = useState("12"); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { const userId = localStorage.getItem("userId"); const response = await fetch(kind === "member" ? `${API}/family` : `${API}/medicine`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "member" ? { userId, name } : { familyMemberId: memberId, name, stockAvailable: Number(stock), intervalHours: Number(interval) }) }); if (!response.ok) throw new Error(); onSaved(); } catch { setError("We couldn't save this. Please check the details and retry."); } finally { setSaving(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-overlay px-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="glass-panel w-full max-w-md bg-popover p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-primary">Vitals</p><h2 id="dialog-title" className="mt-1 font-display text-xl font-bold">Add {kind === "member" ? "family member" : "medicine"}</h2></div><Button variant="ghost" aria-label="Close" onClick={onClose} className="size-9 min-h-9 px-0"><X size={18} /></Button></div>{error && <p className="mt-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}<form onSubmit={save} className="mt-6 space-y-4">{kind === "medicine" && <label className="block text-sm font-semibold">For family member<select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="field mt-2">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}<label className="block text-sm font-semibold">{kind === "member" ? "Name" : "Medicine name"}<input required value={name} onChange={(e) => setName(e.target.value)} className="field mt-2" placeholder={kind === "member" ? "e.g. Maya" : "e.g. Metformin 500mg"} /></label>{kind === "medicine" && <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-semibold">Pills in stock<input required min="0" type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="field mt-2" /></label><label className="block text-sm font-semibold">Hours apart<input required min="1" type="number" value={interval} onChange={(e) => setInterval(e.target.value)} className="field mt-2" /></label></div>}<div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || (kind === "medicine" && !memberId)}><Check size={16} />{saving ? "Saving…" : "Save"}</Button></div></form></section></div>;
}