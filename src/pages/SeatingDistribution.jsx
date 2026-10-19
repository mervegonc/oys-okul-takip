import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaSync, FaPlus, FaTrash, FaCheckSquare, FaSquare, FaExclamationTriangle } from 'react-icons/fa';

const SeatingDistribution = () => {
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [students, setStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [conflictGroups, setConflictGroups] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 4 EKRAN / MOD SEÇİMİ
  const [examMode, setExamMode] = useState('lise_akademik');

  // Lise Yabancı Dil Modu Filtre ve Sıralama Ayarı
  const [langPrimaryFilter, setLangPrimaryFilter] = useState('second_lang');

  // Ortaokul Modu Özel Seçenek
  const [keepInOwnClassroom, setKeepInOwnClassroom] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: examData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
        setExams(examData || []);

        const { data: roomData } = await supabase.from('rooms').select('*').order('name', { ascending: true });
        setRooms(roomData || []);

        const { data: conflictData } = await supabase.from('conflict_groups').select('*');
        setConflictGroups(conflictData || []);
      } catch (error) {
        console.error('Veri yükleme hatası:', error);
      }
    };
    fetchData();
  }, []);

  // Sınav seçildiğinde öğrencileri ve daha önce yapılmış dağılımı kontrol et
  useEffect(() => {
    if (!selectedExamId) {
      setStudents([]);
      setAllClasses([]);
      setGroups([]);
      setDistributions([]);
      return;
    }

    const exam = exams.find(e => e.id === selectedExamId);

    const fetchExamDataAndPlan = async () => {
      if (!exam) return;
      const gradeLevels = exam.grade_levels || exam.gradeLevels || [];
      if (gradeLevels.length === 0) return;

      try {
        // 1. Öğrencileri Çek
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .in('grade', gradeLevels.map(String));

        if (studentError) throw studentError;
        const fetchedStudents = studentData || [];
        setStudents(fetchedStudents);

        const classSet = new Set(fetchedStudents.map(s => `${s.grade}-${s.class}`));
        const sortedClasses = Array.from(classSet).sort();
        setAllClasses(sortedClasses);

        // 2. Bu sınav için daha önce yapılmış bir oturma planı (seating_plans) var mı kontrol et
        const { data: planData, error: planError } = await supabase
          .from('seating_plans')
          .select('*')
          .eq('exam_id', selectedExamId)
          .maybeSingle();

        if (planError) console.error('Plan kontrol hatası:', planError);

        if (planData && planData.assignments && planData.assignments.length > 0) {
          setDistributions(planData.assignments);

          const usedRoomIds = Array.from(new Set(planData.assignments.map(a => a.room_id)));
          const usedClasses = Array.from(new Set(planData.assignments.map(a => `${a.grade}-${a.class}`))).sort();

          setGroups([
            {
              id: Date.now(),
              name: 'Grup 1 (Önceki Dağıtımdan Yüklendi)',
              classes: usedClasses,
              roomIds: usedRoomIds
            }
          ]);

          setMessage(`Bu sınav daha önce karılmış! ${planData.assignments.length} öğrencinin önceki oturma düzeni ve salon ayarları otomatik olarak yüklendi.`);
        } else {
          setDistributions([]);
          setGroups([
            {
              id: Date.now(),
              name: 'Grup 1',
              classes: sortedClasses,
              roomIds: []
            }
          ]);
          setMessage(`${fetchedStudents.length} öğrenci veritabanından çekildi. Yeni dağıtım yapabilirsiniz.`);
        }
      } catch (err) {
        console.error('Veri yükleme hatası:', err);
      }
    };

    fetchExamDataAndPlan();
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

  const getStudentLanguage = (st) => {
    return st.second_lang || st.second_language || st.yabanci_dil || st.foreign_language || 'Belirtilmedi';
  };

  // DAĞITIM MOTORU
  const runDistribution = async () => {
    if (!selectedExamId) return setMessage('Hata: Lütfen bir sınav seçin.');

    if (groups.length === 0) {
      return setMessage('Hata: Dağıtım için en az bir grup oluşturmalısınız.');
    }

    setLoading(true);
    setMessage('Dağıtım hesaplanıyor ve homojen/çakışma kuralları uygulanıyor...');

    try {
      const assignments = [];
      const currentExamStudentIds = new Set(students.map(s => String(s.id)));

      const conflictPairsMap = {};
      conflictGroups.forEach(cg => {
        const cgStudents = (cg.student_ids || []).map(String).filter(id => currentExamStudentIds.has(id));
        cgStudents.forEach(id1 => {
          if (!conflictPairsMap[id1]) conflictPairsMap[id1] = new Set();
          cgStudents.forEach(id2 => {
            if (id1 !== id2) {
              conflictPairsMap[id1].add(id2);
            }
          });
        });
      });

      // ORTAOKUL AKADEMİK - KENDİ ŞUBESİNDE
      if (examMode === 'ortaokul_akademik' && keepInOwnClassroom) {
        for (const group of groups) {
          const groupRooms = rooms.filter(r => group.roomIds.includes(r.id));
          if (groupRooms.length === 0) throw new Error(`"${group.name}" için hiç salon seçilmedi!`);
          if (group.classes.length === 0) throw new Error(`"${group.name}" için hiç şube seçilmedi!`);

          if (group.classes.length !== groupRooms.length) {
            throw new Error(`"${group.name}" grubunda seçilen şube sayısı ile salon sayısı eşleşmeli!`);
          }

          group.classes.forEach((cls, idx) => {
            const targetRoom = groupRooms[idx];
            const clsStudents = students.filter(s => `${s.grade}-${s.class}` === cls);

            if (clsStudents.length === 0) return;

            const shuffledClassStudents = shuffleArray(clsStudents);

            shuffledClassStudents.forEach((st, seatIdx) => {
              assignments.push({
                student_id: st.id,
                room_id: targetRoom.id,
                seat_number: seatIdx + 1,
                student_name: `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim(),
                class: st.class,
                grade: st.grade,
              });
            });
          });
        }
      } 
      // LİSE & ORTAOKUL AKADEMİK (KARMA)
      else if (examMode === 'lise_akademik' || examMode === 'ortaokul_akademik') {
        for (const group of groups) {
          const groupStudents = students.filter(s => group.classes.includes(`${s.grade}-${s.class}`));
          if (groupStudents.length === 0) {
            throw new Error(`"${group.name}" grubunda seçilen şubelerde öğrenci bulunamadı!`);
          }

          const groupRooms = rooms
            .filter(r => group.roomIds.includes(r.id))
            .map(r => ({
              ...r,
              totalCap: Math.min(24, Number(r.capacity || 24) + Number(r.extra_seats_added || r.extraSeatsAdded || 0)),
              seats: []
            }));

          if (groupRooms.length === 0) throw new Error(`"${group.name}" için salon seçilmedi.`);

          const totalGroupStudents = groupStudents.length;
          const totalCapacity = groupRooms.reduce((sum, r) => sum + r.totalCap, 0);

          if (totalCapacity < totalGroupStudents) {
            throw new Error(`"${group.name}" grubundaki öğrenci sayısı salon kapasitesini aşıyor!`);
          }

          const numRooms = groupRooms.length;
          const baseQuota = Math.floor(totalGroupStudents / numRooms);
          const remainder = totalGroupStudents % numRooms;

          groupRooms.forEach((room, idx) => {
            room.targetQuota = baseQuota + (idx < remainder ? 1 : 0);
          });

          const classQueues = {};
          group.classes.forEach(cls => {
            classQueues[cls] = shuffleArray(groupStudents.filter(s => `${s.grade}-${s.class}` === cls));
          });

          const interleavedList = [];
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

          const shuffledInterleaved = shuffleArray(interleavedList);

          for (const st of shuffledInterleaved) {
            let placed = false;

            for (const room of groupRooms) {
              if (room.seats.length >= room.targetQuota) continue;

              const stIdStr = String(st.id);
              const hasConflict = room.seats.some(existingSt => {
                const existingIdStr = String(existingSt.id);
                return (conflictPairsMap[stIdStr] && conflictPairsMap[stIdStr].has(existingIdStr)) || 
                       (conflictPairsMap[existingIdStr] && conflictPairsMap[existingIdStr].has(stIdStr));
              });

              if (!hasConflict) {
                room.seats.push(st);
                placed = true;
                break;
              }
            }

            if (!placed) {
              const availableRooms = groupRooms
                .filter(r => {
                  if (r.seats.length >= r.totalCap || r.seats.length >= r.targetQuota + 2) return false;
                  const stIdStr = String(st.id);
                  return !r.seats.some(existingSt => {
                    const existingIdStr = String(existingSt.id);
                    return (conflictPairsMap[stIdStr] && conflictPairsMap[stIdStr].has(existingIdStr)) || 
                           (conflictPairsMap[existingIdStr] && conflictPairsMap[existingIdStr].has(stIdStr));
                  });
                })
                .sort((a, b) => a.seats.length - b.seats.length);

              if (availableRooms.length > 0) {
                availableRooms[0].seats.push(st);
                placed = true;
              }
            }

            if (!placed) {
              const generalRooms = groupRooms
                .filter(r => r.seats.length < r.totalCap)
                .sort((a, b) => a.seats.length - b.seats.length);

              if (generalRooms.length > 0) {
                generalRooms[0].seats.push(st);
                placed = true;
              }
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

      // LİSE YABANCI DİL
      else if (examMode === 'lise_yabanci_dil') {
        for (const group of groups) {
          const groupStudents = students.filter(s => group.classes.includes(`${s.grade}-${s.class}`));
          if (groupStudents.length === 0) throw new Error(`"${group.name}" grubunda seçilen şubelerde öğrenci bulunamadı!`);

          const groupRooms = rooms
            .filter(r => group.roomIds.includes(r.id))
            .map(r => ({
              ...r,
              totalCap: Math.min(24, Number(r.capacity || 24) + Number(r.extra_seats_added || r.extraSeatsAdded || 0)),
              seats: []
            }));

          if (groupRooms.length === 0) throw new Error(`"${group.name}" için salon seçilmedi.`);

          const totalGroupStudents = groupStudents.length;
          const numRooms = groupRooms.length;
          const baseQuota = Math.floor(totalGroupStudents / numRooms);
          const remainder = totalGroupStudents % numRooms;

          groupRooms.forEach((room, idx) => {
            room.targetQuota = baseQuota + (idx < remainder ? 1 : 0);
          });

          const sortedStudents = [...groupStudents].sort((a, b) => {
            if (langPrimaryFilter === 'second_lang') {
              const langA = getStudentLanguage(a);
              const langB = getStudentLanguage(b);
              if (langA !== langB) return langA.localeCompare(langB);

              const engA = a.english_level || 'Z_Belirtilmedi';
              const engB = b.english_level || 'Z_Belirtilmedi';
              return engA.localeCompare(engB);
            } else {
              const engA = a.english_level || 'Z_Belirtilmedi';
              const engB = b.english_level || 'Z_Belirtilmedi';
              if (engA !== engB) return engA.localeCompare(engB);

              const langA = getStudentLanguage(a);
              const langB = getStudentLanguage(b);
              return langA.localeCompare(langB);
            }
          });

          for (const st of sortedStudents) {
            let placed = false;
            for (const room of groupRooms) {
              if (room.seats.length >= room.targetQuota) continue;

              const stIdStr = String(st.id);
              const hasConflict = room.seats.some(existingSt => {
                const existingIdStr = String(existingSt.id);
                return (conflictPairsMap[stIdStr] && conflictPairsMap[stIdStr].has(existingIdStr)) || 
                       (conflictPairsMap[existingIdStr] && conflictPairsMap[existingIdStr].has(stIdStr));
              });

              if (!hasConflict) {
                room.seats.push(st);
                placed = true;
                break;
              }
            }

            if (!placed) {
              const availableRooms = groupRooms
                .filter(r => r.seats.length < r.totalCap)
                .sort((a, b) => a.seats.length - b.seats.length);
              if (availableRooms.length > 0) {
                availableRooms[0].seats.push(st);
              }
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
                second_language: getStudentLanguage(st),
                english_level: st.english_level || null,
              });
            });
          });
        }
      }

      // ORTAOKUL YABANCI DİL
      else if (examMode === 'ortaokul_yabanci_dil') {
        for (const group of groups) {
          const groupStudents = students.filter(s => group.classes.includes(`${s.grade}-${s.class}`));
          if (groupStudents.length === 0) {
            throw new Error(`Hata: "${group.name}" grubundaki seçili şubelerde hiç öğrenci bulunamadı!`);
          }

          const groupRooms = rooms
            .filter(r => group.roomIds.includes(r.id))
            .map(r => ({
              ...r,
              totalCap: Math.min(24, Number(r.capacity || 24) + Number(r.extra_seats_added || r.extraSeatsAdded || 0)),
              seats: []
            }));

          if (groupRooms.length === 0) throw new Error(`Hata: "${group.name}" için salon seçilmedi.`);

          const langGroups = {};
          groupStudents.forEach(st => {
            const lang = getStudentLanguage(st);
            if (!langGroups[lang]) langGroups[lang] = [];
            langGroups[lang].push(st);
          });

          let roomIndex = 0;

          for (const [lang, langStudents] of Object.entries(langGroups)) {
            if (langStudents.length === 0) continue;

            if (roomIndex < groupRooms.length && groupRooms[roomIndex].seats.length > 0) {
              roomIndex++;
            }

            const shuffledLangStudents = shuffleArray(langStudents);

            for (const st of shuffledLangStudents) {
              while (roomIndex < groupRooms.length && groupRooms[roomIndex].seats.length >= groupRooms[roomIndex].totalCap) {
                roomIndex++;
              }

              if (roomIndex >= groupRooms.length) {
                throw new Error(
                  `Kapasite/Salon Yetersiz! "${lang}" dili öğrencileri için boş salon kalmadı.`
                );
              }

              groupRooms[roomIndex].seats.push(st);
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
                second_language: getStudentLanguage(st),
              });
            });
          });
        }
      }

      if (assignments.length === 0) {
        throw new Error('Dağıtılabilecek hiçbir öğrenci bulunamadı!');
      }

      await supabase.from('seating_plans').delete().eq('exam_id', selectedExamId);
      const { error: insertError } = await supabase.from('seating_plans').insert({
        exam_id: selectedExamId,
        created_at: new Date().toISOString(),
        assignments: assignments,
      });

      if (insertError) throw insertError;

      setDistributions(assignments);
      setMessage(`Dağıtım başarıyla tamamlandı! ${assignments.length} öğrenci yerleştirildi.`);
    } catch (err) {
      console.error(err);
      setDistributions([]);
      setMessage(`${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Salon özetlerini hesaplamak için yardımcı nesne
  const roomSummaryMap = {};
  distributions.forEach(item => {
    const rName = rooms.find(r => r.id === item.room_id)?.name || item.room_id;
    if (!roomSummaryMap[rName]) roomSummaryMap[rName] = 0;
    roomSummaryMap[rName]++;
  });

  // Öğrencinin hangi salonda olduğunu bulmak için harita
  const studentRoomMap = {};
  distributions.forEach(item => {
    const rName = rooms.find(r => r.id === item.room_id)?.name || item.room_id;
    studentRoomMap[String(item.student_id)] = `${rName} (Sıra: ${item.seat_number})`;
  });

  // Aktif sınav öğrencilerinin ID kümesi
  const currentExamStudentIds = new Set(students.map(s => String(s.id)));

  // Sadece bu sınavdaki öğrencileri içeren çakışma listesi
  const activeConflictStudentsMap = {};
  conflictGroups.forEach(cg => {
    const cgStudents = (cg.student_ids || []).map(String).filter(id => currentExamStudentIds.has(id));
    if (cgStudents.length > 0) {
      cgStudents.forEach(stId => {
        if (!activeConflictStudentsMap[stId]) {
          activeConflictStudentsMap[stId] = {
            groupName: cg.group_name || cg.name || 'Çakışma Grubu',
            peers: []
          };
        }
        cgStudents.forEach(otherId => {
          if (stId !== otherId) {
            const otherSt = students.find(s => String(s.id) === otherId);
            if (otherSt && !activeConflictStudentsMap[stId].peers.includes(`${otherSt.first_name || ''} ${otherSt.last_name || ''} (${otherSt.grade}-${otherSt.class})`)) {
              activeConflictStudentsMap[stId].peers.push(`${otherSt.first_name || ''} ${otherSt.last_name || ''} (${otherSt.grade}-${otherSt.class})`);
            }
          }
        });
      });
    }
  });

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🪑 Sınav Oturma Düzeni Paneli</h2>

      {/* MOD SEÇİMİ */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setExamMode('lise_akademik')}
          style={{
            flex: '1 1 200px',
            padding: '1rem',
            borderRadius: '8px',
            border: '2px solid #007bff',
            background: examMode === 'lise_akademik' ? '#007bff' : '#fff',
            color: examMode === 'lise_akademik' ? '#fff' : '#007bff',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          📘 1. Lise Akademik Deneme
        </button>

        <button
          onClick={() => setExamMode('lise_yabanci_dil')}
          style={{
            flex: '1 1 200px',
            padding: '1rem',
            borderRadius: '8px',
            border: '2px solid #28a745',
            background: examMode === 'lise_yabanci_dil' ? '#28a745' : '#fff',
            color: examMode === 'lise_yabanci_dil' ? '#fff' : '#28a745',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🌍 2. Lise Yabancı Dil Deneme
        </button>

        <button
          onClick={() => setExamMode('ortaokul_akademik')}
          style={{
            flex: '1 1 200px',
            padding: '1rem',
            borderRadius: '8px',
            border: '2px solid #fd7e14',
            background: examMode === 'ortaokul_akademik' ? '#fd7e14' : '#fff',
            color: examMode === 'ortaokul_akademik' ? '#fff' : '#fd7e14',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          📙 3. Ortaokul Akademik Deneme
        </button>

        <button
          onClick={() => setExamMode('ortaokul_yabanci_dil')}
          style={{
            flex: '1 1 200px',
            padding: '1rem',
            borderRadius: '8px',
            border: '2px solid #6f42c1',
            background: examMode === 'ortaokul_yabanci_dil' ? '#6f42c1' : '#fff',
            color: examMode === 'ortaokul_yabanci_dil' ? '#fff' : '#6f42c1',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🗣️ 4. Ortaokul Yabancı Dil
        </button>
      </div>

      {/* Sınav Seçimi */}
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

      {/* YABANCI DİL / ORTAOKUL EK SEÇENEKLERİ */}
      {selectedExamId && examMode === 'lise_yabanci_dil' && (
        <div style={{ background: '#eef6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #b6d4fe', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#055160' }}>📊 Excel Tipi Sıralama Düzeni</h4>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <label style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              <input
                type="radio"
                name="langFilter"
                value="second_lang"
                checked={langPrimaryFilter === 'second_lang'}
                onChange={() => setLangPrimaryFilter('second_lang')}
              /> 1. 2. Yabancı Dil ➔ 2. Seviye
            </label>
            <label style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              <input
                type="radio"
                name="langFilter"
                value="english_level"
                checked={langPrimaryFilter === 'english_level'}
                onChange={() => setLangPrimaryFilter('english_level')}
              /> 1. İngilizce Seviye ➔ 2. 2. Yabancı Dil
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
            Herkes Kendi Şubesinde Sınava Girsin (Sadece Sıra Karışsın)
          </label>
        </div>
      )}

      {/* ANA İÇERİK: SOL TARAF SALON ÖZETİ VE ÇAKIŞMA LİSTESİ, SAĞ TARAF GRUP YAPILANDIRMASI */}
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* SOL TARAF: SALON ÖZETLERİ VE ÇAKIŞMADAKİ ÖĞRENCİLER LİSTESİ */}
        {selectedExamId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Salon Özetleri Tablosu */}
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 0.8rem 0', borderBottom: '2px solid #007bff', paddingBottom: '0.4rem', color: '#007bff' }}>
                📊 Salon Özetleri
              </h4>
              {Object.keys(roomSummaryMap).length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.9rem', fontStyle: 'italic' }}>Henüz dağıtım yapılmadı.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Salon Adı</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Öğrenci</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(roomSummaryMap).map(([rName, count], idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{rName}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: '#007bff' }}>{count}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                      <td style={{ padding: '0.5rem' }}>Toplam</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{distributions.length}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* ÇAKIŞMA LİSTESİ VE SALON/SIRA BİLGİLERİ */}
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxHeight: '550px', overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 0.8rem 0', borderBottom: '2px solid #dc3545', paddingBottom: '0.4rem', color: '#dc3545', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaExclamationTriangle /> Çakışma Grubundaki Öğrenciler
              </h4>
              {Object.keys(activeConflictStudentsMap).length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.9rem', fontStyle: 'italic' }}>Bu sınav seviyesinde tanımlı aktif çakışma grubu bulunmuyor.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #ddd', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem' }}>Öğrenci</th>
                      <th style={{ padding: '0.4rem' }}>Çakıştığı Kişiler</th>
                      <th style={{ padding: '0.4rem' }}>Salon & Sıra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(activeConflictStudentsMap).map(([stId, info], idx) => {
                      const st = students.find(s => String(s.id) === stId);
                      if (!st) return null;
                      const stName = `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim();
                      const assignedRoom = studentRoomMap[stId] || 'Yerleşmedi';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>
                            {stName} <br/>
                            <span style={{ fontSize: '0.75rem', color: '#666' }}>({st.grade}-{st.class})</span>
                          </td>
                          <td style={{ padding: '0.4rem', fontSize: '0.8rem' }}>
                            <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{info.groupName}</span><br/>
                            <span style={{ color: '#555' }}>{info.peers.join(', ')}</span>
                          </td>
                          <td style={{ padding: '0.4rem', fontWeight: 'bold', color: studentRoomMap[stId] ? '#007bff' : '#dc3545' }}>
                            {assignedRoom}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        )}

        {/* SAĞ TARAF: GRUP VE SALON YAPILANDIRMASI */}
        {selectedExamId && (
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Grup & Salon Yapılandırması</h4>
              <button onClick={addGroup} style={{ padding: '0.4rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                <FaPlus /> Grup Ekle
              </button>
            </div>

            {groups.map(group => (
              <div key={group.id} style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
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
                          background: group.classes.includes(cls) ? '#007bff' : '#fff',
                          color: group.classes.includes(cls) ? '#fff' : '#333',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <small style={{ fontWeight: 'bold' }}>Salonlar (Max 24):</small>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                    {rooms.map(room => {
                      const totalCap = Math.min(24, Number(room.capacity || 24) + Number(room.extra_seats_added || room.extraSeatsAdded || 0));
                      return (
                        <button
                          key={room.id}
                          onClick={() => toggleRoomForGroup(group.id, room.id)}
                          style={{
                            padding: '0.2rem 0.6rem',
                            background: group.roomIds.includes(room.id) ? '#17a2b8' : '#fff',
                            color: group.roomIds.includes(room.id) ? '#fff' : '#333',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer'
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

      </div>

      {selectedExamId && (
        <div style={{ marginTop: '1.5rem' }}>
          <button
            onClick={runDistribution}
            disabled={loading}
            style={{ padding: '0.8rem 2rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
          >
            <FaSync /> {loading ? 'Dağıtılıyor...' : 'Dağıtımı Başlat'}
          </button>
        </div>
      )}

      {message && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          borderRadius: '6px',
          background: message.includes('Hata') || message.includes('Yetersiz') ? '#f8d7da' : '#d4edda',
          color: message.includes('Hata') || message.includes('Yetersiz') ? '#721c24' : '#155724',
          border: `1px solid ${message.includes('Hata') || message.includes('Yetersiz') ? '#f5c6cb' : '#c3e6cb'}`,
          whiteSpace: 'pre-line',
          fontWeight: 'bold'
        }}>
          {message}
        </div>
      )}

      {/* DETAYLI DAĞITIM TABLOSU */}
      {distributions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Dağıtım Listesi ({distributions.length} Öğrenci)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', marginTop: '1rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '0.8rem' }}>Salon</th>
                <th style={{ padding: '0.8rem' }}>Sıra No</th>
                <th style={{ padding: '0.8rem' }}>Öğrenci Adı Soyadı</th>
                <th style={{ padding: '0.8rem' }}>Şube</th>
                {examMode.includes('yabanci_dil') && <th style={{ padding: '0.8rem' }}>2. Yabancı Dil</th>}
                {examMode === 'lise_yabanci_dil' && <th style={{ padding: '0.8rem' }}>İngilizce Seviyesi</th>}
              </tr>
            </thead>
            <tbody>
              {distributions.map((item, idx) => {
                const roomName = rooms.find(r => r.id === item.room_id)?.name || item.room_id;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.8rem', fontWeight: 'bold' }}>{roomName}</td>
                    <td style={{ padding: '0.8rem' }}>{item.seat_number}</td>
                    <td style={{ padding: '0.8rem' }}>{item.student_name}</td>
                    <td style={{ padding: '0.8rem' }}>{item.grade}-{item.class}</td>
                    {examMode.includes('yabanci_dil') && (
                      <td style={{ padding: '0.8rem', color: '#6f42c1', fontWeight: 'bold' }}>{item.second_language || '-'}</td>
                    )}
                    {examMode === 'lise_yabanci_dil' && (
                      <td style={{ padding: '0.8rem', color: '#007bff', fontWeight: 'bold' }}>{item.english_level ? item.english_level.toUpperCase() : '-'}</td>
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
