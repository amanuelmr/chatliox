// "Sam", "Sam and Ana", "Sam, Ana and Lee", "Sam, Ana and 2 others".
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`
}
