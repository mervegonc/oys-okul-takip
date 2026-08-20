import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaPlus, FaTrash, FaUserPlus, FaSave } from 'react-icons/fa';

const ConflictGroups = () => {
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Tüm sınavları getir
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setExams(data || []);
      } catch (error) {
        console.error('Sınavlar alınamadı:', error);
      }
    };
    fetchExams();
  }, []);

  // Sınav seçildiğinde o sınıflardaki öğrencileri getir
  useEffect(() => {
    if (!selectedExam) {
      setStudents([]);
      return;
    }
    const fetchStudents = async () => {
      const exam = exams.find(e => e.id === selectedExam);
      if (!exam) return;
      const gradeLevels = exam.grade_levels || [];
      if (gradeLevels.length === 0) return;
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .in('grade', gradeLevels.map(String));
        if (error) throw error;
        setStudents(data || []);
      } catch (error) {
        console.error('Öğrenciler alınamadı:', error);
      }
    };
    fetchStudents();
  }, [selectedExam, exams]);

  // Mevcut çakışma gruplarını getir
  useEffect(() => {
    if (!selectedExam) {
      setGroups([]);
      return;
    }
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase
          .from('conflict_groups')
          .select('*')
          .eq('exam_id', selectedExam);
        if (error) throw error;
        setGroups(data || []);
      } catch (error) {
        console.error('Gruplar alınamadı:', error);
      }
    };
    fetchGroups();
  }, [selectedExam]);

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Grup adı girin.');
      return;
    }
    if (!selectedExam) {
      alert('Lütfen bir sınav seçin.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('conflict_groups')
        .insert({
          name: newGroupName.trim(),
          exam_id: selectedExam,
          student_ids: [],
          created_at: new Date(),
        })
        .select()
        .single();
      if (error) throw error;
      setNewGroupName('');
      setGroups([...groups, data]);
    } catch (error) {
      console.error('Grup eklenirken hata:', error);
      alert('Grup eklenirken hata oluştu.');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Bu grubu silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('conflict_groups')
        .delete()
        .eq('id', groupId);
      if (error) throw error;
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error) {
      console.error('Grup silinirken hata:', error);
      alert('Grup silinirken hata oluştu.');
    }
  };

  const handleAddStudentToGroup = async (groupId, studentId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (group.student_ids.includes(studentId)) {
      alert('Bu öğrenci zaten grupta.');
      return;
    }
    try {
      const updatedStudentIds = [...group.student_ids, studentId];
      const { error } = await supabase
        .from('conflict_groups')
        .update({ student_ids: updatedStudentIds })
        .eq('id', groupId);
      if (error) throw error;
      setGroups(groups.map(g =>
        g.id === groupId ? { ...g, student_ids: updatedStudentIds } : g
      ));
    } catch (error) {
      console.error('Öğrenci eklenirken hata:', error);
      alert('Öğrenci eklenirken hata oluştu.');
    }
  };

  const handleRemoveStudentFromGroup = async (groupId, studentId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const updatedStudentIds = group.student_ids.filter(id => id !== studentId);
    try {
      const { error } = await supabase
        .from('conflict_groups')
        .update({ student_ids: updatedStudentIds })
        .eq('id', groupId);
      if (error) throw error;
      setGroups(groups.map(g =>
        g.id === groupId ? { ...g, student_ids: updatedStudentIds } : g
      ));
    } catch (error) {
      console.error('Öğrenci çıkarılırken hata:', error);
      alert('Öğrenci çıkarılırken hata oluştu.');
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>🚫 Çakışma Grupları</h2>
      <p style={{ color: '#666' }}>
        Aynı salona düşmemesi gereken öğrencileri gruplara ekleyin. Sistem, karma dağıtım sırasında 
        aynı gruptaki öğrencileri farklı salonlara atayacaktır.
      </p>

      {/* Sınav Seçimi */}
      <div style={{ marginBottom: '1rem' }}>
        <label>Sınav Seçin</label>
        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="">-- Sınav Seçin --</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>
              {exam.title} ({exam.date})
            </option>
          ))}
        </select>
      </div>

      {selectedExam && (
        <>
          {/* Yeni Grup Ekle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Grup adı (örn: KOPYA-1)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <button
              onClick={handleAddGroup}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FaPlus /> Grup Ekle
            </button>
          </div>

          {/* Grup Listesi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '1rem' }}>
            {groups.map((group) => {
              const groupStudents = students.filter(s => group.student_ids?.includes(s.id));
              const availableStudents = students.filter(s => !group.student_ids?.includes(s.id));

              return (
                <div
                  key={group.id}
                  style={{
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>{group.name}</h4>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#dc3545',
                        cursor: 'pointer',
                      }}
                    >
                      <FaTrash />
                    </button>
                  </div>

                  {/* Gruptaki Öğrenciler */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Öğrenciler:</strong>
                    {groupStudents.length === 0 ? (
                      <span style={{ color: '#666', fontSize: '0.9rem', marginLeft: '0.5rem' }}>Henüz öğrenci eklenmemiş</span>
                    ) : (
                      <ul style={{ paddingLeft: '1.2rem', margin: '0.3rem 0' }}>
                        {groupStudents.map(s => (
                          <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{s.first_name} {s.last_name} ({s.grade}-{s.class})</span>
                            <button
                              onClick={() => handleRemoveStudentFromGroup(group.id, s.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#dc3545',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                              }}
                            >
                              <FaTrash />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Öğrenci Ekleme */}
                  {availableStudents.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddStudentToGroup(group.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        style={{ flex: 1, padding: '0.3rem', border: '1px solid #ddd', borderRadius: '4px' }}
                      >
                        <option value="">Öğrenci ekle...</option>
                        {availableStudents.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.first_name} {s.last_name} ({s.grade}-{s.class})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
            {groups.length === 0 && (
              <p style={{ color: '#666' }}>Henüz çakışma grubu oluşturulmamış.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ConflictGroups;