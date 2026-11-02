import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import {
  FaUserPlus,
  FaEdit,
  FaTrash,
  FaSlidersH,
  FaUserCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSearch,
  FaSave,
  FaTimes,
  FaFileExcel
} from 'react-icons/fa';
import * as XLSX from 'xlsx';

const Candidates = () => {
  const [activeTab, setActiveTab] = useState('candidates'); // 'candidates' | 'thresholds' | 'staff'
  const [candidates, setCandidates] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Aday Form State'leri
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [candidateForm, setCandidateForm] = useState({
    full_name: '',
    grade_level: '9. Sınıf',
    special_note: '',
    appointment_by: '',
    exam_name: '',
    exam_score: '',
    exam_date: '',
    feedback_by: '',
    feedback_note: ''
  });

  // Baraj Form State'leri
  const [editingThreshold, setEditingThreshold] = useState(null);
  const [newThreshold, setNewThreshold] = useState({ grade_level: '', min_score: '' });

  // Personel Form State'leri
  const [newStaffName, setNewStaffName] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchCandidates(), fetchThresholds(), fetchStaff()]);
    setLoading(false);
  };

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (err) {
      console.error('Adaylar çekilirken hata:', err);
    }
  };

  const fetchThresholds = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_thresholds')
        .select('*')
        .order('grade_level', { ascending: true });

      if (error) throw error;
      setThresholds(data || []);
    } catch (err) {
      console.error('Baraj puanları çekilirken hata:', err);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_staff')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setStaffList(data || []);
    } catch (err) {
      console.error('Personel listesi çekilirken hata:', err);
    }
  };

  // -------------------------------------------------------------
  // Otomatik Baraj Hesaplama Fonksiyonu
  // -------------------------------------------------------------
  const calculatePassStatus = (gradeLevel, scoreVal) => {
    if (scoreVal === '' || scoreVal === null || scoreVal === undefined) {
      return 'Puan Girilmedi';
    }
    const score = parseFloat(scoreVal);
    if (isNaN(score)) return 'Puan Girilmedi';

    const targetThreshold = thresholds.find(
      (t) => t.grade_level.trim().toLowerCase() === String(gradeLevel).trim().toLowerCase()
    );

    if (!targetThreshold) {
      return 'Baraj Tanımsız';
    }

    return score >= parseFloat(targetThreshold.min_score) ? 'Barajı Geçti' : 'Baraj Altı';
  };

  // -------------------------------------------------------------
  // Aday İşlemleri (Ekle / Güncelle / Sil)
  // -------------------------------------------------------------
  const handleCandidateSubmit = async (e) => {
    e.preventDefault();
    if (!candidateForm.full_name || !candidateForm.grade_level) {
      alert('Lütfen Aday Adı Soyadı ve Sınıf Seviyesini giriniz.');
      return;
    }

    const passStatus = calculatePassStatus(candidateForm.grade_level, candidateForm.exam_score);

    const payload = {
      full_name: candidateForm.full_name.trim(),
      grade_level: candidateForm.grade_level,
      special_note: candidateForm.special_note || '',
      appointment_by: candidateForm.appointment_by || '',
      exam_name: candidateForm.exam_name || '',
      exam_score: candidateForm.exam_score !== '' ? parseFloat(candidateForm.exam_score) : null,
      pass_status: passStatus,
      exam_date: candidateForm.exam_date ? new Date(candidateForm.exam_date).toISOString() : null,
      feedback_by: candidateForm.feedback_by || '',
      feedback_note: candidateForm.feedback_note || ''
    };

    try {
      if (editingCandidate) {
        const { error } = await supabase
          .from('candidates')
          .update(payload)
          .eq('id', editingCandidate.id);

        if (error) throw error;
        alert('Aday kaydı başarıyla güncellendi.');
      } else {
        const { error } = await supabase.from('candidates').insert([payload]);
        if (error) throw error;
        alert('Yeni aday kaydı oluşturuldu.');
      }

      resetCandidateForm();
      fetchCandidates();
    } catch (err) {
      console.error('Aday kaydedilirken hata:', err);
      alert('İşlem başarısız: ' + err.message);
    }
  };

  const handleEditCandidate = (cand) => {
    setEditingCandidate(cand);
    setCandidateForm({
      full_name: cand.full_name || '',
      grade_level: cand.grade_level || '9. Sınıf',
      special_note: cand.special_note || '',
      appointment_by: cand.appointment_by || '',
      exam_name: cand.exam_name || '',
      exam_score: cand.exam_score !== null ? cand.exam_score : '',
      exam_date: cand.exam_date ? cand.exam_date.slice(0, 16) : '',
      feedback_by: cand.feedback_by || '',
      feedback_note: cand.feedback_note || ''
    });
    setShowCandidateForm(true);
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Bu aday kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('candidates').delete().eq('id', id);
      if (error) throw error;
      fetchCandidates();
    } catch (err) {
      console.error('Silme hatası:', err);
    }
  };

  const resetCandidateForm = () => {
    setEditingCandidate(null);
    setCandidateForm({
      full_name: '',
      grade_level: thresholds[0]?.grade_level || '9. Sınıf',
      special_note: '',
      appointment_by: '',
      exam_name: '',
      exam_score: '',
      exam_date: '',
      feedback_by: '',
      feedback_note: ''
    });
    setShowCandidateForm(false);
  };

  // -------------------------------------------------------------
  // Baraj Puanı İşlemleri
  // -------------------------------------------------------------
  const handleSaveThreshold = async (e) => {
    e.preventDefault();
    if (!newThreshold.grade_level || newThreshold.min_score === '') return;

    try {
      if (editingThreshold) {
        const { error } = await supabase
          .from('candidate_thresholds')
          .update({
            grade_level: newThreshold.grade_level.trim(),
            min_score: parseFloat(newThreshold.min_score)
          })
          .eq('id', editingThreshold.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('candidate_thresholds').insert([
          {
            grade_level: newThreshold.grade_level.trim(),
            min_score: parseFloat(newThreshold.min_score)
          }
        ]);
        if (error) throw error;
      }

      setEditingThreshold(null);
      setNewThreshold({ grade_level: '', min_score: '' });
      fetchThresholds();
      fetchCandidates(); // Barajlar değişince durumları güncellemek için adayları da tazeliyoruz
    } catch (err) {
      alert('Baraj kaydedilemedi: ' + err.message);
    }
  };

  const handleDeleteThreshold = async (id) => {
    if (!window.confirm('Bu baraj puanı kuralını silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('candidate_thresholds').delete().eq('id', id);
      if (error) throw error;
      fetchThresholds();
    } catch (err) {
      console.error('Silme hatası:', err);
    }
  };

  // -------------------------------------------------------------
  // Personel Liste İşlemleri
  // -------------------------------------------------------------
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    try {
      const { error } = await supabase
        .from('candidate_staff')
        .insert([{ name: newStaffName.trim() }]);

      if (error) throw error;
      setNewStaffName('');
      fetchStaff();
    } catch (err) {
      alert('Personel eklenemedi: ' + err.message);
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Bu yetkili ismini silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('candidate_staff').delete().eq('id', id);
      if (error) throw error;
      fetchStaff();
    } catch (err) {
      console.error('Silme hatası:', err);
    }
  };

  // -------------------------------------------------------------
  // Excel Dışa Aktarma
  // -------------------------------------------------------------
  const exportToExcel = () => {
    const dataToExport = filteredCandidates.map((c, idx) => ({
      '#': idx + 1,
      'Adı Soyadı': c.full_name,
      'Sınıf Seviyesi': c.grade_level,
      'Kayıt Tarihi': new Date(c.created_at).toLocaleString('tr-TR'),
      'Randevu Veren': c.appointment_by || '-',
      'Sınav Adı': c.exam_name || '-',
      'Sınav Puanı': c.exam_score !== null ? c.exam_score : '-',
      'Baraj Durumu': c.pass_status || '-',
      'Sınav Tarihi/Saati': c.exam_date ? new Date(c.exam_date).toLocaleString('tr-TR') : '-',
      'Dönüş Sağlayan': c.feedback_by || '-',
      'Dönüş Notu': c.feedback_note || '-',
      'Özel Not': c.special_note || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Adaylar');
    XLSX.writeFile(workbook, `Aday_Kayit_Listesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Arama Filtreleme
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const q = searchQuery.toLowerCase();
      return (
        c.full_name?.toLowerCase().includes(q) ||
        c.grade_level?.toLowerCase().includes(q) ||
        c.appointment_by?.toLowerCase().includes(q) ||
        c.exam_name?.toLowerCase().includes(q) ||
        c.feedback_by?.toLowerCase().includes(q)
      );
    });
  }, [candidates, searchQuery]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* 📌 BAŞLIK VE KONTROL SEKMELERİ */}
      <div style={{ background: '#fff', padding: '1.2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              📝 Aday Not & Takip Modülü
            </h2>
            <p style={{ margin: '0.3rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Aday kayıtları, baraj puanı tanımları ve personel listesini yönetin.
            </p>
          </div>

          {/* KAYIT BAŞLIĞI ALTINDA TOPLANAN SEKMELER */}
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '8px' }}>
            <button
              onClick={() => setActiveTab('candidates')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '0.88rem',
                cursor: 'pointer',
                background: activeTab === 'candidates' ? '#2563eb' : 'transparent',
                color: activeTab === 'candidates' ? '#fff' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <FaUserPlus /> Aday Listesi & Kayıt
            </button>

            <button
              onClick={() => setActiveTab('thresholds')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '0.88rem',
                cursor: 'pointer',
                background: activeTab === 'thresholds' ? '#2563eb' : 'transparent',
                color: activeTab === 'thresholds' ? '#fff' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <FaSlidersH /> Baraj Puanları Tanımı
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '0.88rem',
                cursor: 'pointer',
                background: activeTab === 'staff' ? '#2563eb' : 'transparent',
                color: activeTab === 'staff' ? '#fff' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <FaUserCheck /> İsim / Personel Listesi
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ADAY KARTLARI VE LİSTESİ SEKME BÖLÜMÜ */}
      {/* ========================================================================= */}
      {activeTab === 'candidates' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
              <button
                onClick={() => {
                  resetCandidateForm();
                  setShowCandidateForm(!showCandidateForm);
                }}
                style={{
                  padding: '0.55rem 1.2rem',
                  background: showCandidateForm ? '#64748b' : '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {showCandidateForm ? <FaTimes /> : <FaUserPlus />} {showCandidateForm ? 'Formu Kapat' : 'Yeni Aday Kaydı'}
              </button>

              <button
                onClick={exportToExcel}
                style={{
                  padding: '0.55rem 1.2rem',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FaFileExcel /> Excel İndir
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <FaSearch style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Aday adı, Yetkili veya Sınıf ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '0.9rem', width: '220px' }}
              />
            </div>
          </div>

          {/* ADAY KAYIT / DÜZENLEME FORMU */}
          {showCandidateForm && (
            <form
              onSubmit={handleCandidateSubmit}
              style={{
                background: '#fff',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                marginBottom: '1.5rem',
                border: '1px solid #e2e8f0'
              }}
            >
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                {editingCandidate ? '✏️ Aday Bilgilerini Düzenle' : '➕ Yeni Aday Kaydı Oluştur'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {/* Ad Soyad */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Adayın Adı Soyadı <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={candidateForm.full_name}
                    onChange={(e) => setCandidateForm({ ...candidateForm, full_name: e.target.value })}
                    placeholder="Örn: Ahmet Yılmaz"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Sınıf Seviyesi */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Sınıf Seviyesi <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    value={candidateForm.grade_level}
                    onChange={(e) => setCandidateForm({ ...candidateForm, grade_level: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                  >
                    {thresholds.length > 0 ? (
                      thresholds.map((t) => (
                        <option key={t.id} value={t.grade_level}>
                          {t.grade_level} (Baraj: {t.min_score})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="9. Sınıf">9. Sınıf</option>
                        <option value="10. Sınıf">10. Sınıf</option>
                        <option value="11. Sınıf EA">11. Sınıf EA</option>
                        <option value="11. Sınıf SAY">11. Sınıf SAY</option>
                        <option value="12. Sınıf EA">12. Sınıf EA</option>
                        <option value="12. Sınıf SAY">12. Sınıf SAY</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Randevu Veren Kişi */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Randevu Veren Kişi
                  </label>
                  <select
                    value={candidateForm.appointment_by}
                    onChange={(e) => setCandidateForm({ ...candidateForm, appointment_by: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">-- Kişi Seçin --</option>
                    {staffList.map((st) => (
                      <option key={st.id} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sınav Adı */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Girdiği Sınav İsmi
                  </label>
                  <input
                    type="text"
                    value={candidateForm.exam_name}
                    onChange={(e) => setCandidateForm({ ...candidateForm, exam_name: e.target.value })}
                    placeholder="Örn: Yıldızlar Kabul Sınavı-1"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Sınav Sonuç Puanı */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Sınav Sonuç Puanı
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={candidateForm.exam_score}
                    onChange={(e) => setCandidateForm({ ...candidateForm, exam_score: e.target.value })}
                    placeholder="Örn: 365.5"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Sınav Tarihi ve Saati */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Sınava Gireceği Tarih & Saat
                  </label>
                  <input
                    type="datetime-local"
                    value={candidateForm.exam_date}
                    onChange={(e) => setCandidateForm({ ...candidateForm, exam_date: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Dönüş Sağlayan Kişi */}
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Dönüş Sağlayan Kişi
                  </label>
                  <select
                    value={candidateForm.feedback_by}
                    onChange={(e) => setCandidateForm({ ...candidateForm, feedback_by: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">-- Kişi Seçin --</option>
                    {staffList.map((st) => (
                      <option key={st.id} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Canlı Baraj Durumu Hesaplama Gösterimi */}
                <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', display: 'block' }}>Otomatik Hesaplanan Baraj Durumu:</span>
                  <div style={{ marginTop: '0.3rem', fontWeight: 'bold', fontSize: '0.95rem' }}>
                    {calculatePassStatus(candidateForm.grade_level, candidateForm.exam_score) === 'Barajı Geçti' && (
                      <span style={{ color: '#16a34a' }}>✅ Barajı Geçti</span>
                    )}
                    {calculatePassStatus(candidateForm.grade_level, candidateForm.exam_score) === 'Baraj Altı' && (
                      <span style={{ color: '#dc2626' }}>❌ Baraj Altı</span>
                    )}
                    {calculatePassStatus(candidateForm.grade_level, candidateForm.exam_score) === 'Puan Girilmedi' && (
                      <span style={{ color: '#d97706' }}>⏳ Puan Girilmedi</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notlar Alanı */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Özel Not</label>
                  <textarea
                    rows="2"
                    value={candidateForm.special_note}
                    onChange={(e) => setCandidateForm({ ...candidateForm, special_note: e.target.value })}
                    placeholder="Aday hakkında özel notlar..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Dönüş Notu (Arama Sonrası)</label>
                  <textarea
                    rows="2"
                    value={candidateForm.feedback_note}
                    onChange={(e) => setCandidateForm({ ...candidateForm, feedback_note: e.target.value })}
                    placeholder="Puan sonrası yapılan arama notları..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetCandidateForm}
                  style={{ padding: '0.5rem 1.2rem', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {editingCandidate ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          )}

          {/* ADAY TABLOSU */}
          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#334155' }}>
                  <th style={{ padding: '10px 12px' }}>Aday Adı Soyadı</th>
                  <th style={{ padding: '10px 12px' }}>Sınıf</th>
                  <th style={{ padding: '10px 12px' }}>Kayıt Tarihi</th>
                  <th style={{ padding: '10px 12px' }}>Randevu Veren</th>
                  <th style={{ padding: '10px 12px' }}>Sınav & Puan</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Baraj Durumu</th>
                  <th style={{ padding: '10px 12px' }}>Sınav Tarihi</th>
                  <th style={{ padding: '10px 12px' }}>Dönüş & Notu</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>Adaylar yükleniyor...</td>
                  </tr>
                ) : filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Kayıtlı aday bulunamadı.</td>
                  </tr>
                ) : (
                  filteredCandidates.map((c) => {
                    const passStatus = c.pass_status || calculatePassStatus(c.grade_level, c.exam_score);

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                          {c.full_name}
                          {c.special_note && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 'normal' }}>
                              📝 {c.special_note}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '600' }}>{c.grade_level}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#64748b' }}>
                          {new Date(c.created_at).toLocaleDateString('tr-TR')}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{c.appointment_by || '-'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '500' }}>{c.exam_name || 'Sınav Girilmedi'}</div>
                          <div style={{ fontSize: '0.82rem', color: '#0369a1', fontWeight: 'bold' }}>
                            {c.exam_score !== null ? `${c.exam_score} Puan` : '-'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {passStatus === 'Barajı Geçti' && (
                            <span style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              ✅ Barajı Geçti
                            </span>
                          )}
                          {passStatus === 'Baraj Altı' && (
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              ❌ Baraj Altı
                            </span>
                          )}
                          {(passStatus === 'Puan Girilmedi' || !passStatus) && (
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              ⏳ Bekliyor
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                          {c.exam_date ? new Date(c.exam_date).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{c.feedback_by || '-'}</div>
                          {c.feedback_note && (
                            <div style={{ fontSize: '0.78rem', color: '#475569', italic: 'true' }}>
                              "{c.feedback_note}"
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleEditCandidate(c)}
                            style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', marginRight: '0.5rem', fontSize: '1rem' }}
                            title="Düzenle"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDeleteCandidate(c.id)}
                            style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: '1rem' }}
                            title="Sil"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BARAJ PUANLARI TANIMI SEKME BÖLÜMÜ */}
      {/* ========================================================================= */}
      {activeTab === 'thresholds' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>🎯 Sınıf Seviyelerine Göre Baraj Puanı Tanımları</h3>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            Sistemin adayların puanına göre otomatik "Barajı Geçti" veya "Baraj Altı" hesaplaması yapabilmesi için her sınıf seviyesine bir baraj puanı tanımlayın.
          </p>

          {/* Yeni / Düzenleme Baraj Formu */}
          <form onSubmit={handleSaveThreshold} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Sınıf Seviyesi / Grubu</label>
              <input
                type="text"
                required
                placeholder="Örn: 9. Sınıf veya 11. Sınıf EA"
                value={newThreshold.grade_level}
                onChange={(e) => setNewThreshold({ ...newThreshold, grade_level: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', width: '220px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Minimum Baraj Puanı</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Örn: 350"
                value={newThreshold.min_score}
                onChange={(e) => setNewThreshold({ ...newThreshold, min_score: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', width: '160px' }}
              />
            </div>
            <button
              type="submit"
              style={{ padding: '0.55rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <FaSave /> {editingThreshold ? 'Güncelle' : 'Baraj Ekle'}
            </button>
            {editingThreshold && (
              <button
                type="button"
                onClick={() => {
                  setEditingThreshold(null);
                  setNewThreshold({ grade_level: '', min_score: '' });
                }}
                style={{ padding: '0.55rem 1rem', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                İptal
              </button>
            )}
          </form>

          {/* Baraj Listesi Tablosu */}
          <table style={{ width: '100%', maxWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Sınıf Seviyesi</th>
                <th style={{ padding: '10px' }}>Baraj Puanı</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {thresholds.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{t.grade_level}</td>
                  <td style={{ padding: '10px', color: '#2563eb', fontWeight: 'bold' }}>{t.min_score} Puan</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        setEditingThreshold(t);
                        setNewThreshold({ grade_level: t.grade_level, min_score: t.min_score });
                      }}
                      style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', marginRight: '0.5rem' }}
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDeleteThreshold(t.id)}
                      style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. İSİM / PERSONEL LİSTESİ SEKME BÖLÜMÜ */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>👥 Randevu Veren & Dönüş Sağlayan Yetkili İsim Listesi</h3>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            Aday formunda "Randevu Veren Kişi" ve "Dönüş Sağlayan Kişi" açılır menülerinde görünecek personel isimlerini buradan ekleyebilirsiniz.
          </p>

          <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              required
              placeholder="Yetkili Adı Soyadı (Örn: Hülya Hoca)"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', width: '280px' }}
            />
            <button
              type="submit"
              style={{ padding: '0.55rem 1.2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              İsim Ekle
            </button>
          </form>

          <table style={{ width: '100%', maxWidth: '500px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>Personel / Yetkili Adı</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Sil</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((st) => (
                <tr key={st.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontWeight: '500' }}>{st.name}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteStaff(st.id)}
                      style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Candidates;
