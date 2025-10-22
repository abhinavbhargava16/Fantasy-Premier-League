import FixturesList from '../Fixtures/FixturesList'
import LiveTracker from '../LiveTracker/LiveTracker'
import TeamView from '../TeamView/TeamView'
import type { EntryEventPicks } from '../../types/fpl.types'


export default function Dashboard({ picks }: { picks?: EntryEventPicks }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
                <LiveTracker picks={picks} />
                <TeamView picks={picks} />
            </div>
            <div className="space-y-4">
                <FixturesList />
            </div>
        </div>
    )
}