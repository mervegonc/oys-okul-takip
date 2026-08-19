import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { FiSearch, FiClock, FiUser, FiCalendar, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
import './DisciplineTracking.css'; // Stil dosyası

const DisciplineTracking = () => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [note, setNote] = useState('');
  const [recordType, setRecordType] = useState({ late: false, dress: false });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [statsFilter, setStatsFilter] = useState('daily'); // daily, weekly, monthly, term, yearly, custom
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

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

  // Kayıtları getir
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const q = query(collection(db, 'discipline'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        setRecords(data);
      } catch (error) {
        console.error('Kayıtlar alınamadı:', error);
      }
    };
    fetchRecords();
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
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(term)
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  // Öğrenci seç
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setNote('');
    setRecordType({ late: false, dress: false });
    setMessage('');
    setEditingRecord(null);
  };

  // Kaydet
  const handleSaveRecord = async () => {
    if (!selectedStudent) {
      setMessage('Lütfen bir öğrenci seçin.');
      return;
    }
    if (!recordType.late && !recordType.dress) {
      setMessage('En az bir seçenek işaretleyin (Geç Kaldı / Kıyafet).');
      return;
    }
    setLoading(true);
    try {
      let type = 'both';
      if (recordType.late && !recordType.dress) type = 'late';
      else if (!recordType.late && recordType.dress) type = 'dress';
      
      if (editingRecord) {
        // Güncelle
        await updateDoc(doc(db, 'discipline', editingRecord.id), {
          type,
          note: note || '',
        });
        setMessage('Kayıt güncellendi.');
        setEditingRecord(null);
      } else {
        // Yeni kayıt
        await addDoc(collection(db, 'discipline'), {
          studentId: selectedStudent.id,
          studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
          class: selectedStudent.class,
          grade: selectedStudent.grade,
          type: type,
          note: note || '',
          createdAt: new Date(),
        });
        setMessage('Kayıt başarıyla eklendi.');
      }
      // Listeyi yenile
      const q = query(collection(db, 'discipline'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setRecords(data);
      setSelectedStudent(null);
      setRecordType({ late: false, dress: false });
      setNote('');
    } catch (error) {
      console.error('Kayıt hatası:', error);
      setMessage('Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Sil
  const handleDeleteRecord = async (id) => {
    if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'discipline', id));
        setRecords(records.filter(r => r.id !== id));
        setMessage('Kayıt silindi.');
      } catch (error) {
        console.error('Silme hatası:', error);
      }
    }
  };

  // Düzenleme başlat
  const handleEditRecord = (record) => {
    setSelectedStudent({
      id: record.studentId,
      firstName: record.studentName.split(' ')[0],
      lastName: record.studentName.split(' ').slice(1).join(' '),
      class: record.class,
      grade: record.grade,
    });
    setRecordType({
      late: record.type === 'late' || record.type === 'both',
      dress: record.type === 'dress' || record.type === 'both',
    });
    setNote(record.note || '');
    setEditingRecord(record);
    setMessage('');
  };

  // İstatistikleri hesapla
  const calculateStats = () => {
    let filtered = [...records];
    const now = new Date();
    let startDate, endDate = new Date();

    switch (statsFilter) {
      case 'daily':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        const day = now.getDay() || 7;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day + 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'term':
        // Örnek: son 4 ay
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 4);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          startDate = new Date(customDateRange.start);
          endDate = new Date(customDateRange.end);
          endDate.setHours(23, 59, 59, 999);
        } else {
          setMessage('Lütfen başlangıç ve bitiş tarihi seçin.');
          return;
        }
        break;
      default:
        startDate = new Date(0);
        endDate = new Date(8640000000000000);
    }

    filtered = filtered.filter(r => {
      const date = r.createdAt?.toDate?.() || new Date(r.createdAt);
      return date >= startDate && date <= endDate;
    });

    if (selectedGrade) {
      filtered = filtered.filter(r => r.grade === selectedGrade);
    }
    if (selectedClass) {
      filtered = filtered.filter(r => r.class === selectedClass);
    }

    const lateCount = filtered.filter(r => r.type === 'late' || r.type === 'both').length;
    const dressCount = filtered.filter(r => r.type === 'dress' || r.type === 'both').length;

    // Saat bazlı dağılım
    const hourly = {};
    filtered.forEach(r => {
      const date = r.createdAt?.toDate?.() || new Date(r.createdAt);
      const hour = date.getHours();
      hourly[hour] = (hourly[hour] || 0) + 1;
    });

    // En çok geç kalanlar
    const lateStudents = {};
    filtered.filter(r => r.type === 'late' || r.type === 'both').forEach(r => {
      const key = r.studentName;
      lateStudents[key] = (lateStudents[key] || 0) + 1;
    });
    const topLate = Object.entries(lateStudents).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const dressStudents = {};
    filtered.filter(r => r.type === 'dress' || r.type === 'both').forEach(r => {
      const key = r.studentName;
      dressStudents[key] = (dressStudents[key] || 0) + 1;
    });
    const topDress = Object.entries(dressStudents).sort((a, b) => b[1] - a[1]).slice(0, 5);

    setStatsData({
      totalLate: lateCount,
      totalDress: dressCount,
      hourly,
      topLate,
      topDress,
      filtered,
    });
    setShowStats(true);
  };

  // CSV indir
  const downloadCSV = () => {
    if (!statsData) return;
    const headers = ['Öğrenci', 'Sınıf', 'Tür', 'Not', 'Tarih'];
    const rows = statsData.filtered.map(r => [
      r.studentName,
      `${r.grade}-${r.class}`,
      r.type === 'late' ? 'Geç Kaldı' : r.type === 'dress' ? 'Kıyafet' : 'Her İkisi',
      r.note || '',
      new Date(r.createdAt?.toDate?.() || r.createdAt).toLocaleString('tr-TR'),
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gec-kalma-istatistik.csv`;
    link.click();
  };

  return (
    <div className="discipline-container">
      <div className="discipline-header">
        <h2>⏰ Geç Kalma / Kıyafet Takibi</h2>
        <div className="discipline-tabs">
          <button className={!showStats ? 'active' : ''} onClick={() => setShowStats(false)}>Kayıt Gir</button>
          <button className={showStats ? 'active' : ''} onClick={() => { setShowStats(true); calculateStats(); }}>İstatistikler</button>
        </div>
      </div>

      {!showStats ? (
        // KAYIT GİR EKRANI
        <div className="discipline-content">
          <div className="search-area">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Öğrenci ad, soyad veya numarası..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="student-list">
              {filteredStudents.map((student, index) => (
                <div
                  key={student.id}
                  className={`student-item ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                  onClick={() => handleSelectStudent(student)}
                >
                  <span className="student-name">{student.firstName} {student.lastName}</span>
                  <span className="student-info">No: {student.studentNo} · {student.grade}. Sınıf / Şube {student.class}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedStudent && (
            <div className="record-card">
              <div className="record-header">
                <h3>{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                <span className="record-sub">No: {selectedStudent.studentNo} · {selectedStudent.grade}. Sınıf / Şube {selectedStudent.class}</span>
              </div>
              <div className="record-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={recordType.late}
                    onChange={(e) => setRecordType({ ...recordType, late: e.target.checked })}
                  />
                  <span>⏰ Geç Kaldı</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={recordType.dress}
                    onChange={(e) => setRecordType({ ...recordType, dress: e.target.checked })}
                  />
                  <span>👔 Kıyafet Uygunsuz</span>
                </label>
              </div>
              <div className="record-note">
                <input
                  type="text"
                  placeholder="Not (opsiyonel)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div className="record-actions">
                <button onClick={handleSaveRecord} disabled={loading} className="btn-save">
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                {editingRecord && (
                  <button onClick={() => setEditingRecord(null)} className="btn-cancel">İptal</button>
                )}
                {message && <p className="message">{message}</p>}
              </div>
            </div>
          )}
        </div>
      ) : (
        // İSTATİSTİK EKRANI
        <div className="stats-content">
          <div className="stats-filters">
            <div className="filter-group">
              <label>Zaman Aralığı</label>
              <select value={statsFilter} onChange={(e) => setStatsFilter(e.target.value)}>
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
                <option value="monthly">Aylık</option>
                <option value="term">Dönemlik</option>
                <option value="yearly">Yıllık</option>
                <option value="custom">Özel Aralık</option>
              </select>
            </div>
            {statsFilter === 'custom' && (
              <div className="filter-group">
                <label>Başlangıç</label>
                <input type="date" value={customDateRange.start} onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })} />
                <label>Bitiş</label>
                <input type="date" value={customDateRange.end} onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })} />
              </div>
            )}
            <div className="filter-group">
              <label>Sınıf</label>
              <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                <option value="">Tümü</option>
                {Array.from(new Set(students.map(s => s.grade))).sort().map(g => (
                  <option key={g} value={g}>{g}. Sınıf</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Şube</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">Tümü</option>
                {Array.from(new Set(students.map(s => s.class))).sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button onClick={calculateStats} className="btn-stats">İstatistikleri Göster</button>
            <button onClick={downloadCSV} className="btn-csv"><FiDownload /> CSV</button>
          </div>

          {statsData && (
            <div className="stats-results">
              <div className="stats-summary">
                <div className="stat-card">
                  <span className="stat-label">Toplam Geç Kalma</span>
                  <span className="stat-number">{statsData.totalLate}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Toplam Kıyafet İhlali</span>
                  <span className="stat-number">{statsData.totalDress}</span>
                </div>
              </div>

              <div className="stats-chart">
                <h4>Saatlik Dağılım</h4>
                <div className="chart-bars">
                  {Object.entries(statsData.hourly).sort((a, b) => a[0] - b[0]).map(([hour, count]) => (
                    <div key={hour} className="bar-item" style={{ height: `${Math.min(count * 30, 200)}px` }}>
                      <span className="bar-label">{hour}:00</span>
                      <span className="bar-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="stats-tables">
                <div className="top-list">
                  <h4>En Çok Geç Kalanlar</h4>
                  <ul>
                    {statsData.topLate.map(([name, count], idx) => (
                      <li key={idx}>{idx+1}. {name} ({count} kez)</li>
                    ))}
                  </ul>
                </div>
                <div className="top-list">
                  <h4>En Çok Kıyafet İhlali Yapanlar</h4>
                  <ul>
                    {statsData.topDress.map(([name, count], idx) => (
                      <li key={idx}>{idx+1}. {name} ({count} kez)</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="records-list">
                <h4>Kayıt Listesi</h4>
                <table>
                  <thead>
                    <tr><th>Öğrenci</th><th>Sınıf</th><th>Tür</th><th>Not</th><th>Tarih</th><th>İşlem</th></tr>
                  </thead>
                  <tbody>
                    {statsData.filtered.map(record => (
                      <tr key={record.id}>
                        <td>{record.studentName}</td>
                        <td>{record.grade}-{record.class}</td>
                        <td>{record.type === 'late' ? '⏰ Geç Kaldı' : record.type === 'dress' ? '👔 Kıyafet' : '⚠️ Her İkisi'}</td>
                        <td>{record.note || '-'}</td>
                        <td>{new Date(record.createdAt?.toDate?.() || record.createdAt).toLocaleString('tr-TR')}</td>
                        <td>
                          <button onClick={() => handleEditRecord(record)} className="btn-edit"><FiEdit2 /></button>
                          <button onClick={() => handleDeleteRecord(record.id)} className="btn-delete"><FiTrash2 /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DisciplineTracking;