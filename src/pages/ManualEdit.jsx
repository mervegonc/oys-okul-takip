import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

const ManualEdit = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [seatingPlan, setSeatingPlan] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  // Sınavları ve salonları getir
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

  // Sınav seçilince en son oluşturulan oturma planını getir
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
        const { data, error } = await supabase
          .from('seating_plans')
          .select('*')
          .eq('exam_id', selectedExam)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
          setMessage('Bu sınava ait oturma planı bulunamadı.');
          setSeatingPlan(null);
          setAssignments([]);
          setLoading(false);
          return;
        }

        const plan = data[0];
        setSeatingPlan(plan);
        setAssignments(plan.assignments || []);
        setMessage(`${plan.assignments?.length || 0} öğrenci listelendi.`);
      } catch (error) {
        console.error('Oturma planı alınamadı:', error);
        setMessage('Oturma planı alınamadı: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSeatingPlan();
  }, [selectedExam]);

  // Excel İçe Aktarma İşlevi
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

        let matchCount = 0;

        const updatedAssignments = assignments.map((item) => {
          const stNo = String(item.studentNumber || item.student_number || item.school_number || item.no || '').trim();
          const stName = `${item.firstName || item.first_name || item.studentName || ''} ${item.lastName || item.last_name || ''}`.trim().toLowerCase();

          // Excel satırında eşleşen öğrenciyi bul (Önce okul numarasına, yoksa ad-soyada bakılır)
          const matchedRow = excelData.find((row) => {
            const excelNo = String(row['Okul Numarası'] || row['Okul No'] || row['No'] || row['Student Number'] || '').trim();
            if (stNo && excelNo && stNo === excelNo) return true;

            const excelFirstName = String(row['Adı'] || row['Ad'] || '').trim().toLowerCase();
            const excelLastName = String(row['Soyadı'] || row['Soyad'] || '').trim().toLowerCase();
            const excelFullName = `${excelFirstName} ${excelLastName}`.trim();

            return stName && excelFullName && stName === excelFullName;
          });

          if (matchedRow) {
            matchCount++;
            // Excel'deki Salon adını veya numarasını ID ile eşleştir
            const excelRoomValue = String(matchedRow['Salon'] || matchedRow['Salon Adı'] || '').trim();
            const matchedRoom = rooms.find(
              (r) =>
                String(r.id) === excelRoomValue ||
                String(r.name).trim().toLowerCase() === excelRoomValue.toLowerCase() ||
                String(r.name).replace(/\D/g, '') === excelRoomValue // "Salon 20" -> "20" eşleşmesi için
            );

            const newRoomId = matchedRoom ? matchedRoom.id : item.roomId || item.room_id;
            const newSeat = parseInt(matchedRow['Sıra'] || matchedRow['Sıra No'] || matchedRow['Sıra Numarası']) || item.seatNumber || item.seat_number || 1;
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
        setMessage(`Excel aktarımı tamamlandı! ${matchCount} öğrencinin salon/sıra bilgisi güncellendi. Kaydetmeyi unutmayın.`);
      } catch (err) {
        console.error('Excel okuma hatası:', err);
        setMessage('Excel dosyası işlenirken hata oluştu.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Input'u sıfırla
  };

  // Öğrencinin salonunu değiştir
  const handleRoomChange = (studentId, newRoomId) => {
    const updated = assignments.map(a => 
      (a.studentId === studentId || a.student_id === studentId) 
        ? { ...a, roomId: newRoomId, room_id: newRoomId } 
        : a
    );
    setAssignments(updated);
    setEditing(true);
  };

  // Öğrencinin sıra numarasını değiştir
  const handleSeatChange = (studentId, newSeat) => {
    const seatNum = parseInt(newSeat) || 1;
    const updated = assignments.map(a => 
      (a.studentId === studentId || a.student_id === studentId) 
        ? { ...a, seatNumber: seatNum, seat_number: seatNum } 
        : a
    );
    setAssignments(updated);
    setEditing(true);
  };

  // Değişiklikleri kaydet
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

      setMessage('Değişiklikler başarıyla kaydedildi.');
      setEditing(false);
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      setMessage('Kaydedilirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Değişiklikleri iptal et
  const handleCancel = () => {
    if (seatingPlan) {
      setAssignments(seatingPlan.assignments || []);
      setEditing(false);
      setMessage('Değişiklikler iptal edildi.');
    }
  };

  // Salon bazlı gruplama
  const groupByRoom = () => {
    const groups = {};
    assignments.forEach(item => {
      const rId = item.roomId || item.room_id;
      const roomObj = rooms.find(r => String(r.id) === String(rId));
      const roomName = roomObj ? roomObj.name : (rId || 'Atanmamış Salon');
      
      if (!groups[roomName]) groups[roomName] = [];
      groups[roomName].push(item);
    });

    // Sıra numarasına göre sıralayalım
    Object.keys(groups).forEach(rName => {
      groups[rName].sort((a, b) => (a.seatNumber || a.seat_number || 0) - (b.seatNumber || b.seat_number || 0));
    });

    return groups;
  };

  const grouped = groupByRoom();

  return (
    <div style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>🖊️ Manuel Sıra / Salon Düzenleme</h2>

      {/* Sınav Seçimi ve Excel Aktarım */}
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
                padding: '0.5rem 1rem',
                background: '#17a2b8',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
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
        <p style={{ 
          padding: '0.75rem', 
          borderRadius: '4px', 
          background: message.includes('hata') ? '#f8d7da' : '#d4edda',
          color: message.includes('hata') ? '#721c24' : '#155724',
          marginBottom: '1rem'
        }}>
          {message}
        </p>
      )}

      {/* Salon Bazlı Tablo */}
      {assignments.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4>Oturma Planı ({assignments.length} öğrenci)</h4>
            {editing && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  💾 Değişiklikleri Kaydet
                </button>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '0.5rem 1rem',
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

          {Object.keys(grouped).map(roomName => (
            <div key={roomName} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
              <h4 style={{ marginTop: 0, color: '#333' }}>🏫 {roomName} ({grouped[roomName].length} Öğrenci)</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                <thead style={{ background: '#e9ecef' }}>
                  <tr>
                    <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>#</th>
                    <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Okul No</th>
                    <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd', textAlign: 'left' }}>Öğrenci</th>
                    <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Sınıf / Şube</th>
                    <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Grup</th>
                    <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Salon</th>
                    <th style={{ padding: '0.6rem', borderBottom: '1px solid #ddd' }}>Sıra No</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[roomName].map((item, idx) => {
                    const stId = item.studentId || item.student_id;
                    const stNo = item.studentNumber || item.student_number || item.school_number || item.no || '-';
                    const stName = item.studentName || item.student_name || `${item.first_name || item.firstName || ''} ${item.last_name || item.lastName || ''}`;
                    const currentRoomId = item.roomId || item.room_id;
                    const currentSeat = item.seatNumber || item.seat_number || 1;

                    return (
                      <tr key={stId || idx} style={{ borderBottom: '1px solid #eee', textAlign: 'center' }}>
                        <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{stNo}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '500' }}>{stName}</td>
                        <td style={{ padding: '0.5rem' }}>{item.grade}-{item.class || item.className}</td>
                        <td style={{ padding: '0.5rem' }}>{item.group || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <select
                            value={currentRoomId}
                            onChange={(e) => handleRoomChange(stId, e.target.value)}
                            style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
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
                            style={{ width: '60px', padding: '0.3rem', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'center' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManualEdit;