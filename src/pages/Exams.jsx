import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { FaPlus, FaTrash, FaEdit, FaEye, FaTimes } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';

const Exams = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
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
      const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setExams(data);
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

  const resetForm = () => {
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
    setEditingExam(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date || formData.gradeLevels.length === 0) {
      alert('Başlık, tarih ve en az bir sınıf seçmelisiniz.');
      return;
    }
    try {
      if (editingExam) {
        // Güncelleme
        await updateDoc(doc(db, 'exams', editingExam.id), {
          ...formData,
          updatedAt: new Date(),
        });
        alert('Sınav güncellendi.');
      } else {
        // Yeni sınav
        await addDoc(collection(db, 'exams'), {
          ...formData,
          createdBy: user?.email,
          createdAt: new Date(),
        });
        alert('Sınav başarıyla oluşturuldu.');
      }
      resetForm();
      fetchExams();
    } catch (error) {
      console.error('Sınav kaydedilemedi:', error);
      alert('Bir hata oluştu.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu sınavı silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'exams', id));
      fetchExams();
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  const handleEdit = (exam) => {
    setEditingExam(exam);
    setFormData({
      title: exam.title || '',
      date: exam.date || '',
      type: exam.type || 'academic',
      level: exam.level || 'high',
      gradeLevels: exam.gradeLevels || [],
      isMixed: exam.isMixed || false,
      sessionCount: exam.sessionCount || 1,
      customHeader: exam.customHeader || '',
      customFooter: exam.customFooter || '',
    });
    setShowForm(true);
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Sınav Yönetimi
        </h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          style={{
            padding: '0.5rem 1rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <FaPlus /> {showForm ? 'Kapat' : 'Yeni Sınav'}
        </button>
      </div>

      {/* Yeni Sınav / Düzenleme Formu */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0 }}>{editingExam ? 'Sınav Düzenle' : 'Yeni Sınav Oluştur'}</h4>
            <button type="button" onClick={resetForm} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
              <FaTimes />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500' }}>Sınav Başlığı *</label>
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
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500' }}>Tarih *</label>
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
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500' }}>Sınav Türü</label>
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
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500' }}>Seviye</label>
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
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500' }}>Oturum Sayısı</label>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                <input
                  type="checkbox"
                  name="isMixed"
                  checked={formData.isMixed}
                  onChange={handleChange}
                />
                Karma Yap
              </label>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500' }}>Katılacak Sınıflar *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {gradeOptions[formData.level].map((grade) => (
                <label key={grade} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.gradeLevels.includes(grade)}
                    onChange={() => handleGradeChange(grade)}
                  /> {grade}. Sınıf
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500' }}>Özel Başlık (Opsiyonel)</label>
              <input
                type="text"
                name="customHeader"
                value={formData.customHeader}
                onChange={handleChange}
                placeholder="Sınav üst bilgisi"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500' }}>Özel Alt Bilgi (Opsiyonel)</label>
              <input
                type="text"
                name="customFooter"
                value={formData.customFooter}
                onChange={handleChange}
                placeholder="Sınav alt bilgisi"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              style={{
                padding: '0.5rem 1.5rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {editingExam ? 'Güncelle' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Sınav Listesi */}
      <div style={{ marginTop: '1rem' }}>
        {exams.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>Henüz sınav oluşturulmamış.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: '1rem' }}>
            {exams.map((exam) => (
              <div
                key={exam.id}
                style={{
                  background: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '1rem' }}>{exam.title}</h4>
                    <div style={{ fontSize: '0.9rem', color: '#555' }}>
                      <span>📅 {exam.date}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '0.3rem' }}>
                      <span>Tür: {exam.type === 'academic' ? 'Akademik' : exam.type === 'foreign_lang' ? 'Yabancı Dil' : 'Yazılı'}</span>
                      <span style={{ marginLeft: '0.5rem' }}>| {exam.level === 'high' ? 'Lise' : 'Ortaokul'}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '0.2rem' }}>
                      <span>Sınıflar: {exam.gradeLevels?.sort().join(', ')}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#777', marginTop: '0.2rem' }}>
                      <span>Oturum: {exam.sessionCount}</span>
                      <span style={{ marginLeft: '0.5rem' }}>| {exam.isMixed ? 'Karma' : 'Karma Yok'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button
                      onClick={() => handleEdit(exam)}
                      style={{ background: 'transparent', border: 'none', color: '#ffc107', cursor: 'pointer' }}
                      title="Düzenle"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}
                      title="Sil"
                    >
                      <FaTrash />
                    </button>
                    <button
                      style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer' }}
                      title="Detay"
                    >
                      <FaEye />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Exams;