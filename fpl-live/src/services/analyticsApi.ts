const ANALYTICS_BASE = (import.meta.env.VITE_ANALYTICS_BASE_URL || '').replace(/\/+$/, '')

export const getPlayerXG = (playerName: string) =>
  fetch(`${ANALYTICS_BASE}/api/xg/${encodeURIComponent(playerName)}`).then((res) => res.json())

export const getTeamXG = (teamName: string) =>
  fetch(`${ANALYTICS_BASE}/api/team/${encodeURIComponent(teamName)}`).then((res) => res.json())
