import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { FaPlus, FaTrash, FaEdit, FaTimes, FaSave } from 'react-icons/fa';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    capacity: '',
    floor: '',
    hasExtraSeats: false,
    extraSeatsAdded: 0,
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const q = query(collection(db, 'rooms'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setRooms(data);
    } catch (error) {
      console.error('Salonlar alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.capacity) {
      alert('Salon adı ve kapasite zorunludur.');
      return;
    }
    try {
      if (editingId) {
        // Güncelleme
        await updateDoc(doc(db, 'rooms', editingId), {
          ...formData,
          capacity: Number(formData.capacity),
          extraSeatsAdded: Number(formData.extraSeatsAdded || 0),
        });
        alert('Salon güncellendi.');
      } else {
        // Yeni ekleme
        await addDoc(collection(db, 'rooms'), {
          ...formData,
          capacity: Number(formData.capacity),
          extraSeatsAdded: Number(formData.extraSeatsAdded || 0),
          createdAt: new Date(),
        });
        alert('Salon başarıyla eklendi.');
      }
      resetForm();
      fetchRooms();
    } catch (error) {
      console.error('Salon kaydedilirken hata:', error);
      alert('Bir hata oluştu.');
    }
  };

  const handleEdit = (room) => {
    setEditingId(room.id);
    setFormData({
      name: room.name || '',
      capacity: room.capacity || '',
      floor: room.floor || '',
      hasExtraSeats: room.hasExtraSeats || false,
      extraSeatsAdded: room.extraSeatsAdded || 0,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      capacity: '',
      floor: '',
      hasExtraSeats: false,
      extraSeatsAdded: 0,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu salonu silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', id));
      fetchRooms();
    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>🏫 Salon Yönetimi</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          style={{
            padding: '0.5rem 1rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {showForm ? <FaTimes /> : <FaPlus />} 
          {showForm ? 'Kapat' : 'Yeni Salon'}
        </button>
      </div>

      {/* Yeni Salon / Düzenleme Formu */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            border: '1px solid #e0e0e0',
          }}
        >
          <h4 style={{ marginTop: 0 }}>{editingId ? 'Salon Düzenle' : 'Yeni Salon Ekle'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1rem' }}>
            <div>
              <label>Salon Adı</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Örn: A-101"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>
            <div>
              <label>Kapasite</label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="Örn: 30"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>
            <div>
              <label>Kat</label>
              <input
                type="text"
                name="floor"
                value={formData.floor}
                onChange={handleChange}
                placeholder="Örn: Zemin, 1. Kat"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                <input
                  type="checkbox"
                  name="hasExtraSeats"
                  checked={formData.hasExtraSeats}
                  onChange={handleChange}
                />
                Ek Sıra Eklensin mi?
              </label>
            </div>
            {formData.hasExtraSeats && (
              <div>
                <label>Eklenecek Sıra Sayısı</label>
                <input
                  type="number"
                  name="extraSeatsAdded"
                  value={formData.extraSeatsAdded}
                  onChange={handleChange}
                  placeholder="Örn: 5"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            )}
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              style={{
                padding: '0.5rem 1.5rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FaSave /> {editingId ? 'Güncelle' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Salon Listesi */}
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
        <thead style={{ background: '#f1f1f1' }}>
          <tr>
            <th style={{ padding: '0.5rem' }}>#</th>
            <th style={{ padding: '0.5rem' }}>Salon Adı</th>
            <th style={{ padding: '0.5rem' }}>Kapasite</th>
            <th style={{ padding: '0.5rem' }}>Kat</th>
            <th style={{ padding: '0.5rem' }}>Ek Sıra</th>
            <th style={{ padding: '0.5rem' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room, index) => (
            <tr key={room.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>{index + 1}</td>
              <td style={{ padding: '0.5rem' }}>{room.name}</td>
              <td style={{ padding: '0.5rem' }}>{room.capacity}</td>
              <td style={{ padding: '0.5rem' }}>{room.floor || '-'}</td>
              <td style={{ padding: '0.5rem' }}>{room.hasExtraSeats ? `${room.extraSeatsAdded || 0} adet` : 'Yok'}</td>
              <td style={{ padding: '0.5rem' }}>
                <button
                  onClick={() => handleEdit(room)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffc107',
                    cursor: 'pointer',
                    marginRight: '0.5rem',
                  }}
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDelete(room.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                  }}
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
          {rooms.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '1rem' }}>
                Henüz salon eklenmemiş.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Rooms;