// src/services/fplApi.ts
import { z } from 'zod'
import type {
  Bootstrap,
  EntryEventPicks,
  EntrySummary,
  LiveEventResponse,
  Fixture,
  ClassicLeagueStandings,
} from '../types/fpl.types'
import { BootstrapSchema } from '../types/fpl.types'

// const BASE_URL = import.meta.env.VITE_FPL_BASE_URL || 'https://fantasy.premierleague.com/api'
const BASE_URL = '/api'

// --- Generic fetch with timeouts, retries (429/5xx), and optional cache ---
const DEFAULT_TIMEOUT = 10000
const MAX_RETRIES = 3
const RETRY_BASE_MS = 800

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

class HTTPError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function fetchJson<T>(path: string, opts: RequestInit = {}, useCache = true): Promise<T> {
  const url = `${BASE_URL}${path}`

  // Basic in-memory cache (can be swapped for IndexedDB) — keyed by URL
  const cacheKey = `fpl:${url}`
  if (useCache) {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try { return JSON.parse(cached) as T } catch {}
    }
  }

  let attempt = 0
  while (true) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal, credentials: 'include' })
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
          attempt++
          const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1)
          await sleep(delay)
          continue
        }
        throw new HTTPError(res.status, `FPL API error ${res.status} for ${path}`)
      }
      const data = (await res.json()) as T
      if (useCache) sessionStorage.setItem(cacheKey, JSON.stringify(data))
      return data
    } catch (err: any) {
      if (err?.name === 'AbortError' && attempt < MAX_RETRIES) {
        attempt++
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1))
        continue
      }
      if (attempt < MAX_RETRIES) {
        attempt++
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1))
        continue
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }
}

// ---- Endpoints ----
export async function getBootstrap(): Promise<Bootstrap> {
  const data = await fetchJson<Bootstrap>('/bootstrap-static/')
  // Optional runtime validation (fail soft in prod — log and continue)
  try { (z as any).object; } catch {}
  try { (BootstrapSchema as any).parse?.(data) } catch (e) { console.warn('bootstrap schema warn', e) }
  return data
}

export async function getEntry(entryId: number): Promise<EntrySummary> {
  return fetchJson<EntrySummary>(`/entry/${entryId}/`)
}

export async function getEntryPicks(entryId: number, gw: number): Promise<EntryEventPicks> {
  return fetchJson<EntryEventPicks>(`/entry/${entryId}/event/${gw}/picks/`, {}, false)
}

// Historical ranks and points for an entry across gameweeks
export async function getEntryHistory(entryId: number): Promise<any> {
  return fetchJson<any>(`/entry/${entryId}/history/`, {}, true)
}

export async function getLive(gw: number): Promise<LiveEventResponse> {
  return fetchJson<LiveEventResponse>(`/event/${gw}/live/`, {}, false)
}

export async function getFixtures(gw?: number): Promise<Fixture[]> {
  const path = gw ? `/fixtures/?event=${gw}` : '/fixtures/'
  return fetchJson<Fixture[]>(path)
}

export async function getClassicLeague(leagueId: number, page = 1): Promise<ClassicLeagueStandings> {
  return fetchJson<ClassicLeagueStandings>(`/leagues-classic/${leagueId}/standings/?page_new_entries=1&page_standings=${page}`)
}

// src/services/fplApi.ts
export async function fetchManagerLeagues(teamId: number) {
  const res = await fetch(`/api/entry/${teamId}/`);
  if (!res.ok) throw new Error('Failed to fetch manager leagues');
  const data = await res.json();
  return data.leagues.classic || [];
}

export async function fetchLeagueStandings(leagueId: number) {
  const res = await fetch(`/api/leagues-classic/${leagueId}/standings/`);
  if (!res.ok) throw new Error('Failed to fetch league standings');
  const data = await res.json();
  return data.standings.results;
}

export async function fetchBootstrap() {
  const res = await fetch('/api/bootstrap-static/');
  if (!res.ok) throw new Error('Failed to fetch bootstrap data');
  return res.json();
}

export async function fetchFixtures() {
  const res = await fetch('/api/fixtures/');
  if (!res.ok) throw new Error('Failed to fetch fixtures');
  return res.json();
}

export async function fetchClassicLeagues(teamId: number) {
  const res = await fetch(`/api/entry/${teamId}/`);
  if (!res.ok) throw new Error('Failed to fetch leagues');
  const data = await res.json();
  return data.leagues.classic || [];
}
