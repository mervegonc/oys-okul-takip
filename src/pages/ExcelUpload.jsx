import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
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

  // Esnek sütun eşleme tablosu (Farklı varyasyonları destekler)
  const columnMapping = {
    'tcno': 'tc_no',
    'tc kimlik numarası': 'tc_no',
    'okul numarası': 'student_no',
    'sınıf': 'grade',
    'şube': 'class',
    'adı': 'first_name',
    'soyadı': 'last_name',
    'öğrenim alanı': 'field',
    '2. yab. dil': 'second_lang',
    'yabancı dil bilgisi': 'second_lang',
    'telefon numarası1': 'phone',
    'veli 1 telefon numarası': 'parent_phone',
    'veli 2 telefon numarası': 'parent_phone2',
    'cinsiyet': 'gender',
    'ingilizce seviyesi': 'english_level',
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

        // Satır verilerindeki anahtarları eşleştirmek için yardımcı fonksiyon
        const getRowValue = (row, possibleKeys) => {
          const rowKeys = Object.keys(row);
          for (const key of rowKeys) {
            const normalizedKey = key.trim().toLowerCase();
            if (possibleKeys.includes(normalizedKey)) {
              return row[key];
            }
          }
          return '';
        };

        let addedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        if (mode === 'add') {
          for (const row of jsonData) {
            try {
              const studentData = {
                first_name: getRowValue(row, ['adı', 'ad']),
                last_name: getRowValue(row, ['soyadı', 'soyad']),
                grade: String(getRowValue(row, ['sınıf']) || ''),
                class: String(getRowValue(row, ['şube']) || ''),
                student_no: String(getRowValue(row, ['okul numarası', 'okul no']) || ''),
                tc_no: encrypt(String(getRowValue(row, ['tcno', 'tc kimlik numarası', 'tc']) || '')),
                phone: encrypt(String(getRowValue(row, ['telefon numarası1', 'telefon numarası', 'telefon']) || '')),
                parent_phone: encrypt(String(getRowValue(row, ['veli 1 telefon numarası', 'veli telefon']) || '')),
                parent_phone2: encrypt(String(getRowValue(row, ['veli 2 telefon numarası']) || '')),
                field: getRowValue(row, ['öğrenim alanı', 'alan']),
                second_lang: getRowValue(row, ['2. yab. dil', 'yabancı dil bilgisi', 'ikinci dil']),
                gender: getRowValue(row, ['cinsiyet']),
                english_level: getRowValue(row, ['ingilizce seviyesi']) || 'Core',
                created_at: new Date().toISOString()
              };

              if (!studentData.first_name || !studentData.last_name || !studentData.grade) {
                errorCount++;
                continue;
              }

              const { error } = await supabase
                .from('students')
                .insert(studentData);
              
              if (error) throw error;
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
              const tcNo = String(getRowValue(row, ['tcno', 'tc kimlik numarası', 'tc']) || '');
              if (!tcNo) {
                errorCount++;
                continue;
              }

              const encryptedTc = encrypt(tcNo);
              const { data: existingStudents, error: fetchError } = await supabase
                .from('students')
                .select('*')
                .eq('tc_no', encryptedTc);

              if (fetchError) throw fetchError;

              if (!existingStudents || existingStudents.length === 0) {
                errorCount++;
                continue;
              }

              const studentDoc = existingStudents[0];
              const updateData = {};

              if (updateFields.firstName) updateData.first_name = getRowValue(row, ['adı', 'ad']);
              if (updateFields.lastName) updateData.last_name = getRowValue(row, ['soyadı', 'soyad']);
              if (updateFields.grade) updateData.grade = String(getRowValue(row, ['sınıf']) || '');
              if (updateFields.class) updateData.class = String(getRowValue(row, ['şube']) || '');
              if (updateFields.field) updateData.field = getRowValue(row, ['öğrenim alanı', 'alan']);
              if (updateFields.secondLang) updateData.second_lang = getRowValue(row, ['2. yab. dil', 'yabancı dil bilgisi', 'ikinci dil']);
              if (updateFields.phone) updateData.phone = encrypt(String(getRowValue(row, ['telefon numarası1', 'telefon numarası']) || ''));
              if (updateFields.parentPhone) updateData.parent_phone = encrypt(String(getRowValue(row, ['veli 1 telefon numarası']) || ''));
              if (updateFields.parentPhone2) updateData.parent_phone2 = encrypt(String(getRowValue(row, ['veli 2 telefon numarası']) || ''));
              if (updateFields.gender) updateData.gender = getRowValue(row, ['cinsiyet']);
              if (updateFields.englishLevel) updateData.english_level = getRowValue(row, ['ingilizce seviyesi']) || 'Core';

              if (Object.keys(updateData).length === 0) {
                errorCount++;
                continue;
              }

              const { error: updateError } = await supabase
                .from('students')
                .update(updateData)
                .eq('id', studentDoc.id);

              if (updateError) throw updateError;
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
        <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#666' }}>✅ Desteklenen sütun başlıkları</summary>
        <p style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
          TC Kimlik Numarası / tcNo, Okul Numarası, Sınıf, Şube, Adı, Soyadı, Öğrenim Alanı, Yabancı Dil Bilgisi / 2. Yab. Dil, Telefon Numarası1, Veli 1 Telefon Numarası, Veli 2 Telefon Numarası, Cinsiyet, İngilizce Seviyesi
        </p>
      </details>
    </div>
  );
};

export default ExcelUpload;
