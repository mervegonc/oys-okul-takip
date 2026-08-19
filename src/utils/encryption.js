import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'hstr4b5fBHT%Y5h2g5bhTHbjbglmfbn5hnhjjgnXfm';

export const encrypt = (text) => {
  if (!text || typeof text !== 'string') return '';
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
};

// Şifreli mi kontrol et (AES şifreli metin genelde uzun ve base64 karakterleri içerir)
export const isEncrypted = (text) => {
  if (!text || typeof text !== 'string') return false;
  // Şifreli metin genelde "/" ve "+" içerir ve uzundur
  return text.length > 20 && /^[A-Za-z0-9+/=]+$/.test(text);
};

export const decrypt = (ciphertext) => {
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  
  // Eğer şifreli değilse, olduğu gibi döndür
  if (!isEncrypted(ciphertext)) {
    return ciphertext;
  }

  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    // Eğer çözülen metin boş veya geçersiz ise, orijinali döndür
    if (!decrypted) return ciphertext;
    return decrypted;
  } catch (error) {
    console.error('Şifre çözme hatası:', error);
    return ciphertext; // Hata durumunda orijinali döndür
  }
};