use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
    pub salt: String,
}

pub fn derive_key(password: &str, salt: &SaltString) -> [u8; 32] {
    let argon2 = Argon2::default();
    let mut key = [0u8; 32];
    let _ = argon2.hash_password_into(password.as_bytes(), salt.as_str().as_bytes(), &mut key);
    key
}

pub fn encrypt(data: &[u8], password: &str) -> Result<EncryptedData, String> {
    let salt = SaltString::generate(&mut OsRng);
    let key_bytes = derive_key(password, &salt);
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    getrandom::getrandom(&mut nonce_bytes).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| format!("Encryption failed: {}", e))?;

    Ok(EncryptedData {
        ciphertext,
        nonce: nonce_bytes.to_vec(),
        salt: salt.to_string(),
    })
}

pub fn decrypt(encrypted: &EncryptedData, password: &str) -> Result<Vec<u8>, String> {
    let salt = SaltString::from_b64(&encrypted.salt).map_err(|e| e.to_string())?;
    let key_bytes = derive_key(password, &salt);
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let nonce = Nonce::from_slice(&encrypted.nonce);

    let plaintext = cipher
        .decrypt(nonce, encrypted.ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed (is the password correct?): {}", e))?;

    Ok(plaintext)
}
