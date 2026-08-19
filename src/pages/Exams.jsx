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

      // src/pages/Exams.jsx - sadece form kısmı
<form>
  <input type="text" placeholder="Sınav Başlığı" />
  <input type="date" />
  <select>
    <option>Akademik</option>
    <option>Yabancı Dil</option>
    <option>Yazılı</option>
  </select>
  <select>
    <option>Lise (9-12)</option>
    <option>Ortaokul (5-8)</option>
  </select>
  <select multiple>
    <option>9</option>
    <option>10</option>
    <option>11</option>
    <option>12</option>
  </select>
  <select>
    <option>Karma Yap</option>
    <option>Karma Yapma</option>
  </select>
  <input type="number" placeholder="Oturum Sayısı (1 veya 2)" />
  <button type="submit">Sınav Oluştur</button>
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