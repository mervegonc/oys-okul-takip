import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaCalendarAlt, FaPrint, FaFileExcel, FaCheckSquare } from 'react-icons/fa';
import * as XLSX from 'xlsx';

const OpticsCollection = () => {
  const [exams, setExams] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [filteredExams, setFilteredExams] = useState([]);
  const [examDetailsData, setExamDetailsData] = useState([]); // Tarihteki sınavların salon ve öğrenci listeleri
  const [rooms, setRooms] = useState([]);
  const [studentsMap, setStudentsMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    processExamsForDate();
  }, [selectedDate, exams, rooms, studentsMap]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Sınavları Çek
      const { data: examData } = await supabase.from('exams').select('*').order('date', { ascending: true });
      setExams(examData || []);

      // 2. Salonları Çek
      const { data: roomData } = await supabase.from('rooms').select('*');
      setRooms(roomData || []);

      // 3. Öğrencileri Çek
      const { data: studentData } = await supabase.from('students').select('*');
      const map = {};
      (studentData || []).forEach(st => {
        map[String(st.id)] = st;
        map[String(st.tc_no || '').trim()] = st;
        map[String(st.student_no || '').trim()] = st;
      });
      setStudentsMap(map);

    } catch (err) {
      console.error('Veriler yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  // Seçilen tarihteki sınavları ve salon dağılımlarını derle
  const processExamsForDate = async () => {
    if (!selectedDate) {
      setExamDetailsData([]);
      return;
    }

    setLoading(true);
    try {
      // Seçilen tarihe uyan sınavlar (Tarih formatı YYYY-MM-DD varsayılıyor)
      const targetExams = exams.filter(ex => {
        if (!ex.date) return false;
        return ex.date.slice(0, 10) === selectedDate;
      });

      if (targetExams.length === 0) {
        setExamDetailsData([]);
        setLoading(false);
        return;
      }

      const examIds = targetExams.map(e => e.id);
      const { data: plansData } = await supabase
        .from('seating_plans')
        .select('*')
        .in('exam_id', examIds);

      const tableRows = [];

      targetExams.forEach(exam => {
        const plan = plansData?.find(p => String(p.exam_id) === String(exam.id));
        if (!plan) return;

        let assignments = [];
        if (typeof plan.assignments === 'string') {
          try { assignments = JSON.parse(plan.assignments); } catch (e) {}
        } else if (Array.isArray(plan.assignments)) {
          assignments = plan.assignments;
        }

        // Salonlara göre grupla
        const roomGroups = {};
        assignments.forEach(st => {
          const rawRoomId = st.roomId || st.room_id || st.salon_id || st.roomName || st.room_name || st.salon;
          let roomName = rawRoomId || 'Tanımsız Salon';
          
          if (rooms.length > 0 && rawRoomId) {
            const foundDbRoom = rooms.find(r => String(r.id) === String(rawRoomId) || String(r.name) === String(rawRoomId));
            if (foundDbRoom && foundDbRoom.name) roomName = foundDbRoom.name;
          }

          if (!roomGroups[roomName]) roomGroups[roomName] = [];
          roomGroups[roomName].push(st);
        });

        // Her salon için satır oluştur
        Object.keys(roomGroups).forEach(roomName => {
          const roomStudents = roomGroups[roomName];
          
          // Sınıf seviyesini bulmaya çalış
          const gradesSet = new Set();
          let eaCount = 0;
          let sayCount = 0;
          let otherCount = 0;

          roomStudents.forEach(st => {
            const dbSt = studentsMap[String(st.studentId || st.student_id || st.id || '').trim()] || 
                         studentsMap[String(st.tc || '').trim()] || 
                         studentsMap[String(st.no || '').trim()] || {};
            
            const grade = dbSt.grade || st.grade || st.sinif || '9';
            gradesSet.add(String(grade).replace('.', '').trim());

            const field = String(dbSt.field || st.field || st.alan || '').trim().toUpperCase();
            if (field.includes('EA') || field.includes('EŞİT')) {
              eaCount++;
            } else if (field.includes('SAY') || field.includes('SAYISAL')) {
              sayCount++;
            } else {
              otherCount++;
            }
          });

          const sortedGrades = Array.from(gradesSet).sort();
          const gradeLevelStr = sortedGrades.length > 0 ? `${sortedGrades.join('-')}. Sınıf` : 'Lise';

          // İstediğiniz format: Örn "3(EA)+20(SAY)" veya sadece toplam sayı
          let populationDisplay = `${roomStudents.length}`;
          if (eaCount > 0 || sayCount > 0) {
            const parts = [];
            if (eaCount > 0) parts.push(`${eaCount}(EA)`);
            if (sayCount > 0) parts.push(`${sayCount}(SAY)`);
            if (otherCount > 0 && parts.length === 0) parts.push(`${otherCount}`);
            
            if (parts.length > 0) {
              populationDisplay = `${roomStudents.length} [ ${parts.join('+')} ]`;
            }
          }

          tableRows.push({
            examTitle: exam.title || 'İsimsiz Sınav',
            gradeLevel: gradeLevelStr,
            roomName: roomName.toUpperCase(),
            totalStudents: populationDisplay,
            rawTotal: roomStudents.length
          });
        });
      });

      setExamDetailsData(tableRows);
    } catch (err) {
      console.error('Optik liste işlenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToExcel = () => {
    if (examDetailsData.length === 0) return;
    const excelData = examDetailsData.map((item, idx) => ({
      'Sıra': idx + 1,
      'Sınav İsmi': item.examTitle,
      'Sınıf Seviyesi': item.gradeLevel,
      'Salon Numarası': item.roomName,
      'Mevcut Öğrenci': item.totalStudents,
      'Gelen Sayısı': '',
      'Gelemeyen Sayısı': '',
      'Kontrol (✓)': ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Optik Toplama Listesi');
    XLSX.writeFile(workbook, `Optik_Toplama_${selectedDate}.xlsx`);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* 🖨️ A4 BASKI İÇİN ÖZEL CSS (Tek Sayfaya Sığdırma Optimizasyonu) */}
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
            padding: 5mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #000 !important;
            padding: 6px 8px !important;
            font-size: 10pt !important;
            color: #000 !important;
          }
          th {
            background-color: #e2e8f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* ÜST KONTROL PANELİ (Yazdırma İptal Alanı) */}
      <div className="no-print" style={{ background: '#fff', padding: '1.2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📊 Optik Toplama ve Yoklama Takip Listesi
          </h2>
          <p style={{ margin: '0.3rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Seçilen güne ait tüm sınav salonlarını listeleyin, el ile katılım sayılarını girip tek sayfada çıktı alın.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <FaCalendarAlt style={{ color: '#2563eb' }} />
            <label style={{ fontSize: '0.88rem', fontWeight: 'bold' }}>Sınav Tarihi:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
            />
          </div>

          <button
            onClick={exportToExcel}
            style={{ padding: '0.55rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
          >
            <FaFileExcel /> Excel İndir
          </button>

          <button
            onClick={handlePrint}
            style={{ padding: '0.55rem 1.2rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
          >
            <FaPrint /> Tek Sayfa A4 Yazdır
          </button>
        </div>
      </div>

      {/* BASILACAK / GÖRÜNTÜLENECEK ALAN */}
      <div className="print-area" style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        
        {/* Kağıt Üstü Başlığı */}
        <div style={{ border: '2px solid #000', padding: '0.8rem', textAlign: 'center', marginBottom: '1.2rem', background: '#fafafa' }}>
          <h2 style={{ margin: '0 0 0.3rem 0', fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
            GENEL SINAV OPTİK TOPLAMA VE YOKLAMA LİSTESİ
          </h2>
          <div style={{ fontSize: '10pt', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '0.3rem', marginTop: '0.3rem', display: 'flex', justifyContent: 'space-around' }}>
            <span>TARİH: {selectedDate ? new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
            <span>TOPLAM SALON/OTURUM: {examDetailsData.length}</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Veriler yükleniyor...</div>
        ) : examDetailsData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626', fontWeight: 'bold' }}>
            Seçilen tarihte ({selectedDate}) planlanmış sınav oturumu bulunamadı.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f1f1f1' }}>
                <th style={{ width: '5%', border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>Sıra</th>
                <th style={{ width: '25%', border: '1px solid #cbd5e1', padding: '8px' }}>Sınav İsmi</th>
                <th style={{ width: '12%', border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>Sınıf Seviyesi</th>
                <th style={{ width: '18%', border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>Salon Numarası</th>
                <th style={{ width: '15%', border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>Mevcut Öğrenci</th>
                <th style={{ width: '8%', border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>Gelen</th>
                <th style={{ width: '8%', border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>Gelemeyen</th>
                <th style={{ width: '9%', border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>Optik (✓)</th>
              </tr>
            </thead>
            <tbody>
              {examDetailsData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                    {idx + 1}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', fontWeight: '600' }}>
                    {item.examTitle}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>
                    {item.gradeLevel}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#1d4ed8' }}>
                    {item.roomName}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                    {item.totalStudents}
                  </td>
                  {/* Elle doldurulacak boş alanlar */}
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', backgroundColor: '#fff' }}>
                    &nbsp;
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', backgroundColor: '#fff' }}>
                    &nbsp;
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>
                    [ &nbsp; ]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Alt İmza Alanı */}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', fontSize: '9pt', fontWeight: 'bold' }}>
          <div style={{ borderTop: '1px solid #000', paddingTop: '0.4rem', width: '200px', textAlign: 'center' }}>
            Teslim Alan (Optik Sorumlusu)
          </div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '0.4rem', width: '200px', textAlign: 'center' }}>
            Kontrol Eden / Onaylayan
          </div>
        </div>

      </div>
    </div>
  );
};

export default OpticsCollection;
