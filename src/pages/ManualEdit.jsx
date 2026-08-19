import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaEdit, FaSave, FaUndo, FaTrash } from 'react-icons/fa';

const ManualEdit = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [seatingPlans, setSeatingPlans] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editRoomId, setEditRoomId] = useState('');
  const [editSeatNumber, setEditSeatNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Tüm sınavları getir
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setExams(data);
      } catch (error) {
        console.error('Sınavlar alınamadı:', error);
      }
    };
    fetchExams();
  }, []);

  // Seçili sınava ait oturma planlarını getir
  useEffect(() => {
    if (!selectedExam) {
      setSeatingPlans([]);
      setAssignments([]);
      return;
    }

    const fetchSeatingPlans = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'seating_plans'),
          where('examId', '==', selectedExam),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSeatingPlans(data);
        if (data.length > 0) {
          setAssignments(data[0].assignments || []);
          setMessage(`${assignments.length} öğrenci bulundu.`);
        } else {
          setAssignments([]);
          setMessage('Bu sınav için oturma planı bulunamadı.');
        }
      } catch (error) {
        console.error('Oturma planı alınamadı:', error);
        setMessage('Oturma planı alınırken hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    fetchSeatingPlans();
  }, [selectedExam]);

  // Düzenleme moduna geç
  const startEditing = (index) => {
    setEditingIndex(index);
    setEditRoomId(assignments[index].roomId || '');
    setEditSeatNumber(assignments[index].seatNumber || '');
  };

  // Değişiklikleri kaydet
  const saveEdit = async (index) => {
    if (!editRoomId || !editSeatNumber) {
      setMessage('Salon ve sıra numarası boş olamaz.');
      return;
    }

    const updatedAssignments = [...assignments];
    updatedAssignments[index] = {
      ...updatedAssignments[index],
      roomId: editRoomId,
      seatNumber: parseInt(editSeatNumber, 10),
    };

    try {
      // Firestore'da güncelle
      const planId = seatingPlans[0].id;
      await updateDoc(doc(db, 'seating_plans', planId), {
        assignments: updatedAssignments,
      });

      setAssignments(updatedAssignments);
      setEditingIndex(null);
      setMessage('Değişiklikler kaydedildi.');
    } catch (error) {
      console.error('Güncelleme hatası:', error);
      setMessage('Güncelleme sırasında hata oluştu.');
    }
  };

  // Düzenlemeyi iptal et
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditRoomId('');
    setEditSeatNumber('');
  };

  // Öğrenciyi sil (opsiyonel)
  const removeStudent = async (index) => {
    if (!window.confirm('Bu öğrenciyi oturma planından çıkarmak istediğinize emin misiniz?')) return;

    const updatedAssignments = assignments.filter((_, i) => i !== index);
    try {
      const planId = seatingPlans[0].id;
      await updateDoc(doc(db, 'seating_plans', planId), {
        assignments: updatedAssignments,
      });
      setAssignments(updatedAssignments);
      setMessage('Öğrenci çıkarıldı.');
    } catch (error) {
      console.error('Silme hatası:', error);
      setMessage('Silme sırasında hata oluştu.');
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🔄 Manuel Sıra / Salon Düzenleme</h2>

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

      {/* Oturma Planı Listesi */}
      {assignments.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h4>Oturma Planı ({assignments.length} öğrenci)</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
              <thead style={{ background: '#f1f1f1' }}>
                <tr>
                  <th>#</th>
                  <th>Öğrenci</th>
                  <th>Sınıf</th>
                  <th>Salon</th>
                  <th>Sıra No</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ padding: '0.5rem' }}>{item.studentName}</td>
                    <td style={{ padding: '0.5rem' }}>{item.grade}-{item.class}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {editingIndex === index ? (
                        <input
                          type="text"
                          value={editRoomId}
                          onChange={(e) => setEditRoomId(e.target.value)}
                          style={{ width: '100%', padding: '0.3rem', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      ) : (
                        item.roomId
                      )}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      {editingIndex === index ? (
                        <input
                          type="number"
                          value={editSeatNumber}
                          onChange={(e) => setEditSeatNumber(e.target.value)}
                          style={{ width: '80px', padding: '0.3rem', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      ) : (
                        item.seatNumber
                      )}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      {editingIndex === index ? (
                        <>
                          <button
                            onClick={() => saveEdit(index)}
                            style={{ background: 'transparent', border: 'none', color: '#28a745', cursor: 'pointer', marginRight: '0.5rem' }}
                          >
                            <FaSave />
                          </button>
                          <button
                            onClick={cancelEdit}
                            style={{ background: 'transparent', border: 'none', color: '#6c757d', cursor: 'pointer' }}
                          >
                            <FaUndo />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(index)}
                            style={{ background: 'transparent', border: 'none', color: '#ffc107', cursor: 'pointer', marginRight: '0.5rem' }}
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => removeStudent(index)}
                            style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}
                          >
                            <FaTrash />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualEdit;