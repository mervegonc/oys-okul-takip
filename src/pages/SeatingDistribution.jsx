import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaSync, FaPlus, FaTrash, FaRedo } from 'react-icons/fa';

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

  // Helper: Etiket Oluşturucu
  const getStudentGroupKey = (student) => {
    const langInfo = [
      student.english_level ? student.english_level.toUpperCase() : null,
      student.second_lang || student.second_language || null
    ].filter(Boolean).join(' - ');

    return `${student.grade}-${student.class}${langInfo ? ` (${langInfo})` : ''}`;
  };

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

  // Sınav seçilince öğrencileri ve şubeleri/dilleri getir
  useEffect(() => {
    if (!selectedExam) {
      setStudents([]);
      setAllClasses([]);
      setGroups([]);
      setDistributions([]);
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
        let query = supabase
          .from('students')
          .select('*')
          .in('grade', gradeLevels.map(String));

        const isForeignLanguageExam = 
          exam.type === 'foreign_language' || 
          exam.exam_type === 'foreign_language' || 
          exam.category === 'yabanci_dil' ||
          exam.is_second_language;

        if (isForeignLanguageExam && (exam.second_language || exam.second_lang || exam.language)) {
          const targetLang = exam.second_language || exam.second_lang || exam.language;
          query = query.eq('second_lang', targetLang);
        }

        const { data, error } = await query;
        if (error) throw error;

        setStudents(data || []);

        // Şube, İngilizce Seviyesi ve 2. Yabancı Dil kombinasyonlarını çıkar
        const classSet = new Set();
        (data || []).forEach(s => {
          if (s.grade && s.class) {
            classSet.add(getStudentGroupKey(s));
          }
        });
        const sortedClasses = Array.from(classSet).sort();
        setAllClasses(sortedClasses);

        setGroups([]);
        setDistributions([]);
        setMessage(`${data?.length || 0} öğrenci, ${sortedClasses.length} farklı grup seçeneği bulundu.`);
      } catch (error) {
        console.error('Öğrenciler alınamadı:', error);
        setMessage('Öğrenciler alınırken hata oluştu.');
      }
    };
    fetchStudentsForExam();
  }, [selectedExam, exams]);

  const addGroup = () => {
    const newGroup = {
      id: Date.now(),
      name: `Grup ${groups.length + 1}`,
      classes: [],
      roomIds: [],
    };
    setGroups([...groups, newGroup]);
  };

  const removeGroup = (groupId) => {
    if (groups.length <= 1) {
      setMessage('En az bir grup olmalıdır.');
      return;
    }
    if (!window.confirm('Bu grubu silmek istediğinize emin misiniz?')) return;
    setGroups(groups.filter(g => g.id !== groupId));
  };

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

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const interleaveStudentsByClass = (classList, studentMap) => {
    const classQueues = {};
    classList.forEach(cls => {
      classQueues[cls] = shuffleArray([...(studentMap[cls] || [])]);
    });

    const result = [];
    const totalStudents = Object.values(classQueues).reduce((acc, q) => acc + q.length, 0);

    while (result.length < totalStudents) {
      let lastClass = null;
      let consecutiveCount = 0;

      if (result.length >= 3) {
        const c1 = getStudentGroupKey(result[result.length - 1]);
        const c2 = getStudentGroupKey(result[result.length - 2]);
        const c3 = getStudentGroupKey(result[result.length - 3]);

        if (c1 === c2 && c2 === c3) {
          lastClass = c1;
          consecutiveCount = 3;
        }
      }

      let availableClasses = classList.filter(cls => classQueues[cls] && classQueues[cls].length > 0);

      if (consecutiveCount >= 3 && lastClass) {
        const filteredClasses = availableClasses.filter(cls => cls !== lastClass);
        if (filteredClasses.length > 0) {
          availableClasses = filteredClasses;
        }
      }

      if (availableClasses.length === 0) break;

      const chosenClass = availableClasses[Math.floor(Math.random() * availableClasses.length)];
      const student = classQueues[chosenClass].shift();
      result.push(student);
    }

    return result;
  };

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
    setMessage('Karma dağıtım yapılıyor...');

    try {
      const { data: previousPlans, error: prevPlanError } = await supabase
        .from('seating_plans')
        .select('exam_id, assignments')
        .neq('exam_id', selectedExam);

      if (prevPlanError) {
        console.warn('Geçmiş oturum planları okunamadı:', prevPlanError);
      }

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

      const { data: conflictGroups, error: conflictError } = await supabase
        .from('conflict_groups')
        .select('*');
      if (conflictError && conflictError.code !== 'PGRST116') {
        console.warn('Çakışma grupları okunamadı:', conflictError);
      }

      const studentMap = {};
      students.forEach(s => {
        const key = getStudentGroupKey(s);
        if (!studentMap[key]) studentMap[key] = [];
        studentMap[key].push(s);
      });

      const allRoomIds = [...new Set(groups.flatMap(g => g.roomIds))];
      const roomData = rooms.filter(r => allRoomIds.includes(r.id));
      const roomUsage = roomData.map(room => ({
        roomId: room.id,
        capacity: Number(room.capacity || 0) + Number(room.extra_seats_added || room.extraSeatsAdded || 0),
        seats: [],
      }));

      for (const group of groups) {
        const groupStudents = interleaveStudentsByClass(group.classes, studentMap);
        if (groupStudents.length === 0) continue;

        const groupRooms = shuffleArray(roomUsage.filter(r => group.roomIds.includes(r.roomId)));
        if (groupRooms.length === 0) {
          setMessage(`"${group.name}" için uygun salon bulunamadı.`);
          setLoading(false);
          return;
        }

        let roomIndex = Math.floor(Math.random() * groupRooms.length);
        for (const student of groupStudents) {
          let placed = false;
          const studentHistory = studentHistoryMap[String(student.id)] || new Set();

          for (let i = 0; i < groupRooms.length; i++) {
            const idx = (roomIndex + i) % groupRooms.length;
            const ra = groupRooms[idx];

            if (ra.seats.length < ra.capacity) {
              const candidateSeatNo = ra.seats.length + 1;
              const seatKey = `${ra.roomId}_${candidateSeatNo}`;

              if (!studentHistory.has(seatKey)) {
                ra.seats.push({ student, seatNumber: candidateSeatNo });
                placed = true;
                roomIndex = idx + 1;
                break;
              }
            }
          }

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

      if (conflictGroups && conflictGroups.length > 0) {
        for (const conflictGroup of conflictGroups) {
          const conflictStudentIds = (conflictGroup.student_ids || conflictGroup.studentIds || []).map(String);
          if (conflictStudentIds.length < 2) continue;

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
            second_language: seatObj.student.second_lang || seatObj.student.second_language || null,
            english_level: seatObj.student.english_level || null,
          });
        });
      });

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
      setMessage(`${assignments.length} öğrenci başarıyla yeniden karılarak dağıtıldı.`);
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
            const langInfo = (exam.second_lang || exam.second_language) ? ` [Dil: ${exam.second_lang || exam.second_language}]` : '';
            return (
              <option key={exam.id} value={exam.id}>
                {exam.title} ({exam.date}) - {grades.join(', ')}. Sınıflar{langInfo}
              </option>
            );
          })}
        </select>
      </div>

      {selectedExam && allClasses.length > 0 && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <h4>Tüm Şubeler / Dil Grupları</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {allClasses.map(cls => (
              <span key={cls} style={{ padding: '0.3rem 0.8rem', background: '#e9ecef', borderRadius: '4px', fontSize: '0.9rem' }}>
                {cls}
              </span>
            ))}
          </div>
        </div>
      )}

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

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4>Şube/Dil Grupları ve Salon Atamaları</h4>
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

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>Şubeler / Diller:</label>
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
                Seçili: {group.classes.length} şube/dil grubu
              </div>
            </div>

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

      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1rem' }}>
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
          }}
        >
          <FaSync /> {loading ? 'Dağıtılıyor...' : distributions.length > 0 ? 'Tekrar Kar (Yeniden Dağıt)' : 'Karma Dağıtımı Başlat'}
        </button>

        {distributions.length > 0 && (
          <button
            onClick={runDistribution}
            disabled={loading}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FaRedo /> Yeniden Kar
          </button>
        )}
      </div>

      {message && <p style={{ margin: '0.5rem 0', color: message.includes('hata') ? 'red' : 'green' }}>{message}</p>}

      {distributions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4>Dağıtım Sonucu ({distributions.length} öğrenci)</h4>
            <button
              onClick={runDistribution}
              disabled={loading}
              style={{
                padding: '0.3rem 0.8rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <FaRedo /> Beğenmedim, Tekrar Kar
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
              <thead style={{ background: '#f1f1f1' }}>
                <tr>
                  <th style={{ padding: '0.5rem' }}>#</th>
                  <th style={{ padding: '0.5rem' }}>Öğrenci</th>
                  <th style={{ padding: '0.5rem' }}>Sınıf</th>
                  <th style={{ padding: '0.5rem' }}>İngilizce Seviyesi</th>
                  <th style={{ padding: '0.5rem' }}>2. Yabancı Dil</th>
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
                      <td style={{ padding: '0.5rem' }}>{item.english_level ? item.english_level.toUpperCase() : '-'}</td>
                      <td style={{ padding: '0.5rem' }}>{item.second_language || '-'}</td>
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