import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FaUsers, FaClock, FaChartBar, FaCalendarAlt, 
  FaUserPlus, FaBook, FaLanguage, FaBuilding, 
  FaChair, FaBan, FaEdit, FaClipboardCheck, FaUserShield, FaSignOutAlt
} from 'react-icons/fa';
import { supabase } from '../supabase';
import { hasPermission } from '../utils/permissions';
import './Navbar.css'; // Stil dosyasını dahil ettik

const Navbar = ({ userEmail }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/students', label: 'Öğrenciler', icon: <FaUsers />, module: 'admin' },
    { path: '/discipline', label: 'Geç Kalan Kayıt', icon: <FaClock />, module: 'attendance' },
    { path: '/discipline-reports', label: 'İstatistik', icon: <FaChartBar />, module: 'attendance' },
    { path: '/exams', label: 'Sınavlar', icon: <FaBook />, module: 'exam' },
    { path: '/rooms', label: 'Salonlar', icon: <FaBuilding />, module: 'seating' },
    { path: '/seating', label: 'Karma Dağıtım', icon: <FaChair />, module: 'seating' },
    { path: '/conflict-groups', label: 'Çakışma', icon: <FaBan />, module: 'seating' },
    { path: '/manual-edit', label: 'Manuel Düzenle', icon: <FaEdit />, module: 'seating' },
    { path: '/attendance-module', label: 'Sınav Yoklama', icon: <FaClipboardCheck />, module: 'exam' },
    { path: '/attendance-lists', label: 'Yoklama Listesi', icon: <FaClipboardCheck />, module: 'exam' },
    { path: '/invigilators', label: 'Gözetmenler', icon: <FaUserShield />, module: 'exam' },
    { path: '/student-matrix', label: 'Matris', icon: <FaClipboardCheck />, module: 'exam' }, 
    { path: '/daily-attendance-list', label: 'Günlük Yoklama', icon: <FaClipboardCheck />, module: 'exam' },
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
