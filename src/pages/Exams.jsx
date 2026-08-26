import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaPlus, FaTrash, FaEdit } from 'react-icons/fa';

const Exams = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null); // Düzenlenen sınavın ID'si
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    type: 'academic',
    level: 'high',
    gradeLevels: [],
    isMixed: false,
    sessionCount: 1,
    customHeader: '',
    customFooter: '',
  });

  const gradeOptions = {
    high: [9, 10, 11, 12],
    middle: [5, 6, 7, 8],
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error('Sınavlar alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleGradeChange = (grade) => {
    const current = formData.gradeLevels;
    const updated = current.includes(grade)
      ? current.filter((g) => g !== grade)
      : [...current, grade];
    setFormData({ ...formData, gradeLevels: updated });
  };

  // Yeni Sınav Ekleme Modunu Aç
  const handleOpenNewForm = () => {
    setEditingExamId(null);
    setFormData({
      title: '',
      date: '',
      type: 'academic',
      level: 'high',
      gradeLevels: [],
      isMixed: false,
      sessionCount: 1,
      customHeader: '',
      customFooter: '',
    });
    setShowForm(true);
  };

  // Sınav Düzenleme Modunu Aç
  const handleEditClick = (exam) => {
    setEditingExamId(exam.id);
    setFormData({
      title: exam.title || '',
      date: exam.date || '',
      type: exam.type || 'academic',
      level: exam.level || 'high',
      gradeLevels: exam.grade_levels || exam.gradeLevels || [],
      isMixed: exam.is_mixed ?? exam.isMixed ?? false,
      sessionCount: exam.session_count || exam.sessionCount || 1,
      customHeader: exam.custom_header || exam.customHeader || '',
      customFooter: exam.custom_footer || exam.customFooter || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date || formData.gradeLevels.length === 0) {
      alert('Başlık, tarih ve en az bir sınıf seçmelisiniz.');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        date: formData.date,
        type: formData.type,
        level: formData.level,
        grade_levels: formData.gradeLevels,
        is_mixed: formData.isMixed,
        session_count: parseInt(formData.sessionCount),
        custom_header: formData.customHeader || '',
        custom_footer: formData.customFooter || '',
      };

      if (editingExamId) {
        // Güncelleme İşlemi (Update)
        const { error } = await supabase
          .from('exams')
          .update(payload)
          .eq('id', editingExamId);

        if (error) throw error;
        alert('Sınav başarıyla güncellendi.');
      } else {
        // Yeni Kayıt İşlemi (Insert)
        payload.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('exams')
          .insert(payload);

        if (error) throw error;
        alert('Sınav başarıyla oluşturuldu.');
      }

      setShowForm(false);
      setEditingExamId(null);
      setFormData({
        title: '',
        date: '',
        type: 'academic',
        level: 'high',
        gradeLevels: [],
        isMixed: false,
        sessionCount: 1,
        customHeader: '',
        customFooter: '',
      });
      fetchExams();
    } catch (error) {
      console.error('Sınav kaydedilemedi/güncellenemedi:', error);
      alert('Bir hata oluştu: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu sınavı silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchExams();
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>📋 Sınav Yönetimi</h2>
        <button
          onClick={() => (showForm ? setShowForm(false) : handleOpenNewForm())}
          style={{
            padding: '0.5rem 1rem',
            background: showForm ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <FaPlus /> {showForm ? 'Formu Kapat' : 'Yeni Sınav'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            border: '1px solid #e0e0e0',
          }}
        >
          <h4 style={{ marginTop: 0 }}>{editingExamId ? 'Sınavı Düzenle' : 'Yeni Sınav Oluştur'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1rem' }}>
            <div>
              <label>Sınav Başlığı</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Örn: TYT Deneme 1"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>
            <div>
              <label>Tarih</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>
            <div>
              <label>Tür</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="academic">Akademik</option>
                <option value="foreign_lang">Yabancı Dil</option>
                <option value="written">Yazılı</option>
              </select>
            </div>
            <div>
              <label>Seviye</label>
              <select
                name="level"
                value={formData.level}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="high">Lise (9-12)</option>
                <option value="middle">Ortaokul (5-8)</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Sınıf Seviyeleri (birden fazla seçebilirsiniz)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.3rem' }}>
                {gradeOptions[formData.level].map((grade) => (
                  <label key={grade} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.gradeLevels.includes(grade)}
                      onChange={() => handleGradeChange(grade)}
                    /> {grade}. Sınıf
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label>Oturum Sayısı</label>
              <select
                name="sessionCount"
                value={formData.sessionCount}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="1">1 Oturum</option>
                <option value="2">2 Oturum</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="isMixed"
                  checked={formData.isMixed}
                  onChange={handleChange}
                />
                Karma Yapılacak
              </label>
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" style={{ padding: '0.5rem 1.5rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              {editingExamId ? 'Değişiklikleri Kaydet' : 'Ekle'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingExamId(null); }} style={{ padding: '0.5rem 1.5rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              İptal
            </button>
          </div>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
        <thead style={{ background: '#f1f1f1' }}>
          <tr>
            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Başlık</th>
            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Tarih</th>
            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Tür</th>
            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Seviye</th>
            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Sınıflar</th>
            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Karma</th>
            <th style={{ padding: '0.7rem', textAlign: 'left' }}>Oturum</th>
            <th style={{ padding: '0.7rem', textAlign: 'center' }}>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.7rem' }}>{exam.title}</td>
              <td style={{ padding: '0.7rem' }}>{exam.date}</td>
              <td style={{ padding: '0.7rem' }}>{exam.type}</td>
              <td style={{ padding: '0.7rem' }}>{exam.level === 'high' ? 'Lise' : 'Ortaokul'}</td>
              <td style={{ padding: '0.7rem' }}>{(exam.grade_levels || exam.gradeLevels)?.join(', ') || '-'}</td>
              <td style={{ padding: '0.7rem' }}>{(exam.is_mixed ?? exam.isMixed) ? 'Evet' : 'Hayır'}</td>
              <td style={{ padding: '0.7rem' }}>{exam.session_count || exam.sessionCount}</td>
              <td style={{ padding: '0.7rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '0.8rem' }}>
                <button 
                  onClick={() => handleEditClick(exam)} 
                  title="Düzenle"
                  style={{ background: 'transparent', border: 'none', color: '#ffc107', cursor: 'pointer', fontSize: '1rem' }}
                >
                  <FaEdit />
                </button>
                <button 
                  onClick={() => handleDelete(exam.id)} 
                  title="Sil"
                  style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '1rem' }}
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
          {exams.length === 0 && (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#777' }}>
                Henüz sınav eklenmemiş.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Exams;