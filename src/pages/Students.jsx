import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import ExcelUpload from '../components/ExcelUpload';
import { encrypt, decrypt } from '../utils/encryption';
import { FaTrash, FaUserPlus } from 'react-icons/fa';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [classStats, setClassStats] = useState({});

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

  // 📊 İstatistikleri getir (Sınıf bazında toplam ve Yeni Kayıt sayısı)
const fetchStats = async () => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('grade, class')
      .limit(10000); // Tüm kayıtları al

    if (error) throw error;

    console.log('📊 fetchStats başladı...');
    console.log('📊 Gelen veri (ilk 5):', data?.slice(0, 5));
    console.log('📊 Toplam kayıt:', data?.length);
    
    // Grade değerlerini incele
    const gradeValues = data?.map(s => `"${s.grade}"`).slice(0, 20);
    console.log('📊 Grade değerleri (ilk 20):', gradeValues.join(', '));

    const stats = {};
    data?.forEach((student, index) => {
      let grade = student.grade || 'Belirsiz';
      const gradeMatch = String(grade).match(/(\d+)/);
      if (gradeMatch) {
        grade = gradeMatch[1];
      }

      if (!stats[grade]) {
        stats[grade] = { total: 0, newCount: 0 };
      }
      stats[grade].total += 1;

      const classText = student.class || '';
      const upperClass = classText.toUpperCase();
      const isNew = upperClass.includes('YK') || 
                    upperClass.includes('Y.K') || 
                    upperClass.includes('YENİ KAYIT');
      
      if (isNew) {
        stats[grade].newCount += 1;
      }

      if (index < 10) {
        console.log(`📌 Örnek ${index+1}: grade="${student.grade}" -> normalize="${grade}", class="${classText}", isNew=${isNew}`);
      }
    });

    console.log('📊 Hesaplanan istatistikler:', stats);
    setClassStats(stats);
  } catch (error) {
    console.error('İstatistikler alınamadı:', error);
  }
};

  // 📋 Öğrencileri getir (sayfalama ile)
  const fetchStudents = async (page = 1) => {
    setLoading(true);
    try {
      const { count, error: countError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      setTotalCount(count || 0);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('last_name', { ascending: true })
        .range(from, to);

      if (error) throw error;

      const isAdmin = true;
      const processed = (data || []).map((raw) => {
        const student = {
          id: raw.id,
          firstName: raw.first_name || '',
          lastName: raw.last_name || '',
          grade: raw.grade || '',
          class: raw.class || '',
          studentNo: raw.student_no || '',
          tcNo: raw.tc_no || '',
          phone: raw.phone || '',
          parentPhone: raw.parent_phone || '',
          parentPhone2: raw.parent_phone2 || '',
          field: raw.field || '',
          secondLang: raw.second_lang || '',
          gender: raw.gender || '',
          englishLevel: raw.english_level || 'Core',
          createdAt: raw.created_at,
        };

        let tcNo = student.tcNo || '';
        let phone = student.phone || '';
        let parentPhone = student.parentPhone || '';
        let parentPhone2 = student.parentPhone2 || '';

        if (isAdmin) {
          try {
            if (tcNo && tcNo.length > 20) tcNo = decrypt(tcNo);
            if (phone && phone.length > 20) phone = decrypt(phone);
            if (parentPhone && parentPhone.length > 20) parentPhone = decrypt(parentPhone);
            if (parentPhone2 && parentPhone2.length > 20) parentPhone2 = decrypt(parentPhone2);
          } catch (e) {
            console.warn('Çözümleme hatası:', e);
          }
        } else {
          if (tcNo) tcNo = '***';
          if (phone) phone = '***';
          if (parentPhone) parentPhone = '***';
          if (parentPhone2) parentPhone2 = '***';
        }

        return { ...student, tcNo, phone, parentPhone, parentPhone2 };
      });

      setStudents(processed);
    } catch (error) {
      console.error('Öğrenciler alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(currentPage);
    fetchStats();
  }, [currentPage]);

  // ➕ Yeni öğrenci ekle
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.firstName || !newStudent.lastName || !newStudent.grade) {
      alert('Ad, soyad ve sınıf zorunludur.');
      return;
    }
    try {
      const encryptedData = {
        first_name: newStudent.firstName,
        last_name: newStudent.lastName,
        grade: newStudent.grade,
        class: newStudent.class,
        student_no: newStudent.studentNo,
        tc_no: encrypt(newStudent.tcNo),
        phone: encrypt(newStudent.phone),
        parent_phone: encrypt(newStudent.parentPhone),
        parent_phone2: encrypt(newStudent.parentPhone2),
        field: newStudent.field,
        second_lang: newStudent.secondLang,
        gender: newStudent.gender,
        english_level: newStudent.englishLevel,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('students')
        .insert(encryptedData)
        .select();

      if (error) throw error;

      const newRecord = data[0];
      setStudents([
        ...students,
        {
          id: newRecord.id,
          firstName: newStudent.firstName,
          lastName: newStudent.lastName,
          grade: newStudent.grade,
          class: newStudent.class,
          studentNo: newStudent.studentNo,
          tcNo: newStudent.tcNo,
          phone: newStudent.phone,
          parentPhone: newStudent.parentPhone,
          parentPhone2: newStudent.parentPhone2,
          field: newStudent.field,
          secondLang: newStudent.secondLang,
          gender: newStudent.gender,
          englishLevel: newStudent.englishLevel,
        },
      ]);

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

      fetchStats();
      fetchStudents(currentPage);
      alert('Öğrenci başarıyla eklendi.');
    } catch (error) {
      console.error('Öğrenci eklenirken hata:', error);
      alert('Bir hata oluştu: ' + error.message);
    }
  };

  // 🗑️ Tekil sil
  const handleDelete = async (id) => {
    if (!window.confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setStudents(students.filter((s) => s.id !== id));
      fetchStats();
      fetchStudents(currentPage);
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  // 🗑️ Toplu sil (güvenli versiyon)
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('Lütfen silmek için en az bir öğrenci seçin.');
      return;
    }
    if (!window.confirm(`${selectedIds.length} öğrenciyi silmek istediğinize emin misiniz?`)) return;

    try {
      const validIds = selectedIds.filter(id => id && typeof id === 'string');
      if (validIds.length === 0) {
        alert('Geçerli öğrenci seçilmedi.');
        return;
      }

      const deletePromises = validIds.map(id =>
        supabase.from('students').delete().eq('id', id)
      );

      const results = await Promise.all(deletePromises);
      const errors = results.filter(result => result.error);

      if (errors.length > 0) {
        console.error('Toplu silme hataları:', errors);
        alert(`${errors.length} öğrenci silinirken hata oluştu. Detaylar konsolda.`);
      } else {
        setStudents(students.filter(s => !validIds.includes(s.id)));
        setSelectedIds([]);
        fetchStats();
        fetchStudents(currentPage);
        alert(`${validIds.length} öğrenci başarıyla silindi.`);
      }
    } catch (error) {
      console.error('Toplu silme hatası:', error);
      alert('Silme işlemi sırasında bir hata oluştu: ' + error.message);
    }
  };

  // 🔄 Seçim işlemleri
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setSelectedIds([]);
  };

  if (loading && students.length === 0) return <div style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>👨‍🎓 Öğrenci Yönetimi</h2>

      {/* Sınıf İstatistikleri */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '1rem',
        padding: '0.8rem',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e0e0e0'
      }}>
        {Object.keys(classStats)
          .sort((a, b) => Number(a) - Number(b))
          .map((grade) => (
            <div key={grade} style={{
              background: 'white',
              padding: '0.3rem 0.8rem',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              fontSize: '0.9rem'
            }}>
              <strong>{grade}. Sınıf</strong>: {classStats[grade].total} kişi
              {classStats[grade].newCount > 0 && (
                <span style={{ color: '#856404', marginLeft: '0.3rem' }}>
                  ({classStats[grade].newCount} Y.K.)
                </span>
              )}
            </div>
          ))}
      </div>

      <ExcelUpload onUploadComplete={() => {
        fetchStudents(currentPage);
        fetchStats();
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '0.4rem 1rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginLeft: '0.5rem',
              }}
            >
              <FaTrash /> Seçileni Sil ({selectedIds.length})
            </button>
          )}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          Toplam {totalCount} öğrenci | Sayfa {currentPage} / {totalPages}
        </div>
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

      {/* Öğrenci Listesi Tablosu */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
          <thead style={{ background: '#f1f1f1' }}>
            <tr>
              <th style={{ padding: '0.5rem' }}>
                <input type="checkbox" checked={selectedIds.length === students.length && students.length > 0} onChange={toggleSelectAll} />
              </th>
              <th>#</th>
              <th>Ad</th><th>Soyad</th><th>Sınıf</th><th>Şube</th><th>No</th>
              <th>TC</th><th>Telefon</th><th>Veli1</th><th>Veli2</th>
              <th>Alan</th><th>2.Dil</th><th>Cinsiyet</th><th>İng.</th><th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleSelect(student.id)} />
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{(currentPage - 1) * pageSize + index + 1}</td>
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

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{ padding: '0.3rem 0.8rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
          >
            Önceki
          </button>
          <span style={{ fontSize: '0.9rem' }}>
            Sayfa {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{ padding: '0.3rem 0.8rem', border: '1px solid #ddd', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
};

export default Students;