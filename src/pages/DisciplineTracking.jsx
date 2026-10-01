import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaSearch, FaTimes, FaSave, FaUndo, FaClock, FaSpinner } from 'react-icons/fa';

const DisciplineTracking = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [note, setNote] = useState('');
  const [selectedTypes, setSelectedTypes] = useState({ late: false, dress: false });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [totalStudentCount, setTotalStudentCount] = useState(0);

  // 1. Veritabanındaki TOPLAM öğrenci sayısını ilk açılışta çek ve konsola yaz
  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const { count, error } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });

        if (error) throw error;

        setTotalStudentCount(count || 0);
        console.log(`📊 [VERİTABANI DURUMU] Toplam ${count || 0} öğrenci kayıtlı.`);
      } catch (err) {
        console.error('Toplam öğrenci sayısı alınamadı:', err);
      }
    };

    fetchTotalCount();
  }, []);

  // 2. Server-Side Çoklu İsim ve Parçalı Kelime Arama + Sadece 9, 10, 11, 12. Sınıflar
  useEffect(() => {
    const searchStudents = async () => {
      const term = searchTerm.trim();
      
      if (term.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const words = term.split(/\s+/).filter(w => w.length > 0);

        // Sadece 9, 10, 11 ve 12. sınıflar aranacak şekilde filtre eklendi
        let query = supabase
          .from('students')
          .select('*')
          .in('grade', [9, 10, 11, 12]);

        words.forEach((word) => {
          const original = word;
          const upperTr = word.toLocaleUpperCase('tr-TR');
          const lowerTr = word.toLocaleLowerCase('tr-TR');
          const alt = original
            .replace(/i/g, 'İ')
            .replace(/ı/g, 'I')
            .replace(/I/g, 'ı')
            .replace(/İ/g, 'i');

          const wordSearchPattern = [
            `first_name.ilike.%${original}%`,
            `first_name.ilike.%${upperTr}%`,
            `first_name.ilike.%${lowerTr}%`,
            `first_name.ilike.%${alt}%`,
            `last_name.ilike.%${original}%`,
            `last_name.ilike.%${upperTr}%`,
            `last_name.ilike.%${lowerTr}%`,
            `last_name.ilike.%${alt}%`,
            `student_no.ilike.%${original}%`
          ].join(',');

          query = query.or(wordSearchPattern);
        });

        const { data: studentsData, error } = await query.limit(100);

        if (error) throw error;

        // Öğrenciler geldikten sonra bugün bu öğrencilerin disiplin kaydı olup olmadığını kontrol edelim
        if (studentsData && studentsData.length > 0) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);

          const studentIds = studentsData.map(s => s.id);

          const { data: disciplineData, error: discError } = await supabase
            .from('discipline')
            .select('student_id')
            .in('student_id', studentIds)
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString());

          if (!discError && disciplineData) {
            const recordedIds = new Set(disciplineData.map(d => d.student_id));
            const enrichedStudents = studentsData.map(student => ({
              ...student,
              hasRecordedToday: recordedIds.has(student.id)
            }));
            setSearchResults(enrichedStudents);
          } else {
            setSearchResults(studentsData);
          }
        } else {
          setSearchResults([]);
        }

      } catch (error) {
        console.error('Öğrenci arama hatası:', error);
      } finally {
        setSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      searchStudents();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSelectStudent = (student) => {
    if (student.hasRecordedToday) {
      setMessage(`⚠️ Bu öğrenci (${student.first_name} ${student.last_name}) için bugün zaten kayıt girilmiş!`);
      return;
    }
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

      setMessage(`${selectedStudent.first_name} ${selectedStudent.last_name} başarıyla kaydedildi.`);
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

      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
        <input
          type="text"
          placeholder="Aramak için öğrenci adı, soyadı veya okul no yazın (Sadece 9, 10, 11, 12)..."
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
        {searching ? (
          <FaSpinner style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#007bff', animation: 'spin 1s linear infinite' }} />
        ) : (
          <FaSearch style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
        )}
      </div>

      <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem', textAlign: 'right' }}>
        Sistemdeki Toplam Öğrenci: <strong>{totalStudentCount}</strong>
      </div>

      {message && !selectedStudent && (
        <p style={{ marginTop: '0.5rem', marginBottom: '1rem', color: message.includes('⚠️') ? '#d9534f' : 'green', fontWeight: '500' }}>
          {message}
        </p>
      )}

      {searchTerm.trim().length >= 2 && searchResults.length === 0 && !searching && !selectedStudent && (
        <p style={{ color: '#888', fontStyle: 'italic' }}>Öğrenci bulunamadı.</p>
      )}

      {searchResults.length > 0 && !selectedStudent && (
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1rem' }}>
          {searchResults.map((student) => (
            <div
              key={student.id}
              onClick={() => handleSelectStudent(student)}
              style={{
                padding: '0.6rem 1rem',
                borderBottom: '1px solid #eee',
                cursor: student.hasRecordedToday ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: student.hasRecordedToday ? '#fcf8e3' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!student.hasRecordedToday) e.currentTarget.style.background = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = student.hasRecordedToday ? '#fcf8e3' : 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: student.hasRecordedToday ? '#8a6d3b' : 'inherit' }}>
                  <strong>{student.first_name} {student.last_name}</strong>
                </span>
                {student.hasRecordedToday && (
                  <span style={{ fontSize: '0.75rem', background: '#f0ad4e', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>
                    ⚠️ Bugün Kaydedildi
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.9rem', color: student.hasRecordedToday ? '#8a6d3b' : '#666' }}>
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
