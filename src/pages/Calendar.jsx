import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';
import '../styles/Calendar.css';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedGrade, setSelectedGrade] = useState('12');
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
    const payload = {
      ...newEvent,
      end_date: newEvent.end_date ? newEvent.end_date : null
    };

    const { error } = await supabase.from('school_calendar').insert([payload]);
    if (error) {
      alert('Kayıt eklenirken hata oluştu: ' + error.message);
    } else {
      setIsAddModalOpen(false);
      setNewEvent({ title: '', event_date: '', end_date: '', category: 'exam', grade_level: '12', description: '' });
      fetchEvents();
    }
  };

  // Düzeltilmiş Türkçe tarih metnini Date formatına çeviren fonksiyon
  const parseTurkishDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    if (dateStr instanceof Date) return dateStr.toISOString().split('T')[0];
    
    const months = {
      'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04', 'mayıs': '05', 'haziran': '06',
      'temmuz': '07', 'ağustos': '08', 'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
    };

    let cleanStr = String(dateStr).toLowerCase().trim();
    let foundMonth = '01';
    let foundYear = '2026';
    let foundDay = '01';

    for (let [monthName, monthNum] of Object.entries(months)) {
      if (cleanStr.includes(monthName)) {
        foundMonth = monthNum;
        cleanStr = cleanStr.replace(monthName, '');
        break;
      }
    }

    const numbers = cleanStr.replace(/[^0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);
    
    if (numbers.length >= 2) {
      for (let num of numbers) {
        if (num.length === 4 || (num.length === 2 && parseInt(num) > 31)) {
          foundYear = num.length === 2 ? '20' + num : num;
        } else {
          foundDay = num.padStart(2, '0');
        }
      }
    } else if (numbers.length === 1) {
      foundDay = numbers[0].padStart(2, '0');
    }

    return `${foundYear}-${foundMonth}-${foundDay}`;
  };

  // Sınıf Seviyesini Ayrıştıran Fonksiyon
  const parseGradeLevel = (gradeStr) => {
    if (!gradeStr) return '12';
    const str = String(gradeStr).toLowerCase();
    if (str.includes('tüm') || str.includes('okul') || str.includes('tümü')) return 'all';
    
    const match = str.match(/\d+/);
    return match ? match[0] : '12';
  };

  // Kategori Türünü Ayrıştıran Fonksiyon
  const parseCategory = (catStr) => {
    if (!catStr) return 'exam';
    const str = String(catStr).toLowerCase();
    if (str.includes('ödev')) return 'homework';
    if (str.includes('grup') || str.includes('değişim')) return 'group_change';
    if (str.includes('toplantı')) return 'meeting';
    return 'exam';
  };

  // Excel Dosyası Yükleme İşleyicisi
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert('Excel dosyası boş veya okunamadı.');
          return;
        }

        const formattedEvents = data.map((row) => ({
          title: row['Sınav Adı'] || row['Etkinlik Adı'] || 'İsimsiz Etkinlik',
          category: parseCategory(row['Kategori']),
          grade_level: parseGradeLevel(row['Sınıf Seviyesi'] || row['Sınıf']),
          event_date: parseTurkishDate(row['Uygulama Tarihi'] || row['Tarih']),
          end_date: null,
          description: row['Açıklama'] ? String(row['Açıklama']) : ''
        }));

        const { error } = await supabase.from('school_calendar').insert(formattedEvents);

        if (error) {
          alert('Toplu yükleme hatası: ' + error.message);
        } else {
          alert(`${formattedEvents.length} adet etkinlik Excel'den başarıyla yüklendi!`);
          fetchEvents();
        }
      } catch (err) {
        console.error('Excel okuma hatası:', err);
        alert('Excel dosyası işlenirken bir hata oluştu.');
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
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

  const getCategoryBadgeClass = (cat) => {
    switch (cat) {
      case 'exam': return 'badge badge-exam';
      case 'homework': return 'badge badge-homework';
      case 'group_change': return 'badge badge-group_change';
      case 'meeting': return 'badge badge-meeting';
      default: return 'badge badge-default';
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
    <div className="calendar-container">
      <div className="calendar-header-section">
        <div>
          <h1 className="calendar-title">Okul İşleyiş ve Sınav Takvimi</h1>
          <p className="calendar-subtitle">Sınavları, ödevleri ve grup değişim tarihlerini buradan takip edebilirsiniz.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label className="calendar-add-btn" style={{ background: '#10b981', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            📥 Excel ile Yükle
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} style={{ display: 'none' }} />
          </label>

          <button onClick={() => setIsAddModalOpen(true)} className="calendar-add-btn">
            + Yeni Etkinlik / Sınav Ekle
          </button>
        </div>
      </div>

      <div className="calendar-filters">
        <div className="filter-group">
          <label className="filter-label">Sınıf Seviyesi</label>
          <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="filter-select">
            <option value="all">Tüm Okul / Sınıfsız</option>
            <option value="12">12. Sınıflar</option>
            <option value="11">11. Sınıflar</option>
            <option value="10">10. Sınıflar</option>
            <option value="9">9. Sınıflar</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Kategori</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="filter-select">
            <option value="all">Tüm Kategoriler</option>
            <option value="exam">Sınavlar</option>
            <option value="homework">Ödevler</option>
            <option value="group_change">Grup Değişimleri</option>
            <option value="meeting">Toplantılar</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-box">Takvim yükleniyor...</div>
      ) : events.length === 0 ? (
        <div className="empty-box">Bu kriterlere uygun etkinlik bulunamadı.</div>
      ) : (
        <div className="calendar-grid">
          {events.map((item) => (
            <div key={item.id} onClick={() => setActiveEvent(item)} className="calendar-card">
              <div>
                <div className="calendar-card-header">
                  <span className={getCategoryBadgeClass(item.category)}>
                    {getCategoryText(item.category)}
                  </span>
                  <span className="grade-tag">
                    {item.grade_level === 'all' ? 'Tüm Okul' : `${item.grade_level}. Sınıf`}
                  </span>
                </div>
                <h3 className="calendar-card-title">{item.title}</h3>
                <p className="calendar-card-desc">
                  {item.description || 'Açıklama girilmemiş.'}
                </p>
              </div>
              <div className="calendar-card-footer">
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

      {activeEvent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <span className={getCategoryBadgeClass(activeEvent.category)}>
                  {getCategoryText(activeEvent.category)}
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: '10px 0 0 0' }}>{activeEvent.title}</h2>
              </div>
              <button onClick={() => setActiveEvent(null)} className="modal-close-btn">&times;</button>
            </div>

            <div className="modal-body">
              <div className="modal-box-item">
                <strong>Tarih:</strong> {new Date(activeEvent.event_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
              </div>
              <div className="modal-box-item">
                <strong>Sınıf Seviyesi:</strong> {activeEvent.grade_level === 'all' ? 'Tüm Okul' : `${activeEvent.grade_level}. Sınıf`}
              </div>
              <div className="modal-box-item">
                <strong>Açıklama:</strong>
                <p style={{ margin: '5px 0 0 0', whiteSpace: 'pre-wrap', color: '#334155' }}>{activeEvent.description || 'Detay bulunmuyor.'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
              <button onClick={() => handleDeleteEvent(activeEvent.id)} className="btn-danger">
                Etkinliği Sil
              </button>
              <button onClick={() => setActiveEvent(null)} className="btn-secondary" style={{ background: '#334155', color: 'white' }}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Yeni Takvim Kaydı Ekle</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>

            <form onSubmit={handleAddEvent}>
              <div className="form-group">
                <label className="form-label">Etkinlik / Sınav / Ödev Adı</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Örn: 12. Sınıf Yaz Ödevi"
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Kategori</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    className="form-select"
                  >
                    <option value="exam">Sınav</option>
                    <option value="homework">Ödev</option>
                    <option value="group_change">Grup Değişimi</option>
                    <option value="meeting">Toplantı</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Sınıf Seviyesi</label>
                  <select
                    value={newEvent.grade_level}
                    onChange={(e) => setNewEvent({ ...newEvent, grade_level: e.target.value })}
                    className="form-select"
                  >
                    <option value="all">Tüm Okul</option>
                    <option value="12">12. Sınıf</option>
                    <option value="11">11. Sınıf</option>
                    <option value="10">10. Sınıf</option>
                    <option value="9">9. Sınıf</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Tarih</label>
                  <input
                    type="date"
                    required
                    value={newEvent.event_date}
                    onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Bitiş Tarihi (Opsiyonel)</label>
                  <input
                    type="date"
                    value={newEvent.end_date}
                    onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Açıklama / Detay</label>
                <textarea
                  rows="3"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Detaylar..."
                  className="form-textarea"
                ></textarea>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-secondary">
                  İptal
                </button>
                <button type="submit" className="btn-primary">
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
