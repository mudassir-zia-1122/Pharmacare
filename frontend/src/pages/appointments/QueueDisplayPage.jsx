import { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Clock,
  Building2,
  Stethoscope,
  Sparkles,
  RefreshCw,
  Users,
} from 'lucide-react';
import { appointmentApi } from '../../api';

// Synthesize pleasant hospital chime using Web Audio API
function playChimeSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880.0, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(293.66, now); // D4
    osc2.frequency.setValueAtTime(440.0, now + 0.15); // A4

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.9);
    osc2.stop(now + 0.9);
  } catch (err) {
    console.warn('Audio chime play error:', err);
  }
}

export function QueueDisplayPage() {
  const [queueData, setQueueData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const prevServingRef = useRef({});

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch queue data
  const loadQueue = async () => {
    try {
      const res = await appointmentApi.fetchWaitingRoomDisplay();
      if (res && res.data) {
        const rawList = res.data.doctors || res.data.rooms || [];
        const rooms = rawList.map((r) => ({
          ...r,
          currentlyServing:
            r.currentlyServing ||
            (r.currentToken && r.currentToken !== '—'
              ? { tokenDisplay: r.currentToken }
              : null),
        }));
        // Check if any room has a newly called token
        let hasNewCall = false;
        rooms.forEach((r) => {
          const currentToken = r.currentlyServing?.tokenDisplay;
          const prevToken = prevServingRef.current[r.doctorId];
          if (currentToken && currentToken !== prevToken) {
            hasNewCall = true;
            prevServingRef.current[r.doctorId] = currentToken;
          }
        });

        if (hasNewCall && audioEnabled) {
          playChimeSound();
        }

        setQueueData(rooms);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to load queue display:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 8 seconds
  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 8000);
    return () => clearInterval(interval);
  }, [audioEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top TV Header Bar */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              PharmaCare Clinic
              <span className="text-xs uppercase font-bold tracking-widest px-2.5 py-1 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Live TV Queue
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Outpatient Department Consultation & Token Board
            </p>
          </div>
        </div>

        {/* Live Clock & TV Controls */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-mono font-black text-teal-400 tracking-wider">
              {formattedTime}
            </div>
            <div className="text-xs text-slate-400 font-medium">{formattedDate}</div>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              title={audioEnabled ? 'Mute Chime' : 'Enable Chime'}
              className={`p-2.5 rounded-xl border transition-colors ${
                audioEnabled
                  ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Queue Stage */}
      <main className="flex-1 p-6 overflow-y-auto">
        {loading && queueData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <RefreshCw className="w-12 h-12 text-teal-400 animate-spin" />
          </div>
        ) : queueData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-12">
            <Building2 className="w-16 h-16 text-slate-700 mb-4" />
            <h2 className="text-2xl font-bold text-slate-400">No Active Clinics Today</h2>
            <p className="text-sm text-slate-600 mt-1">
              Doctor consultation schedules and queues will appear when clinics open.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {queueData.map((room) => {
              const isCalling = !!room.currentlyServing;
              return (
                <div
                  key={room.doctorId}
                  className="rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between"
                >
                  {/* Doctor & Room Top Strip */}
                  <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800/80 border-b border-slate-800 flex items-start justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-bold uppercase tracking-wider mb-2">
                        <Building2 className="w-3.5 h-3.5" />
                        {room.roomNumber || 'Consultation Room'}
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-tight">{room.doctorName}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{room.departmentName}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                        Waiting
                      </span>
                      <span className="text-lg font-bold text-slate-200 flex items-center gap-1 justify-end">
                        <Users className="w-4 h-4 text-slate-400" />
                        {room.waitingCount}
                      </span>
                    </div>
                  </div>

                  {/* CURRENTLY SERVING TOKEN HERO */}
                  <div className="p-6 text-center flex-1 flex flex-col justify-center items-center bg-slate-950/40">
                    <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400 mb-2">
                      Now Serving
                    </span>
                    {isCalling ? (
                      <div className="w-full py-5 px-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-emerald-600/10 border-2 border-emerald-500/50 shadow-inner">
                        <div className="text-5xl sm:text-6xl font-black text-emerald-400 tracking-tight animate-pulse">
                          {room.currentlyServing.tokenDisplay}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-300 mt-1 inline-block">
                          Please Proceed Inside
                        </span>
                      </div>
                    ) : (
                      <div className="w-full py-6 rounded-2xl border border-dashed border-slate-800 text-slate-600 font-semibold text-sm">
                        Waiting for next patient...
                      </div>
                    )}
                  </div>

                  {/* UP NEXT TOKENS STRIP */}
                  <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Up Next:
                    </span>
                    <div className="flex items-center gap-2">
                      {room.nextTokens && room.nextTokens.length > 0 ? (
                        room.nextTokens.slice(0, 3).map((token, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold"
                          >
                            {token}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-600 italic">Queue clear</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Ticker / Running Footer */}
      <footer className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold text-slate-300">Live Queue System Active</span>
          <span>•</span>
          <span>Please report to the reception desk with your reference slip</span>
        </div>
        <div>
          Auto-refreshing every 8s • Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </footer>
    </div>
  );
}
