import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Invigilators = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examRooms, setExamRooms] = useState([]);
  const [invigilatorsData, setInvigilatorsData] = useState({}); // { roomName: { invigilator, notes } }
  const [loading, setLoading] = useState(false);

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
    
    // Doğru tablo olan seating_plans üzerinden o sınava ait salonları çekiyoruz
    const { data: seatingData, error: seatingError } = await supabase
      .from('seating_plans')
      .select('room_name')
      .eq('exam_id', examId);

    if (!seatingError && seatingData) {
      // Benzersiz salon isimlerini alalım
      const uniqueRooms = [...new Set(seatingData.map(item => item.room_name))];
      setExamRooms(uniqueRooms);

      // Daha önce kaydedilmiş gözetmen atamalarını çekelim
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

  const handleSave = async (roomName) => {
    const roomData = invigilatorsData[roomName];
    if (!roomData) return;

    const { error } = await supabase
      .from('exam_invigilators')
      .upsert({
        exam_id: selectedExamId,
        room_name: roomName,
        invigilator_name: roomData.invigilator,
        notes: roomData.notes,
        updated_at: new Date()
      }, { onConflict: 'exam_id,room_name' });

    if (error) {
      alert('Kaydedilirken hata oluştu: ' + error.message);
    } else {
      alert(`${roomName} salonu gözetmen bilgileri kaydedildi.`);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Sınav Gözetmen Yönetimi</h2>
      <p style={{ color: '#666' }}>Sınav seçerek salonlara gözetmen atayabilir, değişim yapabilir ve notlar girebilirsiniz.</p>

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
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Salon Adı</th>
                <th style={{ padding: '10px' }}>Gözetmen(ler)</th>
                <th style={{ padding: '10px' }}>Gözetmenlik Notu / Açıklama</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {examRooms.map((roomName, index) => {
                const currentData = invigilatorsData[roomName] || { invigilator: '', notes: '' };
                return (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', fontWeight: '500' }}>{roomName}</td>
                    <td style={{ padding: '10px' }}>
                      <input 
                        type="text" 
                        placeholder="Gözetmen Adı Soyadı"
                        value={currentData.invigilator}
                        onChange={(e) => handleInputChange(roomName, 'invigilator', e.target.value)}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </td>
                    <td style={{ padding: '10px' }}>
                      <input 
                        type="text" 
                        placeholder="Notlar (Örn: Geç kaldı vb.)"
                        value={currentData.notes}
                        onChange={(e) => handleInputChange(roomName, 'notes', e.target.value)}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleSave(roomName)}
                        style={{ padding: '6px 14px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Kaydet
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
