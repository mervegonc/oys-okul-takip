import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const StudentMatrix = () => {
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [seatingPlans, setSeatingPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filtreleme state'leri
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Tüm verileri çek
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [examRes, roomRes, studentRes, planRes] = await Promise.all([
          supabase.from('exams').select('*').order('date', { ascending: true }),
          supabase.from('rooms').select('*'),
          supabase.from('students').select('*').order('first_name', { ascending: true }),
          supabase.from('seating_plans').select('*')
        ]);

        if (examRes.error) throw examRes.error;
        if (roomRes.error) throw roomRes.error;
        if (studentRes.error) throw studentRes.error;
        if (planRes.error) throw planRes.error;

        setExams(examRes.data || []);
        setRooms(roomRes.data || []);
        setStudents(studentRes.data || []);
        setSeatingPlans(planRes.data || []);
      } catch (error) {
        console.error('Veriler çekilirken hata oluştu:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Öğrenci ID veya bilgilerine göre eşleştirme yardımcı fonksiyonu
  const cleanStr = (val) => String(val || '').trim().toLowerCase();

  const isSameStudent = (assignmentItem, studentObj) => {
    const aId = cleanStr(assignmentItem.studentId || assignmentItem.student_id || assignmentItem.id);
    const sId = cleanStr(studentObj.id);
    if (aId && sId && aId === sId) return true;

    const aNo = cleanStr(assignmentItem.studentNumber || assignmentItem.student_number || assignmentItem.school_number || assignmentItem.no);
    const sNo = cleanStr(studentObj.student_no || studentObj.school_number || studentObj.no);
    if (aNo && sNo && aNo === sNo) return true;

    const aTc = cleanStr(assignmentItem.tc || assignmentItem.tc_no);
    const sTc = cleanStr(studentObj.tc_no || studentObj.tc);
    if (aTc && sTc && aTc === sTc) return true;

    return false;
  };

  // Sınıf seviyelerine göre filtreleme listesi oluştur
  const filteredStudents = students.filter(st => {
    const stGrade = Number(st.grade || st.sinif || 0);
    if (selectedGrade !== 'all' && stGrade !== Number(selectedGrade)) {
      return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const sNo = String(st.student_no || st.school_number || st.no || '').toLowerCase();
      const sName = String(st.first_name || st.ad || '').toLowerCase();
      const sSurname = String(st.last_name || st.soyad || '').toLowerCase();
      const fullName = `${sName} ${sSurname}`;

      if (!sNo.includes(term) && !sName.includes(term) && !sSurname.includes(term) && !fullName.includes(term)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%', overflowX: 'auto' }}>
      <h2>📋 Öğrenci Sınav Yerleşim Matrisi</h2>
      <p style={{ color: '#6c757d', marginBottom: '1.5rem' }}>
        Tüm öğrencilerin hangi sınavlarda hangi salon ve sıraya atandığını yatay olarak inceleyebilirsiniz.
      </p>

      {/* Filtreleme Alanı */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Sınıf Seviyesi:</label>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="all">Tüm Sınıflar</option>
            <option value="5">5. Sınıflar</option>
            <option value="6">6. Sınıflar</option>
            <option value="7">7. Sınıflar</option>
            <option value="8">8. Sınıflar</option>
            <option value="9">9. Sınıflar</option>
            <option value="10">10. Sınıflar</option>
            <option value="11">11. Sınıflar</option>
            <option value="12">12. Sınıflar</option>
          </select>
        </div>

        <div>
          <label style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Öğrenci Ara:</label>
          <input
            type="text"
            placeholder="İsim veya okul no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '220px' }}
          />
        </div>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: '#2b6cb0', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>#</th>
                <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Okul No</th>
                <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Öğrenci Adı Soyadı</th>
                <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Sınıf</th>
                <th style={{ padding: '0.8rem', borderBottom: '1px solid #ddd' }}>Yabancı Dil / Alan</th>
                
                {exams.map(exam => (
                  <th key={exam.id} colSpan="2" style={{ padding: '0.8rem', borderLeft: '2px solid #fff', textAlign: 'center', background: '#1a365d' }}>
                    {exam.title} <br />
                    <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#cbd5e0' }}>{exam.date}</span>
                  </th>
                ))}
              </tr>
              <tr style={{ background: '#e2e8f0', color: '#2d3748', textAlign: 'center', fontSize: '0.8rem' }}>
                <th colSpan="5"></th>
                {exams.map(exam => (
                  <React.Fragment key={`sub-${exam.id}`}>
                    <th style={{ padding: '0.4rem', borderLeft: '2px solid #cbd5e0' }}>Salon</th>
                    <th style={{ padding: '0.4rem' }}>Sıra</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5 + (exams.length * 2)} style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
                    Kriterlere uygun öğrenci bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const studentGrade = student.grade || student.sinif || '-';
                  const studentClass = student.class || student.branch || '';
                  const studentNo = student.student_no || student.school_number || student.no || '-';
                  const studentName = `${student.first_name || student.ad || ''} ${student.last_name || student.soyad || ''}`;
                  const studentLang = student.second_language || student.secondLanguage || student.english_level || student.field || '-';

                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                      <td style={{ padding: '0.6rem' }}>{idx + 1}</td>
                      <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>{studentNo}</td>
                      <td style={{ padding: '0.6rem', fontWeight: '500' }}>{studentName}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center' }}>{studentGrade}-{studentClass}</td>
                      <td style={{ padding: '0.6rem', color: '#4a5568' }}>{studentLang}</td>

                      {exams.map(exam => {
                        const plan = seatingPlans.find(p => String(p.exam_id) === String(exam.id));
                        let assignments = plan ? plan.assignments : [];
                        if (typeof assignments === 'string') {
                          try { assignments = JSON.parse(assignments); } catch (e) { assignments = []; }
                        }

                        const assignment = assignments.find(a => isSameStudent(a, student));

                        let roomName = '-';
                        let seatNo = '-';

                        if (assignment) {
                          const rId = assignment.roomId || assignment.room_id;
                          const roomObj = rooms.find(r => String(r.id) === String(rId));
                          roomName = roomObj ? roomObj.name : (rId ? `Salon ${rId}` : '-');
                          seatNo = assignment.seatNumber || assignment.seat_number || '-';
                        }

                        return (
                          <React.Fragment key={`cell-${exam.id}-${student.id}`}>
                            <td style={{ padding: '0.6rem', borderLeft: '2px solid #e2e8f0', textAlign: 'center', color: assignment ? '#2b6cb0' : '#a0aec0', fontWeight: assignment ? 'bold' : 'normal' }}>
                              {roomName}
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'center', color: assignment ? '#2d3748' : '#a0aec0' }}>
                              {seatNo}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentMatrix;
