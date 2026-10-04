import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, HeartPulse, LogOut, Plus, X, Pill, Clock, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const API = "https://vitals-bget.onrender.com";

type Medicine = { id: string | number; name: string; stockAvailable: number; scheduledTimes: string[]; nextDoseTime?: string };
type FamilyMember = { id: string | number; name: string; medicines?: Medicine[] };

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Today | Vitals" },
    { name: "description", content: "View today's family medicine schedule, stock, and dose status." },
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
  
  // Dialog state logic
  const [dialog, setDialog] = useState<"member" | "medicine" | "edit-medicine" | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | number | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

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

  function openMedicine(memberId?: string | number) { 
    setSelectedMember(memberId ?? members[0]?.id ?? null); 
    setDialog("medicine"); 
  }
  
  function openEditMedicine(medicine: Medicine) {
    setSelectedMedicine(medicine);
    setDialog("edit-medicine");
  }

  function logout() { localStorage.removeItem("userId"); void navigate({ to: "/" }); }

  if (loading) return (
    <main className="grid min-h-screen place-items-center bg-zinc-50/50">
      <div className="flex flex-col items-center gap-3">
        <HeartPulse className="size-8 animate-pulse text-zinc-400" />
        <p className="text-sm font-medium text-zinc-500">Preparing today's schedule...</p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-zinc-50/30 selection:bg-zinc-200">
      <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-md bg-zinc-900 text-white shadow-sm">
              <HeartPulse size={16} strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-tight text-zinc-900">Vitals</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-zinc-500">
            <a href="#today" className="text-zinc-900 transition-colors hover:text-zinc-900">Today</a>
            <a href="#family" className="transition-colors hover:text-zinc-900">Family</a>
            <a href="#inventory" className="transition-colors hover:text-zinc-900">Stock</a>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium text-zinc-500 md:block">
              {new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} className="text-zinc-500 hover:text-zinc-900">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {message && (
          <div className="mb-8 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            <span>{message}</span>
            <Button variant="ghost" size="icon" onClick={() => setMessage("")} className="h-6 w-6 hover:bg-red-100">
              <X size={14} />
            </Button>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Schedule</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  {medicines.length ? `${medicines.length} medications to manage today` : "No medications scheduled"}
                </p>
              </div>
              <Button onClick={() => openMedicine()} disabled={!members.length} className="bg-zinc-900 hover:bg-zinc-800 shadow-sm">
                <Plus size={16} className="mr-2" /> Add Medicine
              </Button>
            </div>

            <div className="space-y-3">
              {sorted.map((medicine) => <DoseRow key={medicine.id} medicine={medicine} onLogged={load} onEdit={openEditMedicine} />)}
              {!sorted.length && <EmptyState onAdd={() => members.length ? openMedicine() : setDialog("member")} />}
            </div>
          </div>

          <div className="space-y-8 lg:col-span-4">
            <section id="inventory" className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-2">
                <Pill size={18} className="text-zinc-400" />
                <h2 className="font-semibold tracking-tight text-zinc-900">Low Stock Alerts</h2>
              </div>
              
              <div className="space-y-5">
                {medicines.slice(0, 6).map((medicine) => { 
                  const amount = Math.max(0, Math.min(100, medicine.stockAvailable)); 
                  const isLow = medicine.stockAvailable <= 5;
                  return (
                    <div key={medicine.id}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-700">{medicine.name}</span>
                        <span className={`font-semibold ${isLow ? "text-red-600" : "text-zinc-500"}`}>
                          {medicine.stockAvailable} left
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div className={`h-full rounded-full transition-all duration-500 ${isLow ? "bg-red-500" : "bg-zinc-900"}`} style={{ width: `${amount}%` }} />
                      </div>
                    </div>
                  ); 
                })}
                {!medicines.length && <p className="text-sm text-zinc-500">Inventory tracking will appear here.</p>}
              </div>
            </section>

            <section id="family" className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-semibold tracking-tight text-zinc-900">Profiles</h2>
                <Button variant="ghost" size="sm" onClick={() => setDialog("member")} className="h-8 px-2 text-zinc-500 hover:text-zinc-900">
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                        {initials(member.name)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{member.name}</p>
                        <p className="text-xs text-zinc-500">{member.medicines?.length || 0} active prescriptions</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100" onClick={() => openMedicine(member.id)}>
                      <Plus size={14} />
                    </Button>
                  </div>
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

function DoseRow({ medicine, onLogged, onEdit }: { medicine: Medicine & { memberName: string }; onLogged: () => Promise<void>; onEdit: (med: Medicine) => void }) {
  const [taking, setTaking] = useState(false);
  const overdue = Boolean(medicine.nextDoseTime && new Date(medicine.nextDoseTime) < new Date());
  const empty = medicine.stockAvailable <= 0;
  
  async function take() { 
    setTaking(true); 
    try { 
      const response = await fetch(`${API}/medicine/${medicine.id}/take`, { method: "PUT" }); 
      if (!response.ok) throw new Error(); 
      await onLogged(); 
    } finally { setTaking(false); } 
  }

  return (
    <article className={`group flex items-center justify-between rounded-xl border p-4 transition-all hover:shadow-sm ${overdue ? "border-red-200 bg-red-50/50" : "border-zinc-200 bg-white"}`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`grid size-12 shrink-0 place-items-center rounded-lg ${overdue ? "bg-red-100 text-red-600" : "bg-zinc-100 text-zinc-600"}`}>
          {overdue ? <AlertTriangle size={20} /> : <Clock size={20} />}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-900">{medicine.name}</h3>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            <span className="font-medium text-zinc-700">{medicine.memberName}</span> • {medicine.scheduledTimes?.join(", ") || "No times set"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <span className={`hidden text-sm font-medium sm:block ${overdue ? "text-red-600" : "text-zinc-500"}`}>
          {overdue ? "Overdue" : doseTime(medicine.nextDoseTime)}
        </span>
        <Button variant="ghost" size="icon" onClick={() => onEdit(medicine)} className="h-9 w-9 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100" title="Edit Schedule">
          <Pencil size={15} />
        </Button>
        <Button 
          disabled={empty || taking} 
          onClick={take}
          variant={overdue ? "destructive" : "outline"}
          className={!overdue ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50" : ""}
        >
          {empty ? "Out of stock" : taking ? "Logging…" : "Log Dose"}
        </Button>
      </div>
    </article>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) { 
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-16">
      <div className="grid size-12 place-items-center rounded-full bg-zinc-200/50 text-zinc-500">
        <Pill size={20} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-zinc-900">No medications scheduled</h3>
      <p className="mt-1 max-w-sm text-center text-sm text-zinc-500">Add a family member and their prescriptions to generate the daily schedule.</p>
      <Button className="mt-6 bg-zinc-900 hover:bg-zinc-800" onClick={onAdd}>
        <Plus size={16} className="mr-2" /> Add First Item
      </Button>
    </div>
  ); 
}

function CareDialog({ kind, members, selectedMember, medicineToEdit, onClose, onSaved }: { kind: "member" | "medicine" | "edit-medicine"; members: FamilyMember[]; selectedMember: string | number | null; medicineToEdit?: Medicine; onClose: () => void; onSaved: () => void }) {
  const isEditing = kind === "edit-medicine";
  
  const [name, setName] = useState(isEditing ? (medicineToEdit?.name || "") : ""); 
  const [memberId, setMemberId] = useState(String(selectedMember ?? members[0]?.id ?? "")); 
  const [stock, setStock] = useState(isEditing ? String(medicineToEdit?.stockAvailable || 0) : "30"); 
  
  // Dynamic array of time strings for Scheduled Doses
  const [times, setTimes] = useState<string[]>(isEditing && medicineToEdit?.scheduledTimes?.length ? medicineToEdit.scheduledTimes : ["08:00"]);
  
  const [saving, setSaving] = useState(false); 
  const [error, setError] = useState("");
  
  function updateTime(index: number, value: string) {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  }

  function addTime() { setTimes([...times, "12:00"]); }
  function removeTime(index: number) { setTimes(times.filter((_, i) => i !== index)); }

  async function save(event: FormEvent<HTMLFormElement>) { 
    event.preventDefault(); 
    setSaving(true); 
    setError(""); 
    
    try { 
      const userId = localStorage.getItem("userId"); 
      
      let response;
      if (kind === "member") {
        response = await fetch(`${API}/family`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, name }) }); 
      } else if (isEditing && medicineToEdit) {
        // Hitting the new PUT route
        response = await fetch(`${API}/medicine/${medicineToEdit.id}`, { 
          method: "PUT", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ stockAvailable: Number(stock), scheduledTimes: times }) 
        });
      } else {
        response = await fetch(`${API}/medicine`, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ familyMemberId: memberId, name, stockAvailable: Number(stock), scheduledTimes: times }) 
        });
      }

      if (!response.ok) throw new Error(); 
      onSaved(); 
    } catch { 
      setError("We couldn't save this. Please check the details and retry."); 
    } finally { 
      setSaving(false); 
    } 
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-900/40 px-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">
              {kind === "member" ? "Add Profile" : isEditing ? "Edit Medicine Schedule" : "Add Medicine"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {isEditing ? `Updating ${medicineToEdit?.name}` : "Enter the details below to update your records."}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-500">
            <X size={16} />
          </Button>
        </div>
        
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
        
        <form onSubmit={save} className="mt-6 space-y-4">
          {kind === "medicine" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-900">For family member</label>
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2">
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </div>
          )}
          
          {!isEditing && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-900">{kind === "member" ? "Name" : "Medicine name"}</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2" placeholder={kind === "member" ? "e.g. Maya" : "e.g. Metformin 500mg"} />
            </div>
          )}

          {kind !== "member" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-900">Pills in stock</label>
                <input required min="0" type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-900">Dose Times</label>
                {times.map((time, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input 
                      type="time" 
                      value={time} 
                      onChange={(e) => updateTime(idx, e.target.value)} 
                      required 
                      className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2" 
                    />
                    {times.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeTime(idx)} className="h-10 w-10 shrink-0 text-zinc-400 hover:text-red-600 hover:bg-red-50">
                        <X size={16} />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={addTime} className="mt-2 text-zinc-500 hover:text-zinc-900">
                  <Plus size={14} className="mr-1" /> Add another time
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
            <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-600">Cancel</Button>
            <Button type="submit" disabled={saving || (kind === "medicine" && !memberId)} className="bg-zinc-900 hover:bg-zinc-800">
              {saving ? "Saving…" : "Save Record"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}