import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { encrypt, decrypt } from '../utils/encryption';
import { FaTrash } from 'react-icons/fa';

const Students = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
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

  // admin kontrolü
  const isAdmin = user?.email === 'merve.gnc.946@gmail.com';

  const fetchStudents = async () => {
    try {
      const q = query(collection(db, 'students'), orderBy('lastName', 'asc'));
      const snapshot = await getDocs(q);
      const data = [];
      snapshot.forEach((doc) => {
        const raw = { id: doc.id, ...doc.data() };
        // Şifreli alanları çöz (sadece admin görecek)
        if (isAdmin) {
          raw.tcNo = decrypt(raw.tcNo);
          raw.phone = decrypt(raw.phone);
          raw.parentPhone = decrypt(raw.parentPhone);
          raw.parentPhone2 = decrypt(raw.parentPhone2);
        } else {
          // admin değilse maskeli göster
          raw.tcNo = raw.tcNo ? '***' : '';
          raw.phone = raw.phone ? '***' : '';
          raw.parentPhone = raw.parentPhone ? '***' : '';
          raw.parentPhone2 = raw.parentPhone2 ? '***' : '';
        }
        data.push(raw);
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
  }, [isAdmin]);

  // Yeni öğrenci ekle (şifreli)
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
      // Listeyi yeniden getir (şifreleri çözülmüş haliyle)
      fetchStudents();
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

  // Toplu silme
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      alert('Lütfen silmek için en az bir öğrenci seçin.');
      return;
    }
    if (!window.confirm(`${selectedIds.length} öğrenciyi silmek istediğinize emin misiniz?`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        const ref = doc(db, 'students', id);
        batch.delete(ref);
      });
      await batch.commit();
      setSelectedIds([]);
      setSelectAll(false);
      fetchStudents();
      alert(`${selectedIds.length} öğrenci silindi.`);
    } catch (error) {
      console.error('Toplu silme hatası:', error);
      alert('Silme işlemi sırasında hata oluştu.');
    }
  };

  // Tekil silme
  const handleDelete = async (id) => {
    if (!window.confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'students', id));
      fetchStudents();
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  // Checkbox işlemleri
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map(s => s.id));
    }
    setSelectAll(!selectAll);
  };

  if (loading) return <div>Öğrenciler yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>👨‍🎓 Öğrenci Yönetimi</h2>
        {selectedIds.length > 0 && (
          <button
            onClick={handleDeleteSelected}
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
            <FaTrash /> Seçilenleri Sil ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Yeni Öğrenci Ekleme Formu (aynı, şifreleme otomatik) */}
      {/* ... (form kısmı aynı kalacak, sadece handleAddStudent değişti) */}

      {/* Öğrenci Listesi – checkbox sütunu eklendi */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>
              <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
            </th>
            <th>Ad</th>
            <th>Soyad</th>
            <th>Sınıf</th>
            <th>No</th>
            <th>TC</th>
            <th>Telefon</th>
            <th>Veli1</th>
            <th>Veli2</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(student.id)}
                  onChange={() => toggleSelect(student.id)}
                />
              </td>
              <td>{student.firstName}</td>
              <td>{student.lastName}</td>
              <td>{student.grade}-{student.class}</td>
              <td>{student.studentNo}</td>
              <td>{isAdmin ? student.tcNo : '***'}</td>
              <td>{isAdmin ? student.phone : '***'}</td>
              <td>{isAdmin ? student.parentPhone : '***'}</td>
              <td>{isAdmin ? student.parentPhone2 : '***'}</td>
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