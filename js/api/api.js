const SUPABASE_URL = window.ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY;

// ======================
// RESET USER DATA (FOR LOCALHOST TESTING)
// ======================
export async function deleteAllVisitsForUser(userId) {
  return await safeFetch(
    `${SUPABASE_URL}/rest/v1/visits?user_id=eq.${userId}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    },
  );
}

// ======================
// GENERIC FETCH HELPER
// ======================
async function safeFetch(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, options);

    const text = await res.text();

    if (!res.ok) {
      return {
        data: null,
        error: {
          type: "server",
          status: res.status,
          message: text || `Request failed: ${res.status}`,
        },
      };
    }

    const data = text ? JSON.parse(text) : null;

    return { data, error: null };
  } catch (err) {
    console.error("Fetch error:", err);

    return {
      data: null,
      error: {
        type: "network",
        message: err.message,
      },
    };
  }
}

// ======================
// HEADERS
// ======================
function getHeaders(additionalHeaders = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...additionalHeaders,
  };
}

// ======================
// FETCH FUNCTIONS
// ======================
export async function fetchParks() {
  const { data, error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/parks?select=*`,
    {
      headers: getHeaders(),
    },
  );

  if (error) {
    console.error("fetchParks failed:", error);
    return [];
  }

  return data || [];
}

export async function fetchVisits(userId) {
  const { data, error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/visits?user_id=eq.${userId}&select=*`,
    {
      headers: getHeaders(),
    },
  );

  if (error) {
    console.error("fetchVisits failed:", error);
    return [];
  }

  return data || [];
}

export async function fetchAchievements() {
  const { data, error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/achievements?select=*`,
    {
      headers: getHeaders(),
    },
  );

  if (error) {
    console.error("fetchAchievements failed:", error);
    return [];
  }

  return data || [];
}

export async function fetchUserAchievements(userId) {
  const { data, error } = await safeFetch(
    `${SUPABASE_URL}/rest/v1/user_achievements?user_id=eq.${userId}&select=*`,
    {
      headers: getHeaders(),
    },
  );

  if (error) {
    console.error("fetchUserAchievements failed:", error);
    return [];
  }

  return data || [];
}

// ======================
// SAVE VISIT
// ======================
export async function saveVisit(userId, parkId, visitDate, notes) {
  return await safeFetch(`${SUPABASE_URL}/rest/v1/visits`, {
    method: "POST",

    headers: {
      ...getHeaders(),
      Prefer: "return=representation",
    },

    body: JSON.stringify({
      user_id: userId,
      park_id: parkId,
      visit_date: visitDate,
      notes: notes || null,
    }),
  });
}

// ======================
// UPDATE VISIT
// ======================
export async function updateVisit(visitId, updates) {
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

// ======================
// DELETE VISIT
// ======================
export async function deleteVisitById(visitId) {
  return await safeFetch(`${SUPABASE_URL}/rest/v1/visits?id=eq.${visitId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

// ======================
// SAVE USER ACHIEVEMENT
// ======================
export async function saveUserAchievement(userId, achievementId, unlockedAt) {
  return await safeFetch(`${SUPABASE_URL}/rest/v1/user_achievements`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      user_id: userId,
      achievement_id: achievementId,
      unlocked_at: unlockedAt,
    }),
  });
}
