// ExcelUpload.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { FaFileExcel, FaDownload, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';

const ExcelUpload = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [fullSync, setFullSync] = useState(false); // Güvenli mod: Varsayılan olarak silme kapalı

  // Örnek Excel Şablonu İndirme
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Ad': 'Ahmet',
        'Soyad': 'Yılmaz',
        'Sınıf': '9',
        'Şube': 'A',
        'Öğrenci No': '1045',
        'Alan': 'Sayısal',
        'Cinsiyet': 'Erkek',
        '2. Dil': 'Almanca',
        'İngilizce Seviyesi': 'Core'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Öğrenci_Şablonu');
    XLSX.writeFile(workbook, 'Ogrenci_Yukleme_Sablonu.xlsx');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessage('Excel dosyası okunuyor ve işleniyor...');

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

        for (const row of jsonData) {
          const rawStudentNo = row['Öğrenci No'] || row['Okul Numarası'] || row['student_no'] || '';
          const firstName = row['Ad'] || row['Adı'] || row['first_name'] || '';
          const lastName = row['Soyad'] || row['Soyadı'] || row['last_name'] || '';
          
          if (!firstName || !lastName) continue;

          let gradeVal = row['Sınıf'] ? String(row['Sınıf']).trim() : '';
          let classVal = row['Şube'] ? String(row['Şube']).trim() : '';

          if (!gradeVal && classVal.includes(' ')) {
            const parts = classVal.split(' ');
            gradeVal = parts[0];
            classVal = parts.slice(1).join(' ');
          }

          const incomingData = {
            first_name: String(firstName).trim(),
            last_name: String(lastName).trim(),
            grade: gradeVal,
            class: classVal,
            student_no: String(rawStudentNo).trim(),
            field: row['Alan'] || row['Alanı'] || '',
            gender: row['Cinsiyet'] || '',
            second_lang: row['2. Dil'] || row['Yabancı Dil Bilgisi'] || 'None',
            english_level: row['İngilizce Seviyesi'] || row['İngilizce Seviye'] || 'Core',
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

        if (excelKeySet.size === 0) {
          throw new Error('Excel dosyasından hiçbir öğrenci okunamadı. Lütfen sütun başlıklarınızın "Ad", "Soyad", "Sınıf" olduğundan emin olun.');
        }

        // 3. Sadece Tam Senkronizasyon (fullSync) seçiliyse Excel'de olmayanları sil
        if (fullSync) {
          for (const [dbKey, dbSt] of dbMap.entries()) {
            if (!excelKeySet.has(dbKey)) {
              operations.push(
                supabase.from('students').delete().eq('id', dbSt.id)
              );
              deletedCount++;
            }
          }
        }

        if (operations.length > 0) {
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
          `İşlem başarılı! Eklenen: ${addedCount}, Güncellenen: ${updatedCount}${fullSync ? `, Silinen: ${deletedCount}` : ''}`
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
    <div style={{ margin: '1rem 0', padding: '1.2rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
      <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
        <FaFileExcel style={{ color: '#16a34a' }} /> Toplu Excel Yükleme ve Güncelleme
      </h4>
      
      {/* Sütun Yapısı Hatırlatma Kartı */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.8rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.88rem', color: '#1e3a8a' }}>
        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <FaInfoCircle /> Excel Dosyasında Bulunması Gereken Sütun Başlıkları:
        </div>
        <p style={{ margin: '0 0 0.5rem 0', color: '#334155' }}>
          Excel dosyanızın ilk satırında (başlıklar) aşağıdaki sütun adları tam olarak yer almalıdır:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>Ad</span>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>Soyad</span>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>Sınıf</span>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>Şube</span>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>Öğrenci No</span>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Alan</span>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Cinsiyet</span>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>2. Dil</span>
          <span style={{ background: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>İngilizce Seviyesi</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#b91c1c', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <FaExclamationTriangle /> Zorunlu Sütunlar: "Ad", "Soyad", "Sınıf"
          </span>
          <button
            onClick={handleDownloadTemplate}
            style={{
              padding: '0.3rem 0.7rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontWeight: 'bold',
              marginLeft: 'auto'
            }}
          >
            <FaDownload /> Örnek Excel Şablonu İndir
          </button>
        </div>
      </div>

      {/* Yanlışlıkla Silmeyi Önleyen Güvenlik Kutusu */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          id="fullSyncCheckbox"
          checked={fullSync}
          onChange={(e) => setFullSync(e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <label htmlFor="fullSyncCheckbox" style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500', color: fullSync ? '#b91c1c' : '#334155' }}>
          ⚠️ Excel listesinde yer almayan mevcut öğrencileri veritabanından tamamen sil (Tam Senkronizasyon)
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <label
          htmlFor="excel-upload"
          style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            background: '#16a34a',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}
        >
          📂 Excel Seç ve Yükle / Güncelle
        </label>
        <input
          id="excel-upload"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
        {uploading && <span style={{ fontSize: '0.9rem', color: '#0284c7', fontWeight: 'bold' }}>İşleniyor, lütfen bekleyin...</span>}
      </div>

      {message && (
        <p style={{ marginTop: '0.8rem', fontWeight: '500', color: message.includes('hata') || message.includes('boş') ? '#dc2626' : '#16a34a', fontSize: '0.9rem' }}>
          {message}
        </p>
      )}
    </div>
  );
};

ExcelUpload.displayName = 'ExcelUpload';

export default ExcelUpload;
