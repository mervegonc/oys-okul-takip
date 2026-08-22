import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FaUsers, FaClock, FaChartBar, FaCalendarAlt, 
  FaUserPlus, FaBook, FaLanguage, FaBuilding, 
  FaChair, FaBan, FaEdit, FaClipboardCheck 
} from 'react-icons/fa';
import { supabase } from '../supabase';
import { hasPermission } from '../utils/permissions';

const Navbar = ({ userEmail }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/students', label: 'Öğrenciler', icon: <FaUsers />, module: 'admin' },
    { path: '/discipline', label: 'Geç Kalan Kayıt', icon: <FaClock />, module: 'attendance' },
    { path: '/discipline-reports', label: 'Geç Kalan İstatistik', icon: <FaChartBar />, module: 'attendance' },
    { path: '/exams', label: 'Sınavlar', icon: <FaBook />, module: 'exam' },
    { path: '/rooms', label: 'Salonlar', icon: <FaBuilding />, module: 'seating' },
    { path: '/seating', label: 'Karma Dağıtım', icon: <FaChair />, module: 'seating' },
    { path: '/conflict-groups', label: 'Çakışma Listesi', icon: <FaBan />, module: 'seating' },
    { path: '/manual-edit', label: 'Manuel Düzenle', icon: <FaEdit />, module: 'seating' },
    { path: '/exam-attendance', label: 'Sınav Yoklama', icon: <FaClipboardCheck />, module: 'exam' },
    { path: '/calendar', label: 'Takvim', icon: <FaCalendarAlt />, module: 'calendar' },
    { path: '/candidates', label: 'Adaylar', icon: <FaUserPlus />, module: 'candidates' },
    { path: '/yds', label: 'YDS', icon: <FaLanguage />, module: 'exam' },
  ];

  const visibleMenu = menuItems.filter(item =>
    hasPermission(userEmail, item.module)
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav style={{
      display: 'flex',
      justify: 'space-between',
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
          {visibleMenu.map((item) => (
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
        <span style={{ fontSize: '0.9rem', color: '#555' }}>{userEmail}</span>
        <button onClick={handleLogout} style={{ padding: '0.3rem 0.8rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Çıkış
        </button>
      </div>
    </nav>
  );
};

export default Navbar;