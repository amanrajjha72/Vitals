import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, HeartPulse, LogOut, Plus, X, Pill, Clock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const API = "https://vitals-bget.onrender.com";

type Medicine = { id: string | number; name: string; stockAvailable: number; scheduledTimes: string[]; nextDoseTime?: string; familyMemberId?: string | number };
type FamilyMember = { id: string | number; name: string; medicines?: Medicine[] };

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Today | Vitals" }] }),
  component: Dashboard,
});

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function doseTime(value?: string) { return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not scheduled"; }

function Dashboard() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  
  const [dialog, setDialog] = useState<"member" | "medicine" | "edit-medicine" | "refill" | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | number | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  const load = useCallback(async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { await navigate({ to: "/" }); return; }
    try {
      const response = await fetch(`${API}/user/${userId}/family`);
      if (!response.ok) throw new Error();
      setMembers(await response.json());
    } catch { setMessage("We couldn't refresh your care list."); }
    finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  const medicines = useMemo(() => members.flatMap((member) => (member.medicines || []).map((medicine) => ({ ...medicine, memberName: member.name, familyMemberId: member.id }))), [members]);
  const sorted = useMemo(() => [...medicines].sort((a, b) => new Date(a.nextDoseTime || 8640000000000000).getTime() - new Date(b.nextDoseTime || 8640000000000000).getTime()), [medicines]);

  function openMedicine(memberId?: string | number) { setSelectedMember(memberId ?? members[0]?.id ?? null); setDialog("medicine"); }
  function openEdit(med: Medicine) { setSelectedMedicine(med); setDialog("edit-medicine"); }
  function openRefill(med: Medicine) { setSelectedMedicine(med); setDialog("refill"); }
  function logout() { localStorage.removeItem("userId"); void navigate({ to: "/" }); }

  if (loading) return <main className="grid min-h-screen place-items-center bg-zinc-50/50"><HeartPulse className="size-8 animate-pulse text-zinc-400" /></main>;

  return (
    <main className="min-h-screen bg-zinc-50/30 selection:bg-zinc-200">
      <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-md bg-zinc-900 text-white"><HeartPulse size={16} strokeWidth={2.5} /></div><span className="font-semibold text-zinc-900">Vitals</span></div>
          <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={logout} className="text-zinc-500 hover:text-zinc-900"><LogOut size={18} /></Button></div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {message && <div className="mb-8 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"><span>{message}</span><Button variant="ghost" size="icon" onClick={() => setMessage("")} className="h-6 w-6"><X size={14} /></Button></div>}

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="mb-6 flex items-end justify-between">
              <div><h1 className="text-2xl font-bold tracking-tight text-zinc-900">Schedule</h1><p className="mt-1 text-sm text-zinc-500">{medicines.length ? `${medicines.length} medications managed today` : "No medications scheduled"}</p></div>
              <Button onClick={() => openMedicine()} disabled={!members.length} className="bg-zinc-900 hover:bg-zinc-800"><Plus size={16} className="mr-2" /> Add</Button>
            </div>
            <div className="space-y-3">
              {sorted.map((medicine) => <DoseRow key={medicine.id} medicine={medicine} onLogged={load} onEdit={openEdit} onRefill={openRefill} />)}
              {!sorted.length && <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-16"><Pill size={20} className="text-zinc-400 mb-4" /><h3 className="text-sm font-semibold">Clean slate</h3><Button className="mt-4 bg-zinc-900 hover:bg-zinc-800" onClick={() => members.length ? openMedicine() : setDialog("member")}>Add First Item</Button></div>}
            </div>
          </div>

          <div className="space-y-8 lg:col-span-4">
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-2"><Pill size={18} className="text-zinc-400" /><h2 className="font-semibold text-zinc-900">Low Stock Alerts</h2></div>
              <div className="space-y-5">
                {medicines.slice(0, 6).map((medicine) => (
                  <div key={medicine.id}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-zinc-700">{medicine.name}</span><span className={`font-semibold ${medicine.stockAvailable <= 5 ? "text-red-600" : "text-zinc-500"}`}>{medicine.stockAvailable} left</span></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100"><div className={`h-full rounded-full ${medicine.stockAvailable <= 5 ? "bg-red-500" : "bg-zinc-900"}`} style={{ width: `${Math.max(0, Math.min(100, medicine.stockAvailable))}%` }} /></div></div>
                ))}
              </div>
            </section>
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between"><h2 className="font-semibold text-zinc-900">Profiles</h2><Button variant="ghost" size="sm" onClick={() => setDialog("member")} className="h-8 px-2 text-zinc-500"><Plus size={16} className="mr-1" /> Add</Button></div>
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{initials(member.name)}</span><div><p className="text-sm font-medium text-zinc-900">{member.name}</p><p className="text-xs text-zinc-500">{member.medicines?.length || 0} prescriptions</p></div></div><Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900" onClick={() => openMedicine(member.id)}><Plus size={14} /></Button></div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      {dialog && <CareDialog kind={dialog} members={members} selectedMember={selectedMember} medicineToEdit={selectedMedicine ?? undefined} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); }} />}
    </main>
  );
}

function DoseRow({ medicine, onLogged, onEdit, onRefill }: { medicine: Medicine & { memberName: string }; onLogged: () => Promise<void>; onEdit: (med: Medicine) => void; onRefill: (med: Medicine) => void; }) {
  const [taking, setTaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const overdue = Boolean(medicine.nextDoseTime && new Date(medicine.nextDoseTime) < new Date());
  const empty = medicine.stockAvailable <= 0;
  
  async function take() { 
    setTaking(true); setErrorMsg("");
    try { 
      const response = await fetch(`${API}/medicine/${medicine.id}/take`, { method: "PUT" }); 
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to log");
      }
      await onLogged(); 
    } catch (e: any) { setErrorMsg(e.message); setTimeout(() => setErrorMsg(""), 3000); } 
    finally { setTaking(false); } 
  }

  return (
    <article className={`group flex flex-col gap-4 rounded-xl border p-4 transition-all hover:shadow-sm sm:flex-row sm:items-center sm:justify-between ${overdue ? "border-red-200 bg-red-50/50" : "border-zinc-200 bg-white"}`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`grid size-12 shrink-0 place-items-center rounded-lg ${overdue ? "bg-red-100 text-red-600" : "bg-zinc-100 text-zinc-600"}`}>{overdue ? <AlertTriangle size={20} /> : <Clock size={20} />}</div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-900">{medicine.name}</h3>
          <p className="mt-0.5 truncate text-sm text-zinc-500"><span className="font-medium text-zinc-700">{medicine.memberName}</span> • {medicine.scheduledTimes?.join(", ") || "No times set"}</p>
          {errorMsg && <p className="text-xs text-red-600 mt-1 font-medium">{errorMsg}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className={`hidden text-sm font-medium md:block mr-2 ${overdue ? "text-red-600" : "text-zinc-500"}`}>{overdue ? "Overdue" : doseTime(medicine.nextDoseTime)}</span>
        <Button variant="outline" size="sm" onClick={() => onRefill(medicine)} className="border-zinc-200 text-zinc-600">Refill</Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(medicine)} className="border-zinc-200 text-zinc-600">Edit</Button>
        <Button disabled={empty || taking} onClick={take} variant={overdue ? "destructive" : "outline"} className={!overdue ? "border-zinc-200 text-zinc-800 hover:bg-zinc-100" : ""}>{empty ? "Empty" : taking ? "..." : "Log Dose"}</Button>
      </div>
    </article>
  );
}

function CareDialog({ kind, members, selectedMember, medicineToEdit, onClose, onSaved }: { kind: "member" | "medicine" | "edit-medicine" | "refill"; members: FamilyMember[]; selectedMember: string | number | null; medicineToEdit?: Medicine; onClose: () => void; onSaved: () => void }) {
  const isEditing = kind === "edit-medicine";
  const isRefill = kind === "refill";
  
  const [name, setName] = useState((isEditing || isRefill) ? (medicineToEdit?.name || "") : ""); 
  const [memberId, setMemberId] = useState(String(medicineToEdit?.familyMemberId ?? selectedMember ?? members[0]?.id ?? "")); 
  const [stock, setStock] = useState(isEditing ? String(medicineToEdit?.stockAvailable || 0) : isRefill ? "30" : "30"); 
  const [times, setTimes] = useState<string[]>(isEditing && medicineToEdit?.scheduledTimes?.length ? medicineToEdit.scheduledTimes : ["08:00"]);
  
  const [saving, setSaving] = useState(false); 
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) { 
    event.preventDefault(); setSaving(true); setError(""); 
    try { 
      let response;
      if (kind === "member") {
        response = await fetch(`${API}/family`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: localStorage.getItem("userId"), name }) }); 
      } else if (isEditing && medicineToEdit) {
        response = await fetch(`${API}/medicine/${medicineToEdit.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stockAvailable: Number(stock), scheduledTimes: times }) });
      } else {
        response = await fetch(`${API}/medicine`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ familyMemberId: memberId, name, stockAvailable: Number(stock), scheduledTimes: times }) });
      }
      if (!response.ok) throw new Error(); 
      onSaved(); 
    } catch { setError("We couldn't save this. Please retry."); } 
    finally { setSaving(false); } 
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-900/40 px-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">{kind === "member" ? "Add Profile" : isEditing ? "Edit Schedule" : isRefill ? "Refill Medicine" : "Add Medicine"}</h2>
            <p className="mt-1 text-sm text-zinc-500">{isRefill ? `Add stock to ${medicineToEdit?.name}` : "Enter the details below."}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-500"><X size={16} /></Button>
        </div>
        
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
        
        <form onSubmit={save} className="mt-6 space-y-4">
          {kind === "medicine" && (
            <div className="space-y-1.5"><label className="text-sm font-medium text-zinc-900">For family member</label><select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="flex h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          )}
          
          {(kind === "member" || kind === "medicine") && (
            <div className="space-y-1.5"><label className="text-sm font-medium text-zinc-900">{kind === "member" ? "Name" : "Medicine name"}</label><input required value={name} onChange={(e) => setName(e.target.value)} className="flex h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder={kind === "member" ? "e.g. Maya" : "e.g. Metformin"} /></div>
          )}

          {kind !== "member" && (
            <div className="space-y-4">
              <div className="space-y-1.5"><label className="text-sm font-medium text-zinc-900">{isRefill ? "Amount to add" : "Pills in stock"}</label><input required min="1" type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="flex h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" /></div>
              
              {!isRefill && (
                <div className="space-y-2"><label className="text-sm font-medium text-zinc-900">Dose Times</label>
                  {times.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-2"><input type="time" value={time} onChange={(e) => { const nt = [...times]; nt[idx] = e.target.value; setTimes(nt); }} required className="flex h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />{times.length > 1 && (<Button type="button" variant="ghost" size="icon" onClick={() => setTimes(times.filter((_, i) => i !== idx))} className="h-10 w-10 shrink-0 text-red-500 hover:bg-red-50"><X size={16} /></Button>)}</div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTimes([...times, "12:00"])} className="mt-2 text-zinc-500"><Plus size={14} className="mr-1" /> Add another time</Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-zinc-900 hover:bg-zinc-800 text-white">{saving ? "Saving…" : "Save Record"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}