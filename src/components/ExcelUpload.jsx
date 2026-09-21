import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';

const ExcelUpload = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileUpload = async (event) => {
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

        // 1. Veritabanındaki mevcut tüm öğrencileri çek (Öğrenci Numarası karşılaştırması için)
        const { data: dbStudents, error: fetchError } = await supabase
          .from('students')
          .select('*');

        if (fetchError) throw fetchError;

        // Mevcut verileri okul numarası anahtarlı bir Map yapısına atalım
        const dbMap = new Map();
        (dbStudents || []).forEach((st) => {
          if (st.student_no) {
            dbMap.set(String(st.student_no).trim(), st);
          }
        });

        let addedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;

        const excelStudentNoSet = new Set();
        const operations = [];

        // 2. Excel'deki satırları dön (Ekleme veya Güncelleme)
        for (const row of jsonData) {
          const rawStudentNo = row['Okul Numarası'] ? String(row['Okul Numarası']).trim() : '';
          if (!rawStudentNo) continue;

          excelStudentNoSet.add(rawStudentNo);

          let gradeVal = row['Sınıf'] ? String(row['Sınıf']).trim() : '';
          let classVal = row['Şube'] ? String(row['Şube']).trim() : '';

          // Şube hücresinde "8 A" şeklinde birleşik yazılmışsa ayır
          if (!gradeVal && classVal.includes(' ')) {
            const parts = classVal.split(' ');
            gradeVal = parts[0];
            classVal = parts.slice(1).join(' ');
          }

          const incomingData = {
            first_name: row['Adı'] ? String(row['Adı']).trim() : '',
            last_name: row['Soyadı'] ? String(row['Soyadı']).trim() : '',
            grade: gradeVal,
            class: classVal,
            student_no: rawStudentNo,
            field: row['Alan'] || '',
            gender: row['Cinsiyet'] || '',
            second_lang: row['Yabancı Dil Bilgisi'] || '',
          };

          const existingStudent = dbMap.get(rawStudentNo);

          if (!existingStudent) {
            // Sistemde yoksa -> EKLE
            operations.push(
              supabase.from('students').insert({
                ...incomingData,
                created_at: new Date().toISOString(),
              })
            );
            addedCount++;
          } else {
            // Sistemde varsa -> Bilgiler farklı mı kontrol et, değiştiyse GÜNCELLE
            const isDifferent =
              String(existingStudent.grade || '') !== String(incomingData.grade) ||
              String(existingStudent.class || '') !== String(incomingData.class) ||
              String(existingStudent.first_name || '') !== String(incomingData.first_name) ||
              String(existingStudent.last_name || '') !== String(incomingData.last_name) ||
              String(existingStudent.field || '') !== String(incomingData.field) ||
              String(existingStudent.gender || '') !== String(incomingData.gender) ||
              String(existingStudent.second_lang || '') !== String(incomingData.second_lang);

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

        // 3. Excel listesinde olmayıp veritabanında kalanları SİL
        for (const [dbStudentNo, dbSt] of dbMap.entries()) {
          if (!excelStudentNoSet.has(dbStudentNo)) {
            operations.push(
              supabase.from('students').delete().eq('id', dbSt.id)
            );
            deletedCount++;
          }
        }

        // Tüm işlemleri toplu olarak gerçekleştir
        if (operations.length > 0) {
          const results = await Promise.all(operations);
          const hasError = results.some((res) => res.error);
          if (hasError) {
            console.error('İşlem sırasında bazı hatalar oluştu:', results);
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
        Yüklenen Excel dosyasındaki okul numaraları taranır: Sistemde olmayanlar eklenir, bilgileri değişenler güncellenir, Excel'de bulunmayan eski kayıtlar silinir.
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
