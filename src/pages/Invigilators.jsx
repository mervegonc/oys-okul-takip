import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Invigilators = () => {
  const [activeTab, setActiveTab] = useState('management'); // 'management' veya 'reports'

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Üst Sekme Butonları */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #dee2e6', paddingBottom: '1rem', marginBottom: '1.5rem' }} className="no-print">
        <button
          onClick={() => setActiveTab('management')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'management' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'management' ? '#fff' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}
        >
          Gözetmen Yönetimi
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'reports' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'reports' ? '#fff' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}
        >
          İmza ve Ücret Raporları
        </button>
      </div>

      {/* Sekme İçerikleri */}
      {activeTab === 'management' ? (
        <InvigilatorManagement />
      ) : (
        <InvigilatorReports />
      )}
    </div>
  );
};

// 1. ALT BİLEŞEN: Gözetmen Yönetimi
const InvigilatorManagement = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examRooms, setExamRooms] = useState([]);
  const [invigilatorsData, setInvigilatorsData] = useState({});
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

    const { error: deleteError } = await supabase
      .from('exam_invigilators')
      .delete()
      .eq('exam_id', selectedExamId);

    if (deleteError) {
      setSaving(false);
      alert('Kaydedilirken hata oluştu: ' + deleteError.message);
      return;
    }

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
    <div>
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

// 2. ALT BİLEŞEN: İmza ve Ücret Raporları
const InvigilatorReports = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examDetails, setExamDetails] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchReportData(selectedExamId);
      const selected = exams.find(e => e.id === selectedExamId);
      setExamDetails(selected);
    } else {
      setReportData([]);
      setExamDetails(null);
    }
  }, [selectedExamId]);

  const fetchExams = async () => {
    const { data, error } = await supabase.from('exams').select('*').order('date', { ascending: false });
    if (!error && data) setExams(data);
  };

  const fetchReportData = async (examId) => {
    setLoading(true);

    const { data: seatingData } = await supabase
      .from('seating_plans')
      .select('assignments')
      .eq('exam_id', examId);

    const roomIds = new Set();
    if (seatingData) {
      seatingData.forEach(row => {
        if (Array.isArray(row.assignments)) {
          row.assignments.forEach(item => {
            if (item.room_id) roomIds.add(item.room_id);
          });
        }
      });
    }

    let roomNames = [];
    if (roomIds.size > 0) {
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .in('id', Array.from(roomIds));

      if (roomsData) {
        const roomMap = {};
        roomsData.forEach(r => {
          roomMap[r.id] = r.name || r.room_name || r.title || `Salon ${r.id.slice(0, 4)}`;
        });
        roomNames = [...new Set(Array.from(roomIds).map(id => roomMap[id]).filter(Boolean))];
      }
    }

    const { data: invData } = await supabase
      .from('exam_invigilators')
      .select('*')
      .eq('exam_id', examId);

    const invMap = {};
    if (invData) {
      invData.forEach(item => {
        invMap[item.room_name] = {
          invigilator: item.invigilator_name || '',
          sessions: item.sessions ?? 1,
          feePerSession: item.fee_per_session ?? 0
        };
      });
    }

    const combined = roomNames.map((roomName, index) => ({
      no: index + 1,
      roomName,
      invigilator: invMap[roomName]?.invigilator || '',
      sessions: invMap[roomName]?.sessions ?? 1,
      feePerSession: invMap[roomName]?.feePerSession ?? 0
    }));

    setReportData(combined);
    setLoading(false);
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...reportData];
    updated[index][field] = value;
    setReportData(updated);
  };

  const handleSave = async () => {
    if (!selectedExamId) return;
    setSaving(true);

    await supabase.from('exam_invigilators').delete().eq('exam_id', selectedExamId);

    const recordsToInsert = reportData.map(item => ({
      exam_id: selectedExamId,
      room_name: item.roomName,
      invigilator_name: item.invigilator,
      sessions: parseInt(item.sessions) || 1,
      fee_per_session: parseFloat(item.feePerSession) || 0
    }));

    const { error } = await supabase.from('exam_invigilators').insert(recordsToInsert);
    setSaving(false);

    if (error) {
      alert('Hata oluştu: ' + error.message);
    } else {
      alert('Gözetmen seans ve ücret bilgileri kaydedildi.');
    }
  };

  const grandTotal = reportData.reduce((acc, curr) => {
    const s = parseFloat(curr.sessions) || 0;
    const f = parseFloat(curr.feePerSession) || 0;
    return acc + (s * f);
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <h2>Gözetmen İmza, Ücret ve Yoklama Raporları</h2>
      <p style={{ color: '#666' }}>Sınava ait gözetmen seanslarını, ücretlerini yönetebilir ve resmi tutanak çıktıları alabilirsiniz.</p>

      <div style={{ margin: '1.5rem 0', display: 'flex', gap: '1rem', alignItems: 'center' }} className="no-print">
        <label style={{ fontWeight: 'bold' }}>Sınav Seçin:</label>
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

        {selectedExamId && (
          <button 
            onClick={handlePrint}
            style={{ padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Yazdır / PDF Al
          </button>
        )}
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : selectedExamId ? (
        <div>
          {/* İMZA VE ÜCRET TUTANAĞI */}
          <div style={{ background: '#fff', padding: '2rem', marginBottom: '3rem', border: '1px solid #ddd', borderRadius: '6px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h3>GÖZETMEN İMZA VE ÜCRET TUTANAĞI</h3>
              <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '5px' }}>
                Sınav Adı: {examDetails?.name || examDetails?.title} | Tarih: {examDetails?.date}
              </p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }} border="1">
              <thead>
                <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                  <th style={{ padding: '10px', width: '50px' }}>Sıra</th>
                  <th style={{ padding: '10px' }}>Salon Adı</th>
                  <th style={{ padding: '10px' }}>Gözetmen Adı Soyadı</th>
                  <th style={{ padding: '10px', width: '100px' }}>Seans Sayısı</th>
                  <th style={{ padding: '10px', width: '120px' }}>Seans Ücreti (TL)</th>
                  <th style={{ padding: '10px', width: '120px' }}>Toplam Tutar</th>
                  <th style={{ padding: '10px', width: '150px' }} className="no-print">İmza</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item, idx) => {
                  const rowTotal = (parseFloat(item.sessions) || 0) * (parseFloat(item.feePerSession) || 0);
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{item.no}</td>
                      <td style={{ padding: '8px' }}>{item.roomName}</td>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{item.invigilator || 'Atanmamış'}</td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" 
                          min="1"
                          value={item.sessions}
                          onChange={(e) => handleFieldChange(idx, 'sessions', e.target.value)}
                          style={{ width: '100%', padding: '4px' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={item.feePerSession}
                          onChange={(e) => handleFieldChange(idx, 'feePerSession', e.target.value)}
                          style={{ width: '100%', padding: '4px' }}
                        />
                      </td>
                      <td style={{ padding: '8px', fontWeight: 'bold', textAlign: 'right' }}>
                        {rowTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }} className="no-print">
                        ...................
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <div className="no-print">
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'right', flex: 1 }}>
                Genel Toplam Tutar: {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </div>
            </div>

            {/* Müdür İmza Alanı */}
            <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <p style={{ margin: '0 0 40px 0', fontWeight: 'bold' }}>ONAYLAYAN</p>
                <p style={{ margin: 0, fontWeight: 'bold' }}>Hülya ERTEN</p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>Okul Müdürü</p>
              </div>
            </div>
          </div>

          {/* GÖZETMEN YOKLAMA LİSTESİ */}
          <div style={{ background: '#fff', padding: '2rem', border: '1px solid #ddd', borderRadius: '6px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h3>GÖZETMEN YOKLAMA LİSTESİ</h3>
              <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '5px' }}>
                Sınav Adı: {examDetails?.name || examDetails?.title} | Tarih: {examDetails?.date}
              </p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }} border="1">
              <thead>
                <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                  <th style={{ padding: '10px', width: '50px' }}>Sıra</th>
                  <th style={{ padding: '10px' }}>Salon</th>
                  <th style={{ padding: '10px' }}>Gözetmen Adı Soyadı</th>
                  <th style={{ padding: '10px', width: '120px', textAlign: 'center' }}>Geldi / Gelmedi</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{item.no}</td>
                    <td style={{ padding: '8px' }}>{item.roomName}</td>
                    <td style={{ padding: '8px', fontWeight: '500' }}>{item.invigilator || 'Atanmamış'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      [ &nbsp; ] Geldi &nbsp; &nbsp; [ &nbsp; ] Gelmedi
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p style={{ color: '#888' }}>Lütfen rapor oluşturmak için bir sınav seçin.</p>
      )}
    </div>
  );
};

export default Invigilators;
