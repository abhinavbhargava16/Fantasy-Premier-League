import { format } from 'date-fns'
import { useFPLStore } from '../../store/fplStore'


export default function FixturesList() {
    const { fixtures, bootstrap } = useFPLStore()
    const teams = bootstrap?.teams || []


    const short = (id: number) => teams.find((t: { id: number; short_name: string }) => t.id === id)?.short_name || '?'

    return (
        <div className="rounded-2xl border border-zinc-800 p-4 bg-zinc-900/50">
            <h3 className="text-lg font-semibold mb-3">Fixtures</h3>
            <div className="space-y-2">
                {(fixtures || []).map((f) => (
                    <div key={f.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-zinc-800/60">
                        <div className="text-sm">
                            <span className="font-medium">{short(f.team_h)}</span>
                            <span className="mx-1">vs</span>
                            <span className="font-medium">{short(f.team_a)}</span>
                        </div>
                        <div className="text-xs text-zinc-400">
                            {f.kickoff_time ? format(new Date(f.kickoff_time), 'EEE, MMM d • HH:mm') : 'TBD'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}