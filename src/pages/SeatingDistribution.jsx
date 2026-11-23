import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaSync, FaPlus, FaTrash, FaCheckSquare, FaSquare, FaExclamationTriangle, FaSort, FaSortUp, FaSortDown, FaArrowUp, FaArrowDown } from 'react-icons/fa';

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

  const [examMode, setExamMode] = useState('lise_akademik');
  const [keepInOwnClassroom, setKeepInOwnClassroom] = useState(false);

  // Lise Yabancı Dil Manuel Sıralama & 24'lük Salon Atama Ayarları
  const [langSortOrder, setLangSortOrder] = useState('eng_then_lang');
  const [filterEnglishLevel, setFilterEnglishLevel] = useState('ALL');
  const [filterSecondLang, setFilterSecondLang] = useState('ALL');
  const [splitByComboBeforeChunk, setSplitByComboBeforeChunk] = useState(true);
  const [orderedRoomIds, setOrderedRoomIds] = useState([]);

  // Dağıtım Listesi Tablo Filtre & Sıralama State'leri
  const [tableSort, setTableSort] = useState({ key: null, direction: 'asc' });
  const [listBranchFilter, setListBranchFilter] = useState('ALL');
  const [listSecondLangFilter, setListSecondLangFilter] = useState('ALL');
  const [listEnglishFilter, setListEnglishFilter] = useState('ALL');

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

  useEffect(() => {
    if (!selectedExamId) {
      setStudents([]);
      setAllClasses([]);
      setGroups([]);
      setDistributions([]);
      setOrderedRoomIds([]);
      setListBranchFilter('ALL');
      setListSecondLangFilter('ALL');
      setListEnglishFilter('ALL');
      setTableSort({ key: null, direction: 'asc' });
      return;
    }

    const exam = exams.find(e => e.id === selectedExamId);

    const fetchExamDataAndPlan = async () => {
      if (!exam) return;
      const gradeLevels = exam.grade_levels || exam.gradeLevels || [];
      if (gradeLevels.length === 0) return;

      try {
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
          setOrderedRoomIds(usedRoomIds);

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
          setOrderedRoomIds([]);
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

  // Seçili salonları sıralama listesiyle senkron tut
  useEffect(() => {
    const selectedIds = Array.from(new Set(groups.flatMap(g => g.roomIds || [])));
    setOrderedRoomIds(prev => {
      const kept = prev.filter(id => selectedIds.includes(id));
      const added = selectedIds.filter(id => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [groups]);

  const moveRoomOrder = (index, delta) => {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= orderedRoomIds.length) return;
    const copy = [...orderedRoomIds];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setOrderedRoomIds(copy);
  };

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
    const raw = st.second_lang || st.second_language || st.ikinci_yabanci_dil || st.ikinci_dil || st.yabanci_dil || st.foreign_language || '';
    const trimmed = String(raw).trim();
    if (!trimmed || trimmed === '-' || trimmed.toUpperCase() === 'YOK') return 'Belirtilmedi';
    return trimmed;
  };

  const getStudentEnglishLevel = (st) => {
    const raw = st.english_level || st.ingilizce_seviye || st.ing_seviye || '';
    const trimmed = String(raw).trim();
    if (!trimmed || trimmed === '-') return 'Belirtilmedi';
    return trimmed;
  };

  const getStudentFullName = (st) => {
    return `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim();
  };

  const compareBySelectedOrder = (a, b) => {
    const engA = getStudentEnglishLevel(a);
    const engB = getStudentEnglishLevel(b);
    const langA = getStudentLanguage(a);
    const langB = getStudentLanguage(b);
    const nameA = getStudentFullName(a);
    const nameB = getStudentFullName(b);
    const clsA = `${a.grade || ''}-${a.class || ''}`;
    const clsB = `${b.grade || ''}-${b.class || ''}`;

    if (langSortOrder === 'eng_then_lang') {
      const c1 = engA.localeCompare(engB, 'tr', { sensitivity: 'base' });
      if (c1 !== 0) return c1;
      const c2 = langA.localeCompare(langB, 'tr', { sensitivity: 'base' });
      if (c2 !== 0) return c2;
      return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
    }

    if (langSortOrder === 'lang_then_eng') {
      const c1 = langA.localeCompare(langB, 'tr', { sensitivity: 'base' });
      if (c1 !== 0) return c1;
      const c2 = engA.localeCompare(engB, 'tr', { sensitivity: 'base' });
      if (c2 !== 0) return c2;
      return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
    }

    if (langSortOrder === 'only_lang') {
      const c1 = langA.localeCompare(langB, 'tr', { sensitivity: 'base' });
      if (c1 !== 0) return c1;
      return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
    }

    if (langSortOrder === 'only_eng') {
      const c1 = engA.localeCompare(engB, 'tr', { sensitivity: 'base' });
      if (c1 !== 0) return c1;
      return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
    }

    if (langSortOrder === 'branch_az') {
      const c1 = clsA.localeCompare(clsB, 'tr', { numeric: true, sensitivity: 'base' });
      if (c1 !== 0) return c1;
      return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
    }

    return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
  };

  const runDistribution = async () => {
    if (!selectedExamId) return setMessage('Hata: Lütfen bir sınav seçin.');
    if (groups.length === 0) return setMessage('Hata: Dağıtım için en az bir grup oluşturmalısınız.');

    setLoading(true);
    setMessage('Dağıtım hesaplanıyor...');

    try {
      const assignments = [];
      const currentExamStudentIds = new Set(students.map(s => String(s.id).trim()));

      const conflictPairsMap = {};
      conflictGroups.forEach(cg => {
        const cgStudents = (cg.student_ids || []).map(id => String(id).trim()).filter(id => currentExamStudentIds.has(id));
        cgStudents.forEach(id1 => {
          if (!conflictPairsMap[id1]) conflictPairsMap[id1] = new Set();
          cgStudents.forEach(id2 => {
            if (id1 !== id2) conflictPairsMap[id1].add(id2);
          });
        });
      });

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
                student_id: String(st.id).trim(),
                room_id: targetRoom.id,
                seat_number: seatIdx + 1,
                student_name: `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim(),
                class: st.class,
                grade: st.grade,
              });
            });
          });
        }
      } else if (examMode === 'lise_akademik' || examMode === 'ortaokul_akademik') {
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
            const stIdStr = String(st.id).trim();

            for (const room of groupRooms) {
              if (room.seats.length >= room.targetQuota) continue;

              const hasConflict = room.seats.some(existingSt => {
                const existingIdStr = String(existingSt.id).trim();
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
                  return !r.seats.some(existingSt => {
                    const existingIdStr = String(existingSt.id).trim();
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
                student_id: String(st.id).trim(),
                room_id: room.id,
                seat_number: idx + 1,
                student_name: `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim(),
                class: st.class,
                grade: st.grade,
              });
            });
          });
        }
      } else if (examMode === 'lise_yabanci_dil') {
        // KULLANICI SIRALAMASINA GÖRE 24'ER KİŞİLİK (MAX 24) MANUEL SALON YERLEŞTİRME
        const roomOrderIndexMap = new Map(orderedRoomIds.map((id, idx) => [String(id), idx]));

        for (const group of groups) {
          let groupStudents = students.filter(s => group.classes.includes(`${s.grade}-${s.class}`));

          if (filterEnglishLevel !== 'ALL') {
            groupStudents = groupStudents.filter(
              s => getStudentEnglishLevel(s).toLocaleUpperCase('tr-TR') === filterEnglishLevel.toLocaleUpperCase('tr-TR')
            );
          }

          if (filterSecondLang !== 'ALL') {
            groupStudents = groupStudents.filter(
              s => getStudentLanguage(s).toLocaleUpperCase('tr-TR') === filterSecondLang.toLocaleUpperCase('tr-TR')
            );
          }

          if (groupStudents.length === 0) {
            throw new Error(`Hata: "${group.name}" grubunda seçilen şube ve dil filtrelerine uygun öğrenci bulunamadı!`);
          }

          const groupRooms = rooms
            .filter(r => group.roomIds.includes(r.id))
            .sort((a, b) => {
              const idxA = roomOrderIndexMap.has(String(a.id)) ? roomOrderIndexMap.get(String(a.id)) : 9999;
              const idxB = roomOrderIndexMap.has(String(b.id)) ? roomOrderIndexMap.get(String(b.id)) : 9999;
              return idxA - idxB;
            })
            .map(r => ({
              ...r,
              totalCap: Math.min(24, Number(r.capacity || 24) + Number(r.extra_seats_added || r.extraSeatsAdded || 0)),
              seats: []
            }));

          if (groupRooms.length === 0) throw new Error(`Hata: "${group.name}" için salon seçilmedi.`);

          const totalCapacity = groupRooms.reduce((sum, r) => sum + r.totalCap, 0);
          if (totalCapacity < groupStudents.length) {
            throw new Error(`Kapasite Yetersiz! "${group.name}" grubunda ${groupStudents.length} öğrenci var ancak seçili salonların toplam kapasitesi ${totalCapacity} (Max 24/salon).`);
          }

          const sortedStudents = [...groupStudents].sort(compareBySelectedOrder);

          // 24'er kişilik bloklar oluştur: istenirse her dil/seviye grubunu kendi içinde 24'er böler
          const chunks24 = [];
          if (splitByComboBeforeChunk) {
            const subGroups = [];
            const subMap = new Map();

            sortedStudents.forEach(st => {
              const eng = getStudentEnglishLevel(st);
              const lang = getStudentLanguage(st);
              const key = langSortOrder === 'only_lang'
                ? lang
                : langSortOrder === 'only_eng'
                  ? eng
                  : `${eng}|||${lang}`;

              if (!subMap.has(key)) {
                const arr = [];
                subMap.set(key, arr);
                subGroups.push(arr);
              }
              subMap.get(key).push(st);
            });

            subGroups.forEach(subArr => {
              for (let i = 0; i < subArr.length; i += 24) {
                chunks24.push(subArr.slice(i, i + 24));
              }
            });
          } else {
            for (let i = 0; i < sortedStudents.length; i += 24) {
              chunks24.push(sortedStudents.slice(i, i + 24));
            }
          }

          let roomCursor = 0;
          const overflowStudents = [];

          for (const chunk of chunks24) {
            while (roomCursor < groupRooms.length && groupRooms[roomCursor].seats.length >= groupRooms[roomCursor].totalCap) {
              roomCursor++;
            }

            if (roomCursor >= groupRooms.length) {
              overflowStudents.push(...chunk);
              continue;
            }

            const targetRoom = groupRooms[roomCursor];
            for (const st of chunk) {
              if (targetRoom.seats.length < targetRoom.totalCap) {
                targetRoom.seats.push(st);
              } else {
                overflowStudents.push(st);
              }
            }

            if (targetRoom.seats.length >= targetRoom.totalCap) {
              roomCursor++;
            }
          }

          for (const st of overflowStudents) {
            const openRoom = groupRooms.find(r => r.seats.length < r.totalCap);
            if (!openRoom) {
              throw new Error(`Kapasite Yetersiz! "${group.name}" için boş yer kalmadı (Salon başına max 24).`);
            }
            openRoom.seats.push(st);
          }

          groupRooms.forEach(room => {
            room.seats.forEach((st, idx) => {
              assignments.push({
                student_id: String(st.id).trim(),
                room_id: room.id,
                seat_number: idx + 1,
                student_name: `${st.first_name || st.firstName || ''} ${st.last_name || st.lastName || ''}`.trim(),
                class: st.class,
                grade: st.grade,
                second_language: getStudentLanguage(st),
                english_level: getStudentEnglishLevel(st),
              });
            });
          });
        }
      } else if (examMode === 'ortaokul_yabanci_dil') {
        for (const group of groups) {
          const groupStudents = students.filter(s => group.classes.includes(`${s.grade}-${s.class}`));
          if (groupStudents.length === 0) throw new Error(`Hata: "${group.name}" grubundaki seçili şubelerde hiç öğrenci bulunamadı!`);

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
                throw new Error(`Kapasite/Salon Yetersiz! "${lang}" dili öğrencileri için boş salon kalmadı.`);
              }

              groupRooms[roomIndex].seats.push(st);
            }
          }

          groupRooms.forEach(room => {
            room.seats.forEach((st, idx) => {
              assignments.push({
                student_id: String(st.id).trim(),
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

      if (assignments.length === 0) throw new Error('Dağıtılabilecek hiçbir öğrenci bulunamadı!');

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

  const handleTableSort = (key) => {
    setTableSort(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSortIcon = (key) => {
    if (tableSort.key !== key) return <FaSort style={{ opacity: 0.45, marginLeft: '4px' }} />;
    return tableSort.direction === 'asc'
      ? <FaSortUp style={{ color: '#007bff', marginLeft: '4px' }} />
      : <FaSortDown style={{ color: '#007bff', marginLeft: '4px' }} />;
  };

  const availableEnglishLevels = Array.from(
    new Set(students.map(s => getStudentEnglishLevel(s)).filter(v => v !== 'Belirtilmedi'))
  ).sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' }));

  const availableSecondLangs = Array.from(
    new Set(students.map(s => getStudentLanguage(s)).filter(v => v !== 'Belirtilmedi'))
  ).sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' }));

  const enrichedDistributions = distributions.map(item => {
    const dbSt = students.find(s => String(s.id).trim() === String(item.student_id || '').trim()) || {};
    const roomName = rooms.find(r => r.id === item.room_id)?.name || item.room_id;
    const branchLabel = `${item.grade ?? dbSt.grade ?? ''}-${item.class ?? dbSt.class ?? ''}`;
    const secondLangVal = item.second_language || getStudentLanguage(dbSt);
    const englishValRaw = item.english_level || getStudentEnglishLevel(dbSt);
    const englishVal = englishValRaw && englishValRaw !== 'Belirtilmedi' ? englishValRaw.toUpperCase() : '-';

    return {
      ...item,
      roomName,
      branchLabel,
      secondLangVal,
      englishVal
    };
  });

  const branchOptions = Array.from(new Set(enrichedDistributions.map(d => d.branchLabel).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'tr', { numeric: true, sensitivity: 'base' })
  );

  const listSecondLangOptions = Array.from(new Set(enrichedDistributions.map(d => d.secondLangVal).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'tr', { sensitivity: 'base' })
  );

  const listEnglishOptions = Array.from(new Set(enrichedDistributions.map(d => d.englishVal).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'tr', { sensitivity: 'base' })
  );

  const filteredAndSortedDistributions = [...enrichedDistributions]
    .filter(row => {
      if (listBranchFilter !== 'ALL' && row.branchLabel !== listBranchFilter) return false;
      if (listSecondLangFilter !== 'ALL' && row.secondLangVal !== listSecondLangFilter) return false;
      if (listEnglishFilter !== 'ALL' && row.englishVal !== listEnglishFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (!tableSort.key) return 0;
      const mult = tableSort.direction === 'asc' ? 1 : -1;

      if (tableSort.key === 'seat_number') {
        const numA = Number(a.seat_number) || 0;
        const numB = Number(b.seat_number) || 0;
        return (numA - numB) * mult;
      }

      const mapVal = (row) => {
        switch (tableSort.key) {
          case 'roomName': return String(row.roomName || '');
          case 'student_name': return String(row.student_name || '');
          case 'branchLabel': return String(row.branchLabel || '');
          case 'secondLangVal': return String(row.secondLangVal || '');
          case 'englishVal': return String(row.englishVal || '');
          default: return '';
        }
      };

      return mapVal(a).localeCompare(mapVal(b), 'tr', { sensitivity: 'base', numeric: true }) * mult;
    });

  const roomSummaryMap = {};
  const roomLangBreakdownMap = {};
  distributions.forEach(item => {
    const rName = rooms.find(r => r.id === item.room_id)?.name || item.room_id;
    if (!roomSummaryMap[rName]) roomSummaryMap[rName] = 0;
    roomSummaryMap[rName]++;

    if (examMode === 'lise_yabanci_dil') {
      if (!roomLangBreakdownMap[rName]) roomLangBreakdownMap[rName] = new Set();
      const eng = item.english_level || '-';
      const lang = item.second_language || '-';
      roomLangBreakdownMap[rName].add(`${eng} / ${lang}`);
    }
  });

  const studentRoomMap = {};
  distributions.forEach(item => {
    const rName = rooms.find(r => r.id === item.room_id)?.name || item.room_id;
    const stIdClean = String(item.student_id || '').trim();
    studentRoomMap[stIdClean] = `${rName} (Sıra: ${item.seat_number})`;
  });

  const currentExamStudentIds = new Set(students.map(s => String(s.id).trim()));

  const activeConflictStudentsMap = {};
  conflictGroups.forEach(cg => {
    const cgStudents = (cg.student_ids || []).map(id => String(id).trim()).filter(id => currentExamStudentIds.has(id));
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
            const otherSt = students.find(s => String(s.id).trim() === otherId);
            if (otherSt && !activeConflictStudentsMap[stId].peers.includes(`${otherSt.first_name || ''} ${otherSt.last_name || ''} (${otherSt.grade}-${otherSt.class})`)) {
              activeConflictStudentsMap[stId].peers.push(`${otherSt.first_name || ''} ${otherSt.last_name || ''} (${otherSt.grade}-${otherSt.class})`);
            }
          }
        });
      });
    }
  });

  const thSortStyle = {
    padding: '0.8rem',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap'
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🪑 Sınav Oturma Düzeni Paneli</h2>

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
        <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '8px', border: '1px solid #a7f3d0', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.4rem 0', color: '#065f46' }}>
            ✂️ Lise Yabancı Dil Manuel Sıralama & 24'lük Salon Atama (Max 24 Kişi)
          </h4>
          <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: '#047857' }}>
            Öğrencileri istediğin düzende sırala; sistem 24'er kişilik (max 24) parçalara bölüp seçtiğin salonlara sırayla yerleştirsin.
          </p>

          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.8rem' }}>
            <div>
              <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem', color: '#065f46' }}>
                Sıralama Kriteri:
              </label>
              <select
                value={langSortOrder}
                onChange={(e) => setLangSortOrder(e.target.value)}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '4px', border: '1px solid #6ee7b7', fontWeight: 'bold', background: '#fff' }}
              >
                <option value="eng_then_lang">1. İngilizce (A-Z) ➔ 2. 2. Yabancı Dil (A-Z)</option>
                <option value="lang_then_eng">1. 2. Yabancı Dil (A-Z) ➔ 2. İngilizce (A-Z)</option>
                <option value="only_eng">Sadece İngilizce (A-Z)</option>
                <option value="only_lang">Sadece 2. Yabancı Dil (A-Z)</option>
                <option value="branch_az">Şube (A-Z) ➔ Ad Soyad (A-Z)</option>
                <option value="name_az">Ad Soyad (A-Z)</option>
              </select>
            </div>

            <div>
              <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem', color: '#065f46' }}>
                İngilizce Filtresi:
              </label>
              <select
                value={filterEnglishLevel}
                onChange={(e) => setFilterEnglishLevel(e.target.value)}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '4px', border: '1px solid #6ee7b7', fontWeight: 'bold', background: '#fff' }}
              >
                <option value="ALL">Tümü</option>
                {availableEnglishLevels.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem', color: '#065f46' }}>
                2. Yabancı Dil Filtresi:
              </label>
              <select
                value={filterSecondLang}
                onChange={(e) => setFilterSecondLang(e.target.value)}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '4px', border: '1px solid #6ee7b7', fontWeight: 'bold', background: '#fff' }}
              >
                <option value="ALL">Tümü</option>
                {availableSecondLangs.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>

          <label
            onClick={() => setSplitByComboBeforeChunk(!splitByComboBeforeChunk)}
            style={{ cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontSize: '0.88rem' }}
          >
            {splitByComboBeforeChunk ? <FaCheckSquare size={18} color="#059669" /> : <FaSquare size={18} color="#9ca3af" />}
            Her dil/seviye grubunu kendi içinde 24'er böl (Kapatılırsa sıralı liste doğrudan 24-24 kesilir)
          </label>

          {orderedRoomIds.length > 0 && (
            <div style={{ marginTop: '0.9rem', paddingTop: '0.7rem', borderTop: '1px dashed #6ee7b7' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#065f46', marginBottom: '0.4rem' }}>
                Salon Atama Sırası (24'lük bloklar bu sırayla salonlara atanır):
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {orderedRoomIds.map((rId, idx) => {
                  const rObj = rooms.find(r => r.id === rId);
                  if (!rObj) return null;
                  return (
                    <div key={rId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#fff', border: '1px solid #6ee7b7', borderRadius: '4px', padding: '0.2rem 0.45rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      <span>{idx + 1}. {rObj.name}</span>
                      <button type="button" onClick={() => moveRoomOrder(idx, -1)} disabled={idx === 0} style={{ border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, padding: '0 2px' }}>
                        <FaArrowUp size={11} />
                      </button>
                      <button type="button" onClick={() => moveRoomOrder(idx, 1)} disabled={idx === orderedRoomIds.length - 1} style={{ border: 'none', background: 'none', cursor: idx === orderedRoomIds.length - 1 ? 'default' : 'pointer', opacity: idx === orderedRoomIds.length - 1 ? 0.3 : 1, padding: '0 2px' }}>
                        <FaArrowDown size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {selectedExamId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

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
                      {examMode === 'lise_yabanci_dil' && <th style={{ padding: '0.5rem' }}>İng / 2. Dil</th>}
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Öğrenci</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(roomSummaryMap).map(([rName, count], idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{rName}</td>
                        {examMode === 'lise_yabanci_dil' && (
                          <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#047857', fontWeight: '600' }}>
                            {roomLangBreakdownMap[rName] ? Array.from(roomLangBreakdownMap[rName]).join(', ') : '-'}
                          </td>
                        )}
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: '#007bff' }}>{count}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                      <td style={{ padding: '0.5rem' }}>Toplam</td>
                      {examMode === 'lise_yabanci_dil' && <td></td>}
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{distributions.length}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

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
                      const st = students.find(s => String(s.id).trim() === stId);
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

      {distributions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.8rem' }}>
            <h3 style={{ margin: 0 }}>
              Dağıtım Listesi ({filteredAndSortedDistributions.length} / {distributions.length} Öğrenci)
            </h3>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '0.6rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '0.35rem', color: '#334155' }}>Şube:</label>
                <select
                  value={listBranchFilter}
                  onChange={(e) => setListBranchFilter(e.target.value)}
                  style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '600' }}
                >
                  <option value="ALL">Tüm Şubeler</option>
                  {branchOptions.map(br => (
                    <option key={br} value={br}>{br}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '0.35rem', color: '#6f42c1' }}>2. Yabancı Dil:</label>
                <select
                  value={listSecondLangFilter}
                  onChange={(e) => setListSecondLangFilter(e.target.value)}
                  style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '600' }}
                >
                  <option value="ALL">Tümü</option>
                  {listSecondLangOptions.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '0.35rem', color: '#007bff' }}>İngilizce:</label>
                <select
                  value={listEnglishFilter}
                  onChange={(e) => setListEnglishFilter(e.target.value)}
                  style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '600' }}
                >
                  <option value="ALL">Tümü</option>
                  {listEnglishOptions.map(eng => (
                    <option key={eng} value={eng}>{eng}</option>
                  ))}
                </select>
              </div>

              {(listBranchFilter !== 'ALL' || listSecondLangFilter !== 'ALL' || listEnglishFilter !== 'ALL' || tableSort.key) && (
                <button
                  onClick={() => {
                    setListBranchFilter('ALL');
                    setListSecondLangFilter('ALL');
                    setListEnglishFilter('ALL');
                    setTableSort({ key: null, direction: 'asc' });
                  }}
                  style={{ padding: '0.35rem 0.7rem', background: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                  Filtre & Sıralamayı Sıfırla
                </button>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', marginTop: '0.5rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th onClick={() => handleTableSort('roomName')} style={thSortStyle} title="A-Z / Z-A Sırala">
                  Salon {renderSortIcon('roomName')}
                </th>
                <th onClick={() => handleTableSort('seat_number')} style={thSortStyle} title="Artan / Azalan Sırala">
                  Sıra No {renderSortIcon('seat_number')}
                </th>
                <th onClick={() => handleTableSort('student_name')} style={thSortStyle} title="A-Z / Z-A Sırala">
                  Öğrenci Adı Soyadı {renderSortIcon('student_name')}
                </th>
                <th onClick={() => handleTableSort('branchLabel')} style={thSortStyle} title="Şubeye Göre A-Z / Z-A Sırala">
                  Şube {renderSortIcon('branchLabel')}
                </th>
                <th onClick={() => handleTableSort('secondLangVal')} style={thSortStyle} title="2. Yabancı Dile Göre A-Z / Z-A Sırala">
                  2. Yabancı Dil {renderSortIcon('secondLangVal')}
                </th>
                <th onClick={() => handleTableSort('englishVal')} style={thSortStyle} title="İngilizce Seviyesine Göre A-Z / Z-A Sırala">
                  İngilizce Seviyesi {renderSortIcon('englishVal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedDistributions.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.8rem', fontWeight: 'bold' }}>{item.roomName}</td>
                  <td style={{ padding: '0.8rem' }}>{item.seat_number}</td>
                  <td style={{ padding: '0.8rem' }}>{item.student_name}</td>
                  <td style={{ padding: '0.8rem', fontWeight: '600' }}>{item.branchLabel}</td>
                  <td style={{ padding: '0.8rem', color: '#6f42c1', fontWeight: 'bold' }}>{item.secondLangVal}</td>
                  <td style={{ padding: '0.8rem', color: '#007bff', fontWeight: 'bold' }}>{item.englishVal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SeatingDistribution;
