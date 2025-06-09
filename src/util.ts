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
