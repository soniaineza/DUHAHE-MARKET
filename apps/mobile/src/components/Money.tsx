export function fmtRWF(n: number): string {
  const s = Math.abs(Math.round(n)).toString();
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '-' : ''}${grouped} RWF`;
}