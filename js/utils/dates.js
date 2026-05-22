// ======================
// DATE FORMATTING
// ======================

// Format for LONG month
export function formatDate(dateString) {
  const [year, month, day] = dateString.split("-");

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Format for SHORT month
export function formatVisitDate(dateString) {
  const [year, month, day] = dateString.split("-");

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ======================
// DATE HELPERS
// ======================

export function sortVisitsByDate(visits) {
  return [...visits].sort(
    (a, b) => new Date(b.visit_date) - new Date(a.visit_date),
  );
}

export function getDaysSince(dateString) {
  const [year, month, day] = dateString.split("-");

  const visitDate = new Date(year, month - 1, day);

  const now = new Date();

  visitDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = now - visitDate;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function getYearsAgo(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);

  const today = new Date();

  let yearsAgo = today.getFullYear() - year;

  const hasNotReachedAnniversary =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);

  if (hasNotReachedAnniversary) {
    yearsAgo--;
  }

  return yearsAgo;
}
