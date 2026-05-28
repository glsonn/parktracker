import { formatDate, getDaysSince, getYearsAgo } from "./dates.js";

export function getReflectionMessage(visits, parks) {
  if (visits.length === 0) {
    return null;
  }

  const reflections = [];

  // ======================
  // REVISITED PARKS
  // ======================
  const revisited = getRevisitedParks(visits);

  if (revisited.length > 0) {
    reflections.push(
      `You’ve revisited ${revisited.length} park${
        revisited.length === 1 ? "" : "s"
      } more than once.`,
    );
  }

  // ======================
  // MOST VISITED PARK
  // ======================
  const favorite = getMostVisitedPark(visits, parks);

  if (favorite) {
    reflections.push(`Your most revisited park is ${favorite.parkName}.`);
  }

  // ======================
  // SEASONAL PATTERN
  // ======================
  const activeMonth = getMostActiveMonth(visits);

  if (activeMonth) {
    reflections.push(`Most of your visits happen in ${activeMonth}.`);
  }

  // ======================
  // LONG-TERM TRACKING
  // ======================
  const years = getTrackingYears(visits);

  if (years && years >= 1) {
    reflections.push(
      years === 1
        ? "Your park history now spans more than a year."
        : `Your park history now spans ${years} years.`,
    );
  }

  // ======================
  // FALLBACK
  // ======================
  if (reflections.length === 0) {
    return "Every visit becomes part of the story over time.";
  }

  // Randomize the reflections a bit by using day of year as index
  const today = new Date();

  const startOfYear = new Date(today.getFullYear(), 0, 0);

  const diff =
    today -
    startOfYear +
    (startOfYear.getTimezoneOffset() - today.getTimezoneOffset()) * 60 * 1000;

  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  const index = dayOfYear % reflections.length;

  return reflections[index];
}

export function getRevisitedParks(visits) {
  const counts = {};

  for (const visit of visits) {
    counts[visit.park_id] = (counts[visit.park_id] || 0) + 1;
  }

  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([parkId, count]) => ({
      parkId: Number(parkId),
      count,
    }));
}

export function getMostVisitedPark(visits, parks) {
  const revisited = getRevisitedParks(visits);

  if (revisited.length === 0) {
    return null;
  }

  revisited.sort((a, b) => b.count - a.count);

  const top = revisited[0];

  const park = parks.find((p) => p.id === top.parkId);

  if (!park) {
    return null;
  }

  return {
    parkName: park.park_name,
    count: top.count,
  };
}

export function getMostActiveMonth(visits) {
  if (visits.length < 3) {
    return null;
  }

  const monthCounts = {};

  for (const visit of visits) {
    const [year, month] = visit.visit_date.split("-");

    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }

  let topMonth = null;
  let topCount = 0;

  for (const month in monthCounts) {
    if (monthCounts[month] > topCount) {
      topMonth = Number(month);
      topCount = monthCounts[month];
    }
  }

  if (!topMonth) {
    return null;
  }

  const monthName = new Date(2025, topMonth - 1, 1).toLocaleDateString(
    undefined,
    {
      month: "long",
    },
  );

  return monthName;
}

export function getTrackingYears(visits) {
  if (visits.length === 0) {
    return null;
  }

  const sorted = [...visits].sort(
    (a, b) => new Date(a.visit_date) - new Date(b.visit_date),
  );

  const firstVisit = sorted[0];

  return getYearsAgo(firstVisit.visit_date);
}

export function getOnThisDayMemories(visits, parks) {
  const today = new Date();

  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const visitsByPark = {};

  // ======================
  // GROUP VALID VISITS
  // ======================
  for (const visit of visits) {
    if (!visit?.visit_date || !visit?.park_id) {
      continue;
    }

    if (!visitsByPark[visit.park_id]) {
      visitsByPark[visit.park_id] = [];
    }

    visitsByPark[visit.park_id].push(visit);
  }

  const memories = [];

  // ======================
  // FIRST VISIT MEMORIES
  // ======================
  for (const parkId in visitsByPark) {
    const visits = [...visitsByPark[parkId]].sort(
      (a, b) => new Date(a.visit_date) - new Date(b.visit_date),
    );

    const firstVisit = visits[0];

    if (!firstVisit?.visit_date) {
      continue;
    }

    const parts = firstVisit.visit_date.split("-");

    if (parts.length !== 3) {
      continue;
    }

    const [year, month, day] = parts.map(Number);

    // exact anniversary only
    if (month !== todayMonth || day !== todayDay) {
      continue;
    }

    const yearsAgo = getYearsAgo(firstVisit.visit_date);

    if (yearsAgo < 1) {
      continue;
    }

    const park = state.parks.find((p) => Number(p.id) === Number(parkId));

    if (!park?.park_name) {
      continue;
    }

    memories.push({
      type: "first_visit",
      yearsAgo,
      text:
        yearsAgo === 1
          ? `You first visited ${park.park_name} 1 year ago today.`
          : `You first visited ${park.park_name} ${yearsAgo} years ago today.`,
    });
  }

  // ======================
  // FALLBACK MEMORIES
  // ======================
  if (memories.length === 0) {
    for (const visit of visits) {
      if (!visit?.visit_date) {
        continue;
      }

      const parts = visit.visit_date.split("-");

      if (parts.length !== 3) {
        continue;
      }

      const [year, month, day] = parts.map(Number);

      if (month !== todayMonth || day !== todayDay) {
        continue;
      }

      const yearsAgo = getYearsAgo(visit.visit_date);

      if (yearsAgo < 1) {
        continue;
      }

      const park = state.parks.find(
        (p) => Number(p.id) === Number(visit.park_id),
      );

      if (!park?.park_name) {
        continue;
      }

      memories.push({
        type: "visit",
        yearsAgo,
        text:
          yearsAgo === 1
            ? `1 year ago today you visited ${park.park_name}.`
            : `${yearsAgo} years ago today you visited ${park.park_name}.`,
      });
    }
  }

  memories.sort((a, b) => b.yearsAgo - a.yearsAgo);

  return memories.slice(0, 2);
}

export function getMomentumMessage(visits, nextAchievement) {
  // ======================
  // THIS MONTH
  // ======================
  const now = new Date();

  const thisMonthVisits = visits.filter((visit) => {
    const [year, month, day] = visit.visit_date.split("-");

    const date = new Date(year, month - 1, day);

    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });

  if (thisMonthVisits.length >= 3) {
    return `You’ve visited ${thisMonthVisits.length} parks this month.`;
  }

  // ======================
  // NEXT MILESTONE
  // ======================
  if (nextAchievement) {
    const uniqueVisited = new Set(visits.map((v) => v.park_id)).size;
    const halfway = Math.floor(nextAchievement.threshold / 2);

    if (uniqueVisited >= halfway) {
      return "You’re making steady progress toward your next milestone.";
    }
  }

  // ======================
  // FALLBACK
  // ======================
  return "Every park visit adds another story to the journey.";
}
