import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Link } from 'react-router-dom'; 

const Dashboard = ({ user }) => {
  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        <h1>🏫 OYS - Okul Sınav Yönetimi</h1>
        <div>
          <span style={{ marginRight: '1rem' }}>{user?.email}</span>
          <button onClick={handleLogout} style={{ padding: '0.4rem 0.8rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>
            Çıkış
          </button>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>📋 Modüller (İskelet)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1rem', marginTop: '1rem' }}>
          <Link to="/students" style={{ textDecoration: 'none' }}>
  <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}>
    👨‍🎓 Öğrenci Yönetimi
  </div>
</Link>
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>📝 Sınav Tanımla</div>
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>🪑 Salon & Karma</div>
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>✅ Yoklama Listeleri</div>
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>⏰ Geç Kalma Takibi</div>
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>📊 Raporlar</div>
        </div>
        <p style={{ marginTop: '2rem', color: '#666', fontStyle: 'italic' }}>
          ✅ Sistem altyapısı çalışıyor. Buradan itibaren tüm modülleri geliştirebilirsiniz.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;