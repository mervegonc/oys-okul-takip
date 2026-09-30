import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Invigilators = () => {
  const [activeTab, setActiveTab] = useState('management');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    const { data, error } = await supabase.from('exams').select('*').order('date', { ascending: false });
    if (!error && data) setExams(data);
  };

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
            font-size: 9.5pt !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          .print-container {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            font-size: 9pt !important;
            border-color: #333 !important;
          }
          th, td {
            padding: 6px 8px !important;
          }
          input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            font-size: 9pt !important;
            text-align: center !important;
          }
        }
      `}</style>

      {/* Üst Ortak Sınav Seçim Alanı (Tek Sefer Seçim) */}
      <div style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1' }} className="no-print">
        <label style={{ fontWeight: '700', color: '#1e293b', fontSize: '1rem' }}>Sınav Seç (Genel):</label>
        <select 
          value={selectedExamId} 
          onChange={(e) => setSelectedExamId(e.target.value)}
          style={{ padding: '0.65rem 1rem', width: '400px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '0.95rem', background: '#fff', fontWeight: '600' }}
        >
          <option value="">-- Lütfen Önce Bir Sınav Seçiniz --</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>
              {exam.name || exam.title || `Sınav #${exam.id}`} ({exam.date})
            </option>
          ))}
        </select>
        {selectedExamId && (
          <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: '600' }}>
            ✓ Sınav seçildi, sekmeler arasında veri kaybetmeden geçiş yapabilirsiniz.
          </span>
        )}
      </div>

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }} className="no-print">
        <button
          onClick={() => setActiveTab('management')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'management' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'management' ? '#fff' : '#475569',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          Gözetmen Yönetimi
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'payroll' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'payroll' ? '#fff' : '#475569',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          İmza ve Ücret Tutanağı
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'attendance' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'attendance' ? '#fff' : '#475569',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          Yoklama Listesi
        </button>
        <button
          onClick={() => setActiveTab('security')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'security' ? '#9333ea' : '#f1f5f9',
            color: activeTab === 'security' ? '#fff' : '#475569',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          Güvenlik Toplu Yoklama (Tarih Bazlı)
        </button>
      </div>

      {activeTab === 'management' && <InvigilatorManagement exams={exams} selectedExamId={selectedExamId} />}
      {activeTab === 'payroll' && <InvigilatorPayrollReport exams={exams} selectedExamId={selectedExamId} />}
      {activeTab === 'attendance' && <InvigilatorAttendanceReport exams={exams} selectedExamId={selectedExamId} />}
      {activeTab === 'security' && <SecurityDateAttendanceReport exams={exams} />}
    </div>
  );
};

// 1. ALT BİLEŞEN: Gözetmen Yönetimi
const InvigilatorManagement = ({ exams, selectedExamId }) => {
  const [examRooms, setExamRooms] = useState([]);
  const [newStaffRoom, setNewStaffRoom] = useState('K.G.');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffNotes, setNewStaffNotes] = useState('');
  const [invigilatorsData, setInvigilatorsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedExamId) {
      fetchExamRoomsAndInvigilators(selectedExamId);
    } else {
      setExamRooms([]);
      setInvigilatorsData({});
    }
  }, [selectedExamId]);

  const fetchExamRoomsAndInvigilators = async (examId) => {
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

    const roomIdList = Array.from(roomIds);
    let roomNamesList = [];
    if (roomIdList.length > 0) {
      const { data: roomsData } = await supabase.from('rooms').select('*').in('id', roomIdList);
      if (roomsData) {
        const roomMap = {};
        roomsData.forEach(r => {
          roomMap[r.id] = r.name || r.room_name || r.title || `Salon ${r.id.slice(0, 4)}`;
        });
        roomNamesList = [...new Set(roomIdList.map(id => roomMap[id]).filter(Boolean))];
      }
    }
    setExamRooms(roomNamesList);

    const { data: invData } = await supabase.from('exam_invigilators').select('*').eq('exam_id', examId);
    if (invData) {
      const map = {};
      invData.forEach(item => {
        map[item.room_name] = {
          invigilator: item.invigilator_name || '',
          notes: item.notes || '',
          sessions: item.sessions ?? 1,
          feePerSession: item.fee_per_session ?? 0
        };
      });
      setInvigilatorsData(map);
    } else {
      setInvigilatorsData({});
    }
    setLoading(false);
  };

  const allAssignedRoomNames = Object.keys(invigilatorsData);
  const pureExtras = allAssignedRoomNames.filter(name => !examRooms.includes(name));

  const handleInputChange = (roomName, field, value) => {
    setInvigilatorsData(prev => ({
      ...prev,
      [roomName]: {
        ...(prev[roomName] || { invigilator: '', notes: '', sessions: 1, feePerSession: 0 }),
        [field]: value
      }
    }));
  };

  const handleAddExtraStaff = () => {
    if (!newStaffName.trim()) {
      alert('Lütfen görevli adı soyadı giriniz.');
      return;
    }
    const targetName = `${newStaffRoom.trim()} - ${newStaffName.trim()}`;
    if (invigilatorsData[targetName]) {
      alert('Bu isimde zaten bir görevli eklenmiş.');
      return;
    }

    setInvigilatorsData(prev => ({
      ...prev,
      [targetName]: {
        invigilator: newStaffName.trim(),
        notes: newStaffNotes.trim(),
        sessions: 1,
        feePerSession: 0
      }
    }));
    setNewStaffName('');
    setNewStaffNotes('');
  };

  const handleRemoveStaff = (roomName) => {
    setInvigilatorsData(prev => {
      const copy = { ...prev };
      delete copy[roomName];
      return copy;
    });
  };

  const handleSaveAll = async () => {
    if (!selectedExamId) return;
    setSaving(true);

    await supabase.from('exam_invigilators').delete().eq('exam_id', selectedExamId);

    const allKeys = [...new Set([...examRooms, ...Object.keys(invigilatorsData)])];
    const recordsToInsert = allKeys.map(roomName => {
      const roomData = invigilatorsData[roomName] || { invigilator: '', notes: '', sessions: 1, feePerSession: 0 };
      if (!roomData.invigilator && !roomData.notes && examRooms.includes(roomName)) return null;

      return {
        exam_id: selectedExamId,
        room_name: roomName,
        invigilator_name: roomData.invigilator,
        notes: roomData.notes,
        sessions: parseInt(roomData.sessions) || 1,
        fee_per_session: parseFloat(roomData.feePerSession) || 0
      };
    }).filter(Boolean);

    const { error: insertError } = await supabase.from('exam_invigilators').insert(recordsToInsert);
    setSaving(false);

    if (insertError) {
      alert('Kaydedilirken hata oluştu: ' + insertError.message);
    } else {
      alert('Tüm gözetmen, kat görevlisi ve notlar başarıyla kaydedildi.');
    }
  };

  return (
    <div>
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.25rem' }}>Sınav Gözetmen ve Personel Yönetimi</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Yukarıdan seçilen sınavın salonlarına gözetmen atayabilir, salon dışı kat görevlisi (K.G.) ekleyebilirsiniz.</p>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Yükleniyor...</p>
      ) : selectedExamId ? (
        <div>
          <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#334155', width: '100%' }}>Kat Görevlisi / Salon Dışı Personel Ekle:</span>
            <input 
              type="text" 
              placeholder="Birim/Unvan (Örn: K.G., Danışma)" 
              value={newStaffRoom} 
              onChange={(e) => setNewStaffRoom(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', width: '180px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
            />
            <input 
              type="text" 
              placeholder="Adı Soyadı" 
              value={newStaffName} 
              onChange={(e) => setNewStaffName(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', width: '220px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
            />
            <input 
              type="text" 
              placeholder="Açıklama / Not" 
              value={newStaffNotes} 
              onChange={(e) => setNewStaffNotes(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', flex: 1, minWidth: '150px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
            />
            <button 
              onClick={handleAddExtraStaff}
              style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
            >
              Listeye Ekle
            </button>
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem', width: '180px' }}>Salon / Görev Yeri</th>
                  <th style={{ padding: '1rem' }}>Görevli Adı Soyadı</th>
                  <th style={{ padding: '1rem' }}>Not / Açıklama</th>
                  <th style={{ padding: '1rem', width: '80px', textAlign: 'center' }} className="no-print">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {examRooms.map((roomName, index) => {
                  const currentData = invigilatorsData[roomName] || { invigilator: '', notes: '' };
                  return (
                    <tr key={`room-${index}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
                      <td style={{ padding: '1rem', textAlign: 'center' }} className="no-print"></td>
                    </tr>
                  );
                })}

                {pureExtras.map((roomName, index) => {
                  const currentData = invigilatorsData[roomName] || { invigilator: '', notes: '' };
                  return (
                    <tr key={`extra-${index}`} style={{ borderBottom: '1px solid #f1f5f9', background: '#fdf4ff' }}>
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#9333ea' }}>{roomName}</td>
                      <td style={{ padding: '1rem' }}>
                        <input 
                          type="text" 
                          value={currentData.invigilator}
                          onChange={(e) => handleInputChange(roomName, 'invigilator', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', background: '#fff' }}
                        />
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <input 
                          type="text" 
                          value={currentData.notes}
                          onChange={(e) => handleInputChange(roomName, 'notes', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', background: '#fff' }}
                        />
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }} className="no-print">
                        <button 
                          onClick={() => handleRemoveStaff(roomName)}
                          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          Sil
                        </button>
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
              style={{ padding: '0.75rem 2rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600' }}
            >
              {saving ? 'Kaydediliyor...' : 'Tüm Görevlileri Kaydet'}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Lütfen üst kısımdan işlem yapmak istediğiniz sınavı seçin.</p>
      )}
    </div>
  );
};

// 2. ALT BİLEŞEN: İmza ve Ücret Tutanağı
const InvigilatorPayrollReport = ({ exams, selectedExamId }) => {
  const [examDetails, setExamDetails] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [globalFee, setGlobalFee] = useState('');
  const [approverSelection, setApproverSelection] = useState('hulya');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedExamId) {
      fetchReportData(selectedExamId);
      const selected = exams.find(e => e.id === selectedExamId);
      setExamDetails(selected);
    } else {
      setReportData([]);
      setExamDetails(null);
    }
  }, [selectedExamId, exams]);

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
    const allAssignedNames = [];
    if (invData) {
      invData.forEach(item => {
        allAssignedNames.push(item.room_name);
        invMap[item.room_name] = {
          invigilator: item.invigilator_name || '',
          sessions: item.sessions ?? 1,
          feePerSession: item.fee_per_session ?? 0
        };
      });
    }

    const combinedNames = [...new Set([...roomNames, ...allAssignedNames])];

    const combined = combinedNames.map((roomName, index) => ({
      no: index + 1,
      roomName,
      invigilator: invMap[roomName]?.invigilator || '',
      sessions: invMap[roomName]?.sessions ?? 1,
      feePerSession: invMap[roomName]?.feePerSession ?? 0
    }));

    setReportData(combined);
    
    if (combined.length > 0 && combined[0].feePerSession > 0) {
      setGlobalFee(combined[0].feePerSession);
    }

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
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Seçili sınavın ücret tutanağını listeleyebilir, ortak seans ücreti belirleyip yazdırabilirsiniz.</p>
      </div>

      {selectedExamId && (
        <div style={{ margin: '1.5rem 0', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ fontWeight: '600', fontSize: '0.9rem', color: '#334155' }}>Ortak Seans Ücreti (TL):</label>
            <input 
              type="number" 
              placeholder="Örn: 500"
              value={globalFee}
              onChange={(e) => handleGlobalFeeChange(e.target.value)}
              style={{ padding: '6px 10px', width: '100px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ fontWeight: '600', fontSize: '0.9rem', color: '#334155' }}>Onaylayan Yönetici:</label>
            <select 
              value={approverSelection}
              onChange={(e) => setApproverSelection(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.9rem' }}
            >
              <option value="hulya">Lise Müdürü Hülya Erten</option>
              <option value="engin">Ortaokul Müdürü Engin Nalbant</option>
              <option value="both">İkisi de (Biri Sağda, Biri Solda)</option>
            </select>
          </div>

          <button 
            onClick={() => window.print()}
            style={{ padding: '0.65rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', marginLeft: 'auto' }}
          >
            Yazdır / PDF Al
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Yükleniyor...</p>
      ) : selectedExamId ? (
        <div className="print-container" style={{ background: '#fff', padding: '2rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #1e293b', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.05em', color: '#0f172a' }}>GÖZETMEN İMZA VE ÜCRET TUTANAĞI</h3>
            <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569', margin: 0 }}>
              Sınav Adı: {examDetails?.name || examDetails?.title} &nbsp;|&nbsp; Tarih: {examDetails?.date}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem' }} border="1">
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#334155', fontSize: '0.85rem' }}>
                <th style={{ padding: '6px 8px', width: '35px', textAlign: 'center' }}>Sıra</th>
                <th style={{ padding: '6px 8px', width: '110px' }}>Salon / Görev</th>
                <th style={{ padding: '6px 8px' }}>Görevli Adı Soyadı</th>
                <th style={{ padding: '6px 8px', width: '75px', textAlign: 'center' }}>Seans</th>
                <th style={{ padding: '6px 8px', width: '120px', textAlign: 'right' }}>Toplam</th>
                <th style={{ padding: '6px 8px', width: '120px', textAlign: 'center' }}>İmza</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item, idx) => {
                const s = parseFloat(item.sessions) || 0;
                const f = parseFloat(item.feePerSession) || 0;
                const rowTotal = s * f;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>{idx + 1}</td>
                    <td style={{ padding: '6px 8px', fontWeight: '600', color: '#1e293b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{item.roomName}</td>
                    <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0f172a', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{item.invigilator || 'Atanmamış'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <input 
                        type="number" 
                        min="1"
                        value={item.sessions}
                        onChange={(e) => handleFieldChange(idx, 'sessions', e.target.value)}
                        style={{ width: '50px', padding: '3px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: '700', textAlign: 'right', color: '#0f172a', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                      {rowTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', height: '30px' }}></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }} className="no-print">
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ padding: '0.6rem 1.5rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            >
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>

          <div style={{ fontSize: '1.1rem', fontWeight: '800', textAlign: 'right', marginBottom: '2rem', color: '#0f172a' }}>
            Genel Toplam Tutar: {grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
          </div>

          <div style={{ display: 'flex', justifyContent: approverSelection === 'both' ? 'space-between' : 'flex-end', pageBreakInside: 'avoid' }}>
            {(approverSelection === 'hulya' || approverSelection === 'both') && (
              <div style={{ textAlign: 'center', width: '160px' }}>
                <p style={{ margin: '0 0 25px 0', fontWeight: '700', fontSize: '0.85rem', color: '#475569', letterSpacing: '0.05em' }}>ONAYLAYAN</p>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>Hülya ERTEN</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Lise Müdürü</p>
              </div>
            )}
            
            {(approverSelection === 'engin' || approverSelection === 'both') && (
              <div style={{ textAlign: 'center', width: '160px' }}>
                <p style={{ margin: '0 0 25px 0', fontWeight: '700', fontSize: '0.85rem', color: '#475569', letterSpacing: '0.05em' }}>ONAYLAYAN</p>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>Engin NALBANT</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Ortaokul Müdürü</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Lütfen üst kısımdan incelemek için bir sınav seçin.</p>
      )}
    </div>
  );
};

// 3. ALT BİLEŞEN: Gözetmen Yoklama Listesi
const InvigilatorAttendanceReport = ({ exams, selectedExamId }) => {
  const [examDetails, setExamDetails] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedExamId) {
      fetchReportData(selectedExamId);
      const selected = exams.find(e => e.id === selectedExamId);
      setExamDetails(selected);
    } else {
      setReportData([]);
      setExamDetails(null);
    }
  }, [selectedExamId, exams]);

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
    const allAssignedNames = [];
    if (invData) {
      invData.forEach(item => {
        allAssignedNames.push(item.room_name);
        invMap[item.room_name] = { invigilator: item.invigilator_name || '' };
      });
    }

    const combinedNames = [...new Set([...roomNames, ...allAssignedNames])];

    const combined = combinedNames.map((roomName, index) => ({
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
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Seçili sınavın salon ve kat görevlileri için yoklama çizelgesini görüntüleyebilir ve yazdırabilirsiniz.</p>
      </div>

      {selectedExamId && (
        <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'flex-end', background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }} className="no-print">
          <button 
            onClick={() => window.print()}
            style={{ padding: '0.65rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
          >
            Yazdır / PDF Al
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Yükleniyor...</p>
      ) : selectedExamId ? (
        <div className="print-container" style={{ background: '#fff', padding: '2rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #1e293b', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.05em', color: '#0f172a' }}>GÖZETMEN YOKLAMA LİSTESİ</h3>
            <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569', margin: 0 }}>
              Sınav Adı: {examDetails?.name || examDetails?.title} &nbsp;|&nbsp; Tarih: {examDetails?.date}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }} border="1">
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#334155', fontSize: '0.85rem' }}>
                <th style={{ padding: '6px 8px', width: '35px', textAlign: 'center' }}>Sıra</th>
                <th style={{ padding: '6px 8px', width: '110px' }}>Salon / Görev</th>
                <th style={{ padding: '6px 8px' }}>Görevli Adı Soyadı</th>
                <th style={{ padding: '6px 8px', width: '90px', textAlign: 'center' }}>Katıldı (+/-)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>{idx + 1}</td>
                  <td style={{ padding: '6px 8px', fontWeight: '600', color: '#1e293b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{item.roomName}</td>
                  <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0f172a', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{item.invigilator || 'Atanmamış'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', height: '30px', color: '#64748b', fontSize: '0.9rem' }}>
                    [ &nbsp; &nbsp; &nbsp; &nbsp; ]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Lütfen üst kısımdan bir sınav seçin.</p>
      )}
    </div>
  );
};

// 4. ALT BİLEŞEN: Güvenlik İçin Tarihe Göre Çoklu Sınav Toplu Listesi
const SecurityDateAttendanceReport = ({ exams }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [combinedReportList, setCombinedReportList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sistemdeki benzersiz tarihleri bul
  const uniqueDates = [...new Set(exams.map(e => e.date))].filter(Boolean).sort();

  // Tarih seçildiğinde o tarihteki sınavları otomatik listele
  const examsForSelectedDate = exams.filter(e => e.date === selectedDate);

  const handleToggleExamSelection = (examId) => {
    setSelectedExamIds(prev => 
      prev.includes(examId) ? prev.filter(id => id !== examId) : [...prev, examId]
    );
  };

  const handleSelectAllForDate = () => {
    if (selectedExamIds.length === examsForSelectedDate.length) {
      setSelectedExamIds([]);
    } else {
      setSelectedExamIds(examsForSelectedDate.map(e => e.id));
    }
  };

  const handleGenerateReport = async () => {
    if (selectedExamIds.length === 0) {
      alert('Lütfen en az bir sınav seçin.');
      return;
    }
    setLoading(true);
    let masterList = [];

    for (const examId of selectedExamIds) {
      const currentExam = exams.find(e => e.id === examId);
      const examTitle = currentExam?.name || currentExam?.title || `Sınav #${examId}`;
      const examTime = currentExam?.time || currentExam?.start_time || '';

      // Salon ID'leri ve İsimleri
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

      // Gözetmen Bilgileri
      const { data: invData } = await supabase.from('exam_invigilators').select('*').eq('exam_id', examId);
      const invMap = {};
      const allAssignedNames = [];
      if (invData) {
        invData.forEach(item => {
          allAssignedNames.push(item.room_name);
          invMap[item.room_name] = item.invigilator_name || '';
        });
      }

      const combinedNames = [...new Set([...roomNames, ...allAssignedNames])];

      combinedNames.forEach(roomName => {
        masterList.push({
          examName: examTitle,
          examTime: examTime,
          roomName: roomName,
          invigilator: invMap[roomName] || 'Atanmamış'
        });
      });
    }

    setCombinedReportList(masterList);
    setLoading(false);
  };

  return (
    <div>
      <div className="no-print" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.25rem' }}>Güvenlik Kapı Giriş / Yoklama Listesi (Çoklu Sınav)</h2>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Belirli bir tarihteki birden fazla sınavı seçerek kapıdaki güvenliğe tek bir toplu liste verebilirsiniz.</p>
      </div>

      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }} className="no-print">
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#334155' }}>1. Tarih Seçin:</label>
            <select 
              value={selectedDate} 
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedExamIds([]);
                setCombinedReportList([]);
              }}
              style={{ padding: '0.65rem 1rem', width: '220px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '600' }}
            >
              <option value="">-- Tarih Seçiniz --</option>
              {uniqueDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>

          {selectedDate && (
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: '600', color: '#334155' }}>2. Bu Tarihteki Sınavları Seçin (Birden Fazla Seçilebilir):</label>
                <button 
                  onClick={handleSelectAllForDate}
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                >
                  {selectedExamIds.length === examsForSelectedDate.length ? 'Tümünün Seçimini Kaldır' : 'Tümünü Seç'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {examsForSelectedDate.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Bu tarihte kayıtlı sınav bulunamadı.</p>
                ) : (
                  examsForSelectedDate.map(exam => {
                    const isSelected = selectedExamIds.includes(exam.id);
                    return (
                      <button
                        key={exam.id}
                        onClick={() => handleToggleExamSelection(exam.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: isSelected ? '#eff6ff' : '#f8fafc',
                          color: isSelected ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.9rem'
                        }}
                      >
                        {isSelected ? '✓ ' : ''}{exam.name || exam.title} {exam.time ? `(${exam.time})` : ''}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {selectedExamIds.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button 
              onClick={handleGenerateReport}
              style={{ padding: '0.75rem 1.5rem', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem' }}
            >
              Toplu Güvenlik Listesini Oluştur
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Liste derleniyor...</p>
      ) : combinedReportList.length > 0 ? (
        <div className="print-container" style={{ background: '#fff', padding: '2rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }} className="no-print">
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Oluşturulan Güvenlik Toplu Listesi ({selectedDate})</h3>
            <button 
              onClick={() => window.print()}
              style={{ padding: '0.65rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            >
              Yazdır / PDF Al
            </button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #1e293b', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.05em', color: '#0f172a' }}>KAPI GÜVENLİK VE GÖZETMEN TOPLU YOKLAMA LİSTESİ</h3>
            <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569', margin: 0 }}>
              Tarih: {selectedDate} &nbsp;|&nbsp; Seçilen Sınav Sayısı: {selectedExamIds.length}
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }} border="1">
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#334155', fontSize: '0.85rem' }}>
                <th style={{ padding: '6px 8px', width: '35px', textAlign: 'center' }}>Sıra</th>
                <th style={{ padding: '6px 8px', width: '180px' }}>Sınav Adı</th>
                <th style={{ padding: '6px 8px', width: '110px' }}>Salon / Görev Yeri</th>
                <th style={{ padding: '6px 8px' }}>Görevli Adı Soyadı</th>
                <th style={{ padding: '6px 8px', width: '80px', textAlign: 'center' }}>Giriş / İmza</th>
              </tr>
            </thead>
            <tbody>
              {combinedReportList.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>{idx + 1}</td>
                  <td style={{ padding: '6px 8px', fontWeight: '600', color: '#1e293b', fontSize: '0.85rem' }}>{item.examName} {item.examTime ? `(${item.examTime})` : ''}</td>
                  <td style={{ padding: '6px 8px', fontWeight: '600', color: '#334155', fontSize: '0.85rem' }}>{item.roomName}</td>
                  <td style={{ padding: '6px 8px', color: '#0f172a', fontSize: '0.85rem' }}>{item.invigilator}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', height: '30px' }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        selectedDate && <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Yukarıdan sınavları seçip "Toplu Güvenlik Listesini Oluştur" butonuna basın.</p>
      )}
    </div>
  );
};

export default Invigilators;
