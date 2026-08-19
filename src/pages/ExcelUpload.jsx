import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { encrypt } from '../utils/encryption';

const ExcelUpload = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('add');

  const [updateFields, setUpdateFields] = useState({
    grade: false,
    class: false,
    firstName: false,
    lastName: false,
    field: false,
    secondLang: false,
    phone: false,
    parentPhone: false,
    parentPhone2: false,
    gender: false,
    englishLevel: false,
  });

  const columnMapping = {
    'tcNo': 'tcNo',
    'okul numarası': 'studentNo',
    'Sınıf': 'grade',
    'Şube': 'class',
    'Adı': 'firstName',
    'Soyadı': 'lastName',
    'Öğrenim Alanı': 'field',
    '2. Yab. Dil': 'secondLang',
    'Telefon Numarası1': 'phone',
    'Veli 1 Telefon Numarası': 'parentPhone',
    'Veli 2 Telefon Numarası': 'parentPhone2',
    'Cinsiyet': 'gender',
    'İngilizce Seviyesi': 'englishLevel',
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessage('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (jsonData.length === 0) {
          setMessage('Excel dosyası boş.');
          setUploading(false);
          return;
        }

        const headers = Object.keys(jsonData[0] || {});
        const mappedHeaders = headers.map(h => columnMapping[h] || null);
        const missingHeaders = headers.filter((h, i) => !mappedHeaders[i]);
        if (missingHeaders.length > 0) {
          setMessage(`Tanımlanamayan sütunlar: ${missingHeaders.join(', ')}`);
          setUploading(false);
          return;
        }

        let addedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        if (mode === 'add') {
          for (const row of jsonData) {
            try {
              const studentData = {
                firstName: row['Adı'] || '',
                lastName: row['Soyadı'] || '',
                grade: row['Sınıf'] ? String(row['Sınıf']) : '',
                class: row['Şube'] || '',
                studentNo: row['okul numarası'] ? String(row['okul numarası']) : '',
                tcNo: encrypt(row['tcNo'] ? String(row['tcNo']) : ''),
                phone: encrypt(row['Telefon Numarası1'] ? String(row['Telefon Numarası1']) : ''),
                parentPhone: encrypt(row['Veli 1 Telefon Numarası'] ? String(row['Veli 1 Telefon Numarası']) : ''),
                parentPhone2: encrypt(row['Veli 2 Telefon Numarası'] ? String(row['Veli 2 Telefon Numarası']) : ''),
                field: row['Öğrenim Alanı'] || '',
                secondLang: row['2. Yab. Dil'] || '',
                gender: row['Cinsiyet'] || '',
                englishLevel: row['İngilizce Seviyesi'] || 'Core',
                createdAt: new Date()
              };

              if (!studentData.firstName || !studentData.lastName || !studentData.grade) {
                errorCount++;
                continue;
              }

              await addDoc(collection(db, 'students'), studentData);
              addedCount++;
            } catch (err) {
              console.error('Öğrenci eklenirken hata:', err);
              errorCount++;
            }
          }
          setMessage(`${addedCount} öğrenci başarıyla eklendi. ${errorCount} hata oluştu.`);
        } else if (mode === 'update') {
          for (const row of jsonData) {
            try {
              const tcNo = row['tcNo'] ? String(row['tcNo']) : '';
              if (!tcNo) {
                errorCount++;
                continue;
              }

              const q = query(collection(db, 'students'), where('tcNo', '==', encrypt(tcNo)));
              const querySnapshot = await getDocs(q);

              if (querySnapshot.empty) {
                errorCount++;
                continue;
              }

              const studentDoc = querySnapshot.docs[0];
              const updateData = {};

              if (updateFields.firstName) updateData.firstName = row['Adı'] || '';
              if (updateFields.lastName) updateData.lastName = row['Soyadı'] || '';
              if (updateFields.grade) updateData.grade = row['Sınıf'] ? String(row['Sınıf']) : '';
              if (updateFields.class) updateData.class = row['Şube'] || '';
              if (updateFields.field) updateData.field = row['Öğrenim Alanı'] || '';
              if (updateFields.secondLang) updateData.secondLang = row['2. Yab. Dil'] || '';
              if (updateFields.phone) updateData.phone = encrypt(row['Telefon Numarası1'] ? String(row['Telefon Numarası1']) : '');
              if (updateFields.parentPhone) updateData.parentPhone = encrypt(row['Veli 1 Telefon Numarası'] ? String(row['Veli 1 Telefon Numarası']) : '');
              if (updateFields.parentPhone2) updateData.parentPhone2 = encrypt(row['Veli 2 Telefon Numarası'] ? String(row['Veli 2 Telefon Numarası']) : '');
              if (updateFields.gender) updateData.gender = row['Cinsiyet'] || '';
              if (updateFields.englishLevel) updateData.englishLevel = row['İngilizce Seviyesi'] || 'Core';

              if (Object.keys(updateData).length === 0) {
                errorCount++;
                continue;
              }

              await updateDoc(doc(db, 'students', studentDoc.id), updateData);
              updatedCount++;
            } catch (err) {
              console.error('Güncelleme hatası:', err);
              errorCount++;
            }
          }
          setMessage(`${updatedCount} öğrenci güncellendi. ${errorCount} hata oluştu.`);
        }

        if (onUploadComplete) onUploadComplete();
      } catch (err) {
        setMessage('Dosya okunamadı: ' + err.message);
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleCheckboxChange = (e) => {
    setUpdateFields({
      ...updateFields,
      [e.target.name]: e.target.checked,
    });
  };

  return (
    <div style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
      <h4>📤 Excel ile Öğrenci İşlemleri</h4>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem' }}>
          <input type="radio" value="add" checked={mode === 'add'} onChange={() => setMode('add')} /> Yeni Öğrenci Ekle
        </label>
        <label>
          <input type="radio" value="update" checked={mode === 'update'} onChange={() => setMode('update')} /> Varolanları Güncelle (TC'ye göre)
        </label>
      </div>

      {mode === 'update' && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Güncellenecek alanlar:</span>
          {Object.keys(updateFields).map((field) => (
            <label key={field} style={{ marginRight: '0.5rem', fontSize: '0.9rem' }}>
              <input type="checkbox" name={field} checked={updateFields[field]} onChange={handleCheckboxChange} /> {field}
            </label>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="excel-upload" style={{ display: 'inline-block', padding: '0.5rem 1rem', background: '#007bff', color: 'white', borderRadius: '4px', cursor: 'pointer', marginRight: '1rem' }}>
          📂 Dosya Seç
        </label>
        <input id="excel-upload" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
        {uploading && <span>Yükleniyor...</span>}
      </div>

      {message && <p style={{ marginTop: '0.5rem', color: message.includes('hata') ? 'orange' : 'green' }}>{message}</p>}
      <details style={{ marginTop: '0.5rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#666' }}>✅ Geçerli sütun başlıkları</summary>
        <p style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
          tcNo, okul numarası, Sınıf, Şube, Adı, Soyadı, Öğrenim Alanı, 2. Yab. Dil, Telefon Numarası1, Veli 1 Telefon Numarası, Veli 2 Telefon Numarası, Cinsiyet, İngilizce Seviyesi (opsiyonel)
        </p>
      </details>
    </div>
  );
};

export default ExcelUpload;