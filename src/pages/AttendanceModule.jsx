import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const STATUS_OPTIONS = [
  { value: 'katildi', label: 'Katıldı', color: '#28a745' },
  { value: 'katilmadi', label: 'Katılmadı', color: '#dc3545' },
  { value: 'once_alindi', label: 'Sınavdan Önce Alındı', color: '#ffc107' },
  { value: 'gec_katilacak', label: 'Geç Katılacak', color: '#17a2b8' }
];

const AttendanceModule = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [seatingPlan, setSeatingPlan] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [reasons, setReasons] = useState({});
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchExamsWithStats();
  }, []);

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

      const { data: plans, error: planErr } = await supabase
        .from('seating_plans')
        .select('*');

      if (planErr) console.error('Seating plans çekilemedi:', planErr);

      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .select('*');

      if (attErr) console.error('Attendance çekilemedi:', attErr);

      const formattedExams = examData.map(exam => {
        // exam_id veya examId alanlarını hem String hem Number tipinde kontrol ediyoruz
        const plan = (plans || []).find(p => {
          const planExamId = p.exam_id !== undefined ? p.exam_id : p.examId;
          return String(planExamId) === String(exam.id);
        });

        let assignments = [];
        if (plan?.assignments) {
          assignments = typeof plan.assignments === 'string' 
            ? JSON.parse(plan.assignments) 
            : plan.assignments;
        }

        const totalStudents = assignments.length;
        const examAtt = (attData || []).filter(a => String(a.exam_id) === String(exam.id));
        const absentCount = examAtt.filter(a => a.status === 'katilmadi').length;
        const attendedCount = totalStudents > 0 ? (totalStudents - absentCount) : 0;

        return {
          ...exam,
          totalStudents,
          attendedCount,
          absentCount,
          hasPlan: totalStudents > 0
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
        .or(`exam_id.eq.${exam.id},examId.eq.${exam.id}`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (planErr) throw planErr;

      const plan = planData[0];
      
      if (plan && typeof plan.assignments === 'string') {
        plan.assignments = JSON.parse(plan.assignments);
      }

      setSeatingPlan(plan);

      const { data: attData, error: attErr } = await supabase
        .from('attendance')
        .eq('exam_id', exam.id);
      if (attErr) throw attErr;

      const statusMap = {};
      const reasonMap = {};
      
      (plan?.assignments || []).forEach(st => {
        const stId = st.studentId || st.student_id;
        statusMap[stId] = 'katildi';
        reasonMap[stId] = '';
      });

      (attData || []).forEach(att => {
        statusMap[att.student_id] = att.status;
        reasonMap[att.student_id] = att.reason || '';
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
    setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
  };

  const handleReasonChange = (studentId, reason) => {
    setReasons(prev => ({ ...prev, [studentId]: reason }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedExam) return;
    setLoading(true);
    setMessage('');

    try {
      const assignments = seatingPlan?.assignments || [];
      const payload = assignments.map(st => {
        const stId = st.studentId || st.student_id;
        return {
          exam_id: selectedExam.id,
          student_id: String(stId),
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
    if (item.roomName) return item.roomName;
    if (item.room_name) return item.room_name;
    if (item.salon) return item.salon;
    if (item.salonAdi) return item.salonAdi;

    if (seatingPlan?.rooms && Array.isArray(seatingPlan.rooms)) {
      const targetRoomId = item.roomId || item.room_id || item.salon_id;
      const foundRoom = seatingPlan.rooms.find(r => 
        String(r.id) === String(targetRoomId) || String(r.roomId) === String(targetRoomId)
      );
      if (foundRoom) {
        return foundRoom.name || foundRoom.roomName || foundRoom.salonAdi || `Salon ${foundRoom.id}`;
      }
    }

    return item.roomId || item.room_id || '-';
  };

  const assignments = seatingPlan?.assignments || [];
  const stats = {
    total: assignments.length,
    katildi: assignments.filter(a => (attendanceRecords[a.studentId || a.student_id] || 'katildi') === 'katildi').length,
    katilmadi: assignments.filter(a => attendanceRecords[a.studentId || a.student_id] === 'katilmadi').length,
    once_alindi: assignments.filter(a => attendanceRecords[a.studentId || a.student_id] === 'once_alindi').length,
    gec_katilacak: assignments.filter(a => attendanceRecords[a.studentId || a.student_id] === 'gec_katilacak').length,
  };

  const absentStudents = assignments.filter(st => {
    const stId = st.studentId || st.student_id;
    return attendanceRecords[stId] === 'katilmadi';
  });

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
                    <div>
                      <h3 style={{ margin: '0 0 0.4rem 0', color: '#1a202c' }}>
                        {exam.title} {!exam.hasPlan && <span style={{ fontSize: '0.75rem', color: '#e53e3e' }}>(Oturma Planı Yok)</span>}
                      </h3>
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
            <p style={{ padding: '0.6rem', borderRadius: '4px', background: message.includes('hata') ? '#f8d7da' : '#d4edda', color: message.includes('hata') ? '#721c24' : '#155724' }}>
              {message}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', margin: '1.5rem 0' }}>
            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Toplam Öğrenci</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>{stats.total}</div>
            </div>
            <div style={{ background: '#d4edda', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #c3e6cb' }}>
              <div style={{ fontSize: '0.85rem', color: '#155724' }}>Katıldı</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#155724' }}>{stats.katildi}</div>
            </div>
            <div style={{ background: '#f8d7da', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #f5c6cb' }}>
              <div style={{ fontSize: '0.85rem', color: '#721c24' }}>Katılmadı</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#721c24' }}>{stats.katilmadi}</div>
            </div>
            <div style={{ background: '#fff3cd', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #ffeeba' }}>
              <div style={{ fontSize: '0.85rem', color: '#856404' }}>Sınavdan Önce Alındı</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#856404' }}>{stats.once_alindi}</div>
            </div>
            <div style={{ background: '#d1ecf1', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #bee5eb' }}>
              <div style={{ fontSize: '0.85rem', color: '#0c5460' }}>Geç Katılacak</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0c5460' }}>{stats.gec_katilacak}</div>
            </div>
          </div>

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
              onClick={() => setActiveTab('absent')}
              style={{
                padding: '0.6rem 1.2rem',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'absent' ? '3px solid #dc3545' : 'none',
                fontWeight: activeTab === 'absent' ? 'bold' : 'normal',
                color: activeTab === 'absent' ? '#dc3545' : '#333',
                cursor: 'pointer'
              }}
            >
              ⚠️ Katılmayanlar & Nedenleri ({absentStudents.length})
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
                  const stId = item.studentId || item.student_id;
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

          {activeTab === 'absent' && (
            <div>
              {absentStudents.length === 0 ? (
                <p style={{ padding: '2rem', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
                  🎉 Harika! Sınava katılmayan öğrenci bulunmuyor.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
                  <thead style={{ background: '#fff5f5' }}>
                    <tr>
                      <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Salon - Sıra</th>
                      <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Öğrenci Adı</th>
                      <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Sınıf</th>
                      <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Katılmama Nedeni / Mazeret Açıklaması</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absentStudents.map((item, idx) => {
                      const stId = item.studentId || item.student_id;
                      const stName = item.studentName || item.student_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name;
                      const roomName = getRoomName(item);

                      return (
                        <tr key={stId || idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                            {roomName} / Sıra: {item.seatNumber || item.seat_number || (idx + 1)}
                          </td>
                          <td style={{ padding: '0.6rem', fontWeight: '500' }}>{stName}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'center' }}>{item.grade || ''}-{item.class || item.className || ''}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <input
                              type="text"
                              placeholder="Örn: İzinli, Raporlu, Sevkli..."
                              value={reasons[stId] || ''}
                              onChange={(e) => handleReasonChange(stId, e.target.value)}
                              style={{ width: '95%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceModule;