import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaCalendarPlus, FaEye, FaEyeSlash, FaSave, FaTrash } from 'react-icons/fa';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const DailyAttendanceList = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [totals, setTotals] = useState({ 9: 0, 10: 0, 11: 0, 12: 0 });
  const totalMevcut = totals[9] + totals[10] + totals[11] + totals[12];

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [absent9, setAbsent9] = useState('');
  const [absent10, setAbsent10] = useState('');
  const [absent11, setAbsent11] = useState('');
  const [absent12, setAbsent12] = useState('');

  const [showOnlyActive, setShowOnlyActive] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('grade');

      if (studentsError) throw studentsError;

      const counts = { 9: 0, 10: 0, 11: 0, 12: 0 };
      if (studentsData) {
        studentsData.forEach(student => {
          const g = parseInt(student.grade);
          if (counts[g] !== undefined) {
            counts[g]++;
          }
        });
      }
      setTotals(counts);

      const { data: attData, error: attError } = await supabase
        .from('daily_attendance')
        .select('*')
        .order('date', { ascending: false });

      if (attError) throw attError;
      setAttendanceRecords(attData || []);

    } catch (err) {
      console.error('Veriler alınamadı:', err);
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

    if (a9 > totals[9] || a10 > totals[10] || a11 > totals[11] || a12 > totals[12]) {
      alert('Hata: Girilen gelmeyen öğrenci sayısı o sınıfın toplam mevcut sayısından büyük olamaz!');
      return;
    }

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

      setAbsent9('');
      setAbsent10('');
      setAbsent11('');
      setAbsent12('');
      fetchData();
    } catch (err) {
      console.error('Kayıt eklenirken hata:', err);
      alert('Bu tarih için zaten kayıt var veya bir hata oluştu.');
    }
  };

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
    if (!window.confirm('Bu günü silmek istediğinize emin misiniz?')) return;
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
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* KESİN ÇÖZÜM: Yazdırma / PDF anında Navbar, Formlar, İşlem Sütunu ve Gizlenen Satırlar Tamamen Yok Olur */}
      <style>{`
        @media print {
          /* Navbar'ı gizle (nav veya header etiketleri) */
          nav, header, aside {
            display: none !important;
          }
          /* .no-print sınıfına sahip her şeyi gizle */
          .no-print {
            display: none !important;
          }
          /* Gizlenmiş (pasif) satırları yazdırmada tamamen yok et */
          .inactive-row {
            display: none !important;
          }
          body {
            background: white !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Başlık ve Kontroller */}
      <div className="no-print" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Günlük Yoklama ve Katılım Takibi</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '0.3rem' }}>Öğrenci listesinden dinamik çekilen mevcutlar üzerinden günlük katılım yönetimi.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={() => setShowOnlyActive(!showOnlyActive)}
            style={{ 
              padding: '0.6rem 1.1rem', 
              background: showOnlyActive ? '#e0e7ff' : '#ffffff', 
              color: showOnlyActive ? '#4338ca' : '#475569', 
              border: '1px solid #cbd5e1', 
              borderRadius: '12px', 
              cursor: 'pointer', 
              fontWeight: '600',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            {showOnlyActive ? <FaEye /> : <FaEyeSlash />} {showOnlyActive ? 'Gizlenenleri Göster' : 'Aktifleri Göster'}
          </button>
        </div>
      </div>

      {/* Yeni Gün Ekleme Kartı */}
      <div className="no-print" style={{ background: '#ffffff', padding: '1.75rem', borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', marginBottom: '2.5rem', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaCalendarPlus style={{ color: '#6366f1', fontSize: '1.3rem' }} /> Yeni Günlük Gelmeyen Verisi Ekle
        </h3>
        <form onSubmit={handleSaveDay} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'flex-end' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Tarih Seçimi</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              required
              style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>9. Sınıf Gelmeyen <span style={{ color: '#6366f1' }}>(Mevcut: {totals[9]})</span></label>
            <input 
              type="number" min="0" max={totals[9]} placeholder="0" value={absent9} onChange={(e) => setAbsent9(e.target.value)} required
              style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>10. Sınıf Gelmeyen <span style={{ color: '#6366f1' }}>(Mevcut: {totals[10]})</span></label>
            <input 
              type="number" min="0" max={totals[10]} placeholder="0" value={absent10} onChange={(e) => setAbsent10(e.target.value)} required
              style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>11. Sınıf Gelmeyen <span style={{ color: '#6366f1' }}>(Mevcut: {totals[11]})</span></label>
            <input 
              type="number" min="0" max={totals[11]} placeholder="0" value={absent11} onChange={(e) => setAbsent11(e.target.value)} required
              style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#f8fafc' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>12. Sınıf Gelmeyen <span style={{ color: '#6366f1' }}>(Mevcut: {totals[12]})</span></label>
            <input 
              type="number" min="0" max={totals[12]} placeholder="0" value={absent12} onChange={(e) => setAbsent12(e.target.value)} required
              style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#f8fafc' }} 
            />
          </div>

          <div>
            <button 
              type="submit" 
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
            >
              <FaSave /> Kaydet
            </button>
          </div>

        </form>
      </div>

      {/* Tablo Alanı */}
      <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '20px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflowX: 'auto', border: '1px solid #e2e8f0' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', letterSpacing: '0.5px', margin: 0 }}>
            YILDIZLAR KAMPÜSÜ ÖĞRENCİ KATILIM SAYILARI
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.3rem' }}>Günlük Devam / Devamsızlık Özeti</p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', fontSize: '0.95rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#334155', textAlign: 'center', fontWeight: '700' }}>
              <th style={{ borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '1rem', width: '220px' }}>TARİH</th>
              <th style={{ borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '1rem' }}>DURUM</th>
              <th style={{ borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '1rem', background: '#eff6ff', color: '#1e40af' }}>9.Sınıf</th>
              <th style={{ borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '1rem', background: '#eff6ff', color: '#1e40af' }}>10.Sınıf</th>
              <th style={{ borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '1rem', background: '#eff6ff', color: '#1e40af' }}>11.Sınıf</th>
              <th style={{ borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '1rem', background: '#eff6ff', color: '#1e40af' }}>12.Sınıf</th>
              <th style={{ borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '1rem', background: '#e0e7ff', color: '#3730a3' }}>TOPLAM</th>
              <th className="no-print" style={{ borderBottom: '2px solid #e2e8f0', padding: '1rem', width: '90px' }}>İŞLEM</th>
            </tr>
            {/* MEVCUT SATIRI */}
            <tr style={{ background: '#f1f5f9', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
              <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.75rem', background: '#e2e8f0' }}>MEVCUT ÖĞRENCİ</td>
              <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.75rem' }}>-</td>
              <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.75rem' }}>{totals[9]}</td>
              <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.75rem' }}>{totals[10]}</td>
              <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.75rem' }}>{totals[11]}</td>
              <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.75rem' }}>{totals[12]}</td>
              <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.75rem', background: '#c7d2fe' }}>{totalMevcut}</td>
              <td className="no-print" style={{ borderBottom: '1px solid #e2e8f0', padding: '0.75rem' }}>-</td>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((item, idx) => {
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
              const isEven = idx % 2 === 0;
              const rowBg = isEven ? '#ffffff' : '#fafafa';

              return (
                <React.Fragment key={item.id}>
                  {/* GELMEYEN SATIRI - Eğer pasifse 'inactive-row' sınıfı eklenir ve yazdırırken gizlenir */}
                  <tr className={!isActive ? 'inactive-row' : ''} style={{ opacity: isActive ? 1 : 0.35, background: rowBg }}>
                    <td rowSpan="2" style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.85rem', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', background: '#f8fafc' }}>
                      {dateFormatted}
                      {!isActive && <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold', marginTop: '2px' }}>(Gizlendi)</div>}
                    </td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', background: '#fee2e2', color: '#991b1b', fontWeight: '700', textAlign: 'center', fontSize: '0.85rem' }}>
                      GELMEYEN
                    </td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', color: '#991b1b', fontWeight: '600' }}>{a9}</td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', color: '#991b1b', fontWeight: '600' }}>{a10}</td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', color: '#991b1b', fontWeight: '600' }}>{a11}</td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', color: '#991b1b', fontWeight: '600' }}>{a12}</td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', background: '#fecaca', color: '#7f1d1d', fontWeight: '800' }}>{totalAbsent}</td>
                    
                    <td rowSpan="2" className="no-print" style={{ borderBottom: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button 
                          onClick={() => toggleActiveStatus(item.id, isActive)} 
                          title={isActive ? "Gizle" : "Aktif Et"}
                          style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isActive ? '#d97706' : '#10b981' }}
                        >
                          {isActive ? <FaEyeSlash /> : <FaEye />}
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          title="Sil"
                          style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* GELEN SATIRI */}
                  <tr className={!isActive ? 'inactive-row' : ''} style={{ opacity: isActive ? 1 : 0.35, background: rowBg }}>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', background: '#dcfce7', color: '#166534', fontWeight: '700', textAlign: 'center', fontSize: '0.85rem' }}>
                      GELEN
                    </td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', color: '#166534' }}>{p9}</td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', color: '#166534' }}>{p10}</td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', color: '#166534' }}>{p11}</td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', color: '#166534' }}>{p12}</td>
                    <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', padding: '0.6rem', textAlign: 'center', background: '#bbf7d0', color: '#14532d', fontWeight: '800' }}>{totalPresent}</td>
                  </tr>
                </React.Fragment>
              );
            })}
            
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
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
