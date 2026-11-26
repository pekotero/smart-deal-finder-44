// Reseñas de tiendas: el promedio se muestra recién con MIN_REVIEWS, para que no lo defina una
// sola opinión.
export const MIN_REVIEWS = 10;

export function reviewSummary(ratings: number[]) {
  const valid = ratings.filter((r) => r >= 1 && r <= 5);
  const count = valid.length;
  const avg = count >= MIN_REVIEWS ? Math.round((valid.reduce((a, b) => a + b, 0) / count) * 10) / 10 : null;
  return { count, avg };
}
