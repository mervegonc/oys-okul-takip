import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';

const ExcelUpload = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessage('Excel dosyası okunuyor ve senkronize ediliyor...');

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

        // 1. Veritabanındaki mevcut tüm öğrencileri çek
        const { data: dbStudents, error: fetchError } = await supabase
          .from('students')
          .select('*');

        if (fetchError) throw fetchError;

        // Benzersiz anahtar oluşturma fonksiyonu (Okul No + Ad + Soyad çakışmaları önler)
        const getUniqueKey = (st) => {
          const no = String(st.student_no || '').trim();
          const fname = String(st.first_name || '').trim().toLowerCase();
          const lname = String(st.last_name || '').trim().toLowerCase();
          return `${no}_${fname}_${lname}`;
        };

        const dbMap = new Map();
        (dbStudents || []).forEach((st) => {
          dbMap.set(getUniqueKey(st), st);
        });

        let addedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;

        const excelKeySet = new Set();
        const operations = [];

        // 2. Excel'deki satırları dön
        for (const row of jsonData) {
          const rawStudentNo = row['Okul Numarası'] ? String(row['Okul Numarası']).trim() : '';
          const firstName = row['Adı'] ? String(row['Adı']).trim() : '';
          const lastName = row['Soyadı'] ? String(row['Soyadı']).trim() : '';
          
          if (!firstName || !lastName) continue;

          let gradeVal = row['Sınıf'] ? String(row['Sınıf']).trim() : '';
          let classVal = row['Şube'] ? String(row['Şube']).trim() : '';

          if (!gradeVal && classVal.includes(' ')) {
            const parts = classVal.split(' ');
            gradeVal = parts[0];
            classVal = parts.slice(1).join(' ');
          }

          const incomingData = {
            first_name: firstName,
            last_name: lastName,
            grade: gradeVal,
            class: classVal,
            student_no: rawStudentNo,
            field: row['Alan'] || row['Alanı'] || '',
            gender: row['Cinsiyet'] || '',
            second_lang: row['Yabancı Dil Bilgisi'] || 'None',
            english_level: row['İngilizce Seviye'] || 'Core',
          };

          const rowKey = getUniqueKey(incomingData);
          excelKeySet.add(rowKey);

          const existingStudent = dbMap.get(rowKey);

          if (!existingStudent) {
            operations.push(
              supabase.from('students').insert({
                ...incomingData,
                created_at: new Date().toISOString(),
              })
            );
            addedCount++;
          } else {
            const isDifferent =
              String(existingStudent.grade || '') !== String(incomingData.grade) ||
              String(existingStudent.class || '') !== String(incomingData.class) ||
              String(existingStudent.field || '') !== String(incomingData.field) ||
              String(existingStudent.gender || '') !== String(incomingData.gender) ||
              String(existingStudent.second_lang || '') !== String(incomingData.second_lang) ||
              String(existingStudent.english_level || '') !== String(incomingData.english_level);

            if (isDifferent) {
              operations.push(
                supabase
                  .from('students')
                  .update(incomingData)
                  .eq('id', existingStudent.id)
              );
              updatedCount++;
            }
          }
        }

        // 3. Excel listesinde olmayıp veritabanında kalanları sil
        for (const [dbKey, dbSt] of dbMap.entries()) {
          if (!excelKeySet.has(dbKey)) {
            operations.push(
              supabase.from('students').delete().eq('id', dbSt.id)
            );
            deletedCount++;
          }
        }

        // Toplu işlemleri gerçekleştir (10'arli veya paralel paketler halinde)
        if (operations.length > 0) {
          // Supabase isteklerini aşırı yüklememek için gruplayarak çalıştıralım
          const chunkSize = 50;
          for (let i = 0; i < operations.length; i += chunkSize) {
            const chunk = operations.slice(i, i + chunkSize);
            const results = await Promise.all(chunk);
            const hasError = results.some((res) => res.error);
            if (hasError) {
              console.error('İşlem sırasında bazı hatalar oluştu:', results);
            }
          }
        }

        setMessage(
          `Senkronizasyon başarılı! Eklenen: ${addedCount}, Güncellenen: ${updatedCount}, Silinen: ${deletedCount}`
        );

        if (onUploadComplete) onUploadComplete();
      } catch (err) {
        console.error('Excel işleme hatası:', err);
        setMessage('Dosya işlenirken hata oluştu: ' + err.message);
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ margin: '1rem 0', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
      <h4>📤 Otomatik Excel Senkronizasyonu</h4>
      <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.8rem' }}>
        Yüklenen Excel dosyasındaki öğrenciler taranır: Eksikler eklenir, değişenler güncellenir ve Excel'de olmayanlar temizlenir.
      </p>

      <div>
        <label
          htmlFor="excel-upload"
          style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            background: '#007bff',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '1rem',
          }}
        >
          📂 Excel Seç ve Senkronize Et
        </label>
        <input
          id="excel-upload"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
        {uploading && <span>Senkronize ediliyor, lütfen bekleyin...</span>}
      </div>

      {message && (
        <p style={{ marginTop: '0.8rem', fontWeight: '500', color: message.includes('hata') ? 'red' : 'green' }}>
          {message}
        </p>
      )}
    </div>
  );
};

ExcelUpload.displayName = 'ExcelUpload';

export default ExcelUpload;
