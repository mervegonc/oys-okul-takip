import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FaPlus, FaTrash } from 'react-icons/fa';

const ConflictGroups = () => {
  const [groups, setGroups] = useState([]);
  const [allStudents, setAllStudents] = useState([]); // Tüm öğrenciler
  const [selectedGrade, setSelectedGrade] = useState('11'); // Seçilen sınıf filtresi
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Tüm öğrencileri ve çakışma gruplarını ilk açılışta getir
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [studentsRes, groupsRes] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('conflict_groups').select('*')
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (groupsRes.error) throw groupsRes.error;

      setAllStudents(studentsRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  // Yeni Genel Grup Ekle
  const handleAddGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Lütfen bir grup adı girin.');
      return;
    }
    try {
      const { error } = await supabase
        .from('conflict_groups')
        .insert([
          {
            name: newGroupName.trim(),
            student_ids: [],
            created_at: new Date().toISOString(),
          }
        ]);

      if (error) throw error;

      setNewGroupName('');
      await fetchInitialData();
    } catch (error) {
      console.error('Grup eklenirken hata:', error);
      alert('Grup eklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  // Grup Sil
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Bu çakışma grubunu tamamen silmek istediğinize emin misiniz?')) return;
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

  // Gruba Öğrenci Ekle
  const handleAddStudentToGroup = async (groupId, studentId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const currentStudentIds = group.student_ids || [];
    if (currentStudentIds.includes(studentId)) {
      alert('Bu öğrenci zaten bu grupta.');
      return;
    }
    try {
      const updatedStudentIds = [...currentStudentIds, studentId];
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

  // Grup İçinden Öğrenci Çıkar
  const handleRemoveStudentFromGroup = async (groupId, studentId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const currentStudentIds = group.student_ids || [];
    const updatedStudentIds = currentStudentIds.filter(id => String(id) !== String(studentId));
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

  // Seçilen sınıf seviyesine göre grupları ve öğrencileri filtrele
  const filteredGroups = groups.filter(group => {
    const currentIds = group.student_ids || [];
    if (currentIds.length === 0) return true; // Boş gruplar her zaman görünebilir
    
    // Gruptaki öğrencilerden en az biri seçilen sınıf seviyesindeyse grubu göster
    return currentIds.some(id => {
      const student = allStudents.find(s => String(s.id) === String(id));
      return student && String(student.grade) === String(selectedGrade);
    });
  });

  // Seçilen sınıftaki öğrenciler (Dropdown için)
  const studentsOfSelectedGrade = allStudents.filter(s => String(s.grade) === String(selectedGrade));

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>🚫 Ortak Çakışma Grupları</h2>
      <p style={{ color: '#666' }}>
        Burada oluşturduğunuz gruplar (Örn: 12. Sınıf Risk Grubu / Kopya Çakışmaları) tüm sınavlar için 
        ortak olarak geçerli olur. Her sınav için tekrar grup oluşturmanız gerekmez.
      </p>

      {/* Sınıf Filtresi */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label style={{ fontWeight: 'bold' }}>Öğrenci Listesi Sınıf Filtresi:</label>
        <select
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value)}
          style={{ padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          {['9', '10', '11', '12'].map(g => (
            <option key={g} value={g}>{g}. Sınıf</option>
          ))}
        </select>
      </div>

      {/* Yeni Grup Ekle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Yeni Grup Adı (örn: 12. Sınıf Çakışma Grubu A)"
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
          <FaPlus /> Grup Oluştur
        </button>
      </div>

      {/* Grup Listesi */}
      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredGroups.map((group) => {
            const currentIds = group.student_ids || [];
            
            // Sadece bu gruba eklenmiş ve seçilen sınıfta olan öğrencileri filtrele
            const groupStudents = allStudents.filter(s => 
              currentIds.map(String).includes(String(s.id)) && String(s.grade) === String(selectedGrade)
            );

            // Bu sınıfta olup henüz bu grupta olmayan öğrenciler
            const availableStudents = studentsOfSelectedGrade.filter(s => !currentIds.map(String).includes(String(s.id)));

            return (
              <div
                key={group.id}
                style={{
                  background: '#f8f9fa',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#333' }}>{group.name}</h4>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                    }}
                    title="Grubu Sil"
                  >
                    <FaTrash />
                  </button>
                </div>

                {/* Gruptaki Öğrenciler */}
                <div style={{ marginBottom: '0.8rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#555' }}>Gruptaki Öğrenciler ({groupStudents.length}):</strong>
                  {groupStudents.length === 0 ? (
                    <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.2rem' }}>Bu sınıftan grupta öğrenci yok</div>
                  ) : (
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.3rem 0', maxHeight: '150px', overflowY: 'auto' }}>
                      {groupStudents.map(s => (
                        <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.2rem 0', fontSize: '0.9rem' }}>
                          <span>{s.first_name || s.firstName} {s.last_name || s.lastName} ({s.grade}-{s.class})</span>
                          <button
                            onClick={() => handleRemoveStudentFromGroup(group.id, s.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#dc3545',
                              cursor: 'pointer'
                            }}
                          >
                            <FaTrash size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Öğrenci Ekleme */}
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem' }}>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddStudentToGroup(group.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    style={{ flex: 1, padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem' }}
                  >
                    <option value="">+ {selectedGrade}. Sınıftan öğrenci ekle...</option>
                    {availableStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.first_name || s.firstName} {s.last_name || s.lastName} ({s.grade}-{s.class}) - No: {s.student_no || s.studentNo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
          {filteredGroups.length === 0 && (
            <p style={{ color: '#666' }}>Seçilen sınıfa ait çakışma grubu bulunamadı.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ConflictGroups;
