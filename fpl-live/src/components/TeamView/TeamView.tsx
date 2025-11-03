import type { EntryEventPicks } from '../../types/fpl.types';
import { useFPLStore } from '../../store/fplStore';
// import pitchBg from '../../assets/pitch-bg.png';

export default function TeamView({ picks }: { picks?: EntryEventPicks }) {
  const { players } = useFPLStore();
  if (!picks) return null;

  const starters = picks.picks
    .filter((p) => p.position <= 11)
    .sort((a, b) => a.position - b.position);
  const bench = picks.picks
    .filter((p) => p.position > 11)
    .sort((a, b) => a.position - b.position);

  const getBadge = (p: any) =>
    p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : 'XI';

  const tile = (id: number, badge: string) => {
    const player = players?.[id];
    if (!player) return null;

    const shirt = `/assets/shirts/${player.team}.jpg`;

    return (
      <div className="relative flex flex-col items-center text-center w-20 text-white">
        <img
          src={shirt}
          alt={player.web_name}
          className="w-14 h-14 object-contain mb-1"
          onError={(e) =>
            ((e.target as HTMLImageElement).style.display = 'none')
          }
        />
        {badge && (
          <span className="absolute top-0 right-1 bg-emerald-400 text-black text-[10px] font-bold px-1 rounded-full">
            {badge}
          </span>
        )}
        <p className="text-[11px] font-semibold">{player.web_name}</p>
        <p className="text-[10px] text-gray-300">{badge}</p>
      </div>
    );
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-lg p-6 border border-zinc-700"
      style={{
        backgroundImage: `url(/assets/pitch-bg.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#136F3F',
      }}
    >
      {/* Starters */}
      <div className="space-y-6">
        {/* Goalkeeper */}
        <div className="flex justify-center">
          {starters.slice(0, 1).map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Defenders */}
        <div className="flex justify-center gap-4">
          {starters.slice(1, 5).map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Midfielders */}
        <div className="flex justify-center gap-4">
          {starters.slice(5, 9).map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Forwards */}
        <div className="flex justify-center gap-4">
          {starters.slice(9, 11).map((p) => tile(p.element, getBadge(p)))}
        </div>
      </div>

      {/* Bench */}
      <div className="mt-6">
        <div className="text-xs text-gray-200 mb-2 font-semibold">Bench</div>
        <div className="grid grid-cols-4 gap-2">
          {bench.map((p) => tile(p.element, p.position === 15 ? 'GK' : 'S'))}
        </div>
      </div>
    </div>
  );
}
