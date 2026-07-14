/**
 * Wiki copy is authored independently from the presentation layer. Keep the
 * wording intact while normalising long dash glyphs that break the public
 * portfolio's typographic system.
 */
export function displayText(value: string): string {
  return value.replace(/[—–]/g, '-');
}
