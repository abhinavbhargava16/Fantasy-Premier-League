import type { EntryEventPicks } from '../../types/fpl.types'
import { useFPLStore } from '../../store/fplStore'


export default function TeamView({ picks }: { picks?: EntryEventPicks }) {
    const { players } = useFPLStore()
    if (!picks) return null


    const starters = picks.picks.filter(p => p.position <= 11).sort((a, b) => a.position - b.position)
    const bench = picks.picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position)


    const tile = (id: number, badge: string) => (
        <div className="rounded-xl bg-zinc-800/60 p-2 text-center">
            <div className="text-sm font-medium truncate">{players?.[id]?.web_name}</div>
            <div className="text-[10px] text-zinc-400">{badge}</div>
        </div>
    )


    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {starters.map(p => tile(p.element, p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : 'XI'))}
            </div>
            <div>
                <div className="text-xs text-zinc-400 mb-1">Bench</div>
                <div className="grid grid-cols-4 gap-2">
                    {bench.map(p => tile(p.element, p.position === 15 ? 'GK' : 'S'))}
                </div>
            </div>
        </div>
    )
}