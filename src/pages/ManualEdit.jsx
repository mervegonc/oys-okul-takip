import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaSave, FaUndo, FaExchangeAlt } from 'react-icons/fa';

const ManualEdit = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [seatingPlan, setSeatingPlan] = useState(null); // { id, examId, assignments: [] }
  const [assignments, setAssignments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Tüm sınavları ve salonları getir
  useEffect(() => {
    const fetchData = async () => {
      try {
        const examSnap = await getDocs(query(collection(db, 'exams'), orderBy('createdAt', 'desc')));
        const examData = examSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setExams(examData);

        const roomSnap = await getDocs(collection(db, 'rooms'));
        const roomData = roomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRooms(roomData);
      } catch (error) {
        console.error('Veri alınamadı:', error);
      }
    };
    fetchData();
  }, []);

  // Seçilen sınava ait oturma planını getir
  useEffect(() => {
    if (!selectedExam) {
      setSeatingPlan(null);
      setAssignments([]);
      return;
    }

    const fetchSeatingPlan = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'seating_plans'),
          where('examId', '==', selectedExam),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setMessage('Bu sınav için henüz karma dağıtımı yapılmamış.');
          setSeatingPlan(null);
          setAssignments([]);
          setLoading(false);
          return;
        }
        const docData = snap.docs[0];
        const data = { id: docData.id, ...docData.data() };
        setSeatingPlan(data);
        setAssignments(data.assignments || []);
        setMessage(`${data.assignments?.length || 0} öğrenci bulundu.`);
      } catch (error) {
        console.error('Oturma planı alınamadı:', error);
        setMessage('Oturma planı alınırken hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    fetchSeatingPlan();
  }, [selectedExam]);

  // Salon değiştirme
  const handleRoomChange = (index, newRoomId) => {
    const updated = [...assignments];
    updated[index].roomId = newRoomId;
    setAssignments(updated);
  };

  // Sıra numarası değiştirme
  const handleSeatChange = (index, newSeat) => {
    const updated = [...assignments];
    updated[index].seatNumber = parseInt(newSeat, 10) || 0;
    setAssignments(updated);
  };

  // İki öğrencinin salonunu ve sırasını takas et (basitçe buton ekleyelim)
  const swapStudents = (index1, index2) => {
    if (index1 === index2) return;
    const updated = [...assignments];
    const tempRoom = updated[index1].roomId;
    const tempSeat = updated[index1].seatNumber;
    updated[index1].roomId = updated[index2].roomId;
    updated[index1].seatNumber = updated[index2].seatNumber;
    updated[index2].roomId = tempRoom;
    updated[index2].seatNumber = tempSeat;
    setAssignments(updated);
  };

  // Değişiklikleri kaydet
  const saveChanges = async () => {
    if (!seatingPlan) {
      setMessage('Kaydedilecek bir oturma planı yok.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'seating_plans', seatingPlan.id), {
        assignments: assignments,
        updatedAt: new Date(),
      });
      setMessage('Değişiklikler başarıyla kaydedildi!');
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      setMessage('Kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  // Değişiklikleri geri al (yeniden yükle)
  const resetChanges = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'seating_plans'),
        where('examId', '==', selectedExam),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setAssignments(data.assignments || []);
        setMessage('Değişiklikler geri alındı.');
      }
    } catch (error) {
      console.error('Yeniden yükleme hatası:', error);
      setMessage('Yeniden yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Salon adını bul
  const getRoomName = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : roomId;
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>✏️ Oturma Planı Manuel Düzenleme</h2>

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

      {assignments.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={saveChanges}
              disabled={saving}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FaSave /> {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
            <button
              onClick={resetChanges}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#ffc107',
                color: '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FaUndo /> Geri Al
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
              <thead style={{ background: '#f1f1f1' }}>
                <tr>
                  <th>#</th>
                  <th>Öğrenci</th>
                  <th>Sınıf</th>
                  <th>Mevcut Salon</th>
                  <th>Yeni Salon</th>
                  <th>Mevcut Sıra</th>
                  <th>Yeni Sıra</th>
                  <th>Takas</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ padding: '0.5rem' }}>{item.studentName}</td>
                    <td style={{ padding: '0.5rem' }}>{item.grade}-{item.class}</td>
                    <td style={{ padding: '0.5rem' }}>{getRoomName(item.roomId)}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <select
                        value={item.roomId}
                        onChange={(e) => handleRoomChange(index, e.target.value)}
                        style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #ddd' }}
                      >
                        {rooms.map(room => (
                          <option key={room.id} value={room.id}>
                            {room.name} ({room.capacity + (room.extraSeatsAdded || 0)})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.seatNumber}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <input
                        type="number"
                        min="1"
                        value={item.seatNumber}
                        onChange={(e) => handleSeatChange(index, e.target.value)}
                        style={{ width: '60px', padding: '0.3rem', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          const target = prompt('Takas etmek istediğiniz öğrencinin sıra numarasını girin (1-' + assignments.length + '):');
                          if (target) {
                            const idx = parseInt(target, 10) - 1;
                            if (idx >= 0 && idx < assignments.length && idx !== index) {
                              swapStudents(index, idx);
                            } else {
                              alert('Geçersiz sıra numarası.');
                            }
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer' }}
                      >
                        <FaExchangeAlt />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {message && <p style={{ marginTop: '1rem', color: message.includes('hata') ? 'red' : 'green' }}>{message}</p>}
    </div>
  );
};

export default ManualEdit;