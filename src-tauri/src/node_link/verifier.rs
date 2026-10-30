//! Проверка сертификата ноды Pocketnet. Сертификат самоподписанный, версии 1
//! («CN = Pocketnet node», у каждой ноды свой), поэтому цепочку проверять не
//! у кого: сверяется отпечаток SHA-256 с запомненным при первой встрече. А
//! подпись рукопожатия проверяется открытым ключом из этого сертификата —
//! без неё чужой сервер мог бы показать запомненный сертификат, не владея его
//! ключом. webpki сертификаты версии 1 не разбирает, поэтому ключ достаётся
//! из DER здесь же, а подпись проверяет ring.

use std::sync::{Arc, Mutex};

use ring::signature::{self, UnparsedPublicKey, VerificationAlgorithm};
use sha2::{Digest, Sha256};
use tokio_rustls::rustls::client::danger::{
    HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier,
};
use tokio_rustls::rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use tokio_rustls::rustls::{self, DigitallySignedStruct, SignatureScheme};

/// Текст ошибки, по которому JS узнаёт чужой сертификат.
pub const PIN_MISMATCH: &str = "pin_mismatch";

/// SHA-256 сертификата, hex в нижнем регистре.
pub fn fingerprint(cert: &[u8]) -> String {
    hex::encode(Sha256::digest(cert))
}

#[derive(Debug)]
pub struct PinVerifier {
    /// Запомненный отпечаток; None — первая встреча, годится любой.
    pin: Option<String>,
    /// Отпечаток, который показала нода, — его вернём в JS.
    pub seen: Arc<Mutex<Option<String>>>,
}

impl PinVerifier {
    pub fn new(pin: Option<String>) -> Self {
        Self {
            pin: pin.map(|p| p.to_ascii_lowercase()),
            seen: Arc::new(Mutex::new(None)),
        }
    }
}

impl ServerCertVerifier for PinVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        let fp = fingerprint(end_entity.as_ref());
        if let Ok(mut seen) = self.seen.lock() {
            *seen = Some(fp.clone());
        }
        match &self.pin {
            Some(pin) if *pin != fp => Err(rustls::Error::General(PIN_MISMATCH.into())),
            _ => Ok(ServerCertVerified::assertion()),
        }
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_signature(message, cert.as_ref(), dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_signature(message, cert.as_ref(), dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::RSA_PSS_SHA384,
            SignatureScheme::RSA_PSS_SHA512,
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::RSA_PKCS1_SHA384,
            SignatureScheme::RSA_PKCS1_SHA512,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ED25519,
        ]
    }
}

fn verify_signature(
    message: &[u8],
    cert: &[u8],
    dss: &DigitallySignedStruct,
) -> Result<HandshakeSignatureValid, rustls::Error> {
    let bad = |why: &str| rustls::Error::General(format!("node certificate: {why}"));
    let key = public_key(cert).ok_or_else(|| bad("no public key"))?;
    let alg: &'static dyn VerificationAlgorithm = match (key.kind, dss.scheme) {
        (KeyKind::Rsa, SignatureScheme::RSA_PSS_SHA256) => &signature::RSA_PSS_2048_8192_SHA256,
        (KeyKind::Rsa, SignatureScheme::RSA_PSS_SHA384) => &signature::RSA_PSS_2048_8192_SHA384,
        (KeyKind::Rsa, SignatureScheme::RSA_PSS_SHA512) => &signature::RSA_PSS_2048_8192_SHA512,
        (KeyKind::Rsa, SignatureScheme::RSA_PKCS1_SHA256) => &signature::RSA_PKCS1_2048_8192_SHA256,
        (KeyKind::Rsa, SignatureScheme::RSA_PKCS1_SHA384) => &signature::RSA_PKCS1_2048_8192_SHA384,
        (KeyKind::Rsa, SignatureScheme::RSA_PKCS1_SHA512) => &signature::RSA_PKCS1_2048_8192_SHA512,
        (KeyKind::P256, SignatureScheme::ECDSA_NISTP256_SHA256) => &signature::ECDSA_P256_SHA256_ASN1,
        (KeyKind::P384, SignatureScheme::ECDSA_NISTP384_SHA384) => &signature::ECDSA_P384_SHA384_ASN1,
        (KeyKind::Ed25519, SignatureScheme::ED25519) => &signature::ED25519,
        _ => return Err(bad("unsupported signature scheme")),
    };
    UnparsedPublicKey::new(alg, key.bytes)
        .verify(message, dss.signature())
        .map(|_| HandshakeSignatureValid::assertion())
        .map_err(|_| rustls::Error::InvalidCertificate(rustls::CertificateError::BadSignature))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyKind {
    Rsa,
    P256,
    P384,
    Ed25519,
}

#[derive(Debug)]
pub struct PublicKey<'a> {
    pub kind: KeyKind,
    /// В том виде, в каком его ждёт ring: RSAPublicKey (DER), точка EC, 32 байта Ed25519.
    pub bytes: &'a [u8],
}

const OID_RSA: &[u8] = &[0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
const OID_EC: &[u8] = &[0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01];
const OID_P256: &[u8] = &[0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07];
const OID_P384: &[u8] = &[0x2b, 0x81, 0x04, 0x00, 0x22];
const OID_ED25519: &[u8] = &[0x2b, 0x65, 0x70];

/// Элемент DER: (тег, содержимое, остаток после него).
fn tlv(buf: &[u8]) -> Option<(u8, &[u8], &[u8])> {
    let (&tag, rest) = buf.split_first()?;
    let (&first, rest) = rest.split_first()?;
    let (len, rest) = if first < 0x80 {
        (first as usize, rest)
    } else {
        let n = (first & 0x7f) as usize;
        if n == 0 || n > 4 || rest.len() < n {
            return None;
        }
        let len = rest[..n].iter().fold(0usize, |acc, &b| (acc << 8) | b as usize);
        (len, &rest[n..])
    };
    if rest.len() < len {
        return None;
    }
    Some((tag, &rest[..len], &rest[len..]))
}

fn expect(buf: &[u8], tag: u8) -> Option<(&[u8], &[u8])> {
    let (t, content, rest) = tlv(buf)?;
    (t == tag).then_some((content, rest))
}

/// Открытый ключ из сертификата X.509 любой версии.
pub fn public_key(cert: &[u8]) -> Option<PublicKey<'_>> {
    const SEQ: u8 = 0x30;
    let (certificate, _) = expect(cert, SEQ)?;
    let (tbs, _) = expect(certificate, SEQ)?;
    let mut rest = tbs;
    // version [0] есть только у v2/v3.
    if rest.first() == Some(&0xa0) {
        rest = tlv(rest)?.2;
    }
    rest = expect(rest, 0x02)?.1; // serialNumber
    for _ in 0..4 {
        rest = expect(rest, SEQ)?.1; // signature, issuer, validity, subject
    }
    let (spki, _) = expect(rest, SEQ)?;
    let (algorithm, spki_rest) = expect(spki, SEQ)?;
    let (oid, params) = expect(algorithm, 0x06)?;
    let (bits, _) = expect(spki_rest, 0x03)?;
    let (&unused, key) = bits.split_first()?;
    if unused != 0 {
        return None;
    }
    let kind = if oid == OID_RSA {
        KeyKind::Rsa
    } else if oid == OID_ED25519 {
        KeyKind::Ed25519
    } else if oid == OID_EC {
        match expect(params, 0x06)?.0 {
            curve if curve == OID_P256 => KeyKind::P256,
            curve if curve == OID_P384 => KeyKind::P384,
            _ => return None,
        }
    } else {
        return None;
    };
    Some(PublicKey { kind, bytes: key })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Сертификат живой ноды (109.197.196.106:38881), версии 1.
    const NODE_CERT: &[u8] = include_bytes!("testdata/pocketnet-node-cert.der");

    #[test]
    fn reads_the_rsa_key_of_a_v1_node_certificate() {
        let key = public_key(NODE_CERT).expect("public key");
        assert_eq!(key.kind, KeyKind::Rsa);
        // RSAPublicKey — SEQUENCE { modulus, exponent }; модуль 2048 бит.
        let (body, rest) = expect(key.bytes, 0x30).unwrap();
        assert!(rest.is_empty());
        let (modulus, _) = expect(body, 0x02).unwrap();
        assert!(modulus.len() == 256 || modulus.len() == 257);
    }

    #[test]
    fn fingerprint_is_sha256_hex() {
        assert_eq!(
            fingerprint(NODE_CERT),
            "9b59a9ab44f15501fa16f1445f03da439b2f62a6224d19cdaec579376ef35b90"
        );
    }

    #[test]
    fn rejects_truncated_or_foreign_der() {
        assert!(public_key(&NODE_CERT[..100]).is_none());
        assert!(public_key(&[0x30, 0x03, 0x02, 0x01, 0x01]).is_none());
        assert!(public_key(&[]).is_none());
    }

    fn verify(verifier: &PinVerifier) -> Result<ServerCertVerified, rustls::Error> {
        verifier.verify_server_cert(
            &CertificateDer::from(NODE_CERT),
            &[],
            &ServerName::try_from("109.197.196.106").unwrap(),
            &[],
            UnixTime::now(),
        )
    }

    #[test]
    fn first_meeting_accepts_and_records_the_certificate() {
        let v = PinVerifier::new(None);
        assert!(verify(&v).is_ok());
        assert_eq!(v.seen.lock().unwrap().as_deref(), Some(fingerprint(NODE_CERT).as_str()));
    }

    #[test]
    fn pinned_certificate_must_match() {
        let same = PinVerifier::new(Some(fingerprint(NODE_CERT).to_uppercase()));
        assert!(verify(&same).is_ok());
        let other = PinVerifier::new(Some("00".repeat(32)));
        let err = verify(&other).unwrap_err();
        assert!(err.to_string().contains(PIN_MISMATCH));
        // Отпечаток показанного всё равно известен.
        assert!(other.seen.lock().unwrap().is_some());
    }
}
