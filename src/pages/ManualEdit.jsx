import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const ManualEdit = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [seatingPlan, setSeatingPlan] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  // Sınavları ve salonları getir
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Sınavları getir
        const { data: examData, error: examError } = await supabase
          .from('exams')
          .select('*')
          .order('createdAt', { ascending: false });
        if (examError) throw examError;
        setExams(examData || []);

        // Salonları getir
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .order('name', { ascending: true });
        if (roomError) throw roomError;
        setRooms(roomData || []);
      } catch (error) {
        console.error('Veri alınamadı:', error);
      }
    };
    fetchData();
  }, []);

  // Sınav seçilince oturma planını getir (en son oluşturulan)
  useEffect(() => {
    if (!selectedExam) {
      setSeatingPlan(null);
      setAssignments([]);
      return;
    }
    const fetchSeatingPlan = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('seating_plans')
          .select('*')
          .eq('examId', selectedExam)
          .order('createdAt', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
          setMessage('Bu sınava ait oturma planı bulunamadı.');
          setSeatingPlan(null);
          setAssignments([]);
          setLoading(false);
          return;
        }

        const plan = data[0];
        setSeatingPlan(plan);
        setAssignments(plan.assignments || []);
        setMessage(`${plan.assignments?.length || 0} öğrenci bulundu.`);
      } catch (error) {
        console.error('Oturma planı alınamadı:', error);
        setMessage('Oturma planı alınamadı: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSeatingPlan();
  }, [selectedExam]);

  // Öğrencinin salonunu değiştir
  const handleRoomChange = (index, newRoomId) => {
    const updated = [...assignments];
    updated[index].roomId = newRoomId;
    setAssignments(updated);
    setEditing(true);
  };

  // Öğrencinin sıra numarasını değiştir
  const handleSeatChange = (index, newSeat) => {
    const updated = [...assignments];
    updated[index].seatNumber = parseInt(newSeat);
    setAssignments(updated);
    setEditing(true);
  };

  // Değişiklikleri kaydet
  const handleSave = async () => {
    if (!seatingPlan) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('seating_plans')
        .update({
          assignments: assignments,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', seatingPlan.id);

      if (error) throw error;

      setMessage('Değişiklikler kaydedildi.');
      setEditing(false);
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      setMessage('Kaydedilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Değişiklikleri iptal et
  const handleCancel = () => {
    if (seatingPlan) {
      setAssignments(seatingPlan.assignments || []);
      setEditing(false);
      setMessage('Değişiklikler iptal edildi.');
    }
  };

  // Salon bazlı gruplama
  const groupByRoom = () => {
    const groups = {};
    assignments.forEach(item => {
      const roomName = rooms.find(r => r.id === item.roomId)?.name || item.roomId;
      if (!groups[roomName]) groups[roomName] = [];
      groups[roomName].push(item);
    });
    return groups;
  };

  const grouped = groupByRoom();

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🖊️ Manuel Sıra / Salon Düzenleme</h2>

      {/* Sınav Seçimi */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label>Sınav Seçin</label>
        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="">-- Sınav Seçin --</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>
              {exam.title} ({exam.date}) - {exam.gradeLevels?.join(', ')}. Sınıflar
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Yükleniyor...</p>}
      {message && <p style={{ color: message.includes('hata') ? 'red' : 'green' }}>{message}</p>}

      {/* Salon Bazlı Liste */}
      {assignments.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4>Oturma Planı ({assignments.length} öğrenci)</h4>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {editing && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{
                      padding: '0.4rem 1rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    💾 Kaydet
                  </button>
                  <button
                    onClick={handleCancel}
                    style={{
                      padding: '0.4rem 1rem',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    ↩️ İptal
                  </button>
                </>
              )}
            </div>
          </div>

          {Object.keys(grouped).map(roomName => (
            <div key={roomName} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
              <h4 style={{ marginTop: 0 }}>🏫 {roomName}</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                <thead style={{ background: '#f1f1f1' }}>
                  <tr>
                    <th style={{ padding: '0.5rem' }}>#</th>
                    <th style={{ padding: '0.5rem' }}>Öğrenci</th>
                    <th style={{ padding: '0.5rem' }}>Sınıf</th>
                    <th style={{ padding: '0.5rem' }}>Salon</th>
                    <th style={{ padding: '0.5rem' }}>Sıra No</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[roomName].map((item, idx) => {
                    const globalIndex = assignments.findIndex(a => a.studentId === item.studentId);
                    return (
                      <tr key={item.studentId} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem' }}>{item.studentName}</td>
                        <td style={{ padding: '0.5rem' }}>{item.grade}-{item.class}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <select
                            value={item.roomId}
                            onChange={(e) => handleRoomChange(globalIndex, e.target.value)}
                            style={{ padding: '0.2rem', borderRadius: '4px', border: '1px solid #ddd' }}
                          >
                            {rooms.map(room => (
                              <option key={room.id} value={room.id}>
                                {room.name} ({room.capacity})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.seatNumber}
                            onChange={(e) => handleSeatChange(globalIndex, e.target.value)}
                            style={{ width: '60px', padding: '0.2rem', border: '1px solid #ddd', borderRadius: '4px' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManualEdit;