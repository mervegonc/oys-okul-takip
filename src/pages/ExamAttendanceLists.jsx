import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

const ExamAttendanceLists = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [seatingPlan, setSeatingPlan] = useState(null);
  const [studentsData, setStudentsData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filtreler ve Ayarlar
  const [listType, setListType] = useState('classroom'); // 'classroom' | 'surname'
  const [examCategory, setExamCategory] = useState('academic'); // 'academic' | 'lang_high' | 'lang_middle' | 'written_middle'
  const [sessionType, setSessionType] = useState('sozel'); // 'sozel' | 'sayisal' (Ortaokul akademik için)
  const [showTC, setShowTC] = useState(false);
  const [invigilatorName, setInvigilatorName] = useState('');

  useEffect(() => {
    fetchExams();
    fetchStudents();
  }, []);

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (!error && data) setExams(data);
    } catch (err) {
      console.error('Sınavlar çekilemedi:', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase.from('students').select('*');
      if (!error && data) setStudentsData(data);
    } catch (err) {
      console.warn('Öğrenci detayları okunamadı:', err);
    }
  };

  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    setLoading(true);
    try {
      const { data: planData, error: planErr } = await supabase
        .from('seating_plans')
        .select('*')
        .eq('exam_id', exam.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (planErr) throw planErr;

      const plan = planData ? planData[0] : null;
      if (plan && typeof plan.assignments === 'string') {
        plan.assignments = JSON.parse(plan.assignments);
      }
      setSeatingPlan(plan);
    } catch (err) {
      console.error('Plan çekilemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  // Öğrenci Bilgisini Veritabanı ile Harmanlama (TC, Alan, Yabancı Dil vb.)
  const getEnrichedAssignments = () => {
    if (!seatingPlan?.assignments) return [];
    
    return seatingPlan.assignments.map(item => {
      const stId = String(item.studentId ?? item.student_id ?? item.id);
      const dbSt = studentsData.find(s => String(s.id) === stId || String(s.student_number) === String(item.studentNumber));

      const firstName = item.first_name || dbSt?.first_name || '';
      const lastName = item.last_name || dbSt?.last_name || '';
      const fullName = item.studentName || item.student_name || `${firstName} ${lastName}`.trim();

      return {
        ...item,
        tc: item.tc || dbSt?.tc_no || dbSt?.tc || '---',
        studentNumber: item.studentNumber || item.student_number || dbSt?.student_number || '---',
        firstName: firstName || fullName.split(' ')[0],
        lastName: lastName || fullName.split(' ').slice(1).join(' '),
        fullName,
        track: item.track || dbSt?.track || dbSt?.field || 'TM', // TM / MF
        langLevel: item.langLevel || dbSt?.lang_level || 'Core', // Core / Ext
        secondLang: item.secondLang || dbSt?.second_lang || 'Almanca', // Almanca / Fransızca / İspanyolca
        grade: item.grade || dbSt?.grade || '9',
        className: item.class || item.className || dbSt?.class_name || 'A',
        roomName: item.roomName || item.room_name || item.salon || `Salon ${item.roomId || 1}`
      };
    });
  };

  const enrichedAssignments = getEnrichedAssignments();

  // Salonlara Göre Gruplama
  const groupByRoom = (data) => {
    const groups = {};
    data.forEach(st => {
      const room = st.roomName || 'Salon 1';
      if (!groups[room]) groups[room] = [];
      groups[room].push(st);
    });
    return groups;
  };

  // Soyadına Göre Türkçe Alfabetik Sıralama
  const getSortedByLastName = (data) => {
    return [...data].sort((a, b) => {
      const lastNameA = a.lastName || '';
      const lastNameB = b.lastName || '';
      return lastNameA.localeCompare(lastNameB, 'tr', { sensitivity: 'base' });
    });
  };

  // Excel Dışarı Aktarma İşlevi
  const exportToExcel = () => {
    if (!selectedExam) return;

    let exportData = [];

    if (listType === 'surname') {
      const sorted = getSortedByLastName(enrichedAssignments);
      exportData = sorted.map((st, idx) => ({
        'Sıra No': idx + 1,
        'Soyadı': st.lastName,
        'Adı': st.firstName,
        'Sınıf/Şube': `${st.grade}-${st.className}`,
        'Salon No': st.roomName,
        'Sıra No (Salon)': st.seatNumber || (idx + 1)
      }));
    } else {
      exportData = enrichedAssignments.map((st, idx) => {
        const row = {
          'Sıra No': idx + 1,
          'Salon': st.roomName,
          'Sıra No (Salon)': st.seatNumber || (idx + 1),
          'Öğrenci Adı Soyadı': st.fullName,
          'Sınıf/Şube': `${st.grade}-${st.className}`
        };
        if (showTC) row['TC Kimlik No'] = st.tc;
        if (examCategory !== 'written_middle') row['Öğrenci No'] = st.studentNumber;
        return row;
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Yoklama Listesi');
    XLSX.writeFile(workbook, `${selectedExam.title}_Yoklama_Listesi.xlsx`);
  };

  const groupedRooms = groupByRoom(enrichedAssignments);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Baskı Stilleri (Ctrl+P Ayarları) */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-page {
            page-break-after: always !important;
            break-after: page !important;
            padding: 15mm !important;
            box-sizing: border-box !important;
            min-height: 98vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          table {
            font-size: 11px !important;
          }
          th, td {
            padding: 4px 6px !important;
          }
        }
      `}</style>

      {/* --- EKRAN KONTROL PANELİ (Baskıda Gizlenir) --- */}
      <div className="no-print" style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <h2>🖨️ Sınav Yoklama Listesi Hazırlama & Çıktı Modülü</h2>

        {/* Sınav Seçimi */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Sınav Seçin:</label>
          <select 
            style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ccc' }}
            onChange={(e) => {
              const exam = exams.find(x => String(x.id) === e.target.value);
              if (exam) handleSelectExam(exam);
            }}
          >
            <option value="">-- Bir Sınav Seçiniz --</option>
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title} ({ex.date})</option>
            ))}
          </select>
        </div>

        {selectedExam && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
            
            {/* Liste Tipi */}
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.85rem' }}>Liste Tipi:</label>
              <select 
                value={listType} 
                onChange={(e) => setListType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="classroom">Sınıf/Salon Yoklama Listesi</option>
                <option value="surname">Soyad Sıralı Liste (A-Z)</option>
              </select>
            </div>

            {/* Sınav Kategorisi */}
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.85rem' }}>Sınav Türü/Kategorisi:</label>
              <select 
                value={examCategory} 
                onChange={(e) => setExamCategory(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="academic">Akademik Sınav (Lise / Ortaokul)</option>
                <option value="lang_high">Yabancı Dil Sınavı (Lise)</option>
                <option value="lang_middle">Yabancı Dil Sınavı (Ortaokul)</option>
                <option value="written_middle">Ortaokul Yazılı Sınavı (Sınıf İçi)</option>
              </select>
            </div>

            {/* Oturum Seçimi (Sadece Akademik Ortaokul İçin) */}
            {examCategory === 'academic' && (
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.85rem' }}>Oturum (Başlık):</label>
                <select 
                  value={sessionType} 
                  onChange={(e) => setSessionType(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="sozel">Sözel Oturumu</option>
                  <option value="sayisal">Sayısal Oturumu</option>
                  <option value="tek">Tek Oturum (Lise)</option>
                </select>
              </div>
            )}

            {/* Gözetmen Adı (İsteğe Bağlı) */}
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.85rem' }}>Gözetmen Adı Soyadı (İsteğe Bağlı):</label>
              <input 
                type="text" 
                placeholder="Örn: Ahmet Yılmaz"
                value={invigilatorName}
                onChange={(e) => setInvigilatorName(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            {/* Butonlar */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              {examCategory === 'academic' && listType === 'classroom' && (
                <button 
                  onClick={() => setShowTC(!showTC)}
                  style={{ padding: '0.5rem 0.8rem', background: showTC ? '#2b6cb0' : '#4a5568', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  {showTC ? '🔒 TC Gizle' : '🪪 TC Göster'}
                </button>
              )}

              <button 
                onClick={exportToExcel}
                style={{ padding: '0.5rem 0.8rem', background: '#276749', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
              >
                📊 Excel'e Aktar
              </button>

              <button 
                onClick={() => window.print()}
                style={{ padding: '0.5rem 1rem', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
              >
                🖨️ Çıktı Al (Ctrl+P)
              </button>
            </div>

          </div>
        )}
      </div>

      {/* --- BASKI ALANI (PRINT TEMPLATE) --- */}
      {selectedExam && (
        <div id="print-area">
          
          {/* ======================= 1. SOYAD SIRALI LİSTE ======================= */}
          {listType === 'surname' && (
            <div className="print-page" style={{ background: '#fff', border: '1px solid #ccc', padding: '1.5rem' }}>
              
              {/* Başlık */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', pb: '0.5rem', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', textTransform: 'uppercase' }}>{selectedExam.title}</h2>
                <h4 style={{ margin: '0.3rem 0', color: '#333' }}>SOYAD SIRALI ÖĞRENCİ SINAV SALON LİSTESİ</h4>
                <span style={{ fontSize: '0.85rem' }}>Tarih: {selectedExam.date || new Date().toLocaleDateString('tr-TR')}</span>
              </div>

              {/* Tablo */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }} border="1">
                <thead>
                  <tr style={{ background: '#f2f2f2', textAlign: 'center' }}>
                    <th style={{ width: '50px', padding: '6px' }}>Sıra</th>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Öğrenci Soyadı</th>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Öğrenci Adı</th>
                    <th style={{ padding: '6px' }}>Sınıf/Şube</th>
                    <th style={{ padding: '6px' }}>Atandığı Salon</th>
                    <th style={{ padding: '6px' }}>Sıra No</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedByLastName(enrichedAssignments).map((st, idx) => (
                    <tr key={idx} style={{ textAlign: 'center' }}>
                      <td style={{ padding: '5px' }}>{idx + 1}</td>
                      <td style={{ padding: '5px', textAlign: 'left', fontWeight: 'bold' }}>{st.lastName}</td>
                      <td style={{ padding: '5px', textAlign: 'left' }}>{st.firstName}</td>
                      <td style={{ padding: '5px' }}>{st.grade}-{st.className}</td>
                      <td style={{ padding: '5px', fontWeight: 'bold' }}>{st.roomName}</td>
                      <td style={{ padding: '5px' }}>{st.seatNumber || (idx + 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>
          )}

          {/* ======================= 2. SALON / SINIF YOKLAMA LİSTESİ ======================= */}
          {listType === 'classroom' && Object.keys(groupedRooms).map((roomName, roomIdx) => {
            const roomStudents = groupedRooms[roomName];

            // İstatistik Analizleri
            const totalInRoom = roomStudents.length;

            // Lise 11-12 TM/MF Sayımı
            const tmCount = roomStudents.filter(s => s.track === 'TM').length;
            const mfCount = roomStudents.filter(s => s.track === 'MF').length;

            // Yabancı Dil Dinamik Sayımları
            const coreCount = roomStudents.filter(s => s.langLevel === 'Core').length;
            const extCount = roomStudents.filter(s => s.langLevel === 'Ext').length;
            const deCount = roomStudents.filter(s => s.secondLang === 'Almanca').length;
            const frCount = roomStudents.filter(s => s.secondLang === 'Fransızca').length;
            const esCount = roomStudents.filter(s => s.secondLang === 'İspanyolca').length;

            return (
              <div key={roomIdx} className="print-page" style={{ background: '#fff', border: '1px solid #ccc', padding: '1.5rem', marginBottom: '2rem' }}>
                
                {/* Üst Başlık & Bilgi Paneli */}
                <div style={{ borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>{selectedExam.title}</h2>
                      <h4 style={{ margin: '0.2rem 0', color: '#444' }}>
                        {examCategory === 'academic' && `AKADEMİK SINAV YOKLAMA LİSTESİ ${sessionType !== 'tek' ? `(${sessionType.toUpperCase()} OTURUMU)` : ''}`}
                        {examCategory === 'lang_high' && 'LİSE YABANCI DİL SINAVI YOKLAMA LİSTESİ'}
                        {examCategory === 'lang_middle' && 'ORTAOKUL YABANCI DİL SINAVI YOKLAMA LİSTESİ'}
                        {examCategory === 'written_middle' && 'ORTAOKUL YAZILI SINAVI YOKLAMA LİSTESİ'}
                      </h4>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', background: '#edf2f7', padding: '4px 10px', borderRadius: '4px', border: '1px solid #cbd5e0' }}>
                        SALON: {roomName}
                      </div>
                      <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Tarih: {selectedExam.date || new Date().toLocaleDateString('tr-TR')}</div>
                    </div>
                  </div>

                  {/* Gözetmen Bilgi Alanı */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', fontSize: '0.85rem', paddingTop: '0.4rem', borderTop: '1px dashed #ccc' }}>
                    <div>
                      <strong>Gözetmen Adı Soyadı:</strong> {invigilatorName || '_____________________________________'}
                    </div>
                    <div>
                      <strong>Gözetmen İmza:</strong> _______________________
                    </div>
                  </div>
                </div>

                {/* Yoklama Tablosu */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }} border="1">
                  <thead>
                    <tr style={{ background: '#f2f2f2', textAlign: 'center', fontSize: '0.85rem' }}>
                      <th style={{ width: '40px', padding: '5px' }}>Sıra</th>
                      {showTC && examCategory === 'academic' && <th style={{ padding: '5px' }}>TC Kimlik No</th>}
                      {examCategory !== 'written_middle' && <th style={{ padding: '5px' }}>Öğr. No</th>}
                      <th style={{ padding: '5px', textAlign: 'left' }}>Öğrenci Adı Soyadı</th>
                      <th style={{ padding: '5px' }}>Sınıf</th>
                      
                      {/* Lise Yabancı Dil Özel Sütunları */}
                      {examCategory === 'lang_high' && (
                        <>
                          <th style={{ padding: '5px' }}>Seviye</th>
                          <th style={{ padding: '5px' }}>2. Yabancı Dil</th>
                        </>
                      )}

                      {/* Ortaokul Yabancı Dil Özel Sütunu */}
                      {examCategory === 'lang_middle' && <th style={{ padding: '5px' }}>2. Yabancı Dil</th>}

                      <th style={{ width: '90px', padding: '5px' }}>Durum</th>
                      <th style={{ width: '120px', padding: '5px' }}>Öğrenci İmza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomStudents.map((st, idx) => (
                      <tr key={idx} style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        <td style={{ padding: '5px', fontWeight: 'bold' }}>{st.seatNumber || (idx + 1)}</td>
                        {showTC && examCategory === 'academic' && <td style={{ padding: '5px', fontFamily: 'monospace' }}>{st.tc}</td>}
                        {examCategory !== 'written_middle' && <td style={{ padding: '5px' }}>{st.studentNumber}</td>}
                        <td style={{ padding: '5px', textAlign: 'left', fontWeight: '500' }}>{st.fullName}</td>
                        <td style={{ padding: '5px' }}>{st.grade}-{st.className}</td>
                        
                        {/* Lise Yabancı Dil Bilgileri */}
                        {examCategory === 'lang_high' && (
                          <>
                            <td style={{ padding: '5px' }}>{st.langLevel}</td>
                            <td style={{ padding: '5px' }}>{st.grade === '11' || st.grade === '12' ? '-' : st.secondLang}</td>
                          </>
                        )}

                        {/* Ortaokul Yabancı Dil Bilgileri */}
                        {examCategory === 'lang_middle' && (
                          <td style={{ padding: '5px' }}>{st.secondLang}</td>
                        )}

                        <td style={{ padding: '5px', fontSize: '0.75rem' }}>[  ] Girdi  [  ] Girmedi</td>
                        <td style={{ padding: '5px' }}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Alt Toplamlar ve İstatistik Özet Paneli */}
                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '2px solid #000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                    
                    {/* Dinamik Alan/Dil Dağılım Detayı */}
                    <div>
                      {/* Lise 11-12 TM/MF Özeti */}
                      {examCategory === 'academic' && (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <span><strong>TM Katılan:</strong> ______</span>
                          <span><strong>MF Katılan:</strong> ______</span>
                        </div>
                      )}

                      {/* Lise Yabancı Dil Detay Özeti */}
                      {examCategory === 'lang_high' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1.5rem' }}>
                          <span><strong>Core Katılan:</strong> ______ / {coreCount}</span>
                          <span><strong>Almanca Katılan:</strong> ______ / {deCount}</span>
                          <span><strong>Ext Katılan:</strong> ______ / {extCount}</span>
                          <span><strong>Fransızca Katılan:</strong> ______ / {frCount}</span>
                          <span></span>
                          <span><strong>İspanyolca Katılan:</strong> ______ / {esCount}</span>
                        </div>
                      )}
                    </div>

                    {/* Genel Katılan / Katılmayan Sayıları */}
                    <div style={{ border: '1px solid #000', padding: '6px 12px', borderRadius: '4px', background: '#fafafa' }}>
                      <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <div><strong>Sınava Katılan:</strong> ______</div>
                        <div><strong>Katılmayan:</strong> ______</div>
                        <div><strong>Toplam Öğrenci:</strong> {totalInRoom}</div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
};

export default ExamAttendanceLists;