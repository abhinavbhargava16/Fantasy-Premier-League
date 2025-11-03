// src/components/Dashboard/Dashboard.tsx
import FixturesPanel from '../Fixtures/FixturesPanel';
import TeamView from '../TeamView/TeamView';
import LeagueStandings from './LeagueStandings';
import type { EntryEventPicks, EntrySummary } from '../../types/fpl.types';
import { useFPLStore } from '../../store/fplStore';
import RankDetails from './RankDetails';

export default function Dashboard({ picks, entry, busy }: { picks?: EntryEventPicks, entry?: EntrySummary, busy?: boolean }) {
  const { teamId } = useFPLStore();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 min-h-screen">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-200 min-h-[360px]">
          {busy && !picks ? (
            <div className="h-full w-full animate-pulse bg-zinc-100 rounded-xl" />
          ) : (
            <TeamView picks={picks} entry={entry} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {picks && <RankDetails picks={picks} entry={entry} />}
        <FixturesPanel />
        {teamId ? <LeagueStandings teamId={teamId} /> : null}
      </div>
    </div>
  );
}
