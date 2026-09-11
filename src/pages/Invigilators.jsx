import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Invigilators = () => {
  const [activeTab, setActiveTab] = useState('management');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @media print {
          .no-print, nav, header, aside, .sidebar {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 10pt !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          div {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            font-size: 9.5pt !important;
          }
          th, td {
            padding: 4px 6px !important;
          }
        }
      `}</style>

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
          onClick={() => setActiveTab('payroll')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'payroll' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'payroll' ? '#fff' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}
        >
          İmza ve Ücret Tutanağı
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'attendance' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'attendance' ? '#fff' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}
        >
          Yoklama Listesi
        </button>
      </div>

      {activeTab === 'management' && <InvigilatorManagement />}
      {activeTab === 'payroll' && <InvigilatorPayrollReport />}
      {activeTab === 'attendance' && <InvigilatorAttendanceReport />}
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

    await supabase.from('exam_invigilators').delete().eq('exam_id', selectedExamId);

    const recordsToInsert = examRooms.map(roomName => {
      const roomData = invigilatorsData[roomName] || { invigilator: '', notes: '' };
      return {
        exam_id: selectedExamId,
        room_name: roomName,
        invigilator_name: roomData.invigilator,
        notes: roomData.notes
      };
    });

    const { error: insertError } = await supabase.from('exam_invigilators').insert(recordsToInsert);
    setSaving(false);

    if (insertError) {
      alert('Kaydedilirken hata oluştu: ' + insertError.message);
    } else {
      alert('Tüm gözetmen bilgileri ve notlar başarıyla kaydedildi.');
    }
  };

  return (
    <div>
      <div className="no-print">
        <h2>Sınav Gözetmen Yönetimi</h2>
        <p style={{ color: '#666' }}>Sınav seçerek salonlara gözetmen ve not ekleyebilir, tek tıkla kaydedebilirsiniz.</p>
      </div>

      <div style={{ margin: '1.5rem 0' }} className="no-print">
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
                          placeholder="Notlar"
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

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }} className="no-print">
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
          <p style={{ color: '#888', marginTop: '1rem' }}>Bu sınava ait oturum/salon planı bulunamadı.</p>
        )
      ) : (
        <p style={{ color: '#888', marginTop: '1rem' }}>Lütfen işlem yapmak istediğiniz sınavı seçin.</p>
      )}
    </div>
  );
};

// 2. ALT BİLEŞEN: İmza ve Ücret Tutanağı
const InvigilatorPayrollReport = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examDetails, setExamDetails] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [globalFee, setGlobalFee] = useState('');
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

    const { data: seatingData } = await supabase.from('seating_plans').select('assignments').eq('exam_id', examId);
    const roomIds = new Set();
    if (seatingData) {
      seatingData.forEach(row => {
        if (Array.isArray(row.assignments)) {
          row.assignments.forEach(item => { if (item.room_id) roomIds.add(item.room_id); });
        }
      });
    }

    let roomNames = [];
    if (roomIds.size > 0) {
      const { data: roomsData } = await supabase.from('rooms').select('*').in('id', Array.from(roomIds));
      if (roomsData) {
        const roomMap = {};
        roomsData.forEach(r => { roomMap[r.id] = r.name || r.room_name || r.title || `Salon ${r.id.slice(0, 4)}`; });
        roomNames = [...new Set(Array.from(roomIds).map(id => roomMap[id]).filter(Boolean))];
      }
    }

    const { data: invData } = await supabase.from('exam_invigilators').select('*').eq('exam_id', examId);
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

  const handleGlobalFeeChange = (value) => {
    setGlobalFee(value);
    const numericValue = parseFloat(value) || 0;
    const updated = reportData.map(item => ({
      ...item,
      feePerSession: numericValue
    }));
    setReportData(updated);
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
      alert('Ücret ve seans bilgileri kaydedildi.');
    }
  };

  const grandTotal = reportData.reduce((acc, curr) => {
    const s = parseFloat(curr.sessions) || 0;
    const f = parseFloat(curr.feePerSession) || 0;
    return acc + (s * f);
  }, 0);

  return (
    <div>
      <div className="no-print">
        <h2>Gözetmen İmza ve Ücret Tutanağı</h2>
        <p style={{ color: '#666' }}>Bu sayfadan sınav ücret tutanağını listeleyebilir ve doğrudan yazdırabilirsiniz.</p>
      </div>

      <div style={{ margin: '1.5rem 0', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Sınav Seçin:</label>
          <select 
            value={selectedExamId} 
            onChange={(e) => setSelectedExamId(e.target.value)}
            style={{ padding: '0.5rem', width: '250px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">-- Sınav Seçiniz --</option>
            {exams.map(exam => (
              <option key={exam.id} value={exam.id}>
                {exam.name || exam.title || `Sınav #${exam.id}`} ({exam.date})
              </option>
            ))}
          </select>
        </div>

        {selectedExamId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f3f5', padding: '6px 12px', borderRadius: '4px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Ortak Seans Ücreti (TL):</label>
            <input 
              type="number" 
              placeholder="Örn: 250"
              value={globalFee}
              onChange={(e) => handleGlobalFeeChange(e.target.value)}
              style={{ padding: '6px', width: '100px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        )}

        {selectedExamId && (
          <button 
            onClick={() => window.print()}
            style={{ padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Yazdır / PDF Al
          </button>
        )}
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : selectedExamId ? (
        <div style={{ background: '#fff', padding: '1rem', border: '1px solid #ddd', borderRadius: '6px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 5px 0' }}>GÖZETMEN İMZA VE ÜCRET TUTANAĞI</h3>
            <p style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
              Sınav Adı: {examDetails?.name || examDetails?.title} | Tarih: {examDetails?.date}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }} border="1">
            <thead>
              <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                <th style={{ padding: '8px', width: '40px' }}>Sıra</th>
                <th style={{ padding: '8px' }}>Salon Adı</th>
                <th style={{ padding: '8px' }}>Gözetmen Adı Soyadı</th>
                <th style={{ padding: '8px', width: '80px' }} className="no-print">Seans</th>
                <th style={{ padding: '8px', width: '100px' }} className="no-print">Seans Ücreti</th>
                <th style={{ padding: '8px', width: '100px' }}>Toplam Tutar</th>
                <th style={{ padding: '8px', width: '120px' }}>İmza</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item, idx) => {
                const rowTotal = (parseFloat(item.sessions) || 0) * (parseFloat(item.feePerSession) || 0);
                return (
                  <tr key={idx}>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{item.no}</td>
                    <td style={{ padding: '6px' }}>{item.roomName}</td>
                    <td style={{ padding: '6px', fontWeight: '500' }}>{item.invigilator || 'Atanmamış'}</td>
                    <td style={{ padding: '6px' }} className="no-print">
                      <input 
                        type="number" 
                        min="1"
                        value={item.sessions}
                        onChange={(e) => handleFieldChange(idx, 'sessions', e.target.value)}
                        style={{ width: '100%', padding: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }} className="no-print">
                      <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={item.feePerSession}
                        onChange={(e) => handleFieldChange(idx, 'feePerSession', e.target.value)}
                        style={{ width: '100%', padding: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '6px', fontWeight: 'bold', textAlign: 'right' }}>
                      {rowTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center', height: '28px' }}></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }} className="no-print">
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>

          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', textAlign: 'right', marginBottom: '1.5rem' }}>
            Genel Toplam Tutar: {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
          </div>

          {/* Müdür İmza Alanı */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: '180px' }}>
              <p style={{ margin: '0 0 20px 0', fontWeight: 'bold' }}>ONAYLAYAN</p>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Hülya ERTEN</p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}>Okul Müdürü</p>
            </div>
          </div>
        </div>
      ) : (
        <p style={{ color: '#888' }}>Lütfen incelemek için bir sınav seçin.</p>
      )}
    </div>
  );
};

// 3. ALT BİLEŞEN: Gözetmen Yoklama Listesi
const InvigilatorAttendanceReport = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examDetails, setExamDetails] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

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

    const { data: seatingData } = await supabase.from('seating_plans').select('assignments').eq('exam_id', examId);
    const roomIds = new Set();
    if (seatingData) {
      seatingData.forEach(row => {
        if (Array.isArray(row.assignments)) {
          row.assignments.forEach(item => { if (item.room_id) roomIds.add(item.room_id); });
        }
      });
    }

    let roomNames = [];
    if (roomIds.size > 0) {
      const { data: roomsData } = await supabase.from('rooms').select('*').in('id', Array.from(roomIds));
      if (roomsData) {
        const roomMap = {};
        roomsData.forEach(r => { roomMap[r.id] = r.name || r.room_name || r.title || `Salon ${r.id.slice(0, 4)}`; });
        roomNames = [...new Set(Array.from(roomIds).map(id => roomMap[id]).filter(Boolean))];
      }
    }

    const { data: invData } = await supabase.from('exam_invigilators').select('*').eq('exam_id', examId);
    const invMap = {};
    if (invData) {
      invData.forEach(item => {
        invMap[item.room_name] = { invigilator: item.invigilator_name || '' };
      });
    }

    const combined = roomNames.map((roomName, index) => ({
      no: index + 1,
      roomName,
      invigilator: invMap[roomName]?.invigilator || ''
    }));

    setReportData(combined);
    setLoading(false);
  };

  return (
    <div>
      <div className="no-print">
        <h2>Gözetmen Yoklama Listesi</h2>
        <p style={{ color: '#666' }}>Bu sayfadan sınav gözetmen yoklama çizelgesini alabilirsiniz.</p>
      </div>

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
            onClick={() => window.print()}
            style={{ padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Yazdır / PDF Al
          </button>
        )}
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : selectedExamId ? (
        <div style={{ background: '#fff', padding: '1rem', border: '1px solid #ddd', borderRadius: '6px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 5px 0' }}>GÖZETMEN YOKLAMA LİSTESİ</h3>
            <p style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
              Sınav Adı: {examDetails?.name || examDetails?.title} | Tarih: {examDetails?.date}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }} border="1">
            <thead>
              <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                <th style={{ padding: '8px', width: '40px' }}>Sıra</th>
                <th style={{ padding: '8px' }}>Salon</th>
                <th style={{ padding: '8px' }}>Gözetmen Adı Soyadı</th>
                <th style={{ padding: '8px', width: '100px', textAlign: 'center' }}>+ / -</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{item.no}</td>
                  <td style={{ padding: '6px' }}>{item.roomName}</td>
                  <td style={{ padding: '6px', fontWeight: '500' }}>{item.invigilator || 'Atanmamış'}</td>
                  <td style={{ padding: '6px', textAlign: 'center', height: '28px' }}>
                    [ &nbsp; &nbsp; &nbsp; &nbsp; ]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: '#888' }}>Lütfen yoklama listesi için bir sınav seçin.</p>
      )}
    </div>
  );
};

export default Invigilators;
