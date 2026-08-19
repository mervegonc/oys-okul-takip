import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaSync, FaSave, FaEdit, FaTrash } from 'react-icons/fa';

const SeatingDistribution = () => {
  // State'ler
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [groupConfig, setGroupConfig] = useState([]); // Şube grupları
  const [conflictList, setConflictList] = useState([]); // Çakışma listesi

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
    if (!selectedExam) return;
    const fetchStudentsForExam = async () => {
      const exam = exams.find(e => e.id === selectedExam);
      if (!exam) return;
      try {
        const gradeLevels = exam.gradeLevels || [];
        if (gradeLevels.length === 0) {
          setStudents([]);
          return;
        }
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

  // Kullanıcı şube gruplarını ekler (lise akademik için)
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

  // Karma algoritması
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

      // Öğrencileri grupla (kullanıcının tanımladığı gruplara göre)
      let studentGroups = [];
      if (exam.type === 'academic' && exam.level === 'high' && groupConfig.length > 0) {
        // Lise akademik: kullanıcı gruplarına göre
        const ungrouped = [...students];
        groupConfig.forEach(group => {
          const groupStudents = ungrouped.filter(s => group.classes.includes(s.class));
          if (groupStudents.length > 0) {
            studentGroups.push(groupStudents);
            // gruplananları çıkar
            groupStudents.forEach(s => {
              const idx = ungrouped.findIndex(u => u.id === s.id);
              if (idx > -1) ungrouped.splice(idx, 1);
            });
          }
        });
        // Gruplanmayanlar tek başına grup
        if (ungrouped.length > 0) studentGroups.push(ungrouped);
      } else if (exam.type === 'foreign_lang' && exam.level === 'high') {
        // Yabancı dil: seviye ve 2. dile göre grupla
        const groups = {};
        students.forEach(s => {
          const key = `${s.englishLevel || 'Core'}_${s.secondLang || 'None'}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
        });
        studentGroups = Object.values(groups);
      } else if (exam.type === 'academic' && exam.level === 'middle') {
        // Ortaokul akademik: homojen karıştır (tek grup)
        studentGroups = [students];
      } else if (exam.type === 'written' && exam.level === 'middle') {
        // Yazılı: kendi sınıfında
        const groups = {};
        students.forEach(s => {
          const key = `${s.grade}_${s.class}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
        });
        studentGroups = Object.values(groups);
      } else if (exam.type === 'foreign_lang' && exam.level === 'middle') {
        // Ortaokul yabancı dil: 2. dile göre grupla (tek dil kuralı)
        const groups = {};
        students.forEach(s => {
          const key = s.secondLang || 'None';
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
        });
        studentGroups = Object.values(groups);
        // Aynı dildeki öğrenciler tek salonda toplanmaya çalışılacak
      } else {
        // Varsayılan: tüm öğrenciler tek grup
        studentGroups = [students];
      }

      // Salonları sırayla doldur
      const assignments = [];
      let roomIndex = 0;
      for (const group of studentGroups) {
        let remaining = [...group];
        while (remaining.length > 0) {
          const room = roomData[roomIndex % roomData.length];
          const capacity = room.capacity + (room.extraSeatsAdded || 0);
          const take = Math.min(remaining.length, capacity);
          const batch = remaining.splice(0, take);
          batch.forEach((student, idx) => {
            assignments.push({
              studentId: student.id,
              roomId: room.id,
              seatNumber: idx + 1,
              studentName: `${student.firstName} ${student.lastName}`,
              class: student.class,
              grade: student.grade,
            });
          });
          roomIndex++;
        }
      }

      // Çakışma listesi kontrolü (basitçe aynı salona düşenleri değiştir)
      if (conflictList.length > 0 && exam.type === 'academic' && exam.level === 'high') {
        // Çakışma listesindeki öğrencileri farklı salonlara ata
        // Bu basit bir çözüm, gerçek algoritma daha karmaşık
        for (const conflict of conflictList) {
          const [s1, s2] = conflict;
          const assign1 = assignments.find(a => a.studentId === s1);
          const assign2 = assignments.find(a => a.studentId === s2);
          if (assign1 && assign2 && assign1.roomId === assign2.roomId) {
            // assign2'yi farklı bir salona taşı
            const newRoom = roomData.find(r => r.id !== assign1.roomId);
            if (newRoom) assign2.roomId = newRoom.id;
          }
        }
      }

      // Firestore'a kaydet
      const seatingPlanRef = await addDoc(collection(db, 'seating_plans'), {
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
              {exam.title} ({exam.date})
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
            + Grup Ekle
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
          <p style={{ fontSize: '0.9rem', color: '#666' }}>Örn: A, B, C grubu veya 12-A, 12-B</p>
        </div>
      )}

      {/* Çakışma Listesi */}
      <div style={{ marginBottom: '1rem' }}>
        <h4>Çakışma Listesi (Aynı salonda oturmaması gereken öğrenciler)</h4>
        <textarea
          placeholder="Öğrenci ID'lerini virgülle ayırın (örn: id1,id2,id3)"
          value={conflictList.join(', ')}
          onChange={(e) => setConflictList(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px' }}
        />
        <p style={{ fontSize: '0.9rem', color: '#666' }}>Bu öğrenciler farklı salonlara atanmaya çalışılacak.</p>
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

      {/* Sonuç Listesi */}
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