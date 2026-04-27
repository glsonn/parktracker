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

// Ensure the user exists in the database
async function ensureUserExists() {
  await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify({
      id: USER_ID,
    }),
  });
}

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
};

// ======================
// DOM CACHE (assigned in loadApp)
// ======================
let DOM = {};

// ======================
// DATA FUNCTIONS
// ======================
// Generic helper for Supabase REST API calls
async function safeFetch(endpoint, options = {}, returnType = "json") {
  try {
    const res = await fetch(endpoint, options);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Request failed with status ${res.status}`);
    }

    // For operations like DELETE where no body is expected
    if (returnType === "none") {
      return true;
    }

    // Attempt to parse JSON if present
    const text = await res.text();
    return text ? JSON.parse(text) : true; // Return true if no content
  } catch (error) {
    console.error("Fetch error:", error);
    alert("Something went wrong. Please try again.");
    return null; // Consistent failure indicator
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
  return await safeFetch(`${SUPABASE_URL}/rest/v1/parks?select=*`, {
    headers: getHeaders(),
  });
}

async function fetchVisits() {
  const result = await safeFetch(
    `${SUPABASE_URL}/rest/v1/visits?user_id=eq.${USER_ID}&select=*`,
    { headers: getHeaders() },
  );
  return result || []; // Ensure an array for rendering
}

async function fetchVisitedStatus(parkId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/visits?user_id=eq.${USER_ID}&park_id=eq.${parkId}&select=id`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  const data = await res.json();
  return data.length > 0;
}

async function fetchAchievements() {
  return await safeFetch(`${SUPABASE_URL}/rest/v1/achievements?select=*`, {
    headers: getHeaders(),
  });
}

async function fetchUserAchievements() {
  return await safeFetch(
    `${SUPABASE_URL}/rest/v1/user_achievements?user_id=eq.${USER_ID}&select=*`,
    {
      headers: getHeaders(),
    },
  );
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

async function deleteVisit(parkId) {
  return await safeFetch(
    `${SUPABASE_URL}/rest/v1/visits?user_id=eq.${USER_ID}&park_id=eq.${parkId}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    },
    "none", // No JSON body expected
  );
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
      "none",
    );

    if (!result) {
      console.error("Failed to delete visits");
      return;
    }

    // 2. Clear in-memory state
    state.visits = [];

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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_achievements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      user_id: USER_ID,
      achievement_id: achievement.id,
      unlocked_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    return;
  }
  // update local state
  state.userAchievements.push({
    achievement_id: achievement.id,
    unlocked_at: new Date().toISOString(),
  });

  // show toast
  showAchievementToast(achievement);

  // re-render and highlight the new one
  renderAchievements(achievement.id);
}

async function checkAchievements() {
  // console.log("Checking achievements...");
  const visitCount = getVisitCount();
  const unlockedIds = new Set(
    state.userAchievements.map((a) => a.achievement_id),
  );

  let unlockedSomething = false;

  // console.log("visitCount:", visitCount);
  // console.log("achievements:", state.achievements);
  // console.log("userAchievements:", state.userAchievements);

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

function getVisitCount() {
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

function showAchievementToast(achievement) {
  const el = DOM.toast;

  clearTimeout(toastTimeout);

  el.textContent = `Achievement unlocked: ${achievement.title}`;
  el.classList.remove("hidden");

  toastTimeout = setTimeout(() => {
    el.classList.add("hidden");
  }, 3000);
}

// ======================
// RENDER FUNCTIONS
// ======================
function renderApp() {
  renderVisitCounter(state.visits.length);
  renderNextAchievement();
  renderAchievements();

  if (state.currentView === "dashboard") {
    renderRecentVisits();
  }

  if (state.currentView === "parks") {
    renderParkList(getFilteredParks());
  }

  if (state.currentView === "detail" && state.currentPark) {
    const visited = state.visits.some(
      (v) => v.park_id === state.currentPark.id,
    );
    renderParkDetail(state.currentPark, visited);
  }
}

function renderParkList(parks) {
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
    const visited = state.visits.some((v) => v.park_id === park.id);
    if (visited) li.textContent += " ✓";

    li.style.cursor = "pointer";
    li.addEventListener("click", () => showParkDetail(park));
    DOM.parksList.appendChild(li);
  });
}

function renderParkDetail(park, visited) {
  const today = new Date().toISOString().split("T")[0];
  DOM.visitDateInput.value = today;
  DOM.parkName.textContent = park.park_name;
  DOM.parkLocation.textContent = "📍 Nearest City: " + park.nearest_city;
  DOM.parkCounty.textContent = "🗺️ County: " + park.county;
  DOM.parkDescription.textContent = park.description;

  DOM.visitButton.textContent = visited ? "Remove Visit" : "Mark as Visited";

  DOM.visitButton.disabled = false;

  const visitsForPark = sortVisitsByDate(
    state.visits.filter((v) => v.park_id === park.id),
  );

  if (visitsForPark.length === 0) {
    DOM.visitHistory.innerHTML = `
          <div class="empty-state">
            <p>You haven’t logged a visit here yet.</p>
            <p>When you do, it’ll show up here.</p>
          </div>
        `;
  } else {
    DOM.visitHistory.innerHTML = visitsForPark
      .map(
        (v) => `
    <div class="visit-entry">
      <div>• ${formatDate(v.visit_date)}</div>
      ${v.notes ? `<div class="visit-notes">${v.notes}</div>` : ""}
    </div>
  `,
      )
      .join("");
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

function showListView() {
  if (state.currentView === "dashboard") {
    showDashboardView();
  } else {
    showParksView();
  }
}

function renderAchievements(newlyUnlockedId = null) {
  DOM.achievementsList.innerHTML = "";

  if (state.userAchievements.length === 0) {
    DOM.achievementsList.innerHTML = `
          <div class="empty-state">
            <p>No achievements unlocked yet.</p>
            <p>Keep exploring to earn your first one 🏆</p>
          </div>
        `;
    return;
  }

  const visitCount = getVisitCount();

  for (const achievement of state.achievements) {
    const unlocked = state.userAchievements.some(
      (ua) => ua.achievement_id === achievement.id,
    );

    const li = document.createElement("li");

    if (unlocked) {
      li.textContent = `🏆 ${achievement.title}`;
    } else {
      li.textContent = `🔒 ${achievement.title} (${visitCount}/${achievement.threshold})`;
      li.style.opacity = "0.5";
    }

    // highlight newly unlocked
    if (newlyUnlockedId && achievement.id === newlyUnlockedId) {
      li.classList.add("achievement-new");
    }

    DOM.achievementsList.appendChild(li);
  }
}

function renderNextAchievement() {
  const visitCount = getVisitCount();
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

function renderRecentVisits() {
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

function updateTotalProgress() {
  const totalParks = state.parks.length;

  if (totalParks === 0) return;

  const visitedCount = getVisitCount();
  const percent = Math.round((visitedCount / totalParks) * 100);

  DOM.totalProgressBar.style.width = percent + "%";
  DOM.totalProgressText.textContent = `${visitedCount} of ${totalParks} parks visited (${percent}%)`;
}

// ======================
// CONTROLLER FUNCTIONS
// ======================
async function showParkDetail(park) {
  state.currentPark = park;

  // Force "coming from parks"
  state.currentView = "parks";

  showDetailView();

  const visited = state.visits.some((v) => v.park_id === park.id);
  renderParkDetail(park, visited);
}

function getFilteredParks() {
  if (!DOM.filterUnvisited.checked) {
    return state.parks;
  }

  return state.parks.filter(
    (park) => !state.visits.some((v) => v.park_id === park.id),
  );
}

async function handleVisitClick() {
  if (!state.currentPark) return;

  const parkId = state.currentPark.id;
  const alreadyVisited = state.visits.some((v) => v.park_id === parkId);

  let result;

  if (alreadyVisited) {
    result = await deleteVisit(parkId);
  } else {
    const visitDate =
      DOM.visitDateInput.value || new Date().toISOString().split("T")[0];

    const notes = DOM.visitNotes.value.trim() || null;

    result = await saveVisit(parkId, visitDate, notes);
  }

  // If safeFetch encountered an error, it will return null or false
  if (!result) return;

  // Refresh state
  state.visits = await fetchVisits();

  // Clear notes after saving
  if (DOM.visitNotes) {
    DOM.visitNotes.value = "";
  }

  await checkAchievements();
  renderApp();
  updateTotalProgress();
}

async function loadApp() {
  // console.log("App loading...");

  // DEV: URL-based reset (works on iPhone)
  if (window.location.hash === "#reset") {
    localStorage.clear();
    sessionStorage.clear();
    location.hash = ""; // prevent infinite loop
    location.reload();
    return; // stop further execution
  }

  await ensureUserExists();

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
  };

  showLandingView();
  setLoading(DOM.parksList, "Loading parks...");
  setLoading(DOM.recentVisits, "Loading recent visits...");

  // ======================
  // FETCH DATA
  // ======================
  state.parks = await fetchParks();
  state.visits = await fetchVisits();
  state.achievements = await fetchAchievements();
  state.userAchievements = await fetchUserAchievements();

  // 🔥 IMPORTANT: sync achievements with visits
  await checkAchievements();

  renderNextAchievement();

  // console.log("Data loaded:", state);

  // ======================
  // INITIAL RENDER
  // ======================
  renderParkList(getFilteredParks());
  renderVisitCounter(state.visits.length);
  renderRecentVisits();
  updateTotalProgress();

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
  DOM.backButton.addEventListener("click", showListView);
  DOM.filterUnvisited.addEventListener("change", () => {
    renderParkList(getFilteredParks());
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
