import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeEvent, setActiveEvent] = useState(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: '',
    end_date: '',
    category: 'exam',
    grade_level: '12',
    description: ''
  });

  const fetchEvents = async () => {
    setLoading(true);
    let query = supabase.from('school_calendar').select('*').order('event_date', { ascending: true });
    
    if (selectedGrade !== 'all') {
      query = query.in('grade_level', [selectedGrade, 'all']);
    }
    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Veri çekme hatası:', error.message);
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedGrade, selectedCategory]);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('school_calendar').insert([newEvent]);
    if (error) {
      alert('Kayıt eklenirken hata oluştu: ' + error.message);
    } else {
      setIsAddModalOpen(false);
      setNewEvent({ title: '', event_date: '', end_date: '', category: 'exam', grade_level: '12', description: '' });
      fetchEvents();
    }
  };

  const handleDeleteEvent = async (id) => {
    if (window.confirm('Bu etkinliği silmek istediğinize emin misiniz?')) {
      const { error } = await supabase.from('school_calendar').delete().eq('id', id);
      if (error) {
        alert('Silme hatası: ' + error.message);
      } else {
        setActiveEvent(null);
        fetchEvents();
      }
    }
  };

  const getCategoryBadgeStyle = (cat) => {
    switch (cat) {
      case 'exam': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'homework': return { backgroundColor: '#dbeafe', color: '#1e40af' };
      case 'group_change': return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'meeting': return { backgroundColor: '#f3e8ff', color: '#6b21a8' };
      default: return { backgroundColor: '#f1f5f9', color: '#475569' };
    }
  };

  const getCategoryText = (cat) => {
    switch (cat) {
      case 'exam': return 'Sınav';
      case 'homework': return 'Ödev';
      case 'group_change': return 'Grup Değişimi';
      case 'meeting': return 'Toplantı';
      default: return 'Diğer';
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Üst Başlık ve Ekle Butonu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50', margin: '0 0 5px 0' }}>Okul İşleyiş ve Sınav Takvimi</h1>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Sınavları, ödevleri ve grup değişim tarihlerini buradan takip edebilirsiniz.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
        >
          + Yeni Etkinlik / Sınav Ekle
        </button>
      </div>

      {/* Filtreleme Alanı */}
      <div style={{ display: 'flex', gap: '20px', background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '25px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>Sınıf Seviyesi</label>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white' }}
          >
            <option value="all">Tüm Okul / Sınıfsız</option>
            <option value="12">12. Sınıflar</option>
            <option value="11">11. Sınıflar</option>
            <option value="10">10. Sınıflar</option>
            <option value="9">9. Sınıflar</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>Kategori</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white' }}
          >
            <option value="all">Tüm Kategoriler</option>
            <option value="exam">Sınavlar</option>
            <option value="homework">Ödevler</option>
            <option value="group_change">Grup Değişimleri</option>
            <option value="meeting">Toplantılar</option>
          </select>
        </div>
      </div>

      {/* Etkinlik Listesi */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>Takvim yükleniyor...</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#666' }}>
          Bu kriterlere uygun etkinlik bulunamadı.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {events.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveEvent(item)}
              style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s' }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', ...getCategoryBadgeStyle(item.category) }}>
                    {getCategoryText(item.category)}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px' }}>
                    {item.grade_level === 'all' ? 'Tüm Okul' : `${item.grade_level}. Sınıf`}
                  </span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0' }}>{item.title}</h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 15px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.description || 'Açıklama girilmemiş.'}
                </p>
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
                <span style={{ fontWeight: '500', color: '#2563eb' }}>
                  📅 {new Date(item.event_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {item.end_date && (
                  <span style={{ color: '#94a3b8' }}>Bitiş: {new Date(item.end_date).toLocaleDateString('tr-TR')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detay Modalı */}
      {activeEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '10px', width: '90%', maxWidth: '500px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div>
                <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', ...getCategoryBadgeStyle(activeEvent.category) }}>
                  {getCategoryText(activeEvent.category)}
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: '10px 0 0 0' }}>{activeEvent.title}</h2>
              </div>
              <button onClick={() => setActiveEvent(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
            </div>

            <div style={{ fontSize: '14px', color: '#475569', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong>Tarih:</strong> {new Date(activeEvent.event_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                {activeEvent.end_date && <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>Bitiş Tarihi: {new Date(activeEvent.end_date).toLocaleDateString('tr-TR')}</div>}
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong>Sınıf Seviyesi:</strong> {activeEvent.grade_level === 'all' ? 'Tüm Okul' : `${activeEvent.grade_level}. Sınıf`}
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong>Açıklama:</strong>
                <p style={{ margin: '5px 0 0 0', whiteSpace: 'pre-wrap', color: '#334155' }}>{activeEvent.description || 'Detay bulunmuyor.'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
              <button
                onClick={() => handleDeleteEvent(activeEvent.id)}
                style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Etkinliği Sil
              </button>
              <button
                onClick={() => setActiveEvent(null)}
                style={{ background: '#334155', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yeni Etkinlik Ekleme Modalı */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '10px', width: '90%', maxWidth: '500px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Yeni Takvim Kaydı Ekle</h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
            </div>

            <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Etkinlik / Sınav / Ödev Adı</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Örn: 12. Sınıf Yaz Ödevi"
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Kategori</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white' }}
                  >
                    <option value="exam">Sınav</option>
                    <option value="homework">Ödev</option>
                    <option value="group_change">Grup Değişimi</option>
                    <option value="meeting">Toplantı</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Sınıf Seviyesi</label>
                  <select
                    value={newEvent.grade_level}
                    onChange={(e) => setNewEvent({ ...newEvent, grade_level: e.target.value })}
                    style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white' }}
                  >
                    <option value="all">Tüm Okul</option>
                    <option value="12">12. Sınıf</option>
                    <option value="11">11. Sınıf</option>
                    <option value="10">10. Sınıf</option>
                    <option value="9">9. Sınıf</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Tarih</label>
                  <input
                    type="date"
                    required
                    value={newEvent.event_date}
                    onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                    style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Bitiş Tarihi (Opsiyonel)</label>
                  <input
                    type="date"
                    value={newEvent.end_date}
                    onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                    style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Açıklama / Detay</label>
                <textarea
                  rows="3"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Detaylar..."
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '9px 15px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
