import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { FaSearch, FaUser, FaClock, FaTshirt, FaExclamationTriangle, FaSave } from 'react-icons/fa';

const DisciplineTracking = () => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(null); // 'late', 'dress', 'both'
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

  // Arama filtresi - ad, soyad, ad+soyad, okul no, tcNo
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(students);
    } else {
      const term = searchTerm.toLowerCase().trim();
      const filtered = students.filter((s) => {
        const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
        const fullNameReverse = `${s.lastName || ''} ${s.firstName || ''}`.toLowerCase();
        return (
          s.firstName?.toLowerCase().includes(term) ||
          s.lastName?.toLowerCase().includes(term) ||
          fullName.includes(term) ||
          fullNameReverse.includes(term) ||
          s.studentNo?.includes(term) ||
          s.tcNo?.includes(term)
        );
      });
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  // Bugünün istatistiklerini getir
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
    setSelectedType(null);
    setNote('');
    setMessage('');
  };

  const handleRecord = async () => {
    if (!selectedStudent) {
      setMessage('Lütfen bir öğrenci seçin.');
      return;
    }
    if (!selectedType) {
      setMessage('Lütfen bir durum seçin (Geç Kaldı / Kıyafet Uygunsuz / Her İkisi).');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'discipline'), {
        studentId: selectedStudent.id,
        studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
        class: selectedStudent.class,
        grade: selectedStudent.grade,
        type: selectedType,
        note: note || '',
        createdAt: new Date(),
      });
      setMessage(`${selectedStudent.firstName} ${selectedStudent.lastName} başarıyla kaydedildi.`);
      if (selectedType === 'late') setTodayStats((prev) => ({ ...prev, late: prev.late + 1 }));
      else if (selectedType === 'dress') setTodayStats((prev) => ({ ...prev, dress: prev.dress + 1 }));
      else if (selectedType === 'both') setTodayStats((prev) => ({ ...prev, both: prev.both + 1 }));
      setSelectedStudent(null);
      setSearchTerm('');
      setNote('');
      setSelectedType(null);
    } catch (error) {
      console.error('Kayıt hatası:', error);
      setMessage('Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <FaUser /> Öğrenci Ara ve Kayıt Gir
      </h2>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Ad, soyad veya öğrenci numarası ile arayın. Tarih ve saat otomatik kaydedilir.
      </p>

      {/* Bugünün İstatistikleri */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ padding: '0.5rem 1rem', background: '#fff3cd', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaClock color="#856404" /> Geç Kalan: <strong>{todayStats.late}</strong>
        </div>
        <div style={{ padding: '0.5rem 1rem', background: '#d1ecf1', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaTshirt color="#0c5460" /> Kıyafet Uygunsuz: <strong>{todayStats.dress}</strong>
        </div>
        <div style={{ padding: '0.5rem 1rem', background: '#f8d7da', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaExclamationTriangle color="#721c24" /> Her İkisi: <strong>{todayStats.both}</strong>
        </div>
      </div>

      {/* Arama Kutusu */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
        <input
          type="text"
          placeholder="Ad, soyad veya öğrenci numarası ile ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem 0.75rem 2.5rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '1rem',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#007bff')}
          onBlur={(e) => (e.target.style.borderColor = '#ddd')}
        />
      </div>

      {/* Öğrenci Listesi (filtrelenmiş) */}
      <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>#</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Ad Soyad</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Sınıf</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>No</th>
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
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedStudent?.id !== student.id) e.currentTarget.style.background = '#f1f1f1';
                }}
                onMouseLeave={(e) => {
                  if (selectedStudent?.id !== student.id) e.currentTarget.style.background = 'transparent';
                }}
              >
                <td style={{ padding: '0.75rem' }}>{index + 1}</td>
                <td style={{ padding: '0.75rem' }}>{student.firstName} {student.lastName}</td>
                <td style={{ padding: '0.75rem' }}>{student.grade}. Sınıf / Şube {student.class}</td>
                <td style={{ padding: '0.75rem' }}>{student.studentNo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredStudents.length === 0 && (
          <p style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>Öğrenci bulunamadı.</p>
        )}
      </div>

      {/* Seçili Öğrenci Bilgisi ve Butonlar */}
      {selectedStudent && (
        <div style={{ padding: '1.5rem', border: '1px solid #28a745', borderRadius: '8px', background: '#f8fff8', marginBottom: '1rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>
            {selectedStudent.firstName} {selectedStudent.lastName}
          </h4>
          <p style={{ color: '#555', marginBottom: '1rem' }}>
            No: {selectedStudent.studentNo} · {selectedStudent.grade}. Sınıf / Şube {selectedStudent.class}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              onClick={() => setSelectedType('late')}
              style={{
                padding: '0.5rem 1rem',
                background: selectedType === 'late' ? '#ffc107' : '#f8f9fa',
                border: selectedType === 'late' ? '2px solid #ffc107' : '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FaClock /> Geç Kaldı
            </button>
            <button
              onClick={() => setSelectedType('dress')}
              style={{
                padding: '0.5rem 1rem',
                background: selectedType === 'dress' ? '#17a2b8' : '#f8f9fa',
                color: selectedType === 'dress' ? 'white' : 'black',
                border: selectedType === 'dress' ? '2px solid #17a2b8' : '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FaTshirt /> Kıyafet Uygunsuz
            </button>
            <button
              onClick={() => setSelectedType('both')}
              style={{
                padding: '0.5rem 1rem',
                background: selectedType === 'both' ? '#dc3545' : '#f8f9fa',
                color: selectedType === 'both' ? 'white' : 'black',
                border: selectedType === 'both' ? '2px solid #dc3545' : '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FaExclamationTriangle /> Her İkisi
            </button>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>Not (opsiyonel):</label>
            <input
              type="text"
              placeholder="İsterseniz bu kayıtla ilgili bir not ekleyin..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '0.95rem',
              }}
            />
          </div>
          <button
            onClick={handleRecord}
            disabled={loading || !selectedType}
            style={{
              padding: '0.6rem 1.5rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: loading || !selectedType ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: loading || !selectedType ? 0.6 : 1,
            }}
          >
            <FaSave /> Kaydet
          </button>
        </div>
      )}

      {message && (
        <p style={{ marginTop: '1rem', color: message.includes('başarıyla') ? '#28a745' : '#dc3545' }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default DisciplineTracking;