'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';

// One-to-one voice / video calls between students in an accepted chat.
// Media goes peer-to-peer (WebRTC). Ringing comes from the "calls" table (Realtime postgres_changes, RLS-protected);
// offer/answer/ICE go over a private Realtime broadcast channel "call:<id>" that only the two people can join.
type Kind = 'audio' | 'video';
type Phase = 'incoming' | 'calling' | 'connecting' | 'live' | 'ended';
type Call = { id: string; kind: Kind; role: 'caller' | 'callee'; name: string; phase: Phase; note?: string };
type Ctx = { startCall: (conversationId: string, kind: Kind, name: string) => Promise<void>; busy: boolean };
const CallCtx = createContext<Ctx>({ startCall: async () => {}, busy: false });
export const useCalls = () => useContext(CallCtx);

const RING_MS = 45_000;

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const sb = supabaseBrowser();
  const [call, setCall] = useState<Call | null>(null);
  const callRef = useRef<Call | null>(null); callRef.current = call;
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const chan = useRef<any>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const ringTimer = useRef<any>(null); const beep = useRef<any>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null); const localVideo = useRef<HTMLVideoElement>(null); const remoteAudio = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false); const [camOff, setCamOff] = useState(false); const [secs, setSecs] = useState(0);

  const stopRing = () => { clearInterval(beep.current); beep.current = null; };
  const ring = () => {
    stopRing();
    const tone = () => { try { const a = new AudioContext(); const o = a.createOscillator(); const g = a.createGain(); o.frequency.value = 440; g.gain.value = 0.05; o.connect(g); g.connect(a.destination); o.start(); setTimeout(() => { o.stop(); a.close(); }, 400); } catch { /* no audio */ } };
    tone(); beep.current = setInterval(tone, 2000);
  };

  const cleanup = useCallback((note?: string) => {
    stopRing(); clearTimeout(ringTimer.current);
    try { chan.current && sb.removeChannel(chan.current); } catch { /* ignore */ }
    chan.current = null;
    pc.current?.close(); pc.current = null;
    local.current?.getTracks().forEach((t) => t.stop()); local.current = null;
    pendingIce.current = [];
    setMuted(false); setCamOff(false);
    setCall((c) => (c ? { ...c, phase: 'ended', note: note || 'Call ended' } : c));
    setTimeout(() => setCall((c) => (c?.phase === 'ended' ? null : c)), 2500);
  }, [sb]);

  const send = (msg: any) => chan.current?.send({ type: 'broadcast', event: 'signal', payload: msg });

  const setupPeer = useCallback(async (id: string, role: 'caller' | 'callee') => {
    const { iceServers } = await api<{ iceServers: RTCIceServer[] }>('/api/calls/ice').catch(() => ({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }));
    const peer = new RTCPeerConnection({ iceServers });
    pc.current = peer;
    local.current?.getTracks().forEach((t) => peer.addTrack(t, local.current!));
    peer.ontrack = (e) => {
      const [stream] = e.streams;
      if (remoteVideo.current) remoteVideo.current.srcObject = stream;
      if (remoteAudio.current) remoteAudio.current.srcObject = stream;
    };
    peer.onicecandidate = (e) => { if (e.candidate) send({ t: 'ice', c: e.candidate.toJSON() }); };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') { stopRing(); clearTimeout(ringTimer.current); setSecs(0); setCall((c) => (c ? { ...c, phase: 'live' } : c)); }
      if (peer.connectionState === 'failed') { sb.rpc('update_call', { p_call: id, p_status: 'failed' }); send({ t: 'hangup' }); cleanup('Could not connect — the network may be blocking calls'); }
    };
    const addIce = async (c: RTCIceCandidateInit) => { if (peer.remoteDescription) await peer.addIceCandidate(c).catch(() => {}); else pendingIce.current.push(c); };
    const flushIce = async () => { for (const c of pendingIce.current.splice(0)) await peer.addIceCandidate(c).catch(() => {}); };
    const ch = sb.channel(`call:${id}`, { config: { private: true, broadcast: { self: false } } });
    chan.current = ch;
    ch.on('broadcast', { event: 'signal' }, async ({ payload: m }: any) => {
      if (m.t === 'ready' && role === 'caller') {
        setCall((c) => (c ? { ...c, phase: 'connecting' } : c));
        const offer = await peer.createOffer(); await peer.setLocalDescription(offer); send({ t: 'offer', sdp: offer });
      } else if (m.t === 'offer' && role === 'callee') {
        await peer.setRemoteDescription(m.sdp); await flushIce();
        const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); send({ t: 'answer', sdp: answer });
      } else if (m.t === 'answer' && role === 'caller') {
        await peer.setRemoteDescription(m.sdp); await flushIce();
      } else if (m.t === 'ice') { await addIce(m.c); }
      else if (m.t === 'hangup') { cleanup('Call ended'); }
    });
    ch.subscribe((status: string) => { if (status === 'SUBSCRIBED' && role === 'callee') send({ t: 'ready' }); });
  }, [sb, cleanup]);

  const media = async (kind: Kind) => {
    local.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: kind === 'video' ? { facingMode: 'user', width: { ideal: 640 } } : false });
    setTimeout(() => { if (localVideo.current && local.current) { localVideo.current.srcObject = local.current; localVideo.current.play().catch(() => {}); } }, 50);
  };

  const startCall = useCallback(async (conversationId: string, kind: Kind, name: string) => {
    if (callRef.current) return;
    try {
      await media(kind);
    } catch { alert('Allow microphone' + (kind === 'video' ? ' and camera' : '') + ' access to call.'); return; }
    const { data: id, error } = await sb.rpc('start_call', { p_conv: conversationId, p_kind: kind });
    if (error || !id) { local.current?.getTracks().forEach((t) => t.stop()); local.current = null; alert(error?.message || 'Could not call'); return; }
    setCall({ id, kind, role: 'caller', name, phase: 'calling' });
    await setupPeer(id, 'caller');
    ringTimer.current = setTimeout(() => {
      if (callRef.current?.phase === 'calling') { sb.rpc('update_call', { p_call: id, p_status: 'ended' }); cleanup('No answer'); }
    }, RING_MS);
  }, [sb, setupPeer, cleanup]);

  const accept = async () => {
    const c = callRef.current; if (!c) return;
    stopRing();
    try { await media(c.kind); } catch { alert('Allow microphone access to answer.'); return decline(); }
    const { data } = await sb.rpc('update_call', { p_call: c.id, p_status: 'accepted' });
    if (data !== 'accepted') return cleanup('The call was cancelled');
    setCall({ ...c, phase: 'connecting' });
    await setupPeer(c.id, 'callee');
  };
  const decline = async () => { const c = callRef.current; if (!c) return; await sb.rpc('update_call', { p_call: c.id, p_status: 'declined' }); cleanup('Declined'); };
  const hangup = async () => { const c = callRef.current; if (!c) return; send({ t: 'hangup' }); await sb.rpc('update_call', { p_call: c.id, p_status: 'ended' }); cleanup('Call ended'); };

  // incoming calls + the other side's answer/decline
  useEffect(() => {
    if (!user || (user as any).is_anonymous) return;
    const ch = sb.channel(`calls-for-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` }, async ({ new: k }: any) => {
        if (k.status !== 'ringing') return;
        if (callRef.current) { sb.rpc('update_call', { p_call: k.id, p_status: 'declined' }); return; }   // already on a call
        const { data } = await sb.rpc('my_inbox');
        const conv = (data || []).find((x: any) => x.id === k.conversation_id);
        setCall({ id: k.id, kind: k.kind, role: 'callee', name: conv?.other_name || 'A student', phase: 'incoming' });
        ring();
        ringTimer.current = setTimeout(() => { if (callRef.current?.id === k.id && callRef.current?.phase === 'incoming') cleanup('Missed call'); }, RING_MS + 5000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `caller_id=eq.${user.id}` }, ({ new: k }: any) => {
        if (callRef.current?.id === k.id && ['declined', 'missed', 'busy'].includes(k.status)) cleanup(k.status === 'declined' ? 'Call declined' : 'No answer');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `callee_id=eq.${user.id}` }, ({ new: k }: any) => {
        if (callRef.current?.id === k.id && callRef.current?.phase === 'incoming' && k.status !== 'ringing') cleanup('Missed call');
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [user, sb, cleanup]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (call?.phase !== 'live') return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [call?.phase]);
  useEffect(() => () => cleanup(), [cleanup]);
  useEffect(() => {   // attach my camera preview whenever the call screen re-renders
    if (localVideo.current && local.current && localVideo.current.srcObject !== local.current) { localVideo.current.srcObject = local.current; localVideo.current.play().catch(() => {}); }
  }, [call?.phase]);

  const toggleMute = () => { local.current?.getAudioTracks().forEach((t) => (t.enabled = muted)); setMuted(!muted); };
  const toggleCam = () => { local.current?.getVideoTracks().forEach((t) => (t.enabled = camOff)); setCamOff(!camOff); };
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <CallCtx.Provider value={{ startCall, busy: !!call }}>
      {children}
      {call && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/95 p-4 text-white" role="dialog" aria-label="Call">
          {call.kind === 'video' && call.phase !== 'incoming' && <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />}
          <audio ref={remoteAudio} autoPlay />
          <div className="relative z-10 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-600 text-4xl font-bold">{call.name[0]?.toUpperCase()}</div>
            <p className="mt-4 text-2xl font-bold">{call.name}</p>
            <p className="mt-1 text-sm text-slate-300">
              {call.phase === 'incoming' ? `Incoming ${call.kind} call…` : call.phase === 'calling' ? 'Ringing…' : call.phase === 'connecting' ? <><Loader2 size={14} className="inline animate-spin" /> Connecting…</> : call.phase === 'live' ? mmss : call.note}
            </p>
          </div>
          {call.kind === 'video' && call.phase !== 'incoming' && call.phase !== 'ended' && <video ref={localVideo} autoPlay muted playsInline className="absolute end-4 top-4 z-10 h-40 w-28 rounded-xl border-2 border-white/40 bg-black object-cover -scale-x-100" />}
          <div className="absolute bottom-10 z-10 flex gap-5">
            {call.phase === 'incoming' ? <>
              <button onClick={decline} className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600" aria-label="Decline"><PhoneOff /></button>
              <button onClick={accept} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600" aria-label="Answer">{call.kind === 'video' ? <Video /> : <Phone />}</button>
            </> : call.phase !== 'ended' && <>
              <button onClick={toggleMute} className={`flex h-14 w-14 items-center justify-center rounded-full ${muted ? 'bg-white text-slate-900' : 'bg-white/15'}`} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <MicOff /> : <Mic />}</button>
              {call.kind === 'video' && <button onClick={toggleCam} className={`flex h-14 w-14 items-center justify-center rounded-full ${camOff ? 'bg-white text-slate-900' : 'bg-white/15'}`} aria-label="Camera">{camOff ? <VideoOff /> : <Video />}</button>}
              <button onClick={hangup} className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-600" aria-label="End call"><PhoneOff /></button>
            </>}
          </div>
        </div>
      )}
    </CallCtx.Provider>
  );
}
