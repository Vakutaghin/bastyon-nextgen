//! Симметричное шифрование файлов для приватного шаринга (AES-256-GCM).
//! Ключ генерируется на публикацию и едет в фрагменте ссылки (никогда не уходит
//! на gateway). Формат блоба: `nonce(12) || ciphertext+tag`. Envelope не нужен —
//! имя файла везём в ссылке, шифруем сырые байты.
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("encrypt/decrypt failed")]
    Aead,
    #[error("bad key")]
    BadKey,
    #[error("ciphertext too short")]
    TooShort,
}

const NONCE_LEN: usize = 12;

/// Шифрует байты случайным ключом. Возвращает (base64-ключ, nonce||ciphertext).
pub fn encrypt(plaintext: &[u8]) -> Result<(String, Vec<u8>), CryptoError> {
    let key = Aes256Gcm::generate_key(&mut OsRng);
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher.encrypt(&nonce, plaintext).map_err(|_| CryptoError::Aead)?;

    let mut blob = Vec::with_capacity(NONCE_LEN + ct.len());
    blob.extend_from_slice(nonce.as_slice());
    blob.extend_from_slice(&ct);
    Ok((B64.encode(key), blob))
}

/// Расшифровывает `nonce||ciphertext` base64-ключом.
pub fn decrypt(key_b64: &str, blob: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let key_bytes = B64.decode(key_b64.trim()).map_err(|_| CryptoError::BadKey)?;
    if key_bytes.len() != 32 {
        return Err(CryptoError::BadKey);
    }
    if blob.len() <= NONCE_LEN {
        return Err(CryptoError::TooShort);
    }
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let (nonce_bytes, ct) = blob.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher.decrypt(nonce, ct).map_err(|_| CryptoError::Aead)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrips_bytes() {
        let data = b"hello \x00 binary \xff payload".to_vec();
        let (key, blob) = encrypt(&data).unwrap();
        assert!(blob.len() > NONCE_LEN);
        assert_ne!(&blob[NONCE_LEN..], &data[..]); // действительно зашифровано
        let out = decrypt(&key, &blob).unwrap();
        assert_eq!(out, data);
    }

    #[test]
    fn wrong_key_fails() {
        let (_k, blob) = encrypt(b"secret").unwrap();
        let (other, _b) = encrypt(b"other").unwrap();
        assert!(decrypt(&other, &blob).is_err());
    }

    #[test]
    fn tampered_blob_fails() {
        let (key, mut blob) = encrypt(b"secret").unwrap();
        let last = blob.len() - 1;
        blob[last] ^= 0x01; // портим тег
        assert!(decrypt(&key, &blob).is_err());
    }

    #[test]
    fn rejects_bad_key_and_short_blob() {
        // Невалидный base64 → ошибка.
        assert!(decrypt("not-base64!!", b"whatever").is_err());
        // Валидный 32-байтный ключ, но слишком короткий блоб → TooShort.
        let (key, _blob) = encrypt(b"x").unwrap();
        assert!(matches!(decrypt(&key, &[0u8; 4]), Err(CryptoError::TooShort)));
    }
}
