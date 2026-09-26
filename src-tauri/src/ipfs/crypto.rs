//! Симметричное шифрование файлов для приватного шаринга (AES-256-GCM).
//! Ключ генерируется на публикацию и едет в фрагменте ссылки (никогда не уходит
//! на gateway). Envelope не нужен — имя файла везём в ссылке, шифруем сырые байты.
//!
//! Два формата:
//! - v1 — `nonce(12) || ciphertext+tag` одним куском: файл целиком в памяти,
//!   отсюда потолок 512 МБ. Только для чтения старых ссылок.
//! - v2 — кусками (см. encrypt_stream): память не растёт с размером файла.
use aes_gcm::aead::{Aead, KeyInit, OsRng, Payload};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use std::io::{Read, Write};

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("encrypt/decrypt failed")]
    Aead,
    #[error("bad key")]
    BadKey,
    #[error("ciphertext too short")]
    TooShort,
    #[error("not an encrypted file of a known format")]
    Format,
    #[error("the file is too large")]
    TooLarge,
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

const NONCE_LEN: usize = 12;

/// `n` случайных байт из CSPRNG в hex (секрет RPC-авторизации Kubo).
pub fn random_hex(n: usize) -> String {
    use aes_gcm::aead::rand_core::RngCore;
    let mut buf = vec![0u8; n];
    OsRng.fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

/// Шифрует байты случайным ключом (v1). Возвращает (base64-ключ, nonce||ciphertext).
/// v1 больше не пишется — шифратор остался для тестов чтения старых ссылок.
#[cfg(test)]
pub fn encrypt(plaintext: &[u8]) -> Result<(String, Vec<u8>), CryptoError> {
    use aes_gcm::AeadCore;
    let key = Aes256Gcm::generate_key(&mut OsRng);
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher.encrypt(&nonce, plaintext).map_err(|_| CryptoError::Aead)?;

    let mut blob = Vec::with_capacity(NONCE_LEN + ct.len());
    blob.extend_from_slice(nonce.as_slice());
    blob.extend_from_slice(&ct);
    Ok((B64.encode(key), blob))
}

fn decode_key(key_b64: &str) -> Result<Aes256Gcm, CryptoError> {
    let key_bytes = B64.decode(key_b64.trim()).map_err(|_| CryptoError::BadKey)?;
    if key_bytes.len() != 32 {
        return Err(CryptoError::BadKey);
    }
    Ok(Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key_bytes)))
}

/// Расшифровывает `nonce||ciphertext` (v1) base64-ключом.
pub fn decrypt(key_b64: &str, blob: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher = decode_key(key_b64)?;
    if blob.len() <= NONCE_LEN {
        return Err(CryptoError::TooShort);
    }
    let (nonce_bytes, ct) = blob.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher.decrypt(nonce, ct).map_err(|_| CryptoError::Aead)
}

// ---------------------------------------------------------------------------
// v2: кусками (STREAM на AES-256-GCM)
// ---------------------------------------------------------------------------
//
// Файл режется на куски по STREAM_CHUNK, каждый — отдельный AES-GCM со своим
// nonce: префикс из заголовка || номер куска || признак последнего. Номер не
// даёт переставить куски, признак — отрезать хвост; заголовок входит в AAD
// каждого куска, подменить его параметры нельзя. Та же схема у age и Tink.
// Браузер читает формат так же (src/helpers/ipfs/ipfs-secret.ts).
//
// Заголовок, 16 байт: "BSTN" | версия 2 | размер куска u32 BE | префикс nonce (7).

pub const STREAM_MAGIC: &[u8; 4] = b"BSTN";
pub const STREAM_VERSION: u8 = 2;
/// Кусок открытого текста; зашифрованный на 16 байт тега длиннее.
pub const STREAM_CHUNK: usize = 1024 * 1024;
const PREFIX_LEN: usize = 7;
pub const STREAM_HEADER_LEN: usize = 4 + 1 + 4 + PREFIX_LEN;
const TAG_LEN: usize = 16;
/// Больше кусок не бывает: иначе «кусок» из чужого заголовка съел бы память.
const MAX_STREAM_CHUNK: usize = 16 * 1024 * 1024;

fn chunk_nonce(prefix: &[u8], counter: u32, last: bool) -> [u8; 12] {
    let mut nonce = [0u8; 12];
    nonce[..PREFIX_LEN].copy_from_slice(prefix);
    nonce[PREFIX_LEN..PREFIX_LEN + 4].copy_from_slice(&counter.to_be_bytes());
    nonce[11] = u8::from(last);
    nonce
}

/// Читает до `want` байт (меньше — только в конце потока).
fn read_up_to<R: Read>(src: &mut R, want: usize) -> std::io::Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(want);
    src.take(want as u64).read_to_end(&mut buf)?;
    Ok(buf)
}

/// Шифрует поток кусками случайным ключом; возвращает base64-ключ.
pub fn encrypt_stream<R: Read, W: Write>(src: R, dst: W) -> Result<String, CryptoError> {
    use aes_gcm::aead::rand_core::RngCore;
    let key = Aes256Gcm::generate_key(&mut OsRng);
    let mut prefix = [0u8; PREFIX_LEN];
    OsRng.fill_bytes(&mut prefix);
    encrypt_stream_with(&key, &prefix, STREAM_CHUNK, src, dst)?;
    Ok(B64.encode(key))
}

fn encrypt_stream_with<R: Read, W: Write>(
    key: &Key<Aes256Gcm>,
    prefix: &[u8; PREFIX_LEN],
    chunk: usize,
    mut src: R,
    mut dst: W,
) -> Result<(), CryptoError> {
    let cipher = Aes256Gcm::new(key);
    let mut header = Vec::with_capacity(STREAM_HEADER_LEN);
    header.extend_from_slice(STREAM_MAGIC);
    header.push(STREAM_VERSION);
    header.extend_from_slice(&(chunk as u32).to_be_bytes());
    header.extend_from_slice(prefix);
    dst.write_all(&header)?;

    // Кусок уходит, когда прочитан следующий: иначе не узнать, последний ли он.
    let mut current = read_up_to(&mut src, chunk)?;
    let mut counter: u32 = 0;
    loop {
        let next = read_up_to(&mut src, chunk)?;
        let last = next.is_empty();
        let nonce = chunk_nonce(prefix, counter, last);
        let payload = Payload { msg: &current, aad: &header };
        let sealed = cipher
            .encrypt(Nonce::from_slice(&nonce), payload)
            .map_err(|_| CryptoError::Aead)?;
        dst.write_all(&sealed)?;
        if last {
            return Ok(dst.flush()?);
        }
        current = next;
        counter = counter.checked_add(1).ok_or(CryptoError::TooLarge)?;
    }
}

/// Расшифровывает поток v2 в `dst`; возвращает число байт открытого текста.
/// Всё, что не сошлось (ключ, порядок, обрезанный хвост), — ошибка, а в `dst`
/// к этому моменту могут лежать первые куски: писать во временный файл.
pub fn decrypt_stream<R: Read, W: Write>(
    key_b64: &str,
    mut src: R,
    mut dst: W,
    max_bytes: u64,
) -> Result<u64, CryptoError> {
    let cipher = decode_key(key_b64)?;
    let mut header = [0u8; STREAM_HEADER_LEN];
    src.read_exact(&mut header).map_err(|_| CryptoError::TooShort)?;
    if &header[..4] != STREAM_MAGIC || header[4] != STREAM_VERSION {
        return Err(CryptoError::Format);
    }
    let chunk = u32::from_be_bytes([header[5], header[6], header[7], header[8]]) as usize;
    if chunk == 0 || chunk > MAX_STREAM_CHUNK {
        return Err(CryptoError::Format);
    }
    let prefix = &header[9..];
    let sealed_len = chunk + TAG_LEN;

    let mut current = read_up_to(&mut src, sealed_len)?;
    let mut counter: u32 = 0;
    let mut written: u64 = 0;
    loop {
        let next = read_up_to(&mut src, sealed_len)?;
        let last = next.is_empty();
        if current.len() < TAG_LEN {
            return Err(CryptoError::TooShort);
        }
        let nonce = chunk_nonce(prefix, counter, last);
        let payload = Payload { msg: &current, aad: &header };
        let plain = cipher
            .decrypt(Nonce::from_slice(&nonce), payload)
            .map_err(|_| CryptoError::Aead)?;
        written += plain.len() as u64;
        if written > max_bytes {
            return Err(CryptoError::TooLarge);
        }
        dst.write_all(&plain)?;
        if last {
            dst.flush()?;
            return Ok(written);
        }
        current = next;
        counter = counter.checked_add(1).ok_or(CryptoError::TooLarge)?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_hex_is_hex_and_unique() {
        let a = random_hex(32);
        let b = random_hex(32);
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

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

    fn pattern(n: usize) -> Vec<u8> {
        (0..n).map(|i| ((i * 37 + 11) % 256) as u8).collect()
    }

    /// Мелкие куски — чтобы и кратный, и некратный размер проходили несколько кусков.
    fn seal(plain: &[u8], chunk: usize) -> (String, Vec<u8>) {
        let key = Aes256Gcm::generate_key(&mut OsRng);
        let mut out = Vec::new();
        encrypt_stream_with(&key, &[7; PREFIX_LEN], chunk, plain, &mut out).unwrap();
        (B64.encode(key), out)
    }

    fn open(key: &str, sealed: &[u8]) -> Result<Vec<u8>, CryptoError> {
        let mut out = Vec::new();
        decrypt_stream(key, sealed, &mut out, u64::MAX)?;
        Ok(out)
    }

    #[test]
    fn stream_roundtrips_any_size() {
        for n in [0, 1, 99, 100, 101, 1000, 1024] {
            let (key, sealed) = seal(&pattern(n), 100);
            assert_eq!(open(&key, &sealed).unwrap(), pattern(n), "{n} bytes");
            // Заголовок и по тегу на каждый кусок; пустой файл — один кусок.
            let chunks = n.div_ceil(100).max(1);
            assert_eq!(sealed.len(), STREAM_HEADER_LEN + n + chunks * TAG_LEN);
        }
        // С настоящим размером куска и случайным ключом.
        let mut sealed = Vec::new();
        let key = encrypt_stream(&pattern(3 * STREAM_CHUNK + 5)[..], &mut sealed).unwrap();
        assert_eq!(open(&key, &sealed).unwrap(), pattern(3 * STREAM_CHUNK + 5));
    }

    #[test]
    fn stream_rejects_reordering_truncation_and_tampering() {
        let (key, sealed) = seal(&pattern(250), 100);
        let body = STREAM_HEADER_LEN;
        let sealed_chunk = 100 + TAG_LEN;
        // Отрезан последний кусок: предыдущий не помечен последним.
        let cut = &sealed[..body + 2 * sealed_chunk];
        assert!(matches!(open(&key, cut), Err(CryptoError::Aead)));
        // Переставлены первые два куска.
        let mut swapped = sealed[..body].to_vec();
        swapped.extend_from_slice(&sealed[body + sealed_chunk..body + 2 * sealed_chunk]);
        swapped.extend_from_slice(&sealed[body..body + sealed_chunk]);
        swapped.extend_from_slice(&sealed[body + 2 * sealed_chunk..]);
        assert!(matches!(open(&key, &swapped), Err(CryptoError::Aead)));
        // Подменён размер куска в заголовке (он в AAD).
        let mut header_swapped = sealed.clone();
        header_swapped[8] ^= 1;
        assert!(open(&key, &header_swapped).is_err());
        // Чужой ключ, не тот формат (v1), обрезанный заголовок.
        let (other, _) = seal(b"x", 100);
        assert!(matches!(open(&other, &sealed), Err(CryptoError::Aead)));
        let (v1_key, v1_blob) = encrypt(b"old format").unwrap();
        assert!(matches!(open(&v1_key, &v1_blob), Err(CryptoError::Format)));
        assert!(matches!(open(&key, &sealed[..5]), Err(CryptoError::TooShort)));
    }

    #[test]
    fn stream_stops_at_the_size_limit() {
        let (key, sealed) = seal(&pattern(1000), 100);
        let mut out = Vec::new();
        let res = decrypt_stream(&key, &sealed[..], &mut out, 500);
        assert!(matches!(res, Err(CryptoError::TooLarge)));
        assert!(out.len() <= 500);
    }

    /// Фикстура собрана независимо (testdata/make-secret-v2.mjs, node:crypto);
    /// её же читает браузерный тест (src/helpers/ipfs/ipfs-secret.test.ts).
    #[test]
    fn stream_reads_the_independent_fixture() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src/ipfs/testdata/secret-v2.bin");
        let key = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
        let sealed = std::fs::read(path).unwrap();
        assert_eq!(open(key, &sealed).unwrap(), pattern(2500));
        // И наш шифратор с тем же ключом и префиксом даёт те же байты.
        let key_bytes = Key::<Aes256Gcm>::from_slice(&B64.decode(key).unwrap()).to_owned();
        let mut ours = Vec::new();
        encrypt_stream_with(&key_bytes, &[1, 2, 3, 4, 5, 6, 7], 1000, &pattern(2500)[..], &mut ours)
            .unwrap();
        assert_eq!(ours, sealed);
    }
}
