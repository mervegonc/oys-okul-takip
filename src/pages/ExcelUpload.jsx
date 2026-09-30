// ExcelUpload.jsx
import React, { useState } from 'react';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';

const ExcelUpload = ({ onUploadComplete }) => {
  const [loading, setLoading] = useState(false);
  const [uploadType, setUploadType] = useState('students'); // 'students', 'exams', 'grades'
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
    const formattedStudents = data.map(row => {
            let studentNo = String(row['Okul Numarası'] || row['Öğrenci No'] || row['student_no'] || '').trim();
            let firstName = String(row['Adı'] || row['Ad'] || row['first_name'] || '').trim();
            let lastName = String(row['Soyadı'] || row['Soyad'] || row['last_name'] || '').trim();
            let field = String(row['Alanı'] || row['Alan'] || row['field'] || '').trim();
            let gender = String(row['Cinsiyet'] || row['gender'] || '').trim();
            let secondLang = String(row['Yabancı Dil Bilgisi'] || row['2. Yabancı Dil'] || row['second_lang'] || '').trim();

            let grade = String(row['Sınıf'] || row['grade'] || '').trim();
            let sube = String(row['Şube'] || row['class'] || '').trim();

            if (!grade && sube && sube.includes(' ')) {
              const parts = sube.split(' ');
              grade = parts[0];
              sube = parts[1];
            } else if (grade && !sube && grade.includes(' ')) {
              const parts = grade.split(' ');
              grade = parts[0];
              sube = parts[1];
            }

            // Çakışmayı önlemek için benzersiz bir id veya anahtar oluşturabiliriz
            // Eğer veritabanında primary key 'student_no' ise, farklı sınıflardaki aynı no çakışır.
            return {
              student_no: studentNo,
              grade: grade,
              class: sube,
              first_name: firstName,
              last_name: lastName,
              field: field || null,
              gender: gender,
              english_level: String(row['İngilizce Seviye'] || row['english_level'] || 'Core').trim(),
              second_lang: secondLang || 'None'
            };
          }).filter(s => s.first_name || s.student_no);

          const { error } = await supabase.from('students').upsert(formattedStudents, { onConflict: 'student_no' });
          if (error) throw error;
          setMessage(`Başarıyla ${formattedStudents.length} öğrenci yüklendi!`);
        } else if (uploadType === 'exams') {
          const formattedExams = data.map(row => ({
            title: String(row['Sınav Adı'] || row['title'] || '').trim(),
            date: String(row['Tarih'] || row['date'] || '').trim(),
            description: String(row['Açıklama'] || row['description'] || '').trim()
          }));

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
