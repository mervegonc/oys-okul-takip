import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import ExcelUpload from '../components/ExcelUpload';
import { encrypt, decrypt } from '../utils/encryption';
import { FaTrash, FaUserPlus, FaSort, FaSortUp, FaSortDown, FaFilter, FaFileDownload, FaSyncAlt } from 'react-icons/fa';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [classStats, setClassStats] = useState({});

  // Filtreleme State'leri
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');

  // Sıralama State'leri
  const [sortConfig, setSortConfig] = useState({ key: 'lastName', direction: 'asc' });

  const [newStudent, setNewStudent] = useState({
    firstName: '',
    lastName: '',
    grade: '',
    class: '',
    studentNo: '',
    tcNo: '',
    field: '',
    secondLang: 'None',
    gender: '',
    englishLevel: 'Core',
  });

  // İstatistikleri getir
  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_class_stats');
      if (error) throw error;

      const stats = {};
      (data || []).forEach((row) => {
        let grade = row.grade;
        const match = String(grade).match(/(\d+)/);
        if (match) grade = match[1];

        stats[grade] = {
          total: Number(row.total),
          newCount: Number(row.new_count),
        };
      });

      setClassStats(stats);
    } catch (error) {
      console.error('İstatistikler alınamadı:', error);
    }
  };

  // Öğrencileri getir (Seviye, Şube Filtreleri ve Sayfalama ile)
  const fetchStudents = async (page = 1) => {
    setLoading(true);
    try {
      let countQuery = supabase.from('students').select('*', { count: 'exact', head: true });
      let dataQuery = supabase.from('students').select('*');

      if (selectedGradeFilter !== 'ALL') {
        countQuery = countQuery.eq('grade', selectedGradeFilter);
        dataQuery = dataQuery.eq('grade', selectedGradeFilter);
      }

      if (selectedClassFilter !== 'ALL') {
        countQuery = countQuery.eq('class', selectedClassFilter);
        dataQuery = dataQuery.eq('class', selectedClassFilter);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const columnMapping = {
        firstName: 'first_name',
        lastName: 'last_name',
        grade: 'grade',
        class: 'class',
        studentNo: 'student_no',
        tcNo: 'tc_no',
        field: 'field',
        secondLang: 'second_lang',
        gender: 'gender',
        englishLevel: 'english_level',
      };

      const dbSortKey = columnMapping[sortConfig.key] || 'last_name';

      const { data, error } = await dataQuery
        .order(dbSortKey, { ascending: sortConfig.direction === 'asc' })
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
          field: raw.field || '',
          secondLang: raw.second_lang || '',
          gender: raw.gender || '',
          englishLevel: raw.english_level || 'Core',
          createdAt: raw.created_at,
        };

        let tcNo = student.tcNo || '';

        if (isAdmin) {
          try {
            if (tcNo && tcNo.length > 20) tcNo = decrypt(tcNo);
          } catch (e) {
            console.warn('Çözümleme hatası:', e);
          }
        } else {
          if (tcNo) tcNo = '***';
        }

        return { ...student, tcNo };
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
  }, [currentPage, selectedGradeFilter, selectedClassFilter, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return sortConfig.direction === 'asc' ? (
      <FaSortUp style={{ marginLeft: '4px', color: '#007bff' }} />
    ) : (
      <FaSortDown style={{ marginLeft: '4px', color: '#007bff' }} />
    );
  };

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
        tc_no: newStudent.tcNo ? encrypt(newStudent.tcNo) : null,
        field: newStudent.field,
        second_lang: newStudent.secondLang,
        gender: newStudent.gender,
        english_level: newStudent.englishLevel,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('students').insert(encryptedData);
      if (error) throw error;

      setNewStudent({
        firstName: '',
        lastName: '',
        grade: '',
        class: '',
        studentNo: '',
        tcNo: '',
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

  // Tüm öğrencileri Excel (CSV) olarak indirme fonksiyonu
  const handleExportExcel = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('students').select('*');
      if (error) throw error;

      if (!data || data.length === 0) {
        alert('İndirilecek öğrenci bulunamadı.');
        return;
      }

     const headers = ['id', 'first_name', 'last_name', 'grade', 'class', 'student_no', 'tc_no', 'field', 'second_lang', 'gender', 'english_level'];
      
      // Virgül ile ayırıp Excel'in doğrudan sütunlara bölmesini sağlayalım
      let csvContent = '\uFEFF' + headers.join(',') + '\n';

      data.forEach((row) => {
        let rawTc = row.tc_no || '';
        let decryptedTc = rawTc;
        try {
          if (rawTc && rawTc.length > 20) decryptedTc = decrypt(rawTc);
        } catch (e) {
          decryptedTc = rawTc;
        }

        const values = [
          row.id,
          `"${row.first_name || ''}"`,
          `"${row.last_name || ''}"`,
          `"${row.grade || ''}"`,
          `"${row.class || ''}"`,
          `"${row.student_no || ''}"`,
          `"${decryptedTc}"`,
          `"${row.field || ''}"`,
          `"${row.second_lang || ''}"`,
          `"${row.gender || ''}"`,
          `"${row.english_level || ''}"`,
        ];
        csvContent += values.join(',') + '\n';
      });
      let csvContent = '\uFEFF' + headers.join(';') + '\n';

      data.forEach((row) => {
        let rawTc = row.tc_no || '';
        let decryptedTc = rawTc;
        try {
          if (rawTc && rawTc.length > 20) decryptedTc = decrypt(rawTc);
        } catch (e) {
          decryptedTc = rawTc;
        }

        const values = [
          row.id,
          `"${row.first_name || ''}"`,
          `"${row.last_name || ''}"`,
          `"${row.grade || ''}"`,
          `"${row.class || ''}"`,
          `"${row.student_no || ''}"`,
          `"${decryptedTc}"`,
          `"${row.field || ''}"`,
          `"${row.second_lang || ''}"`,
          `"${row.gender || ''}"`,
          `"${row.english_level || ''}"`,
        ];
        csvContent += values.join(';') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ogrenci_listesi_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Excel dışa aktarma hatası:', error);
      alert('Öğrenciler dışa aktarılırken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Toplu Güncelleme / Ekleme (Upsert) - TC No veya Öğrenci No bazlı
  const handleBulkUpsert = async () => {
    if (!bulkText.trim()) {
      alert('Lütfen güncellenecek/eklenecek verileri yapıştırın.');
      return;
    }

    try {
      const lines = bulkText.trim().split('\n');
      if (lines.length === 0) return;

      const recordsToUpsert = [];
      
      // İlk satır başlık mı kontrol edelim (Örn: "Öğrenci No" veya "tc_no" içeriyorsa geçelim)
      let startIndex = 0;
      const firstLineLower = lines[0].toLowerCase();
      if (firstLineLower.includes('no') || firstLineLower.includes('ad') || firstLineLower.includes('tc')) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Sekme (Tab - Excel kopyalaması) veya virgül/noktalı virgül ayrımı
        const cols = line.split(/[\t;,]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
        
        // Beklenen format (Örnek sıra): 
        // [0]: Öğrenci No, [1]: Ad, [2]: Soyad, [3]: Sınıf, [4]: Şube, [5]: TC No, [6]: Alan, [7]: 2. Dil, [8]: Cinsiyet, [9]: İngilizce Seviyesi
        // Veya daha esnek bir yapı kurabiliriz. TC Kimlik No veya Öğrenci No benzersiz anahtar olarak kullanılabilir.
        if (cols.length >= 3) {
          recordsToUpsert.push({
            student_no: cols[0] || null,
            first_name: cols[1] || '',
            last_name: cols[2] || '',
            grade: cols[3] || '',
            class: cols[4] || '',
            tc_no: cols[5] ? encrypt(cols[5]) : null,
            field: cols[6] || '',
            second_lang: cols[7] || 'None',
            gender: cols[8] || '',
            english_level: cols[9] || 'Core',
          });
        }
      }

      if (recordsToUpsert.length === 0) {
        alert('İşlenecek geçerli veri bulunamadı. Lütfen sütun sıralamasını kontrol edin.');
        return;
      }

      // Supabase Upsert (student_no veya tc_no benzersiz alan tanımlı olmalı veya veritabanı kuralına göre eklenir)
      // Not: Eğer student_no veritabanında UNIQUE ise onConflict kullanılabilir.
      const { error } = await supabase
        .from('students')
        .upsert(recordsToUpsert, { onConflict: 'student_no' });

      if (error) throw error;

      alert(`${recordsToUpsert.length} öğrenci başarıyla güncellendi / eklendi.`);
      setBulkText('');
      setShowBulkUpdateModal(false);
      fetchStats();
      fetchStudents(currentPage);
    } catch (error) {
      console.error('Toplu güncelleme hatası:', error);
      alert('Toplu işlem sırasında hata oluştu: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      fetchStats();
      fetchStudents(currentPage);
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('Lütfen silmek için en az bir öğrenci seçin.');
      return;
    }
    if (!window.confirm(`${selectedIds.length} öğrenciyi silmek istediğinize emin misiniz?`)) return;

    try {
      const validIds = selectedIds.filter((id) => id && typeof id === 'string');
      const deletePromises = validIds.map((id) => supabase.from('students').delete().eq('id', id));
      const results = await Promise.all(deletePromises);
      const errors = results.filter((result) => result.error);

      if (errors.length > 0) {
        alert(`${errors.length} öğrenci silinirken hata oluştu.`);
      } else {
        setSelectedIds([]);
        fetchStats();
        fetchStudents(currentPage);
        alert(`${validIds.length} öğrenci başarıyla silindi.`);
      }
    } catch (error) {
      console.error('Toplu silme hatası:', error);
      alert('Silme işlemi sırasında hata oluştu: ' + error.message);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
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

  const availableGrades = useMemo(() => {
    const keys = Object.keys(classStats);
    return keys.sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [classStats]);

  return (
    <div style={{ padding: '1rem', maxWidth: '1300px', margin: '0 auto' }}>
      <h2>👨‍🎓 Öğrenci Yönetimi</h2>

      {/* Sınıf İstatistikleri */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
          padding: '0.8rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
        }}
      >
        {availableGrades.map((grade) => (
          <div
            key={grade}
            style={{
              background: 'white',
              padding: '0.3rem 0.8rem',
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              border: selectedGradeFilter === grade ? '2px solid #007bff' : '1px solid #eee',
            }}
            onClick={() => {
              setSelectedGradeFilter(selectedGradeFilter === grade ? 'ALL' : grade);
              setCurrentPage(1);
            }}
          >
            <strong>{grade}. Sınıf</strong>: {classStats[grade].total} kişi
            {classStats[grade].newCount > 0 && (
              <span style={{ color: '#856404', marginLeft: '0.3rem' }}>
                ({classStats[grade].newCount} Y.K.)
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Filtreleme ve Dışa Aktarma Çubuğu */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          background: '#eef2f7',
          padding: '0.8rem',
          borderRadius: '6px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FaFilter style={{ color: '#007bff' }} /> <strong>Filtrele:</strong>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', marginRight: '0.3rem' }}>Sınıf / Seviye:</label>
            <select
              value={selectedGradeFilter}
              onChange={(e) => {
                setSelectedGradeFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="ALL">Tüm Sınıflar</option>
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}. Sınıf
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', marginRight: '0.3rem' }}>Şube:</label>
            <select
              value={selectedClassFilter}
              onChange={(e) => {
                setSelectedClassFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="ALL">Tüm Şubeler</option>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map((c) => (
                <option key={c} value={c}>
                  {c} Şubesi
                </option>
              ))}
            </select>
          </div>

          {(selectedGradeFilter !== 'ALL' || selectedClassFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedGradeFilter('ALL');
                setSelectedClassFilter('ALL');
                setCurrentPage(1);
              }}
              style={{
                padding: '0.4rem 0.8rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Filtreleri Temizle
            </button>
          )}
        </div>

        {/* Tüm Listeyi İndir Butonu */}
        <button
          onClick={handleExportExcel}
          style={{
            padding: '0.4rem 1rem',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: '500',
          }}
        >
          <FaFileDownload /> Tüm Listeyi İndir (Excel/CSV)
        </button>
      </div>

      <ExcelUpload
        onUploadComplete={() => {
          fetchStudents(currentPage);
          fetchStats();
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
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

          <button
            onClick={() => setShowBulkUpdateModal(!showBulkUpdateModal)}
            style={{
              padding: '0.4rem 1rem',
              background: '#17a2b8',
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
            <FaSyncAlt /> Toplu Güncelle / Ekle
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
          Toplam {totalCount} öğrenci | Sayfa {currentPage} / {totalPages || 1}
        </div>
      </div>

      {/* Toplu Güncelleme / Ekleme Paneli */}
      {showBulkUpdateModal && (
        <div
          style={{
            background: '#e9ecef',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: '1px solid #ced4da',
          }}
        >
          <h4>🔄 Toplu Öğrenci Güncelleme ve Ekleme (Upsert)</h4>
          <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.5rem' }}>
            Excel'den kopyaladığınız verileri aşağıya yapıştırın. Sistem, öğrenci numarasına göre eşleşenlerin 
            bilgilerini (şube, alan, numara vb.) <strong>güncelleyecek</strong>, sistemde olmayanları ise <strong>yeni olarak ekleyecektir</strong>.
            <br />
            <em>Sıralama: Öğrenci No | Ad | Soyad | Sınıf | Şube | TC No | Alan | 2. Dil | Cinsiyet | İng. Seviyesi</em>
          </p>
          <textarea
            rows="6"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Verileri buraya yapıştırın (Tab veya virgül ayrımcıları algılanır)..."
            style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={handleBulkUpsert}
              style={{ padding: '0.4rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Değişiklikleri Uygula / Ekle
            </button>
            <button
              onClick={() => setShowBulkUpdateModal(false)}
              style={{ padding: '0.4rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '0.5rem' }}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

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
            <input type="text" placeholder="Sınıf (örn: 5, 10)" value={newStudent.grade} onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Şube (örn: C)" value={newStudent.class} onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="Öğrenci No" value={newStudent.studentNo} onChange={(e) => setNewStudent({ ...newStudent, studentNo: e.target.value })} style={{ padding: '0.4rem' }} />
            <input type="text" placeholder="TC Kimlik No" value={newStudent.tcNo} onChange={(e) => setNewStudent({ ...newStudent, tcNo: e.target.value })} style={{ padding: '0.4rem' }} />
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
          <thead style={{ background: '#f1f1f1', cursor: 'pointer', userSelect: 'none' }}>
            <tr>
              <th style={{ padding: '0.5rem' }}>
                <input type="checkbox" checked={selectedIds.length === students.length && students.length > 0} onChange={toggleSelectAll} />
              </th>
              <th>#</th>
              <th onClick={() => handleSort('firstName')}>Ad {getSortIcon('firstName')}</th>
              <th onClick={() => handleSort('lastName')}>Soyad {getSortIcon('lastName')}</th>
              <th onClick={() => handleSort('grade')}>Sınıf {getSortIcon('grade')}</th>
              <th onClick={() => handleSort('class')}>Şube {getSortIcon('class')}</th>
              <th onClick={() => handleSort('studentNo')}>No {getSortIcon('studentNo')}</th>
              <th>TC</th>
              <th onClick={() => handleSort('field')}>Alan {getSortIcon('field')}</th>
              <th onClick={() => handleSort('secondLang')}>2.Dil {getSortIcon('secondLang')}</th>
              <th onClick={() => handleSort('gender')}>Cinsiyet {getSortIcon('gender')}</th>
              <th onClick={() => handleSort('englishLevel')}>İng. {getSortIcon('englishLevel')}</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '1.5rem' }}>Yükleniyor...</td>
              </tr>
            ) : students.length > 0 ? (
              students.map((student, index) => (
                <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleSelect(student.id)} />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{(currentPage - 1) * pageSize + index + 1}</td>
                  <td style={{ padding: '0.5rem' }}>{student.firstName}</td>
                  <td style={{ padding: '0.5rem', fontWeight: '500' }}>{student.lastName}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{student.grade}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{student.class}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{student.studentNo}</td>
                  <td style={{ padding: '0.5rem' }}>{student.tcNo}</td>
                  <td style={{ padding: '0.5rem' }}>{student.field}</td>
                  <td style={{ padding: '0.5rem' }}>{student.secondLang}</td>
                  <td style={{ padding: '0.5rem' }}>{systemGender(student.gender)}</td>
                  <td style={{ padding: '0.5rem' }}>{student.englishLevel}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <button onClick={() => handleDelete(student.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}>
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '1rem' }}>
                  Filtrelere uygun öğrenci bulunamadı.
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

// Yardımcı fonksiyon (gender gösterimi için)
const systemGender = (g) => g;

export default Students; // export default Students