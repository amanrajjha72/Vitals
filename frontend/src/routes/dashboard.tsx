import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, HeartPulse, LogOut, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const API = "https://vitals-bget.onrender.com";

type Medicine = { 
  id: string | number; 
  name: string; 
  stockAvailable: number; 
  scheduledTimes: string[]; 
  nextDoseTime?: string;
  familyMemberId?: string | number;
};
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
  const [rhythm, setRhythm] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
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
      
      const rhythmRes = await fetch(`${API}/user/${userId}/rhythm`);
      if (rhythmRes.ok) setRhythm(await rhythmRes.json());
    } catch { 
      setMessage("We couldn't refresh your care list. Please try again."); 
    } finally { 
      setLoading(false); 
    }
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  const medicines = useMemo(() => members.flatMap((member) => (member.medicines || []).map((medicine) => ({ ...medicine, memberName: member.name, familyMemberId: member.id }))), [members]);
  const sorted = useMemo(() => [...medicines].sort((a, b) => new Date(a.nextDoseTime || 8640000000000000).getTime() - new Date(b.nextDoseTime || 8640000000000000).getTime()), [medicines]);

  function openMedicine(memberId?: string | number) { setSelectedMember(memberId ?? members[0]?.id ?? null); setDialog("medicine"); }
  function openEdit(med: Medicine) { setSelectedMedicine(med); setDialog("edit-medicine"); }
  function openRefill(med: Medicine) { setSelectedMedicine(med); setDialog("refill"); }
  function logout() { localStorage.removeItem("userId"); void navigate({ to: "/" }); }

  async function handleReportUpload(memberId: string | number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("report", file);

    try {
      const response = await fetch(`${API}/family/${memberId}/report`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      
      setMessage(`Report uploaded successfully for ${file.name}`);
      void load();
    } catch {
      setMessage("Failed to upload the report. Please try again.");
    }
  }

  if (loading) return <main className="app-shell grid min-h-screen place-items-center"><div className="text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground"><HeartPulse className="animate-pulse" /></span><p className="mt-4 text-sm font-semibold text-muted-foreground">Preparing today's care…</p></div></main>;

  return (
    <main className="app-shell min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/15"><HeartPulse size={20} /></span><span className="font-display text-lg font-bold">Vitals</span></div>
          <nav className="order-3 flex w-full justify-center gap-1 rounded-full bg-glass p-1.5 shadow-sm ring-1 ring-glass-border md:order-2 md:w-auto">
            <a href="#today" className="rounded-full bg-glass-strong px-4 py-2 text-sm font-semibold text-primary shadow-sm">Today</a><a href="#family" className="rounded-full px