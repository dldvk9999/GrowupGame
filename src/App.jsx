import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import BattleScreen from './components/BattleScreen';

export default function App() {
  const [status, setStatus] = useState('연결 확인 중...');

  useEffect(() => {
    supabase
      .from('monster_species')
      .select('id, name, element')
      .then(({ data, error }) => {
        if (error) {
          setStatus(`연결 실패: ${error.message}`);
        } else {
          setStatus(`연결 성공, 몬스터 ${data.length}종 로드됨`);
        }
      });
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>GrowupGame</h1>
      <p style={{ fontSize: 13, color: '#888' }}>{status}</p>
      <BattleScreen />
    </div>
  );
}
