import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import ExcelUpload from '../components/ExcelUpload';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStudent, setNewStudent] = useState({
    firstName: '',
    lastName: '',
    grade: '',
    class: '',
    studentNo: '',
    tcNo: '',
    phone: '',
    parentPhone: '',
    parentPhone2: '',
    field: '',
    secondLang: 'None',
    gender: '',
    englishLevel: 'Core',
  });

  // Öğrencileri Firestore'dan çek
  const fetchStudents = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'students'));
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setStudents(data);
    } catch (error) {
      console.error('Öğrenciler alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Yeni öğrenci ekle
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.firstName || !newStudent.lastName) {
      alert('Ad ve soyad zorunludur.');
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'students'), {
        ...newStudent,
        createdAt: new Date(),
      });
      setStudents([...students, { id: docRef.id, ...newStudent }]);
      setNewStudent({
        firstName: '',
        lastName: '',
        grade: '',
        class: '',
        studentNo: '',
        tcNo: '',
        phone: '',
        parentPhone: '',
        parentPhone2: '',
        field: '',
        secondLang: 'None',
        gender: '',
        englishLevel: 'Core',
      });
      alert('Öğrenci başarıyla eklendi!');
    } catch (error) {
      console.error('Öğrenci eklenirken hata:', error);
      alert('Bir hata oluştu.');
    }
  };

  // Öğrenci sil
  const handleDelete = async (id) => {
    if (window.confirm('Bu öğrenciyi silmek istediğinizden emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'students', id));
        setStudents(students.filter((s) => s.id !== id));
      } catch (error) {
        console.error('Silme hatası:', error);
      }
    }
  };

  // Seviyelere göre öğrenci sayısını hesapla
  const getGradeStats = () => {
    const stats = {};
    students.forEach((s) => {
      const grade = s.grade || 'Belirsiz';
      stats[grade] = (stats[grade] || 0) + 1;
    });
    return stats;
  };

  const gradeStats = getGradeStats();

  if (loading) return <div>Öğrenciler yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>👨‍🎓 Öğrenci Yönetimi</h2>

      {/* Excel Yükleme Bileşeni */}
      <ExcelUpload onUploadComplete={fetchStudents} />

      {/* İstatistik Kartları */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', margin: '1rem 0', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd' }}>
        <div style={{ fontWeight: 'bold', marginRight: '1rem' }}>
          Toplam Öğrenci: <span style={{ color: '#007bff' }}>{students.length}</span>
        </div>
        {Object.keys(gradeStats).sort().map((grade) => (
          <div key={grade} style={{ background: '#e9ecef', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>
            {grade}. Sınıf: <strong>{gradeStats[grade]}</strong>
          </div>
        ))}
      </div>

      {/* Yeni Öğrenci Ekleme Formu */}
      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h3>Yeni Öğrenci Ekle</h3>
        <form onSubmit={handleAddStudent} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <input type="text" placeholder="Ad" value={newStudent.firstName} onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Soyad" value={newStudent.lastName} onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Sınıf (örn: 10)" value={newStudent.grade} onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Şube (örn: C)" value={newStudent.class} onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Öğrenci No" value={newStudent.studentNo} onChange={(e) => setNewStudent({ ...newStudent, studentNo: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="TC Kimlik No" value={newStudent.tcNo} onChange={(e) => setNewStudent({ ...newStudent, tcNo: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Telefon" value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Veli Tel 1" value={newStudent.parentPhone} onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Veli Tel 2" value={newStudent.parentPhone2} onChange={(e) => setNewStudent({ ...newStudent, parentPhone2: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Öğrenim Alanı" value={newStudent.field} onChange={(e) => setNewStudent({ ...newStudent, field: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <input type="text" placeholder="Cinsiyet" value={newStudent.gender} onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }} />
          <select value={newStudent.secondLang} onChange={(e) => setNewStudent({ ...newStudent, secondLang: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }}>
            <option value="None">2. Dil Yok</option>
            <option value="Almanca">Almanca</option>
            <option value="İspanyolca">İspanyolca</option>
            <option value="Fransızca">Fransızca</option>
          </select>
          <select value={newStudent.englishLevel} onChange={(e) => setNewStudent({ ...newStudent, englishLevel: e.target.value })} style={{ padding: '0.4rem', flex: '1 1 150px' }}>
            <option value="Core">Core</option>
            <option value="Extended">Extended</option>
          </select>
          <button type="submit" style={{ padding: '0.4rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>Ekle</button>
        </form>
      </div>

      {/* Öğrenci Listesi */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ background: '#f1f1f1' }}>
            <th>#</th>
            <th>Ad</th>
            <th>Soyad</th>
            <th>Sınıf</th>
            <th>Şube</th>
            <th>No</th>
            <th>TC</th>
            <th>Telefon</th>
            <th>Veli1</th>
            <th>Veli2</th>
            <th>Alan</th>
            <th>2.Dil</th>
            <th>Cinsiyet</th>
            <th>İng.</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => (
            <tr key={student.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td>{index + 1}</td>
              <td>{student.firstName}</td>
              <td>{student.lastName}</td>
              <td>{student.grade}</td>
              <td>{student.class}</td>
              <td>{student.studentNo}</td>
              <td>{student.tcNo}</td>
              <td>{student.phone}</td>
              <td>{student.parentPhone}</td>
              <td>{student.parentPhone2}</td>
              <td>{student.field}</td>
              <td>{student.secondLang}</td>
              <td>{student.gender}</td>
              <td>{student.englishLevel}</td>
              <td>
                <button onClick={() => handleDelete(student.id)} style={{ background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem' }}>
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {students.length === 0 && <p>Henüz öğrenci eklenmemiş.</p>}
    </div>
  );
};

export default Students;