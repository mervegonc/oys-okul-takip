// ExcelUpload.jsx
import React, { useState } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

const ExcelUpload = ({ onUploadComplete }) => {
  const [loading, setLoading] = useState(false);
  const [uploadType, setUploadType] = useState('students');
  const [message, setMessage] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setMessage('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (uploadType === 'students') {
          const formattedStudents = data.map(row => ({
            student_no: String(row['Okul Numarası'] || row['Öğrenci No'] || '').trim(),
            first_name: String(row['Adı'] || row['Ad'] || '').trim(),
            last_name: String(row['Soyadı'] || row['Soyad'] || '').trim(),
            grade: String(row['Sınıf'] || '').trim(),
            class: String(row['Şube'] || '').trim(),
            field: row['Alanı'] && String(row['Alanı']).trim() !== 'nan' ? String(row['Alanı']).trim() : null,
            gender: String(row['Cinsiyet'] || '').trim(),
            english_level: String(row['İngilizce Seviye'] || 'Core').trim(),
            second_lang: row['Yabancı Dil Bilgisi'] && String(row['Yabancı Dil Bilgisi']).trim() !== 'nan' ? String(row['Yabancı Dil Bilgisi']).trim() : 'None'
          })).filter(s => s.first_name && s.student_no);

          // Çakışma sorununu tamamen aşmak için verileri önce mevcut tablo temizlenerek veya 
          // her öğrenciye benzersiz UUID atanarak toplu eklenir. 
          // Supabase her satıra otomatik id (uuid) atayacağı için okul no çakışması insert işlemine engel olamaz.
          
          const chunkSize = 100;
          let successCount = 0;

          for (let i = 0; i < formattedStudents.length; i += chunkSize) {
            const chunk = formattedStudents.slice(i, i + chunkSize);
            
            // upsert yerine doğrudan .insert() kullanarak benzersiz uuid'ler ile ekliyoruz
            const { error } = await supabase.from('students').insert(chunk);
            
            if (error) {
              console.error(`Paket yükleme hatası (${i}):`, error);
              throw new Error(`Satır ${i}: ${error.message}`);
            }
            successCount += chunk.length;
          }

          setMessage(`Başarıyla ${successCount} öğrenci yüklendi!`);

        } else if (uploadType === 'exams') {
          const formattedExams = data.map(row => ({
            title: String(row['Sınav Adı'] || row['title'] || '').trim(),
            date: String(row['Tarih'] || row['date'] || '').trim(),
            description: String(row['Açıklama'] || row['description'] || '').trim()
          })).filter(e => e.title);

          const { error } = await supabase.from('exams').insert(formattedExams);
          if (error) throw error;
          setMessage(`Başarıyla ${formattedExams.length} sınav eklendi!`);
        }

        if (onUploadComplete) onUploadComplete();
      } catch (err) {
        console.error('Excel yükleme hatası:', err);
        setMessage(`Hata oluştu: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>📂 Excel İle Veri Yükleme</h3>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Yükleme Türü:</label>
          <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <option value="students">Öğrenci Listesi</option>
            <option value="exams">Sınav Listesi</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>Excel Dosyası Seç (.xlsx):</label>
          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} style={{ fontSize: '0.9rem' }} />
        </div>
      </div>
      {loading && <p style={{ color: '#2563eb', fontWeight: '500' }}>Dosya işleniyor ve veritabanına aktarılıyor...</p>}
      {message && <p style={{ color: message.includes('Hata') ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>{message}</p>}
    </div>
  );
};

export default ExcelUpload;
