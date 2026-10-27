// ExcelUpload.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { FaFileExcel, FaDownload, FaInfoCircle, FaExclamationTriangle, FaListOl } from 'react-icons/fa';

const ExcelUpload = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [fullSync, setFullSync] = useState(false); // Güvenli mod: Varsayılan olarak silme kapalı

  // Beklenen sütunlar ve sıralaması
  const expectedColumns = [
    { name: 'Ad', required: true, desc: 'Öğrencinin adı (Zorunlu)' },
    { name: 'Soyad', required: true, desc: 'Öğrencinin soyadı (Zorunlu)' },
    { name: 'Sınıf', required: true, desc: 'Sınıf seviyesi örn: 5, 9, 10, 11, 12 (Zorunlu)' },
    { name: 'Şube', required: false, desc: 'Şube harfi örn: A, B, C, L' },
    { name: 'Öğrenci No', required: false, desc: 'Okul öğrenci numarası' },
    { name: 'Alan', required: false, desc: 'Öğrenim alanı örn: Sayısal, Eşit Ağırlık' },
    { name: 'Cinsiyet', required: false, desc: 'Kız / Erkek' },
    { name: '2. Dil', required: false, desc: 'İkinci yabancı dil örn: Almanca, Fransızca' },
    { name: 'İngilizce Seviyesi', required: false, desc: 'Core / Extended' }
  ];

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
      
      {/* Sütun Sıralaması ve İsimleri Rehberi */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.88rem', color: '#1e3a8a' }}>
        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
          <FaListOl style={{ color: '#2563eb' }} /> Excel Dosyasında Olması Gereken Sütun Sıralaması ve Adları:
        </div>
        <p style={{ margin: '0 0 0.8rem 0', color: '#334155' }}>
          Excel dosyanızın ilk satırındaki (başlıklar) sütun adları ve sırası tam olarak aşağıdaki gibi olmalıdır:
        </p>
        
        {/* Adım Adım Sıralı Sütun Listesi */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginBottom: '0.8rem' }}>
          {expectedColumns.map((col, index) => (
            <div key={index} style={{ background: '#fff', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ background: '#2563eb', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                {index + 1}
              </span>
              <div style={{ overflow: 'hidden' }}>
                <strong style={{ color: '#0f172a', display: 'block' }}>{col.name}</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{col.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #bfdbfe', paddingTop: '0.6rem' }}>
          <span style={{ color: '#b91c1c', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
            <ExclamationTriangleIcon /> İlk 3 Sütun ("Ad", "Soyad", "Sınıf") Kesinlikle Olmalıdır!
          </span>
          <button
            onClick={handleDownloadTemplate}
            style={{
              padding: '0.35rem 0.8rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.82rem',
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

      {/* Güvenlik Kutusu */}
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

// Yardımcı ikon bileşeni
const ExclamationTriangleIcon = () => (
  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
    <path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7.2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8.2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 160c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24s24-10.7 24-24V216c0-13.3-10.7-24-24-24zm-32 224a32 32 0 1 0 64 0 32 32 0 1 0-64 0z"></path>
  </svg>
);

ExcelUpload.displayName = 'ExcelUpload';

export default ExcelUpload;
