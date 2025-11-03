import { useState, useEffect } from 'react';
import { fetchClassicLeagues } from '../../services/fplApi';

interface League {
  id: number;
  name: string;
}

interface Props {
  teamId: number;
  onSelect: (leagueId: number) => void;
}

export default function LeagueDropdown({ teamId, onSelect }: Props) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const data = await fetchClassicLeagues(teamId);
      setLeagues(data);
    }
    load().catch(console.error);
  }, [teamId]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setSelected(id);
    onSelect(id);
  };

  return (
    <div className="w-full flex justify-center mb-4">
      <select
        value={selected ?? ''}
        onChange={handleChange}
        className="bg-zinc-900 border border-zinc-700 text-sm rounded-lg p-2 text-gray-200"
      >
        <option value="" disabled>Select a League</option>
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}
