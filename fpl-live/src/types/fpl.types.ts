// src/types/fpl.types.ts
import { z } from 'zod'

// ---- Zod schemas (lightweight) for runtime validation when helpful ----
export const EventSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_current: z.boolean().nullable().optional(),
  is_next: z.boolean().nullable().optional(),
  is_previous: z.boolean().nullable().optional(),
  finished: z.boolean().nullable().optional(),
  data_checked: z.boolean().nullable().optional(),
  deadline_time: z.string(),
})
export type Event = z.infer<typeof EventSchema>

export const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  short_name: z.string(),
})
export type Team = z.infer<typeof TeamSchema>

export const ElementSchema = z.object({
  id: z.number(),
  web_name: z.string(),
  team: z.number(),
  now_cost: z.number(),
  selected_by_percent: z.string(),
  status: z.string(), // 'a','d','i','n','s','u'
  chance_of_playing_next_round: z.number().nullable().optional(),
  chance_of_playing_this_round: z.number().nullable().optional(),
  form: z.string(), // e.g., "4.3"
  ict_index: z.string(),
  ep_next: z.string().optional(),
  ep_this: z.string().optional(),
  minutes: z.number().optional(),
  total_points: z.number().optional(),
  element_type: z.number(), // 1 GKP,2 DEF,3 MID,4 FWD
})
export type Element = z.infer<typeof ElementSchema>

export const BootstrapSchema = z.object({
  events: z.array(EventSchema),
  teams: z.array(TeamSchema),
  elements: z.array(ElementSchema),
})
export type Bootstrap = z.infer<typeof BootstrapSchema>

// Manager (entry)
export interface EntrySummary {
  id: number
  name: string
  player_first_name: string
  player_last_name: string
  summary_overall_points: number
  summary_overall_rank: number
  value: number // in £0.1m
  bank: number // in £0.1m
  last_deadline_bank: number
  last_deadline_value: number
}

export interface Pick {
  element: number // player id
  position: number // 1..15
  multiplier: number // 2 for C, 0 for bench
  is_captain: boolean
  is_vice_captain: boolean
}

export interface EntryEventPicks {
  active_chip: null | '3xc' | 'bboost' | 'freehit' | 'wildcard'
  entry_history: {
    event: number
    points: number
    total_points: number
    rank: number | null
    rank_sort: number | null
    event_transfers: number
    event_transfers_cost: number
    value: number
    bank: number
  }
  picks: Pick[]
}

export interface LiveElementStats {
  minutes: number
  total_points: number
  bps: number // bonus point system raw score
  goals_scored: number
  assists: number
  clean_sheets: number
  goals_conceded: number
  saves?: number
  penalties_saved?: number
  penalties_missed?: number
  yellow_cards?: number
  red_cards?: number
  own_goals?: number
  bonus?: number // when finalised
}

export interface LiveElement {
  id: number // player id
  stats: LiveElementStats
}

export interface LiveEventResponse {
  elements: LiveElement[]
}

export interface Fixture {
  id: number
  event: number | null
  kickoff_time: string | null
  finished: boolean
  team_a: number
  team_h: number
  team_a_score: number | null
  team_h_score: number | null
  minutes: number
  started: boolean
  provisional_start_time?: boolean
  difficulty?: number
}

export interface ClassicLeagueStandings {
  new_entries: unknown
  last_updated_data: string
  league: {
    id: number
    name: string
    created: string
  }
  standings: {
    has_next: boolean
    page: number
    results: Array<{
      entry: number
      entry_name: string
      player_name: string
      rank: number
      last_rank: number
      total: number
    }>
  }
}

export type PlayerIndex = Record<number, Element>
export type LiveIndex = Record<number, LiveElementStats>