import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase istemci bağlantını buraya ekle (veya dışarıdan import et)
const supabase = createClient('SENIN_SUPABASE_URL', 'SENIN_SUPABASE_ANON_KEY');

export default function Calender() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtreleme state'leri
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Detay Modalı state'i
  const [activeEvent, setActiveEvent] = useState(null);
  
  // Yeni Etkinlik Ekleme Modal state'i
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: '',
    end_date: '',
    category: 'exam',
    grade_level: '12',
    description: ''
  });

  // Verileri Supabase'den çekme
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

  // Yeni etkinlik kaydetme
  const handleAddEvent = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from('school_calendar').insert([newEvent]);
    if (error) {
      alert('Kayıt eklenirken hata oluştu: ' + error.message);
    } else {
      setIsAddModalOpen(false);
      setNewEvent({ title: '', event_date: '', end_date: '', category: 'exam', grade_level: '12', description: '' });
      fetchEvents();
    }
  };

  // Etkinlik silme
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

  // Kategori rozetleri ve renkleri
  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'exam': return <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Sınav</span>;
      case 'homework': return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Ödev</span>;
      case 'group_change': return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Grup Değişimi</span>;
      case 'meeting': return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Toplantı</span>;
      default: return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-0.5 rounded-full font-medium">Diğer</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-slate-50 min-h-screen rounded-xl shadow-sm">
      {/* Üst Başlık ve Ekle Butonu */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Okul İşleyiş ve Sınav Takvimi</h1>
          <p className="text-sm text-slate-500">Sınavları, ödevleri ve grup değişim tarihlerini takip edin.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          + Yeni Etkinlik / Sınav Ekle
        </button>
      </div>

      {/* Filtreleme Alanı */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Sınıf Seviyesi</label>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
          >
            <option value="all">Tüm Okul / Sınıfsız</option>
            <option value="12">12. Sınıflar</option>
            <option value="11">11. Sınıflar</option>
            <option value="10">10. Sınıflar</option>
            <option value="9">9. Sınıflar</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Kategori</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
          >
            <option value="all">Tüm Kategoriler</option>
            <option value="exam">Sınavlar</option>
            <option value="homework">Ödevler</option>
            <option value="group_change">Grup Değişimleri</option>
            <option value="meeting">Toplantılar</option>
          </select>
        </div>
      </div>

      {/* Takvim / Etkinlik Listesi */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Takvim yükleniyor...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
          Bu kriterlere uygun etkinlik bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveEvent(item)}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2 gap-2">
                  {getCategoryBadge(item.category)}
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                    {item.grade_level === 'all' ? 'Tüm Okul' : `${item.grade_level}. Sınıf`}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-800 text-base mb-1">{item.title}</h3>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{item.description || 'Açıklama girilmemiş.'}</p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-2 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-indigo-600">
                  📅 {new Date(item.event_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                </span>
                {item.end_date && (
                  <span className="text-slate-400">Bitiş: {new Date(item.end_date).toLocaleDateString('tr-TR')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detay Modalı */}
      {activeEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                {getCategoryBadge(activeEvent.category)}
                <h2 className="text-xl font-bold text-slate-800 mt-2">{activeEvent.title}</h2>
              </div>
              <button
                onClick={() => setActiveEvent(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2"
              >
                &times;
              </button>
            </div>
            
            <div className="space-y-3 mb-6 text-sm text-slate-600">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-700 block mb-1">Tarih Bilgisi:</span>
                <span>{new Date(activeEvent.event_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</span>
                {activeEvent.end_date && (
                  <span className="block mt-1 text-xs text-slate-500">Kontrol / Bitiş Tarihi: {new Date(activeEvent.end_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-700 block mb-1">Sınıf Seviyesi:</span>
                <span>{activeEvent.grade_level === 'all' ? 'Tüm Okul' : `${activeEvent.grade_level}. Sınıf`}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-700 block mb-1">İçerik / Açıklama:</span>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{activeEvent.description || 'Detay bulunmuyor.'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 pt-4">
              <button
                onClick={() => handleDeleteEvent(activeEvent.id)}
                className="text-red-600 hover:text-red-700 text-xs font-semibold px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition"
              >
                Etkinliği Sil
              </button>
              <button
                onClick={() => setActiveEvent(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-4 py-2 rounded-lg font-medium transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yeni Etkinlik Ekleme Modalı */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Yeni Takvim Kaydı Ekle</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Etkinlik / Sınav / Ödev Adı</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Örn: 12. Sınıf Yaz Ödevi veya 3D TYT Deneme-1"
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="exam">Sınav</option>
                    <option value="homework">Ödev</option>
                    <option value="group_change">Grup Değişimi</option>
                    <option value="meeting">Toplantı</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sınıf Seviyesi</label>
                  <select
                    value={newEvent.grade_level}
                    onChange={(e) => setNewEvent({ ...newEvent, grade_level: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="all">Tüm Okul</option>
                    <option value="12">12. Sınıf</option>
                    <option value="11">11. Sınıf</option>
                    <option value="10">10. Sınıf</option>
                    <option value="9">9. Sınıf</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Başlangıç / Etkinlik Tarihi</label>
                  <input
                    type="date"
                    required
                    value={newEvent.event_date}
                    onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bitiş / Kontrol Tarihi (Opsiyonel)</label>
                  <input
                    type="date"
                    value={newEvent.end_date}
                    onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Açıklama / Detay</label>
                <textarea
                  rows="3"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="PDF'te yer alan detaylar, çözülecek testler veya deneme yayın adları..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
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
