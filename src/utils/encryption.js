// Şifreleme için basit bir yardımcı
// Production'da daha güçlü bir yöntem kullanılabilir (örn: crypto-js ile AES)
// Bu örnekte base64 ile basit bir encoding yapıyoruz.
// DİKKAT: Bu yöntem gerçek güvenlik sağlamaz, sadece veriyi gizler.
// İleride crypto-js veya Node.js crypto modülü ile değiştirilebilir.

export const encrypt = (text) => {
  if (!text) return text;
  // Basit bir obfuscation (şifreleme değil, sadece gizleme)
  // Gerçek projede crypto-js AES kullanılmalı
  return btoa(encodeURIComponent(text));
};

export const decrypt = (encryptedText) => {
  if (!encryptedText) return encryptedText;
  try {
    return decodeURIComponent(atob(encryptedText));
  } catch {
    return encryptedText;
  }
};