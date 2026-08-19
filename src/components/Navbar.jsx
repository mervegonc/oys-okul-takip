import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaUsers, FaClock, FaChartBar, FaCalendarAlt, FaUserPlus, FaBook, FaLanguage } from 'react-icons/fa';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Navbar = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/students', label: 'Öğrenciler', icon: <FaUsers /> },
    { path: '/discipline', label: 'Geç Kalan Kayıt', icon: <FaClock /> },
    { path: '/discipline-reports', label: 'Geç Kalan İstatistik', icon: <FaChartBar /> },
    { path: '/exams', label: 'Sınavlar', icon: <FaBook /> }, // ileride eklenecek
    { path: '/calendar', label: 'Takvim', icon: <FaCalendarAlt /> }, // ileride
    { path: '/candidates', label: 'Adaylar', icon: <FaUserPlus /> }, // ileride
    { path: '/yds', label: 'YDS', icon: <FaLanguage /> }, // ileride
  ];

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.5rem 2rem',
      background: '#ffffff',
      borderBottom: '1px solid #e0e0e0',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#2c3e50', textDecoration: 'none' }}>
          OYS
        </Link>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                textDecoration: 'none',
                color: location.pathname === item.path ? '#007bff' : '#555',
                background: location.pathname === item.path ? '#e7f3ff' : 'transparent',
                fontWeight: location.pathname === item.path ? '600' : '400',
                transition: 'all 0.2s',
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.9rem', color: '#555' }}>merve.gnc.946@gmail.com</span>
        <button onClick={handleLogout} style={{ padding: '0.3rem 0.8rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Çıkış
        </button>
      </div>
    </nav>
  );
};

export default Navbar;