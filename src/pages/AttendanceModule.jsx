import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const STATUS_OPTIONS = [
  { value: 'katildi', label: 'Katıldı', color: '#28a745' },
  { value: 'katilmadi', label: 'Katılmadı', color: '#dc3545' },
  { value: 'once_alindi', label: 'Sınav Uygulama Tarihinden Önce Alındı', color: '#ffc107' },
  { value: 'gec_katildi', label: 'Sınav Günü Geç Katıldı', color: '#17a2b8' },
  { value: 'sonra_katilacak', label: 'Sınav Tarihinden Sonra Katılacak', color: '#6c757d' }
];

const AttendanceModule = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [seatingPlan, setSeatingPlan] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [reasons, setReasons] = useState({});
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchExamsWithStats();
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*');
      if (!error && data) {
        setRooms(data);
      }
    } catch (err) {
      console.warn('Rooms tablosu okunamadı:', err);
    }
  };

  const fetchExamsWithStats = async () => {
    setLoading(true);
    try {
      const { data: examData, error: examErr } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (examErr) throw examErr;

      if (!examData || examData.length === 0) {
        setExams([]);
        setLoading(false);
        return;
      }

      const { data: plans } = await supabase.from('seating_plans').select('*');
      const { data: attData } = await supabase.from('attendance').select('*');

      const formattedExams = examData.map(exam => {
        const plan = (plans || []).find(p => String(p.exam_id) === String(exam.id));

        let assignments = [];
        if (plan?.assignments) {
          assignments = typeof plan.assignments === 'string' 
            ? JSON.parse(plan.assignments) 
            : plan.assignments;
        }

        // Sınıf/Kademe bilgisini dinamik olarak ayıkla
        const targetGrades = Array.from(
          new Set(
            assignments
              .map(a => a.grade || a.target_grade || a.class_level)
              .filter(Boolean)
          )
        ).sort((a, b) => a - b);

        const displayGrades = exam.target_grade || exam.grade || (targetGrades.length > 0 ? targetGrades.join(', ') + '. Sınıf' : '');

        const totalStudents = assignments.length;
        const examAtt = (attData || []).filter(a => String(a.exam_id) === String(exam.id));
        
        const absentCount = examAtt.filter(a => a.status === 'katilmadi').length;
        const attendedCount = totalStudents > 0 ? (totalStudents - absentCount) : 0;

        return {
          ...exam,
          totalStudents,
          attendedCount,
          absentCount,
          hasPlan: totalStudents > 0,
          displayGrades
        };
      });

      setExams(formattedExams);
    } catch (err) {
      console.error('Sınavlar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    setLoading(true);
    try {
      const { data: planData, error: planErr } = await supabase
        .from('seating_plans')
        .select('*')
        .eq('exam_id', exam.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (planErr) throw planErr;

      const plan = planData ? planData[0] : null;
      
      if (plan && typeof plan.assignments === 'string') {
        plan.assignments = JSON.parse(plan.assignments);
      }

      setSeatingPlan(plan);

      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('exam_id', exam.id);

      if (attErr) {
        console.error('Attendance verisi okunurken Supabase Hatası:', attErr);
      }

      const statusMap = {};
      const reasonMap = {};

      (attData || []).forEach(att => {
        const stId = String(att.student_id);
        statusMap[stId] = att.status;
        reasonMap[stId] = att.reason || '';
      });

      (plan?.assignments || []).forEach(st => {
        const rawId = st.studentId ?? st.student_id ?? st.id;
        const stId = String(rawId);
        if (!statusMap[stId]) {
          statusMap[stId] = 'katildi';
          reasonMap[stId] = '';
        }
      });

      setAttendanceRecords(statusMap);
      setReasons(reasonMap);
    } catch (err) {
      console.error('Yoklama detayları çekilemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId, status) => {
    const stId = String(studentId);
    setAttendanceRecords(prev => ({ ...prev, [stId]: status }));
  };

  const handleReasonChange = (studentId, reason) => {
    const stId = String(studentId);
    setReasons(prev => ({ ...prev, [stId]: reason }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedExam) return;
    setLoading(true);
    setMessage('');

    try {
      const assignments = seatingPlan?.assignments || [];
      const payload = assignments.map(st => {
        const rawId = st.studentId ?? st.student_id ?? st.id;
        const stId = String(rawId);
        return {
          exam_id: selectedExam.id,
          student_id: stId,
          status: attendanceRecords[stId] || 'katildi',
          reason: reasons[stId] || '',
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'exam_id,student_id' });

      if (error) throw error;

      setMessage('Yoklama başarıyla kaydedildi!');
      fetchExamsWithStats();
    } catch (err) {
      console.error('Kaydetme hatası:', err);
      setMessage('Yoklama kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRoomName = (item) => {
    const rawRoomId = item.roomId || item.room_id || item.salon_id || item.roomName || item.room_name || item.salon;

    if (rooms && rooms.length > 0 && rawRoomId) {
      const foundInDb = rooms.find(r => String(r.id) === String(rawRoomId));
      if (foundInDb && foundInDb.name) {
        return foundInDb.name;
      }
    }

    if (seatingPlan?.rooms && Array.isArray(seatingPlan.rooms)) {
      const foundInPlan = seatingPlan.rooms.find(r => 
        String(r.id) === String(rawRoomId) || String(r.roomId) === String(rawRoomId)
      );
      if (foundInPlan) {
        return foundInPlan.name || foundInPlan.roomName || `Salon ${foundInPlan.id}`;
      }
    }

    return rawRoomId || 'Bilinmeyen Salon';
  };

  const assignments = seatingPlan?.assignments || [];
  
  const rawKatildi = assignments.filter(a => attendanceRecords[String(a.studentId ?? a.student_id ?? a.id)] === 'katildi').length;
  const onceAlindi = assignments.filter(a => attendanceRecords[String(a.studentId ?? a.student_id ?? a.id)] === 'once_alindi').length;
  const gecKatildi = assignments.filter(a => attendanceRecords[String(a.studentId ?? a.student_id ?? a.id)] === 'gec_katildi').length;
  const sonraKatilacak = assignments.filter(a => attendanceRecords[String(a.studentId ?? a.student_id ?? a.id)] === 'sonra_katilacak').length;
  const rawKatilmadi = assignments.filter(a => attendanceRecords[String(a.studentId ?? a.student_id ?? a.id)] === 'katilmadi').length;

  const stats = {
    total: assignments.length,
    totalKatildi: rawKatildi + onceAlindi + gecKatildi + sonraKatilacak,
    totalKatilmadi: rawKatilmadi,
    onceAlindi,
    gecKatildi,
    sonraKatilacak
  };

  // Sol liste: Yalnızca Katılmadı
  const absentStudents = assignments.filter(st => {
    const stId = String(st.studentId ?? st.student_id ?? st.id);
    return attendanceRecords[stId] === 'katilmadi';
  });

  // Sağ liste: Önce Alındı, Geç Katıldı veya Sonra Katılacak
  const specialStatusStudents = assignments.filter(st => {
    const stId = String(st.studentId ?? st.student_id ?? st.id);
    const status = attendanceRecords[stId];
    return status === 'once_alindi' || status === 'gec_katildi' || status === 'sonra_katilacak';
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'once_alindi':
        return <span style={{ background: '#ffc107', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Önce Alındı</span>;
      case 'gec_katildi':
        return <span style={{ background: '#17a2b8', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Geç Katıldı</span>;
      case 'sonra_katilacak':
        return <span style={{ background: '#6c757d', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Sonra Katılacak</span>;
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {!selectedExam ? (
        <div>
          <h2>📋 Sınav Yoklama Yönetimi</h2>
          <p style={{ color: '#666' }}>Yoklama almak istediğiniz tanımlanmış sınavı seçin.</p>
          
          {loading ? <p>Yükleniyor...</p> : (
            <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
              {exams.length === 0 ? (
                <p>Henüz tanımlanmış bir sınav bulunamadı.</p>
              ) : (
                exams.map(exam => (
                  <div 
                    key={exam.id}
                    onClick={() => {
                      if (!exam.hasPlan) {
                        alert('Bu sınav için henüz oturma planı oluşturulmamış.');
                        return;
                      }
                      handleSelectExam(exam);
                    }}
                    style={{
                      padding: '1.2rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: exam.hasPlan ? '#fff' : '#f7fafc',
                      opacity: exam.hasPlan ? 1 : 0.7,
                      cursor: exam.hasPlan ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <h3 style={{ margin: 0, color: '#1a202c' }}>
                          {exam.title} {!exam.hasPlan && <span style={{ fontSize: '0.75rem', color: '#e53e3e' }}>(Oturma Planı Yok)</span>}
                        </h3>
                        {exam.displayGrades && (
                          <span style={{
                            background: '#e2e8f0',
                            color: '#4a5568',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            {exam.displayGrades}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.85rem', color: '#718096' }}>Tarih: {exam.date}</span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#28a745' }}>{exam.attendedCount}</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>Katılan</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#dc3545' }}>{exam.absentCount}</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>Katılmayan</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#2d3748' }}>{exam.totalStudents}</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>Toplam Öğrenci</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <button 
            onClick={() => setSelectedExam(null)}
            style={{ padding: '0.4rem 0.8rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '1rem' }}
          >
            ← Sınav Listesine Dön
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>📝 {selectedExam.title} - Yoklama Girişi</h2>
            <button
              onClick={handleSaveAttendance}
              disabled={loading}
              style={{ padding: '0.6rem 1.2rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              💾 Yoklamayı Kaydet
            </button>
          </div>

          {message && (
            <p style={{ padding: '0.6rem', borderRadius: '4px', margin: '1rem 0', background: message.includes('hata') ? '#f8d7da' : '#d4edda', color: message.includes('hata') ? '#721c24' : '#155724' }}>
              {message}
            </p>
          )}

          {/* İSTATİSTİK KARTLARI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.8rem', margin: '1.5rem 0' }}>
            <div style={{ background: '#f8f9fa', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Toplam Öğrenci</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#333' }}>{stats.total}</div>
            </div>
            <div style={{ background: '#d4edda', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #c3e6cb' }}>
              <div style={{ fontSize: '0.75rem', color: '#155724', fontWeight: 'bold' }}>Top. Katıldı</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#155724' }}>{stats.totalKatildi}</div>
            </div>
            <div style={{ background: '#f8d7da', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #f5c6cb' }}>
              <div style={{ fontSize: '0.75rem', color: '#721c24', fontWeight: 'bold' }}>Top. Katılmadı</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#721c24' }}>{stats.totalKatilmadi}</div>
            </div>
            <div style={{ background: '#fff3cd', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #ffeeba' }}>
              <div style={{ fontSize: '0.75rem', color: '#856404' }}>Önce Alındı</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#856404' }}>{stats.onceAlindi}</div>
            </div>
            <div style={{ background: '#d1ecf1', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #bee5eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#0c5460' }}>Geç Katıldı</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0c5460' }}>{stats.gecKatildi}</div>
            </div>
            <div style={{ background: '#e2e3e5', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #d6d8db' }}>
              <div style={{ fontSize: '0.75rem', color: '#383d41' }}>Sonra Katılacak</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#383d41' }}>{stats.sonraKatilacak}</div>
            </div>
          </div>

          {/* TAB MENÜSÜ */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '0.6rem 1.2rem',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'all' ? '3px solid #007bff' : 'none',
                fontWeight: activeTab === 'all' ? 'bold' : 'normal',
                cursor: 'pointer'
              }}
            >
              👥 Tüm Öğrenci Listesi ({assignments.length})
            </button>
            <button
              onClick={() => setActiveTab('details')}
              style={{
                padding: '0.6rem 1.2rem',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'details' ? '3px solid #dc3545' : 'none',
                fontWeight: activeTab === 'details' ? 'bold' : 'normal',
                color: activeTab === 'details' ? '#dc3545' : '#333',
                cursor: 'pointer'
              }}
            >
              ⚠️ Katılmayanlar & Özel Durumlar ({absentStudents.length + specialStatusStudents.length})
            </button>
          </div>

          {activeTab === 'all' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
              <thead style={{ background: '#f8f9fa' }}>
                <tr>
                  <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Sıra No</th>
                  <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Salon</th>
                  <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Öğrenci Adı</th>
                  <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Sınıf/Şube</th>
                  <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Yoklama Durumu</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item, idx) => {
                  const rawId = item.studentId ?? item.student_id ?? item.id;
                  const stId = String(rawId);
                  const stName = item.studentName || item.student_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name;
                  const currentStatus = attendanceRecords[stId] || 'katildi';
                  const roomName = getRoomName(item);

                  return (
                    <tr key={stId || idx} style={{ borderBottom: '1px solid #eee', textAlign: 'center' }}>
                      <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>{item.seatNumber || item.seat_number || item.siraNo || (idx + 1)}</td>
                      <td style={{ padding: '0.6rem' }}>{roomName}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'left', fontWeight: '500' }}>{stName}</td>
                      <td style={{ padding: '0.6rem' }}>{item.grade || ''}-{item.class || item.className || ''}</td>
                      <td style={{ padding: '0.6rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                          {STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => handleStatusChange(stId, opt.value)}
                              style={{
                                padding: '0.3rem 0.6rem',
                                fontSize: '0.8rem',
                                border: '1px solid',
                                borderColor: currentStatus === opt.value ? opt.color : '#ccc',
                                background: currentStatus === opt.value ? opt.color : '#fff',
                                color: currentStatus === opt.value ? '#fff' : '#333',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'details' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* SOL TARAF: KATILMAYANLAR & MAZERETLERİ */}
              <div style={{ background: '#fff', border: '1px solid #f5c6cb', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#fff5f5', padding: '0.8rem 1rem', borderBottom: '1px solid #f5c6cb', fontWeight: 'bold', color: '#721c24' }}>
                  ❌ Katılmayanlar ({absentStudents.length})
                </div>
                {absentStudents.length === 0 ? (
                  <p style={{ padding: '1.5rem', textAlign: 'center', color: '#666', margin: 0 }}>
                    🎉 Katılmayan öğrenci yok.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#fafafa', fontSize: '0.85rem' }}>
                      <tr>
                        <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Salon/Sıra</th>
                        <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Öğrenci</th>
                        <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Mazeret / Açıklama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absentStudents.map((item, idx) => {
                        const rawId = item.studentId ?? item.student_id ?? item.id;
                        const stId = String(rawId);
                        const stName = item.studentName || item.student_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name;
                        const roomName = getRoomName(item);

                        return (
                          <tr key={stId || idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                              {roomName} - S:{item.seatNumber || item.seat_number || (idx + 1)}
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                              {stName}
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>{item.grade || ''}-{item.class || item.className || ''}</div>
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="Örn: İzinli, Raporlu..."
                                value={reasons[stId] || ''}
                                onChange={(e) => handleReasonChange(stId, e.target.value)}
                                style={{ width: '90%', padding: '0.3rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.85rem' }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SAĞ TARAF: ÖNCE ALINDI / GEÇ KATILDI / SONRA KATILACAK */}
              <div style={{ background: '#fff', border: '1px solid #bee5eb', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#e3f2fd', padding: '0.8rem 1rem', borderBottom: '1px solid #bee5eb', fontWeight: 'bold', color: '#0c5460' }}>
                  ⏳ Özel Durumlu Katılımlar ({specialStatusStudents.length})
                </div>
                {specialStatusStudents.length === 0 ? (
                  <p style={{ padding: '1.5rem', textAlign: 'center', color: '#666', margin: 0 }}>
                    Özel durumda (önce, geç veya sonra) katılan öğrenci bulunmuyor.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#fafafa', fontSize: '0.85rem' }}>
                      <tr>
                        <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Salon/Sıra</th>
                        <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Öğrenci</th>
                        <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Durumu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specialStatusStudents.map((item, idx) => {
                        const rawId = item.studentId ?? item.student_id ?? item.id;
                        const stId = String(rawId);
                        const stName = item.studentName || item.student_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name;
                        const roomName = getRoomName(item);
                        const status = attendanceRecords[stId];

                        return (
                          <tr key={stId || idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                              {roomName} - S:{item.seatNumber || item.seat_number || (idx + 1)}
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                              {stName}
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>{item.grade || ''}-{item.class || item.className || ''}</div>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {getStatusBadge(status)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceModule;