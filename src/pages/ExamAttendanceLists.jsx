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
  const [sessionType, setSessionType] = useState('sozel'); // Ortaokul Akademik: 'sozel' | 'sayisal'
  const [invigilators, setInvigilators] = useState({});

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

  // Alan Adını Kısaltma Mantığı (SAY, EA, SÖZ, DİL)
  const formatTrack = (track) => {
    if (!track) return '-';
    const tr = String(track).trim().toLowerCase();
    if (tr.includes('say')) return 'SAY';
    if (tr.includes('eş') || tr.includes('es') || tr.includes('ea')) return 'EA';
    if (tr.includes('söz') || tr.includes('soz')) return 'SÖZ';
    if (tr.includes('dil')) return 'DİL';
    return String(track).toUpperCase();
  };

  // Esnek Öğrenci Detayları Çözücü
  const getStudentDetails = (st) => {
    const rawTc = st.tc || st.tc_no || st.tcNo || st.identity_number || st.tc_kimlik_no || '-';
    
    // Öğrenci Numarası Alımı
    const rawStudentNo = st.no || st.student_no || st.studentNo || st.school_number || st.ogr_no || st.number || '-';
    
    // İsim Ayrıştırma
    let fullName = st.studentName || st.student_name || st.name || `${st.first_name || st.ad || ''} ${st.last_name || st.soyad || ''}`.trim() || 'İsimsiz Öğrenci';
    let surname = st.last_name || st.surname || st.soyad || '';
    let firstName = st.first_name || st.name || st.ad || '';

    if (!surname && fullName) {
      const parts = fullName.trim().split(' ');
      if (parts.length > 1) {
        surname = parts.pop();
        firstName = parts.join(' ');
      } else {
        firstName = fullName;
      }
    }

    const surnameFirstFormat = surname ? `${surname.toUpperCase()}, ${firstName}` : fullName;
    const rawGrade = st.grade || st.sinif || st.grade_level || '';
    const rawClass = st.class || st.className || st.sube || st.class_name || '';
    const rawTrack = st.alan || st.track || st.field || st.department || '';

    return {
      tc: rawTc,
      studentNo: rawStudentNo,
      fullName,
      surnameFirstFormat,
      grade: rawGrade,
      className: rawClass,
      track: formatTrack(rawTrack)
    };
  };

  const getRoomName = (item) => {
    const rawRoomId = item.roomId || item.room_id || item.salon_id || item.roomName || item.room_name || item.salon;
    if (rooms && rooms.length > 0 && rawRoomId) {
      const foundInDb = rooms.find(r => String(r.id) === String(rawRoomId));
      if (foundInDb && foundInDb.name) return foundInDb.name;
    }
    return rawRoomId || 'Tanımsız Salon';
  };

  // Liste İçindeki Sınıf Seviyelerini Çıkarma (Örn: "12. Sınıf" veya "11 ve 12. Sınıf")
  const getGradeSummary = (studentList) => {
    const grades = new Set();
    studentList.forEach(st => {
      const det = getStudentDetails(st);
      if (det.grade) grades.add(String(det.grade).replace('.', ''));
    });
    
    const sortedGrades = Array.from(grades).sort((a, b) => a - b);
    if (sortedGrades.length === 0) return 'Tüm Sınıflar';
    if (sortedGrades.length === 1) return `${sortedGrades[0]}. Sınıf`;
    return `${sortedGrades.join(' ve ')}. Sınıf`;
  };

  const assignments = seatingPlan?.assignments || [];

  // Salon Gruplaması
  const groupedByRoom = assignments.reduce((acc, curr) => {
    const roomName = getRoomName(curr);
    if (!acc[roomName]) acc[roomName] = [];
    acc[roomName].push(curr);
    return acc;
  }, {});

  // Soyada Göre A-Z Sıralama
  const getSortedBySurname = () => {
    return [...assignments].sort((a, b) => {
      const detA = getStudentDetails(a);
      const detB = getStudentDetails(b);
      return detA.surnameFirstFormat.localeCompare(detB.surnameFirstFormat, 'tr', { sensitivity: 'base' });
    });
  };

  // Excel Aktarımı
  const exportToExcel = () => {
    if (!selectedExam || assignments.length === 0) return;

    let dataToExport = [];

    if (activeTab === 'surname') {
      dataToExport = getSortedBySurname().map((st, index) => {
        const det = getStudentDetails(st);
        return {
          'Sıra No': index + 1,
          'Öğrenci Soyadı, Adı': det.surnameFirstFormat,
          'Sınıf/Şube': `${det.grade}-${det.className}`,
          'Alan': det.track,
          'Salon Adı': getRoomName(st),
          'Masa Sıra No': st.seatNumber || st.seat_number || ''
        };
      });
    } else {
      dataToExport = assignments.map((st, index) => {
        const det = getStudentDetails(st);
        const item = {
          'Sıra No': index + 1,
          'Salon Adı': getRoomName(st),
          'Masa Sıra No': st.seatNumber || st.seat_number || '',
          'Öğrenci Adı Soyadı': det.fullName,
          'Sınıf/Şube': `${det.grade}-${det.className}`,
          'Alan': det.track
        };
        if (showTc && examCategory !== 'ortaokul_yazili') {
          item['TC Kimlik No'] = det.tc;
        }
        if (examCategory !== 'ortaokul_yazili') {
          item['Öğrenci No'] = det.studentNo;
        }
        return item;
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sınav_Listesi');
    XLSX.writeFile(workbook, `${selectedExam.title}_Listesi.xlsx`);
  };

  const calculateLangStats = (roomStudents) => {
    let coreCount = 0, extCount = 0, almCount = 0, fraCount = 0, ispCount = 0;
    roomStudents.forEach(st => {
      const level = (st.englishLevel || st.level || '').toLowerCase();
      if (level.includes('core')) coreCount++;
      if (level.includes('ext')) extCount++;
      const secondLang = (st.secondLanguage || st.second_lang || '').toLowerCase();
      if (secondLang.includes('alm')) almCount++;
      if (secondLang.includes('fra')) fraCount++;
      if (secondLang.includes('isp')) ispCount++;
    });
    return { coreCount, extCount, almCount, fraCount, ispCount };
  };

  return (
    <div className="lists-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      
      {/* BASKI CSS AYARLARI */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            margin-bottom: 0 !important;
            padding-bottom: 20px !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #000 !important;
            padding: 6px 8px !important;
            font-size: 9pt !important;
            color: #000 !important;
          }
          th {
            background-color: #eee !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          input {
            border: none !important;
            background: transparent !important;
          }
        }
      `}</style>

      {/* EKRAN KONTROLLERİ */}
      <div className="no-print">
        <h2>📑 Listeler</h2>
        <p style={{ color: '#666' }}>Sınav salon ve soyad sıralı listelerini yönetin ve bastırın.</p>

        {!selectedExam ? (
          <div style={{ marginTop: '1.5rem' }}>
            <h3>Lütfen Bir Sınav Seçin</h3>
            {loading ? <p>Sınavlar yükleniyor...</p> : (
              <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                {exams.map(exam => (
                  <div
                    key={exam.id}
                    onClick={() => handleSelectExam(exam)}
                    style={{
                      padding: '1.2rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, color: '#2b6cb0', fontSize: '1.1rem' }}>{exam.title}</h4>
                      <span style={{ fontSize: '0.85rem', color: '#718096' }}>Tarih: {exam.date}</span>
                    </div>
                    <button style={{ padding: '0.5rem 1rem', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Listeleri Aç →
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
              ← Sınav Seçimine Dön
            </button>

            {/* FİLTRE & AYAR PANALİ */}
            <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block' }}>Sınav Türü:</label>
                <select value={examCategory} onChange={(e) => setExamCategory(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                  <option value="akademik">Akademik Sınav (Deneme)</option>
                  <option value="yabanci_dil">Yabancı Dil Sınavı</option>
                  <option value="ortaokul_yazili">Ortaokul Yazılı Sınavı (Sınıf İçi)</option>
                </select>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block' }}>Kademe:</label>
                <select value={schoolType} onChange={(e) => setSchoolType(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                  <option value="lise">Lise (9-12)</option>
                  <option value="ortaokul">Ortaokul (5-8)</option>
                </select>
              </div>

              {examCategory === 'akademik' && schoolType === 'ortaokul' && (
                <div>
                  <label style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block' }}>Oturum:</label>
                  <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="sozel">Sözel Oturumu</option>
                    <option value="sayisal">Sayısal Oturumu</option>
                  </select>
                </div>
              )}

              {examCategory !== 'ortaokul_yazili' && (
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.2rem' }}>
                  <label style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}>
                    <input type="checkbox" checked={showTc} onChange={(e) => setShowTc(e.target.checked)} style={{ marginRight: '0.5rem' }} />
                    TC Kimlik No Göster
                  </label>
                </div>
              )}

              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={handlePrint}
                  style={{ padding: '0.6rem 1.4rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}
                >
                  🖨️ A4 Baskı Al (Ctrl+P)
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
                  borderBottom: activeTab === 'attendance' ? '3px solid #007bff' : 'none',
                  fontWeight: activeTab === 'attendance' ? 'bold' : 'normal',
                  color: activeTab === 'attendance' ? '#007bff' : '#4a5568',
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
                  borderBottom: activeTab === 'surname' ? '3px solid #007bff' : 'none',
                  fontWeight: activeTab === 'surname' ? 'bold' : 'normal',
                  color: activeTab === 'surname' ? '#007bff' : '#4a5568',
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

      {/* BASKI VE LİSTE ALANI */}
      {selectedExam && (
        <div className="print-area">
          {/* 1. SEKMELİ YAPI: SALON YOKLAMA LİSTESİ */}
          {activeTab === 'attendance' && (
            <div>
              {Object.keys(groupedByRoom).map((roomName) => {
                const students = groupedByRoom[roomName];
                const langStats = calculateLangStats(students);
                const gradeSummary = getGradeSummary(students);

                // 11 veya 12. sınıf öğrencisi var mı kontrolü
                const hasUpperGrades = students.some(st => {
                  const g = String(getStudentDetails(st).grade);
                  return g.includes('11') || g.includes('12');
                });

                return (
                  <div key={roomName} className="print-card page-break" style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '1.5rem', marginBottom: '2rem', borderRadius: '6px' }}>
                    
                    {/* YENİ BAŞLIK YAPISI: Sınav ismi + Sınıf Seviyesi + Salon İsmi + Yoklama Listesi */}
                    <div style={{ border: '2px solid #000', padding: '0.8rem', textAlign: 'center', marginBottom: '1rem', background: '#fafafa' }}>
                      <h1 style={{ margin: '0 0 0.3rem 0', fontSize: '15pt', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        {selectedExam.title} - {gradeSummary} - {roomName.toUpperCase()} YOKLAMA LİSTESİ
                      </h1>
                      <div style={{ fontSize: '10.5pt', fontWeight: 'bold', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #000', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                        <span>TARİH: {selectedExam.date}</span>
                        <span>SALON: {roomName.toUpperCase()}</span>
                        {examCategory === 'akademik' && schoolType === 'ortaokul' && (
                          <span>OTURUM: {sessionType === 'sozel' ? 'SÖZEL' : 'SAYISAL'}</span>
                        )}
                      </div>
                    </div>

                    {/* GÖZETMEN VE ÜST BİLGİ */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', fontSize: '10pt', fontWeight: 'bold' }}>
                      <div>
                        <span>GÖZETMEN ADI SOYADI: </span>
                        <input
                          type="text"
                          placeholder="......................................................"
                          value={invigilators[roomName] || ''}
                          onChange={(e) => handleInvigilatorChange(roomName, e.target.value)}
                          style={{ border: 'none', borderBottom: '1px solid #000', outline: 'none', fontWeight: 'bold', fontSize: '10pt' }}
                        />
                      </div>
                      <div>SALON KAPASİTESİ: {students.length} ÖĞRENCİ</div>
                    </div>

                    {/* ÖĞRENCİ TABLOSU */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#eee' }}>
                          <th style={{ width: '6%', textAlign: 'center' }}>SIRA</th>
                          {examCategory !== 'ortaokul_yazili' && showTc && <th style={{ width: '15%' }}>TC KİMLİK NO</th>}
                          {examCategory !== 'ortaokul_yazili' && <th style={{ width: '12%' }}>ÖĞR. NO</th>}
                          <th>ÖĞRENCİ ADI SOYADI</th>
                          <th style={{ width: '12%', textAlign: 'center' }}>SINIF / ŞUBE</th>
                          {hasUpperGrades && schoolType === 'lise' && <th style={{ width: '8%', textAlign: 'center' }}>ALAN</th>}
                          {examCategory === 'yabanci_dil' && schoolType === 'lise' && (
                            <>
                              <th style={{ width: '10%', textAlign: 'center' }}>İNG. SEVİYE</th>
                              <th style={{ width: '12%', textAlign: 'center' }}>2. YABANCI DİL</th>
                            </>
                          )}
                          {examCategory === 'yabanci_dil' && schoolType === 'ortaokul' && (
                            <th style={{ width: '15%', textAlign: 'center' }}>2. YABANCI DİL</th>
                          )}
                          <th style={{ width: '22%', textAlign: 'center' }}>İMZA / YOKLAMA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((st, sIdx) => {
                          const det = getStudentDetails(st);
                          return (
                            <tr key={st.studentId || st.id || sIdx}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.seatNumber || st.seat_number || (sIdx + 1)}</td>
                              {examCategory !== 'ortaokul_yazili' && showTc && <td style={{ fontFamily: 'monospace' }}>{det.tc}</td>}
                              {examCategory !== 'ortaokul_yazili' && <td style={{ fontWeight: '600' }}>{det.studentNo}</td>}
                              <td style={{ fontWeight: '500' }}>{det.fullName}</td>
                              <td style={{ textAlign: 'center' }}>{det.grade}-{det.className}</td>
                              {hasUpperGrades && schoolType === 'lise' && (
                                <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '8.5pt' }}>{det.track}</td>
                              )}

                              {examCategory === 'yabanci_dil' && schoolType === 'lise' && (
                                <>
                                  <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{st.englishLevel || st.level || '-'}</td>
                                  <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{st.secondLanguage || st.second_lang || '-'}</td>
                                </>
                              )}
                              {examCategory === 'yabanci_dil' && schoolType === 'ortaokul' && (
                                <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{st.secondLanguage || st.second_lang || '-'}</td>
                              )}

                              <td style={{ textAlign: 'center', color: '#999' }}>[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* ALT ÖZET VE İMZA KUTUSU */}
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
                      <div style={{ border: '1px solid #000', padding: '0.6rem 1rem', fontSize: '9pt', borderRadius: '4px', flexGrow: 1, marginRight: '1rem' }}>
                        <strong style={{ display: 'block', marginBottom: '6px', textDecoration: 'underline' }}>SINAV KATILIM ÖZETİ:</strong>
                        
                        {examCategory === 'akademik' && schoolType === 'lise' && (
                          <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <span><strong>TM KATILAN:</strong> ______</span>
                            <span><strong>MF KATILAN:</strong> ______</span>
                            <span><strong>TOPLAM KATILAN:</strong> ______</span>
                            <span><strong>KATILMAYAN:</strong> ______</span>
                          </div>
                        )}

                        {examCategory === 'yabanci_dil' && schoolType === 'lise' && (
                          <div>
                            <div style={{ marginBottom: '4px' }}>
                              {langStats.coreCount > 0 && <span style={{ marginRight: '10px' }}><strong>Core:</strong> {langStats.coreCount}</span>}
                              {langStats.extCount > 0 && <span style={{ marginRight: '10px' }}><strong>Ext:</strong> {langStats.extCount}</span>}
                              {langStats.almCount > 0 && <span style={{ marginRight: '10px' }}><strong>Almanca:</strong> {langStats.almCount}</span>}
                              {langStats.fraCount > 0 && <span style={{ marginRight: '10px' }}><strong>Fransızca:</strong> {langStats.fraCount}</span>}
                              {langStats.ispCount > 0 && <span><strong>İspanyolca:</strong> {langStats.ispCount}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '4px' }}>
                              <span><strong>TOPLAM KATILAN:</strong> ______</span>
                              <span><strong>KATILMAYAN:</strong> ______</span>
                            </div>
                          </div>
                        )}

                        {((examCategory === 'akademik' && schoolType === 'ortaokul') || examCategory === 'ortaokul_yazili' || (examCategory === 'yabanci_dil' && schoolType === 'ortaokul')) && (
                          <div style={{ display: 'flex', gap: '2rem' }}>
                            <span><strong>TOPLAM KATILAN ÖĞRENCİ:</strong> ________</span>
                            <span><strong>KATILMAYAN ÖĞRENCİ:</strong> ________</span>
                          </div>
                        )}
                      </div>

                      <div style={{ border: '1px solid #000', padding: '0.5rem', textAlign: 'center', width: '220px', borderRadius: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>GÖZETMEN İMZA</div>
                        <div style={{ height: '30px' }}></div>
                        <div style={{ fontSize: '8pt', color: '#444' }}>Teslim Eden / Teslim Alan</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. SEKMELİ YAPI: SOYAD SIRALI LİSTE (A-Z) */}
          {activeTab === 'surname' && (
            <div className="print-card page-break" style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '1.5rem', borderRadius: '6px' }}>
              <div style={{ border: '2px solid #000', padding: '0.8rem', textAlign: 'center', marginBottom: '1.2rem', background: '#fafafa' }}>
                <h1 style={{ margin: '0 0 0.3rem 0', fontSize: '15pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {selectedExam.title} - SOYAD SIRALI ÖĞRENCİ LİSTESİ
                </h1>
                <div style={{ fontSize: '10.5pt', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                  TARİH: {selectedExam.date} &nbsp;|&nbsp; SINIF SEVİYESİ: {getGradeSummary(assignments)}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#eee' }}>
                    <th style={{ width: '6%', textAlign: 'center' }}>SIRA</th>
                    <th>ÖĞRENCİ SOYADI, ADI</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>SINIF / ŞUBE</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>ALAN</th>
                    <th style={{ width: '25%', textAlign: 'center' }}>SINAV SALONU</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>SIRA NO</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedBySurname().map((st, idx) => {
                    const det = getStudentDetails(st);
                    const roomName = getRoomName(st);

                    return (
                      <tr key={st.studentId || st.id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{det.surnameFirstFormat}</td>
                        <td style={{ textAlign: 'center' }}>{det.grade}-{det.className}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{det.track}</td>
                        <td style={{ textAlign: 'center', fontWeight: '500' }}>{roomName}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{st.seatNumber || st.seat_number || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. SEKMELİ YAPI: EXCEL AKTAR */}
          {activeTab === 'excel' && (
            <div className="no-print" style={{ background: '#f8fafc', padding: '2.5rem', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
              <h3 style={{ color: '#1e293b', margin: 0 }}>📊 Excel Dışarı Aktar</h3>
              <p style={{ color: '#64748b', margin: '0.5rem 0 1.5rem 0' }}>
                Aktif sınav verilerini salon, sıra ve öğrenci bilgileriyle birlikte Excel dosyası olarak kaydedin.
              </p>
              <button
                onClick={exportToExcel}
                style={{
                  padding: '0.8rem 2rem',
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer'
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