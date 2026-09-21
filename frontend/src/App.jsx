import { useState, useEffect } from 'react'
import { Activity, LogOut, Plus, Pill, FileText, User, Paperclip, Clock, Repeat, Upload } from 'lucide-react'
import './App.css' 

function App() {
  const [userId, setUserId] = useState(localStorage.getItem('userId') || null)
  const [family, setFamily] = useState([])
  const [loading, setLoading] = useState(true)
  const [newPatientName, setNewPatientName] = useState("")
  const [medicineInputs, setMedicineInputs] = useState({})

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const idFromUrl = params.get('userId')

    if (idFromUrl) {
      setUserId(idFromUrl)
      localStorage.setItem('userId', idFromUrl)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (userId) {
      fetchFamilyData()
    }
  }, [userId])

  const fetchFamilyData = () => {
    if (!userId) return 
    fetch(`https://vitals-bget.onrender.com/family/?user_id=${userId}`)
      .then(response => response.json())
      .then(data => {
        const familyArray = Array.isArray(data) ? data : (data.family || [])
        setFamily(familyArray) 
        setLoading(false)
      })
      .catch(error => {
        console.error("Error fetching family:", error)
        setLoading(false)
      })
  }

  const handleAddPatient = async (e) => {
    e.preventDefault()
    if (!newPatientName.trim()) return
    try {
      const response = await fetch("https://vitals-bget.onrender.com/family/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPatientName, userId: userId })
      })
      if (response.ok) {
        setNewPatientName("")
        fetchFamilyData()
      }
    } catch (error) { console.error("Error adding patient:", error) }
  }

  const handleMedInputChange = (memberId, field, value) => {
    setMedicineInputs(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], [field]: value }
    }))
  }

  const handleAddMedicine = async (memberId, e) => {
    e.preventDefault()
    const medData = medicineInputs[memberId]
    
    if (!medData || !medData.name || !medData.stock || !medData.intervalHours || !medData.dosesPerDay) return

    try {
      const response = await fetch(`https://vitals-bget.onrender.com/family/${memberId}/medicine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: medData.name, 
          totalStock: parseInt(medData.stock),
          intervalHours: parseInt(medData.intervalHours),
          dosesPerDay: parseInt(medData.dosesPerDay)
        })
      })
      if (response.ok) {
        setMedicineInputs(prev => ({ ...prev, [memberId]: { name: "", stock: "", intervalHours: "", dosesPerDay: "" } }))
        fetchFamilyData()
      }
    } catch (error) { console.error("Error adding medicine:", error) }
  }

  const handleTakeDose = async (medicineId, currentStock) => {
    if (currentStock <= 0) {
      alert("Out of stock!")
      return
    }
    try {
      const response = await fetch(`https://vitals-bget.onrender.com/medicine/${medicineId}/take`, {
        method: 'PUT',
      })
      if (response.ok) fetchFamilyData() 
    } catch (error) { console.error("Error taking dose:", error) }
  }

  const handleFileUpload = async (memberId, event) => {
    const file = event.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch(`https://vitals-bget.onrender.com/family/${memberId}/report`, {
        method: 'POST',
        body: formData,
      })
      if (response.ok) {
        alert(`${file.name} uploaded successfully!`)
        event.target.value = null 
        fetchFamilyData() 
      } else { alert("Failed to upload report.") }
    } catch (error) { console.error("Error uploading file:", error) }
  }

  const handleLogout = () => {
    localStorage.removeItem('userId')
    setUserId(null)
    setFamily([])
  }

  if (!userId) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-zinc-100 p-10 text-center overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="p-4 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl mb-6 shadow-2xl">
            <Activity size={48} className="text-indigo-400" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent mb-4">Vitals Tracker</h1>
          <p className="text-zinc-400 max-w-md text-lg mb-10 leading-relaxed">Secure, automated prescription management with real-time escalation alerts.</p>
          <a href="http://localhost:8000/auth/login" className="inline-flex items-center gap-3 bg-zinc-100 text-zinc-900 hover:bg-white transition-all px-6 py-3 rounded-xl text-base font-semibold shadow-lg shadow-white/5 hover:scale-105 active:scale-95">
            <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" className="w-5 h-5" />
            Continue with Google
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-indigo-500/30 pb-20">
      {/* Ambient Background Effects */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-6xl mx-auto p-6 md:p-10 z-10">
        
        {/* Navigation */}
        <header className="flex justify-between items-center pb-6 border-b border-zinc-800/50 mb-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Activity size={24} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent m-0">Vitals</h1>
          </div>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/50 text-zinc-300 border border-zinc-800 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 rounded-xl font-medium transition-all text-sm">
            <LogOut size={16} /> Sign out
          </button>
        </header>
        
        {/* Registration Bar */}
        <form onSubmit={handleAddPatient} className="flex flex-col sm:flex-row gap-3 mb-12 p-2 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl shadow-xl">
          <input 
            type="text" 
            placeholder="Register new patient profile..." 
            value={newPatientName}
            onChange={(e) => setNewPatientName(e.target.value)}
            className="flex-1 bg-transparent border-none text-zinc-100 px-4 py-3 focus:outline-none placeholder:text-zinc-600 text-sm md:text-base"
          />
          <button type="submit" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40">
            <Plus size={18} /> Add Profile
          </button>
        </form>
        
        {loading ? (
          <div className="text-center p-20 flex flex-col items-center gap-4">
            <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
              <Activity size={32} className="text-indigo-400 animate-spin" />
            </div>
            <p className="text-zinc-500 font-medium">Syncing secure vault...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {family.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center p-20 text-center bg-zinc-900/20 border border-zinc-800/50 rounded-3xl border-dashed">
                <User size={48} className="text-zinc-700 mb-4" />
                <h3 className="text-xl font-semibold text-zinc-300 mb-2">No active profiles</h3>
                <p className="text-zinc-500">Register a patient using the bar above to begin tracking their vitals.</p>
              </div>
            )}
            
            {family.map(member => (
              <div key={member.id} className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 rounded-3xl p-6 hover:bg-zinc-900/60 hover:border-indigo-500/30 transition-all duration-300 shadow-xl group">
                
                {/* Card Header */}
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-zinc-800/50">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <User size={20} className="text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white tracking-tight m-0">{member.name}</h3>
                    <p className="text-xs text-zinc-500 mt-1">Patient ID: {member.id.substring(0,8)}</p>
                  </div>
                </div>
                
                {/* Active Prescriptions */}
                <div className="mb-6">
                  {member.medicines && member.medicines.length > 0 ? (
                    <ul className="flex flex-col gap-3 p-0 m-0 list-none">
                      {member.medicines.map(med => (
                        <li key={med.id} className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 flex justify-between items-center group-hover:border-zinc-700 transition-colors">
                          <div className="flex flex-col gap-2">
                            <span className="text-zinc-100 font-semibold">{med.name}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide">
                                <Clock size={10}/> {med.intervalHours}h
                              </span>
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide">
                                <Repeat size={10}/> {med.dosesPerDay}x
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Stock: {med.stockAvailable}</span>
                          </div>
                          <button onClick={() => handleTakeDose(med.id, med.stockAvailable)} className="inline-flex items-center gap-2 p-3 bg-zinc-800 hover:bg-indigo-500 hover:text-white text-zinc-300 rounded-xl transition-all shadow-sm shrink-0">
                            <Pill size={18} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 bg-zinc-950/30 rounded-2xl border border-zinc-800/30 text-center">
                      <p className="text-zinc-500 text-sm italic m-0">No active prescriptions.</p>
                    </div>
                  )}
                </div>

                {/* Add Medicine Form */}
                <form onSubmit={(e) => handleAddMedicine(member.id, e)} className="flex flex-wrap gap-2 mb-8 bg-zinc-950/50 p-2 rounded-2xl border border-zinc-800/50">
                  <input 
                    type="text" 
                    placeholder="Medication name..." 
                    value={medicineInputs[member.id]?.name || ""}
                    onChange={(e) => handleMedInputChange(member.id, "name", e.target.value)}
                    className="flex-[1_1_100px] bg-transparent border-none text-zinc-100 px-3 py-2 text-sm focus:outline-none placeholder:text-zinc-600"
                  />
                  <div className="flex gap-2 w-full md:w-auto">
                    <input 
                      type="number" 
                      placeholder="Hrs" 
                      title="Hours between doses"
                      value={medicineInputs[member.id]?.intervalHours || ""}
                      onChange={(e) => handleMedInputChange(member.id, "intervalHours", e.target.value)}
                      className="w-[60px] bg-zinc-900 border border-zinc-800 text-zinc-100 px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-center placeholder:text-zinc-600"
                      min="1"
                    />
                    <input 
                      type="number" 
                      placeholder="x/Day" 
                      title="Number of doses per day"
                      value={medicineInputs[member.id]?.dosesPerDay || ""}
                      onChange={(e) => handleMedInputChange(member.id, "dosesPerDay", e.target.value)}
                      className="w-[68px] bg-zinc-900 border border-zinc-800 text-zinc-100 px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-center placeholder:text-zinc-600"
                      min="1"
                    />
                    <input 
                      type="number" 
                      placeholder="Qty" 
                      value={medicineInputs[member.id]?.stock || ""}
                      onChange={(e) => handleMedInputChange(member.id, "stock", e.target.value)}
                      className="w-[60px] bg-zinc-900 border border-zinc-800 text-zinc-100 px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-center placeholder:text-zinc-600"
                      min="1"
                    />
                    <button type="submit" className="p-2.5 bg-zinc-800 hover:bg-indigo-500 text-zinc-300 hover:text-white rounded-xl transition-colors">
                      <Plus size={16} />
                    </button>
                  </div>
                </form>

                {/* Medical Records */}
                <div className="pt-6 border-t border-zinc-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-zinc-200 text-sm font-semibold flex items-center gap-2 m-0">
                      <FileText size={16} className="text-indigo-400" /> Medical Records
                    </h4>
                  </div>
                  
                  <label className="flex items-center justify-center w-full p-4 mb-4 bg-zinc-950/50 border border-zinc-800/50 border-dashed rounded-2xl cursor-pointer hover:bg-zinc-900 hover:border-indigo-500/50 transition-all group/upload">
                    <div className="flex items-center gap-3 text-zinc-500 group-hover/upload:text-indigo-400 transition-colors">
                      <Upload size={18} />
                      <span className="text-sm font-medium">Upload Document</span>
                    </div>
                    <input 
                      type="file" 
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(member.id, e)}
                      className="hidden"
                    />
                  </label>
                  
                  {member.reports && member.reports.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {member.reports.map(report => (
                        <a key={report.id} href={`https://vitals-bget.onrender.com/${report.fileUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-zinc-300 bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-300 transition-all text-sm group/link">
                          <div className="p-1.5 bg-zinc-800 group-hover/link:bg-indigo-500/20 rounded-lg text-zinc-400 group-hover/link:text-indigo-400 transition-colors">
                            <Paperclip size={14} /> 
                          </div>
                          <span className="truncate font-medium">{report.fileName}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App