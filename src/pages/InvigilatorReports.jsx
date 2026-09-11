import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const InvigilatorReports = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examDetails, setExamDetails] = useState(null);
  const [reportData, setReportData] = useState([]); // [{ roomName, invigilatorName, sessions, feePerSession }]
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

    // 1. Önce bu sınavın salonlarını seating_plans ve rooms tablosundan bulalım
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

    // 2. Daha önce kaydedilmiş gözetmen, seans ve ücret bilgilerini çekelim
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

    // Salonları liste yapısına dönüştürelim
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

    // Eski kayıtları temizle ve güncelleri ekle
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

  // Toplam Tutar Hesabı
  const grandTotal = reportData.reduce((acc, curr) => {
    const s = parseFloat(curr.sessions) || 0;
    const f = parseFloat(curr.feePerSession) || 0;
    return acc + (s * f);
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Gözetmen İmza, Ücret ve Yoklama Raporları</h2>
      <p style={{ color: '#666' }}>Sınava ait gözetmen seanslarını, ücretlerini yönetebilir ve resmi tutanak çıktıları alabilirsiniz.</p>

      {/* Sınav Seçimi */}
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

export default InvigilatorReports;
