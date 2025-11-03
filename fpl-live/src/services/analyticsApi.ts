export const getPlayerXG = (playerName: string) =>
  fetch(`/api/xg/${encodeURIComponent(playerName)}`).then((res) => res.json())

export const getTeamXG = (teamName: string) =>
  fetch(`/api/team/${encodeURIComponent(teamName)}`).then((res) => res.json())

