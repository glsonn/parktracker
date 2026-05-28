export function getUniqueParkCount(visits) {
  return new Set(visits.map((v) => v.park_id)).size;
}

export function getNextAchievement(achievements, userAchievements) {
  return (
    achievements
      .filter((a) => !userAchievements.some((ua) => ua.achievement_id === a.id))
      .sort((a, b) => a.threshold - b.threshold)[0] || null
  );
}

export function getProgressMessage(visitCount, nextAchievement) {
  if (!nextAchievement) {
    return "You've visited every park. That's no small thing.";
  }

  const remaining = nextAchievement.threshold - visitCount;

  if (visitCount === 0) {
    return "Every journey starts with the first park.";
  }

  if (remaining === 1) {
    return "Just one more park to reach your next milestone.";
  }

  if (remaining <= 3) {
    return `You're ${remaining} parks away from your next achievement.`;
  }

  return "You're building something here. Keep going.";
}

export function getNewlyUnlockedAchievements(
  visits,
  achievements,
  userAchievements,
) {
  const visitCount = getUniqueParkCount(visits);

  const unlockedIds = new Set(userAchievements.map((a) => a.achievement_id));

  return achievements.filter((achievement) => {
    const qualifies = visitCount >= Number(achievement.threshold);

    const alreadyUnlocked = unlockedIds.has(achievement.id);

    return qualifies && !alreadyUnlocked;
  });
}
