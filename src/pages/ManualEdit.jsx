import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

const ManualEdit = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [seatingPlan, setSeatingPlan] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  // Salon bazlı ekleme state'leri
  const [activeAddRoom, setActiveAddRoom] = useState(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState(''); // Arama filtresi için
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState('');
  const [customSeatToAdd, setCustomSeatToAdd] = useState('');

  // Sınavları, salonları ve tüm öğrencileri getir
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

        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*');
        if (studentError) throw studentError;
        setAllStudents(studentData || []);
      } catch (error) {
        console.error('Veri alınamadı:', error);
      }
    };
    fetchData();
  }, []);

  const currentExamObj = exams.find(e => String(e.id) === String(selectedExam));

  // Sınav seçilince oturma planını getir
  useEffect(() => {
    if (!selectedExam) {
      setSeatingPlan(null);
      setAssignments([]);
      setMessage('');
      return;
    }
    const fetchSeatingPlan = async () => {
      setLoading(true);
      try {
        const [planRes, studentRes] = await Promise.all([
          supabase
            .from('seating_plans')
            .select('*')
            .eq('exam_id', selectedExam)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase.from('students').select('*')
        ]);

        if (planRes.error) throw planRes.error;

        const planData = planRes.data;
        if (!planData || planData.length === 0) {
          setMessage('Bu sınava ait oturma planı bulunamadı.');
          setSeatingPlan(null);
          setAssignments([]);
          setLoading(false);
          return;
        }

        const plan = planData[0];
        let parsedAssignments = plan.assignments;
        if (typeof parsedAssignments === 'string') {
          try {
            parsedAssignments = JSON.parse(parsedAssignments);
          } catch (e) {
            console.error('Assignments JSON parse hatası:', e);
          }
        }

        const currentStudents = studentRes.data || [];
        
        const validStudentIds = new Set();
        const validStudentTc = new Set();
        const validStudentNos = new Set();
        const validFullNames = new Set();

        currentStudents.forEach(st => {
          if (st.id) validStudentIds.add(String(st.id).trim());
          if (st.student_id) validStudentIds.add(String(st.student_id).trim());
          if (st.tc_no) validStudentTc.add(String(st.tc_no).trim());
          if (st.tc) validStudentTc.add(String(st.tc).trim());
          if (st.student_no) validStudentNos.add(String(st.student_no).trim());
          if (st.school_number) validStudentNos.add(String(st.school_number).trim());
          if (st.no) validStudentNos.add(String(st.no).trim());
          
          const fName = String(st.first_name || st.firstName || st.ad || '').trim().toLowerCase();
          const lName = String(st.last_name || st.lastName || st.soyad || '').trim().toLowerCase();
          if (fName && lName) validFullNames.add(`${fName} ${lName}`);
        });

        const isStudentInMainList = (item) => {
          const sId = String(item.studentId || item.student_id || item.id || '').trim();
          const sNo = String(item.studentNumber || item.student_number || item.school_number || item.no || '').trim();
          const sTc = String(item.tc || item.tc_no || item.tcNo || '').trim();
          const sAd = String(item.firstName || item.first_name || item.ad || '').trim().toLowerCase();
          const sSoyad = String(item.lastName || item.last_name || item.soyad || '').trim().toLowerCase();
          const sFullName = String(item.studentName || item.student_name || `${sAd} ${sSoyad}`).trim().toLowerCase();

          if (sId && validStudentIds.has(sId)) return true;
          if (sNo && validStudentNos.has(sNo)) return true;
          if (sTc && validStudentTc.has(sTc)) return true;
          if (sFullName && validFullNames.has(sFullName)) return true;

          return false;
        };

        const finalAssignments = (parsedAssignments || []).filter(isStudentInMainList);

        setSeatingPlan(plan);
        setAssignments(finalAssignments);
        setMessage(`${finalAssignments.length} öğrenci listelendi.`);

        if (parsedAssignments && finalAssignments.length !== parsedAssignments.length) {
          await supabase
            .from('seating_plans')
            .update({
              assignments: finalAssignments,
              updated_at: new Date().toISOString(),
            })
            .eq('id', plan.id);
        }
      } catch (error) {
        console.error('Oturma planı alınamadı:', error);
        setMessage('Oturma planı alınamadı: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSeatingPlan();
  }, [selectedExam]);

  const cleanStr = (val) => String(val || '').trim().toLowerCase();
  const extractNumbers = (val) => String(val || '').replace(/\D/g, '');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const excelData = XLSX.utils.sheet_to_json(ws);

        if (!excelData || excelData.length === 0) {
          setMessage('Excel dosyasında veri bulunamadı.');
          return;
        }

        let matchCount = 0;

        const updatedAssignments = assignments.map((item) => {
          const itemNo = cleanStr(item.studentNumber || item.student_number || item.school_number || item.no);
          const itemFirstName = cleanStr(item.firstName || item.first_name || item.ad);
          const itemLastName = cleanStr(item.lastName || item.last_name || item.soyad);
          const itemFullName = cleanStr(item.studentName || item.student_name || `${itemFirstName} ${itemLastName}`);

          const matchedRow = excelData.find((row) => {
            const excelNo = cleanStr(row['Okul Numarası'] || row['Okul No'] || row['No'] || row['Student Number']);
            const excelAd = cleanStr(row['Adı'] || row['Ad'] || row['First Name']);
            const excelSoyad = cleanStr(row['Soyadı'] || row['Soyad'] || row['Last Name']);
            const excelAdSoyad = cleanStr(row['Adı Soyadı'] || row['Ad Soyad'] || `${excelAd} ${excelSoyad}`);

            if (itemNo && excelNo && itemNo === excelNo) return true;
            if (itemFirstName && itemLastName && excelAd && excelSoyad && itemFirstName === excelAd && itemLastName === excelSoyad) return true;
            if (itemFullName && excelAdSoyad && itemFullName === excelAdSoyad) return true;

            return false;
          });

          if (matchedRow) {
            matchCount++;
            const rawExcelRoom = String(matchedRow['Salon'] || matchedRow['Salon Adı'] || '').trim();
            const excelRoomNums = extractNumbers(rawExcelRoom);

            const matchedRoomObj = rooms.find((r) => {
              const rName = String(r.name || '').trim();
              const rId = String(r.id || '').trim();

              if (cleanStr(rName) === cleanStr(rawExcelRoom) || rId === rawExcelRoom) return true;
              if (excelRoomNums && extractNumbers(rName) === excelRoomNums) return true;
              return false;
            });

            const newRoomId = matchedRoomObj ? matchedRoomObj.id : (item.roomId || item.room_id);
            const newSeat = parseInt(matchedRow['Sıra'] || matchedRow['Sıra No'] || matchedRow['Sıra Numarası'] || matchedRow['Masa No']) || (item.seatNumber || item.seat_number || 1);
            const newGroup = matchedRow['Grup'] !== undefined ? matchedRow['Grup'] : item.group;

            return {
              ...item,
              roomId: newRoomId,
              room_id: newRoomId,
              seatNumber: newSeat,
              seat_number: newSeat,
              ...(newGroup !== undefined && { group: newGroup })
            };
          }

          return item;
        });

        setAssignments(updatedAssignments);
        setEditing(true);

        if (matchCount > 0) {
          setMessage(`✅ Başarılı! Excel'den ${matchCount} öğrencinin salon ve sıra numarası güncellendi.`);
        } else {
          setMessage(`⚠️ Excel dosyasındaki öğrenciler mevcut oturma planındaki öğrencilerle eşleşmedi.`);
        }
      } catch (err) {
        console.error('Excel okuma hatası:', err);
        setMessage('❌ Excel dosyası okunurken hata oluştu: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const isSameStudent = (item, targetId) => {
    const idList = [item.studentId, item.student_id, item.id, item.studentNumber, item.student_number].map(cleanStr);
    return idList.includes(cleanStr(targetId));
  };

  const handleRoomChange = (targetStudentId, newRoomId) => {
    const updated = assignments.map(a => 
      isSameStudent(a, targetStudentId)
        ? { ...a, roomId: newRoomId, room_id: newRoomId } 
        : a
    );
    setAssignments(updated);
    setEditing(true);
  };

  const handleSeatChange = (targetStudentId, newSeat) => {
    const seatNum = parseInt(newSeat) || 0;
    const updated = assignments.map(a => 
      isSameStudent(a, targetStudentId)
        ? { ...a, seatNumber: seatNum, seat_number: seatNum } 
        : a
    );
    setAssignments(updated);
    setEditing(true);
  };

  // Salona Yeni Öğrenci Ekleme Fonksiyonu
  const handleAddStudentToRoom = (roomId) => {
    if (!selectedStudentToAdd) {
      alert('Lütfen eklenecek öğrenciyi seçin.');
      return;
    }

    const studentObj = allStudents.find(s => String(s.id) === String(selectedStudentToAdd));
    if (!studentObj) {
      alert('Öğrenci bulunamadı.');
      return;
    }

    const alreadyExists = assignments.some(a => isSameStudent(a, studentObj.id));
    if (alreadyExists) {
      alert('Bu öğrenci zaten oturma planında yer alıyor!');
      return;
    }

    const studentsInThisRoom = assignments.filter(a => String(a.roomId || a.room_id) === String(roomId));
    const defaultSeat = studentsInThisRoom.length + 1;
    const seatNum = parseInt(customSeatToAdd) || defaultSeat;

    const newAssignmentItem = {
      studentId: studentObj.id,
      student_id: studentObj.id,
      studentNumber: studentObj.student_no || studentObj.school_number || studentObj.no || '-',
      student_number: studentObj.student_no || studentObj.school_number || studentObj.no || '-',
      firstName: studentObj.first_name || studentObj.ad || '',
      lastName: studentObj.last_name || studentObj.soyad || '',
      studentName: `${studentObj.first_name || studentObj.ad || ''} ${studentObj.last_name || studentObj.soyad || ''}`,
      grade: studentObj.grade || studentObj.sinif || '',
      class: studentObj.class || studentObj.branch || '',
      roomId: roomId,
      room_id: roomId,
      seatNumber: seatNum,
      seat_number: seatNum,
      tc: studentObj.tc_no || studentObj.tc || '',
      tc_no: studentObj.tc_no || studentObj.tc || ''
    };

    setAssignments([...assignments, newAssignmentItem]);
    setEditing(true);
    setActiveAddRoom(null);
    setSelectedStudentToAdd('');
    setStudentSearchTerm('');
    setCustomSeatToAdd('');
    setMessage(`✅ ${newAssignmentItem.studentName} başarıyla salona eklendi. Kaydetmeyi unutmayın.`);
  };

  const handleSave = async () => {
    if (!seatingPlan) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('seating_plans')
        .update({
          assignments: assignments,
          updated_at: new Date().toISOString(),
        })
        .eq('id', seatingPlan.id);

      if (error) throw error;

      setMessage('✅ Değişiklikler veritabanına başarıyla kaydedildi.');
      setEditing(false);
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      setMessage('❌ Kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (seatingPlan) {
      let parsed = seatingPlan.assignments;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (e) {}
      }
      setAssignments(parsed || []);
      setEditing(false);
      setMessage('Değişiklikler iptal edildi.');
    }
  };

  const groupByRoom = () => {
    const groups = {};
    assignments.forEach(item => {
      const rId = item.roomId || item.room_id;
      const roomObj = rooms.find(r => String(r.id) === String(rId));
      const roomName = roomObj ? roomObj.name : (rId ? `Salon (${rId})` : 'Atanmamış Salon');
      
      if (!groups[roomName]) groups[roomName] = [];
      groups[roomName].push(item);
    });

    Object.keys(groups).forEach(rName => {
      groups[rName].sort((a, b) => (a.seatNumber || a.seat_number || 0) - (b.seatNumber || b.seat_number || 0));
    });

    return groups;
  };

  const grouped = groupByRoom();

  let totalConflicts = 0;
  const conflictMap = {};

  Object.keys(grouped).forEach(roomName => {
    const studentsInRoom = grouped[roomName];
    const seatCounts = {};

    studentsInRoom.forEach(item => {
      const seat = Number(item.seatNumber || item.seat_number || 0);
      if (seat > 0) {
        seatCounts[seat] = (seatCounts[seat] || 0) + 1;
      }
    });

    Object.keys(seatCounts).forEach(seat => {
      if (seatCounts[seat] > 1) {
        totalConflicts += seatCounts[seat];
        conflictMap[`${roomName}-${seat}`] = true;
      }
    });

    studentsInRoom.forEach((item, index) => {
      const seat = Number(item.seatNumber || item.seat_number || 0);
      const expectedSeat = index + 1;

      if (seat !== expectedSeat || seat > studentsInRoom.length || seat < 1) {
        totalConflicts++;
        const stId = item.studentId || item.student_id || item.id || item.studentNumber;
        if (stId) {
          conflictMap[`student-${stId}`] = true;
        }
      }
    });
  });

  const examType = cleanStr(currentExamObj?.exam_type || currentExamObj?.type || '');
  const isMiddleSchool = examType.includes('ortaokul') || (currentExamObj?.grade_levels || []).some(g => [5, 6, 7, 8].includes(Number(g)));
  const isLanguageExam = examType.includes('dil') || examType.includes('yabancı');
  const isAcademicHighSchool = examType.includes('akademik') || examType.includes('lise');

  // ** SINIF SEVİYESİNE GÖRE FİLTRELEME MANTIĞI **
  const examGrades = (currentExamObj?.grade_levels || currentExamObj?.gradeLevels || []).map(g => Number(g));

  const filteredStudentsForAdd = allStudents.filter(st => {
    // 1. Planda zaten var mı?
    if (assignments.some(a => isSameStudent(a, st.id))) return false;

    // 2. Sınavın sınıf seviyesine uyuyor mu? (Eğer sınavda sınıf seviyesi tanımlıysa)
    if (examGrades.length > 0) {
      const stGrade = Number(st.grade || st.sinif || 0);
      if (!examGrades.includes(stGrade)) return false;
    }

    // 3. Arama kutusuna yazılan metne uyuyor mu? (İsim, soyisim veya okul no ile arama)
    if (studentSearchTerm.trim()) {
      const term = studentSearchTerm.trim().toLowerCase();
      const sNo = String(st.student_no || st.school_number || st.no || '').toLowerCase();
      const sName = String(st.first_name || st.ad || '').toLowerCase();
      const sSurname = String(st.last_name || st.soyad || '').toLowerCase();
      const fullName = `${sName} ${sSurname}`;

      if (!sNo.includes(term) && !sName.includes(term) && !sSurname.includes(term) && !fullName.includes(term)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🖊️ Manuel Sıra / Salon Düzenleme</h2>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
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
                  {exam.title} ({exam.date}) {grades.length > 0 ? `- ${grades.join(', ')}. Sınıflar` : ''}
                </option>
              );
            })}
          </select>
        </div>

        {selectedExam && (
          <div>
            <label
              htmlFor="excel-upload"
              style={{
                display: 'inline-block',
                padding: '0.55rem 1.2rem',
                background: '#17a2b8',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              📊 Excel'den Salon & Sıra No Aktar
            </label>
            <input
              id="excel-upload"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      {loading && <p>Yükleniyor...</p>}
      {message && (
        <div style={{ 
          padding: '0.8rem 1rem', 
          borderRadius: '6px', 
          background: message.includes('❌') || message.includes('⚠️') ? '#fff3cd' : '#d4edda',
          color: message.includes('❌') || message.includes('⚠️') ? '#856404' : '#155724',
          marginBottom: '1.2rem',
          border: '1px solid #ffeeba',
          fontWeight: '500'
        }}>
          {message}
        </div>
      )}

      {assignments.length > 0 && totalConflicts > 0 && (
        <div style={{ 
          padding: '0.8rem 1rem', 
          borderRadius: '6px', 
          background: '#f8d7da', 
          color: '#721c24', 
          marginBottom: '1.2rem',
          border: '1px solid #f5c6cb',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ⚠️ <strong>Dikkat!</strong> Oturma planında sıra numarası çakışması veya sıra atlaması/boşluk tespit edildi. Kırmızı renkle vurgulanan satırları inceleyip düzeltebilirsiniz.
        </div>
      )}

      {assignments.length > 0 && (
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          {/* SOL KISIM: Salon Özet Tablosu */}
          <div style={{ width: '260px', background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', position: 'sticky', top: '1rem' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.8rem', fontSize: '1rem', borderBottom: '2px solid #2b6cb0', paddingBottom: '0.4rem', color: '#2b6cb0' }}>
              📊 Salon Özetleri
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f1f3f5', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Salon Adı</th>
                  <th style={{ padding: '0.5rem', borderBottom: '1px solid #ddd', textAlign: 'right' }}>Öğrenci</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(grouped).map(roomName => (
                  <tr key={roomName} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '500' }}>{roomName}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: '#2b6cb0' }}>
                      {grouped[roomName].length}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                  <td style={{ padding: '0.5rem', borderTop: '2px solid #ddd' }}>Toplam</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', borderTop: '2px solid #ddd', color: '#2b6cb0' }}>
                    {assignments.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* SAĞ KISIM: Ana Liste ve Salonlar */}
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4>Oturma Planı ({assignments.length} öğrenci)</h4>
              {editing && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{
                      padding: '0.6rem 1.2rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    💾 Değişiklikleri Kaydet
                  </button>
                  <button
                    onClick={handleCancel}
                    style={{
                      padding: '0.6rem 1.2rem',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ↩️ İptal
                  </button>
                </div>
              )}
            </div>

            {Object.keys(grouped).map(roomName => {
              const currentRoomObj = rooms.find(r => r.name === roomName);
              const roomId = currentRoomObj ? currentRoomObj.id : null;
              const isAddingHere = activeAddRoom === roomId;

              return (
                <div key={roomName} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <h4 style={{ margin: 0, color: '#2b6cb0' }}>🏫 {roomName} ({grouped[roomName].length} Öğrenci)</h4>
                    {roomId && (
                      <button
                        onClick={() => {
                          setActiveAddRoom(isAddingHere ? null : roomId);
                          setStudentSearchTerm('');
                          setSelectedStudentToAdd('');
                        }}
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {isAddingHere ? '✖ Kapat' : '➕ Bu Salona Öğrenci Ekle'}
                      </button>
                    )}
                  </div>

                  {/* Salonun Altındaki Öğrenci Arama ve Ekleme Alanı */}
                  {isAddingHere && (
                    <div style={{ background: '#e9ecef', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Arama Çubuğu */}
                        <input
                          type="text"
                          placeholder="🔍 İsim, soyisim veya okul no ile ara..."
                          value={studentSearchTerm}
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          style={{ flex: 1, minWidth: '200px', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        />

                        {/* Sınıf Seviyesine Uygun Öğrenci Listesi */}
                        <select
                          value={selectedStudentToAdd}
                          onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                          style={{ flex: 2, minWidth: '220px', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        >
                          <option value="">
                            {filteredStudentsForAdd.length > 0 
                              ? `-- Öğrenci Seçin (${filteredStudentsForAdd.length} sonuç) --` 
                              : '-- Eşleşen öğrenci bulunamadı --'}
                          </option>
                          {filteredStudentsForAdd.map(st => (
                            <option key={st.id} value={st.id}>
                              {st.student_no || st.school_number || st.no || 'No Yok'} - {st.first_name || st.ad} {st.last_name || st.soyad} ({st.grade || st.sinif || '-'}. Sınıf)
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          placeholder="Sıra No"
                          value={customSeatToAdd}
                          onChange={(e) => setCustomSeatToAdd(e.target.value)}
                          style={{ width: '80px', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center' }}
                        />

                        <button
                          onClick={() => handleAddStudentToRoom(roomId)}
                          style={{ padding: '0.4rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Ekle
                        </button>
                      </div>
                      <small style={{ color: '#6c757d' }}>
                        * Sadece bu sınavın seviyesine ({examGrades.length > 0 ? examGrades.join(', ') + '. sınıflar' : 'tüm sınıflar'}) ait ve henüz oturma planında olmayan öğrenciler gösterilmektedir.
                      </small>
                    </div>
                  )}

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                      <thead style={{ background: '#e9ecef' }}>
                        <tr>
                          <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>#</th>
                          <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Okul No</th>
                          <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Öğrenci</th>
                          <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Sınıf / Şube</th>
                          
                          {isLanguageExam && <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>İngilizce / 2. Yabancı Dil</th>}
                          {isAcademicHighSchool && !isLanguageExam && <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Alan / Branş</th>}
                          {isMiddleSchool && <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>2. Yabancı Dil</th>}

                          <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Grup</th>
                          <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Salon</th>
                          <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Sıra No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped[roomName].map((item, idx) => {
                          const stId = item.studentId || item.student_id || item.id || item.studentNumber;
                          const stNo = item.studentNumber || item.student_number || item.school_number || item.no || '-';
                          const stName = item.studentName || item.student_name || `${item.first_name || item.firstName || ''} ${item.last_name || item.lastName || ''}`;
                          const currentRoomId = item.roomId || item.room_id;
                          const currentSeat = Number(item.seatNumber || item.seat_number || 1);

                          const isConflict = conflictMap[`${roomName}-${currentSeat}`] || conflictMap[`student-${stId}`] || false;

                          const engLevel = item.english_level || item.englishLevel;
                          const secLang = item.second_language || item.secondLanguage;
                          const fieldVal = item.field || item.branch || item.alan;

                          return (
                            <tr 
                              key={stId || idx} 
                              style={{ 
                                borderBottom: '1px solid #eee', 
                                textAlign: 'center',
                                background: isConflict ? '#f8d7da' : 'transparent'
                              }}
                            >
                              <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                              <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{stNo}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '500' }}>{stName}</td>
                              <td style={{ padding: '0.5rem' }}>{item.grade}-{item.class || item.className}</td>
                              
                              {isLanguageExam && (
                                <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#4a5568' }}>
                                  {[engLevel ? `İng: ${String(engLevel).toUpperCase()}` : null, secLang ? `2.Dil: ${String(secLang)}` : null].filter(Boolean).join(' - ') || '-'}
                                </td>
                              )}
                              {isAcademicHighSchool && !isLanguageExam && (
                                <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#4a5568' }}>
                                  {fieldVal || '-'}
                                </td>
                              )}
                              {isMiddleSchool && (
                                <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#4a5568' }}>
                                  {secLang ? String(secLang) : '-'}
                                </td>
                              )}

                              <td style={{ padding: '0.5rem' }}>{item.group || '-'}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <select
                                  value={currentRoomId || ''}
                                  onChange={(e) => handleRoomChange(stId, e.target.value)}
                                  style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #ccc' }}
                                >
                                  <option value="">-- Salon Seç --</option>
                                  {rooms.map(room => (
                                    <option key={room.id} value={room.id}>
                                      {room.name} ({room.capacity} kişilik)
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                <input
                                  type="number"
                                  min="1"
                                  value={currentSeat}
                                  onChange={(e) => handleSeatChange(stId, e.target.value)}
                                  style={{ 
                                    width: '60px', 
                                    padding: '0.3rem', 
                                    border: isConflict ? '2px solid #dc3545' : '1px solid #ccc', 
                                    borderRadius: '4px', 
                                    textAlign: 'center',
                                    background: isConflict ? '#f5c6cb' : 'white',
                                    color: isConflict ? '#721c24' : 'inherit',
                                    fontWeight: isConflict ? 'bold' : 'normal'
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
};

export default ManualEdit;