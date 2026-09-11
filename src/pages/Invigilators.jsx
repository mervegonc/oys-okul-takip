import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Invigilators = () => {
  const [activeTab, setActiveTab] = useState('management');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @media print {
          .no-print, nav, header, aside, .sidebar {
            display: none !important;
          }
          body {
            background: white !important;
            color: #1a1a1a !important;
            font-size: 10pt !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .print-container {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            font-size: 9.5pt !important;
            border-color: #333 !important;
          }
          th, td {
            padding: 6px 8px !important;
          }
        }
      `}</style>

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '2rem' }} className="no-print">
        <button
          onClick={() => setActiveTab('management')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'management' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'management' ? '#fff' : '#475569',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
            transition: 'all 0.2s'
          }}
        >
          Gözetmen Yönetimi
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'payroll' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'payroll' ? '#fff' : '#475569',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
            transition: 'all 0.2s'
          }}
        >
          İmza ve Ücret Tutanağı
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'attendance' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'attendance' ? '#fff' : '#475569',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
            transition: 'all 0.2s'
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
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.25rem' }}>Sınav Gözetmen Yönetimi</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Sınav seçerek salonlara gözetmen ve not ataması yapabilirsiniz.</p>
      </div>

      <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem', background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} className="no-print">
        <label style={{ fontWeight: '600', color: '#334155' }}>Sınav Seçin:</label>
        <select 
          value={selectedExamId} 
          onChange={(e) => setSelectedExamId(e.target.value)}
          style={{ padding: '0.65rem 1rem', width: '350px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', background: '#f8fafc' }}
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
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Yükleniyor...</p>
      ) : selectedExamId ? (
        examRooms.length > 0 ? (
          <div>
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem' }}>Salon Adı</th>
                    <th style={{ padding: '1rem' }}>Gözetmen Adı Soyadı</th>
                    <th style={{ padding: '1rem' }}>Gözetmenlik Notu / Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {examRooms.map((roomName, index) => {
                    const currentData = invigilatorsData[roomName] || { invigilator: '', notes: '' };
                    return (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', fontWeight: '600', color: '#1e293b' }}>{roomName}</td>
                        <td style={{ padding: '1rem' }}>
                          <input 
                            type="text" 
                            placeholder="Gözetmen Adı Soyadı"
                            value={currentData.invigilator}
                            onChange={(e) => handleInputChange(roomName, 'invigilator', e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                          />
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <input 
                            type="text" 
                            placeholder="Notlar ekleyin..."
                            value={currentData.notes}
                            onChange={(e) => handleInputChange(roomName, 'notes', e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }} className="no-print">
              <button 
                onClick={handleSaveAll}
                disabled={saving}
                style={{ padding: '0.75rem 2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              >
                {saving ? 'Kaydediliyor...' : 'Tüm Gözetmenleri Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Bu sınava ait oturum veya salon planı bulunamadı.</p>
        )
      ) : (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Lütfen işlem yapmak istediğiniz sınavı seçin.</p>
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
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.25rem' }}>Gözetmen İmza ve Ücret Tutanağı</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Sınav ücret tutanağını listeleyebilir, seans ve ücretleri düzenleyip yazdırabilirsiniz.</p>
      </div>

      <div style={{ margin: '1.5rem 0', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} className="no-print">
        <div>
          <label style={{ fontWeight: '600', marginRight: '0.5rem', color: '#334155' }}>Sınav Seçin:</label>
          <select 
            value={selectedExamId} 
            onChange={(e) => setSelectedExamId(e.target.value)}
            style={{ padding: '0.65rem 1rem', width: '250px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', background: '#f8fafc' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ fontWeight: '600', fontSize: '0.9rem', color: '#334155' }}>Ortak Seans Ücreti (TL):</label>
            <input 
              type="number" 
              placeholder="Örn: 250"
              value={globalFee}
              onChange={(e) => handleGlobalFeeChange(e.target.value)}
              style={{ padding: '6px 10px', width: '100px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
            />
          </div>
        )}

        {selectedExamId && (
          <button 
            onClick={() => window.print()}
            style={{ padding: '0.65rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', marginLeft: 'auto', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            Yazdır / PDF Al
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Yükleniyor...</p>
      ) : selectedExamId ? (
        <div className="print-container" style={{ background: '#fff', padding: '2.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #1e293b', paddingBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.25rem', fontWeight: '800', letterSpacing: '0.05em', color: '#0f172a' }}>GÖZETMEN İMZA VE ÜCRET TUTANAĞI</h3>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#475569', margin: 0 }}>
              Sınav Adı: {examDetails?.name || examDetails?.title} &nbsp;|&nbsp; Tarih: {examDetails?.date}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }} border="1">
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#334155', fontSize: '0.9rem' }}>
                <th style={{ padding: '10px', width: '45px', textAlign: 'center' }}>Sıra</th>
                <th style={{ padding: '10px' }}>Salon Adı</th>
                <th style={{ padding: '10px' }}>Gözetmen Adı Soyadı</th>
                <th style={{ padding: '10px', width: '75px', textAlign: 'center' }}>Seans</th>
                <th style={{ padding: '10px', width: '100px', textAlign: 'right' }}>Seans Ücreti</th>
                <th style={{ padding: '10px', width: '110px', textAlign: 'right' }}>Toplam Tutar</th>
                <th style={{ padding: '10px', width: '130px', textAlign: 'center' }}>İmza</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item, idx) => {
                const rowTotal = (parseFloat(item.sessions) || 0) * (parseFloat(item.feePerSession) || 0);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{item.no}</td>
                    <td style={{ padding: '8px', fontWeight: '500', color: '#1e293b' }}>{item.roomName}</td>
                    <td style={{ padding: '8px', fontWeight: '600', color: '#0f172a' }}>{item.invigilator || 'Atanmamış'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span className="no-print" style={{ display: 'inline-block', width: '100%' }}>
                        <input 
                          type="number" 
                          min="1"
                          value={item.sessions}
                          onChange={(e) => handleFieldChange(idx, 'sessions', e.target.value)}
                          style={{ width: '50px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      </span>
                      <span style={{ display: 'none' }} className="print-only">{item.sessions}</span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <span className="no-print" style={{ display: 'inline-block', width: '100%' }}>
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={item.feePerSession}
                          onChange={(e) => handleFieldChange(idx, 'feePerSession', e.target.value)}
                          style={{ width: '80px', padding: '4px', textAlign: 'right', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      </span>
                      <span style={{ display: 'none' }} className="print-only">{Number(item.feePerSession).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                    </td>
                    <td style={{ padding: '8px', fontWeight: '700', textAlign: 'right', color: '#0f172a' }}>
                      {rowTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', height: '32px' }}></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }} className="no-print">
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ padding: '0.6rem 1.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>

          <div style={{ fontSize: '1.2rem', fontWeight: '800', textAlign: 'right', marginBottom: '2.5rem', color: '#0f172a' }}>
            Genel Toplam Tutar: {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
          </div>

          {/* Müdür İmza Alanı */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: '180px' }}>
              <p style={{ margin: '0 0 35px 0', fontWeight: '700', fontSize: '0.9rem', color: '#475569', letterSpacing: '0.05em' }}>ONAYLAYAN</p>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem', color: '#0f172a' }}>Hülya ERTEN</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Okul Müdürü</p>
            </div>
          </div>
        </div>
      ) : (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Lütfen incelemek için bir sınav seçin.</p>
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
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.25rem' }}>Gözetmen Yoklama Listesi</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Sınav salonları için gözetmen yoklama çizelgesini görüntüleyebilir ve yazdırabilirsiniz.</p>
      </div>

      <div style={{ margin: '1.5rem 0', display: 'flex', gap: '1rem', alignItems: 'center', background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} className="no-print">
        <label style={{ fontWeight: '600', color: '#334155' }}>Sınav Seçin:</label>
        <select 
          value={selectedExamId} 
          onChange={(e) => setSelectedExamId(e.target.value)}
          style={{ padding: '0.65rem 1rem', width: '350px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', background: '#f8fafc' }}
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
            style={{ padding: '0.65rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', marginLeft: 'auto', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            Yazdır / PDF Al
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Yükleniyor...</p>
      ) : selectedExamId ? (
        <div className="print-container" style={{ background: '#fff', padding: '2.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #1e293b', paddingBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.25rem', fontWeight: '800', letterSpacing: '0.05em', color: '#0f172a' }}>GÖZETMEN YOKLAMA LİSTESİ</h3>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#475569', margin: 0 }}>
              Sınav Adı: {examDetails?.name || examDetails?.title} &nbsp;|&nbsp; Tarih: {examDetails?.date}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }} border="1">
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#334155', fontSize: '0.9rem' }}>
                <th style={{ padding: '10px', width: '45px', textAlign: 'center' }}>Sıra</th>
                <th style={{ padding: '10px' }}>Salon</th>
                <th style={{ padding: '10px' }}>Gözetmen Adı Soyadı</th>
                <th style={{ padding: '10px', width: '100px', textAlign: 'center' }}>Katıldı (+/-)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>{item.no}</td>
                  <td style={{ padding: '10px', fontWeight: '500', color: '#1e293b' }}>{item.roomName}</td>
                  <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>{item.invigilator || 'Atanmamış'}</td>
                  <td style={{ padding: '10px', textAlign: 'center', height: '35px', color: '#64748b' }}>
                    [ &nbsp; &nbsp; &nbsp; &nbsp; ]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Lütfen yoklama listesi için bir sınav seçin.</p>
      )}
    </div>
  );
};

export default Invigilators;
