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
  const [langStats, setLangStats] = useState({});

  // Sınav ve salonları çek
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: examData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
        setExams(examData || []);

        const { data: roomData } = await supabase.from('rooms').select('*').order('name', { ascending: true });
        setRooms(roomData || []);
      } catch (error) {
        console.error('Veri hatası:', error);
      }
    };
    fetchData();
  }, []);

  // Sınav seçilince öğrenci ve dil istatistiklerini hesapla
  useEffect(() => {
    if (!selectedExam) {
      setStudents([]);
      setAllClasses([]);
      setGroups([]);
      setDistributions([]);
      setLangStats({});
      return;
    }

    const fetchStudents = async () => {
      const exam = exams.find(e => e.id === selectedExam);
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

        // 1. Şube Listesi
        const classSet = new Set((data || []).map(s => `${s.grade}-${s.class}`));
        setAllClasses(Array.from(classSet).sort());

        // 2. Dil/Seviye İstatistikleri Hesabı (Almanca, Fransızca, Core, Ext vs.)
        const stats = { secondLang: {}, englishLevel: {} };
        (data || []).forEach(s => {
          const sec = s.second_lang || s.second_language || 'Belirtilmedi';
          const eng = s.english_level ? s.english_level.toUpperCase() : 'Belirtilmedi';

          stats.secondLang[sec] = (stats.secondLang[sec] || 0) + 1;
          stats.englishLevel[eng] = (stats.englishLevel[eng] || 0) + 1;
        });
        setLangStats(stats);

        setGroups([]);
        setDistributions([]);
        setMessage(`${data?.length || 0} öğrenci getirildi.`);
      } catch (err) {
        console.error('Öğrenci çekme hatası:', err);
      }
    };

    fetchStudents();
  }, [selectedExam, exams]);

  const addGroup = () => {
    setGroups([
      ...groups,
      { id: Date.now(), name: `Grup ${groups.length + 1}`, classes: [], roomIds: [] }
    ]);
  };

  const removeGroup = (groupId) => {
    if (groups.length <= 1) return setMessage('En az 1 grup olmalı.');
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

  // Diziyi rastgele karıştırma (Şube dağıtımı için)
  const shuffleArray = (arr) => {
    const list = [...arr];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  // HOMOJEN SALON DAĞITIM ALGORİTMASI
// 2. YABANCI DİL VE İNGİLİZCE SEVİYE ODAKLI DAĞITIM ALGORİTMASI
const runDistribution = async () => {
  if (!selectedExam || groups.length === 0) return;

  setLoading(true);
  setMessage('Dil homojenliği öncelikli karma yapılıyor...');

  try {
    const exam = exams.find(e => e.id === selectedExam);
    const isSecondLangExam = exam?.category === '2_yabanci_dil' || exam?.type === 'second_language';

    const assignments = [];

    for (const group of groups) {
      // 1. Seçili şubelerdeki tüm öğrencileri al
      const groupStudents = students.filter(s => group.classes.includes(`${s.grade}-${s.class}`));
      if (groupStudents.length === 0) continue;

      // 2. Gruba ait salonları kapasitelerine göre büyükten küçüğe sırala
      const groupRooms = rooms
        .filter(r => group.roomIds.includes(r.id))
        .map(r => ({
          ...r,
          totalCap: Number(r.capacity || 0) + Number(r.extra_seats_added || r.extraSeatsAdded || 0),
          seats: []
        }))
        .sort((a, b) => b.totalCap - a.totalCap);

      if (groupRooms.length === 0) throw new Error(`"${group.name}" için salon seçilmedi.`);

      // 3. Öğrencileri SADECE DİL / SEVİYE'ye göre grupla (Şube ayrımı yapılmaz)
      const langClusters = {};
      groupStudents.forEach(st => {
        let langKey = 'Diğer';
        if (isSecondLangExam) {
          langKey = st.second_lang || st.second_language || 'Belirtilmedi';
        } else {
          langKey = st.english_level ? st.english_level.toUpperCase() : 'Belirtilmedi';
        }

        if (!langClusters[langKey]) langClusters[langKey] = [];
        langClusters[langKey].push(st);
      });

      // Öğrenci sayısı en çok olan dil grubundan başla (Örn: 1. Almanca, 2. İspanyolca...)
      const sortedLangs = Object.keys(langClusters).sort(
        (a, b) => langClusters[b].length - langClusters[a].length
      );

      let currentRoomIdx = 0;

      // 4. Salonları Blok Halinde Tek Dil Grubu İle Doldur
      for (const lang of sortedLangs) {
        // Dil grubu içindeki öğrencileri kendi arasında karıştır (Koltuk sırası rastgele olsun)
        let pool = shuffleArray(langClusters[lang]);

        while (pool.length > 0) {
          if (currentRoomIdx >= groupRooms.length) {
            throw new Error(`Kapasite yetersiz! "${group.name}" grubundaki öğrenciler salonlara sığmıyor.`);
          }

          const room = groupRooms[currentRoomIdx];
          const emptySeats = room.totalCap - room.seats.length;

          if (emptySeats > 0) {
            const studentsToSeat = pool.slice(0, emptySeats);
            pool = pool.slice(emptySeats);

            // Salon koltuklarına sırayla oturt (Şube kontrolü yapılmaz, tek dil olması yeterli)
            studentsToSeat.forEach(student => {
              room.seats.push(student);
            });
          }

          // Salon dolduysa bir sonraki salona geç
          if (room.seats.length >= room.totalCap) {
            currentRoomIdx++;
          }
        }
      }

      // 5. Atamaları Veritabanı Formatına Dönüştür
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

    // Supabase Kayıt
    await supabase.from('seating_plans').delete().eq('exam_id', selectedExam);
    const { error: insertError } = await supabase.from('seating_plans').insert({
      exam_id: selectedExam,
      created_at: new Date().toISOString(),
      assignments: assignments,
    });

    if (insertError) throw insertError;

    setDistributions(assignments);
    setMessage(`Dağıtım tamamlandı! Salonlar olabildiğince tek dil grubu olacak şekilde blok dolduruldu.`);
  } catch (err) {
    console.error(err);
    setMessage(`Hata: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🪑 Dil Odaklı Akıllı Karma Dağıtım</h2>

      {/* Sınav Seçimi */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Sınav Seçin</label>
        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          <option value="">-- Sınav Seçin --</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>
              {exam.title} ({exam.date})
            </option>
          ))}
        </select>
      </div>

      {/* DİL VE SEVİYE TOPLAM İSTATİSTİKLERİ PANELİ */}
      {selectedExam && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#eef6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #b6d4fe' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#055160' }}>🌍 2. Yabancı Dil Toplamları</h4>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {Object.entries(langStats.secondLang || {}).map(([lang, count]) => (
                <span key={lang} style={{ background: '#fff', padding: '0.3rem 0.7rem', borderRadius: '4px', fontWeight: 'bold' }}>
                  {lang}: {count} Kişi
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: '#f0fff4', padding: '1rem', borderRadius: '8px', border: '1px solid #b7eb8f' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#135200' }}>📚 İngilizce Seviye Toplamları</h4>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {Object.entries(langStats.englishLevel || {}).map(([lvl, count]) => (
                <span key={lvl} style={{ background: '#fff', padding: '0.3rem 0.7rem', borderRadius: '4px', fontWeight: 'bold' }}>
                  {lvl}: {count} Kişi
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grup Yapılandırma */}
      {selectedExam && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4>Grup & Salon Atamaları</h4>
            <button onClick={addGroup} style={{ padding: '0.4rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              <FaPlus /> Grup Ekle
            </button>
          </div>

          {groups.map(group => (
            <div key={group.id} style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>{group.name}</strong>
                <button onClick={() => removeGroup(group.id)} style={{ color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer' }}>
                  <FaTrash /> Grubu Sil
                </button>
              </div>

              {/* Şubeler */}
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
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* Salonlar */}
              <div>
                <small style={{ fontWeight: 'bold' }}>Salonlar:</small>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                  {rooms.map(room => {
                    const totalCap = Number(room.capacity || 0) + Number(room.extra_seats_added || room.extraSeatsAdded || 0);
                    return (
                      <button
                        key={room.id}
                        onClick={() => toggleRoomForGroup(group.id, room.id)}
                        style={{
                          padding: '0.2rem 0.6rem',
                          background: group.roomIds.includes(room.id) ? '#17a2b8' : '#f1f1f1',
                          color: group.roomIds.includes(room.id) ? '#fff' : '#333',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {room.name} ({totalCap} Kişilik)
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dağıtım Butonu */}
      {selectedExam && (
        <button
          onClick={runDistribution}
          disabled={loading}
          style={{ padding: '0.7rem 1.8rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
        >
          <FaSync /> {loading ? 'Hesaplanıyor...' : 'Homojen Karma Dağıtımı Çalıştır'}
        </button>
      )}

      {message && <p style={{ marginTop: '1rem', fontWeight: 'bold', color: message.includes('Hata') ? 'red' : 'green' }}>{message}</p>}

      {/* Dağıtım Sonuç Tablosu */}
      {distributions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Dağıtım Sonuçları ({distributions.length} Öğrenci)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', marginTop: '1rem' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem' }}>Salon</th>
                <th style={{ padding: '0.6rem' }}>Sıra No</th>
                <th style={{ padding: '0.6rem' }}>Öğrenci Adı</th>
                <th style={{ padding: '0.6rem' }}>Sınıf</th>
                <th style={{ padding: '0.6rem' }}>2. Yabancı Dil</th>
                <th style={{ padding: '0.6rem' }}>İngilizce Seviyesi</th>
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
                    <td style={{ padding: '0.6rem', color: '#28a745', fontWeight: 'bold' }}>{item.second_language || '-'}</td>
                    <td style={{ padding: '0.6rem', color: '#007bff', fontWeight: 'bold' }}>{item.english_level ? item.english_level.toUpperCase() : '-'}</td>
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