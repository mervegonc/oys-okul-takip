import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Students from './pages/Students'; 
import DisciplineTracking from './pages/DisciplineTracking';
import DisciplineReports from './pages/DisciplineReports';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Yükleniyor...</div>;

  return (
    <BrowserRouter>
   <Routes>
  <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
  <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
  <Route path="/students" element={user ? <Students /> : <Navigate to="/login" />} />
  <Route path="/discipline" element={user ? <DisciplineTracking /> : <Navigate to="/login" />} />
  <Route path="/discipline-reports" element={user ? <DisciplineReports /> : <Navigate to="/login" />} />
</Routes>
    </BrowserRouter>
  );
}

export default App;