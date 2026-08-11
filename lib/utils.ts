export function normalizeText(text: string): string {
  return text
    .normalize("NFD") // Normalize to NFD (Canonical Decomposition)
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase() // Convert to lowercase
    .trim(); // Trim whitespace
}
