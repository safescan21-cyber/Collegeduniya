'use client';
import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundOn, setSoundOn, chime } from './MessageAlert';

// Message sound on/off (saved in this browser)
export default function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundOn()), []);
  return (
    <button type="button" onClick={() => { const v = !on; setSoundOn(v); setOn(v); if (v) chime('message'); }}
      className="ms-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title={on ? 'Message sound on — tap to mute' : 'Message sound off — tap to turn on'} aria-label={on ? 'Mute message sound' : 'Turn on message sound'}>
      {on ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}
