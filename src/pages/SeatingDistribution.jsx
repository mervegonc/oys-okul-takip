import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaSync, FaSave, FaEdit, FaTrash, FaUserGraduate, FaChair, FaBuilding } from 'react-icons/fa';

const SeatingDistribution = () => {
  // Temel state'ler
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [students, setStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [distributions, setDistributions] = useState([]);
  const [selectedExamData, setSelectedExamData] = useState(null);

  // Grup ve salon yapılandırması
  const [groups, setGroups] = useState([]);
  const [conflictList, setConflictList] = useState([]);

  // Sınav ve salonları yükle
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

  // Sınav seçildiğinde öğrencileri ve şubeleri getir
  useEffect(() => {
    if (!selectedExam) return;
    const fetchStudentsForExam = async () => {
      const exam = exams.find(e => e.id === selectedExam);
      if (!exam) return;
      setSelectedExamData(exam);
      
      try {
        const gradeLevels = exam.gradeLevels || [];
        if (gradeLevels.length === 0) {
          setStudents([]);
          setAllClasses([]);
          setMessage('Bu sınav için sınıf seviyesi seçilmemiş.');
          return;
        }

        // Öğrencileri getir
        const q = query(
          collection(db, 'students'),
          where('grade', 'in', gradeLevels.map(String))
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStudents(data);

        // Benzersiz şubeleri çıkar
        const classSet = new Set(data.map(s => s.class).filter(Boolean));
        const classList = Array.from(classSet).sort();
        setAllClasses(classList);
        setMessage(`${data.length} öğrenci, ${classList.length} farklı şube bulundu.`);

        // Varsayılan grup yapılandırması oluştur (tüm şubeler tek grup)
        if (classList.length > 0) {
          setGroups([{
            id: Date.now(),
            name: 'Grup 1',
            classes: classList,
            selectedRooms: []
          }]);
        } else {
          setGroups([]);
        }
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
      selectedRooms: []
    };
    setGroups([...groups, newGroup]);
  };

  // Grup sil
  const removeGroup = (groupId) => {
    if (groups.length <= 1) {
      setMessage('En az bir grup olmalıdır.');
      return;
    }
    setGroups(groups.filter(g => g.id !== groupId));
  };

  // Grup adını güncelle
  const updateGroupName = (groupId, name) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, name } : g));
  };

  // Gruba şube ekle/çıkar
  const toggleClassInGroup = (groupId, className) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      const classes = g.classes.includes(className)
        ? g.classes.filter(c => c !== className)
        : [...g.classes, className];
      return { ...g, classes };
    }));
  };

  // Gruba salon seç/çıkar
  const toggleRoomInGroup = (groupId, roomId) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      const rooms = g.selectedRooms.includes(roomId)
        ? g.selectedRooms.filter(r => r !== roomId)
        : [...g.selectedRooms, roomId];
      return { ...g, rooms };
    }));
  };

  // Çakışma listesine öğrenci ekle
  const addConflict = (studentId) => {
    if (!conflictList.includes(studentId)) {
      setConflictList([...conflictList, studentId]);
    }
  };

  // Çakışma listesinden çıkar
  const removeConflict = (studentId) => {
    setConflictList(conflictList.filter(id => id !== studentId));
  };

  // Karma dağıtım algoritması
  const runDistribution = async () => {
    if (!selectedExam) {
      setMessage('Lütfen bir sınav seçin.');
      return;
    }
    if (students.length === 0) {
      setMessage('Bu sınava uygun öğrenci bulunamadı.');
      return;
    }

    // Grup kontrolü
    const allClassesInGroups = groups.flatMap(g => g.classes);
    const allClassesSet = new Set(allClasses);
    const groupClassesSet = new Set(allClassesInGroups);
    const missingClasses = allClasses.filter(c => !groupClassesSet.has(c));
    if (missingClasses.length > 0) {
      setMessage(`Tüm şubeler gruplara eklenmemiş: ${missingClasses.join(', ')}`);
      return;
    }

    // Her grupta salon kontrolü
    for (const group of groups) {
      if (group.selectedRooms.length === 0) {
        setMessage(`${group.name} için salon seçilmemiş.`);
        return;
      }
    }

    setLoading(true);
    setMessage('Karma dağıtım başlatılıyor...');

    try {
      const allRooms = rooms;
      const assignments = [];

      // Her grup için dağıtım yap
      for (const group of groups) {
        const groupStudents = students.filter(s => group.classes.includes(s.class));
        if (groupStudents.length === 0) continue;

        const groupRooms = allRooms.filter(r => group.selectedRooms.includes(r.id));
        const totalCapacity = groupRooms.reduce((acc, r) => acc + (r.capacity + (r.extraSeatsAdded || 0)), 0);

        if (totalCapacity < groupStudents.length) {
          setMessage(`${group.name} için kapasite yetersiz! Toplam: ${totalCapacity}, Öğrenci: ${groupStudents.length}`);
          setLoading(false);
          return;
        }

        // Öğrencileri salonlara dağıt
        let roomIndex = 0;
        let remaining = [...groupStudents];

        // Özel durum: Yabancı dil sınavı için 2. dile göre grupla
        const exam = selectedExamData;
        let studentGroups = [];
        if (exam?.type === 'foreign_lang') {
          const langGroups = {};
          remaining.forEach(s => {
            const key = s.secondLang || 'None';
            if (!langGroups[key]) langGroups[key] = [];
            langGroups[key].push(s);
          });
          // Önce aynı dili konuşanları aynı salona yerleştirmeye çalış
          studentGroups = Object.values(langGroups);
        } else {
          studentGroups = [remaining];
        }

        // Her alt grubu doldur
        for (const subGroup of studentGroups) {
          let subRemaining = [...subGroup];
          while (subRemaining.length > 0) {
            const room = groupRooms[roomIndex % groupRooms.length];
            const capacity = room.capacity + (room.extraSeatsAdded || 0);
            const take = Math.min(subRemaining.length, capacity);
            const batch = subRemaining.splice(0, take);
            batch.forEach((student, idx) => {
              assignments.push({
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
                class: student.class,
                grade: student.grade,
                roomId: room.id,
                roomName: room.name,
                seatNumber: idx + 1,
                groupId: group.id,
                groupName: group.name,
              });
            });
            roomIndex++;
          }
        }
      }

      // Çakışma kontrolü
      if (conflictList.length > 1) {
        // Aynı salona düşen çakışmaları kontrol et
        for (let i = 0; i < conflictList.length; i++) {
          for (let j = i + 1; j < conflictList.length; j++) {
            const s1 = assignments.find(a => a.studentId === conflictList[i]);
            const s2 = assignments.find(a => a.studentId === conflictList[j]);
            if (s1 && s2 && s1.roomId === s2.roomId) {
              // s2'yi farklı bir salona taşı
              const allRoomsInGroup = groups.find(g => g.id === s2.groupId)?.selectedRooms || [];
              const otherRoom = allRoomsInGroup.find(r => r !== s1.roomId);
              if (otherRoom) {
                const roomObj = rooms.find(r => r.id === otherRoom);
                if (roomObj) {
                  const capacity = roomObj.capacity + (roomObj.extraSeatsAdded || 0);
                  const currentInRoom = assignments.filter(a => a.roomId === otherRoom).length;
                  if (currentInRoom < capacity) {
                    s2.roomId = otherRoom;
                    s2.roomName = roomObj.name;
                    // Sıra numarasını güncelle
                    const maxSeat = Math.max(...assignments.filter(a => a.roomId === otherRoom).map(a => a.seatNumber), 0);
                    s2.seatNumber = maxSeat + 1;
                  }
                }
              }
            }
          }
        }
      }

      // Firestore'a kaydet
      const seatingPlanRef = await addDoc(collection(db, 'seating_plans'), {
        examId: selectedExam,
        createdAt: new Date(),
        assignments: assignments,
        groups: groups.map(g => ({ name: g.name, classes: g.classes, rooms: g.selectedRooms })),
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

  // Oturum düzeni önizlemesi
  const getRoomSummary = () => {
    const summary = {};
    distributions.forEach(d => {
      const key = d.roomId;
      if (!summary[key]) summary[key] = { roomName: d.roomName, count: 0, students: [] };
      summary[key].count++;
      summary[key].students.push(d.studentName);
    });
    return Object.values(summary);
  };

  // Öğrenci listesini indir (CSV)
  const exportCSV = () => {
    if (distributions.length === 0) return alert('Dağıtım yapılmamış.');
    const headers = ['Sıra', 'Öğrenci Adı', 'Sınıf', 'Salon', 'Sıra No'];
    const rows = distributions.map((d, i) => [
      i + 1,
      d.studentName,
      `${d.grade}-${d.class}`,
      d.roomName,
      d.seatNumber
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `karma_dagilim_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🪑 Sınav Karma Dağıtım</h2>

      {/* Sınav Seçimi */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 'bold' }}>Sınav Seçin</label>
        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', marginTop: '0.3rem' }}
        >
          <option value="">-- Sınav Seçin --</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>
              {exam.title} ({exam.date}) - {exam.gradeLevels?.join(', ') || 'Tümü'}
            </option>
          ))}
        </select>
      </div>

      {selectedExam && (
        <>
          {/* Grup Yapılandırması */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4>Şube Grupları</h4>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Mevcut şubeler: {allClasses.join(', ') || 'Henüz şube bulunamadı.'}
            </p>

            <button
              onClick={addGroup}
              style={{ padding: '0.3rem 0.8rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '0.5rem' }}
            >
              + Grup Ekle
            </button>

            {groups.map((group, index) => (
              <div key={group.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '0.8rem', marginBottom: '0.5rem', background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroupName(group.id, e.target.value)}
                    style={{ padding: '0.3rem', border: '1px solid #ddd', borderRadius: '4px', flex: 1 }}
                  />
                  <button onClick={() => removeGroup(group.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}>
                    <FaTrash />
                  </button>
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Şubeler:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {allClasses.map(className => (
                      <button
                        key={className}
                        onClick={() => toggleClassInGroup(group.id, className)}
                        style={{
                          padding: '0.2rem 0.6rem',
                          background: group.classes.includes(className) ? '#007bff' : '#e9ecef',
                          color: group.classes.includes(className) ? 'white' : '#333',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        {className}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>Salonlar:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {rooms.map(room => (
                      <button
                        key={room.id}
                        onClick={() => toggleRoomInGroup(group.id, room.id)}
                        style={{
                          padding: '0.2rem 0.6rem',
                          background: group.selectedRooms?.includes(room.id) ? '#28a745' : '#e9ecef',
                          color: group.selectedRooms?.includes(room.id) ? 'white' : '#333',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        {room.name} ({room.capacity + (room.extraSeatsAdded || 0)})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Çakışma Listesi */}
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px' }}>
            <h4>⚠️ Çakışma Listesi (Aynı salonda oturmaması gerekenler)</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
              {students.map(student => (
                <button
                  key={student.id}
                  onClick={() => conflictList.includes(student.id) ? removeConflict(student.id) : addConflict(student.id)}
                  style={{
                    padding: '0.2rem 0.6rem',
                    background: conflictList.includes(student.id) ? '#dc3545' : '#e9ecef',
                    color: conflictList.includes(student.id) ? 'white' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  {student.firstName} {student.lastName}
                </button>
              ))}
            </div>
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
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <FaSync /> {loading ? 'Dağıtılıyor...' : 'Karma Dağıtımı Başlat'}
          </button>

          {message && <p style={{ margin: '0.5rem 0', color: message.includes('hata') || message.includes('yetersiz') ? 'red' : 'green' }}>{message}</p>}

          {/* Dağıtım Sonucu */}
          {distributions.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4>Dağıtım Sonucu ({distributions.length} öğrenci)</h4>
                <button
                  onClick={exportCSV}
                  style={{ padding: '0.3rem 0.8rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  CSV İndir
                </button>
              </div>

              {/* Salon Özeti */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {getRoomSummary().map((item, index) => (
                  <div key={index} style={{ padding: '0.3rem 0.6rem', background: '#e9ecef', borderRadius: '4px' }}>
                    {item.roomName}: {item.count} öğrenci
                  </div>
                ))}
              </div>

              {/* Detaylı Tablo */}
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
                <thead style={{ background: '#f1f1f1' }}>
                  <tr>
                    <th>#</th>
                    <th>Öğrenci</th>
                    <th>Sınıf</th>
                    <th>Grup</th>
                    <th>Salon</th>
                    <th>Sıra No</th>
                  </tr>
                </thead>
                <tbody>
                  {distributions.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem' }}>{index + 1}</td>
                      <td style={{ padding: '0.5rem' }}>{item.studentName}</td>
                      <td style={{ padding: '0.5rem' }}>{item.grade}-{item.class}</td>
                      <td style={{ padding: '0.5rem' }}>{item.groupName}</td>
                      <td style={{ padding: '0.5rem' }}>{item.roomName}</td>
                      <td style={{ padding: '0.5rem' }}>{item.seatNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SeatingDistribution;