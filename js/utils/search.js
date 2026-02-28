/* js/utils/search.js — In-memory search, filter, and sort logic */

/**
 * Filter and sort an array of prompts based on:
 *  - searchQuery (string)
 *  - activeTagIds (array of tag IDs)
 *  - tagLogic ('AND' | 'OR')
 *  - starredOnly (boolean) — used for Starred tab
 */
export function filterAndSort(prompts, tags, { searchQuery = '', activeTagIds = [], tagLogic = 'AND', starredOnly = false } = {}) {
  const q = searchQuery.trim().toLowerCase();
  const tagMap = Object.fromEntries(tags.map(t => [t.id, t]));

  let results = prompts.filter(p => {
    // Starred filter
    if (starredOnly && !p.isStarred) return false;

    // Tag filter
    if (activeTagIds.length > 0) {
      if (tagLogic === 'AND') {
        if (!activeTagIds.every(tid => p.tags.includes(tid))) return false;
      } else {
        if (!activeTagIds.some(tid => p.tags.includes(tid))) return false;
      }
    }

    return true;
  });

  if (q) {
    // Score each prompt for relevance
    results = results.map(p => {
      let score = 0;

      // Tag name match → highest priority
      const tagNames = p.tags.map(tid => (tagMap[tid]?.name || '').toLowerCase());
      if (tagNames.some(n => n.includes(q))) score += 1000;

      // Title match
      if (p.title.toLowerCase().includes(q)) score += 100;

      // Prompt text match
      if (p.promptText.toLowerCase().includes(q)) score += 10;

      // Usage frequency
      score += Math.min(p.copyCount, 9);

      // Creation recency (newer = higher, max contribution 1)
      score += 1 / (1 + (Date.now() - new Date(p.createdAt).getTime()) / 1e10);

      return { prompt: p, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ prompt }) => prompt);

  } else {
    // Default sort: copyCount DESC, createdAt DESC
    results.sort((a, b) => {
      if (b.copyCount !== a.copyCount) return b.copyCount - a.copyCount;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  return results;
}
