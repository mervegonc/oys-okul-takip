import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaUsers, FaClock, FaChartBar, FaSignOutAlt } from 'react-icons/fa';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Navbar = () => {
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.8rem 2rem',
      background: '#ffffff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      borderBottom: '1px solid #eee',
      flexWrap: 'wrap',
      gap: '0.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Link to="/" style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#2c3e50', textDecoration: 'none' }}>
          OYS
        </Link>
        <Link to="/students" style={{ 
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.8rem',
          borderRadius: '6px',
          background: isActive('/students') ? '#e9ecef' : 'transparent',
          color: isActive('/students') ? '#007bff' : '#495057',
          textDecoration: 'none',
          fontWeight: isActive('/students') ? '600' : '400'
        }}>
          <FaUsers /> Öğrenciler
        </Link>
        <Link to="/discipline" style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.8rem',
          borderRadius: '6px',
          background: isActive('/discipline') ? '#e9ecef' : 'transparent',
          color: isActive('/discipline') ? '#007bff' : '#495057',
          textDecoration: 'none',
          fontWeight: isActive('/discipline') ? '600' : '400'
        }}>
          <FaClock /> Geç Kalan Kayıt
        </Link>
        <Link to="/discipline-reports" style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.8rem',
          borderRadius: '6px',
          background: isActive('/discipline-reports') ? '#e9ecef' : 'transparent',
          color: isActive('/discipline-reports') ? '#007bff' : '#495057',
          textDecoration: 'none',
          fontWeight: isActive('/discipline-reports') ? '600' : '400'
        }}>
          <FaChartBar /> Geç Kalan İstatistik
        </Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.9rem', color: '#6c757d' }}>{auth.currentUser?.email}</span>
        <button onClick={handleLogout} style={{
          background: 'transparent',
          border: 'none',
          color: '#dc3545',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.3rem 0.6rem',
          borderRadius: '4px',
          transition: 'background 0.2s'
        }} onMouseOver={(e) => e.currentTarget.style.background = '#f8d7da'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
          <FaSignOutAlt /> Çıkış
        </button>
      </div>
    </nav>
  );
};

export default Navbar;