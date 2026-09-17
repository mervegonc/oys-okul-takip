import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaCalendarPlus, FaEye, FaEyeSlash, FaSave, FaTrash, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const DailyAttendanceList = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Sabit Mevcut Sayıları (Görselindeki gibi fix)
  const totals = { 9: 165, 10: 145, 11: 165, 12: 213 };
  const totalMevcut = totals[9] + totals[10] + totals[11] + totals[12]; // 688

  // Yeni Gün Ekleme Form State'leri
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [absent9, setAbsent9] = useState('');
  const [absent10, setAbsent10] = useState('');
  const [absent11, setAbsent11] = useState('');
  const [absent12, setAbsent12] = useState('');

  // Sadece aktif (gizlenmemiş) tarihleri göster / tümünü göster filtre switch'i
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('daily_attendance')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (err) {
      console.error('Yoklama verileri alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDay = async (e) => {
    e.preventDefault();
    const a9 = parseInt(absent9) || 0;
    const a10 = parseInt(absent10) || 0;
    const a11 = parseInt(absent11) || 0;
    const a12 = parseInt(absent12) || 0;

    try {
      const { error } = await supabase.from('daily_attendance').insert([
        {
          date: selectedDate,
          grade_9_absent: a9,
          grade_10_absent: a10,
          grade_11_absent: a11,
          grade_12_absent: a12,
          is_active: true
        }
      ]);

      if (error) throw error;

      // Formu sıfırla ve yeniden yükle
      setAbsent9('');
      setAbsent10('');
      setAbsent11('');
      setAbsent12('');
      fetchAttendance();
      alert('Günlük katılım başarıyla eklendi!');
    } catch (err) {
      console.error('Kayıt eklenirken hata:', err);
      alert('Kayıt eklenemedi. Lütfen tekrar deneyin.');
    }
  };

  // Eski tarihi gizle / göster toggle
  const toggleActiveStatus = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('daily_attendance')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      setAttendanceRecords(attendanceRecords.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
    } catch (err) {
      console.error('Durum güncellenemedi:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu günkü katılım kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('daily_attendance').delete().eq('id', id);
      if (error) throw error;
      setAttendanceRecords(attendanceRecords.filter(r => r.id !== id));
    } catch (err) {
      console.error('Silme hatası:', err);
    }
  };

  const filteredRecords = showOnlyActive 
    ? attendanceRecords.filter(r => r.is_active !== false) 
    : attendanceRecords;

  return (
    <div style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Başlık */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Günlük Yoklama ve Katılım Takibi</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '0.3rem' }}>Yıldızlar Kampüsü sınıf bazlı gelmeyen öğrenci girişleri ve otomatik gelen hesaplaması.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={() => setShowOnlyActive(!showOnlyActive)}
            style={{ 
              padding: '0.5rem 1rem', 
              background: showOnlyActive ? '#e0e7ff' : '#f1f5f9', 
              color: showOnlyActive ? '#4338ca' : '#475569', 
              border: 'none', 
              borderRadius: '10px', 
              cursor: 'pointer', 
              fontWeight: '600',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {showOnlyActive ? <FaEye /> : <FaEyeSlash />} {showOnlyActive ? 'Gizlenenleri Göster' : 'Sadece Aktifleri Göster'}
          </button>
        </div>
      </div>

      {/* Yeni Gün Ekleme Form Kartı */}
      <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaCalendarPlus style={{ color: '#6366f1' }} /> Yeni Günlük Gelmeyen Verisi Gir
        </h3>
        <form onSubmit={handleSaveDay} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>Tarih</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              required
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>9. Sınıf Gelmeyen (Mevcut: 165)</label>
            <input 
              type="number" 
              min="0" 
              max="165"
              placeholder="0" 
              value={absent9} 
              onChange={(e) => setAbsent9(e.target.value)} 
              required
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>10. Sınıf Gelmeyen (Mevcut: 145)</label>
            <input 
              type="number" 
              min="0" 
              max="145"
              placeholder="0" 
              value={absent10} 
              onChange={(e) => setAbsent10(e.target.value)} 
              required
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>11. Sınıf Gelmeyen (Mevcut: 165)</label>
            <input 
              type="number" 
              min="0" 
              max="165"
              placeholder="0" 
              value={absent11} 
              onChange={(e) => setAbsent11(e.target.value)} 
              required
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>12. Sınıf Gelmeyen (Mevcut: 213)</label>
            <input 
              type="number" 
              min="0" 
              max="213"
              placeholder="0" 
              value={absent12} 
              onChange={(e) => setAbsent12(e.target.value)} 
              required
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} 
            />
          </div>

          <div>
            <button 
              type="submit" 
              style={{ width: '100%', padding: '0.65rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)' }}
            >
              <FaSave /> Kaydet
            </button>
          </div>

        </form>
      </div>

      {/* Excel Tarzı Tablo Görünümü */}
      <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1.5rem', textAlign: 'center' }}>
          YILDIZLAR KAMPÜSÜ ÖĞRENCİ KATILIM SAYILARI
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #1e293b', fontSize: '0.95rem' }}>
          <thead>
            <tr style={{ background: '#fef08a', color: '#1e293b', textAlign: 'center' }}>
              <th style={{ border: '1px solid #cbd5e1', padding: '0.75rem', width: '220px' }}>TARİH</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '0.75rem' }}>SINIF</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '0.75rem', background: '#fde047' }}>9</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '0.75rem', background: '#fde047' }}>10</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '0.75rem', background: '#fde047' }}>11</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '0.75rem', background: '#fde047' }}>12</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '0.75rem', background: '#fcc419' }}>TOPLAM</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '0.75rem', width: '100px' }}>İŞLEM</th>
            </tr>
            <tr style={{ background: '#fef9c3', textAlign: 'center', fontWeight: 'bold' }}>
              <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem' }}>MEVCUT (FİX)</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem' }}>-</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem' }}>{totals[9]}</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem' }}>{totals[10]}</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem' }}>{totals[11]}</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem' }}>{totals[12]}</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem' }}>{totalMevcut}</td>
              <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem' }}>-</td>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((item) => {
              const dateFormatted = format(new Date(item.date), 'd MMMM yyyy EEEE', { locale: tr });
              
              const a9 = item.grade_9_absent || 0;
              const a10 = item.grade_10_absent || 0;
              const a11 = item.grade_11_absent || 0;
              const a12 = item.grade_12_absent || 0;
              const totalAbsent = a9 + a10 + a11 + a12;

              const p9 = totals[9] - a9;
              const p10 = totals[10] - a10;
              const p11 = totals[11] - a11;
              const p12 = totals[12] - a12;
              const totalPresent = p9 + p10 + p11 + p12;

              const isActive = item.is_active !== false;

              return (
                <React.Fragment key={item.id}>
                  {/* GELMEYEN SATIRI */}
                  <tr style={{ opacity: isActive ? 1 : 0.4, background: isActive ? '#fff' : '#f1f5f9' }}>
                    <td rowSpan="2" style={{ border: '1px solid #cbd5e1', padding: '0.75rem', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle' }}>
                      {dateFormatted}
                      {!isActive && <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>(Gizlendi / Kapalı)</div>}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', background: '#f87171', color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
                      GELMEYEN
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#fef2f2', fontWeight: '600' }}>{a9}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#fef2f2', fontWeight: '600' }}>{a10}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#fef2f2', fontWeight: '600' }}>{a11}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#fef2f2', fontWeight: '600' }}>{a12}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#fee2e2', fontWeight: 'bold' }}>{totalAbsent}</td>
                    
                    <td rowSpan="2" style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
                        <button 
                          onClick={() => toggleActiveStatus(item.id, isActive)} 
                          title={isActive ? "Eski Tarihi Gizle / Kapat" : "Aktif Et"}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isActive ? '#f59e0b' : '#10b981', fontSize: '1.1rem' }}
                        >
                          {isActive ? <FaEyeSlash /> : <FaEye />}
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          title="Sil"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* GELEN SATIRI (Otomatik Hesaplanan) */}
                  <tr style={{ opacity: isActive ? 1 : 0.4, background: isActive ? '#fff' : '#f1f5f9' }}>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', background: '#4ade80', color: '#065f46', fontWeight: 'bold', textAlign: 'center' }}>
                      GELEN
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#f0fdf4' }}>{p9}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#f0fdf4' }}>{p10}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#f0fdf4' }}>{p11}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#f0fdf4' }}>{p12}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '0.5rem', textAlign: 'center', background: '#dcfce7', fontWeight: 'bold' }}>{totalPresent}</td>
                  </tr>
                </React.Fragment>
              );
            })}
            
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  Kayıtlı günlük yoklama verisi bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default DailyAttendanceList;
