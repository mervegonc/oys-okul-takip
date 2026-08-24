import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

const ExamAttendanceLists = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [seatingPlan, setSeatingPlan] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sekme & Filtre Durumları
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'surname' | 'excel'
  const [showTc, setShowTc] = useState(false);
  const [examCategory, setExamCategory] = useState('akademik'); // 'akademik' | 'yabanci_dil' | 'ortaokul_yazili'
  const [schoolType, setSchoolType] = useState('lise'); // 'lise' | 'ortaokul'
  const [sessionType, setSessionType] = useState('sozel'); // Ortaokul Akademik için: 'sozel' | 'sayisal'
  const [invigilators, setInvigilators] = useState({}); // { roomId/roomName: "Gözetmen Adı" }

  useEffect(() => {
    fetchExams();
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*');
      if (!error && data) setRooms(data);
    } catch (err) {
      console.warn('Rooms okunamadı:', err);
    }
  };

  const fetchExams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (err) {
      console.error('Sınavlar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExam = async (exam) => {
    setSelectedExam(exam);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seating_plans')
        .select('*')
        .eq('exam_id', exam.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const plan = data && data.length > 0 ? data[0] : null;
      if (plan && typeof plan.assignments === 'string') {
        plan.assignments = JSON.parse(plan.assignments);
      }
      setSeatingPlan(plan);
    } catch (err) {
      console.error('Oturma planı alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvigilatorChange = (roomKey, val) => {
    setInvigilators(prev => ({ ...prev, [roomKey]: val }));
  };

  const handlePrint = () => {
    window.print();
  };

  // Assignments
  const assignments = seatingPlan?.assignments || [];

  // Salon/Sınıf bazlı gruplama
  const groupedByRoom = assignments.reduce((acc, curr) => {
    const rawRoomId = curr.roomId || curr.room_id || curr.salon_id || curr.roomName || curr.room_name || curr.salon || 'Tanımsız Salon';
    
    let roomName = rawRoomId;
    if (rooms && rooms.length > 0) {
      const found = rooms.find(r => String(r.id) === String(rawRoomId));
      if (found && found.name) roomName = found.name;
    }

    if (!acc[roomName]) acc[roomName] = [];
    acc[roomName].push(curr);
    return acc;
  }, {});

  // Soyada Göre Türkçe A-Z Sıralama
  const getSortedBySurname = () => {
    return [...assignments].sort((a, b) => {
      const nameA = a.studentName || a.student_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || '';
      const nameB = b.studentName || b.student_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || '';

      const surnameA = nameA.split(' ').pop() || '';
      const surnameB = nameB.split(' ').pop() || '';

      return surnameA.localeCompare(surnameB, 'tr', { sensitivity: 'base' });
    });
  };

  // Excel İndirme İşlemi
  const exportToExcel = () => {
    if (!selectedExam || assignments.length === 0) return;

    let dataToExport = [];

    if (activeTab === 'surname') {
      dataToExport = getSortedBySurname().map((st, index) => {
        const fullNm = st.studentName || st.student_name || `${st.first_name || ''} ${st.last_name || ''}`.trim();
        return {
          'Sıra No': index + 1,
          'Öğrenci Soyadı ve Adı': fullNm,
          'Sınıf/Şube': `${st.grade || ''}-${st.class || st.className || ''}`,
          'Salon Adı': st.roomName || st.room_name || st.roomId || '',
          'Masa Sıra No': st.seatNumber || st.seat_number || ''
        };
      });
    } else {
      dataToExport = assignments.map((st, index) => {
        const item = {
          'Sıra No': index + 1,
          'Salon Adı': st.roomName || st.room_name || st.roomId || '',
          'Masa Sıra No': st.seatNumber || st.seat_number || '',
          'Öğrenci Adı Soyadı': st.studentName || st.student_name || `${st.first_name || ''} ${st.last_name || ''}`.trim(),
          'Sınıf/Şube': `${st.grade || ''}-${st.class || st.className || ''}`
        };
        if (showTc && examCategory !== 'ortaokul_yazili') {
          item['TC Kimlik No'] = st.tc || st.tc_no || '';
        }
        if (examCategory !== 'ortaokul_yazili') {
          item['Öğrenci No'] = st.studentNo || st.student_number || '';
        }
        return item;
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sınav_Listesi');
    XLSX.writeFile(workbook, `${selectedExam.title}_Listesi.xlsx`);
  };

  // Yabancı Dil İstatistik Hesaplayıcı
  const calculateLangStats = (roomStudents) => {
    let coreCount = 0;
    let extCount = 0;
    let almCount = 0;
    let fraCount = 0;
    let ispCount = 0;

    roomStudents.forEach(st => {
      const level = (st.englishLevel || st.level || st.eng_level || '').toLowerCase();
      if (level.includes('core')) coreCount++;
      if (level.includes('ext')) extCount++;

      const secondLang = (st.secondLanguage || st.second_lang || st.ikinci_dil || '').toLowerCase();
      if (secondLang.includes('alm')) almCount++;
      if (secondLang.includes('fra')) fraCount++;
      if (secondLang.includes('isp')) ispCount++;
    });

    return { coreCount, extCount, almCount, fraCount, ispCount };
  };

  // Akademik Lise TM/MF İstatistik Hesaplayıcı
  const calculateTrackStats = (roomStudents) => {
    let tmCount = 0;
    let mfCount = 0;

    roomStudents.forEach(st => {
      const grade = parseInt(st.grade || '0', 10);
      const track = (st.track || st.alan || st.branch || '').toUpperCase();
      if (grade === 11 || grade === 12) {
        if (track.includes('TM') || track.includes('EŞİT')) tmCount++;
        if (track.includes('MF') || track.includes('SAYISAL')) mfCount++;
      }
    });

    return { tmCount, mfCount };
  };

  return (
    <div className="lists-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      {/* BASKI ÖZEL CSS KONTROLLERİ */}
      <style>{`
        @media print {
          body {
            background: #fff !important;
            font-size: 11pt;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
            display: block;
            clear: both;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #000 !important;
            padding: 5px 8px !important;
            font-size: 10pt !important;
          }
          input {
            border: none !important;
            background: transparent !important;
          }
        }
      `}</style>

      {/* EKRAN ÜST BAŞLIK & SINAV SEÇİMİ (BASKIDA GİZLİ) */}
      <div className="no-print">
        <h2>📑 Listeler</h2>
        <p style={{ color: '#666' }}>Sınıf/Salon yoklama listeleri, soyad sıralı listeler ve Excel çıktılarını bu ekrandan yönetebilirsiniz.</p>

        {!selectedExam ? (
          <div style={{ marginTop: '1.5rem' }}>
            <h3>Lütfen Bir Sınav Seçin</h3>
            {loading ? <p>Sınavlar yükleniyor...</p> : (
              <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                {exams.length === 0 ? <p>Kayıtlı sınav bulunamadı.</p> : exams.map(exam => (
                  <div
                    key={exam.id}
                    onClick={() => handleSelectExam(exam)}
                    style={{
                      padding: '1rem 1.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, color: '#2b6cb0' }}>{exam.title}</h4>
                      <span style={{ fontSize: '0.85rem', color: '#718096' }}>Tarih: {exam.date}</span>
                    </div>
                    <button style={{ padding: '0.4rem 0.8rem', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Listeleri Görüntüle →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSelectedExam(null)}
              style={{ padding: '0.4rem 0.8rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '1rem' }}
            >
              ← Sınav Listesine Dön
            </button>

            {/* FİLTRE VE SINAV TÜRÜ SEÇENEKLERİ */}
            <div style={{ background: '#f7fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block' }}>Sınav Kategori:</label>
                <select value={examCategory} onChange={(e) => setExamCategory(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                  <option value="akademik">Akademik Sınav (Deneme vb.)</option>
                  <option value="yabanci_dil">Yabancı Dil Sınavı</option>
                  <option value="ortaokul_yazili">Ortaokul Yazılı Sınavı (Karma Değil)</option>
                </select>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block' }}>Okul Kademesi:</label>
                <select value={schoolType} onChange={(e) => setSchoolType(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                  <option value="lise">Lise</option>
                  <option value="ortaokul">Ortaokul</option>
                </select>
              </div>

              {examCategory === 'akademik' && schoolType === 'ortaokul' && (
                <div>
                  <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block' }}>Oturum Türü:</label>
                  <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="sozel">Sözel Oturumu</option>
                    <option value="sayisal">Sayısal Oturumu</option>
                  </select>
                </div>
              )}

              {examCategory !== 'ortaokul_yazili' && (
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.2rem' }}>
                  <label style={{ fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={showTc} onChange={(e) => setShowTc(e.target.checked)} style={{ marginRight: '0.4rem' }} />
                    TC Kimlik Numaralarını Göster
                  </label>
                </div>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handlePrint}
                  style={{ padding: '0.6rem 1.2rem', background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🖨️ Yazdır / A4 Baskı Al
                </button>
              </div>
            </div>

            {/* SEKMELER */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <button
                onClick={() => setActiveTab('attendance')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'attendance' ? '3px solid #3182ce' : 'none',
                  fontWeight: activeTab === 'attendance' ? 'bold' : 'normal',
                  color: activeTab === 'attendance' ? '#3182ce' : '#4a5568',
                  cursor: 'pointer'
                }}
              >
                🏫 Sınıf / Salon Yoklama Listesi
              </button>
              <button
                onClick={() => setActiveTab('surname')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'surname' ? '3px solid #3182ce' : 'none',
                  fontWeight: activeTab === 'surname' ? 'bold' : 'normal',
                  color: activeTab === 'surname' ? '#3182ce' : '#4a5568',
                  cursor: 'pointer'
                }}
              >
                🔤 Soyad Sıralı Liste (A-Z)
              </button>
              <button
                onClick={() => setActiveTab('excel')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'excel' ? '3px solid #28a745' : 'none',
                  fontWeight: activeTab === 'excel' ? 'bold' : 'normal',
                  color: activeTab === 'excel' ? '#28a745' : '#4a5568',
                  cursor: 'pointer'
                }}
              >
                📊 Excel Dışarı Aktar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* İÇERİK BÖLÜMÜ (BASKIDA BURASI ÇIKACAK) */}
      {selectedExam && (
        <div>
          {/* 1. SEKMELİ YAPI: SALON / SINIF YOKLAMA LİSTESİ */}
          {activeTab === 'attendance' && (
            <div>
              {Object.keys(groupedByRoom).length === 0 ? (
                <p>Bu sınav için oluşturulmuş salon yerleşimi bulunamadı.</p>
              ) : (
                Object.keys(groupedByRoom).map((roomName, roomIdx) => {
                  const students = groupedByRoom[roomName];
                  const langStats = calculateLangStats(students);
                  const trackStats = calculateTrackStats(students);

                  return (
                    <div key={roomName} className="print-card page-break" style={{ background: '#fff', border: '1px solid #ccc', padding: '1.5rem', marginBottom: '2rem', borderRadius: '4px' }}>
                      {/* LİSTE BAŞLIĞI */}
                      <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid #000', paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '14pt', textTransform: 'uppercase' }}>{selectedExam.title}</h3>
                        <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>
                          Sınav Tarihi: {selectedExam.date} | Salon / Sınıf: <span style={{ textDecoration: 'underline' }}>{roomName}</span>
                          {examCategory === 'akademik' && schoolType === 'ortaokul' && (
                            <span style={{ marginLeft: '10px', color: '#d97706' }}>
                              ({sessionType === 'sozel' ? 'SÖZEL OTURUMU' : 'SAYISAL OTURUMU'})
                            </span>
                          )}
                          {examCategory === 'yabanci_dil' && (
                            <span style={{ marginLeft: '10px', color: '#2563eb' }}>(YABANCI DİL SINAVI)</span>
                          )}
                        </div>
                      </div>

                      {/* GÖZETMEN ADI ALANI */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', fontSize: '9pt' }}>
                        <div><strong>Gözetmen Adı Soyadı:</strong> 
                          <input
                            type="text"
                            placeholder="..........................................."
                            value={invigilators[roomName] || ''}
                            onChange={(e) => handleInvigilatorChange(roomName, e.target.value)}
                            style={{ border: 'none', borderBottom: '1px dotted #000', outline: 'none', marginLeft: '5px', fontSize: '10pt' }}
                          />
                        </div>
                        <div><strong>Toplam Öğrenci Sayısı:</strong> {students.length}</div>
                      </div>

                      {/* ÖĞRENCİ TABLOSU */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f2f2f2' }}>
                            <th style={{ width: '5%', textAlign: 'center' }}>Sıra</th>
                            {examCategory !== 'ortaokul_yazili' && showTc && <th style={{ width: '15%' }}>TC Kimlik No</th>}
                            {examCategory !== 'ortaokul_yazili' && <th style={{ width: '12%' }}>Öğrenci No</th>}
                            <th>Öğrenci Adı Soyadı</th>
                            <th style={{ width: '10%', textAlign: 'center' }}>Sınıf/Şube</th>
                            {examCategory === 'yabanci_dil' && schoolType === 'lise' && (
                              <>
                                <th style={{ width: '10%', textAlign: 'center' }}>İng. Seviye</th>
                                <th style={{ width: '12%', textAlign: 'center' }}>2. Yabancı Dil</th>
                              </>
                            )}
                            {examCategory === 'yabanci_dil' && schoolType === 'ortaokul' && (
                              <th style={{ width: '15%', textAlign: 'center' }}>2. Yabancı Dil</th>
                            )}
                            <th style={{ width: '20%', textAlign: 'center' }}>İmza / Yoklama</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((st, sIdx) => {
                            const name = st.studentName || st.student_name || `${st.first_name || ''} ${st.last_name || ''}`.trim();
                            const gradeClass = `${st.grade || ''}-${st.class || st.className || ''}`;

                            return (
                              <tr key={st.studentId || st.id || sIdx}>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.seatNumber || st.seat_number || (sIdx + 1)}</td>
                                {examCategory !== 'ortaokul_yazili' && showTc && <td>{st.tc || st.tc_no || '-'}</td>}
                                {examCategory !== 'ortaokul_yazili' && <td>{st.studentNo || st.student_number || '-'}</td>}
                                <td>{name}</td>
                                <td style={{ textAlign: 'center' }}>{gradeClass}</td>

                                {/* Yabancı Dil Özel Kolonları */}
                                {examCategory === 'yabanci_dil' && schoolType === 'lise' && (
                                  <>
                                    <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{st.englishLevel || st.level || '-'}</td>
                                    <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{st.secondLanguage || st.second_lang || '-'}</td>
                                  </>
                                )}
                                {examCategory === 'yabanci_dil' && schoolType === 'ortaokul' && (
                                  <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{st.secondLanguage || st.second_lang || '-'}</td>
                                )}

                                <td style={{ textAlign: 'center', color: '#ccc' }}>[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* DİNAMİK ÖZET İSTATİSTİK VE İMZA ALANI */}
                      <div style={{ marginTop: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {/* Sol Taraf: İstatistik Kutusu */}
                        <div style={{ border: '1px solid #000', padding: '0.5rem 0.8rem', fontSize: '8.5pt', borderRadius: '4px', maxWidth: '60%' }}>
                          <strong style={{ display: 'block', marginBottom: '4px', textDecoration: 'underline' }}>Sınav Katılım Özet Tablosu:</strong>
                          
                          {/* Lise Akademik İstatistiği */}
                          {examCategory === 'akademik' && schoolType === 'lise' && (
                            <div>
                              <span><strong>TM Katılan:</strong> ____ &nbsp;|&nbsp; </span>
                              <span><strong>MF Katılan:</strong> ____ &nbsp;|&nbsp; </span>
                              <span><strong>Toplam Katılan:</strong> ____ &nbsp;|&nbsp; </span>
                              <span><strong>Katılmayan:</strong> ____</span>
                            </div>
                          )}

                          {/* Yabancı Dil Lise İstatistiği */}
                          {examCategory === 'yabanci_dil' && schoolType === 'lise' && (
                            <div>
                              {langStats.coreCount > 0 && <span><strong>Core:</strong> {langStats.coreCount} &nbsp;|&nbsp; </span>}
                              {langStats.extCount > 0 && <span><strong>Ext:</strong> {langStats.extCount} &nbsp;|&nbsp; </span>}
                              {langStats.almCount > 0 && <span><strong>Almanca:</strong> {langStats.almCount} &nbsp;|&nbsp; </span>}
                              {langStats.fraCount > 0 && <span><strong>Fransızca:</strong> {langStats.fraCount} &nbsp;|&nbsp; </span>}
                              {langStats.ispCount > 0 && <span><strong>İspanyolca:</strong> {langStats.ispCount} &nbsp;|&nbsp; </span>}
                              <div style={{ marginTop: '3px' }}>
                                <span><strong>Toplam Katılan:</strong> ____ &nbsp;|&nbsp; </span>
                                <span><strong>Katılmayan:</strong> ____</span>
                              </div>
                            </div>
                          )}

                          {/* Genel / Ortaokul İstatistiği */}
                          {((examCategory === 'akademik' && schoolType === 'ortaokul') || examCategory === 'ortaokul_yazili' || (examCategory === 'yabanci_dil' && schoolType === 'ortaokul')) && (
                            <div>
                              <span><strong>Toplam Katılan Öğrenci:</strong> ________ &nbsp;|&nbsp; </span>
                              <span><strong>Katılmayan Öğrenci:</strong> ________</span>
                            </div>
                          )}
                        </div>

                        {/* Sağ Taraf: Gözetmen İmza Kutusu */}
                        <div style={{ textAlign: 'center', width: '200px', border: '1px solid #000', padding: '0.5rem', borderRadius: '4px' }}>
                          <div style={{ fontSize: '8.5pt', fontWeight: 'bold' }}>Gözetmen İmza</div>
                          <div style={{ height: '35px' }}></div>
                          <div style={{ fontSize: '8pt', color: '#555' }}>Teslim Eden / Teslim Alan</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 2. SEKMELİ YAPI: SOYAD SIRALI LİSTE (A-Z) */}
          {activeTab === 'surname' && (
            <div className="print-card" style={{ background: '#fff', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '4px' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid #000', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, textTransform: 'uppercase' }}>{selectedExam.title} - SOYAD SIRALI ÖĞRENCİ LİSTESİ</h3>
                <div style={{ fontSize: '10pt', fontWeight: 'bold', marginTop: '4px' }}>Sınav Tarihi: {selectedExam.date}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f2f2f2' }}>
                    <th style={{ width: '8%', textAlign: 'center' }}>Sıra No</th>
                    <th>Öğrenci Soyadı ve Adı</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Sınıf/Şube</th>
                    <th style={{ width: '20%', textAlign: 'center' }}>Sınav Salonu</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Masa Sıra No</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedBySurname().map((st, idx) => {
                    const fullName = st.studentName || st.student_name || `${st.first_name || ''} ${st.last_name || ''}`.trim();
                    const roomName = st.roomName || st.room_name || st.roomId || 'Salon -';

                    return (
                      <tr key={st.studentId || st.id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ fontWeight: '500' }}>{fullName}</td>
                        <td style={{ textAlign: 'center' }}>{st.grade || ''}-{st.class || st.className || ''}</td>
                        <td style={{ textAlign: 'center' }}>{roomName}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.seatNumber || st.seat_number || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. SEKMELİ YAPI: EXCEL DIŞARI AKTAR */}
          {activeTab === 'excel' && (
            <div className="no-print" style={{ background: '#f8fafc', padding: '2rem', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
              <h3 style={{ color: '#1e293b' }}>📊 Excel Formatında Dışarı Aktar</h3>
              <p style={{ color: '#64748b', maxWidth: '600px', margin: '0.5rem auto 1.5rem auto' }}>
                Mevcut sınavın verilerini, seçili filtreler doğrultusunda Excel (.xlsx) dosyası olarak indirebilirsiniz.
              </p>

              <button
                onClick={exportToExcel}
                style={{
                  padding: '0.8rem 1.8rem',
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                📥 Excel Dosyasını İndir (.xlsx)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExamAttendanceLists;