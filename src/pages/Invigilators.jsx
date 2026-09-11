import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Invigilators = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examRooms, setExamRooms] = useState([]);
  const [invigilatorsData, setInvigilatorsData] = useState({}); // { roomName: { invigilator, notes } }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchExamRoomsAndInvigilators(selectedExamId);
    } else {
      setExamRooms([]);
      setInvigilatorsData({});
    }
  }, [selectedExamId]);

  const fetchExams = async () => {
    const { data, error } = await supabase.from('exams').select('*').order('date', { ascending: false });
    if (!error && data) setExams(data);
  };

  const fetchExamRoomsAndInvigilators = async (examId) => {
    setLoading(true);
    
    const { data: seatingData, error: seatingError } = await supabase
      .from('seating_plans')
      .select('assignments')
      .eq('exam_id', examId);

    if (!seatingError && seatingData && seatingData.length > 0) {
      const roomIds = new Set();
      seatingData.forEach(row => {
        const assignments = row.assignments;
        if (Array.isArray(assignments)) {
          assignments.forEach(item => {
            if (item.room_id) roomIds.add(item.room_id);
          });
        }
      });

      const roomIdList = Array.from(roomIds);

      if (roomIdList.length > 0) {
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .in('id', roomIdList);

        if (!roomsError && roomsData) {
          const roomMap = {};
          roomsData.forEach(r => {
            roomMap[r.id] = r.name || r.room_name || r.title || `Salon ${r.id.slice(0, 4)}`;
          });

          const uniqueRoomNames = [...new Set(roomIdList.map(id => roomMap[id]).filter(Boolean))];
          setExamRooms(uniqueRoomNames);
        } else {
          setExamRooms([]);
        }
      } else {
        setExamRooms([]);
      }

      const { data: invData, error: invError } = await supabase
        .from('exam_invigilators')
        .select('*')
        .eq('exam_id', examId);

      if (!invError && invData) {
        const map = {};
        invData.forEach(item => {
          map[item.room_name] = {
            invigilator: item.invigilator_name || '',
            notes: item.notes || ''
          };
        });
        setInvigilatorsData(map);
      }
    } else {
      setExamRooms([]);
    }
    setLoading(false);
  };

  const handleInputChange = (roomName, field, value) => {
    setInvigilatorsData(prev => ({
      ...prev,
      [roomName]: {
        ...(prev[roomName] || { invigilator: '', notes: '' }),
        [field]: value
      }
    }));
  };

  const handleSaveAll = async () => {
    if (!selectedExamId) return;
    setSaving(true);

    // 1. Önce bu sınava ait eski kayıtları temizleyelim
    const { error: deleteError } = await supabase
      .from('exam_invigilators')
      .delete()
      .eq('exam_id', selectedExamId);

    if (deleteError) {
      setSaving(false);
      alert('Kaydedilirken hata oluştu: ' + deleteError.message);
      return;
    }

    // 2. Güncel listeyi (gözetmen ve notlar ile birlikte) toplu ekleyelim
    const recordsToInsert = examRooms.map(roomName => {
      const roomData = invigilatorsData[roomName] || { invigilator: '', notes: '' };
      return {
        exam_id: selectedExamId,
        room_name: roomName,
        invigilator_name: roomData.invigilator,
        notes: roomData.notes
      };
    });

    const { error: insertError } = await supabase
      .from('exam_invigilators')
      .insert(recordsToInsert);

    setSaving(false);

    if (insertError) {
      alert('Kaydedilirken hata oluştu: ' + insertError.message);
    } else {
      alert('Tüm gözetmen bilgileri ve notlar başarıyla kaydedildi.');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Sınav Gözetmen Yönetimi</h2>
      <p style={{ color: '#666' }}>Sınav seçerek salonlara gözetmen ve not ekleyebilir, tek tıkla tüm listeyi kaydedebilirsiniz.</p>

      <div style={{ margin: '1.5rem 0' }}>
        <label style={{ fontWeight: 'bold', marginRight: '1rem' }}>Sınav Seçin:</label>
        <select 
          value={selectedExamId} 
          onChange={(e) => setSelectedExamId(e.target.value)}
          style={{ padding: '0.5rem', width: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">-- Sınav Seçiniz --</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>
              {exam.name || exam.title || `Sınav #${exam.id}`} ({exam.date})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : selectedExamId ? (
        examRooms.length > 0 ? (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Salon Adı</th>
                  <th style={{ padding: '12px' }}>Gözetmen(ler)</th>
                  <th style={{ padding: '12px' }}>Gözetmenlik Notu / Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {examRooms.map((roomName, index) => {
                  const currentData = invigilatorsData[roomName] || { invigilator: '', notes: '' };
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{roomName}</td>
                      <td style={{ padding: '12px' }}>
                        <input 
                          type="text" 
                          placeholder="Gözetmen Adı Soyadı"
                          value={currentData.invigilator}
                          onChange={(e) => handleInputChange(roomName, 'invigilator', e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <input 
                          type="text" 
                          placeholder="Notlar (Örn: Geç kaldı vb.)"
                          value={currentData.notes}
                          onChange={(e) => handleInputChange(roomName, 'notes', e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button 
                onClick={handleSaveAll}
                disabled={saving}
                style={{ padding: '10px 24px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                {saving ? 'Kaydediliyor...' : 'Tüm Gözetmenleri Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ color: '#888', marginTop: '1rem' }}>Bu sınava ait oturum/salon planı bulunamadı. Lütfen önce karma dağıtım sayfasından dağıtım yapın.</p>
        )
      ) : (
        <p style={{ color: '#888', marginTop: '1rem' }}>Lütfen işlem yapmak istediğiniz sınavı seçin.</p>
      )}
    </div>
  );
};

export default Invigilators;
