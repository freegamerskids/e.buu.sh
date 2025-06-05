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