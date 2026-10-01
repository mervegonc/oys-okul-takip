import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaSearch, FaTimes, FaSave, FaUndo, FaClock, FaSpinner } from 'react-icons/fa';

const DisciplineTracking = () => {
  const [allStudents, setAllStudents] = useState([]); // Hafızadaki tüm öğrenciler
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [note, setNote] = useState('');
  const [selectedTypes, setSelectedTypes] = useState({ late: false, dress: false });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [totalStudentCount, setTotalStudentCount] = useState(0);

  // 1. Sayfa açıldığı an sadece bir kez 9, 10, 11, 12. sınıf öğrencilerini çek ve hafızaya al
  useEffect(() => {
    const fetchStudentsAndCount = async () => {
      setLoadingStudents(true);
      try {
        // Toplam öğrenci sayısı (bilgi amaçlı)
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });
        setTotalStudentCount(count || 0);

        // Sadece 9, 10, 11, 12. sınıf öğrencilerini bir kerede çek (Sayfalama sınırına takılmamak için 2000 yaptık)
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .in('grade', [9, 10, 11, 12])
          .range(0, 2000);

        if (error) throw error;

        setAllStudents(data || []);
        console.log(`📊 [BİLGİ] 9-12 arası toplam ${data?.length || 0} öğrenci hafızaya yüklendi.`);
      } catch (err) {
        console.error('Öğrenciler yüklenemedi:', err);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudentsAndCount();
  }, []);

  // 2. Arama çubuğuna yazıldığında ANINDA hafızadan filtrele (Sunucuya istek atılmaz, çok hızlıdır)
  useEffect(() => {
    const term = searchTerm.trim().toLocaleLowerCase('tr-TR');
    
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    const words = term.split(/\s+/).filter(w => w.length > 0);

    // Hafızadaki liste üzerinden arama yap
    const filtered = allStudents.filter(student => {
      const fName = (student.first_name || '').toLocaleLowerCase('tr-TR');
      const lName = (student.last_name || '').toLocaleLowerCase('tr-TR');
      const sNo = (student.student_no || '').toString();
      const fullName = `${fName} ${lName}`;

      // Yazılan kelimelerin hepsi öğrenci adında/soyadında veya numarasında geçiyor mu?
      return words.every(word => 
        fullName.includes(word) || sNo.includes(word)
      );
    });

    // Bugün kayıt olup olmadığını kontrol etmek için async fonksiyon
    const checkTodayRecords = async (studentsList) => {
      if (studentsList.length === 0) {
        setSearchResults([]);
        return;
      }

      // Performans için sadece ilk 50 sonucu gösterelim
      const limitedList = studentsList.slice(0, 50);

      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const studentIds = limitedList.map(s => s.id);

        const { data: disciplineData } = await supabase
          .from('discipline')
          .select('student_id')
          .in('student_id', studentIds)
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString());

        const recordedIds = new Set((disciplineData || []).map(d => d.student_id));
        
        const enrichedStudents = limitedList.map(student => ({
          ...student,
          hasRecordedToday: recordedIds.has(student.id)
        }));

        setSearchResults(enrichedStudents);
      } catch (err) {
        setSearchResults(limitedList);
      }
    };

    checkTodayRecords(filtered);

  }, [searchTerm, allStudents]);

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
          placeholder={loadingStudents ? "Öğrenciler yükleniyor, lütfen bekleyin..." : "Aramak için öğrenci adı, soyadı veya okul no yazın..."}
          disabled={loadingStudents}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.8rem 2.5rem 0.8rem 1rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '1rem',
            background: loadingStudents ? '#f9f9f9' : '#fff'
          }}
        />
        {loadingStudents ? (
          <FaSpinner style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#007bff', animation: 'spin 1s linear infinite' }} />
        ) : (
          <FaSearch style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
        )}
      </div>

      <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem', textAlign: 'right' }}>
        Sistemdeki Toplam Öğrenci: <strong>{totalStudentCount}</strong> (9-12. Sınıflar Hazır)
      </div>

      {message && !selectedStudent && (
        <p style={{ marginTop: '0.5rem', marginBottom: '1rem', color: message.includes('⚠️') ? '#d9534f' : 'green', fontWeight: '500' }}>
          {message}
        </p>
      )}

      {searchTerm.trim().length >= 2 && searchResults.length === 0 && !loadingStudents && !selectedStudent && (
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
