import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { FaPlus, FaTrash, FaEdit, FaEye } from 'react-icons/fa';

const Exams = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    type: 'academic',
    level: 'high',
    gradeLevels: [], // Çoklu seçim için dizi
    isMixed: false,
    sessionCount: 1,
    customHeader: '',
    customFooter: '',
  });

  // Seviyeye göre sınıf seçenekleri
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
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
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

  // Sınıf seviyesi checkbox değişimi
  const handleGradeChange = (grade) => {
    const current = formData.gradeLevels;
    const updated = current.includes(grade)
      ? current.filter((g) => g !== grade)
      : [...current, grade];
    setFormData({ ...formData, gradeLevels: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date || formData.gradeLevels.length === 0) {
      alert('Başlık, tarih ve en az bir sınıf seçmelisiniz.');
      return;
    }
    try {
      await addDoc(collection(db, 'exams'), {
        ...formData,
        createdAt: new Date(),
      });
      setShowForm(false);
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
      alert('Sınav başarıyla oluşturuldu.');
    } catch (error) {
      console.error('Sınav oluşturulamadı:', error);
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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>📋 Sınav Yönetimi</h2>
        <button
          onClick={() => setShowForm(!showForm)}
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
          <FaPlus /> Yeni Sınav
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
          <h4 style={{ marginTop: 0 }}>Yeni Sınav Oluştur</h4>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
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
              Kaydet
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1.5rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Sınav Listesi */}
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
        <thead style={{ background: '#f1f1f1' }}>
          <tr>
            <th>Başlık</th>
            <th>Tarih</th>
            <th>Tür</th>
            <th>Seviye</th>
            <th>Sınıflar</th>
            <th>Karma</th>
            <th>Oturum</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{exam.title}</td>
              <td>{exam.date}</td>
              <td>{exam.type}</td>
              <td>{exam.level === 'high' ? 'Lise' : 'Ortaokul'}</td>
              <td>{exam.gradeLevels?.join(', ') || '-'}</td>
              <td>{exam.isMixed ? 'Evet' : 'Hayır'}</td>
              <td>{exam.sessionCount}</td>
              <td>
                <button onClick={() => handleDelete(exam.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}>
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
          {exams.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1rem' }}>Henüz sınav eklenmemiş.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default Exams;