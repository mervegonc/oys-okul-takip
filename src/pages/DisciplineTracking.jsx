import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaSearch, FaTimes, FaSave, FaUndo, FaClock } from 'react-icons/fa';

const DisciplineTracking = () => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [note, setNote] = useState('');
  const [selectedTypes, setSelectedTypes] = useState({ late: false, dress: false });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*');
        if (error) throw error;
        setStudents(data || []);
        setFilteredStudents(data || []);
      } catch (error) {
        console.error('Öğrenciler alınamadı:', error);
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(students);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = students.filter(
        (s) =>
          s.first_name?.toLowerCase().includes(term) ||
          s.last_name?.toLowerCase().includes(term) ||
          s.student_no?.includes(term) ||
          s.tc_no?.includes(term)
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setNote('');
    setSelectedTypes({ late: false, dress: false });
    setMessage('');
  };

  const handleClosePanel = () => {
    setSelectedStudent(null);
    setNote('');
    setSelectedTypes({ late: false, dress: false });
  };

  const handleSave = async () => {
    if (!selectedStudent) {
      setMessage('Lütfen bir öğrenci seçin.');
      return;
    }
    if (!selectedTypes.late && !selectedTypes.dress) {
      setMessage('En az bir işlem seçin.');
      return;
    }

    setLoading(true);
    try {
      const types = [];
      if (selectedTypes.late) types.push('late');
      if (selectedTypes.dress) types.push('dress');
      const type = types.length === 2 ? 'both' : types[0];

      const { error } = await supabase
        .from('discipline')
        .insert({
          student_id: selectedStudent.id,
          student_name: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
          class: selectedStudent.class,
          grade: selectedStudent.grade,
          type: type,
          note: note || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setMessage(`${selectedStudent.first_name} ${selectedStudent.last_name} kaydedildi.`);
      handleClosePanel();
      setSearchTerm('');
    } catch (error) {
      console.error('Kayıt hatası:', error);
      setMessage('Bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <FaClock /> Geç Kalma / Kıyafet Kaydı
      </h2>

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
              <span><strong>{student.first_name} {student.last_name}</strong></span>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                No: {student.student_no} - {student.grade}. Sınıf / {student.class}
              </span>
            </div>
          ))}
        </div>
      )}

      {selectedStudent && (
        <div style={{
          padding: '1.5rem',
          border: '1px solid #007bff',
          borderRadius: '12px',
          background: '#f8fcff',
          marginBottom: '1rem',
          position: 'relative',
        }}>
          <button onClick={handleClosePanel} style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            background: 'transparent',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#999',
          }}>
            <FaTimes />
          </button>

          <h3 style={{ marginTop: 0 }}>{selectedStudent.first_name} {selectedStudent.last_name}</h3>
          <p style={{ margin: '0.2rem 0', color: '#555' }}>
            No: {selectedStudent.student_no} · {selectedStudent.grade}. Sınıf / {selectedStudent.class}
          </p>

          <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input type="checkbox" checked={selectedTypes.late} onChange={(e) => setSelectedTypes({ ...selectedTypes, late: e.target.checked })} />
              Geç Kaldı
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input type="checkbox" checked={selectedTypes.dress} onChange={(e) => setSelectedTypes({ ...selectedTypes, dress: e.target.checked })} />
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
            <button onClick={handleSave} disabled={loading} style={{
              padding: '0.5rem 1.5rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}>
              <FaSave /> Kaydet
            </button>
            <button onClick={handleClosePanel} style={{
              padding: '0.5rem 1.5rem',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}>
              <FaUndo /> İptal
            </button>
          </div>

          {message && <p style={{ marginTop: '0.5rem', color: message.includes('hata') ? 'red' : 'green' }}>{message}</p>}
        </div>
      )}
    </div>
  );
};

export default DisciplineTracking;