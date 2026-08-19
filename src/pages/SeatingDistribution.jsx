import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaSync, FaPlus, FaTrash, FaSave } from 'react-icons/fa';

const SeatingDistribution = () => {
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [students, setStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]); // Tüm şubeler
  const [groups, setGroups] = useState([]); // [{ id, name, classes: [], roomIds: [] }]
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Tüm sınav ve salonları getir
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

  // Sınav seçilince öğrencileri ve şubeleri getir
  useEffect(() => {
    if (!selectedExam) {
      setStudents([]);
      setAllClasses([]);
      setGroups([]);
      return;
    }
    const fetchStudentsForExam = async () => {
      const exam = exams.find(e => e.id === selectedExam);
      if (!exam) return;
      const gradeLevels = exam.gradeLevels || [];
      if (gradeLevels.length === 0) {
        setStudents([]);
        setAllClasses([]);
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

        // Benzersiz şubeleri çıkar (grade + class)
        const classSet = new Set();
        data.forEach(s => classSet.add(`${s.grade}-${s.class}`));
        const sortedClasses = Array.from(classSet).sort();
        setAllClasses(sortedClasses);

        // Grupları sıfırla (kullanıcı yeniden oluştursun)
        setGroups([]);
        setDistributions([]);
        setMessage(`${data.length} öğrenci, ${sortedClasses.length} farklı şube bulundu.`);
      } catch (error) {
        console.error('Öğrenciler alınamadı:', error);
        setMessage('Öğrenciler alınırken hata oluştu.');
      }
    };
    fetchStudentsForExam();
  }, [selectedExam, exams]);

  // Grup ekle
  const addGroup = () => {
    const newGroup = {
      id: Date.now(),
      name: `Grup ${groups.length + 1}`,
      classes: [],
      roomIds: [],
    };
    setGroups([...groups, newGroup]);
  };

  // Grup sil
  const removeGroup = (groupId) => {
    if (groups.length <= 1) {
      setMessage('En az bir grup olmalıdır.');
      return;
    }
    if (!window.confirm('Bu grubu silmek istediğinize emin misiniz?')) return;
    setGroups(groups.filter(g => g.id !== groupId));
  };

  // Gruba şube ekle/çıkar (toggle)
  const toggleClassForGroup = (groupId, className) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        const classes = g.classes.includes(className)
          ? g.classes.filter(c => c !== className)
          : [...g.classes, className];
        return { ...g, classes };
      }
      return g;
    }));
  };

  // Gruba salon ekle/çıkar (toggle)
  const toggleRoomForGroup = (groupId, roomId) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        const roomIds = g.roomIds.includes(roomId)
          ? g.roomIds.filter(id => id !== roomId)
          : [...g.roomIds, roomId];
        return { ...g, roomIds };
      }
      return g;
    }));
  };

  // Karma dağıtım (çakışma kontrolü ile)
  const runDistribution = async () => {
    if (!selectedExam) {
      setMessage('Lütfen bir sınav seçin.');
      return;
    }
    if (groups.length === 0) {
      setMessage('Lütfen en az bir grup oluşturun.');
      return;
    }

    // Her grubun en az bir şubesi ve bir salonu olmalı
    for (const group of groups) {
      if (group.classes.length === 0) {
        setMessage(`"${group.name}" için şube seçilmemiş.`);
        return;
      }
      if (group.roomIds.length === 0) {
        setMessage(`"${group.name}" için salon seçilmemiş.`);
        return;
      }
    }

    setLoading(true);
    setMessage('Karma dağıtım başlatılıyor...');

    try {
      // 1. ÇAKIŞMA KONTROLÜ (ConflictManagement'ten gelen grupları kontrol et)
      const conflictSnap = await getDocs(collection(db, 'conflict_groups'));
      const conflictGroups = [];
      conflictSnap.forEach(doc => {
        conflictGroups.push({ id: doc.id, ...doc.data() });
      });

      // Çakışma kontrolü: Aynı gruptaki öğrenciler farklı salonlara atanmalı
      // Önce tüm öğrencileri şubelerine göre grupla
      const studentMap = {};
      students.forEach(s => {
        const key = `${s.grade}-${s.class}`;
        if (!studentMap[key]) studentMap[key] = [];
        studentMap[key].push(s);
      });

      // Her grup için salonları hazırla
      const allRoomIds = [...new Set(groups.flatMap(g => g.roomIds))];
      const roomData = rooms.filter(r => allRoomIds.includes(r.id));
      const roomUsage = roomData.map(room => ({
        roomId: room.id,
        capacity: room.capacity + (room.extraSeatsAdded || 0),
        students: [],
      }));

      // Önce normal dağıtım (çakışma yokmuş gibi)
      const assignments = [];
      for (const group of groups) {
        const groupStudents = [];
        group.classes.forEach(cls => {
          if (studentMap[cls]) {
            groupStudents.push(...studentMap[cls]);
          }
        });
        if (groupStudents.length === 0) continue;

        const groupRooms = roomUsage.filter(r => group.roomIds.includes(r.roomId));
        if (groupRooms.length === 0) {
          setMessage(`"${group.name}" için uygun salon bulunamadı.`);
          setLoading(false);
          return;
        }

        let roomIndex = 0;
        for (const student of groupStudents) {
          let placed = false;
          for (let i = 0; i < groupRooms.length; i++) {
            const idx = (roomIndex + i) % groupRooms.length;
            const ra = groupRooms[idx];
            if (ra.students.length < ra.capacity) {
              ra.students.push(student);
              placed = true;
              roomIndex = idx + 1;
              break;
            }
          }
          if (!placed) {
            throw new Error(`"${group.name}" için yeterli kapasite yok.`);
          }
        }
      }

      // 2. ÇAKIŞMA DÜZELTMESİ
      // Çakışma gruplarındaki öğrencileri aynı salona düşmeyecek şekilde yeniden dağıt
      if (conflictGroups.length > 0) {
        for (const conflictGroup of conflictGroups) {
          const conflictStudentIds = conflictGroup.studentIds || [];
          if (conflictStudentIds.length < 2) continue;

          // Bu öğrencilerin hangi salonlara atandığını bul
          const conflictAssignments = [];
          for (const ra of roomUsage) {
            for (const student of ra.students) {
              if (conflictStudentIds.includes(student.id)) {
                conflictAssignments.push({
                  student,
                  roomId: ra.roomId,
                });
              }
            }
          }

          // Aynı salona düşenleri tespit et
          const roomMap = {};
          conflictAssignments.forEach(item => {
            if (!roomMap[item.roomId]) roomMap[item.roomId] = [];
            roomMap[item.roomId].push(item.student);
          });

          // Aynı salonda 2'den fazla çakışma öğrencisi varsa, birini başka salona taşı
          for (const roomId of Object.keys(roomMap)) {
            const studentsInRoom = roomMap[roomId];
            if (studentsInRoom.length > 1) {
              // İlk öğrenciyi başka bir salona taşı
              const studentToMove = studentsInRoom[0];
              const targetRoom = roomUsage.find(r => 
                r.roomId !== roomId && 
                r.students.length < r.capacity
              );
              if (targetRoom) {
                // Öğrenciyi eski salonundan çıkar
                const oldRoom = roomUsage.find(r => r.roomId === roomId);
                oldRoom.students = oldRoom.students.filter(s => s.id !== studentToMove.id);
                // Yeni salona ekle
                targetRoom.students.push(studentToMove);
              } else {
                setMessage('Çakışma düzeltilemedi: yeterli kapasite yok.');
                setLoading(false);
                return;
              }
            }
          }
        }
      }

      // 3. Assignments listesini oluştur
      roomUsage.forEach(ra => {
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
      setMessage(`${assignments.length} öğrenci başarıyla dağıtıldı.`);
    } catch (error) {
      console.error('Karma hatası:', error);
      setMessage('Karma sırasında hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🪑 Sınav Karma Dağıtım</h2>

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

      {/* Tüm Şubeler */}
      {selectedExam && allClasses.length > 0 && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <h4>Tüm Şubeler</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {allClasses.map(cls => (
              <span key={cls} style={{ padding: '0.3rem 0.8rem', background: '#e9ecef', borderRadius: '4px', fontSize: '0.9rem' }}>
                {cls}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Salon Listesi */}
      {selectedExam && rooms.length > 0 && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <h4>Mevcut Salonlar</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {rooms.map(room => (
              <span key={room.id} style={{ padding: '0.3rem 0.8rem', background: '#e9ecef', borderRadius: '4px', fontSize: '0.9rem' }}>
                {room.name} ({room.capacity + (room.extraSeatsAdded || 0)})
                {room.class && ` - ${room.class}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grup Oluşturma */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4>Şube Grupları ve Salon Atamaları</h4>
          <button
            onClick={addGroup}
            style={{
              padding: '0.4rem 1rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FaPlus /> Grup Ekle
          </button>
        </div>

        {groups.map((group) => (
          <div key={group.id} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '1.1rem' }}>{group.name}</strong>
              <button
                onClick={() => removeGroup(group.id)}
                style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}
              >
                <FaTrash /> Grubu Sil
              </button>
            </div>

            {/* Şube Seçimi */}
            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>Şubeler:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {allClasses.map(cls => (
                  <button
                    key={cls}
                    onClick={() => toggleClassForGroup(group.id, cls)}
                    style={{
                      padding: '0.3rem 0.8rem',
                      background: group.classes.includes(cls) ? '#007bff' : '#e9ecef',
                      color: group.classes.includes(cls) ? 'white' : '#333',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {cls}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.3rem' }}>
                Seçili: {group.classes.length} şube
              </div>
            </div>

            {/* Salon Seçimi */}
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>Salonlar:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => toggleRoomForGroup(group.id, room.id)}
                    style={{
                      padding: '0.3rem 0.8rem',
                      background: group.roomIds.includes(room.id) ? '#007bff' : '#e9ecef',
                      color: group.roomIds.includes(room.id) ? 'white' : '#333',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {room.name} ({room.capacity + (room.extraSeatsAdded || 0)})
                    {room.class && ` - ${room.class}`}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.3rem' }}>
                Seçili: {group.roomIds.length} salon
              </div>
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <p style={{ textAlign: 'center', color: '#666' }}>
            Henüz grup oluşturulmamış. "Grup Ekle" butonuna tıklayarak başlayın.
          </p>
        )}
      </div>

      {/* Karma Butonu */}
      <button
        onClick={runDistribution}
        disabled={loading || !selectedExam || groups.length === 0}
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

      {/* Dağıtım Sonucu */}
      {distributions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h4>Dağıtım Sonucu ({distributions.length} öğrenci)</h4>
          <div style={{ overflowX: 'auto' }}>
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
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{index + 1}</td>
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
        </div>
      )}
    </div>
  );
};

export default SeatingDistribution;