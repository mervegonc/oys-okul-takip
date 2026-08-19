import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

const DisciplineTracking = () => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayStats, setTodayStats] = useState({ late: 0, dress: 0, both: 0 });

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

  // Bugünün istatistiklerini getir (basitçe sayfalama için son 100 kayıt)
  useEffect(() => {
    const fetchTodayStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const q = query(collection(db, 'discipline'), orderBy('createdAt', 'desc'), limit(100));
        const querySnapshot = await getDocs(q);
        let late = 0,
          dress = 0,
          both = 0;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const date = data.createdAt?.toDate?.() || new Date(data.createdAt);
          if (date >= today) {
            if (data.type === 'late') late++;
            else if (data.type === 'dress') dress++;
            else if (data.type === 'both') both++;
          }
        });
        setTodayStats({ late, dress, both });
      } catch (error) {
        console.error('İstatistik alınamadı:', error);
      }
    };
    fetchTodayStats();
  }, []);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setNote('');
    setMessage('');
  };

  const handleRecord = async (type) => {
    if (!selectedStudent) {
      setMessage('Lütfen bir öğrenci seçin.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'discipline'), {
        studentId: selectedStudent.id,
        studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
        class: selectedStudent.class,
        grade: selectedStudent.grade,
        type: type,
        note: note || '',
        createdAt: new Date(),
      });
      setMessage(`${selectedStudent.firstName} ${selectedStudent.lastName} kaydedildi.`);
      // İstatistikleri güncelle
      if (type === 'late') setTodayStats((prev) => ({ ...prev, late: prev.late + 1 }));
      else if (type === 'dress') setTodayStats((prev) => ({ ...prev, dress: prev.dress + 1 }));
      else if (type === 'both') setTodayStats((prev) => ({ ...prev, both: prev.both + 1 }));
      setSelectedStudent(null);
      setSearchTerm('');
      setNote('');
    } catch (error) {
      console.error('Kayıt hatası:', error);
      setMessage('Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2>⏰ Geç Kalma / Kıyafet Takibi</h2>

      {/* Bugünün İstatistikleri */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ padding: '0.5rem 1rem', background: '#ffc107', borderRadius: '8px' }}>
          ⏰ Geç Kalan: {todayStats.late}
        </div>
        <div style={{ padding: '0.5rem 1rem', background: '#17a2b8', borderRadius: '8px' }}>
          👔 Kıyafet Uygunsuz: {todayStats.dress}
        </div>
        <div style={{ padding: '0.5rem 1rem', background: '#dc3545', borderRadius: '8px', color: 'white' }}>
          ⚠️ Her İkisi: {todayStats.both}
        </div>
      </div>

      {/* Arama Kutusu */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Öğrenci ara (ad, soyad, okul no, TC)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      </div>

      {/* Öğrenci Listesi (filtrelenmiş) */}
      <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f1f1f1', position: 'sticky', top: 0 }}>
            <tr>
              <th style={{ padding: '0.5rem' }}>#</th>
              <th style={{ padding: '0.5rem' }}>Ad Soyad</th>
              <th style={{ padding: '0.5rem' }}>Sınıf</th>
              <th style={{ padding: '0.5rem' }}>No</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <tr
                key={student.id}
                onClick={() => handleSelectStudent(student)}
                style={{
                  cursor: 'pointer',
                  background: selectedStudent?.id === student.id ? '#e3f2fd' : 'transparent',
                  borderBottom: '1px solid #eee',
                }}
              >
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ padding: '0.5rem' }}>{student.firstName} {student.lastName}</td>
                <td style={{ padding: '0.5rem' }}>{student.grade}-{student.class}</td>
                <td style={{ padding: '0.5rem' }}>{student.studentNo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredStudents.length === 0 && <p style={{ padding: '1rem' }}>Öğrenci bulunamadı.</p>}
      </div>

      {/* Seçili Öğrenci Bilgisi ve Butonlar */}
      {selectedStudent && (
        <div style={{ padding: '1rem', border: '1px solid #28a745', borderRadius: '8px', background: '#f8fff8' }}>
          <h4>Seçili Öğrenci: {selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.grade}-{selectedStudent.class})</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button
              onClick={() => handleRecord('late')}
              disabled={loading}
              style={{ padding: '0.5rem 1rem', background: '#ffc107', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              ⏰ Geç Kaldı
            </button>
            <button
              onClick={() => handleRecord('dress')}
              disabled={loading}
              style={{ padding: '0.5rem 1rem', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              👔 Kıyafet Uygunsuz
            </button>
            <button
              onClick={() => handleRecord('both')}
              disabled={loading}
              style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              ⚠️ Her İkisi
            </button>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <input
              type="text"
              placeholder="Not (isteğe bağlı)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>
      )}

      {message && <p style={{ marginTop: '1rem', color: message.includes('hata') ? 'red' : 'green' }}>{message}</p>}
    </div>
  );
};

export default DisciplineTracking;