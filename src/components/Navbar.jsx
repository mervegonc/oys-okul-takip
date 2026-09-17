import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { supabase } from '../supabase';
import { hasPermission } from '../utils/permissions';
import './Navbar.css'; // Stil dosyasını dahil ettik

const Navbar = ({ userEmail }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/students', label: 'Öğrenciler', module: 'admin' },
    { path: '/discipline', label: 'Geç Kalan Kayıt', module: 'attendance' },
    { path: '/discipline-reports', label: 'İstatistik', module: 'attendance' },
    { path: '/exams', label: 'Sınavlar', module: 'exam' },
    { path: '/rooms', label: 'Salonlar', module: 'seating' },
    { path: '/seating', label: 'Karma Dağıtım', module: 'seating' },
    { path: '/conflict-groups', label: 'Çakışma', module: 'seating' },
    { path: '/manual-edit', label: 'Manuel Düzenle', module: 'seating' },
    { path: '/attendance-module', label: 'Sınav Yoklama', module: 'exam' },
    { path: '/attendance-lists', label: 'Yoklama Listesi', module: 'exam' },
    { path: '/invigilators', label: 'Gözetmenler', module: 'exam' },
    { path: '/student-matrix', label: 'Matris',  module: 'exam' }, 
    { path: '/daily-attendance-list', label: 'Günlük Yoklama', module: 'exam' },
    { path: '/calendar', label: 'Takvim', module: 'calendar' },
    { path: '/candidates', label: 'Adaylar',module: 'candidates' },
    { path: '/yds', label: 'YDS',  module: 'exam' },
  ];

  const visibleMenu = menuItems.filter(item =>
    hasPermission(userEmail, item.module)
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="navbar-wrapper">
      <div className="navbar-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <Link to="/" className="navbar-brand">
            OYS <span>Yıldızlar Kampüsü</span>
          </Link>
        </div>

        <div className="navbar-user-area">
          <span className="navbar-email">{userEmail}</span>
          <button onClick={handleLogout} className="navbar-logout-btn">
            <FaSignOutAlt /> Çıkış
          </button>
        </div>
      </div>

      <div className="navbar-menu">
        {visibleMenu.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`navbar-item ${isActive ? 'active' : ''}`}
            >
              <span style={{ color: isActive ? '#EAAC8B' : '#6D597A' }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
