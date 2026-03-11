export function aggregateSessionMeta(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      totalSessions: 0,
      totalDuration: 0,
      topTools: [],
      topLanguages: [],
      errorCategories: [],
      heavySessions: 0,
    };
  }

  let totalDuration = 0;
  const toolCounts = {};
  const langCounts = {};
  const errorCounts = {};

  for (const s of sessions) {
    totalDuration += s.duration_minutes || 0;

    if (s.tool_counts) {
      for (const [name, count] of Object.entries(s.tool_counts)) {
        toolCounts[name] = (toolCounts[name] || 0) + count;
      }
    }

    if (s.languages) {
      for (const [name, count] of Object.entries(s.languages)) {
        langCounts[name] = (langCounts[name] || 0) + count;
      }
    }

    if (s.tool_error_categories) {
      for (const [name, count] of Object.entries(s.tool_error_categories)) {
        errorCounts[name] = (errorCounts[name] || 0) + count;
      }
    }
  }

  let heavySessions = 0;
  for (const s of sessions) {
    const msgs = (s.user_message_count || 0) + (s.assistant_message_count || 0);
    if (msgs > 50 || (s.duration_minutes || 0) > 30) heavySessions++;
  }

  const sortDesc = (obj, limit) =>
    Object.entries(obj)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

  return {
    totalSessions: sessions.length,
    totalDuration,
    topTools: sortDesc(toolCounts, 10),
    topLanguages: sortDesc(langCounts, 8),
    errorCategories: sortDesc(errorCounts, 5),
    heavySessions,
  };
}
