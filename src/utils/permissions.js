// Modül bazında yetkili e-posta listeleri
export const PERMISSIONS = {
  admin: ['merve.gnc.946@gmail.com'],
  attendance: [
    'yoklama.takip.yildizlar@gmail.com',
    'sinav.takip.yildizlar@gmail.com',
    'merve.gnc.946@gmail.com'
  ],
  exam: [
    'merve.gnc.946@gmail.com',
    'sinav.takip.yildizlar@gmail.com'
  ],
  candidates: ['merve.gnc.946@gmail.com'],
  calendar: ['merve.gnc.946@gmail.com'],
  seating: ['merve.gnc.946@gmail.com'],
};

export const hasPermission = (userEmail, module) => {
  // Admin her şeye erişebilir
  if (userEmail === 'merve.gnc.946@gmail.com') return true;

  const allowedEmails = PERMISSIONS[module];
  if (!allowedEmails) return false;
  return allowedEmails.includes(userEmail);
};