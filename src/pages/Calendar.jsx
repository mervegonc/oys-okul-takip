import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';
import '../styles/Calendar.css';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [viewMode, setViewMode] = useState('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const handlePrevPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'monthly') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'monthly') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const getDaysInMonth = (year, month) => {
    const date = new Date(year, month, 1);
    const days = [];
    
    let firstDayIndex = date.getDay() - 1; 
    if (firstDayIndex === -1) firstDayIndex = 6; 

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i++) {
      const formattedMonth = String(month + 1).padStart(2, '0');
      const formattedDay = String(i).padStart(2, '0');
      const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
      
      days.push({
        dayNumber: i,
        isCurrentMonth: true,
        dateStr: dateStr
      });
    }

    const totalCells = Math.ceil(days.length / 7) * 7;
    const nextMonthDaysCount = totalCells - days.length;
    for (let i = 1; i <= nextMonthDaysCount; i++) {
      days.push({
        dayNumber: i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    return days;
  };

  const getDaysInWeek = (date) => {
    const curr = new Date(date);
    const firstDayOfWeek = new Date(curr.setDate(curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1)));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDayOfWeek);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      days.push({
        dayNumber: d.getDate(),
        isCurrentMonth: true,
        dateStr: `${year}-${month}-${day}`
      });
    }
    return days;
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    const payload = { ...newEvent, end_date: newEvent.end_date ? newEvent.end_date : null };
    const { error } = await supabase.from('school_calendar').insert([payload]);
    if (error) {
      alert('Kayıt eklenirken hata oluştu: ' + error.message);
    } else {
      setIsAddModalOpen(false);
      setNewEvent({ title: '', event_date: '', end_date: '', category: 'exam', grade_level: '12', description: '' });
      fetchEvents();
    }
  };

  const parseTurkishDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    if (dateStr instanceof Date) return dateStr.toISOString().split('T')[0];
    
    const months = { 
      'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04', 
      'mayıs': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08', 
      'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12' 
    };
    
    const cleanStr = String(dateStr).toLowerCase().trim();
    const match = cleanStr.match(/(\d{1,2})\s+([a-züİöçşğ]+)\s+(\d{2,4})/);
    
    if (match) {
      const day = match[1].padStart(2, '0');
      const monthStr = match[2];
      let year = match[3];
      if (year.length === 2) year = '20' + year;
      
      let month = '01';
      for (let [mName, mNum] of Object.entries(months)) {
        if (monthStr.includes(mName)) { month = mNum; break; }
      }
      return `${year}-${month}-${day}`;
    }
    
    let foundMonth = '01', foundYear = '2026', foundDay = '01';
    for (let [mName, mNum] of Object.entries(months)) {
      if (cleanStr.includes(mName)) { foundMonth = mNum; break; }
    }
    
    const numbers = cleanStr.replace(/[^0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (numbers.length >= 2) {
      foundDay = numbers[0].padStart(2, '0');
      let secondNum = numbers[1];
      foundYear = secondNum.length === 2 ? '20' + secondNum : secondNum;
    } else if (numbers.length === 1) {
      foundDay = numbers[0].padStart(2, '0');
    }
    
    return `${foundYear}-${foundMonth}-${foundDay}`;
  };

  const parseGradeLevel = (gradeStr) => {
    if (!gradeStr) return '12';
    const str = String(gradeStr).toLowerCase();
    if (str.includes('tüm') || str.includes('okul')) return 'all';
    const match = str.match(/\d+/);
    return match ? match[0] : '12';
  };

  const parseCategory = (catStr) => {
    if (!catStr) return 'exam';
    const str = String(catStr).toLowerCase();
    if (str.includes('ödev')) return 'homework';
    if (str.includes('grup')) return 'group_change';
    if (str.includes('toplantı')) return 'meeting';
    return 'exam';
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        const formattedEvents = data.map((row) => ({
          title: row['Sınav Adı'] || row['Etkinlik Adı'] || 'İsimsiz Etkinlik',
          category: parseCategory(row['Kategori']),
          grade_level: parseGradeLevel(row['Sınıf Seviyesi'] || row['Sınıf']),
          event_date: parseTurkishDate(row['Uygulama Tarihi'] || row['Tarih']),
          end_date: null,
          description: row['Açıklama'] ? String(row['Açıklama']) : ''
        }));
        const { error } = await supabase.from('school_calendar').insert(formattedEvents);
        if (error) alert('Hata: ' + error.message);
        else { alert(`${formattedEvents.length} etkinlik yüklendi!`); fetchEvents(); }
      } catch (err) { alert('Dosya okunamadı.'); }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleDeleteEvent = async (id) => {
    if (window.confirm('Bu etkinliği silmek istediğinize emin misiniz?')) {
      const { error } = await supabase.from('school_calendar').delete().eq('id', id);
      if (!error) { setActiveEvent(null); fetchEvents(); }
    }
  };

  // Kategoriye özel CSS sınıfı
  const getCategoryClass = (cat) => {
    switch (cat) {
      case 'exam': return 'event-exam';
      case 'homework': return 'event-homework';
      case 'group_change': return 'event-group';
      case 'meeting': return 'event-meeting';
      default: return 'event-default';
    }
  };

  const daysGrid = viewMode === 'monthly' 
    ? getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())
    : getDaysInWeek(currentDate);

  const weekDaysHeader = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

  return (
    <div className="modern-calendar-root">
      {/* Üst Başlık ve Aksiyonlar */}
      <div className="cal-top-banner">
        <div>
          <h1 className="cal-main-title">Okul İşleyiş ve Sınav Takvimi</h1>
          <p className="cal-sub-title">Etkinlikleri ve sınavları kategori ile sınıf düzeylerine göre şık arayüzde yönetin.</p>
        </div>
        <div className="cal-actions">
          <label className="cal-btn cal-btn-success">
            <span>📥 Excel Yükle</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} hidden />
          </label>
          <button className="cal-btn cal-btn-primary" onClick={() => setIsAddModalOpen(true)}>
            + Yeni Etkinlik
          </button>
        </div>
      </div>

      {/* Kontrol Paneli & Filtreler */}
      <div className="cal-control-panel">
        <div className="cal-view-toggle">
          <button 
            className={`toggle-pill ${viewMode === 'monthly' ? 'active' : ''}`} 
            onClick={() => setViewMode('monthly')}
          >
            Aylık Görünüm
          </button>
          <button 
            className={`toggle-pill ${viewMode === 'weekly' ? 'active' : ''}`} 
            onClick={() => setViewMode('weekly')}
          >
            Haftalık Görünüm
          </button>
        </div>

        <div className="cal-date-navigator">
          <button className="nav-arrow-btn" onClick={handlePrevPeriod}>&larr; Önceki</button>
          <span className="current-date-label">
            {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button className="nav-arrow-btn" onClick={handleNextPeriod}>Sonraki &rarr;</button>
        </div>

        <div className="cal-filters">
          <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="cal-select">
            <option value="all">Tüm Sınıflar</option>
            <option value="12">12. Sınıflar</option>
            <option value="11">11. Sınıflar</option>
            <option value="10">10. Sınıflar</option>
            <option value="9">9. Sınıflar</option>
          </select>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="cal-select">
            <option value="all">Tüm Kategoriler</option>
            <option value="exam">Sınavlar</option>
            <option value="homework">Ödevler</option>
            <option value="group_change">Grup Değişimleri</option>
            <option value="meeting">Toplantılar</option>
          </select>
        </div>
      </div>

      {/* Takvim Izgarası */}
      <div className="cal-grid-wrapper">
        <div className="cal-weekdays-header">
          {weekDaysHeader.map((d, idx) => (
            <div key={idx} className="weekday-title">{d}</div>
          ))}
        </div>

        <div className="cal-days-grid">
          {daysGrid.map((dayItem, index) => {
            const dayEvents = events.filter(ev => ev.event_date === dayItem.dateStr);

            return (
              <div 
                key={index} 
                className={`cal-day-cell ${dayItem.isCurrentMonth ? '' : 'outside-month'}`}
              >
                <div className="day-number-badge">{dayItem.dayNumber}</div>

                <div className="events-stack">
                  {dayEvents.map(ev => {
                    const gradeText = ev.grade_level === 'all' ? 'Tüm Okul' : `${ev.grade_level}. Sınıf`;
                    return (
                      <div 
                        key={ev.id} 
                        onClick={() => setActiveEvent(ev)}
                        className={`event-card-item ${getCategoryClass(ev.category)}`}
                        title={ev.title}
                      >
                        <span className="event-grade-pill">{gradeText}</span>
                        <span className="event-title-text">{ev.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detay / Silme Modalı */}
      {activeEvent && (
        <div className="cal-modal-backdrop" onClick={() => setActiveEvent(null)}>
          <div className="cal-modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header-tag">
              <span className={`modal-cat-badge ${activeEvent.category}`}>
                {activeEvent.category === 'exam' ? 'Sınav' : activeEvent.category === 'homework' ? 'Ödev' : 'Etkinlik'}
              </span>
              <span className="modal-grade-tag">
                {activeEvent.grade_level === 'all' ? 'Tüm Okul' : `${activeEvent.grade_level}. Sınıf`}
              </span>
            </div>
            <h2 className="modal-title">{activeEvent.title}</h2>
            <p className="modal-info-row"><strong>📅 Tarih:</strong> {new Date(activeEvent.event_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="modal-info-row"><strong>📝 Açıklama:</strong> {activeEvent.description || 'Açıklama belirtilmemiş.'}</p>
            
            <div className="modal-footer-btns">
              <button className="btn-danger-soft" onClick={() => handleDeleteEvent(activeEvent.id)}>Etkinliği Sil</button>
              <button className="btn-secondary-soft" onClick={() => setActiveEvent(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Yeni Etkinlik Ekleme Modalı */}
      {isAddModalOpen && (
        <div className="cal-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="cal-modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">✨ Yeni Etkinlik Tanımla</h2>
            <form onSubmit={handleAddEvent}>
              <div className="form-group">
                <label>Etkinlik / Sınav Adı</label>
                <input type="text" required value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="Örn: 3D TYT Deneme" className="cal-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Kategori</label>
                  <select value={newEvent.category} onChange={e => setNewEvent({...newEvent, category: e.target.value})} className="cal-select w-full">
                    <option value="exam">Sınav</option>
                    <option value="homework">Ödev</option>
                    <option value="group_change">Grup Değişimi</option>
                    <option value="meeting">Toplantı</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sınıf Seviyesi</label>
                  <select value={newEvent.grade_level} onChange={e => setNewEvent({...newEvent, grade_level: e.target.value})} className="cal-select w-full">
                    <option value="all">Tüm Okul</option>
                    <option value="12">12. Sınıf</option>
                    <option value="11">11. Sınıf</option>
                    <option value="10">10. Sınıf</option>
                    <option value="9">9. Sınıf</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Tarih</label>
                <input type="date" required value={newEvent.event_date} onChange={e => setNewEvent({...newEvent, event_date: e.target.value})} className="cal-input" />
              </div>
              <div className="form-group">
                <label>Açıklama / Detay</label>
                <textarea rows="3" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="Soru sayısı, süre vb." className="cal-input"></textarea>
              </div>
              <div className="modal-footer-btns">
                <button type="button" className="btn-secondary-soft" onClick={() => setIsAddModalOpen(false)}>İptal</button>
                <button type="submit" className="cal-btn cal-btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
