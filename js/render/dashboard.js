import {
  getReflectionMessage,
  getOnThisDayMemories,
  getMomentumMessage,
} from "../utils/reflections.js";

export function renderReflection(state, DOM) {
  const reflection = getReflectionMessage(state.visits, state.parks);

  if (!reflection) {
    DOM.reflectionSection.classList.add("hidden");
    return;
  }

  DOM.reflectionSection.classList.remove("hidden");

  DOM.reflectionMessage.textContent = reflection;
}

export function renderMemoryMoments(state, DOM) {
  const memories = getOnThisDayMemories(state.visits, state.parks);

  const validMemories = memories.filter(
    (memory) =>
      memory &&
      typeof memory.text === "string" &&
      memory.text.trim().length > 0,
  );

  if (validMemories.length === 0) {
    DOM.memorySection.classList.add("hidden");
    DOM.memoryMoments.innerHTML = "";
    return;
  }

  DOM.memorySection.classList.remove("hidden");

  DOM.memoryMoments.innerHTML = validMemories
    .map(
      (memory) => `
        <div class="memory-moment">
          ${memory.text}
        </div>
      `,
    )
    .join("");
}

export function renderMomentumMessage(state, DOM, nextAchievement) {
  if (state.visits.length === 0) {
    DOM.momentumMessage.textContent = "Your park journey is just beginning.";

    return;
  }

  const momentum = getMomentumMessage(state.visits, nextAchievement);

  DOM.momentumMessage.textContent = momentum;
}

export function renderRecentVisits(
  state,
  DOM,
  visitedSet,
  showParkDetail,
  getVisitedParkIds,
  sortVisitsByDate,
  formatDate,
) {
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
    const park = state.parks.find(
      (p) => Number(p.id) === Number(visit.park_id),
    );

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
