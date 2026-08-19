import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaSync, FaSave, FaEdit, FaTrash, FaPlus, FaTimes } from 'react-icons/fa';

const SeatingDistribution = () => {
  // Temel state'ler
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Şube grupları (eski mantık)
  const [groupConfig, setGroupConfig] = useState([]);
  
  // Çakışma grupları (yeni)
  const [conflictGroups, setConflictGroups] = useState([]);
  const [newConflictGroupName, setNewConflictGroupName] = useState('');
  const [editingGroupIndex, setEditingGroupIndex] = useState(null);
  const [tempStudents, setTempStudents] = useState([]);

  // Tüm sınavları ve salonları getir
  useEffect(() => {
    const fetchData = async () => {
      try {
        const examSnap = await getDocs(query(collection(db, 'exams'), orderBy('createdAt', 'desc')));
        const examData = examSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setExams(examData);

        const roomSnap = await getDocs(query(collection(db, 'rooms'), orderBy('name', 'asc')));
        const roomData = roomSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRooms(roomData);
      } catch (error) {
        console.error('Veri alınamadı:', error);
      }
    };
    fetchData();
  }, []);

  // Seçili sınava göre öğrencileri getir
  useEffect(() => {
    if (!selectedExam) {
      setStudents([]);
      return;
    }
    const fetchStudentsForExam = async () => {
      const exam = exams.find(e => e.id === selectedExam);
      if (!exam) return;
      const gradeLevels = exam.gradeLevels || [];
      if (gradeLevels.length === 0) {
        setStudents([]);
        return;
      }
      try {
        const q = query(
          collection(db, 'students'),
          where('grade', 'in', gradeLevels.map(String))
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStudents(data);
        setMessage(`${data.length} öğrenci bulundu.`);
      } catch (error) {
        console.error('Öğrenciler alınamadı:', error);
        setMessage('Öğrenciler alınırken hata oluştu.');
      }
    };
    fetchStudentsForExam();
  }, [selectedExam, exams]);

  // Şube grupları yönetimi
  const addGroup = () => {
    setGroupConfig([...groupConfig, { id: Date.now(), classes: [] }]);
  };
  const removeGroup = (groupId) => {
    setGroupConfig(groupConfig.filter(g => g.id !== groupId));
  };
  const updateGroupClasses = (groupId, value) => {
    setGroupConfig(groupConfig.map(g =>
      g.id === groupId ? { ...g, classes: value.split(',').map(s => s.trim()) } : g
    ));
  };

  // Çakışma grupları yönetimi
  const addConflictGroup = () => {
    if (!newConflictGroupName.trim()) {
      setMessage('Lütfen grup adı girin.');
      return;
    }
    setConflictGroups([
      ...conflictGroups,
      {
        id: Date.now(),
        name: newConflictGroupName.trim(),
        studentIds: [],
      },
    ]);
    setNewConflictGroupName('');
  };

  const removeConflictGroup = (groupId) => {
    if (window.confirm('Bu çakışma grubunu silmek istediğinize emin misiniz?')) {
      setConflictGroups(conflictGroups.filter(g => g.id !== groupId));
    }
  };

  const startEditingGroup = (index) => {
    setEditingGroupIndex(index);
    setTempStudents(conflictGroups[index].studentIds);
  };

  const cancelEditing = () => {
    setEditingGroupIndex(null);
    setTempStudents([]);
  };

  const saveConflictGroup = (groupId) => {
    if (tempStudents.length < 2) {
      setMessage('Bir çakışma grubunda en az 2 öğrenci olmalıdır.');
      return;
    }
    setConflictGroups(conflictGroups.map(g =>
      g.id === groupId ? { ...g, studentIds: tempStudents } : g
    ));
    setEditingGroupIndex(null);
    setTempStudents([]);
    setMessage('Çakışma grubu güncellendi.');
  };

  const toggleStudentInGroup = (studentId) => {
    if (tempStudents.includes(studentId)) {
      setTempStudents(tempStudents.filter(id => id !== studentId));
    } else {
      setTempStudents([...tempStudents, studentId]);
    }
  };

  // Karma dağıtım algoritması (çakışma kontrolü ile)
  const runDistribution = async () => {
    if (!selectedExam) {
      setMessage('Lütfen bir sınav seçin.');
      return;
    }
    if (selectedRooms.length === 0) {
      setMessage('Lütfen en az bir salon seçin.');
      return;
    }
    if (students.length === 0) {
      setMessage('Bu sınava uygun öğrenci bulunamadı.');
      return;
    }

    setLoading(true);
    setMessage('Karma dağıtım başlatılıyor...');

    try {
      const exam = exams.find(e => e.id === selectedExam);
      const roomData = rooms.filter(r => selectedRooms.includes(r.id));

      // Kapasite kontrolü
      const totalCapacity = roomData.reduce((acc, r) => acc + (r.capacity + (r.extraSeatsAdded || 0)), 0);
      if (totalCapacity < students.length) {
        setMessage(`Yetersiz kapasite! Toplam kapasite: ${totalCapacity}, Öğrenci sayısı: ${students.length}`);
        setLoading(false);
        return;
      }

      // Öğrencileri grupla (şube gruplarına göre)
      let studentGroups = [];
      if (exam.type === 'academic' && exam.level === 'high' && groupConfig.length > 0) {
        const ungrouped = [...students];
        groupConfig.forEach(group => {
          const groupStudents = ungrouped.filter(s => group.classes.includes(s.class));
          if (groupStudents.length > 0) {
            studentGroups.push(groupStudents);
            groupStudents.forEach(s => {
              const idx = ungrouped.findIndex(u => u.id === s.id);
              if (idx > -1) ungrouped.splice(idx, 1);
            });
          }
        });
        if (ungrouped.length > 0) studentGroups.push(ungrouped);
      } else if (exam.type === 'foreign_lang' && exam.level === 'high') {
        const groups = {};
        students.forEach(s => {
          const key = `${s.englishLevel || 'Core'}_${s.secondLang || 'None'}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
        });
        studentGroups = Object.values(groups);
      } else if (exam.type === 'academic' && exam.level === 'middle') {
        studentGroups = [students];
      } else if (exam.type === 'written' && exam.level === 'middle') {
        const groups = {};
        students.forEach(s => {
          const key = `${s.grade}_${s.class}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
        });
        studentGroups = Object.values(groups);
      } else if (exam.type === 'foreign_lang' && exam.level === 'middle') {
        const groups = {};
        students.forEach(s => {
          const key = s.secondLang || 'None';
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
        });
        studentGroups = Object.values(groups);
      } else {
        studentGroups = [students];
      }

      // Çakışma gruplarını kontrol et
      const conflictStudentIds = new Set();
      conflictGroups.forEach(group => {
        group.studentIds.forEach(id => conflictStudentIds.add(id));
      });

      // Salonları sırayla doldur (çakışma kontrolü ile)
      const assignments = [];
      const roomAssignments = roomData.map(room => ({
        roomId: room.id,
        capacity: room.capacity + (room.extraSeatsAdded || 0),
        students: [],
      }));

      // Her öğrenci grubunu dağıt
      for (const group of studentGroups) {
        // Önce çakışma öğrencilerini ayır
        const conflictStudents = group.filter(s => conflictStudentIds.has(s.id));
        const normalStudents = group.filter(s => !conflictStudentIds.has(s.id));

        // Normal öğrencileri dağıt
        for (const student of normalStudents) {
          let placed = false;
          for (const ra of roomAssignments) {
            if (ra.students.length < ra.capacity) {
              ra.students.push(student);
              placed = true;
              break;
            }
          }
          if (!placed) {
            throw new Error('Yetersiz kapasite!');
          }
        }

        // Çakışma öğrencilerini farklı salonlara dağıt (her gruptaki öğrenciler ayrı salonlara)
        if (conflictStudents.length > 0) {
          // Her çakışma grubu için ayrı ayrı işle
          for (const conflictGroup of conflictGroups) {
            const groupStudents = conflictStudents.filter(s => conflictGroup.studentIds.includes(s.id));
            if (groupStudents.length === 0) continue;

            // Bu gruptaki öğrencileri farklı salonlara ata
            let roomIndex = 0;
            for (const student of groupStudents) {
              let placed = false;
              // Mevcut salonlardan uygun olanı bul (farklı salon)
              for (let i = 0; i < roomAssignments.length; i++) {
                const idx = (roomIndex + i) % roomAssignments.length;
                const ra = roomAssignments[idx];
                if (ra.students.length < ra.capacity) {
                  ra.students.push(student);
                  placed = true;
                  roomIndex = idx + 1;
                  break;
                }
              }
              if (!placed) {
                throw new Error(`Yetersiz kapasite: ${student.firstName} ${student.lastName} için salon bulunamadı.`);
              }
            }
          }

          // Çakışma grubunda olmayan diğer conflict öğrencileri (varsa) normal dağıt
          const otherConflict = conflictStudents.filter(s => 
            !conflictGroups.some(g => g.studentIds.includes(s.id))
          );
          for (const student of otherConflict) {
            let placed = false;
            for (const ra of roomAssignments) {
              if (ra.students.length < ra.capacity) {
                ra.students.push(student);
                placed = true;
                break;
              }
            }
            if (!placed) {
              throw new Error('Yetersiz kapasite!');
            }
          }
        }
      }

      // Assignments listesini oluştur
      roomAssignments.forEach(ra => {
        ra.students.forEach((student, idx) => {
          assignments.push({
            studentId: student.id,
            roomId: ra.roomId,
            seatNumber: idx + 1,
            studentName: `${student.firstName} ${student.lastName}`,
            class: student.class,
            grade: student.grade,
          });
        });
      });

      // Firestore'a kaydet
      await addDoc(collection(db, 'seating_plans'), {
        examId: selectedExam,
        createdAt: new Date(),
        assignments: assignments,
      });

      setDistributions(assignments);
      setMessage(`${assignments.length} öğrenci ${roomData.length} salona dağıtıldı.`);
    } catch (error) {
      console.error('Karma hatası:', error);
      setMessage('Karma sırasında hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Salon seçimini toggle et
  const toggleRoom = (roomId) => {
    setSelectedRooms(prev =>
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    );
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🪑 Sınav Karma Dağıtım</h2>

      {/* Sınav Seçimi */}
      <div style={{ marginBottom: '1rem' }}>
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

      {/* Salon Seçimi */}
      <div style={{ marginBottom: '1rem' }}>
        <label>Kullanılacak Salonlar (kapasite: {selectedRooms.reduce((acc, id) => {
          const room = rooms.find(r => r.id === id);
          return acc + (room ? room.capacity + (room.extraSeatsAdded || 0) : 0);
        }, 0)})</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => toggleRoom(room.id)}
              style={{
                padding: '0.3rem 0.8rem',
                background: selectedRooms.includes(room.id) ? '#007bff' : '#e9ecef',
                color: selectedRooms.includes(room.id) ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {room.name} ({room.capacity + (room.extraSeatsAdded || 0)})
            </button>
          ))}
        </div>
      </div>

      {/* Şube Grupları (Lise Akademik için) */}
      {selectedExam && exams.find(e => e.id === selectedExam)?.type === 'academic' && exams.find(e => e.id === selectedExam)?.level === 'high' && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <h4>Şube Grupları (Karma için)</h4>
          <button onClick={addGroup} style={{ padding: '0.3rem 0.8rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '0.5rem' }}>
            <FaPlus /> Grup Ekle
          </button>
          {groupConfig.map((group) => (
            <div key={group.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Şube kodu (virgülle ayırın)"
                value={group.classes.join(', ')}
                onChange={(e) => updateGroupClasses(group.id, e.target.value)}
                style={{ flex: 1, padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <button onClick={() => removeGroup(group.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}>
                <FaTrash />
              </button>
            </div>
          ))}
          <p style={{ fontSize: '0.9rem', color: '#666' }}>Örn: 12-A, 12-B, 12-C</p>
        </div>
      )}

      {/* Çakışma Grupları (Yeni) */}
      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
        <h4>⚠️ Çakışma Grupları (Aynı salonda olmaması gereken öğrenciler)</h4>
        <p style={{ fontSize: '0.9rem', color: '#856404' }}>
          Bu gruplardaki öğrenciler, karma dağıtım sırasında farklı salonlara atanacaktır.
        </p>

        {/* Yeni çakışma grubu ekle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Grup adı (örn: KOPYA-1)"
            value={newConflictGroupName}
            onChange={(e) => setNewConflictGroupName(e.target.value)}
            style={{ flex: 1, padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <button
            onClick={addConflictGroup}
            style={{ padding: '0.4rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            <FaPlus /> Grup Ekle
          </button>
        </div>

        {/* Mevcut çakışma grupları */}
        {conflictGroups.map((group, index) => (
          <div key={group.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <strong>{group.name}</strong>
              <div>
                <button
                  onClick={() => startEditingGroup(index)}
                  style={{ background: 'transparent', border: 'none', color: '#ffc107', cursor: 'pointer', marginRight: '0.5rem' }}
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => removeConflictGroup(group.id)}
                  style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}
                >
                  <FaTrash />
                </button>
              </div>
            </div>

            {editingGroupIndex === index ? (
              // Düzenleme modu
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.3rem' }}>
                  {students.map(student => (
                    <label key={student.id} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <input
                        type="checkbox"
                        checked={tempStudents.includes(student.id)}
                        onChange={() => toggleStudentInGroup(student.id)}
                      />
                      {student.firstName} {student.lastName} ({student.grade}-{student.class})
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => saveConflictGroup(group.id)}
                    style={{ padding: '0.3rem 0.8rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <FaSave /> Kaydet
                  </button>
                  <button
                    onClick={cancelEditing}
                    style={{ padding: '0.3rem 0.8rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <FaTimes /> İptal
                  </button>
                </div>
              </div>
            ) : (
              // Görüntüleme modu
              <div>
                {group.studentIds.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {group.studentIds.map(id => {
                      const student = students.find(s => s.id === id);
                      return student ? (
                        <span key={id} style={{ background: '#f8f9fa', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                          {student.firstName} {student.lastName}
                        </span>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <span style={{ color: '#999', fontSize: '0.9rem' }}>Henüz öğrenci eklenmemiş.</span>
                )}
              </div>
            )}
          </div>
        ))}

        {conflictGroups.length === 0 && (
          <p style={{ textAlign: 'center', color: '#666' }}>Henüz çakışma grubu eklenmemiş.</p>
        )}
      </div>

      {/* Karma Butonu */}
      <button
        onClick={runDistribution}
        disabled={loading}
        style={{
          padding: '0.6rem 1.5rem',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <FaSync /> {loading ? 'Dağıtılıyor...' : 'Karma Dağıtımı Başlat'}
      </button>

      {message && <p style={{ margin: '0.5rem 0', color: message.includes('hata') ? 'red' : 'green' }}>{message}</p>}

      {/* Dağıtım Özeti */}
      {distributions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h4>Dağıtım Sonucu ({distributions.length} öğrenci)</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
            <thead style={{ background: '#f1f1f1' }}>
              <tr>
                <th>#</th>
                <th>Öğrenci</th>
                <th>Sınıf</th>
                <th>Salon</th>
                <th>Sıra No</th>
              </tr>
            </thead>
            <tbody>
              {distributions.map((item, index) => {
                const room = rooms.find(r => r.id === item.roomId);
                return (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>{index + 1}</td>
                    <td style={{ padding: '0.5rem' }}>{item.studentName}</td>
                    <td style={{ padding: '0.5rem' }}>{item.grade}-{item.class}</td>
                    <td style={{ padding: '0.5rem' }}>{room?.name || item.roomId}</td>
                    <td style={{ padding: '0.5rem' }}>{item.seatNumber}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SeatingDistribution;