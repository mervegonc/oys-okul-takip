import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { FaSearch, FaTimes, FaEdit, FaTrash, FaSave, FaUndo } from 'react-icons/fa';
import './DisciplineTracking.css'; // İstersen CSS dosyası oluştur

const DisciplineTracking = () => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [note, setNote] = useState('');
  const [selectedTypes, setSelectedTypes] = useState({ late: false, dress: false });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);

  // Tüm öğrencileri getir
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'students'));
        const data = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        setStudents(data);
        setFilteredStudents(data);
      } catch (error) {
        console.error('Öğrenciler alınamadı:', error);
      }
    };
    fetchStudents();
  }, []);

  // Kayıtları getir (bugünün)
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfDay = Timestamp.fromDate(today);
        const q = query(
          collection(db, 'discipline'),
          where('createdAt', '>=', startOfDay),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        setRecords(data);
      } catch (error) {
        console.error('Kayıtlar alınamadı:', error);
      }
    };
    fetchRecords();
  }, []);

  // Arama filtresi
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(students);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = students.filter(
        (s) =>
          s.firstName?.toLowerCase().includes(term) ||
          s.lastName?.toLowerCase().includes(term) ||
          s.studentNo?.includes(term) ||
          s.tcNo?.includes(term)
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setNote('');
    setSelectedTypes({ late: false, dress: false });
    setMessage('');
    setEditingRecord(null);
  };

  const handleClosePanel = () => {
    setSelectedStudent(null);
    setNote('');
    setSelectedTypes({ late: false, dress: false });
    setEditingRecord(null);
  };

  const handleSave = async () => {
    if (!selectedStudent) {
      setMessage('Lütfen bir öğrenci seçin.');
      return;
    }
    if (!selectedTypes.late && !selectedTypes.dress) {
      setMessage('En az bir işlem seçin (Geç Kaldı / Kıyafet Uygunsuz).');
      return;
    }

    setLoading(true);
    try {
      const types = [];
      if (selectedTypes.late) types.push('late');
      if (selectedTypes.dress) types.push('dress');
      const type = types.length === 2 ? 'both' : types[0];

      await addDoc(collection(db, 'discipline'), {
        studentId: selectedStudent.id,
        studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
        class: selectedStudent.class,
        grade: selectedStudent.grade,
        type: type,
        note: note || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      setMessage(`${selectedStudent.firstName} ${selectedStudent.lastName} kaydedildi.`);
      // Kayıtları yeniden getir
      const q = query(collection(db, 'discipline'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setRecords(data);

      // Paneli kapat
      handleClosePanel();
      setSearchTerm('');
    } catch (error) {
      console.error('Kayıt hatası:', error);
      setMessage('Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setSelectedStudent({
      id: record.studentId,
      firstName: record.studentName.split(' ')[0],
      lastName: record.studentName.split(' ').slice(1).join(' '),
      class: record.class,
      grade: record.grade,
    });
    setNote(record.note || '');
    setSelectedTypes({
      late: record.type === 'late' || record.type === 'both',
      dress: record.type === 'dress' || record.type === 'both',
    });
  };

  const handleUpdate = async () => {
    if (!editingRecord) return;
    setLoading(true);
    try {
      const types = [];
      if (selectedTypes.late) types.push('late');
      if (selectedTypes.dress) types.push('dress');
      const type = types.length === 2 ? 'both' : types[0];

      await updateDoc(doc(db, 'discipline', editingRecord.id), {
        type: type,
        note: note || '',
        updatedAt: new Date(),
      });

      setMessage('Kayıt güncellendi.');
      // Kayıtları yeniden getir
      const q = query(collection(db, 'discipline'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setRecords(data);

      handleClosePanel();
      setSearchTerm('');
    } catch (error) {
      console.error('Güncelleme hatası:', error);
      setMessage('Güncelleme sırasında hata oluştu.');
    } finally {
      setLoading(false);
      setEditingRecord(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'discipline', id));
      setRecords(records.filter((r) => r.id !== id));
      setMessage('Kayıt silindi.');
    } catch (error) {
      console.error('Silme hatası:', error);
      setMessage('Silme sırasında hata oluştu.');
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>⏱️ Geç Kalma / Kıyafet Takibi</h2>

      {/* Arama Çubuğu */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Öğrenci ad, soyad veya numarası..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.8rem 2.5rem 0.8rem 1rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '1rem',
          }}
        />
        <FaSearch style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
      </div>

      {/* Öğrenci Listesi (arama sonuçları) */}
      {searchTerm && filteredStudents.length > 0 && !selectedStudent && (
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1rem' }}>
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              onClick={() => handleSelectStudent(student)}
              style={{
                padding: '0.6rem 1rem',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>
                <strong>{student.firstName} {student.lastName}</strong>
              </span>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                No: {student.studentNo} - {student.grade}. Sınıf / Şube {student.class}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Seçili Öğrenci Paneli */}
      {selectedStudent && (
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #007bff',
            borderRadius: '12px',
            background: '#f8fcff',
            marginBottom: '1rem',
            position: 'relative',
          }}
        >
          <button
            onClick={handleClosePanel}
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#999',
            }}
          >
            <FaTimes />
          </button>

          <h3 style={{ marginTop: 0 }}>
            {selectedStudent.firstName} {selectedStudent.lastName}
          </h3>
          <p style={{ margin: '0.2rem 0', color: '#555' }}>
            No: {selectedStudent.studentNo} · {selectedStudent.grade}. Sınıf / Şube {selectedStudent.class}
          </p>

          <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input
                type="checkbox"
                checked={selectedTypes.late}
                onChange={(e) => setSelectedTypes({ ...selectedTypes, late: e.target.checked })}
              />
              Geç Kaldı
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input
                type="checkbox"
                checked={selectedTypes.dress}
                onChange={(e) => setSelectedTypes({ ...selectedTypes, dress: e.target.checked })}
              />
              Kıyafet Uygunsuz
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Not (opsiyonel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={editingRecord ? handleUpdate : handleSave}
              disabled={loading}
              style={{
                padding: '0.5rem 1.5rem',
                background: editingRecord ? '#ffc107' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              {editingRecord ? <FaSave /> : <FaSave />} {editingRecord ? 'Güncelle' : 'Kaydet'}
            </button>
            <button
              onClick={handleClosePanel}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <FaUndo /> İptal
            </button>
          </div>

          {message && <p style={{ marginTop: '0.5rem', color: message.includes('hata') ? 'red' : 'green' }}>{message}</p>}
        </div>
      )}

      {/* Kayıt Listesi (Bugün) */}
      <div style={{ marginTop: '2rem' }}>
        <h4>📋 Bugünkü Kayıtlar</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f1f1f1' }}>
            <tr>
              <th style={{ padding: '0.5rem' }}>Öğrenci</th>
              <th style={{ padding: '0.5rem' }}>Sınıf</th>
              <th style={{ padding: '0.5rem' }}>Tür</th>
              <th style={{ padding: '0.5rem' }}>Not</th>
              <th style={{ padding: '0.5rem' }}>Saat</th>
              <th style={{ padding: '0.5rem' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{record.studentName}</td>
                <td style={{ padding: '0.5rem' }}>{record.grade}-{record.class}</td>
                <td style={{ padding: '0.5rem' }}>
                  {record.type === 'late' && '⏰ Geç'}
                  {record.type === 'dress' && '👔 Kıyafet'}
                  {record.type === 'both' && '⚠️ Her İkisi'}
                </td>
                <td style={{ padding: '0.5rem' }}>{record.note || '-'}</td>
                <td style={{ padding: '0.5rem' }}>
                  {record.createdAt?.toDate?.()?.toLocaleTimeString('tr-TR') || ''}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <button
                    onClick={() => handleEdit(record)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffc107',
                      cursor: 'pointer',
                      marginRight: '0.5rem',
                    }}
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                    }}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <p style={{ textAlign: 'center', color: '#666' }}>Henüz bugün kayıt yok.</p>}
      </div>
    </div>
  );
};

export default DisciplineTracking;