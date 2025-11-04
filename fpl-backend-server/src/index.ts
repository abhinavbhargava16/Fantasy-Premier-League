import express from 'express'
import cors from 'cors'
import axios from 'axios'

const app = express()
const PORT = Number(process.env.PORT || 4000)

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*' }))

type CacheEntry<T = any> = { data: T; expiresAt: number }
const cache: Record<string, CacheEntry> = {}
const ONE_HOUR = 60 * 60 * 1000

function setCache<T>(key: string, data: T, ttlMs = ONE_HOUR) {
  cache[key] = { data, expiresAt: Date.now() + ttlMs }
}

function getCache<T>(key: string): T | undefined {
  const entry = cache[key]
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    delete cache[key]
    return undefined
  }
  return entry.data as T
}

async function fetchUnderstat(url: string) {
  const res = await axios.get<string>(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://understat.com/',
      'Cache-Control': 'no-cache',
    },
    timeout: 20000,
    validateStatus: () => true,
  })
  return res
}

async function fetchUnderstatWithPlaywright(url: string): Promise<string | null> {
  try {
    const pw: any = await import('playwright')
    const chromium = pw?.chromium
    if (!chromium) return null
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      locale: 'en-US',
    })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(800)
    const html = await page.content()
    await browser.close()
    return html
  } catch (e: any) {
    console.warn('[playwright] fallback error:', e?.message || e)
    return null
  }
}

async function fetchJson<T>(url: string, ttlMs = ONE_HOUR): Promise<T> {
  const cached = getCache<T>(`json:${url}`)
  if (cached) return cached
  const res = await axios.get(url, { timeout: 15000, validateStatus: () => true })
  if (res.status < 200 || res.status >= 300) throw new Error(`Upstream ${url} -> ${res.status}`)
  setCache(`json:${url}`, res.data, ttlMs)
  return res.data as T
}

function extractJsonFromVar<T = any>(html: string, varName: string): T | null {
  // Try JSON.parse('...') pattern (match across lines)
  const re1 = new RegExp(varName + "\\s*=\\s*JSON\\.parse\\((['\"])([\\s\\S]*?)\\1\\)\\s*;?")
  let m = re1.exec(html)
  if (m) {
    try {
      const encoded = m[2]
      const decoded = JSON.parse(encoded)
      return JSON.parse(decoded) as T
    } catch {}
  }
  // Try direct assignment across lines: var varName = {...} or [...];
  const re2 = new RegExp(varName + "\\s*=\\s*([\\s\\S]*?);")
  m = re2.exec(html)
  if (m) {
    const jsonRaw = m[1].trim()
    try {
      return JSON.parse(jsonRaw) as T
    } catch {}
  }
  return null
}

// Resolve FPL team code by name using FPL bootstrap (cached)
type FplTeam = { code: number; name: string; short_name: string }
async function resolveFplTeamCodeByName(name: string): Promise<number | undefined> {
  const data = await fetchJson<{ teams: FplTeam[] }>('https://fantasy.premierleague.com/api/bootstrap-static/', 24 * ONE_HOUR)
  const teams = data.teams || []
  const norm = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(name)
  let match = teams.find((t) => norm(t.name) === target)
  if (!match) match = teams.find((t) => norm(t.short_name) === target)
  if (!match) match = teams.find((t) => norm(t.name).includes(target) || target.includes(norm(t.name)))
  return match?.code
}

const ASSETS_BASE = (process.env.ASSETS_BASE_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '')
function badgeUrlForCode(code?: number) {
  return code ? `${ASSETS_BASE}/assets/badges/${code}.png` : undefined
}
function shirtUrlForCode(code?: number) {
  return code ? `${ASSETS_BASE}/assets/shirts/${code}.png` : undefined
}

// Try to resolve Understat player id from a search term (player name)
async function resolveUnderstatPlayerId(term: string): Promise<{ id: string; name?: string } | null> {
  try {
    const url = `https://understat.com/search?term=${encodeURIComponent(term)}`
    const res = await axios.get(url, { timeout: 15000, validateStatus: () => true })
    if (res.status !== 200) return null
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
    // Handle a few possible shapes
    const candidates: any[] = Array.isArray(data)
      ? data
      : Array.isArray((data || {}).players)
      ? data.players
      : []
    if (!candidates.length) return null
    // Pick first player-like entry
    const pick = candidates.find((c) => c.id || c.player_id) || candidates[0]
    const id = String(pick.id ?? pick.player_id)
    const name = String(pick.label ?? pick.name ?? pick.player_name ?? term)
    return id ? { id, name } : null
  } catch {
    return null
  }
}

// GET /api/xg/:player — accepts numeric Understat id or name; returns xG/xA and assets
app.get('/api/xg/:player', async (req, res) => {
  const playerParam = req.params.player
  let playerId = ''
  let resolvedName: string | undefined
  if (/^\d+$/.test(playerParam)) {
    playerId = playerParam
  } else {
    const resolved = await resolveUnderstatPlayerId(playerParam)
    if (!resolved) return res.status(404).json({ error: 'Player not found' })
    playerId = resolved.id
    resolvedName = resolved.name
  }

  const cacheKey = `player:${playerId}`
  const cached = getCache(cacheKey)
  if (cached) return res.json(cached)

  const url = `https://understat.com/player/${encodeURIComponent(playerId)}`
  const response = await fetchUnderstat(url)
  console.log('[player] fetch', url, '->', response.status, 'len', (response.data || '').length)

  if (response.status === 404) return res.status(404).json({ error: 'Player not found' })
  if (response.status === 429) return res.status(429).json({ error: 'Rate limited by Understat. Try later.' })
  if (response.status < 200 || response.status >= 300) {
    return res.status(502).json({ error: `Upstream error ${response.status}` })
  }

  let html = response.data
  let matches = extractJsonFromVar<any[]>(html, 'matchesData')
  let playerInfo = extractJsonFromVar<any>(html, 'player') // contains team_title, player_name, etc.
  if (!matches) {
    console.warn('[player] parse failed (http). trying playwright…')
    const rendered = await fetchUnderstatWithPlaywright(url)
    if (rendered) {
      html = rendered
      matches = extractJsonFromVar<any[]>(html, 'matchesData')
      playerInfo = extractJsonFromVar<any>(html, 'player')
    }
  }
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    console.warn('[player] parse failed. html head:', (html || '').slice(0, 200))
    return res.status(404).json({ error: 'No player data found' })
  }

  let totalXG = 0
  let totalXA = 0
  const simplifiedMatches = matches.map((m) => {
    const xG = Number.parseFloat(m.xG ?? m.xg ?? '0') || 0
    const xA = Number.parseFloat(m.xA ?? m.xa ?? '0') || 0
    totalXG += xG
    totalXA += xA
    return {
      date: m.date || m.h_date || null,
      h_team: m.h_team || null,
      a_team: m.a_team || null,
      xG,
      xA,
      result: m.result || null,
      season: m.season || null,
    }
  })

  const teamName = playerInfo?.team_title || simplifiedMatches[0]?.h_team || simplifiedMatches[0]?.a_team
  const fplCode = teamName ? await resolveFplTeamCodeByName(String(teamName)) : undefined

  const payload = {
    player: playerParam,
    playerId,
    playerName: playerInfo?.player_name || resolvedName || playerParam,
    teamName: teamName || null,
    teamCode: fplCode ?? null,
    badgeUrl: badgeUrlForCode(fplCode),
    shirtUrl: shirtUrlForCode(fplCode),
    totalXG: Number(totalXG.toFixed(2)),
    totalXA: Number(totalXA.toFixed(2)),
    matches: simplifiedMatches,
  }
  setCache(cacheKey, payload)
  return res.json(payload)
})

// GET /api/team/:team — team slug or name; returns xG/xGA/xCS and assets
app.get('/api/team/:team', async (req, res) => {
  const raw = req.params.team
  const teamSlug = raw.replace(/\s+/g, '_')
  const season = '2024'
  const cacheKey = `team:${teamSlug}:${season}`
  const cached = getCache(cacheKey)
  if (cached) return res.json(cached)

  const url = `https://understat.com/team/${encodeURIComponent(teamSlug)}/${season}`
  const response = await fetchUnderstat(url)
  console.log('[team] fetch', url, '->', response.status, 'len', (response.data || '').length)

  if (response.status === 404) return res.status(404).json({ error: 'Team not found' })
  if (response.status === 429) return res.status(429).json({ error: 'Rate limited by Understat. Try later.' })
  if (response.status < 200 || response.status >= 300) {
    return res.status(502).json({ error: `Upstream error ${response.status}` })
  }

  let html = response.data
  let matches = extractJsonFromVar<any[]>(html, 'matchesData')
  if (!matches) {
    console.warn('[team] parse failed (http). trying playwright…')
    const rendered = await fetchUnderstatWithPlaywright(url)
    if (rendered) {
      html = rendered
      matches = extractJsonFromVar<any[]>(html, 'matchesData')
    }
  }
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    console.warn('[team] parse failed. html head:', (html || '').slice(0, 200))
    return res.status(404).json({ error: 'No team data found' })
  }

  let xG = 0
  let xGA = 0
  let xCS = 0
  for (const m of matches) {
    const matchXG = Number.parseFloat(m.xG ?? m.xg ?? '0') || 0
    const matchXGA = Number.parseFloat(m.xGA ?? m.xga ?? '0') || 0
    xG += matchXG
    xGA += matchXGA
    xCS += Math.exp(-matchXGA)
  }

  const fplCode = await resolveFplTeamCodeByName(raw)
  const payload = {
    team: raw,
    season,
    teamCode: fplCode ?? null,
    badgeUrl: badgeUrlForCode(fplCode),
    shirtUrl: shirtUrlForCode(fplCode),
    xG: Number(xG.toFixed(2)),
    xGA: Number(xGA.toFixed(2)),
    xCS: Number(xCS.toFixed(2)),
  }
  setCache(cacheKey, payload)
  return res.json(payload)
})

app.get('/healthz', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`Analytics server listening on port ${PORT}`)
})
