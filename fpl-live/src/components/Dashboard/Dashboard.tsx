// src/components/Dashboard/Dashboard.tsx
import FixturesList from '../Fixtures/FixturesList';
import LiveTracker from '../LiveTracker/LiveTracker';
import TeamView from '../TeamView/TeamView';
import LeagueStandings from './LeagueStandings';
import type { EntryEventPicks } from '../../types/fpl.types';
import { useFPLStore } from '../../store/fplStore';

export default function Dashboard({ picks }: { picks?: EntryEventPicks }) {
  const { teamId } = useFPLStore();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 min-h-screen">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-zinc-950 rounded-2xl p-4 shadow-inner border border-zinc-800">
        <TeamView picks={picks} />
        </div>
        <LiveTracker picks={picks} />
      </div>

      <div className="flex flex-col gap-6">
        <FixturesList />
        {teamId ? <LeagueStandings teamId={teamId} /> : null}
      </div>
    </div>
  );
}
