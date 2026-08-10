import { useState, useEffect } from "react"
import CertificateManager from "./components/CertificateManager"

const API_URL = 'https://fastcareacademy.com/api.php';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // 1. Check session when app loads
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}?action=check_auth`, { credentials: 'include' });
        const data = await res.json();
        setIsAuthenticated(data.authenticated);
      } catch (err) {
        console.error('Failed to check auth status');
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, []);

  // 2. Handle Login Submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      
      if (data.success) {
        setIsAuthenticated(true);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  // 3. Handle Logout
  const handleLogout = async () => {
    await fetch(`${API_URL}?action=logout`, { method: 'POST', credentials: 'include' });
    setIsAuthenticated(false);
  };

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading...</div>;
  }

  // If NOT logged in, show this UI
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 border rounded-lg shadow-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">QR Code Generator <br />Fast Care Academy</h1>
            <p className="text-sm text-gray-500">Please enter the team password</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-md hover:bg-blue-700 transition"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }
  return (
      <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto p-4 flex justify-end">
        <button 
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-red-600 font-medium"
        >
          Logout
        </button>
      </div>
      <CertificateManager />
    </div>
  )
}

export default App
