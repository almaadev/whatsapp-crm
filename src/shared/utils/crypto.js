// Symmetric AES-GCM encryption/decryption helper that works in both Node.js and Browser
const ALGORITHM = "AES-GCM";

async function getKey(password) {
  const enc = new TextEncoder();
  const rawKey = enc.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", rawKey);
  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(text, password) {
  try {
    const enc = new TextEncoder();
    const key = await getKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      enc.encode(text)
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error("Encryption failed:", error);
    throw error;
  }
}

export async function decrypt(ciphertextBase64, password) {
  try {
    const binary = atob(ciphertextBase64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const key = await getKey(password);
    const dec = new TextDecoder();
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );

    return dec.decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw error;
  }
}
