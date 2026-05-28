import {
  getNextAchievement,
  getProgressMessage,
} from "../features/achievements.js";

export function renderAchievements(
  state,
  DOM,
  newlyUnlockedId = null,
  visitedSet,
) {
  if (!visitedSet) {
    visitedSet = new Set(state.visits.map((v) => v.park_id));
  }
  DOM.achievementsList.innerHTML = "";

  const visitCount = visitedSet.size;

  const unlocked = [];
  const locked = [];

  for (const achievement of state.achievements) {
    const isUnlocked = state.userAchievements.some(
      (ua) => ua.achievement_id === achievement.id,
    );

    if (isUnlocked) {
      unlocked.push(achievement);
    } else {
      locked.push(achievement);
    }
  }

  // ======================
  // EMPTY STATE (no unlocked yet)
  // ======================
  if (unlocked.length === 0) {
    DOM.achievementsList.innerHTML = `
      <div class="empty-state">
        <p>No achievements unlocked yet.</p>
        <p>Keep exploring to earn your first one 🏆</p>
      </div>
    `;
  }

  // ======================
  // UNLOCKED SECTION
  // ======================
  if (unlocked.length > 0) {
    const unlockedSection = document.createElement("div");
    unlockedSection.className = "achievement-section";

    const title = document.createElement("h3");
    title.textContent = "Unlocked";
    unlockedSection.appendChild(title);

    unlocked.forEach((achievement) => {
      const div = document.createElement("div");
      div.className = "achievement-item unlocked";
      div.textContent = `🏆 ${achievement.title}`;

      if (newlyUnlockedId && achievement.id === newlyUnlockedId) {
        div.classList.add("achievement-new");
      }

      unlockedSection.appendChild(div);
    });

    DOM.achievementsList.appendChild(unlockedSection);
  }

  // ======================
  // LOCKED SECTION
  // ======================
  if (locked.length > 0) {
    const lockedSection = document.createElement("div");
    lockedSection.className = "achievement-section";

    const title = document.createElement("h3");
    title.textContent = "Coming Up";
    lockedSection.appendChild(title);

    locked.forEach((achievement) => {
      const div = document.createElement("div");
      div.className = "achievement-item locked";

      div.innerHTML = `
        <div>🔒 ${achievement.title}</div>
        <div class="achievement-progress">
          ${visitCount} / ${achievement.threshold}
        </div>
      `;

      lockedSection.appendChild(div);
    });

    DOM.achievementsList.appendChild(lockedSection);
  }
}

export function renderNextAchievement(state, DOM, visitedSet) {
  visitedSet = visitedSet || getVisitedParkIds();

  const visitCount = visitedSet.size;
  const next = getNextAchievement(state.achievements, state.userAchievements);

  // all achievements unlocked
  if (!next) {
    DOM.nextAchievementTitle.textContent =
      "You’ve unlocked every achievement 🎉";

    DOM.nextAchievementDescription.textContent = ""; // 👈 add this

    DOM.progressBar.style.width = "100%";
    DOM.progressBar.style.backgroundColor = "#16a34a";

    DOM.progressText.textContent = "That’s some serious exploring!";

    return;
  }

  DOM.nextAchievementTitle.textContent = next.title;
  DOM.nextAchievementDescription.textContent = next.description;

  // calculate percent
  const percent = Math.min((visitCount / next.threshold) * 100, 100);

  // COLOR LOGIC
  let color = "#dc2626"; // red

  if (percent >= 75) {
    color = "#16a34a"; // green
  } else if (percent >= 40) {
    color = "#eab308"; // yellow
  }

  // apply width + color
  DOM.progressBar.style.width = percent + "%";
  DOM.progressBar.style.backgroundColor = color;

  // progress text
  DOM.progressText.textContent = `${visitCount} of ${next.threshold} parks visited`;

  DOM.progressMessage.textContent = getProgressMessage(visitCount, next);
}

export function updateTotalProgress(state, DOM, visitedSet) {
  visitedSet = visitedSet || getVisitedParkIds();
  const totalParks = state.parks.length;

  if (totalParks === 0) return;

  const visitedCount = visitedSet.size;
  const percent = Math.round((visitedCount / totalParks) * 100);

  DOM.totalProgressBar.style.width = percent + "%";
  DOM.totalProgressText.textContent = `${visitedCount} of ${totalParks} parks visited (${percent}%)`;
}
