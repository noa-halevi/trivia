export const RANK_COLORS = [
  { hex: '#FFD700', rgb: '255, 215, 0' },
  { hex: '#00E5CC', rgb: '0, 229, 204' },
  { hex: '#C084FC', rgb: '192, 132, 252' },
  { hex: '#FF6B9D', rgb: '255, 107, 157' },
];

export function rankColorFor(index) {
  return RANK_COLORS[Math.min(index, RANK_COLORS.length - 1)];
}

export function sortScoresByTotal(scores = []) {
  return [...scores].sort(
    (left, right) => (Number(right.score) || 0) - (Number(left.score) || 0),
  );
}
