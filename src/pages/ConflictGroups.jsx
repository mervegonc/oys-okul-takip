import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FaPlus, FaTrash, FaUserPlus, FaSave } from 'react-icons/fa';

const ConflictGroups = () => {
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);

  // Tüm sınavları getir
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'exams'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setExams(data);
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
      const gradeLevels = exam.gradeLevels || [];
      if (gradeLevels.length === 0) return;
      try {
        const q = query(
          collection(db, 'students'),
          where('grade', 'in', gradeLevels.map(String))
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStudents(data);
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
        const q = query(
          collection(db, 'conflict_groups'),
          where('examId', '==', selectedExam)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGroups(data);
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
      await addDoc(collection(db, 'conflict_groups'), {
        name: newGroupName.trim(),
        examId: selectedExam,
        studentIds: [],
        createdAt: new Date(),
      });
      setNewGroupName('');
      // Yeniden getir
      const q = query(
        collection(db, 'conflict_groups'),
        where('examId', '==', selectedExam)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroups(data);
    } catch (error) {
      console.error('Grup eklenirken hata:', error);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Bu grubu silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'conflict_groups', groupId));
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error) {
      console.error('Grup silinirken hata:', error);
    }
  };

  const handleAddStudentToGroup = async (groupId, studentId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (group.studentIds.includes(studentId)) {
      alert('Bu öğrenci zaten grupta.');
      return;
    }
    try {
      const updatedStudentIds = [...group.studentIds, studentId];
      await updateDoc(doc(db, 'conflict_groups', groupId), {
        studentIds: updatedStudentIds,
      });
      setGroups(groups.map(g =>
        g.id === groupId ? { ...g, studentIds: updatedStudentIds } : g
      ));
    } catch (error) {
      console.error('Öğrenci eklenirken hata:', error);
    }
  };

  const handleRemoveStudentFromGroup = async (groupId, studentId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const updatedStudentIds = group.studentIds.filter(id => id !== studentId);
    try {
      await updateDoc(doc(db, 'conflict_groups', groupId), {
        studentIds: updatedStudentIds,
      });
      setGroups(groups.map(g =>
        g.id === groupId ? { ...g, studentIds: updatedStudentIds } : g
      ));
    } catch (error) {
      console.error('Öğrenci çıkarılırken hata:', error);
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
              const groupStudents = students.filter(s => group.studentIds.includes(s.id));
              const availableStudents = students.filter(s => !group.studentIds.includes(s.id));

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
                            <span>{s.firstName} {s.lastName} ({s.grade}-{s.class})</span>
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
                            {s.firstName} {s.lastName} ({s.grade}-{s.class})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const select = document.querySelector(`select[data-group="${group.id}"]`);
                          if (select && select.value) {
                            handleAddStudentToGroup(group.id, select.value);
                            select.value = '';
                          }
                        }}
                        style={{
                          padding: '0.3rem 0.6rem',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <FaUserPlus />
                      </button>
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