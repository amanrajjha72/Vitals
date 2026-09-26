import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// --- MAIN APP COMPONENT (ROUTING) ---
export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
        <Routes>
          <Route path="/" element={<LoginScreen />} />
          <Route path="/setup" element={<SetupCredentials />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

// --- LOGIN SCREEN ---
function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('userId');
    if (userId) {
      localStorage.setItem('userId', userId);
      navigate('/setup'); 
    }
  }, [location, navigate]);

  const handleCustomLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch("https://vitals-bget.onrender.com/auth/login/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("userId", data.userId);
        navigate('/dashboard');
      } else {
        const errData = await response.json();
        setError(errData.detail || "Invalid credentials");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "https://vitals-bget.onrender.com/auth/login";
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
      <div className="flex justify-center mb-6">
        <div className="bg-blue-600 text-white p-3 rounded-full">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Welcome to Vitals</h1>
      
      {error && <p className="text-red-500 text-sm text-center mb-4 bg-red-50 p-2 rounded">{error}</p>}
      
      <form onSubmit={handleCustomLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">User ID</label>
          <input 
            type="text" 
            required 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your User ID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input 
            type="password" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="••••••••"
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 font-medium transition-colors shadow-sm">
          Log In
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <hr className="w-full border-gray-200" />
        <span className="px-3 text-xs text-gray-400 uppercase tracking-wider">OR</span>
        <hr className="w-full border-gray-200" />
      </div>

      <button 
        onClick={handleGoogleLogin} 
        className="mt-6 w-full flex items-center justify-center gap-3 border border-gray-300 bg-white text-gray-700 p-2 rounded-md hover:bg-gray-50 font-medium transition-colors shadow-sm"
      >
        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
        Continue with Google
      </button>
    </div>
  );
}

// --- CREDENTIAL SETUP SCREEN ---
function SetupCredentials() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSetup = async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
      navigate('/');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("https://vitals-bget.onrender.com/auth/setup-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_db_id: userId,
          username: username,
          password: password
        })
      });

      if (response.ok) {
        navigate('/dashboard');
      } else {
        const errData = await response.json();
        setError(errData.detail || "Failed to setup credentials.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
      <h2 className="text-xl font-bold text-gray-800 text-center">Set up a Custom Login</h2>
      <p className="text-sm text-gray-500 text-center mt-2 mb-6">
        Create a User ID and password so you can log in without Google next time.
      </p>

      {error && <p className="text-red-500 text-sm text-center mb-4 bg-red-50 p-2 rounded">{error}</p>}

      <form onSubmit={handleSetup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Choose a User ID</label>
          <input 
            type="text" 
            required 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Choose a Password</label>
          <input 
            type="password" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-green-600 text-white p-2 rounded-md hover:bg-green-700 font-medium transition-colors shadow-sm disabled:bg-green-400"
        >
          {isLoading ? 'Saving...' : 'Save Credentials'}
        </button>
      </form>
      
      <button 
        onClick={() => navigate('/dashboard')} 
        className="w-full mt-4 bg-gray-50 border border-gray-200 text-gray-600 p-2 rounded-md hover:bg-gray-100 font-medium transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}

// --- PATIENT DASHBOARD COMPONENT ---
function Dashboard() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const [familyMembers, setFamilyMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }

    // Replace this with your actual GET request to fetch family members and their medicines
    // Example: fetch(`https://vitals-bget.onrender.com/user/${userId}/family`)
    const fetchDashboardData = async () => {
      try {
        // Placeholder simulated data structure based on your Prisma Schema
        setTimeout(() => {
          setFamilyMembers([
            {
              id: '1',
              name: 'Sarah (Mother)',
              medicines: [
                { id: 'm1', name: 'Lisinopril (Blood Pressure)', stockAvailable: 14, intervalHours: 24, nextDoseTime: new Date(Date.now() - 3600000).toISOString() }, // Overdue
                { id: 'm2', name: 'Metformin', stockAvailable: 30, intervalHours: 12, nextDoseTime: new Date(Date.now() + 14400000).toISOString() }
              ]
            }
          ]);
          setIsLoading(false);
        }, 800);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [userId, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    navigate('/');
  };

  // Callback passed to MedicineCard to trigger a UI refresh
  const refreshData = () => {
    // In a real app, re-fetch from the API here
    // fetchDashboardData();
    window.location.reload(); 
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading Vitals Dashboard...</div>;
  }

  return (
    <div className="w-full max-w-5xl p-4 md:p-6 min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 mt-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Vitals Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Manage family prescriptions and tracking</p>
        </div>
        <button 
          onClick={handleLogout} 
          className="px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium text-sm transition-colors"
        >
          Log Out
        </button>
      </div>
      
      {/* Family Members List */}
      <div className="space-y-8 flex-1">
        {familyMembers.map((member) => (
          <div key={member.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-blue-50/50 p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                {member.name}
              </h2>
              <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
                + Add Medicine
              </button>
            </div>
            
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {member.medicines.map((medicine) => (
                <MedicineCard 
                  key={medicine.id} 
                  medicine={medicine} 
                  onTakeDose={refreshData} 
                />
              ))}
              {member.medicines.length === 0 && (
                <p className="text-gray-400 text-sm italic col-span-full">No medicines actively tracked.</p>
              )}
            </div>
          </div>
        ))}

        {familyMembers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500 mb-4">You haven't added any family members yet.</p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Add Family Member
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- MEDICINE CARD COMPONENT ---
function MedicineCard({ medicine, onTakeDose }) {
  const [isTaking, setIsTaking] = useState(false);
  const isOutOfStock = medicine.stockAvailable <= 0;
  
  // Check if dose is strictly overdue (current time > nextDoseTime)
  const isOverdue = medicine.nextDoseTime && new Date(medicine.nextDoseTime) < new Date();

  const handleTakeDose = async () => {
    setIsTaking(true);
    try {
      const response = await fetch(`https://vitals-bget.onrender.com/medicine/${medicine.id}/take`, {
        method: 'PUT',
      });
      if (response.ok) {
        onTakeDose(); 
      } else {
        alert("Failed to log dose. Check stock.");
      }
    } catch (error) {
      console.error("Error logging dose:", error);
      alert("Network error while logging dose.");
    } finally {
      setIsTaking(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl border flex flex-col justify-between h-full ${isOverdue ? 'bg-red-50/30 border-red-200' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="mb-4">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg text-gray-800 leading-tight">{medicine.name}</h3>
          {isOverdue && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded shadow-sm flex-shrink-0 animate-pulse">
              OVERDUE
            </span>
          )}
        </div>
        
        <div className="mt-3 space-y-1">
          <div className="flex items-center text-sm">
            <span className="text-gray-500 w-24">Inventory:</span>
            <span className={`font-medium ${isOutOfStock ? 'text-red-500' : 'text-gray-700'}`}>
              {medicine.stockAvailable} pills remaining
            </span>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-gray-500 w-24">Interval:</span>
            <span className="font-medium text-gray-700">Every {medicine.intervalHours} hours</span>
          </div>
          <div className="flex items-center text-sm">
            <span className="text-gray-500 w-24">Next Dose:</span>
            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
              {medicine.nextDoseTime ? new Date(medicine.nextDoseTime).toLocaleString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              }) : 'Not scheduled'}
            </span>
          </div>
        </div>
      </div>

      <button 
        onClick={handleTakeDose}
        disabled={isOutOfStock || isTaking}
        className={`w-full py-2.5 rounded-lg font-medium text-white transition-all shadow-sm ${
          isOutOfStock 
            ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
            : isTaking
              ? 'bg-green-400 cursor-wait'
              : 'bg-green-500 hover:bg-green-600 hover:shadow active:scale-[0.98]'
        }`}
      >
        {isOutOfStock ? 'Empty Stock' : isTaking ? 'Logging...' : 'Log Dose Taken'}
      </button>
    </div>
  );
}