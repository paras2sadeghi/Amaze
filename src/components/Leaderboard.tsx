import { motion } from 'motion/react';
import { Trophy, X, Medal, Timer, Move } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  name: string;
  level: number;
  time: number;
  moves: number;
  skin: string;
}

interface LeaderboardProps {
  onClose: () => void;
  entries: LeaderboardEntry[];
}

export default function Leaderboard({ onClose, entries }: LeaderboardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400" size={24} />
            <h2 className="text-2xl font-black tracking-tighter text-white">LEGENDS ONLY</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Empty here... go set a record! 🏆
            </div>
          ) : (
            entries.sort((a, b) => b.level - a.level || a.time - b.time).map((entry, index) => (
              <div 
                key={entry.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  index === 0 
                    ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' 
                    : 'bg-slate-950/50 border-slate-800'
                }`}
              >
                <div className="w-8 flex justify-center">
                  {index < 3 ? (
                    <Medal className={
                      index === 0 ? 'text-yellow-400' : 
                      index === 1 ? 'text-slate-300' : 
                      'text-amber-600'
                    } size={20} />
                  ) : (
                    <span className="text-slate-500 font-mono text-sm">{index + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate uppercase tracking-wide">
                    {entry.name}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                    LVL {entry.level} • {entry.skin}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 text-cyan-400">
                    <Timer size={12} />
                    <span className="text-xs font-bold font-mono">{entry.time}s</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Move size={10} />
                    <span className="text-[10px] font-mono">{entry.moves}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-900/80 border-t border-slate-800">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-100 text-slate-950 rounded-xl font-black tracking-widest active:scale-95 transition-transform"
          >
            BACK TO GRID
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
