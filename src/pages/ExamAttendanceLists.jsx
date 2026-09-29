import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

const ExamAttendanceLists = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [seatingPlan, setSeatingPlan] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [studentMap, setStudentMap] = useState({});
  const [examGrades, setExamGrades] = useState({});
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('attendance');
  const [showRoomCode, setShowRoomCode] = useState(true);
  const [examCategory, setExamCategory] = useState('akademik_lise');
  
  const [invigilators, setInvigilators] = useState({});
  const [savedInvigilatorsList, setSavedInvigilatorsList] = useState([]);

  // Geçici TC'leri tutmak için state (Veritabanına asla kaydedilmez, sayfa yenilenince silinir)
  const [tempTcs, setTempTcs] = useState({});

  useEffect(() => {
    fetchExams();
    fetchRooms();
    fetchAllStudentsData();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchExamInvigilators(selectedExam.id);
      fetchSavedInvigilators();
    }
  }, [selectedExam]);

  const fetchExamInvigilators = async (examId) => {
    try {
      const { data, error } = await supabase
        .from('exam_invigilators')
        .select('*')
        .eq('exam_id', examId);

      if (!error && data) {
        const invMap = {};
        data.forEach(item => {
          invMap[item.room_name] = item.invigilator_name;
        });
        setInvigilators(invMap);
      }
    } catch (err) {
      console.error('Gözetmenler yüklenirken hata:', err);
    }
  };

  const fetchSavedInvigilators = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_invigilators')
        .select('invigilator_name');

      if (!error && data) {
        const uniqueNames = [...new Set(data.map(item => item.invigilator_name))].sort();
        setSavedInvigilatorsList(uniqueNames);
      }
    } catch (err) {
      console.warn('Gözetmen havuzu okunamadı:', err);
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*');
      if (!error && data) setRooms(data);
    } catch (err) {
      console.warn('Rooms okunamadı:', err);
    }
  };

  const fetchAllStudentsData = async () => {
    try {
      const { data, error } = await supabase.from('students').select('*');
      if (!error && data) {
        const map = {};
        data.forEach(st => {
          if (st.id) map[String(st.id)] = st;
          if (st.tc_no) map[String(st.tc_no).trim()] = st;
          if (st.student_no) map[String(st.student_no).trim()] = st;
        });
        setStudentMap(map);
        return map;
      }
    } catch (err) {
      console.error('Öğrenciler tablosundan veri çekilemedi:', err);
    }
    return {};
  };

  const fetchExams = async () => {
    setLoading(true);
    try {
      const currentStudentMap = await fetchAllStudentsData();

      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (examError) throw examError;
      setExams(examData || []);

      if (examData && examData.length > 0) {
        const examIds = examData.map(e => e.id);
        const { data: plansData } = await supabase
          .from('seating_plans')
          .select('exam_id, assignments')
          .in('exam_id', examIds);

        if (plansData) {
          const gradesMap = {};
          plansData.forEach(plan => {
            let assignmentsArr = [];
            if (typeof plan.assignments === 'string') {
              try { assignmentsArr = JSON.parse(plan.assignments); } catch (e) {}
            } else if (Array.isArray(plan.assignments)) {
              assignmentsArr = plan.assignments;
            }

            const grades = new Set();
            assignmentsArr.forEach(st => {
              const rawId = String(st.studentId || st.student_id || st.id || '').trim();
              const rawTc = String(st.tc || st.tc_no || st.tcNo || '').trim();
              const rawNo = String(st.no || st.student_no || st.studentNo || st.school_number || '').trim();
              const dbSt = currentStudentMap[rawId] || currentStudentMap[rawTc] || currentStudentMap[rawNo];
              
              if (!dbSt) return;

              const grade = dbSt.grade || st.grade || st.sinif;
              if (grade) grades.add(String(grade).replace('.', '').trim());
            });

            const sortedGrades = Array.from(grades).sort((a, b) => a - b);
            if (sortedGrades.length > 0) {
              gradesMap[plan.exam_id] = sortedGrades.length === 1 
                ? `${sortedGrades[0]}. Sınıf` 
                : `${sortedGrades.join('-')}. Sınıflar`;
            }
          });
          setExamGrades(gradesMap);
        }
      }
    } catch (err) {
      console.error('Sınavlar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    setLoading(true);
    setTempTcs({}); // Yeni sınav seçildiğinde geçici TC'leri sıfırla
    try {
      const { data, error } = await supabase
        .from('seating_plans')
        .select('*')
        .eq('exam_id', exam.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const plan = data && data.length > 0 ? data[0] : null;
      let parsedAssignments = [];

      if (plan) {
        if (typeof plan.assignments === 'string') {
          parsedAssignments = JSON.parse(plan.assignments);
        } else if (Array.isArray(plan.assignments)) {
          parsedAssignments = plan.assignments;
        }
        plan.assignments = parsedAssignments;
      }
      setSeatingPlan(plan);
    } catch (err) {
      console.error('Oturma planı alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  // Excel'den Geçici TC Yükleme Fonksiyonu
  const handleTempTcFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newMap = {};
        jsonData.forEach(row => {
          const keys = Object.keys(row);
          let noKey = keys.find(k => k.toLowerCase().includes('no') || k.toLowerCase().includes('numara'));
          let nameKey = keys.find(k => k.toLowerCase().includes('ad') || k.toLowerCase().includes('isim') || k.toLowerCase().includes('soyad'));
          let tcKey = keys.find(k => k.toLowerCase().includes('tc') || k.toLowerCase().includes('kimlik'));

          if (tcKey) {
            const tcVal = String(row[tcKey] || '').trim();
            if (noKey && row[noKey]) {
              newMap[String(row[noKey]).trim()] = tcVal;
            }
            if (nameKey && row[nameKey]) {
              newMap[String(row[nameKey]).trim().toLocaleLowerCase('tr-TR')] = tcVal;
            }
          }
        });

        setTempTcs(newMap);
        alert(`Başarıyla ${Object.keys(newMap).length} öğrenci için geçici TC yüklendi! Bu veriler sadece bu oturumda görüntülenecektir.`);
      } catch (err) {
        console.error('Excel okuma hatası:', err);
        alert('Excel dosyası okunurken bir hata oluştu.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null; // Reset file input
  };

  const handleInvigilatorChange = async (roomName, val) => {
    setInvigilators(prev => ({ ...prev, [roomName]: val }));

    if (!selectedExam) return;

    try {
      const { data: existing } = await supabase
        .from('exam_invigilators')
        .select('id')
        .eq('exam_id', selectedExam.id)
        .eq('room_name', roomName)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('exam_invigilators')
          .update({ invigilator_name: val })
          .eq('id', existing.id);
      } else if (val.trim() !== '') {
        await supabase
          .from('exam_invigilators')
          .insert([{
            exam_id: selectedExam.id,
            room_name: roomName,
            invigilator_name: val
          }]);
      }
      fetchSavedInvigilators();
    } catch (err) {
      console.error('Gözetmen kaydedilirken hata:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatTrack = (track) => {
    if (!track) return '-';
    const tr = String(track).trim().toLowerCase();
    if (tr.includes('say')) return 'SAY';
    if (tr.includes('eş') || tr.includes('es') || tr.includes('ea')) return 'EA';
    if (tr.includes('söz') || tr.includes('soz')) return 'SÖZ';
    if (tr.includes('dil')) return 'DİL';
    return String(track).toUpperCase();
  };

  const getStudentDetails = (st) => {
    const rawId = String(st.studentId || st.student_id || st.id || '').trim();
    const rawTc = String(st.tc || st.tc_no || st.tcNo || '').trim();
    const rawNo = String(st.no || st.student_no || st.studentNo || st.school_number || '').trim();

    const dbSt = studentMap[rawId] || studentMap[rawTc] || studentMap[rawNo] || {};

    const studentNo = dbSt.student_no || st.student_no || st.no || st.studentNo || '-';

    let firstName = dbSt.first_name || st.first_name || st.ad || '';
    let lastName = dbSt.last_name || st.last_name || st.soyad || '';
    let fullName = st.studentName || st.student_name || st.fullName || '';

    if (dbSt.first_name || dbSt.last_name) {
      fullName = `${dbSt.first_name || ''} ${dbSt.last_name || ''}`.trim();
    }

    if (!fullName) {
      fullName = `${firstName} ${lastName}`.trim() || 'İsimsiz Öğrenci';
    }

    if (!lastName && fullName) {
      const parts = fullName.trim().split(' ');
      if (parts.length > 1) {
        lastName = parts.pop();
        firstName = parts.join(' ');
      } else {
        firstName = fullName;
      }
    }

    const surnameFirstFormat = lastName ? `${lastName.toUpperCase()}, ${firstName}` : fullName;
    const nameFirstFormat = `${firstName} ${lastName}`.trim();

    const grade = dbSt.grade || st.grade || st.sinif || '';
    const className = dbSt.class || st.className || st.sube || '';
    const rawField = dbSt.field || st.field || st.alan || st.track || st.department || '';
    const englishLevel = dbSt.english_level || dbSt.ingilizce_seviye || st.englishLevel || st.ing_seviye || '-';
    const secondLanguage = dbSt.second_lang || dbSt.second_language || st.ikinci_yabanci_dil || st.secondLanguage || '-';

    // TC Çözümleme (Önce DB'ye bakılır, yoksa geçici yüklenen tempTcs'den öğrenci no veya ad-soyad ile eşleştirilir)
    let tcNo = dbSt.tc_no || dbSt.tc || st.tc || st.tc_no || st.tcNo || '';
    if (!tcNo) {
      if (studentNo !== '-' && tempTcs[String(studentNo).trim()]) {
        tcNo = tempTcs[String(studentNo).trim()];
      } else if (fullName && tempTcs[String(fullName).trim().toLocaleLowerCase('tr-TR')]) {
        tcNo = tempTcs[String(fullName).trim().toLocaleLowerCase('tr-TR')];
      }
    }

    return {
      studentNo,
      fullName,
      surnameFirstFormat,
      nameFirstFormat,
      grade,
      className,
      track: formatTrack(rawField),
      englishLevel,
      secondLanguage,
      tcNo: tcNo || '-'
    };
  };

  const getRoomName = (item) => {
    const rawRoomId = item.roomId || item.room_id || item.salon_id || item.roomName || item.room_name || item.salon;
    if (rooms && rooms.length > 0 && rawRoomId) {
      const foundInDb = rooms.find(r => String(r.id) === String(rawRoomId) || String(r.name) === String(rawRoomId));
      if (foundInDb && foundInDb.name) return foundInDb.name;
    }
    return rawRoomId || 'Tanımsız Salon';
  };

  const getRoomDetailsObj = (item) => {
    const rawRoomId = item.roomId || item.room_id || item.salon_id || item.roomName || item.room_name || item.salon;
    let roomName = rawRoomId || 'Tanımsız Salon';
    let roomCode = '';

    if (rooms && rooms.length > 0 && rawRoomId) {
      const foundInDb = rooms.find(r => String(r.id) === String(rawRoomId) || String(r.name) === String(rawRoomId));
      if (foundInDb) {
        if (foundInDb.name) roomName = foundInDb.name;
        const dbClass = foundInDb.class;
        if (dbClass && String(dbClass).toUpperCase() !== 'EMPTY') {
          roomCode = dbClass;
        } else {
          roomCode = foundInDb.room_code || foundInDb.code || foundInDb.sube_kodu || foundInDb.branch_code || '';
        }
      }
    }
    return { roomName, roomCode };
  };

  const formatRoomDisplay = (item) => {
    const { roomName, roomCode } = getRoomDetailsObj(item);
    if (showRoomCode && roomCode) {
      return `${roomName} (${roomCode})`;
    }
    return roomName;
  };

  const getGradeSummary = (studentList) => {
    const grades = new Set();
    studentList.forEach(st => {
      const det = getStudentDetails(st);
      if (det.grade) grades.add(String(det.grade).replace('.', ''));
    });
    
    const sortedGrades = Array.from(grades).sort((a, b) => a - b);
    if (sortedGrades.length === 0) return 'Tüm Sınıflar';
    if (sortedGrades.length === 1) return `${sortedGrades[0]}. Sınıf`;
    return `${sortedGrades.join(' ve ')}. Sınıf`;
  };

  const getHeaderTitle = (roomDisplayStr, gradeSummary) => {
    if (examCategory === 'akademik_ortaokul_sozel') {
      return `${selectedExam.title} - ${gradeSummary} (SÖZEL OTURUMU) - ${roomDisplayStr.toUpperCase()} YOKLAMA LİSTESİ`;
    }
    if (examCategory === 'akademik_ortaokul_sayisal') {
      return `${selectedExam.title} - ${gradeSummary} (SAYISAL OTURUMU) - ${roomDisplayStr.toUpperCase()} YOKLAMA LİSTESİ`;
    }
    return `${selectedExam.title} - ${gradeSummary} - ${roomDisplayStr.toUpperCase()} YOKLAMA LİSTESİ`;
  };

  const rawAssignments = seatingPlan?.assignments || [];
  const targetGradeStr = String(selectedExam?.grade || selectedExam?.sinif || '').replace(/\D/g, '');

  const assignments = rawAssignments.filter(st => {
    const rawId = String(st.studentId || st.student_id || st.id || '').trim();
    const rawTc = String(st.tc || st.tc_no || st.tcNo || '').trim();
    const rawNo = String(st.no || st.student_no || st.studentNo || st.school_number || '').trim();
    
    const dbSt = studentMap[rawId] || studentMap[rawTc] || studentMap[rawNo];
    if (!dbSt) return false;
    
    if (targetGradeStr) {
      const studentGrade = String(dbSt.grade || st.grade || st.sinif || '').replace(/\D/g, '');
      if (studentGrade && studentGrade !== targetGradeStr) {
        return false;
      }
    }
    return true;
  });

  const groupedByRoom = assignments.reduce((acc, curr) => {
    const roomName = getRoomName(curr);
    if (!acc[roomName]) acc[roomName] = [];
    acc[roomName].push(curr);
    return acc;
  }, {});

  Object.keys(groupedByRoom).forEach(room => {
    groupedByRoom[room].sort((a, b) => {
      const seatA = parseInt(a.seatNumber || a.seat_number || 9999, 10);
      const seatB = parseInt(b.seatNumber || b.seat_number || 9999, 10);
      return seatA - seatB;
    });
  });

  const groupedByClassroom = assignments.reduce((acc, curr) => {
    const det = getStudentDetails(curr);
    const classKey = det.grade && det.className ? `${det.grade}-${det.className}` : 'Diğer';
    if (!acc[classKey]) acc[classKey] = [];
    acc[classKey].push({ ...curr, roomDisplay: formatRoomDisplay(curr), det });
    return acc;
  }, {});

  const getSortedBySurname = () => {
    return [...assignments].sort((a, b) => {
      const detA = getStudentDetails(a);
      const detB = getStudentDetails(b);
      return detA.surnameFirstFormat.localeCompare(detB.surnameFirstFormat, 'tr', { sensitivity: 'base' });
    });
  };

  const getSortedByName = () => {
    return [...assignments].sort((a, b) => {
      const detA = getStudentDetails(a);
      const detB = getStudentDetails(b);
      return detA.nameFirstFormat.localeCompare(detB.nameFirstFormat, 'tr', { sensitivity: 'base' });
    });
  };

  const exportToExcel = () => {
    if (!selectedExam || assignments.length === 0) return;

    let dataToExport = [];

    if (activeTab === 'surname') {
      dataToExport = getSortedBySurname().map((st, index) => {
        const det = getStudentDetails(st);
        return {
          'Sıra No': index + 1,
          'Öğrenci Soyadı, Adı': det.surnameFirstFormat,
          'TC Kimlik No': det.tcNo,
          'Sınıf/Şube': `${det.grade}-${det.className}`,
          'Salon Adı': formatRoomDisplay(st),
          'Masa Sıra No': st.seatNumber || st.seat_number || ''
        };
      });
    } else if (activeTab === 'name') {
      dataToExport = getSortedByName().map((st, index) => {
        const det = getStudentDetails(st);
        return {
          'Sıra No': index + 1,
          'Öğrenci Adı Soyadı': det.nameFirstFormat,
          'TC Kimlik No': det.tcNo,
          'Sınıf/Şube': `${det.grade}-${det.className}`,
          'Salon Adı': formatRoomDisplay(st),
          'Masa Sıra No': st.seatNumber || st.seat_number || ''
        };
      });
    } else {
      const allSortedAssignments = [];
      Object.keys(groupedByRoom).forEach(room => {
        allSortedAssignments.push(...groupedByRoom[room]);
      });

      dataToExport = allSortedAssignments.map((st, index) => {
        const det = getStudentDetails(st);
        return {
          'Sıra No': index + 1,
          'Salon Adı': formatRoomDisplay(st),
          'Masa Sıra No': st.seatNumber || st.seat_number || '',
          'Öğrenci Adı Soyadı': det.fullName,
          'TC Kimlik No': det.tcNo,
          'Sınıf/Şube': `${det.grade}-${det.className}`,
          'Öğrenci No': det.studentNo
        };
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sınav_Listesi');
    XLSX.writeFile(workbook, `${selectedExam.title}_Listesi.xlsx`);
  };

  return (
    <div className="lists-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 7mm;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            height: 98vh !important;
            box-sizing: border-box !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #000 !important;
            padding: 4px 5px !important;
            font-size: 9pt !important;
            color: #000 !important;
            line-height: 1.25 !important;
          }
          th {
            background-color: #eee !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          input {
            border: none !important;
            background: transparent !important;
          }
          .gray-level-1 {
            background-color: transparent !important;
            font-weight: normal !important;
          }
          .gray-level-2 {
            background-color: #cbd5e1 !important;
            color: #000 !important;
            font-weight: normal !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .gray-level-3 {
            background-color: #334155 !important;
            color: #ffffff !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="no-print">
        <h2>📑 Yoklama ve Sınav Listeleri</h2>
        <p style={{ color: '#666' }}>Sınav salon, kapı, soyad ve isim sıralı listelerini yönetin ve bastırın.</p>

        {!selectedExam ? (
          <div style={{ marginTop: '1.5rem' }}>
            <h3>Lütfen Bir Sınav Seçin</h3>
            {loading ? <p>Sınavlar yükleniyor...</p> : (
              <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                {exams.map(exam => (
                  <div
                    key={exam.id}
                    onClick={() => handleSelectExam(exam)}
                    style={{
                      padding: '1.2rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, color: '#2b6cb0', fontSize: '1.1rem' }}>{exam.title}</h4>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#718096' }}>Tarih: {exam.date}</span>
                        {examGrades[exam.id] && (
                          <span style={{ fontSize: '0.85rem', color: '#2b6cb0', fontWeight: 'bold', background: '#ebf8ff', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                            {examGrades[exam.id]}
                          </span>
                        )}
                      </div>
                    </div>
                    <button style={{ padding: '0.5rem 1rem', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Listeleri Aç →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSelectedExam(null)}
              style={{ padding: '0.4rem 0.8rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '1rem' }}
            >
              ← Sınav Seçimine Dön
            </button>

            <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block' }}>Sınav / Liste Kategorisi:</label>
                <select value={examCategory} onChange={(e) => setExamCategory(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', fontWeight: 'bold' }}>
                  <option value="akademik_lise">Akademik Lise (Alanlı)</option>
                  <option value="akademik_lise_alansiz">Akademik Lise (Alansız - 9/10. Sınıflar)</option>
                  <option value="sadece_ingilizce">Sadece İngilizce</option>
                  <option value="sadece_ikinci_dil">Sadece 2. Yabancı Dil</option>
                  <option value="ingilizce_ve_ikinci_dil">İngilizce ve 2. Yabancı Dil</option>
                  <option value="akademik_ortaokul_sozel">Akademik Ortaokul Sözel</option>
                  <option value="akademik_ortaokul_sayisal">Akademik Ortaokul Sayısal</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.2rem', gap: '1.2rem' }}>
                <label style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold', color: '#16a34a' }}>
                  <input type="checkbox" checked={showRoomCode} onChange={(e) => setShowRoomCode(e.target.checked)} style={{ marginRight: '0.5rem' }} />
                  Salon Şube Kodunu Göster
                </label>
              </div>

              {/* GEÇİCİ TC YÜKLEME BUTONU */}
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.2rem', gap: '0.5rem' }}>
                <label style={{ background: '#0284c7', color: '#fff', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  📂 Geçici TC Yükle (Excel)
                  <input type="file" accept=".xlsx, .xls" onChange={handleTempTcFileUpload} style={{ display: 'none' }} />
                </label>
                {Object.keys(tempTcs).length > 0 && (
                  <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 'bold' }}>
                    ({Object.keys(tempTcs).length} TC Yüklendi)
                  </span>
                )}
              </div>

              <div style={{ marginLeft: 'auto', marginTop: '1.2rem' }}>
                <button
                  onClick={handlePrint}
                  style={{ padding: '0.6rem 1.4rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}
                >
                  🖨️ A4 Baskı Al (Ctrl+P)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab('attendance')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'attendance' ? '3px solid #007bff' : 'none',
                  fontWeight: activeTab === 'attendance' ? 'bold' : 'normal',
                  color: activeTab === 'attendance' ? '#007bff' : '#4a5568',
                  cursor: 'pointer'
                }}
              >
                🏫 Sınıf / Salon Yoklama Listesi
              </button>
              <button
                onClick={() => setActiveTab('door')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'door' ? '3px solid #6b46c1' : 'none',
                  fontWeight: activeTab === 'door' ? 'bold' : 'normal',
                  color: activeTab === 'door' ? '#6b46c1' : '#4a5568',
                  cursor: 'pointer'
                }}
              >
                🚪 Kapı Listeleri (Şube Bazlı)
              </button>
              <button
                onClick={() => setActiveTab('surname')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'surname' ? '3px solid #007bff' : 'none',
                  fontWeight: activeTab === 'surname' ? 'bold' : 'normal',
                  color: activeTab === 'surname' ? '#007bff' : '#4a5568',
                  cursor: 'pointer'
                }}
              >
                🔤 Soyad Sıralı Liste (A-Z)
              </button>
              <button
                onClick={() => setActiveTab('name')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'name' ? '3px solid #0284c7' : 'none',
                  fontWeight: activeTab === 'name' ? 'bold' : 'normal',
                  color: activeTab === 'name' ? '#0284c7' : '#4a5568',
                  cursor: 'pointer'
                }}
              >
                🔤 İsim Sıralı Liste (A-Z)
              </button>
              <button
                onClick={() => setActiveTab('excel')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'excel' ? '3px solid #28a745' : 'none',
                  fontWeight: activeTab === 'excel' ? 'bold' : 'normal',
                  color: activeTab === 'excel' ? '#28a745' : '#4a5568',
                  cursor: 'pointer'
                }}
              >
                📊 Excel Dışarı Aktar
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedExam && (
        <div className="print-area">
          {activeTab === 'attendance' && (
            <div>
              {Object.keys(groupedByRoom).map((roomName) => {
                const students = groupedByRoom[roomName];
                const gradeSummary = getGradeSummary(students);
                const sampleItem = students[0] || {};
                const roomDisplayStr = formatRoomDisplay(sampleItem);

                let totalCore = 0;
                let totalExt = 0;
                let langTotals = {};
                const engLevelsInRoom = new Set();
                const langsInRoom = new Set();

                students.forEach(st => {
                  const det = getStudentDetails(st);
                  const engLevelUpper = String(det.englishLevel || '').trim().toLocaleUpperCase('tr-TR');
                  if (engLevelUpper.includes('CORE')) totalCore++;
                  if (engLevelUpper.includes('EXT')) totalExt++;
                  if (engLevelUpper && engLevelUpper !== '-') engLevelsInRoom.add(engLevelUpper);

                  const sLang = String(det.secondLanguage || '').trim().toLocaleUpperCase('tr-TR');
                  if (sLang && sLang !== '-' && sLang !== 'YOK' && sLang !== 'BOŞ') {
                    langTotals[sLang] = (langTotals[sLang] || 0) + 1;
                    langsInRoom.add(sLang);
                  }
                });

                const sortedEngLevels = Array.from(engLevelsInRoom).sort();
                const sortedLangs = Array.from(langsInRoom).sort();

                const getStyleAndClassForValue = (val, list) => {
                  const upperVal = String(val || '').trim().toLocaleUpperCase('tr-TR');
                  const index = list.indexOf(upperVal);
                  if (index === -1 || list.length <= 1) return { className: 'gray-level-1', style: {} };
                  if (list.length === 2) {
                    if (index === 0) return { className: 'gray-level-1', style: {} };
                    return { className: 'gray-level-2', style: { backgroundColor: '#cbd5e1', color: '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } };
                  } else {
                    if (index === 0) return { className: 'gray-level-1', style: {} };
                    if (index === 1) return { className: 'gray-level-2', style: { backgroundColor: '#cbd5e1', color: '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } };
                    return { className: 'gray-level-3', style: { backgroundColor: '#334155', color: '#ffffff', fontWeight: 'bold', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } };
                  }
                };

                return (
                  <div key={roomName} className="print-card page-break" style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.8rem', marginBottom: '1rem', borderRadius: '6px' }}>
                    
                    <div style={{ border: '2px solid #000', padding: '0.5rem', textAlign: 'center', marginBottom: '0.5rem', background: '#fafafa' }}>
                      <h1 style={{ margin: '0 0 0.2rem 0', fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {getHeaderTitle(roomDisplayStr, gradeSummary)}
                      </h1>
                      <div style={{ fontSize: '9pt', fontWeight: 'bold', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #000', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
                        <span>TARİH: {selectedExam.date}</span>
                        <span>{roomDisplayStr.toUpperCase()}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '9pt', fontWeight: 'bold' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '60%' }}>
                        <span>GÖZETMEN ADI SOYADI: </span>
                        <input
                          type="text"
                          list={`invigilator-list-${roomName}`}
                          placeholder="Ad Soyad yazın veya seçin..."
                          value={invigilators[roomName] || ''}
                          onChange={(e) => handleInvigilatorChange(roomName, e.target.value)}
                          style={{ border: 'none', borderBottom: '1px solid #000', outline: 'none', fontWeight: 'bold', fontSize: '9pt', flex: 1, padding: '2px' }}
                        />
                        <datalist id={`invigilator-list-${roomName}`}>
                          {savedInvigilatorsList.map((name, idx) => (
                            <option key={idx} value={name} />
                          ))}
                        </datalist>
                      </div>
                      <div>SALON KAPASİTESİ: {students.length} ÖĞRENCİ</div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#eee' }}>
                          <th style={{ width: '5%', textAlign: 'center' }}>SIRA</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>ÖĞR. NO</th>
                          <th style={{ width: '13%', textAlign: 'center' }}>TC KİMLİK NO</th>
                          <th>ÖĞRENCİ ADI SOYADI</th>

                          <th style={{ width: '10%', textAlign: 'center' }}>SINIF / ŞUBE</th>
                          
                          {examCategory === 'akademik_lise' && (
                            <th style={{ width: '10%', textAlign: 'center' }}>ALAN</th>
                          )}
                          {examCategory === 'sadece_ingilizce' && (
                            <th style={{ width: '12%', textAlign: 'center' }}>İNG. SEVİYE</th>
                          )}
                          {examCategory === 'sadece_ikinci_dil' && (
                            <th style={{ width: '12%', textAlign: 'center' }}>2. YAB. DİL</th>
                          )}
                          {examCategory === 'ingilizce_ve_ikinci_dil' && (
                            <>
                              <th style={{ width: '10%', textAlign: 'center' }}>İNG. SEVİYE</th>
                              <th style={{ width: '10%', textAlign: 'center' }}>2. YAB. DİL</th>
                            </>
                          )}

                          <th style={{ width: '15%', textAlign: 'center' }}>YOKLAMA +/-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((st, sIdx) => {
                          const det = getStudentDetails(st);
                          const engStyle = getStyleAndClassForValue(det.englishLevel, sortedEngLevels);
                          const langStyle = getStyleAndClassForValue(det.secondLanguage, sortedLangs);

                          return (
                            <tr key={st.studentId || st.id || sIdx}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.seatNumber || st.seat_number || (sIdx + 1)}</td>
                              <td style={{ textAlign: 'center', fontWeight: '600' }}>{det.studentNo}</td>
                              <td style={{ fontWeight: '500' }}>{det.fullName}</td>
                              <td style={{ textAlign: 'center', fontWeight: '600', fontSize: '8.5pt' }}>{det.tcNo}</td>
                              <td style={{ textAlign: 'center' }}>{det.grade}-{det.className}</td>

                              {examCategory === 'akademik_lise' && (
                                <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '8.5pt' }}>{det.track}</td>
                              )}
                              {examCategory === 'sadece_ingilizce' && (
                                <td className={engStyle.className} style={{ textAlign: 'center', fontSize: '8.5pt', ...engStyle.style }}>
                                  {det.englishLevel}
                                </td>
                              )}
                              {examCategory === 'sadece_ikinci_dil' && (
                                <td className={langStyle.className} style={{ textAlign: 'center', fontSize: '8.5pt', ...langStyle.style }}>
                                  {det.secondLanguage}
                                </td>
                              )}
                              {examCategory === 'ingilizce_ve_ikinci_dil' && (
                                <>
                                  <td className={engStyle.className} style={{ textAlign: 'center', fontSize: '8.5pt', ...engStyle.style }}>
                                    {det.englishLevel}
                                  </td>
                                  <td className={langStyle.className} style={{ textAlign: 'center', fontSize: '8.5pt', ...langStyle.style }}>
                                    {det.secondLanguage}
                                  </td>
                                </>
                              )}

                              <td style={{ textAlign: 'center', color: '#999' }}>[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ border: '1px solid #000', padding: '0.4rem 0.5rem', fontSize: '8.5pt', borderRadius: '4px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div><strong>Sınava Katılan:</strong> ....................................................................................................</div>
                        <div><strong>Sınava Katılmayan:</strong> .................................................................................................</div>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ border: '1px solid #000', padding: '0.3rem', textAlign: 'center', width: '160px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>GÖZETMEN İMZA</div>
                        <div style={{ height: '14px' }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'door' && (
            <div>
              {Object.keys(groupedByClassroom).sort().map((classKey) => {
                const classStudents = groupedByClassroom[classKey];

                return (
                  <div key={classKey} className="print-card page-break" style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '1.2rem', marginBottom: '2rem', borderRadius: '6px' }}>
                    <div style={{ border: '2px solid #000', padding: '0.6rem', textAlign: 'center', marginBottom: '1rem', background: '#fafafa' }}>
                      <h1 style={{ margin: '0 0 0.3rem 0', fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {selectedExam.title} - {classKey} ŞUBESİ SINAV YERLERİ
                      </h1>
                      <div style={{ fontSize: '9.5pt', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
                        TARİH: {selectedExam.date} &nbsp;|&nbsp; ŞUBE ÖĞRENCİ LİSTESİ VE GİDECEĞİ SALONLAR
                      </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#eee' }}>
                          <th style={{ width: '8%', textAlign: 'center' }}>SIRA</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>ÖĞR. NO</th>
                          <th style={{ width: '20%', textAlign: 'center' }}>TC KİMLİK NO</th>
                          <th>ÖĞRENCİ ADI SOYADI</th>
                          <th style={{ width: '30%', textAlign: 'center', background: '#e2e8f0' }}>GİDECEĞİ SALON</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((st, idx) => (
                          <tr key={st.studentId || st.id || idx}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{st.det.studentNo}</td>
                            <td style={{ fontWeight: '500' }}>{st.det.fullName}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{st.det.tcNo}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#1d4ed8', background: '#f8fafc', fontSize: '9.5pt' }}>
                              {st.roomDisplay.toUpperCase()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'surname' && (
            <div className="print-card page-break" style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '1.2rem', borderRadius: '6px' }}>
              <div style={{ border: '2px solid #000', padding: '0.6rem', textAlign: 'center', marginBottom: '1rem', background: '#fafafa' }}>
                <h1 style={{ margin: '0 0 0.3rem 0', fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {selectedExam.title} - SOYAD SIRALI ÖĞRENCİ LİSTESİ
                </h1>
                <div style={{ fontSize: '9.5pt', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
                  TARİH: {selectedExam.date} &nbsp;|&nbsp; SINIF SEVİYESİ: {getGradeSummary(assignments)}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#eee' }}>
                    <th style={{ width: '6%', textAlign: 'center' }}>SIRA</th>
                    <th>ÖĞRENCİ SOYADI, ADI</th>
                    <th style={{ width: '18%', textAlign: 'center' }}>TC KİMLİK NO</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>SINIF / ŞUBE</th>
                    <th style={{ width: '22%', textAlign: 'center' }}>SINAV SALONU</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>SIRA NO</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedBySurname().map((st, idx) => {
                    const det = getStudentDetails(st);
                    const roomDisplay = formatRoomDisplay(st);

                    return (
                      <tr key={st.studentId || st.id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{det.surnameFirstFormat}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>{det.tcNo}</td>
                        <td style={{ textAlign: 'center' }}>{det.grade}-{det.className}</td>
                        <td style={{ textAlign: 'center', fontWeight: '500' }}>{roomDisplay}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.seatNumber || st.seat_number || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'name' && (
            <div className="print-card page-break" style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '1.2rem', borderRadius: '6px' }}>
              <div style={{ border: '2px solid #000', padding: '0.6rem', textAlign: 'center', marginBottom: '1rem', background: '#fafafa' }}>
                <h1 style={{ margin: '0 0 0.3rem 0', fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {selectedExam.title} - İSİM SIRALI ÖĞRENCİ LİSTESİ
                </h1>
                <div style={{ fontSize: '9.5pt', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
                  TARİH: {selectedExam.date} &nbsp;|&nbsp; SINIF SEVİYESİ: {getGradeSummary(assignments)}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#eee' }}>
                    <th style={{ width: '6%', textAlign: 'center' }}>SIRA</th>
                    <th>ÖĞRENCİ ADI SOYADI</th>
                    <th style={{ width: '18%', textAlign: 'center' }}>TC KİMLİK NO</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>SINIF / ŞUBE</th>
                    <th style={{ width: '22%', textAlign: 'center' }}>SINAV SALONU</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>SIRA NO</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedByName().map((st, idx) => {
                    const det = getStudentDetails(st);
                    const roomDisplay = formatRoomDisplay(st);

                    return (
                      <tr key={st.studentId || st.id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{det.nameFirstFormat}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>{det.tcNo}</td>
                        <td style={{ textAlign: 'center' }}>{det.grade}-{det.className}</td>
                        <td style={{ textAlign: 'center', fontWeight: '500' }}>{roomDisplay}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.seatNumber || st.seat_number || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'excel' && (
            <div className="no-print" style={{ background: '#f8fafc', padding: '2.5rem', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
              <h3 style={{ color: '#1e293b', margin: 0 }}>📊 Excel Dışarı Aktar</h3>
              <p style={{ color: '#64748b', margin: '0.5rem 0 1.5rem 0' }}>
                Aktif sınav verilerini salon, sıra, TC ve öğrenci bilgileriyle birlikte Excel dosyası olarak kaydedin.
              </p>
              <button
                onClick={exportToExcel}
                style={{
                  padding: '0.8rem 2rem',
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                📥 Excel Dosyasını İndir (.xlsx)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExamAttendanceLists;
