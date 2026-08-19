// Modül bazında yetkili e-posta listeleri
export const PERMISSIONS = {
  // Admin (tüm modüller)
  admin: ['merve.gnc.946@gmail.com'],

  // Geç Kalma / Kıyafet Takip Modülü
  attendance: [
    'yoklama.takip.yildizlar@gmail.com',
    'sinav.takip.yildizlar@gmail.com',
    'merve.gnc.946@gmail.com'
  ],

  // Sınav Listeleri, Not/Mazeret, Sonuç Raporları, Katılım/Mazeret Raporları
  exam: [
    'merve.gnc.946@gmail.com',
    'sinav.takip.yildizlar@gmail.com'
  ],

  // Aday / Randevu Takip (sadece admin)
  candidates: ['merve.gnc.946@gmail.com'],

  // Takvim (sadece admin)
  calendar: ['merve.gnc.946@gmail.com'],

  // Salon & Karma Dağıtım (sadece admin)
  seating: ['merve.gnc.946@gmail.com'],
};

// Yetki kontrol fonksiyonu
export const hasPermission = (userEmail, module) => {
  // Admin her şeye erişebilir
  if (userEmail === 'merve.gnc.946@gmail.com') return true;

  const allowedEmails = PERMISSIONS[module];
  if (!allowedEmails) return false;
  return allowedEmails.includes(userEmail);
};