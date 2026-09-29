use crate::Rng;
use ed25519_dalek::Signer;
use ed25519_dalek::Verifier;

pub struct Ed25519PrivateKey {
    inner: ed25519_dalek::SigningKey,
}

pub struct Ed25519PublicKey {
    /// Bastyon: None — байты не точка кривой. Ключ приходит из сети (announce,
    /// LINKIDENTIFY) и может быть любым: такой не проходит ни одну проверку
    /// подписи, а не роняет поток узла паникой.
    inner: Option<ed25519_dalek::VerifyingKey>,
    bytes: [u8; 32],
}

impl Ed25519PrivateKey {
    pub fn from_bytes(seed: &[u8; 32]) -> Self {
        Ed25519PrivateKey {
            inner: ed25519_dalek::SigningKey::from_bytes(seed),
        }
    }

    pub fn generate(rng: &mut dyn Rng) -> Self {
        let mut seed = [0u8; 32];
        rng.fill_bytes(&mut seed);
        Self::from_bytes(&seed)
    }

    pub fn private_bytes(&self) -> [u8; 32] {
        self.inner.to_bytes()
    }

    pub fn public_key(&self) -> Ed25519PublicKey {
        let key = self.inner.verifying_key();
        Ed25519PublicKey {
            bytes: key.to_bytes(),
            inner: Some(key),
        }
    }

    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.inner.sign(message).to_bytes()
    }
}

impl Ed25519PublicKey {
    pub fn from_bytes(data: &[u8; 32]) -> Self {
        Ed25519PublicKey {
            inner: ed25519_dalek::VerifyingKey::from_bytes(data).ok(),
            bytes: *data,
        }
    }

    pub fn public_bytes(&self) -> [u8; 32] {
        self.bytes
    }

    pub fn verify(&self, signature: &[u8; 64], message: &[u8]) -> bool {
        let Some(key) = &self.inner else {
            return false;
        };
        let sig = ed25519_dalek::Signature::from_bytes(signature);
        key.verify(message, &sig).is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ed25519_sign_verify_roundtrip() {
        let seed = [42u8; 32];
        let key = Ed25519PrivateKey::from_bytes(&seed);
        let pubkey = key.public_key();
        let msg = b"Hello, Ed25519!";
        let sig = key.sign(msg);
        assert!(pubkey.verify(&sig, msg));
    }

    #[test]
    fn test_ed25519_verify_tampered() {
        let seed = [42u8; 32];
        let key = Ed25519PrivateKey::from_bytes(&seed);
        let pubkey = key.public_key();
        let msg = b"Hello, Ed25519!";
        let sig = key.sign(msg);
        assert!(!pubkey.verify(&sig, b"Hello, Ed25519?"));
    }

    #[test]
    fn test_ed25519_pubkey_deterministic() {
        let seed = [1u8; 32];
        let key1 = Ed25519PrivateKey::from_bytes(&seed);
        let key2 = Ed25519PrivateKey::from_bytes(&seed);
        assert_eq!(
            key1.public_key().public_bytes(),
            key2.public_key().public_bytes()
        );
    }

    /// Bastyon: байты, которые не точка кривой, — ключ, который ничего не
    /// подтверждает (раньше — паника).
    #[test]
    fn invalid_public_key_never_verifies() {
        let bad = [7u8; 32];
        assert!(ed25519_dalek::VerifyingKey::from_bytes(&bad).is_err());
        let key = Ed25519PublicKey::from_bytes(&bad);
        assert_eq!(key.public_bytes(), bad);
        assert!(!key.verify(&[0u8; 64], b"message"));
        let identity = crate::identity::Identity::from_public_key(&[7u8; 64]);
        assert!(!identity.verify(&[0u8; 64], b"message"));
    }
}
