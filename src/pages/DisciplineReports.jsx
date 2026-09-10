import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { FaCalendarAlt, FaUsers, FaFilter, FaFileCsv, FaEdit, FaTrash, FaSortAlphaDown, FaClock, FaExclamationTriangle, FaUserCheck } from 'react-icons/fa';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DisciplineReports = () => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [sortByName, setSortByName] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [editType, setEditType] = useState('');

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const { data, error } = await supabase
          .from('discipline')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formattedData = data.map(item => ({
          ...item,
          id: item.id,
          createdAt: new Date(item.created_at),
          grade: item.grade,
          class: item.class,
          studentName: item.student_name,
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
    fetchRecords();
  }, []);

  useEffect(() => {
    let filtered = [...records];
    const now = new Date();
    let start, end;

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

    filtered = filtered.filter((r) => {
      const date = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
      return date >= start && date <= end;
    });

    if (selectedGrade !== 'all') {
      filtered = filtered.filter((r) => r.grade === selectedGrade);
    }
    if (selectedClass !== 'all') {
      filtered = filtered.filter((r) => r.class === selectedClass);
    }

    if (sortByName) {
      filtered.sort((a, b) => a.studentName.localeCompare(b.studentName, 'tr'));
    }

    setFilteredRecords(filtered);
  }, [records, dateRange, startDate, endDate, selectedGrade, selectedClass, sortByName]);

  const grades = ['all', ...new Set(records.map((r) => r.grade).filter(Boolean))];
  const classes = ['all', ...new Set(records.map((r) => r.class).filter(Boolean))];

  const totalLate = filteredRecords.filter((r) => r.type === 'late' || r.type === 'both').length;
  const totalDress = filteredRecords.filter((r) => r.type === 'dress' || r.type === 'both').length;
  const totalBoth = filteredRecords.filter((r) => r.type === 'both').length;

  const gradeStats = grades.filter((g) => g !== 'all').map((grade) => {
    const items = filteredRecords.filter((r) => r.grade === grade);
    return {
      grade,
      late: items.filter((r) => r.type === 'late' || r.type === 'both').length,
      dress: items.filter((r) => r.type === 'dress' || r.type === 'both').length,
      total: items.length,
    };
  });

  const classStats = classes.filter((c) => c !== 'all').map((cls) => {
    const items = filteredRecords.filter((r) => r.class === cls);
    return {
      class: cls,
      late: items.filter((r) => r.type === 'late' || r.type === 'both').length,
      dress: items.filter((r) => r.type === 'dress' || r.type === 'both').length,
      total: items.length,
    };
  });

  const hourStats = Array(24).fill(0);
  filteredRecords.forEach((r) => {
    const date = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
    hourStats[date.getHours()]++;
  });

  const chartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: 'Kayıt Sayısı',
        data: hourStats,
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Saatlere Göre Dağılım', font: { size: 14, weight: 'bold' } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  const lateLeaders = filteredRecords
    .filter((r) => r.type === 'late' || r.type === 'both')
    .reduce((acc, r) => {
      const key = r.student_id || r.studentName;
      if (!acc[key]) acc[key] = { name: r.studentName, class: `${r.grade}/${r.class}`, count: 0 };
      acc[key].count++;
      return acc;
    }, {});
  const lateLeaderList = Object.values(lateLeaders).sort((a, b) => b.count - a.count).slice(0, 5);

  const dressLeaders = filteredRecords
    .filter((r) => r.type === 'dress' || r.type === 'both')
    .reduce((acc, r) => {
      const key = r.student_id || r.studentName;
      if (!acc[key]) acc[key] = { name: r.studentName, class: `${r.grade}/${r.class}`, count: 0 };
      acc[key].count++;
      return acc;
    }, {});
  const dressLeaderList = Object.values(dressLeaders).sort((a, b) => b.count - a.count).slice(0, 5);

const exportCSV = () => {
    if (filteredRecords.length === 0) return alert('Dışa aktarılacak veri yok.');
    
    const headers = ['Öğrenci', 'Sınıf', 'Tür', 'Not', 'Tarih', 'Saat'];
    const rows = filteredRecords.map((r) => {
      const date = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
      return [
        `"${r.studentName || ''}"`,
        `"${r.grade}-${r.class || ''}"`,
        `"${r.type === 'late' ? 'Geç Kaldı' : r.type === 'dress' ? 'Kıyafet İhlali' : 'Her İkisi'}"`,
        `"${(r.note || '-').replace(/"/g, '""')}"`,
        `"${format(date, 'dd.MM.yyyy')}"`,
        `"${format(date, 'HH:mm')}"`,
      ];
    });

    // Virgül yerine noktalı virgül (;) kullanıldı
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapor_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

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

      const { data, error: fetchError } = await supabase
        .from('discipline')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedData = data.map(item => ({
        ...item,
        id: item.id,
        createdAt: new Date(item.created_at),
        grade: item.grade,
        class: item.class,
        studentName: item.student_name,
        type: item.type,
        note: item.note,
      }));

      setRecords(formattedData);
      setEditingId(null);
    } catch (error) {
      console.error('Güncelleme hatası:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('discipline').delete().eq('id', id);
      if (error) throw error;
      setRecords(records.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#666', fontSize: '1.1rem' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Başlık */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Geç Kalma / Kıyafet Raporları</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '0.3rem' }}>Öğrenci disiplin verilerini filtreleyin ve analiz edin.</p>
      </div>

      {/* Modern Filtre Paneli */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', padding: '1.25rem', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)', alignItems: 'center' }}>
        
        {/* Hazır Aralık Seçimi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
          <FaCalendarAlt style={{ color: '#6366f1' }} />
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer' }}>
            <option value="today">Bugün</option>
            <option value="week">Bu Hafta</option>
            <option value="month">Bu Ay</option>
            <option value="custom">Özel Aralık Seç</option>
          </select>
        </div>

        {/* Özel Tarih Alanı (Ayrı ve Esnek) */}
        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem 0.75rem', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>Başlangıç:</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.3rem', fontSize: '0.85rem' }} />
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>Bitiş:</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.3rem', fontSize: '0.85rem' }} />
          </div>
        )}

        {/* Sınıf Filtresi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
          <FaUsers style={{ color: '#6366f1' }} />
          <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer' }}>
            <option value="all">Tüm Sınıflar</option>
            {grades.filter(g => g !== 'all').sort().map((g) => (
              <option key={g} value={g}>{g}. Sınıf</option>
            ))}
          </select>
        </div>

        {/* Şube Filtresi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
          <FaFilter style={{ color: '#6366f1' }} />
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer' }}>
            <option value="all">Tüm Şubeler</option>
            {classes.filter(c => c !== 'all').sort().map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* İsim Sıralama Butonu */}
        <button 
          onClick={() => setSortByName(!sortByName)} 
          style={{ 
            padding: '0.5rem 0.9rem', 
            background: sortByName ? '#e0e7ff' : '#f1f5f9', 
            color: sortByName ? '#4338ca' : '#475569', 
            border: 'none', 
            borderRadius: '10px', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItem: 'center', 
            gap: '0.4rem',
            fontSize: '0.9rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          <FaSortAlphaDown /> İsim Sıralı {sortByName ? '(Aktif)' : ''}
        </button>

        {/* CSV İndir */}
        <button onClick={exportCSV} style={{ marginLeft: 'auto', padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>
          <FaFileCsv /> CSV İndir
        </button>
      </div>

      {/* Özet Kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', borderRadius: '16px', border: '1px solid #fde68a', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#92400e', fontWeight: '600' }}>Geç Kalan</span>
            <FaClock style={{ color: '#d97706', fontSize: '1.2rem' }} />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#78350f' }}>{totalLate}</div>
        </div>

        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)', borderRadius: '16px', border: '1px solid #a5f3fc', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#155e75', fontWeight: '600' }}>Kıyafet İhlali</span>
            <FaExclamationTriangle style={{ color: '#0891b2', fontSize: '1.2rem' }} />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#164e63' }}>{totalDress}</div>
        </div>

        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', borderRadius: '16px', border: '1px solid #fecaca', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#991b1b', fontWeight: '600' }}>Her İkisi</span>
            <FaExclamationTriangle style={{ color: '#dc2626', fontSize: '1.2rem' }} />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#7f1d1d' }}>{totalBoth}</div>
        </div>

        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '16px', border: '1px solid #bbf7d0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#166534', fontWeight: '600' }}>Toplam Kayıt</span>
            <FaUserCheck style={{ color: '#16a34a', fontSize: '1.2rem' }} />
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#14532d' }}>{filteredRecords.length}</div>
        </div>
      </div>

      {/* Sınıf ve Şube İstatistik Tabloları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Sınıf Düzeyi */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>Sınıf Düzeyine Göre Dağılım</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Sınıf</th>
                <th style={{ padding: '0.75rem' }}>Geç Kalan</th>
                <th style={{ padding: '0.75rem' }}>Kıyafet İhlali</th>
                <th style={{ padding: '0.75rem' }}>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {gradeStats.map((stat) => (
                <tr key={stat.grade} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600' }}>{stat.grade}. Sınıf</td>
                  <td style={{ padding: '0.75rem', color: '#d97706', fontWeight: '500' }}>{stat.late}</td>
                  <td style={{ padding: '0.75rem', color: '#0891b2', fontWeight: '500' }}>{stat.dress}</td>
                  <td style={{ padding: '0.75rem', fontWeight: '700' }}>{stat.total}</td>
                </tr>
              ))}
              {gradeStats.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>Veri yok</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Şube Düzeyi */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>Şubeye Göre Dağılım</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Şube</th>
                <th style={{ padding: '0.75rem' }}>Geç Kalan</th>
                <th style={{ padding: '0.75rem' }}>Kıyafet İhlali</th>
                <th style={{ padding: '0.75rem' }}>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {classStats.map((stat) => (
                <tr key={stat.class} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600' }}>{stat.class}</td>
                  <td style={{ padding: '0.75rem', color: '#d97706', fontWeight: '500' }}>{stat.late}</td>
                  <td style={{ padding: '0.75rem', color: '#0891b2', fontWeight: '500' }}>{stat.dress}</td>
                  <td style={{ padding: '0.75rem', fontWeight: '700' }}>{stat.total}</td>
                </tr>
              ))}
              {classStats.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>Veri yok</td></tr>}
            </tbody>
          </table>
        </div>

      </div>

      {/* Grafik */}
      <div style={{ marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* Liderlik Tabloları (En Çoklar) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>En Çok Geç Kalanlar</h4>
          {lateLeaderList.length > 0 ? (
            <ol style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {lateLeaderList.map((item, idx) => (
                <li key={idx} style={{ fontSize: '0.95rem', color: '#334155' }}>
                  <strong style={{ color: '#0f172a' }}>{item.name}</strong> <span style={{ color: '#64748b' }}>({item.class})</span> - <span style={{ color: '#d97706', fontWeight: '600' }}>{item.count} kez</span>
                </li>
              ))}
            </ol>
          ) : <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Veri yok</p>}
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>En Çok Kıyafet İhlali Yapanlar</h4>
          {dressLeaderList.length > 0 ? (
            <ol style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {dressLeaderList.map((item, idx) => (
                <li key={idx} style={{ fontSize: '0.95rem', color: '#334155' }}>
                  <strong style={{ color: '#0f172a' }}>{item.name}</strong> <span style={{ color: '#64748b' }}>({item.class})</span> - <span style={{ color: '#0891b2', fontWeight: '600' }}>{item.count} kez</span>
                </li>
              ))}
            </ol>
          ) : <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Veri yok</p>}
        </div>

      </div>

      {/* Tüm Kayıtlar Tablosu */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>Tüm Kayıtlar Listesi</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                <th style={{ padding: '0.75rem' }}>Öğrenci</th>
                <th style={{ padding: '0.75rem' }}>Sınıf</th>
                <th style={{ padding: '0.75rem' }}>Tür</th>
                <th style={{ padding: '0.75rem' }}>Not</th>
                <th style={{ padding: '0.75rem' }}>Tarih</th>
                <th style={{ padding: '0.75rem' }}>Saat</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '600', color: '#0f172a' }}>{record.studentName}</td>
                  <td style={{ padding: '0.75rem', color: '#475569' }}>{record.grade}-{record.class}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {editingId === record.id ? (
                      <select value={editType} onChange={(e) => setEditType(e.target.value)} style={{ padding: '0.3rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        <option value="late">Geç Kaldı</option>
                        <option value="dress">Kıyafet İhlali</option>
                        <option value="both">Her İkisi</option>
                      </select>
                    ) : (
                      <span style={{ 
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '6px', 
                        fontSize: '0.8rem', 
                        fontWeight: '600',
                        background: record.type === 'late' ? '#fef3c7' : record.type === 'dress' ? '#cffafe' : '#fee2e2',
                        color: record.type === 'late' ? '#92400e' : record.type === 'dress' ? '#155e75' : '#991b1b'
                      }}>
                        {record.type === 'late' ? 'Geç Kaldı' : record.type === 'dress' ? 'Kıyafet İhlali' : 'Her İkisi'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#475569' }}>
                    {editingId === record.id ? (
                      <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ padding: '0.3rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    ) : (
                      record.note || '-'
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#475569' }}>{record.createdAt ? format(record.createdAt, 'dd.MM.yyyy') : '-'}</td>
                  <td style={{ padding: '0.75rem', color: '#475569' }}>{record.createdAt ? format(record.createdAt, 'HH:mm') : '-'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {editingId === record.id ? (
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleUpdate(record.id)} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>
                          Kaydet
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ background: '#64748b', color: 'white', border: 'none', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>
                          İptal
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleEdit(record)} style={{ background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '1rem' }}>
                          <FaEdit />
                        </button>
                        <button onClick={() => handleDelete(record.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>
                          <FaTrash />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Kayıt bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default DisciplineReports;
