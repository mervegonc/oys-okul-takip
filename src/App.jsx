import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Navbar from './components/Navbar';
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
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/students" />} />
        <Route
          path="/*"
          element={
            user ? (
              <>
                <Navbar />
                <Routes>
                  <Route path="/students" element={<Students />} />
                  <Route path="/discipline" element={<DisciplineTracking />} />
                  <Route path="/discipline-reports" element={<DisciplineReports />} />
                  {/* Diğer route'lar ileride eklenecek */}
                  <Route path="/" element={<Navigate to="/students" />} />
                </Routes>
              </>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;