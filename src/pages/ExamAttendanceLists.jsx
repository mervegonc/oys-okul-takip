import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const ExamAttendanceLists = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examData, setExamData] = useState(null);
  const [roomLists, setRoomLists] = useState({});
  const [loading, setLoading] = useState(false);

  // Basit TC Şifre Çözücü (Projenizdeki decrypt algoritmasına göre uyarlayabilirsiniz)
  const decryptTC = (encryptedTc) => {
    if (!encryptedTc) return '-';
    try {
      // Eğer düz metinse direkt dön, değilse decode et
      return atob(encryptedTc); 
    } catch {
      return encryptedTc; 
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
    if (data) setExams(data);
  };

  const handleExamChange = async (e) => {
    const examId = e.target.value;
    setSelectedExamId(examId);
    if (!examId) return;

    setLoading(true);

    // 1. Sınav Detayı
    const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).single();
    setExamData(exam);

    // 2. Koltuk / Salon Dağılımları ve Öğrenci Detayları
    const { data: seatingData } = await supabase
      .from('seating_allocations')
      .select(`
        room_name,
        seat_number,
        students (
          id,
          first_name,
          last_name,
          student_number,
          tc_number,
          class_level,
          branch
        )
      `)
      .eq('exam_id', examId);

    if (seatingData) {
      // Salonlara göre grupla ve öğrenci soyadına/sırasına göre diz
      const grouped = seatingData.reduce((acc, item) => {
        const room = item.room_name || 'Tanımsız Salon';
        if (!acc[room]) acc[room] = [];
        
        if (item.students) {
          acc[room].push({
            seatNo: item.seat_number,
            studentNo: item.students.student_number || item.students.id || '-',
            tcNo: decryptTC(item.students.tc_number),
            fullName: `${item.students.first_name || ''} ${item.students.last_name || ''}`.trim(),
            className: `${item.students.class_level || ''}-${item.students.branch || ''}`.trim()
          });
        }
        return acc;
      }, {});

      // Her salon içi öğrencileri alfabetik sırala
      Object.keys(grouped).forEach(room => {
        grouped[room].sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
      });

      setRoomLists(grouped);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* ÜST FİLTRE VE YAZDIRMA PANELİ (Çıktıda Gizlenir) */}
      <div className="no-print" style={{ 
        background: '#fff', 
        padding: '1rem 1.5rem', 
        borderRadius: '8px', 
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        marginBottom: '2rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.3rem' }}>Sınav Seçiniz:</label>
          <select 
            value={selectedExamId} 
            onChange={handleExamChange}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">-- Sınav Seçin --</option>
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name || ex.title} ({ex.date || 'Tarihsiz'})</option>
            ))}
          </select>
        </div>

        {selectedExamId && (
          <button 
            onClick={() => window.print()}
            style={{
              marginTop: '1.2rem',
              padding: '0.6rem 1.5rem',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🖨️ Sayfayı Yazdır (PDF)
          </button>
        )}
      </div>

      {loading && <div className="no-print">Listeler yükleniyor...</div>}

      {/* BASKI ALANI (HER SALON AYRI BİR SAYFA) */}
      {Object.keys(roomLists).length > 0 && (
        <div className="print-container">
          {Object.entries(roomLists).map(([roomName, students]) => (
            <div key={roomName} className="page-break" style={{
              background: '#fff',
              padding: '20mm',
              marginBottom: '20px',
              boxShadow: '0 0 10px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '270mm' // A4 Sayfa Boyutu Dengesi
            }}>
              <div>
                {/* HER SAYFANIN KENDİ ÖZEL BAŞLIĞI */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '15px' }}>
                  <h2 style={{ margin: 0, fontSize: '18pt', textTransform: 'uppercase' }}>NESİBE AYDIN EĞİTİM KURUMLARI</h2>
                  <h3 style={{ margin: '5px 0', fontSize: '14pt' }}>SINAV YOKLAMA LİSTESİ</h3>
                  <div style={{ display: 'flex', justifyBetween: 'space-between', marginTop: '10px', fontSize: '10pt', fontWeight: 'bold' }}>
                    <span><b>Sınav Adı:</b> {examData?.name || examData?.title}</span>
                    <span><b>Salon / Sınıf:</b> {roomName}</span>
                    <span><b>Tarih:</b> {examData?.date || new Date().toLocaleDateString('tr-TR')}</span>
                  </div>
                </div>

                {/* ÖĞRENCİ LİSTESİ TABLOSU */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '10pt' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f2f2f2' }}>
                      <th style={tableThStyle}>S.No</th>
                      <th style={tableThStyle}>Sıra No</th>
                      <th style={tableThStyle}>Öğrenci No</th>
                      <th style={tableThStyle}>T.C. Kimlik No</th>
                      <th style={tableThStyle}>Adı Soyadı</th>
                      <th style={tableThStyle}>Sınıfı / Şubesi</th>
                      <th style={{ ...tableThStyle, width: '70px', textAlign: 'center' }}>Yoklama (+ / -)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st, idx) => (
                      <tr key={idx}>
                        {/* 1'den Mevcuda Kadar Ardışık Sıra No */}
                        <td style={{ ...tableTdStyle, textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ ...tableTdStyle, textAlign: 'center' }}>{st.seatNo || '-'}</td>
                        <td style={{ ...tableTdStyle, textAlign: 'center' }}>{st.studentNo}</td>
                        <td style={{ ...tableTdStyle, textAlign: 'center' }}>{st.tcNo}</td>
                        <td style={{ ...tableTdStyle, fontWeight: '500' }}>{st.fullName}</td>
                        <td style={{ ...tableTdStyle, textAlign: 'center' }}>{st.className}</td>
                        {/* Gözetmenin İşaretleme Alanı */}
                        <td style={{ ...tableTdStyle, textAlign: 'center', fontSize: '12pt' }}>[ &nbsp; ]</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* HER SAYFANIN ALTINDAKİ GÖZETMEN İMZA VE TOPLAM BİLGİ ALANI */}
              <div style={{ marginTop: '30px', borderTop: '1px solid #000', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', marginBottom: '20px' }}>
                  <div><b>Salon Mevcudu:</b> {students.length}</div>
                  <div><b>Sınava Katılan (+):</b> .........</div>
                  <div><b>Sınava Katılmayan (-):</b> .........</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', fontSize: '10pt' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>1. Gözetmen</p>
                    <p style={{ margin: '5px 0 0 0' }}>Adı Soyadı: .......................................</p>
                    <p style={{ margin: '15px 0 0 0' }}>İmza: .......................................</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>2. Gözetmen</p>
                    <p style={{ margin: '5px 0 0 0' }}>Adı Soyadı: .......................................</p>
                    <p style={{ margin: '15px 0 0 0' }}>İmza: .......................................</p>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* SAYFA KESME VE YAZDIRMA CSS STİLLERİ */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-container {
            width: 100% !important;
          }
          .page-break {
            page-break-after: always !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: 98vh !important;
          }
        }
      `}</style>
    </div>
  );
};

const tableThStyle = {
  border: '1px solid #000',
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: '9pt',
  fontWeight: 'bold'
};

const tableTdStyle = {
  border: '1px solid #000',
  padding: '5px 8px',
  fontSize: '9.5pt'
};

export default ExamAttendanceLists;