import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaSync, FaPlus, FaTrash, FaCheckSquare, FaSquare } from 'react-icons/fa';

const SeatingDistribution = () => {
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [students, setStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [examMode, setExamMode] = useState('lise_akademik');
  const [langPrimaryFilter, setLangPrimaryFilter] = useState('second_lang');
  const [keepInOwnClassroom, setKeepInOwnClassroom] = useState(false);

  // Salonları sayısal/alfabetik (Salon-1, Salon-2 ... Salon-10) doğru sıralayan fonksiyon
  const sortRoomsNaturally = (a, b) => {
    return (a.name || '').localeCompare(b.name || '', 'tr', { numeric: true, sensitivity: 'base' });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: examData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
        setExams(examData || []);

        const { data: roomData } = await supabase.from('rooms').select('*').order('name', { ascending: true });
        // Gelen salonları akıllı sıralamadan geçiriyoruz
        setRooms((roomData || []).sort(sortRoomsNaturally));
      } catch (error) {
        console.error('Veri yükleme hatası:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedExamId) {
      setStudents([]);
      setAllClasses([]);
      setGroups([]);
      setDistributions([]);
      return;
    }

    const exam = exams.find(e => e.id === selectedExamId);

    const fetchStudents = async () => {
      if (!exam) return;
      const gradeLevels = exam.grade_levels || exam.gradeLevels || [];
      if (gradeLevels.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .in('grade', gradeLevels.map(String));

        if (error) throw error;
        setStudents(data || []);

        const classSet = new Set((data || []).map(s => `${s.grade}-${s.class}`));
        setAllClasses(Array.from(classSet).sort());
        setGroups([]);
        setDistributions([]);
        setMessage(`${data?.length || 0} öğrenci listelendi.`);
      } catch (err) {
        console.error('Öğrenci çekme hatası:', err);
      }
    };

    fetchStudents();
  }, [selectedExamId, exams]);

  const addGroup = () => {
    setGroups([
      ...groups,
      { id: Date.now(), name: `Grup ${groups.length + 1}`, classes: [], roomIds: [] }
    ]);
  };

  const removeGroup = (groupId) => {
    if (groups.length <= 1) return setMessage('En az 1 grup tanımlamalısınız.');
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

  const shuffleArray = (arr) => {
    const list = [...arr];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const runDistribution = async () => {
    if (!selectedExamId) return setMessage('Lütfen bir sınav seçin.');

    if (!(examMode === 'ortaokul_akademik' && keepInOwnClassroom) && groups.length === 0) {
      return setMessage('Dağıtım için en az bir grup oluşturmalısınız.');
    }

    setLoading(true);
    setMessage('Dağıtım hesaplanıyor...');

    try {
      const assignments = [];

      if (examMode === 'lise_akademik' || examMode === 'ortaokul_akademik') {
        if (examMode === 'ortaokul_akademik' && keepInOwnClassroom) {
          const classGrouped = {};
          students.forEach(st => {
            const clsKey = `${st.grade}-${st.class}`;
            if (!classGrouped[clsKey]) classGrouped[clsKey] = [];
            classGrouped[clsKey].push(st);
          });

          let roomIdx = 0;
          for (const clsKey of Object.keys(classGrouped)) {
            const clsStudents = classGrouped[clsKey];
            const targetRoom = rooms[roomIdx % rooms.length];

            clsStudents.forEach((st, idx) => {
              assignments.push({
                student_id: st.id,
                room_id: targetRoom.id,
                seat_number: idx + 1,
                student_name: `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim(),
                class: st.class,
                grade: st.grade,
              });
            });
            roomIdx++;
          }
        } else {
          for (const group of groups) {
            const groupStudents = students.filter(s => group.classes.includes(`${s.grade}-${s.class}`));
            if (groupStudents.length === 0) continue;

            const groupRooms = rooms
              .filter(r => group.roomIds.includes(r.id))
              .map(r => ({
                ...r,
                totalCap: Number(r.capacity || 0) + Number(r.extra_seats_added || r.extraSeatsAdded || 0),
                seats: []
              }));

            if (groupRooms.length === 0) throw new Error(`"${group.name}" için salon seçilmedi.`);

            const classQueues = {};
            group.classes.forEach(cls => {
              classQueues[cls] = shuffleArray(groupStudents.filter(s => `${s.grade}-${s.class}` === cls));
            });

            const interleavedList = [];
            const totalGroupStudents = groupStudents.length;

            while (interleavedList.length < totalGroupStudents) {
              const availClasses = group.classes.filter(cls => classQueues[cls] && classQueues[cls].length > 0);
              if (availClasses.length === 0) break;

              const lastClass = interleavedList.length > 0 
                ? `${interleavedList[interleavedList.length - 1].grade}-${interleavedList[interleavedList.length - 1].class}` 
                : null;

              let candidateClasses = availClasses.filter(c => c !== lastClass);
              if (candidateClasses.length === 0) candidateClasses = availClasses;

              const chosenClass = candidateClasses[Math.floor(Math.random() * candidateClasses.length)];
              interleavedList.push(classQueues[chosenClass].shift());
            }

            const totalCapacity = groupRooms.reduce((sum, r) => sum + r.totalCap, 0);
            if (totalCapacity < totalGroupStudents) {
              throw new Error(`"${group.name}" grubundaki toplam öğrenci sayısı (${totalGroupStudents}) seçilen salonların toplam kapasitesini (${totalCapacity}) aşıyor!`);
            }

            let studentIdx = 0;
            for (let i = 0; i < groupRooms.length; i++) {
              const room = groupRooms[i];
              let targetCount = i === groupRooms.length - 1 
                ? interleavedList.length - studentIdx 
                : Math.round((room.totalCap / totalCapacity) * interleavedList.length);

              targetCount = Math.min(targetCount, room.totalCap, interleavedList.length - studentIdx);

              for (let c = 0; c < targetCount; c++) {
                if (studentIdx < interleavedList.length) {
                  room.seats.push(interleavedList[studentIdx]);
                  studentIdx++;
                }
              }
            }

            while (studentIdx < interleavedList.length) {
              const availableRoom = groupRooms.find(r => r.seats.length < r.totalCap);
              if (availableRoom) {
                availableRoom.seats.push(interleavedList[studentIdx]);
                studentIdx++;
              } else {
                break;
              }
            }

            groupRooms.forEach(room => {
              room.seats.forEach((st, idx) => {
                assignments.push({
                  student_id: st.id,
                  room_id: room.id,
                  seat_number: idx + 1,
                  student_name: `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim(),
                  class: st.class,
                  grade: st.grade,
                });
              });
            });
          }
        }
      } else if (examMode === 'lise_yabanci_dil') {
        for (const group of groups) {
          const groupStudents = students.filter(s => group.classes.includes(`${s.grade}-${s.class}`));
          if (groupStudents.length === 0) continue;

          const groupRooms = rooms
            .filter(r => group.roomIds.includes(r.id))
            .map(r => ({
              ...r,
              totalCap: Number(r.capacity || 0) + Number(r.extra_seats_added || r.extraSeatsAdded || 0),
              seats: []
            }));

          if (groupRooms.length === 0) throw new Error(`"${group.name}" için salon seçilmedi.`);

          const sortedStudents = [...groupStudents].sort((a, b) => {
            if (langPrimaryFilter === 'second_lang') {
              const langA = a.second_lang || a.second_language || 'Z_Belirtilmedi';
              const langB = b.second_lang || b.second_language || 'Z_Belirtilmedi';
              if (langA !== langB) return langA.localeCompare(langB);

              const engA = a.english_level || 'Z_Belirtilmedi';
              const engB = b.english_level || 'Z_Belirtilmedi';
              return engA.localeCompare(engB);
            } else {
              const engA = a.english_level || 'Z_Belirtilmedi';
              const engB = b.english_level || 'Z_Belirtilmedi';
              if (engA !== engB) return engA.localeCompare(engB);

              const langA = a.second_lang || a.second_language || 'Z_Belirtilmedi';
              const langB = b.second_lang || b.second_language || 'Z_Belirtilmedi';
              return langA.localeCompare(langB);
            }
          });

          const totalCapacity = groupRooms.reduce((sum, r) => sum + r.totalCap, 0);
          let stIdx = 0;

          for (let i = 0; i < groupRooms.length; i++) {
            const room = groupRooms[i];
            let targetCount = i === groupRooms.length - 1 
              ? sortedStudents.length - stIdx 
              : Math.round((room.totalCap / totalCapacity) * sortedStudents.length);

            targetCount = Math.min(targetCount, room.totalCap, sortedStudents.length - stIdx);

            for (let c = 0; c < targetCount; c++) {
              if (stIdx < sortedStudents.length) {
                room.seats.push(sortedStudents[stIdx]);
                stIdx++;
              }
            }
          }

          while (stIdx < sortedStudents.length) {
            const availableRoom = groupRooms.find(r => r.seats.length < r.totalCap);
            if (availableRoom) {
              availableRoom.seats.push(sortedStudents[stIdx]);
              stIdx++;
            } else {
              break;
            }
          }

          groupRooms.forEach(room => {
            room.seats.forEach((st, idx) => {
              assignments.push({
                student_id: st.id,
                room_id: room.id,
                seat_number: idx + 1,
                student_name: `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim(),
                class: st.class,
                grade: st.grade,
                second_language: st.second_lang || st.second_language || null,
                english_level: st.english_level || null,
              });
            });
          });
        }
      }

      await supabase.from('seating_plans').delete().eq('exam_id', selectedExamId);
      const { error: insertError } = await supabase.from('seating_plans').insert({
        exam_id: selectedExamId,
        created_at: new Date().toISOString(),
        assignments: assignments,
      });

      if (insertError) throw insertError;

      setDistributions(assignments);
      setMessage('Dağıtım işlemi tamamlandı ve veritabanına kaydedildi.');
    } catch (err) {
      console.error(err);
      setMessage(`Hata: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🪑 Sınav Oturma Düzeni Paneli</h2>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setExamMode('lise_akademik')}
          style={{
            flex: 1, padding: '1rem', borderRadius: '8px', border: '2px solid #007bff',
            background: examMode === 'lise_akademik' ? '#007bff' : '#fff',
            color: examMode === 'lise_akademik' ? '#fff' : '#007bff', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          📘 1. Lise Akademik Deneme
        </button>

        <button
          onClick={() => setExamMode('lise_yabanci_dil')}
          style={{
            flex: 1, padding: '1rem', borderRadius: '8px', border: '2px solid #28a745',
            background: examMode === 'lise_yabanci_dil' ? '#28a745' : '#fff',
            color: examMode === 'lise_yabanci_dil' ? '#fff' : '#28a745', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          🌍 2. Lise Yabancı Dil Deneme
        </button>

        <button
          onClick={() => setExamMode('ortaokul_akademik')}
          style={{
            flex: 1, padding: '1rem', borderRadius: '8px', border: '2px solid #fd7e14',
            background: examMode === 'ortaokul_akademik' ? '#fd7e14' : '#fff',
            color: examMode === 'ortaokul_akademik' ? '#fff' : '#fd7e14', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          📙 3. Ortaokul Akademik Deneme
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Sınavı Seçin</label>
        <select
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          style={{ width: '100%', padding: '0.7rem', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value="">-- Sınav Seçin --</option>
          {exams.map(exam => {
            const grades = exam.grade_levels || exam.gradeLevels || [];
            const gradeStr = grades.length > 0 ? ` [Sınıflar: ${grades.join(', ')}]` : '';
            return (
              <option key={exam.id} value={exam.id}>
                {exam.title} ({exam.date}){gradeStr}
              </option>
            );
          })}
        </select>
      </div>

      {selectedExamId && examMode === 'lise_yabanci_dil' && (
        <div style={{ background: '#eef6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #b6d4fe', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#055160' }}>📊 Excel Tipi Sıralama Düzeni</h4>
          <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: '#555' }}>
            Öğrenciler karma yapılmadan sırayla dizilir (Almanca biter, Fransızca başlar).
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <label style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              <input
                type="radio"
                name="langFilter"
                value="second_lang"
                checked={langPrimaryFilter === 'second_lang'}
                onChange={() => setLangPrimaryFilter('second_lang')}
              /> 1. 2. Yabancı Dil (Almanca, Fransızca vb.) ➔ 2. Seviye
            </label>
            <label style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              <input
                type="radio"
                name="langFilter"
                value="english_level"
                checked={langPrimaryFilter === 'english_level'}
                onChange={() => setLangPrimaryFilter('english_level')}
              /> 1. İngilizce Seviye (Core, Extended vb.) ➔ 2. 2. Yabancı Dil
            </label>
          </div>
        </div>
      )}

      {selectedExamId && examMode === 'ortaokul_akademik' && (
        <div style={{ background: '#fff3cd', padding: '1rem', borderRadius: '8px', border: '1px solid #ffeeba', marginBottom: '1.5rem' }}>
          <label
            onClick={() => setKeepInOwnClassroom(!keepInOwnClassroom)}
            style={{ cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#856404' }}
          >
            {keepInOwnClassroom ? <FaCheckSquare size={20} color="#fd7e14" /> : <FaSquare size={20} color="#ccc" />}
            Herkes Kendi Şubesinde Sınava Girsin (Karma Yapma)
          </label>
        </div>
      )}

      {selectedExamId && !(examMode === 'ortaokul_akademik' && keepInOwnClassroom) && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4>Grup & Salon Yapılandırması</h4>
            <button onClick={addGroup} style={{ padding: '0.4rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              <FaPlus /> Grup Ekle
            </button>
          </div>

          {groups.map(group => (
            <div key={group.id} style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>{group.name}</strong>
                <button onClick={() => removeGroup(group.id)} style={{ color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer' }}>
                  <FaTrash /> Sil
                </button>
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <small style={{ fontWeight: 'bold' }}>Şubeler:</small>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                  {allClasses.map(cls => (
                    <button
                      key={cls}
                      onClick={() => toggleClassForGroup(group.id, cls)}
                      style={{
                        padding: '0.2rem 0.6rem',
                        background: group.classes.includes(cls) ? '#007bff' : '#f1f1f1',
                        color: group.classes.includes(cls) ? '#fff' : '#333',
                        border: 'none', borderRadius: '4px', cursor: 'pointer'
                      }}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <small style={{ fontWeight: 'bold' }}>Salonlar:</small>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                  {rooms.slice().sort(sortRoomsNaturally).map(room => {
                    const totalCap = Number(room.capacity || 0) + Number(room.extra_seats_added || room.extraSeatsAdded || 0);
                    return (
                      <button
                        key={room.id}
                        onClick={() => toggleRoomForGroup(group.id, room.id)}
                        style={{
                          padding: '0.2rem 0.6rem',
                          background: group.roomIds.includes(room.id) ? '#17a2b8' : '#f1f1f1',
                          color: group.roomIds.includes(room.id) ? '#fff' : '#333',
                          border: 'none', borderRadius: '4px', cursor: 'pointer'
                        }}
                      >
                        {room.name} ({totalCap} Kişi)
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedExamId && (
        <button
          onClick={runDistribution}
          disabled={loading}
          style={{ padding: '0.8rem 2rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
        >
          <FaSync /> {loading ? 'Dağıtılıyor...' : 'Dağıtımı Başlat'}
        </button>
      )}

      {message && <p style={{ marginTop: '1rem', fontWeight: 'bold', color: message.includes('Hata') ? 'red' : 'green' }}>{message}</p>}

      {distributions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Dağıtım Listesi ({distributions.length} Öğrenci)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', marginTop: '1rem' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem' }}>Salon</th>
                <th style={{ padding: '0.6rem' }}>Sıra</th>
                <th style={{ padding: '0.6rem' }}>Öğrenci Adı</th>
                <th style={{ padding: '0.6rem' }}>Sınıf</th>
                {examMode === 'lise_yabanci_dil' && <th style={{ padding: '0.6rem' }}>2. Yabancı Dil</th>}
                {examMode === 'lise_yabanci_dil' && <th style={{ padding: '0.6rem' }}>İngilizce Seviyesi</th>}
              </tr>
            </thead>
            <tbody>
              {distributions.map((item, idx) => {
                const roomName = rooms.find(r => r.id === item.room_id)?.name || item.room_id;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>{roomName}</td>
                    <td style={{ padding: '0.6rem' }}>{item.seat_number}</td>
                    <td style={{ padding: '0.6rem' }}>{item.student_name}</td>
                    <td style={{ padding: '0.6rem' }}>{item.grade}-{item.class}</td>
                    {examMode === 'lise_yabanci_dil' && (
                      <td style={{ padding: '0.6rem', color: '#28a745', fontWeight: 'bold' }}>{item.second_language || '-'}</td>
                    )}
                    {examMode === 'lise_yabanci_dil' && (
                      <td style={{ padding: '0.6rem', color: '#007bff', fontWeight: 'bold' }}>{item.english_level ? item.english_level.toUpperCase() : '-'}</td>
                    )}
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