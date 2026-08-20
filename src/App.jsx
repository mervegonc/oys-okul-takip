import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase'; // <-- Firebase importları kaldırıldı
import Login from './components/Login';
import Navbar from './components/Navbar';
import Students from './pages/Students';
import DisciplineTracking from './pages/DisciplineTracking';
import DisciplineReports from './pages/DisciplineReports';
import { hasPermission } from './utils/permissions';
import Exams from './pages/Exams';
import Rooms from './pages/Rooms';
import SeatingDistribution from './pages/SeatingDistribution';
import ConflictGroups from './pages/ConflictGroups';
import ManualEdit from './pages/ManualEdit';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // 2. Sayfa yenilendiğinde mevcut oturumu al
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
                  <Route path="/exams" element={
                    hasPermission(userEmail, 'exam') ? <Exams /> : <Navigate to="/" />
                  } />
                  <Route path="/rooms" element={
                    hasPermission(userEmail, 'seating') ? <Rooms /> : <Navigate to="/" />
                  } />
                  <Route path="/seating" element={
                    hasPermission(userEmail, 'seating') ? <SeatingDistribution /> : <Navigate to="/" />
                  } />
                  <Route path="/conflict-groups" element={
                    hasPermission(userEmail, 'seating') ? <ConflictGroups /> : <Navigate to="/" />
                  } />
                  <Route path="/manual-edit" element={
                    hasPermission(userEmail, 'seating') ? <ManualEdit /> : <Navigate to="/" />
                  } />
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