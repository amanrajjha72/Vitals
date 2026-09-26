import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// --- MAIN APP COMPONENT (ROUTING) ---
export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
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

  // Check if returning from Google OAuth
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('userId');
    if (userId) {
      localStorage.setItem('userId', userId);
      // We don't know if they have a username set yet. We route them to setup, 
      // but in a real app, the backend should tell us if setup is needed.
      // For now, we redirect to setup, which they can skip if they already have one.
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
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Welcome to Vitals</h1>
      
      {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
      
      <form onSubmit={handleCustomLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">User ID</label>
          <input 
            type="text" 
            required 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 font-medium transition-colors">
          Log In
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <hr className="w-full border-gray-300" />
        <span className="px-2 text-sm text-gray-500">OR</span>
        <hr className="w-full border-gray-300" />
      </div>

      <button 
        onClick={handleGoogleLogin} 
        className="mt-6 w-full flex items-center justify-center gap-2 border border-gray-300 bg-white text-gray-700 p-2 rounded-md hover:bg-gray-50 font-medium transition-colors"
      >
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
  const navigate = useNavigate();

  const handleSetup = async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
      navigate('/');
      return;
    }

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
        alert("Setup complete! You can now use these credentials to log in.");
        navigate('/dashboard');
      } else {
        const errData = await response.json();
        setError(errData.detail || "Failed to setup credentials.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
      <h2 className="text-xl font-bold text-gray-800 text-center">Set up a Custom Login</h2>
      <p className="text-sm text-gray-500 text-center mt-2 mb-6">
        Create a User ID and password so you can log in without Google next time.
      </p>

      {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

      <form onSubmit={handleSetup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Choose a User ID</label>
          <input 
            type="text" 
            required 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Choose a Password</label>
          <input 
            type="password" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button type="submit" className="w-full bg-green-600 text-white p-2 rounded-md hover:bg-green-700 font-medium transition-colors">
          Save Credentials
        </button>
      </form>
      
      <button 
        onClick={handleSkip} 
        className="w-full mt-4 bg-gray-100 text-gray-600 p-2 rounded-md hover:bg-gray-200 font-medium transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}

// --- PATIENT DASHBOARD (Placeholder) ---
function Dashboard() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');

  if (!userId) {
    navigate('/');
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('userId');
    navigate('/');
  };

  return (
    <div className="w-full max-w-4xl p-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Dashboard</h1>
        <button onClick={handleLogout} className="text-red-600 hover:text-red-800 font-medium text-sm">
          Log Out
        </button>
      </div>
      
      {/* Existing dashboard component logic (Family members, MedicineCards) goes here */}
      <div className="bg-white p-8 rounded-xl shadow-sm text-center text-gray-500">
        Dashboard content loaded for user: {userId}
      </div>
    </div>
  );
}