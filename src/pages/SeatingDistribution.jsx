import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaSync, FaPlus, FaTrash } from 'react-icons/fa';

const SeatingDistribution = () => {
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [students, setStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Tüm sınav ve salonları getir
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: examData, error: examError } = await supabase
          .from('exams')
          .select('*')
          .order('created_at', { ascending: false });
        if (examError) throw examError;
        setExams(examData || []);

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

      const gradeLevels = exam.grade_levels || exam.gradeLevels || [];
      if (gradeLevels.length === 0) {
        setStudents([]);
        setAllClasses([]);
        setMessage('Seçili sınav için sınıf seviyesi tanımlanmamış.');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .in('grade', gradeLevels.map(String));
        if (error) throw error;

        setStudents(data || []);

        // Benzersiz şubeleri çıkar (grade-class)
        const classSet = new Set();
        (data || []).forEach(s => {
          if (s.grade && s.class) {
            classSet.add(`${s.grade}-${s.class}`);
          }
        });
        const sortedClasses = Array.from(classSet).sort();
        setAllClasses(sortedClasses);

        setGroups([]);
        setDistributions([]);
        setMessage(`${data?.length || 0} öğrenci, ${sortedClasses.length} farklı şube bulundu.`);
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

  // Yardımcı Fonksiyon: Diziyi karıştırma (Fisher-Yates Shuffle)
  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Şubeler arası dönel (Interleaved) karma algoritması
  const interleaveStudentsByClass = (classList, studentMap) => {
    const classQueues = classList.map(cls => shuffleArray([...(studentMap[cls] || [])]));
    const result = [];
    let added = true;

    while (added) {
      added = false;
      for (let i = 0; i < classQueues.length; i++) {
        if (classQueues[i].length > 0) {
          result.push(classQueues[i].shift());
          added = true;
        }
      }
    }
    return result;
  };

  // Karma dağıtım
  const runDistribution = async () => {
    if (!selectedExam) {
      setMessage('Lütfen bir sınav seçin.');
      return;
    }
    if (groups.length === 0) {
      setMessage('Lütfen en az bir grup oluşturun.');
      return;
    }

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
      // 1. GEÇMİŞ SINAV YERLEŞİMLERİNİ ALMA (1. kural için)
      const currentExam = exams.find(e => e.id === selectedExam);
      const currentGrades = (currentExam?.grade_levels || currentExam?.gradeLevels || []).map(String);

      const { data: previousPlans, error: prevPlanError } = await supabase
        .from('seating_plans')
        .select('exam_id, assignments')
        .neq('exam_id', selectedExam);

      if (prevPlanError) {
        console.warn('Geçmiş oturum planları okunamadı:', prevPlanError);
      }

      // Geçmiş oturum kayıtları: studentHistoryMap[studentId] = Set("roomId_seatNo")
      const studentHistoryMap = {};
      if (previousPlans && previousPlans.length > 0) {
        previousPlans.forEach(plan => {
          const assignmentsList = plan.assignments || [];
          assignmentsList.forEach(asgn => {
            if (asgn.student_id && asgn.room_id && asgn.seat_number) {
              const sId = String(asgn.student_id);
              if (!studentHistoryMap[sId]) {
                studentHistoryMap[sId] = new Set();
              }
              studentHistoryMap[sId].add(`${asgn.room_id}_${asgn.seat_number}`);
            }
          });
        });
      }

      // 2. ÇAKIŞMA GROUPS KONTROLÜ
      const { data: conflictGroups, error: conflictError } = await supabase
        .from('conflict_groups')
        .select('*');
      if (conflictError && conflictError.code !== 'PGRST116') {
        console.warn('Çakışma grupları okunamadı:', conflictError);
      }

      // Öğrencileri şubelerine göre haritala
      const studentMap = {};
      students.forEach(s => {
        const key = `${s.grade}-${s.class}`;
        if (!studentMap[key]) studentMap[key] = [];
        studentMap[key].push(s);
      });

      // Salon kullanım durumunu oluştur
      const allRoomIds = [...new Set(groups.flatMap(g => g.roomIds))];
      const roomData = rooms.filter(r => allRoomIds.includes(r.id));
      const roomUsage = roomData.map(room => ({
        roomId: room.id,
        capacity: Number(room.capacity || 0) + Number(room.extra_seats_added || room.extraSeatsAdded || 0),
        seats: [], // { student, seatNumber }
      }));

      // 3. ŞUBE VE GRUP BAZINDA DAĞITIM (KARMA / INTERLEAVED)
      for (const group of groups) {
        // Şubeler arası dönel karıştırma
        const groupStudents = interleaveStudentsByClass(group.classes, studentMap);
        if (groupStudents.length === 0) continue;

        const groupRooms = roomUsage.filter(r => group.roomIds.includes(r.roomId));
        if (groupRooms.length === 0) {
          setMessage(`"${group.name}" için uygun salon bulunamadı.`);
          setLoading(false);
          return;
        }

        // Salon kapasitelerini dengelemek adına odaları sırayla doldur
        let roomIndex = 0;
        for (const student of groupStudents) {
          let placed = false;
          const studentHistory = studentHistoryMap[String(student.id)] || new Set();

          // Öncelik 1: Öğrencinin geçmişte oturmadığı bir sandalye/salon seçmek
          for (let i = 0; i < groupRooms.length; i++) {
            const idx = (roomIndex + i) % groupRooms.length;
            const ra = groupRooms[idx];

            if (ra.seats.length < ra.capacity) {
              const candidateSeatNo = ra.seats.length + 1;
              const seatKey = `${ra.roomId}_${candidateSeatNo}`;

              // Daha önce bu koltukta oturmamışsa öncelikli oturt
              if (!studentHistory.has(seatKey)) {
                ra.seats.push({ student, seatNumber: candidateSeatNo });
                placed = true;
                roomIndex = idx + 1;
                break;
              }
            }
          }

          // Öncelik 2: Eğer tüm salon ve koltuklar çakışıyorsa kapasitesi boş olan ilk yere koy
          if (!placed) {
            for (let i = 0; i < groupRooms.length; i++) {
              const idx = (roomIndex + i) % groupRooms.length;
              const ra = groupRooms[idx];
              if (ra.seats.length < ra.capacity) {
                const seatNo = ra.seats.length + 1;
                ra.seats.push({ student, seatNumber: seatNo });
                placed = true;
                roomIndex = idx + 1;
                break;
              }
            }
          }

          if (!placed) {
            throw new Error(`"${group.name}" için yeterli salon kapasitesi yok.`);
          }
        }
      }

      // 4. ÇAKIŞMA GRUPLARININ FARKLI SALONLARA DAĞITILMASI
      if (conflictGroups && conflictGroups.length > 0) {
        for (const conflictGroup of conflictGroups) {
          const conflictStudentIds = (conflictGroup.student_ids || conflictGroup.studentIds || []).map(String);
          if (conflictStudentIds.length < 2) continue;

          // Çakışan öğrencilerin şu an oturduğu yerleri bul
          const currentConflictAssignments = [];
          for (const ra of roomUsage) {
            for (const seatObj of ra.seats) {
              if (conflictStudentIds.includes(String(seatObj.student.id))) {
                currentConflictAssignments.push({ student: seatObj.student, roomId: ra.roomId, seatNumber: seatObj.seatNumber });
              }
            }
          }

          const roomMap = {};
          currentConflictAssignments.forEach(item => {
            if (!roomMap[item.roomId]) roomMap[item.roomId] = [];
            roomMap[item.roomId].push(item);
          });

          // Aynı salonda birden fazla çakışan varsa diğer odalara kaydır
          for (const roomId of Object.keys(roomMap)) {
            const conflictItems = roomMap[roomId];
            if (conflictItems.length > 1) {
              for (let c = 1; c < conflictItems.length; c++) {
                const itemToMove = conflictItems[c];
                const targetRoom = roomUsage.find(r =>
                  r.roomId !== roomId &&
                  r.seats.length < r.capacity
                );

                if (targetRoom) {
                  const sourceRoom = roomUsage.find(r => r.roomId === roomId);
                  sourceRoom.seats = sourceRoom.seats.filter(s => String(s.student.id) !== String(itemToMove.student.id));

                  // Koltuk numaralarını yeniden düzenle
                  sourceRoom.seats.forEach((s, idx) => { s.seatNumber = idx + 1; });

                  const newSeatNo = targetRoom.seats.length + 1;
                  targetRoom.seats.push({ student: itemToMove.student, seatNumber: newSeatNo });
                } else {
                  setMessage('Çakışma grubu düzeltilemedi: yeterli alternatif salon yok.');
                  setLoading(false);
                  return;
                }
              }
            }
          }
        }
      }

      // 5. ATAMALARI DÜZENLEME VE VERİTABANINA KAYIT
      const assignments = [];
      roomUsage.forEach(ra => {
        ra.seats.forEach((seatObj) => {
          assignments.push({
            student_id: seatObj.student.id,
            room_id: ra.roomId,
            seat_number: seatObj.seatNumber,
            student_name: `${seatObj.student.first_name || seatObj.student.firstName || ''} ${seatObj.student.last_name || seatObj.student.lastName || ''}`.trim(),
            class: seatObj.student.class,
            grade: seatObj.student.grade,
          });
        });
      });

      // Eski aynı sınav planını silip yenisini ekle veya güncelle
      await supabase.from('seating_plans').delete().eq('exam_id', selectedExam);

      const { error: insertError } = await supabase
        .from('seating_plans')
        .insert({
          exam_id: selectedExam,
          created_at: new Date().toISOString(),
          assignments: assignments,
        });

      if (insertError) throw insertError;

      setDistributions(assignments);
      setMessage(`${assignments.length} öğrenci başarıyla karma olarak dağıtıldı.`);
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
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Sınav Seçin</label>
        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="">-- Sınav Seçin --</option>
          {exams.map(exam => {
            const grades = exam.grade_levels || exam.gradeLevels || [];
            return (
              <option key={exam.id} value={exam.id}>
                {exam.title} ({exam.date}) - {grades.join(', ')}. Sınıflar
              </option>
            );
          })}
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
            {rooms.map(room => {
              const totalCap = Number(room.capacity || 0) + Number(room.extra_seats_added || room.extraSeatsAdded || 0);
              return (
                <span key={room.id} style={{ padding: '0.3rem 0.8rem', background: '#e9ecef', borderRadius: '4px', fontSize: '0.9rem' }}>
                  {room.name} ({totalCap})
                  {room.class && ` - ${room.class}`}
                </span>
              );
            })}
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
                {rooms.map(room => {
                  const totalCap = Number(room.capacity || 0) + Number(room.extra_seats_added || room.extraSeatsAdded || 0);
                  return (
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
                      {room.name} ({totalCap})
                      {room.class && ` - ${room.class}`}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.3rem' }}>
                Seçili: {group.roomIds.length} salon
              </div>
            </div>
          </div>
        ))}

        {groups.length === 0 && selectedExam && (
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
                  <th style={{ padding: '0.5rem' }}>#</th>
                  <th style={{ padding: '0.5rem' }}>Öğrenci</th>
                  <th style={{ padding: '0.5rem' }}>Sınıf</th>
                  <th style={{ padding: '0.5rem' }}>Salon</th>
                  <th style={{ padding: '0.5rem' }}>Sıra No</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map((item, index) => {
                  const room = rooms.find(r => r.id === item.room_id || r.id === item.roomId);
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ padding: '0.5rem' }}>{item.student_name}</td>
                      <td style={{ padding: '0.5rem' }}>{item.grade}-{item.class}</td>
                      <td style={{ padding: '0.5rem' }}>{room?.name || item.room_id}</td>
                      <td style={{ padding: '0.5rem' }}>{item.seat_number}</td>
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