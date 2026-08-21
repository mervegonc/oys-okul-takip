import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { FaCalendarAlt, FaUsers, FaFilter, FaFileCsv, FaEdit, FaTrash } from 'react-icons/fa';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DisciplineReports = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [editType, setEditType] = useState('');

  // 📊 Veri çekme (RPC ile)
  const fetchRecords = async () => {
    setLoading(true);
    try {
      let start = null, end = null;
      const now = new Date();
      switch (dateRange) {
        case 'today':
          start = startOfDay(now);
          end = endOfDay(now);
          break;
        case 'week':
          start = startOfWeek(now, { weekStartsOn: 1 });
          end = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'month':
          start = startOfMonth(now);
          end = endOfMonth(now);
          break;
        case 'custom':
          start = new Date(startDate);
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          break;
        default:
          start = startOfDay(now);
          end = endOfDay(now);
      }

      console.log('📊 fetchRecords çağrıldı');
      console.log('📊 dateRange:', dateRange);
      console.log('📊 start:', start?.toISOString(), 'end:', end?.toISOString());
      console.log('📊 selectedGrade:', selectedGrade, 'selectedClass:', selectedClass);

      const { data, error } = await supabase.rpc('get_discipline_reports', {
        p_start_date: start ? start.toISOString() : null,
        p_end_date: end ? end.toISOString() : null,
        p_grade: selectedGrade,
        p_class: selectedClass
      });

      if (error) throw error;

      console.log('📊 RPC sonucu gelen kayıt sayısı:', data?.length);

      const formattedData = (data || []).map(item => ({
        ...item,
        id: item.id,
        createdAt: new Date(item.created_at),
        studentName: item.student_name,
        grade: item.grade,
        class: item.class,
        type: item.type,
        note: item.note,
      }));

      setRecords(formattedData);
    } catch (error) {
      console.error('Kayıtlar alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtre değişikliklerinde otomatik sorgula
  useEffect(() => {
    fetchRecords();
  }, [dateRange, startDate, endDate, selectedGrade, selectedClass]);

  // Benzersiz sınıf ve şube listeleri
  const grades = ['all', ...new Set(records.map(r => r.grade).filter(Boolean))];
  const classes = ['all', ...new Set(records.map(r => r.class).filter(Boolean))];

  // İstatistikler (doğrudan records üzerinden)
  const totalLate = records.filter(r => r.type === 'late' || r.type === 'both').length;
  const totalDress = records.filter(r => r.type === 'dress' || r.type === 'both').length;
  const totalBoth = records.filter(r => r.type === 'both').length;

  const gradeStats = grades.filter(g => g !== 'all').map(grade => {
    const items = records.filter(r => r.grade === grade);
    return {
      grade,
      late: items.filter(r => r.type === 'late' || r.type === 'both').length,
      dress: items.filter(r => r.type === 'dress' || r.type === 'both').length,
      total: items.length,
    };
  });

  const classStats = classes.filter(c => c !== 'all').map(cls => {
    const items = records.filter(r => r.class === cls);
    return {
      class: cls,
      late: items.filter(r => r.type === 'late' || r.type === 'both').length,
      dress: items.filter(r => r.type === 'dress' || r.type === 'both').length,
      total: items.length,
    };
  });

  // Saat bazlı dağılım
  const hourStats = Array(24).fill(0);
  records.forEach(r => {
    if (r.createdAt) {
      hourStats[r.createdAt.getHours()]++;
    }
  });

  const chartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [{
      label: 'Kayıt Sayısı',
      data: hourStats,
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Saatlere Göre Dağılım' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  // En çok geç kalanlar
  const lateLeaders = records
    .filter(r => r.type === 'late' || r.type === 'both')
    .reduce((acc, r) => {
      const key = r.student_id || r.studentName;
      if (!acc[key]) acc[key] = { name: r.studentName, class: `${r.grade}/${r.class}`, count: 0 };
      acc[key].count++;
      return acc;
    }, {});
  const lateLeaderList = Object.values(lateLeaders).sort((a, b) => b.count - a.count).slice(0, 5);

  const dressLeaders = records
    .filter(r => r.type === 'dress' || r.type === 'both')
    .reduce((acc, r) => {
      const key = r.student_id || r.studentName;
      if (!acc[key]) acc[key] = { name: r.studentName, class: `${r.grade}/${r.class}`, count: 0 };
      acc[key].count++;
      return acc;
    }, {});
  const dressLeaderList = Object.values(dressLeaders).sort((a, b) => b.count - a.count).slice(0, 5);

  // CSV dışa aktarma
  const exportCSV = () => {
    if (records.length === 0) return alert('Dışa aktarılacak veri yok.');
    const headers = ['Öğrenci', 'Sınıf', 'Tür', 'Not', 'Tarih', 'Saat'];
    const rows = records.map(r => [
      r.studentName,
      `${r.grade}-${r.class}`,
      r.type === 'late' ? 'Geç Kaldı' : r.type === 'dress' ? 'Kıyafet İhlali' : 'Her İkisi',
      r.note || '-',
      format(r.createdAt, 'dd.MM.yyyy'),
      format(r.createdAt, 'HH:mm'),
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapor_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  // Düzenleme ve silme işlemleri
  const handleEdit = (record) => {
    setEditingId(record.id);
    setEditNote(record.note || '');
    setEditType(record.type);
  };

  const handleUpdate = async (id) => {
    try {
      const { error } = await supabase
        .from('discipline')
        .update({ note: editNote, type: editType })
        .eq('id', id);
      if (error) throw error;
      setEditingId(null);
      fetchRecords();
    } catch (error) {
      console.error('Güncelleme hatası:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('discipline')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchRecords();
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>Geç Kalma / Kıyafet Raporları</h2>

      {/* Filtreler */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaCalendarAlt />
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd' }}>
            <option value="today">Bugün</option>
            <option value="week">Bu Hafta</option>
            <option value="month">Bu Ay</option>
            <option value="custom">Özel Aralık</option>
          </select>
        </div>

        {dateRange === 'custom' && (
          <>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd' }} />
            <span> - </span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd' }} />
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaUsers />
          <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd' }}>
            <option value="all">Tüm Sınıflar</option>
            {grades.filter(g => g !== 'all').sort().map(g => (
              <option key={g} value={g}>{g}. Sınıf</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaFilter />
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ddd' }}>
            <option value="all">Tüm Şubeler</option>
            {classes.filter(c => c !== 'all').sort().map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button onClick={exportCSV} style={{ padding: '0.4rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FaFileCsv /> CSV İndir
        </button>
      </div>

      {/* Özet Kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: '#856404' }}>Geç Kalan</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalLate}</div>
        </div>
        <div style={{ padding: '1rem', background: '#d1ecf1', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: '#0c5460' }}>Kıyafet İhlali</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalDress}</div>
        </div>
        <div style={{ padding: '1rem', background: '#f8d7da', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: '#721c24' }}>Her İkisi</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalBoth}</div>
        </div>
        <div style={{ padding: '1rem', background: '#d4edda', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: '#155724' }}>Toplam</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{records.length}</div>
        </div>
      </div>

      {/* Sınıf Bazlı */}
      <div style={{ marginBottom: '2rem' }}>
        <h4>Sınıf Düzeyine Göre</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
          <thead style={{ background: '#f1f1f1' }}><tr><th>Sınıf</th><th>Geç Kalan</th><th>Kıyafet İhlali</th><th>Toplam</th></tr></thead>
          <tbody>
            {gradeStats.map(stat => (
              <tr key={stat.grade} style={{ borderBottom: '1px solid #eee' }}>
                <td>{stat.grade}. Sınıf</td>
                <td>{stat.late}</td>
                <td>{stat.dress}</td>
                <td>{stat.total}</td>
              </tr>
            ))}
            {gradeStats.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center' }}>Veri yok</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Şube Bazlı */}
      <div style={{ marginBottom: '2rem' }}>
        <h4>Şubeye Göre</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
          <thead style={{ background: '#f1f1f1' }}><tr><th>Şube</th><th>Geç Kalan</th><th>Kıyafet İhlali</th><th>Toplam</th></tr></thead>
          <tbody>
            {classStats.map(stat => (
              <tr key={stat.class} style={{ borderBottom: '1px solid #eee' }}>
                <td>{stat.class}</td>
                <td>{stat.late}</td>
                <td>{stat.dress}</td>
                <td>{stat.total}</td>
              </tr>
            ))}
            {classStats.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center' }}>Veri yok</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Grafik */}
      <div style={{ marginBottom: '2rem', background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* En Çok Geç Kalanlar / Kıyafet İhlali Yapanlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px,1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
          <h4>En Çok Geç Kalanlar</h4>
          {lateLeaderList.length > 0 ? (
            <ol style={{ paddingLeft: '1.2rem' }}>
              {lateLeaderList.map((item, idx) => (
                <li key={idx}><strong>{item.name}</strong> ({item.class}) - {item.count} kez</li>
              ))}
            </ol>
          ) : <p>Veri yok</p>}
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
          <h4>En Çok Kıyafet İhlali Yapanlar</h4>
          {dressLeaderList.length > 0 ? (
            <ol style={{ paddingLeft: '1.2rem' }}>
              {dressLeaderList.map((item, idx) => (
                <li key={idx}><strong>{item.name}</strong> ({item.class}) - {item.count} kez</li>
              ))}
            </ol>
          ) : <p>Veri yok</p>}
        </div>
      </div>

      {/* Tüm Kayıtlar Listesi */}
      <div style={{ marginTop: '2rem', background: 'white', borderRadius: '12px', padding: '1rem', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
        <h4>Tüm Kayıtlar</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f1f1f1' }}>
            <tr><th>Öğrenci</th><th>Sınıf</th><th>Tür</th><th>Not</th><th>Tarih</th><th>Saat</th><th>İşlem</th></tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{record.studentName}</td>
                <td>{record.grade}-{record.class}</td>
                <td>
                  {editingId === record.id ? (
                    <select value={editType} onChange={e => setEditType(e.target.value)}>
                      <option value="late">Geç Kaldı</option>
                      <option value="dress">Kıyafet İhlali</option>
                      <option value="both">Her İkisi</option>
                    </select>
                  ) : (
                    record.type === 'late' ? 'Geç Kaldı' : record.type === 'dress' ? 'Kıyafet İhlali' : 'Her İkisi'
                  )}
                </td>
                <td>
                  {editingId === record.id ? (
                    <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} />
                  ) : (
                    record.note || '-'
                  )}
                </td>
                <td>{record.createdAt ? format(record.createdAt, 'dd.MM.yyyy') : '-'}</td>
                <td>{record.createdAt ? format(record.createdAt, 'HH:mm') : '-'}</td>
                <td>
                  {editingId === record.id ? (
                    <>
                      <button onClick={() => handleUpdate(record.id)} style={{ background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', marginRight: '0.3rem' }}>Kaydet</button>
                      <button onClick={() => setEditingId(null)} style={{ background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem' }}>İptal</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEdit(record)} style={{ background: 'transparent', border: 'none', color: '#ffc107', cursor: 'pointer', marginRight: '0.5rem' }}><FaEdit /></button>
                      <button onClick={() => handleDelete(record.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}><FaTrash /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1rem' }}>Kayıt yok</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DisciplineReports;