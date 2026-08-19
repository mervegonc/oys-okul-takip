import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import ExcelUpload from '../components/ExcelUpload';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption';
import { FaTrash, FaUserPlus } from 'react-icons/fa';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
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

  // Öğrencileri getir (TC ve telefonları çöz)
  const fetchStudents = async () => {
    try {
      const q = query(collection(db, 'students'), orderBy('lastName', 'asc'));
      const snapshot = await getDocs(q);
      const data = [];
      snapshot.forEach((doc) => {
        const raw = doc.data();
        // Şifreli alanları çöz (admin ise çöz, değilse gizle)
        const isAdmin = true; // Şimdilik admin varsayalım, ileride rol kontrolü eklenecek
        const tcNo = isAdmin ? decrypt(raw.tcNo) : '***';
        const phone = isAdmin ? decrypt(raw.phone) : '***';
        const parentPhone = isAdmin ? decrypt(raw.parentPhone) : '***';
        const parentPhone2 = isAdmin ? decrypt(raw.parentPhone2) : '***';
        data.push({
          id: doc.id,
          ...raw,
          tcNo,
          phone,
          parentPhone,
          parentPhone2,
        });
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

  // Yeni öğrenci ekle (TC ve telefonları şifrele)
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.firstName || !newStudent.lastName || !newStudent.grade) {
      alert('Ad, soyad ve sınıf zorunludur.');
      return;
    }
    try {
      const encryptedData = {
        ...newStudent,
        tcNo: encrypt(newStudent.tcNo),
        phone: encrypt(newStudent.phone),
        parentPhone: encrypt(newStudent.parentPhone),
        parentPhone2: encrypt(newStudent.parentPhone2),
        createdAt: new Date(),
      };
      const docRef = await addDoc(collection(db, 'students'), encryptedData);
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
      alert('Öğrenci başarıyla eklendi.');
    } catch (error) {
      console.error('Öğrenci eklenirken hata:', error);
      alert('Bir hata oluştu.');
    }
  };

  // Tekil sil
  const handleDelete = async (id) => {
    if (!window.confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'students', id));
      setStudents(students.filter((s) => s.id !== id));
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  // Toplu sil
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('Lütfen silmek için en az bir öğrenci seçin.');
      return;
    }
    if (!window.confirm(`${selectedIds.length} öğrenciyi silmek istediğinize emin misiniz?`)) return;
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, 'students', id));
      }
      setStudents(students.filter((s) => !selectedIds.includes(s.id)));
      setSelectedIds([]);
      alert(`${selectedIds.length} öğrenci silindi.`);
    } catch (error) {
      console.error('Toplu silme hatası:', error);
      alert('Bir hata oluştu.');
    }
  };

  // Seçim toggle
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Tümünü seç / seçimi kaldır
  const toggleSelectAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>👨‍🎓 Öğrenci Yönetimi</h2>

      {/* Excel Yükleme Bileşeni */}
      <ExcelUpload onUploadComplete={fetchStudents} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '0.4rem 1rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <FaUserPlus /> Yeni Öğrenci
        </button>

        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkDelete}
            style={{
              padding: '0.4rem 1rem',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FaTrash /> Seçileni Sil ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Yeni Öğrenci Formu */}
      {showForm && (
        <form
          onSubmit={handleAddStudent}
          style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: '1px solid #ddd',
          }}
        >
          <h4>Yeni Öğrenci Ekle</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '0.5rem' }}>
            <input type="text" placeholder="Ad" value={newStudent.firstName} onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Soyad" value={newStudent.lastName} onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Sınıf (örn: 10)" value={newStudent.grade} onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Şube (örn: C)" value={newStudent.class} onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Öğrenci No" value={newStudent.studentNo} onChange={(e) => setNewStudent({ ...newStudent, studentNo: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="TC Kimlik No" value={newStudent.tcNo} onChange={(e) => setNewStudent({ ...newStudent, tcNo: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Telefon" value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Veli Tel 1" value={newStudent.parentPhone} onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Veli Tel 2" value={newStudent.parentPhone2} onChange={(e) => setNewStudent({ ...newStudent, parentPhone2: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Öğrenim Alanı" value={newStudent.field} onChange={(e) => setNewStudent({ ...newStudent, field: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Cinsiyet" value={newStudent.gender} onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })} style={{ padding: '0.4rem' }} />
            <select value={newStudent.secondLang} onChange={(e) => setNewStudent({ ...newStudent, secondLang: e.target.value })} style={{ padding: '0.4rem' }}>
              <option value="None">2. Dil Yok</option>
              <option value="Almanca">Almanca</option>
              <option value="İspanyolca">İspanyolca</option>
              <option value="Fransızca">Fransızca</option>
            </select>
            <select value={newStudent.englishLevel} onChange={(e) => setNewStudent({ ...newStudent, englishLevel: e.target.value })} style={{ padding: '0.4rem' }}>
              <option value="Core">Core</option>
              <option value="Extended">Extended</option>
            </select>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <button type="submit" style={{ padding: '0.4rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Ekle
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.4rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '0.5rem' }}>
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Öğrenci Listesi */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
          <thead style={{ background: '#f1f1f1' }}>
            <tr>
              <th style={{ padding: '0.5rem' }}>
                <input type="checkbox" checked={selectedIds.length === students.length && students.length > 0} onChange={toggleSelectAll} />
              </th>
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
              <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleSelect(student.id)} />
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ padding: '0.5rem' }}>{student.firstName}</td>
                <td style={{ padding: '0.5rem' }}>{student.lastName}</td>
                <td style={{ padding: '0.5rem' }}>{student.grade}</td>
                <td style={{ padding: '0.5rem' }}>{student.class}</td>
                <td style={{ padding: '0.5rem' }}>{student.studentNo}</td>
                <td style={{ padding: '0.5rem' }}>{student.tcNo}</td>
                <td style={{ padding: '0.5rem' }}>{student.phone}</td>
                <td style={{ padding: '0.5rem' }}>{student.parentPhone}</td>
                <td style={{ padding: '0.5rem' }}>{student.parentPhone2}</td>
                <td style={{ padding: '0.5rem' }}>{student.field}</td>
                <td style={{ padding: '0.5rem' }}>{student.secondLang}</td>
                <td style={{ padding: '0.5rem' }}>{student.gender}</td>
                <td style={{ padding: '0.5rem' }}>{student.englishLevel}</td>
                <td style={{ padding: '0.5rem' }}>
                  <button onClick={() => handleDelete(student.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}>
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan="16" style={{ textAlign: 'center', padding: '1rem' }}>
                  Henüz öğrenci eklenmemiş.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Students;