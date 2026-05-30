const IV_LENGTH = 12

async function importKey(secret: string): Promise<CryptoKey> {
	const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
	return crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function b64UrlEncode(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, '+').replace(/_/g, '/')
	const padding = (4 - (padded.length % 4)) % 4
	const binary = atob(padded + '='.repeat(padding))
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

export async function encryptUrl(plaintext: string, secret: string): Promise<string> {
	const key = await importKey(secret)
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		new TextEncoder().encode(plaintext),
	)
	const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
	combined.set(iv)
	combined.set(new Uint8Array(ciphertext), IV_LENGTH)
	return b64UrlEncode(combined)
}

export async function decryptUrl(token: string, secret: string): Promise<string> {
	const key = await importKey(secret)
	const combined = b64UrlDecode(token)
	const iv = combined.slice(0, IV_LENGTH)
	const ciphertext = combined.slice(IV_LENGTH)
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
	return new TextDecoder().decode(plaintext)
}

export function b64Encode(str: string) {
  return encodeURIComponent(
	  btoa(
		  encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
				String.fromCharCode(Number.parseInt(p1, 16)),
			),
		),
	);
}

export function b64Decode(str: string) {
	return decodeURIComponent(
		Array.prototype.map
			.call(
				atob(decodeURIComponent(str)),
				(c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`,
			)
			.join(""),
	);
}

export function simplifyNumber(num: number): string {
	const units = ['', 'K', 'M', 'B', 'T'];
	const order = Math.floor(Math.log10(Math.abs(num)) / 3);
	
	if (order < 0) return num.toString();
	if (order >= units.length) return num.toString();
	
	const divisor = Math.pow(10, order * 3);
	const simplified = (num / divisor).toFixed(1);
	
	const formatted = simplified.endsWith('.0') 
		? simplified.slice(0, -2) 
		: simplified;
		
	return formatted + units[order];
}
