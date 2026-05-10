/* eslint-env browser */

// ======================
// CONFIG
// ======================

// Load Supabase credentials from env.js
const SUPABASE_URL = window.ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY;

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
// DATA FUNCTIONS
// ======================
// Generic helper for Supabase REST API calls
async function safeFetch(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, options);

    const text = await res.text();

    if (!res.ok) {
      return { data: null, error: text || `Request failed: ${res.status}` };
    }

    const data = text ? JSON.parse(text) : null;

    return { data, error: null };
  } catch (err) {
    console.error("Fetch error:", err);
    return { data: null, error: err.message };
  }
}

function getHeaders(additionalHeaders = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...additionalHeaders,
  };
}

async function fetchParks() {
  const { data, error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/parks?select=*`,
    { headers: getHeaders() },
  );

  if (error) {
    console.error("fetchParks failed:", error);
    return [];
  }

  return data || [];
}

async function fetchVisits() {
  const { data, error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/visits?user_id=eq.${USER_ID}&select=*`,
    { headers: getHeaders() },
  );

  if (error) {
    console.error("fetchVisits failed:", error);
    return [];
  }

  return data || [];
}

async function fetchAchievements() {
  const { data, error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/achievements?select=*`,
    { headers: getHeaders() },
  );

  if (error) {
    console.error("fetchAchievements failed:", error);
    return [];
  }

  return data || [];
}

async function fetchUserAchievements() {
  const { data, error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/user_achievements?user_id=eq.${USER_ID}&select=*`,
    { headers: getHeaders() },
  );

  if (error) {
    console.error("fetchUserAchievements failed:", error);
    return [];
  }

  return data || [];
}

async function saveVisit(parkId, visitDate, notes) {
  return await safeFetch(`${SUPABASE_URL}/rest/v1/visits`, {
    method: "POST",
    headers: {
      ...getHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: USER_ID,
      park_id: parkId,
      visit_date: visitDate,
      notes: notes || null,
    }),
  });
}

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
function formatDate(dateString) {
  const [year, month, day] = dateString.split("-");

  const date = new Date(year, month - 1, day); // local time, no shift

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function sortVisitsByDate(visits) {
  return [...visits].sort(
    (a, b) => new Date(b.visit_date) - new Date(a.visit_date),
  );
}

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

// ======================
// RENDER FUNCTIONS
// ======================
function renderApp() {
  const visitedSet = getVisitedParkIds();

  renderVisitCounter(visitedSet.size);
  renderNextAchievement(visitedSet);
  renderAchievements(null, visitedSet);
  updateTotalProgress(visitedSet);

  if (state.currentView === "dashboard") {
    renderRecentVisits(visitedSet);
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
    li.textContent = park.park_name;

    // show check mark if visited
    const visited = visitedSet.has(park.id);
    if (visited) li.textContent += " ✓";

    li.style.cursor = "pointer";
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

  DOM.visitButton.disabled = false;

  if (state.editingVisitId) {
    DOM.visitButton.textContent = "Save Changes";
  } else {
    DOM.visitButton.textContent = "Add Visit";
  }

  // ✅ FIRST: derive visits
  const visitsForPark = sortVisitsByDate(
    state.visits.filter((v) => v.park_id === park.id),
  );

  const visitCount = visitsForPark.length;

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
      <p><strong>${visitCount}</strong> visit${visitCount === 1 ? "" : "s"}</p>
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

  renderApp();
}

function showParksView() {
  state.currentView = "parks";

  DOM.dashboardView.style.display = "none";
  DOM.listView.style.display = "block";
  DOM.detailView.style.display = "none";
  DOM.filterContainer.style.display = "block";

  renderApp();
}

function showDetailView() {
  state.currentView = "detail";

  DOM.detailView.style.display = "block";
  DOM.listView.style.display = "none";
  DOM.dashboardView.style.display = "none";
  DOM.filterContainer.style.display = "none";

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

function renderRecentVisits(visitedSet) {
  visitedSet = visitedSet || getVisitedParkIds();

  const visits = sortVisitsByDate(state.visits);

  DOM.recentVisits.innerHTML = "";

  if (visits.length === 0) {
    DOM.recentVisits.innerHTML = `
          <div class="empty-state">
            <p>No visits yet.</p>
            <p>Start exploring your first park 🌲</p>
          </div>
        `;
    return;
  }

  const recent = visits.slice(0, 5);

  recent.forEach((visit) => {
    const park = state.parks.find((p) => p.id === visit.park_id);

    const div = document.createElement("div");
    div.className = "recent-visit";
    div.style.cursor = "pointer";

    div.innerHTML = `
            <strong>${park.park_name}</strong><br>
            ${formatDate(visit.visit_date)}
          `;

    div.addEventListener("click", () => {
      showParkDetail(park);
    });

    DOM.recentVisits.appendChild(div);
  });
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
    });

    const result = await updateVisit(editingId, {
      visit_date: visitDate,
      notes,
    });

    // 🔁 rollback on failure
    if (!result || result.error) {
      setState({ visits: previousVisits });

      console.error("Update failed:", result?.error);

      showToast("Couldn't update visit. Please try again.");
      return;
    }

    // 🔄 sync with DB
    const freshVisits = await fetchVisits();

    setState({
      visits: freshVisits,
      editingVisitId: null,
    });

    // reset form
    DOM.visitDateInput.value = "";
    DOM.visitNotes.value = "";

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
  });

  const result = await saveVisit(parkId, visitDate, notes);

  // 🔁 rollback on failure
  if (!result || result.error) {
    setState({ visits: previousVisits });

    console.error("Save visit failed:", result?.error);

    showToast("Couldn't save visit. Please try again.");
    return;
  }

  // 🔄 sync with DB
  const freshVisits = await fetchVisits();

  setState({
    visits: freshVisits,
  });

  // reset form
  DOM.visitNotes.value = "";
  DOM.visitDateInput.value = new Date().toISOString().split("T")[0];

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
  const freshVisits = await fetchVisits();
  setState({ visits: freshVisits });

  showToast("Visit deleted");
}

async function deleteVisitById(visitId) {
  return await safeFetch(`${SUPABASE_URL}/rest/v1/visits?id=eq.${visitId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

async function updateVisit(visitId, updates) {
  const result = await safeFetch(
    `${SUPABASE_URL}/rest/v1/visits?id=eq.${visitId}`,
    {
      method: "PATCH",
      headers: {
        ...getHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify(updates),
    },
  );

  // detect "successful but matched nothing"
  if (!result.error && Array.isArray(result.data) && result.data.length === 0) {
    return {
      data: null,
      error: "No matching visit found",
    };
  }

  return result;
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
  const parks = await fetchParks();
  const visits = await fetchVisits();
  const achievements = await fetchAchievements();
  const userAchievements = await fetchUserAchievements();

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
