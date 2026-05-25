import {
  formatDate,
  formatVisitDate,
  sortVisitsByDate,
  getDaysSince,
  getYearsAgo,
} from "./utils/dates.js";

import {
  fetchParks,
  fetchVisits,
  fetchAchievements,
  fetchUserAchievements,
  saveVisit,
  updateVisit,
  deleteVisitById,
} from "./api/api.js";

import {
  getReflectionMessage,
  getRevisitedParks,
  getMostVisitedPark,
  getMostActiveMonth,
  getTrackingYears,
  getOnThisDayMemories,
  getMomentumMessage,
} from "./utils/reflections.js";

import {
  renderReflection,
  renderMemoryMoments,
  renderMomentumMessage,
  renderRecentVisits,
} from "./render/dashboard.js";
/* eslint-env browser */

// ======================
// CONFIG
// ======================

// Persistent user ID
const USER_ID_KEY = "wi_state_parks_user_id";

function getUserId() {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

const USER_ID = getUserId();

// ======================
// BRANDING
// ======================

const BRAND = {
  appName: "ParkTracker",
  fullName: "Wisconsin State Parks Tracker",

  logo: "/public/images/logo-primary.svg",
  icon: "/public/favicon.png",
};

// ======================
// STATE
// ======================
const state = {
  parks: [],
  visits: [],
  achievements: [],
  userAchievements: [],
  currentPark: null,
  currentView: "dashboard",
  editingVisitId: null,

  loading: {
    initialData: false,
    savingVisit: false,
  },

  errors: {
    global: null,
  },

  network: {
    online: navigator.onLine,
  },
};

function setState(updates) {
  Object.assign(state, updates);
  renderApp();
}

// ======================
// DOM CACHE (assigned in loadApp)
// ======================
let DOM = {};

// ======================
// RESET for DEV only
// ======================
async function resetApp() {
  const confirmed = confirm("Reset app to first-time state?");
  if (!confirmed) return;

  try {
    const userId = getUserId();

    console.log("Resetting user:", userId);

    // 1. Delete ALL visits for this user (REST API version)
    const result = await safeFetch(
      `${SUPABASE_URL}/rest/v1/visits?user_id=eq.${userId}`,
      {
        method: "DELETE",
        headers: getHeaders(),
      },
    );

    if (!result) {
      console.error("Failed to delete visits");
      return;
    }

    // 2. Clear in-memory state
    setState({ visits: [] });

    // 3. Clear storage (resets user ID too)
    localStorage.clear();
    sessionStorage.clear();

    // 4. Reload
    location.reload();
  } catch (err) {
    console.error("Reset failed:", err);
  }
}

async function unlockAchievement(achievement) {
  const unlockedAt = new Date().toISOString();

  const { error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/user_achievements`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        user_id: USER_ID,
        achievement_id: achievement.id,
        unlocked_at: unlockedAt,
      }),
    },
  );

  if (error) {
    console.error("unlockAchievement failed:", error);
    return;
  }

  // update local state
  setState({
    userAchievements: [
      ...state.userAchievements,
      {
        achievement_id: achievement.id,
        unlocked_at: unlockedAt,
      },
    ],
  });

  // show toast
  showAchievementToast(achievement);

  // re-render and highlight the new one
  renderAchievements(achievement.id);
}

async function checkAchievements() {
  const visitCount = getUniqueParkCount();
  const unlockedIds = new Set(
    state.userAchievements.map((a) => a.achievement_id),
  );

  let unlockedSomething = false;

  for (const achievement of state.achievements) {
    const qualifies = visitCount >= Number(achievement.threshold);
    const alreadyUnlocked = unlockedIds.has(achievement.id);

    if (qualifies && !alreadyUnlocked) {
      await unlockAchievement(achievement);
      unlockedSomething = true;
    }
  }

  // only re-render if NOTHING unlocked
  if (!unlockedSomething) {
    renderAchievements();
  }

  return unlockedSomething;
}

// ======================
// HELPERS
// ======================

function setLoading(element, message) {
  element.innerHTML = `<p class="loading">${message}</p>`;
}

function getUniqueParkCount() {
  return new Set(state.visits.map((v) => v.park_id)).size;
}

function getNextAchievement() {
  return (
    state.achievements
      .filter(
        (a) => !state.userAchievements.some((ua) => ua.achievement_id === a.id),
      )
      .sort((a, b) => a.threshold - b.threshold)[0] || null
  );
}

function getProgressMessage(visitCount, nextAchievement) {
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

let toastTimeout;

function showToast(message) {
  const el = DOM.toast;

  clearTimeout(toastTimeout);

  el.textContent = message;
  el.classList.remove("hidden");

  toastTimeout = setTimeout(() => {
    el.classList.add("hidden");
  }, 3000);
}

function showAchievementToast(achievement) {
  showToast(`Achievement unlocked: ${achievement.title}`);
}

function isParkVisited(parkId) {
  return state.visits.some((v) => v.park_id === parkId);
}

function getVisitedParkIds() {
  return new Set(state.visits.map((v) => v.park_id));
}

function getVisitStats(parkId) {
  const parkVisits = state.visits.filter((visit) => visit.park_id === parkId);

  const visitCount = parkVisits.length;

  if (visitCount === 0) {
    return {
      visitCount: 0,
      lastVisited: null,
    };
  }

  const sortedVisits = [...parkVisits].sort(
    (a, b) => new Date(b.visit_date) - new Date(a.visit_date),
  );

  return {
    visitCount,
    lastVisited: sortedVisits[0].visit_date,
  };
}

function getLastVisitMessage(parkId) {
  const stats = getVisitStats(parkId);

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

function setGlobalError(message, retry = null) {
  setState({
    errors: {
      ...state.errors,
      global: {
        message,
        retry,
      },
    },
  });
}

function clearGlobalError() {
  setState({
    errors: {
      ...state.errors,
      global: null,
    },
  });
}

// ======================
// RENDER FUNCTIONS
// ======================
function renderApp() {
  const visitedSet = getVisitedParkIds();

  renderGlobalError();
  renderNetworkStatus();
  renderVisitCounter(visitedSet.size);
  renderNextAchievement(visitedSet);
  renderAchievements(null, visitedSet);
  updateTotalProgress(visitedSet);

  if (state.currentView === "dashboard") {
    renderMomentumMessage(state, DOM);
    renderMemoryMoments(state, DOM);
    renderReflection(state, DOM);
    renderRecentVisits(
      state,
      DOM,
      visitedSet,
      showParkDetail,
      getVisitedParkIds,
      sortVisitsByDate,
      formatDate,
    );
  }

  if (state.currentView === "parks") {
    renderParkList(getFilteredParks(visitedSet), visitedSet);
  }

  if (state.currentView === "detail" && state.currentPark) {
    renderParkDetail(state.currentPark);
  }
}

function renderBranding() {
  DOM.brandLogo.src = BRAND.logo;
  DOM.brandTitle.textContent = BRAND.appName;
}

function renderParkList(parks, visitedSet) {
  DOM.parksList.innerHTML = "";

  if (parks.length === 0) {
    DOM.parksList.innerHTML = `
      <div class="empty-state">
        <p>You’ve visited them all 🎉</p>
        <p>Time to revisit your favorites or plan a new trip.</p>
      </div>
    `;
    return;
  }

  parks.forEach((park) => {
    const li = document.createElement("li");

    const visited = visitedSet.has(park.id);

    li.className = visited
      ? "park-list-item visited"
      : "park-list-item unvisited";

    li.style.cursor = "pointer";

    // ======================
    // PARK NAME
    // ======================
    const name = document.createElement("div");
    name.className = "park-list-name";
    name.textContent = park.park_name;

    li.appendChild(name);

    // ======================
    // VISIT META
    // ======================
    if (visited) {
      const stats = getVisitStats(park.id);

      const meta = document.createElement("div");
      meta.className = "park-visit-meta";

      const status = document.createElement("div");
      status.className = "visit-status";

      status.textContent = `✓ ${stats.visitCount} visit${
        stats.visitCount === 1 ? "" : "s"
      }`;

      const lastVisited = document.createElement("div");
      lastVisited.className = "last-visited";

      lastVisited.textContent = `Last visited ${formatVisitDate(
        stats.lastVisited,
      )}`;

      meta.appendChild(status);
      meta.appendChild(lastVisited);

      li.appendChild(meta);
    } else {
      const unvisited = document.createElement("div");

      unvisited.className = "park-unvisited";
      unvisited.textContent = "Not visited yet";

      li.appendChild(unvisited);
    }

    li.addEventListener("click", () => showParkDetail(park));

    DOM.parksList.appendChild(li);
  });
}

function renderParkDetail(park) {
  if (!state.editingVisitId && !DOM.visitDateInput.value) {
    DOM.visitDateInput.value = new Date().toISOString().split("T")[0];
  }

  DOM.parkName.textContent = park.park_name;
  DOM.parkLocation.textContent = "📍 Nearest City: " + park.nearest_city;
  DOM.parkCounty.textContent = "🗺️ County: " + park.county;
  DOM.parkDescription.textContent = park.description;

  DOM.visitButton.disabled = state.loading.savingVisit;

  if (state.loading.savingVisit) {
    DOM.visitButton.textContent = "Saving...";
  } else if (state.editingVisitId) {
    DOM.visitButton.textContent = "Save Changes";
  } else {
    DOM.visitButton.textContent = "Add Visit";
  }

  // ✅ FIRST: derive visits
  const visitsForPark = sortVisitsByDate(
    state.visits.filter((v) => v.park_id === park.id),
  );

  const visitCount = visitsForPark.length;
  const lastVisitMessage = getLastVisitMessage(park.id);

  // ✅ THEN render everything in one pass
  if (visitCount === 0) {
    DOM.visitHistory.innerHTML = `
      <p><strong>0</strong> visits</p>
      <div class="empty-state">
        <p>You haven’t logged a visit here yet.</p>
        <p>When you do, it’ll show up here.</p>
      </div>
    `;
  } else {
    DOM.visitHistory.innerHTML = `
  <div class="visit-summary">
    <p><strong>${visitCount}</strong> visit${visitCount === 1 ? "" : "s"}</p>

    ${
      lastVisitMessage
        ? `<p class="last-visit-message">${lastVisitMessage}</p>`
        : ""
    }
  </div>

  ${visitsForPark
    .map(
      (v) => `
          <div class="visit-entry">
  <div class="visit-header">
  <span>• ${formatDate(v.visit_date)}</span>

  <div class="visit-actions">
    <button
      class="visit-edit-btn"
      data-id="${v.id}"
      aria-label="Edit visit"
      title="Edit visit"
    >
      ✏️
    </button>

    <button
      class="visit-delete-btn"
      data-id="${v.id}"
      aria-label="Delete visit"
      title="Delete visit"
    >
      🗑️
    </button>
  </div>
</div>
  ${v.notes ? `<div class="visit-notes">${v.notes}</div>` : ""}
</div>
      `,
    )
    .join("")}
    `;
  }
}

function renderVisitCounter(count) {
  const total = state.parks.length;
  const remaining = total - count;

  const parkLabel = count === 1 ? "park" : "parks";

  DOM.visitCounter.textContent = `You've visited ${count} ${parkLabel} • ${remaining} left`;
}

function showLandingView() {
  DOM.appView.style.display = "none";
  DOM.landingView.style.display = "block";
}

function showApp() {
  DOM.landingView.style.display = "none";
  DOM.appView.style.display = "block";

  // Ensure a clean starting state
  DOM.dashboardView.style.display = "none";
  DOM.listView.style.display = "none";
  DOM.detailView.style.display = "none";
}

function showDashboardView() {
  state.currentView = "dashboard";

  DOM.dashboardView.style.display = "block";
  DOM.listView.style.display = "none";
  DOM.detailView.style.display = "none";
  DOM.filterContainer.style.display = "none";
  DOM.momentumSection.style.display = "block";

  renderApp();
}

function showParksView() {
  state.currentView = "parks";

  DOM.dashboardView.style.display = "none";
  DOM.listView.style.display = "block";
  DOM.detailView.style.display = "none";
  DOM.filterContainer.style.display = "block";
  DOM.momentumSection.style.display = "none";

  renderApp();
}

function showDetailView() {
  state.currentView = "detail";

  DOM.detailView.style.display = "block";
  DOM.listView.style.display = "none";
  DOM.dashboardView.style.display = "none";
  DOM.filterContainer.style.display = "none";
  DOM.momentumSection.style.display = "none";

  renderApp();
}

function renderAchievements(newlyUnlockedId = null, visitedSet) {
  visitedSet = visitedSet || getVisitedParkIds();
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

function renderNextAchievement(visitedSet) {
  visitedSet = visitedSet || getVisitedParkIds();

  const visitCount = visitedSet.size;
  const next = getNextAchievement();

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

function updateTotalProgress(visitedSet) {
  visitedSet = visitedSet || getVisitedParkIds();
  const totalParks = state.parks.length;

  if (totalParks === 0) return;

  const visitedCount = visitedSet.size;
  const percent = Math.round((visitedCount / totalParks) * 100);

  DOM.totalProgressBar.style.width = percent + "%";
  DOM.totalProgressText.textContent = `${visitedCount} of ${totalParks} parks visited (${percent}%)`;
}

function renderNetworkStatus() {
  if (state.network.online) {
    DOM.offlineBanner.classList.add("hidden");
  } else {
    DOM.offlineBanner.classList.remove("hidden");
  }
}

function renderGlobalError() {
  const error = state.errors.global;

  if (!error) {
    DOM.globalError.classList.add("hidden");
    DOM.globalError.innerHTML = "";
    return;
  }

  DOM.globalError.classList.remove("hidden");

  DOM.globalError.innerHTML = `
    <div class="global-error-content">
      <span>${error.message}</span>
    </div>
  `;
}

// ======================
// CONTROLLER FUNCTIONS
// ======================
async function showParkDetail(park) {
  state.currentPark = park;
  state.currentView = "detail";

  showDetailView();
  renderApp();
}

function getFilteredParks(visitedSet) {
  if (DOM.filterUnvisited.checked) {
    return state.parks.filter((park) => !visitedSet.has(park.id));
  }

  // only sort when showing all
  return [...state.parks].sort((a, b) => {
    if (visitedSet.has(a.id) && !visitedSet.has(b.id)) return 1;
    if (!visitedSet.has(a.id) && visitedSet.has(b.id)) return -1;
    return 0;
  });
}

async function handleVisitClick() {
  if (!state.currentPark) return;

  const parkId = state.currentPark.id;

  const previousVisits = [...state.visits];

  const visitDate =
    DOM.visitDateInput.value || new Date().toISOString().split("T")[0];

  const notes = DOM.visitNotes?.value.trim() || null;

  const editingId = state.editingVisitId;

  // ======================
  // EDIT EXISTING VISIT
  // ======================
  if (editingId) {
    // 🚀 optimistic update
    setState({
      visits: state.visits.map((v) =>
        v.id === editingId
          ? {
              ...v,
              visit_date: visitDate,
              notes,
            }
          : v,
      ),

      loading: {
        ...state.loading,
        savingVisit: true,
      },
    });

    const result = await updateVisit(editingId, {
      visit_date: visitDate,
      notes,
    });

    // 🔁 rollback on failure
    if (!result || result.error) {
      setState({
        visits: previousVisits,
        editingVisitId: null,

        loading: {
          ...state.loading,
          savingVisit: false,
        },
      });

      DOM.visitDateInput.value = "";
      DOM.visitNotes.value = "";

      console.error("Update failed:", result?.error);

      setGlobalError("Couldn't sync your visit.", handleVisitClick);

      showToast("Couldn't sync visit.");
      return;
    }

    // 🔄 sync with DB
    const freshVisits = await fetchVisits(USER_ID);

    setState({
      visits: freshVisits,
      editingVisitId: null,

      loading: {
        ...state.loading,
        savingVisit: false,
      },
    });

    // reset form
    DOM.visitDateInput.value = "";
    DOM.visitNotes.value = "";

    clearGlobalError();
    showToast("Visit updated");

    return;
  }

  // ======================
  // ADD NEW VISIT
  // ======================
  const optimisticVisit = {
    id: crypto.randomUUID(), // temp ID for UI
    park_id: parkId,
    visit_date: visitDate,
    notes,
  };

  // 🚀 optimistic update
  setState({
    visits: [...state.visits, optimisticVisit],

    loading: {
      ...state.loading,
      savingVisit: true,
    },
  });

  const result = await saveVisit(USER_ID, parkId, visitDate, notes);

  // 🔁 rollback on failure
  if (!result || result.error) {
    setState({
      visits: previousVisits,

      loading: {
        ...state.loading,
        savingVisit: false,
      },
    });

    DOM.visitNotes.value = "";
    DOM.visitDateInput.value = new Date().toISOString().split("T")[0];

    console.error("Save visit failed:", result?.error);

    setGlobalError("Couldn't sync your visit.", handleVisitClick);

    showToast("Couldn't sync visit.");
    return;
  }

  // 🔄 sync with DB
  const freshVisits = await fetchVisits(USER_ID);

  setState({
    visits: freshVisits,

    loading: {
      ...state.loading,
      savingVisit: false,
    },
  });

  // reset form
  DOM.visitNotes.value = "";
  DOM.visitDateInput.value = new Date().toISOString().split("T")[0];

  clearGlobalError();
  const unlockedSomething = await checkAchievements();

  if (!unlockedSomething) {
    showToast("Visit saved");
  }
}

async function handleVisitHistoryClick(e) {
  // ======================
  // EDIT
  // ======================
  const editBtn = e.target.closest(".visit-edit-btn");

  if (editBtn) {
    const visitId = Number(editBtn.dataset.id);

    const visit = state.visits.find((v) => v.id === visitId);

    if (!visit) return;

    // populate form
    DOM.visitDateInput.value = visit.visit_date;
    DOM.visitNotes.value = visit.notes || "";

    // switch mode
    setState({
      editingVisitId: visitId,
    });

    DOM.visitAction?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    return;
  }

  // ======================
  // DELETE
  // ======================
  const deleteBtn = e.target.closest(".visit-delete-btn");

  if (!deleteBtn) return;

  const visitId = Number(deleteBtn.dataset.id);

  const confirmed = confirm("Delete this visit?");
  if (!confirmed) return;

  const previousVisits = [...state.visits];

  // 🚀 optimistic UI
  setState({
    visits: state.visits.filter((v) => v.id !== visitId),
  });

  const result = await deleteVisitById(visitId);

  // 🔁 rollback on failure
  if (!result || result.error) {
    setState({ visits: previousVisits });

    console.error("Delete failed:", result?.error);
    showToast("Couldn't delete visit. Please try again.");
    return;
  }

  // optional DB sync
  const freshVisits = await fetchVisits(USER_ID);
  setState({ visits: freshVisits });

  showToast("Visit deleted");
}

async function loadApp() {
  // DEV: URL-based reset (works on iPhone)
  if (window.location.hash === "#reset") {
    localStorage.clear();
    sessionStorage.clear();
    location.hash = ""; // prevent infinite loop
    location.reload();
    return; // stop further execution
  }

  // ======================
  // CACHE DOM
  // ======================
  DOM = {
    startButton: document.getElementById("start-button"),
    landingView: document.getElementById("landing-view"),
    appView: document.getElementById("app-view"),
    navDashboard: document.getElementById("nav-dashboard"),
    navParks: document.getElementById("nav-parks"),
    dashboardView: document.getElementById("dashboard-view"),
    parksList: document.getElementById("parks-list"),
    parkName: document.getElementById("park-name"),
    parkLocation: document.getElementById("park-location"),
    parkCounty: document.getElementById("park-county"),
    parkDescription: document.getElementById("park-description"),
    visitButton: document.getElementById("visit-button"),
    visitCounter: document.getElementById("visit-counter"),
    listView: document.getElementById("list-view"),
    detailView: document.getElementById("detail-view"),
    backButton: document.getElementById("back-button"),
    achievementsPanel: document.getElementById("achievements-panel"),
    achievementsList: document.getElementById("achievements-list"),
    nextAchievementTitle: document.getElementById("next-achievement-title"),
    nextAchievementDescription: document.getElementById(
      "next-achievement-description",
    ),
    visitDateInput: document.getElementById("visit-date"),
    progressBar: document.getElementById("progress-bar"),
    progressText: document.getElementById("progress-text"),
    filterUnvisited: document.getElementById("filter-unvisited"),
    filterContainer: document.getElementById("filter-container"),
    visitHistory: document.getElementById("visit-history"),
    recentVisits: document.getElementById("recent-visits"),
    totalProgressBar: document.getElementById("total-progress-bar"),
    totalProgressText: document.getElementById("total-progress-text"),
    progressMessage: document.getElementById("progress-message"),
    visitNotes: document.getElementById("visit-notes"),
    toast: document.getElementById("toast"),
    visitAction: document.getElementById("visit-action"),
    brandLogo: document.getElementById("brand-logo"),
    brandTitle: document.getElementById("brand-title"),
    momentumSection: document.getElementById("momentum-section"),
    momentumMessage: document.getElementById("momentum-message"),
    memorySection: document.getElementById("memory-section"),
    memoryMoments: document.getElementById("memory-moments"),
    reflectionSection: document.getElementById("reflection-section"),
    reflectionMessage: document.getElementById("reflection-message"),
    offlineBanner: document.getElementById("offline-banner"),
    globalError: document.getElementById("global-error"),
  };

  DOM.filterUnvisited.checked = false;

  document.title = BRAND.fullName;

  renderBranding();

  showLandingView();
  setLoading(DOM.parksList, "Loading parks...");
  setLoading(DOM.recentVisits, "Loading recent visits...");

  // ======================
  // FETCH DATA
  // ======================
  const [parks, visits, achievements, userAchievements] = await Promise.all([
    fetchParks(),
    fetchVisits(USER_ID),
    fetchAchievements(),
    fetchUserAchievements(USER_ID),
  ]);

  setState({
    parks,
    visits,
    achievements,
    userAchievements,
  });

  // 🔥 IMPORTANT: sync achievements with visits
  await checkAchievements();

  // ======================
  // EVENT LISTENERS
  // ======================
  DOM.startButton.addEventListener("click", () => {
    showApp();
    showDashboardView();
  });
  DOM.navDashboard.addEventListener("click", showDashboardView);
  DOM.navParks.addEventListener("click", showParksView);
  DOM.visitButton.addEventListener("click", handleVisitClick);
  DOM.backButton.addEventListener("click", showParksView);
  DOM.filterUnvisited.addEventListener("change", () => {
    renderApp();
  });
  DOM.visitHistory.addEventListener("click", handleVisitHistoryClick);

  window.addEventListener("online", () => {
    setState({
      network: { online: true },
    });

    showToast("Back online");
  });

  window.addEventListener("offline", () => {
    setState({
      network: { online: false },
    });

    showToast("You're offline");
  });
}

// ======================
// INIT
// ======================
document.addEventListener("DOMContentLoaded", () => {
  loadApp();
});

// ======================
// DEV MODE for RESET locally
// ======================
const DEV_MODE =
  location.hostname === "127.0.0.1" || location.hostname === "localhost";

if (DEV_MODE) {
  window.resetApp = resetApp;
}
