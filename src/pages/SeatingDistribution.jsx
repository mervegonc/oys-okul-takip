import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaSync, FaSave, FaEdit, FaTrash, FaUsers, FaChair } from 'react-icons/fa';

const SeatingDistribution = () => {
  // State'ler
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedExamData, setSelectedExamData] = useState(null);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Şube grupları ve salon atamaları
  const [groups, setGroups] = useState([]);
  
  // Çakışma listesi
  const [conflictList, setConflictList] = useState([]);
  const [conflictInput, setConflictInput] = useState('');

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

  // Sınav seçildiğinde, o sınavdaki sınıflara göre öğrencileri getir
  useEffect(() => {
    if (!selectedExam) {
      setStudents([]);
      setFilteredStudents([]);
      setSelectedExamData(null);
      return;
    }
    
    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;
    setSelectedExamData(exam);
    
    const fetchStudentsForExam = async () => {
      try {
        const gradeLevels = exam.gradeLevels || [];
        if (gradeLevels.length === 0) {
          setStudents([]);
          setFilteredStudents([]);
          return;
        }
        // Sınıf seviyelerini stringe çevir
        const gradeStrings = gradeLevels.map(String);
        const q = query(
          collection(db, 'students'),
          where('grade', 'in', gradeStrings)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStudents(data);
        setFilteredStudents(data);
        setMessage(`${data.length} öğrenci bulundu.`);
        
        // Grupları sıfırla
        setGroups([]);
        setDistributions([]);
      } catch (error) {
        console.error('Öğrenciler alınamadı:', error);
        setMessage('Öğrenciler alınırken hata oluştu.');
      }
    };
    fetchStudentsForExam();
  }, [selectedExam, exams]);

  // Grup ekle
  const addGroup = () => {
    setGroups([...groups, { 
      id: Date.now(), 
      classes: [], 
      roomIds: [],
      students: []
    }]);
  };

  // Grup sil
  const removeGroup = (groupId) => {
    setGroups(groups.filter(g => g.id !== groupId));
  };

  // Grup şubelerini güncelle
  const updateGroupClasses = (groupId, value) => {
    setGroups(groups.map(g =>
      g.id === groupId ? { ...g, classes: value.split(',').map(s => s.trim()).filter(Boolean) } : g
    ));
  };

  // Grup salonlarını toggle et
  const toggleRoomForGroup = (groupId, roomId) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      const roomIds = g.roomIds.includes(roomId) 
        ? g.roomIds.filter(id => id !== roomId) 
        : [...g.roomIds, roomId];
      return { ...g, roomIds };
    }));
  };

  // Öğrencileri gruplara dağıt (şube bazında)
  const distributeStudentsToGroups = () => {
    const updatedGroups = groups.map(group => {
      const groupStudents = filteredStudents.filter(s => 
        group.classes.includes(s.class)
      );
      return { ...group, students: groupStudents };
    });
    setGroups(updatedGroups);
    
    // Gruplanmayan öğrenciler
    const groupedStudentIds = updatedGroups.flatMap(g => g.students.map(s => s.id));
    const ungrouped = filteredStudents.filter(s => !groupedStudentIds.includes(s.id));
    if (ungrouped.length > 0) {
      setMessage(`${ungrouped.length} öğrenci herhangi bir gruba atanmadı.`);
    }
  };

  // Karma algoritması
  const runDistribution = async () => {
    if (!selectedExam) {
      setMessage('Lütfen bir sınav seçin.');
      return;
    }
    if (groups.length === 0) {
      setMessage('Lütfen en az bir şube grubu oluşturun.');
      return;
    }
    if (filteredStudents.length === 0) {
      setMessage('Bu sınava uygun öğrenci bulunamadı.');
      return;
    }

    setLoading(true);
    setMessage('Karma dağıtım başlatılıyor...');

    try {
      // Önce öğrencileri gruplara dağıt
      distributeStudentsToGroups();

      // Her grup için salonları doldur
      const allAssignments = [];
      let totalAssigned = 0;
      let errorCount = 0;

      for (const group of groups) {
        if (group.students.length === 0) continue;
        if (group.roomIds.length === 0) {
          setMessage(`${group.classes.join(', ')} grubu için salon seçilmedi.`);
          setLoading(false);
          return;
        }

        const groupRooms = rooms.filter(r => group.roomIds.includes(r.id));
        const totalCapacity = groupRooms.reduce((acc, r) => acc + (r.capacity + (r.extraSeatsAdded || 0)), 0);
        
        if (totalCapacity < group.students.length) {
          setMessage(`${group.classes.join(', ')} grubu için yetersiz kapasite! (Öğrenci: ${group.students.length}, Kapasite: ${totalCapacity})`);
          setLoading(false);
          return;
        }

        // Öğrencileri karıştır (random)
        const shuffled = [...group.students].sort(() => Math.random() - 0.5);
        let roomIndex = 0;
        let seatCounter = 1;

        for (const student of shuffled) {
          const room = groupRooms[roomIndex % groupRooms.length];
          const capacity = room.capacity + (room.extraSeatsAdded || 0);
          
          allAssignments.push({
            studentId: student.id,
            roomId: room.id,
            seatNumber: seatCounter,
            studentName: `${student.firstName} ${student.lastName}`,
            class: student.class,
            grade: student.grade,
            groupClasses: group.classes.join(', ')
          });

          seatCounter++;
          // Eğer salon dolduysa bir sonraki salona geç
          if (seatCounter > capacity) {
            roomIndex++;
            seatCounter = 1;
          }
          totalAssigned++;
        }
      }

      // Çakışma listesi kontrolü
      if (conflictList.length > 0) {
        // Basit çakışma çözümü: aynı salona düşenleri farklı salona taşı
        for (const conflictPair of conflictList) {
          const [s1, s2] = conflictPair;
          const assign1 = allAssignments.find(a => a.studentId === s1);
          const assign2 = allAssignments.find(a => a.studentId === s2);
          if (assign1 && assign2 && assign1.roomId === assign2.roomId) {
            // assign2'yi farklı bir salona taşı
            const allRoomIds = groups.flatMap(g => g.roomIds);
            const differentRoom = rooms.find(r => r.id !== assign1.roomId && allRoomIds.includes(r.id));
            if (differentRoom) {
              assign2.roomId = differentRoom.id;
            }
          }
        }
      }

      // Firestore'a kaydet
      const seatingPlanRef = await addDoc(collection(db, 'seating_plans'), {
        examId: selectedExam,
        createdAt: new Date(),
        assignments: allAssignments,
        groups: groups.map(g => ({ classes: g.classes, roomIds: g.roomIds })),
      });

      setDistributions(allAssignments);
      setMessage(`${allAssignments.length} öğrenci ${groups.length} gruba dağıtıldı.`);
    } catch (error) {
      console.error('Karma hatası:', error);
      setMessage('Karma sırasında hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Dağıtım özeti
  const getDistributionSummary = () => {
    if (distributions.length === 0) return null;
    
    const roomStats = {};
    distributions.forEach(d => {
      const room = rooms.find(r => r.id === d.roomId);
      const roomName = room ? room.name : d.roomId;
      if (!roomStats[roomName]) roomStats[roomName] = 0;
      roomStats[roomName]++;
    });
    
    return (
      <div style={{ margin: '1rem 0', padding: '1rem', background: '#e9f7ef', borderRadius: '8px' }}>
        <h4>📊 Dağıtım Özeti</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {Object.entries(roomStats).map(([room, count]) => (
            <div key={room} style={{ padding: '0.3rem 0.8rem', background: '#d4edda', borderRadius: '4px' }}>
              {room}: {count} öğrenci
            </div>
          ))}
        </div>
        <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
          Toplam: {distributions.length} öğrenci
        </div>
      </div>
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

      {selectedExamData && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem 1rem', background: '#e7f3ff', borderRadius: '8px' }}>
          <p><strong>Sınav Bilgileri:</strong> {selectedExamData.title} - {selectedExamData.gradeLevels?.join(', ')}. Sınıflar - {selectedExamData.type}</p>
          <p><strong>Öğrenci Sayısı:</strong> {filteredStudents.length}</p>
        </div>
      )}

      {/* Şube Grupları */}
      {selectedExam && filteredStudents.length > 0 && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <h4>Şube Grupları</h4>
          <button
            onClick={addGroup}
            style={{
              padding: '0.3rem 0.8rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '0.5rem'
            }}
          >
            + Grup Ekle
          </button>

          {groups.map((group) => {
            // Bu gruptaki öğrenciler
            const groupStudents = filteredStudents.filter(s => group.classes.includes(s.class));
            // Bu grubun toplam kapasitesi
            const groupRooms = rooms.filter(r => group.roomIds.includes(r.id));
            const totalCapacity = groupRooms.reduce((acc, r) => acc + (r.capacity + (r.extraSeatsAdded || 0)), 0);

            return (
              <div key={group.id} style={{ marginBottom: '1rem', padding: '1rem', background: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
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

                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.3rem' }}>
                    Salon Seçimi (Toplam Kapasite: {totalCapacity} | Öğrenci: {groupStudents.length})
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {rooms.map(room => (
                      <button
                        key={room.id}
                        onClick={() => toggleRoomForGroup(group.id, room.id)}
                        style={{
                          padding: '0.2rem 0.6rem',
                          background: group.roomIds.includes(room.id) ? '#007bff' : '#e9ecef',
                          color: group.roomIds.includes(room.id) ? 'white' : '#333',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        {room.name} ({room.capacity + (room.extraSeatsAdded || 0)})
                      </button>
                    ))}
                  </div>
                </div>

                {groupStudents.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                    <FaUsers /> {groupStudents.length} öğrenci
                  </div>
                )}
              </div>
            );
          })}

          {groups.length > 0 && (
            <button
              onClick={distributeStudentsToGroups}
              style={{
                padding: '0.3rem 0.8rem',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '0.5rem'
              }}
            >
              Öğrencileri Gruplara Dağıt
            </button>
          )}
        </div>
      )}

      {/* Çakışma Listesi */}
      <div style={{ marginBottom: '1rem' }}>
        <h4>Çakışma Listesi (Aynı salonda oturmaması gereken öğrenciler)</h4>
        <textarea
          placeholder="Öğrenci ID'lerini virgülle ayırın (örn: id1,id2,id3)"
          value={conflictInput}
          onChange={(e) => {
            setConflictInput(e.target.value);
            const ids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            const pairs = [];
            for (let i = 0; i < ids.length - 1; i += 2) {
              if (ids[i+1]) pairs.push([ids[i], ids[i+1]]);
            }
            setConflictList(pairs);
          }}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px' }}
        />
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          Her satırda 2 öğrenci ID'si yazın (örn: id1,id2). Sistem bu öğrencileri farklı salonlara atamaya çalışacak.
        </p>
        {conflictList.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <strong>{conflictList.length} çakışma çifti tanımlandı.</strong>
          </div>
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
      {getDistributionSummary()}

      {/* Sonuç Listesi */}
      {distributions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h4>Dağıtım Sonucu ({distributions.length} öğrenci)</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
              <thead style={{ background: '#f1f1f1' }}>
                <tr>
                  <th style={{ padding: '0.5rem' }}>#</th>
                  <th style={{ padding: '0.5rem' }}>Öğrenci</th>
                  <th style={{ padding: '0.5rem' }}>Sınıf</th>
                  <th style={{ padding: '0.5rem' }}>Grup</th>
                  <th style={{ padding: '0.5rem' }}>Salon</th>
                  <th style={{ padding: '0.5rem' }}>Sıra No</th>
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
                      <td style={{ padding: '0.5rem' }}>{item.groupClasses || '-'}</td>
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