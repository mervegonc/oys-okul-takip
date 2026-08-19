import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaPlus, FaTrash, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const Exams = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    date: '',
    type: 'academic',
    level: 'high',
    sessionCount: 1,
    isMixed: false,
    gradeLevels: [],
  });

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'exams'));
      const data = [];
      querySnapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setExams(data);
    } catch (error) {
      console.error('Sınavlar alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'exams', editingId), form);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'exams'), { ...form, createdAt: new Date() });
      }
      setForm({ title: '', date: '', type: 'academic', level: 'high', sessionCount: 1, isMixed: false, gradeLevels: [] });
      fetchExams();
    } catch (error) {
      console.error('Sınav kaydedilemedi:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu sınavı silmek istediğinize emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'exams', id));
        fetchExams();
      } catch (error) {
        console.error('Silme hatası:', error);
      }
    }
  };

  const handleEdit = (exam) => {
    setEditingId(exam.id);
    setForm({
      title: exam.title,
      date: exam.date,
      type: exam.type,
      level: exam.level,
      sessionCount: exam.sessionCount,
      isMixed: exam.isMixed,
      gradeLevels: exam.gradeLevels || [],
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>📋 Sınav Yönetimi</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1rem' }}>
          <input name="title" placeholder="Sınav Başlığı" value={form.title} onChange={handleChange} required />
          <input name="date" type="date" value={form.date} onChange={handleChange} required />
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="academic">Akademik</option>
            <option value="foreign_lang">Yabancı Dil</option>
            <option value="written">Yazılı</option>
          </select>
          <select name="level" value={form.level} onChange={handleChange}>
            <option value="high">Lise</option>
            <option value="middle">Ortaokul</option>
          </select>
          <input name="sessionCount" type="number" placeholder="Oturum Sayısı" value={form.sessionCount} onChange={handleChange} min="1" max="2" />
          <label>
            <input name="isMixed" type="checkbox" checked={form.isMixed} onChange={handleChange} /> Karma
          </label>
        </div>
        <button type="submit" style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
          {editingId ? <><FaSave /> Güncelle</> : <><FaPlus /> Ekle</>}
        </button>
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setForm({ title: '', date: '', type: 'academic', level: 'high', sessionCount: 1, isMixed: false, gradeLevels: [] }); }} style={{ marginLeft: '0.5rem', padding: '0.5rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}>
            <FaTimes /> İptal
          </button>
        )}
      </form>

      {/* Liste */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f1f1f1' }}>
          <tr>
            <th>Başlık</th><th>Tarih</th><th>Tür</th><th>Seviye</th><th>Oturum</th><th>Karma</th><th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{exam.title}</td><td>{exam.date}</td><td>{exam.type}</td><td>{exam.level}</td>
              <td>{exam.sessionCount}</td><td>{exam.isMixed ? 'Evet' : 'Hayır'}</td>
              <td>
                <button onClick={() => handleEdit(exam)} style={{ background: 'transparent', border: 'none', color: '#ffc107', cursor: 'pointer', marginRight: '0.5rem' }}><FaEdit /></button>
                <button onClick={() => handleDelete(exam.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}><FaTrash /></button>
              </td>
            </tr>
          ))}
          {exams.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1rem' }}>Henüz sınav eklenmemiş.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default Exams;