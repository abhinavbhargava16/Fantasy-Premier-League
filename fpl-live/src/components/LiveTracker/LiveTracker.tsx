import { useMemo } from 'react'
import { useFPLStore } from '../../store/fplStore'
import { calculatePoints } from '../../services/scoreCalculator'
import type { EntryEventPicks } from '../../types/fpl.types'


interface Props { picks?: EntryEventPicks }


export default function LiveTracker({ picks }: Props) {
    const { live, players, currentEvent } = useFPLStore()


    const calc = useMemo(() => {
        if (!picks || !live || !players) return null
        return calculatePoints(picks, live, players)
    }, [picks, live, players])


    if (!picks) return <div className="text-sm text-zinc-400">Load a team to begin.</div>


    return (
        <div className="rounded-2xl border border-zinc-800 p-4 bg-zinc-900/50">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Live GW {currentEvent?.id} Points</h3>
                {calc && (
                    <div className="text-right">
                        <div className="text-2xl font-bold">{calc.totalOnField + calc.benchTotal}</div>
                        {calc.appliedChip === 'bboost' && <div className="text-xs text-emerald-400">Bench Boost active</div>}
                        {calc.appliedChip === '3xc' && <div className="text-xs text-emerald-400">Triple Captain active</div>}
                    </div>
                )}
            </div>


            {calc && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {calc.breakdown.map((b) => (
                        <div key={b.element} className={`flex items-center justify-between rounded-xl px-3 py-2 bg-zinc-800/60`}>
                            <div className="truncate">
                                <div className="text-sm font-medium">
                                    {players?.[b.element]?.web_name}
                                    {b.isC && <span className="ml-2 text-xs px-1 rounded bg-indigo-600">C</span>}
                                    {b.isVC && <span className="ml-2 text-xs px-1 rounded bg-indigo-600/60">VC</span>}
                                </div>
                                <div className="text-xs text-zinc-400">{labelForType(players?.[b.element]?.element_type)}</div>
                            </div>
                            <div className={`text-right ${b.onBench ? 'opacity-70' : ''}`}>
                                <div className="text-lg font-semibold">{b.points}</div>
                                {b.onBench && <div className="text-[10px] text-zinc-400">bench</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}


function labelForType(t?: number) {
    return t === 1 ? 'GKP' : t === 2 ? 'DEF' : t === 3 ? 'MID' : t === 4 ? 'FWD' : '—'
}