import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Students from './pages/Students';
import DisciplineTracking from './pages/DisciplineTracking';
import DisciplineReports from './pages/DisciplineReports';
import { hasPermission } from './utils/permissions';

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

  const userEmail = user?.email || '';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/students" />} />
        <Route
          path="/*"
          element={
            user ? (
              <>
                <Navbar userEmail={userEmail} />
                <Routes>
                  <Route path="/students" element={
                    hasPermission(userEmail, 'admin') ? <Students /> : <Navigate to="/discipline" />
                  } />
                  <Route path="/discipline" element={
                    hasPermission(userEmail, 'attendance') ? <DisciplineTracking /> : <Navigate to="/" />
                  } />
                  <Route path="/discipline-reports" element={
                    (hasPermission(userEmail, 'attendance') || hasPermission(userEmail, 'exam')) ? <DisciplineReports /> : <Navigate to="/" />
                  } />
                  {/* Diğer rotalar ileride eklenecek */}
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