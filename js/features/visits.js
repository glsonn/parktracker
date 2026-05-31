// js/features/visits.js

import { sortVisitsByDate, getDaysSince } from "../utils/dates.js";

export function getVisitedParkIds(visits) {
  return new Set(visits.map((v) => v.park_id));
}

export function getVisitStats(visits, parkId) {
  const parkVisits = visits.filter((visit) => visit.park_id === parkId);

  const visitCount = parkVisits.length;

  if (visitCount === 0) {
    return {
      visitCount: 0,
      lastVisited: null,
    };
  }

  const sortedVisits = sortVisitsByDate(parkVisits);

  return {
    visitCount,
    lastVisited: sortedVisits[0].visit_date,
  };
}

export function getLastVisitMessage(visits, parkId) {
  const stats = getVisitStats(visits, parkId);

  if (!stats.lastVisited) {
    return null;
  }

  const days = getDaysSince(stats.lastVisited);

  // very recent
  if (days <= 7) {
    return "You visited this park recently.";
  }

  // weeks
  if (days < 30) {
    return `You last visited this park ${days} days ago.`;
  }

  // months
  if (days < 365) {
    const months = Math.floor(days / 30);

    return `You last visited this park ${months} month${
      months === 1 ? "" : "s"
    } ago.`;
  }

  // years
  const years = Math.floor(days / 365);

  if (years === 1) {
    return "It’s been over a year since your last visit here.";
  }

  return `It’s been over ${years} years since your last visit here.`;
}
