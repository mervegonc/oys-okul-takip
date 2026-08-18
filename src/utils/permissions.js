export const PERMISSIONS = {
  admin: 'merve.gnc.946@gmail.com',
  attendance: ['yoklama.takip.yildizlar@gmail.com', 'merve.gnc.946@gmail.com'],
  exam: ['sinav.takip.yildizlar@gmail.com', 'merve.gnc.946@gmail.com'],
};

export const hasPermission = (userEmail, module) => {
  if (module === 'admin') return userEmail === PERMISSIONS.admin;
  if (module === 'attendance') return PERMISSIONS.attendance.includes(userEmail);
  if (module === 'exam') return PERMISSIONS.exam.includes(userEmail);
  return false;
};