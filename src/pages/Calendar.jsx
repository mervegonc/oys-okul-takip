import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';
import '../styles/Calendar.css';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedGrade, setSelectedGrade] = useState('12');
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
        dateStr: `${year}-${month}-${day}`,
        fullDateObj: d
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
    const months = { 'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04', 'mayıs': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08', 'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12' };
    let cleanStr = String(dateStr).toLowerCase().trim();
    let foundMonth = '01', foundYear = '2026', foundDay = '01';
    for (let [mName, mNum] of Object.entries(months)) {
      if (cleanStr.includes(mName)) { foundMonth = mNum; cleanStr = cleanStr.replace(mName, ''); break; }
    }
    const numbers = cleanStr.replace(/[^0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (numbers.length >= 2) {
      for (let num of numbers) {
        if (num.length === 4 || (num.length === 2 && parseInt(num) > 31)) { foundYear = num.length === 2 ? '20' + num : num; }
        else { foundDay = num.padStart(2, '0'); }
      }
    } else if (numbers.length === 1) { foundDay = numbers[0].padStart(2, '0'); }
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
    if (window.confirm('Silmek istediğinize emin misiniz?')) {
      const { error } = await supabase.from('school_calendar').delete().eq('id', id);
      if (!error) { setActiveEvent(null); fetchEvents(); }
    }
  };

  const getCategoryBadgeClass = (cat) => {
    switch (cat) {
      case 'exam': return 'badge-exam';
      case 'homework': return 'badge-homework';
      case 'group_change': return 'badge-group_change';
      case 'meeting': return 'badge-meeting';
      default: return 'badge-default';
    }
  };

  const daysGrid = viewMode === 'monthly' 
    ? getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())
    : getDaysInWeek(currentDate);

  const weekDaysHeader = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <div className="calendar-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div className="calendar-header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="calendar-title" style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>Okul İşleyiş ve Sınav Takvimi</h1>
          <p className="calendar-subtitle" style={{ color: '#64748b' }}>Takvimi aylık veya haftalık ızgara görünümünde takip edin.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label className="calendar-add-btn" style={{ background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
            📥 Excel ile Yükle
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} style={{ display: 'none' }} />
          </label>
          <button onClick={() => setIsAddModalOpen(true)} style={{ background: '#2563eb', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
            + Yeni Etkinlik Ekle
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setViewMode('monthly')} style={{ padding: '8px 16px', background: viewMode === 'monthly' ? '#2563eb' : '#e2e8f0', color: viewMode === 'monthly' ? '#fff' : '#334155', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Aylık Takvim</button>
          <button onClick={() => setViewMode('weekly')} style={{ padding: '8px 16px', background: viewMode === 'weekly' ? '#2563eb' : '#e2e8f0', color: viewMode === 'weekly' ? '#fff' : '#334155', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Haftalık Takvim</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={handlePrevPeriod} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>&larr; Önceki</button>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', minWidth: '180px', textAlign: 'center' }}>
            {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={handleNextPeriod} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Sonraki &rarr;</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          <option value="all">Tüm Okul / Sınıfsız</option>
          <option value="12">12. Sınıflar</option>
          <option value="11">11. Sınıflar</option>
          <option value="10">10. Sınıflar</option>
          <option value="9">9. Sınıflar</option>
        </select>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          <option value="all">Tüm Kategoriler</option>
          <option value="exam">Sınavlar</option>
          <option value="homework">Ödevler</option>
          <option value="group_change">Grup Değişimleri</option>
          <option value="meeting">Toplantılar</option>
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold', padding: '10px 0', color: '#475569' }}>
          {weekDaysHeader.map((d, index) => (
            <div key={index}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(120px, auto)' }}>
          {daysGrid.map((dayItem, index) => {
            const dayEvents = events.filter(ev => ev.event_date === dayItem.dateStr);

            return (
              <div 
                key={index} 
                style={{
                  borderRight: '1px solid #e2e8f0',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '8px',
                  background: dayItem.isCurrentMonth ? '#fff' : '#f8fafc',
                  opacity: dayItem.isCurrentMonth ? 1 : 0.4,
                  minHeight: '120px',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px', color: dayItem.isCurrentMonth ? '#1e293b' : '#94a3b8', marginBottom: '5px' }}>
                  {dayItem.dayNumber}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '100px' }}>
                  {dayEvents.map(ev => (
                    <div 
                      key={ev.id} 
                      onClick={() => setActiveEvent(ev)}
                      className={getCategoryBadgeClass(ev.category)}
                      style={{
                        fontSize: '11px',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: '500',
                        background: ev.category === 'exam' ? '#fee2e2' : ev.category === 'homework' ? '#fef3c7' : '#e0f2fe',
                        color: ev.category === 'exam' ? '#991b1b' : ev.category === 'homework' ? '#92400e' : '#0369a1',
                        borderLeft: `3px solid ${ev.category === 'exam' ? '#dc2626' : ev.category === 'homework' ? '#d97706' : '#0284c7'}`
                      }}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeEvent && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '10px', width: '400px', maxWidth: '90%' }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>{activeEvent.title}</h2>
            <p><strong>Tarih:</strong> {new Date(activeEvent.event_date).toLocaleDateString('tr-TR')}</p>
            <p><strong>Sınıf:</strong> {activeEvent.grade_level === 'all' ? 'Tüm Okul' : `${activeEvent.grade_level}. Sınıf`}</p>
            <p><strong>Açıklama:</strong> {activeEvent.description || 'Açıklama yok.'}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button onClick={() => handleDeleteEvent(activeEvent.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Sil</button>
              <button onClick={() => setActiveEvent(null)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '10px', width: '450px', maxWidth: '90%' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>Yeni Etkinlik Ekle</h2>
            <form onSubmit={handleAddEvent}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Etkinlik Adı</label>
                <input type="text" required value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Kategori</label>
                  <select value={newEvent.category} onChange={e => setNewEvent({...newEvent, category: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                    <option value="exam">Sınav</option>
                    <option value="homework">Ödev</option>
                    <option value="group_change">Grup Değişimi</option>
                    <option value="meeting">Toplantı</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Sınıf</label>
                  <select value={newEvent.grade_level} onChange={e => setNewEvent({...newEvent, grade_level: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                    <option value="all">Tüm Okul</option>
                    <option value="12">12. Sınıf</option>
                    <option value="11">11. Sınıf</option>
                    <option value="10">10. Sınıf</option>
                    <option value="9">9. Sınıf</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Tarih</label>
                <input type="date" required value={newEvent.event_date} onChange={e => setNewEvent({...newEvent, event_date: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Açıklama</label>
                <textarea rows="3" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ background: '#64748b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>İptal</button>
                <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
