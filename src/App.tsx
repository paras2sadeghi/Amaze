import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { Trophy, Timer, Move, Play, ChevronRight, Database, Eye, Sparkles, Rabbit, Cat, PawPrint, Carrot, Fish, Leaf, Circle, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateMaze } from './utils/mazeGenerator';
import { Cell, GameState, SkinType } from './types';

// Progressive difficulty calculation
const getLevelConfig = (level: number) => {
  const size = Math.min(5 + Math.floor(level / 2), 25); // Starts at 5x5, increases every 2 levels
  const shards = Math.min(1 + Math.floor(level / 3), 10); // Starts at 1 shard, increases every 3 levels
  return { size, shards };
};

const SKINS: { type: SkinType; name: string; icon: any; shard: any; unlockLevel: number; color: string; shardColor: string }[] = [
  { type: 'spark', name: 'Spark', icon: Circle, shard: Database, unlockLevel: 1, color: 'text-cyan-400', shardColor: 'text-fuchsia-500' },
  { type: 'bunny', name: 'Bunny', icon: Rabbit, shard: Carrot, unlockLevel: 2, color: 'text-pink-400', shardColor: 'text-orange-500' },
  { type: 'cat', name: 'Cat', icon: Cat, shard: Fish, unlockLevel: 4, color: 'text-yellow-400', shardColor: 'text-blue-400' },
  { type: 'panda', name: 'Panda', icon: PawPrint, shard: Leaf, unlockLevel: 6, color: 'text-white', shardColor: 'text-emerald-500' },
];

export default function App() {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [gameState, setGameState] = useState<GameState>({
    status: 'start',
    difficulty: 'easy',
    level: 1,
    moves: 0,
    shardsCollected: 0,
    totalShards: 1,
    startTime: null,
    endTime: null,
    activeSkin: 'spark',
  });
  const [time, setTime] = useState(0);
  const [cellSize, setCellSize] = useState(40);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMoveTime = useRef<number>(0);

  // Responsive cell size calculation
  useEffect(() => {
    const updateSize = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const config = getLevelConfig(gameState.level);
      const availableWidth = screenWidth - 40;
      const availableHeight = screenHeight - 200; // Space for UI
      const size = Math.min(availableWidth / config.size, availableHeight / config.size, 60);
      setCellSize(size);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [gameState.level, gameState.status]);

  const initGame = useCallback((nextLevel?: number) => {
    const level = nextLevel || gameState.level;
    const config = getLevelConfig(level);
    const newGrid = generateMaze(config.size, config.size, config.shards);
    
    setGrid(newGrid);
    setPlayerPos({ x: 0, y: 0 });
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      level,
      moves: 0,
      shardsCollected: 0,
      totalShards: config.shards,
      startTime: Date.now(),
      endTime: null,
    }));
    setTime(0);
    setIsScannerActive(false);
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  }, [gameState.level]);

  const handleWin = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState(prev => ({
      ...prev,
      status: 'won',
      endTime: Date.now(),
    }));
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#06b6d4', '#d946ef', '#10b981'],
    });
  }, []);

  const movePlayer = useCallback((dx: number, dy: number) => {
    if (gameState.status !== 'playing') return;

    const now = Date.now();
    if (now - lastMoveTime.current < 50) return;
    lastMoveTime.current = now;

    setPlayerPos(prev => {
      const newX = prev.x + dx;
      const newY = prev.y + dy;
      const config = getLevelConfig(gameState.level);

      if (newX < 0 || newX >= config.size || newY < 0 || newY >= config.size) return prev;

      const currentCell = grid[prev.y][prev.x];
      if (dx === 1 && currentCell.walls.right) return prev;
      if (dx === -1 && currentCell.walls.left) return prev;
      if (dy === 1 && currentCell.walls.bottom) return prev;
      if (dy === -1 && currentCell.walls.top) return prev;

      // Shard collection
      const nextCell = grid[newY][newX];
      if (nextCell.hasShard) {
        nextCell.hasShard = false;
        setGameState(s => ({ ...s, shardsCollected: s.shardsCollected + 1 }));
      }

      setGameState(s => ({ ...s, moves: s.moves + 1 }));

      // Win check (must have all shards)
      if (newX === config.size - 1 && newY === config.size - 1) {
        if (gameState.shardsCollected + (nextCell.hasShard ? 1 : 0) >= gameState.totalShards) {
          handleWin();
        }
      }

      return { x: newX, y: newY };
    });
  }, [grid, gameState.status, gameState.level, gameState.shardsCollected, gameState.totalShards, handleWin]);

  const activateScanner = () => {
    if (isScannerActive || gameState.status !== 'playing') return;
    setIsScannerActive(true);
    setTimeout(() => setIsScannerActive(false), 2500);
  };

  const handlePan = (_: any, info: PanInfo) => {
    if (gameState.status !== 'playing') return;
    
    const threshold = 15;
    const { x, y } = info.offset;
    
    if (Math.abs(x) > Math.abs(y)) {
      if (x > threshold) movePlayer(1, 0);
      else if (x < -threshold) movePlayer(-1, 0);
    } else {
      if (y > threshold) movePlayer(0, 1);
      else if (y < -threshold) movePlayer(0, -1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': movePlayer(0, -1); break;
        case 'ArrowDown': case 's': movePlayer(0, 1); break;
        case 'ArrowLeft': case 'a': movePlayer(-1, 0); break;
        case 'ArrowRight': case 'd': movePlayer(1, 0); break;
        case ' ': activateScanner(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer]);

  const config = getLevelConfig(gameState.level);
  const mazeWidth = config.size * cellSize;
  const mazeHeight = config.size * cellSize;

  const activeSkinData = SKINS.find(s => s.type === gameState.activeSkin) || SKINS[0];
  const ShardIcon = activeSkinData.shard;
  const PlayerIcon = activeSkinData.icon;

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 flex flex-col items-center p-4 overflow-hidden touch-none select-none">
      
      {/* Header / Stats */}
      <div className="w-full max-w-md flex justify-between items-end mb-4 z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent">
              Amaze!
            </h1>
            <div className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-bold text-cyan-400">
              LVL {gameState.level}
            </div>
          </div>
          <div className="flex gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Timer size={10} /> {time}s</span>
            <span className="flex items-center gap-1"><Move size={10} /> {gameState.moves}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Items</div>
          <div className="flex gap-1">
            {Array.from({ length: gameState.totalShards }).map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-4 rounded-sm transition-all duration-500 ${
                  i < gameState.shardsCollected 
                    ? 'bg-fuchsia-500 shadow-[0_0_10px_#d946ef]' 
                    : 'bg-slate-800'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* The Maze Container */}
      <div className="relative flex-1 flex items-center justify-center w-full">
        <motion.div 
          onPan={handlePan}
          className="relative bg-slate-900/20 border border-slate-800/50 rounded-3xl p-2 backdrop-blur-md shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing"
        >
          <motion.div 
            className="relative"
            style={{ 
              width: mazeWidth, 
              height: mazeHeight,
              display: 'grid',
              gridTemplateColumns: `repeat(${config.size}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${config.size}, ${cellSize}px)`
            }}
          >
            {grid.map((row, y) => row.map((cell, x) => (
              <div 
                key={`${x}-${y}`}
                className="relative"
                style={{
                  borderTop: cell.walls.top ? '1px solid rgba(30, 41, 59, 0.5)' : 'none',
                  borderRight: cell.walls.right ? '1px solid rgba(30, 41, 59, 0.5)' : 'none',
                  borderBottom: cell.walls.bottom ? '1px solid rgba(30, 41, 59, 0.5)' : 'none',
                  borderLeft: cell.walls.left ? '1px solid rgba(30, 41, 59, 0.5)' : 'none',
                }}
              >
                <div className="absolute inset-0 border-[0.5px] border-slate-800/20 pointer-events-none" />

                {cell.hasShard && (
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.2, 1], 
                      rotate: [0, 5, -5, 0],
                      opacity: [0.8, 1, 0.8]
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 flex items-center justify-center p-1"
                  >
                    <ShardIcon size={cellSize * 0.6} className={`${activeSkinData.shardColor} drop-shadow-[0_0_8px_currentColor]`} />
                  </motion.div>
                )}
                
                {x === config.size - 1 && y === config.size - 1 && (
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${gameState.shardsCollected >= gameState.totalShards ? 'opacity-100 scale-100' : 'opacity-10 scale-50'}`}>
                    <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_20px_#10b981] animate-pulse" />
                    <div className="absolute inset-0 bg-emerald-400/20 animate-ping rounded-full" />
                  </div>
                )}
              </div>
            )))}

            {!isScannerActive && (
              <div 
                className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle ${cellSize * 2.5}px at ${playerPos.x * cellSize + cellSize/2}px ${playerPos.y * cellSize + cellSize/2}px, transparent 0%, rgba(2, 6, 23, 0.98) 85%)`
                }}
              />
            )}

            <motion.div 
              className="absolute z-30 flex items-center justify-center"
              animate={{ 
                x: playerPos.x * cellSize, 
                y: playerPos.y * cellSize 
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              style={{ width: cellSize, height: cellSize }}
            >
              <PlayerIcon size={cellSize * 0.8} className={`${activeSkinData.color} drop-shadow-[0_0_10px_currentColor]`} />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Controls / Scanner */}
      <div className="mt-4 flex flex-col items-center gap-4 z-10">
        <button 
          onPointerDown={activateScanner}
          className={`group relative flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all duration-500 ${
            isScannerActive 
              ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.4)]' 
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <Eye size={20} className={isScannerActive ? 'text-white' : 'text-cyan-400'} />
          <div className="text-left">
            <div className={`text-[10px] font-bold uppercase tracking-widest ${isScannerActive ? 'text-white' : 'text-slate-500'}`}>
              Scanner
            </div>
          </div>
          {isScannerActive && (
            <motion.div 
              layoutId="scanner-progress"
              className="absolute bottom-0 left-0 h-1 bg-white"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 2.5, ease: "linear" }}
            />
          )}
        </button>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <Sparkles size={14} className="text-fuchsia-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Swipe to move</span>
          </div>
        </div>
      </div>

      {/* OVERLAYS */}
      <AnimatePresence>
        {gameState.status === 'start' && (
          <motion.div 
            key="start-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full space-y-8 text-center"
            >
              <div className="space-y-2">
                <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent">
                  Amaze!
                </h1>
                <p className="text-slate-400 text-sm">Unlock cute skins as you clear sectors.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {SKINS.map((skin) => {
                  const isLocked = gameState.level < skin.unlockLevel;
                  const isActive = gameState.activeSkin === skin.type;
                  const Icon = skin.icon;
                  return (
                    <button
                      key={skin.type}
                      disabled={isLocked}
                      onClick={() => setGameState(s => ({ ...s, activeSkin: skin.type }))}
                      className={`relative p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                        isActive 
                          ? 'bg-slate-900 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                          : isLocked ? 'bg-slate-950 border-slate-900 opacity-40' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isLocked && <Lock size={14} className="absolute top-2 right-2 text-slate-600" />}
                      <Icon size={32} className={skin.color} />
                      <div className="text-[10px] font-bold uppercase tracking-widest">{skin.name}</div>
                      {isLocked && <div className="text-[8px] text-slate-500">LVL {skin.unlockLevel}</div>}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => initGame()}
                className="w-full py-5 bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white rounded-3xl font-black tracking-widest shadow-2xl shadow-cyan-500/20 active:scale-95 transition-transform text-lg"
              >
                INITIALIZE HACK
              </button>
            </motion.div>
          </motion.div>
        )}

        {gameState.status === 'won' && (
          <motion.div 
            key="won-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full space-y-8 text-center"
            >
              <div className="relative mx-auto w-24 h-24">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                  className="absolute inset-0 border-2 border-dashed border-emerald-500/30 rounded-full"
                />
                <div className="absolute inset-2 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30">
                  <Trophy size={48} className="text-emerald-400" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter">SECTOR CLEARED</h2>
                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Level {gameState.level} Complete</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">Time</div>
                  <div className="text-2xl font-bold text-cyan-400">{time}s</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">Moves</div>
                  <div className="text-2xl font-bold text-fuchsia-400">{gameState.moves}</div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => initGame()}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors"
                >
                  REPLAY
                </button>
                <button 
                  onClick={() => initGame(gameState.level + 1)}
                  className="flex-[2] py-4 bg-white text-slate-950 rounded-2xl font-black tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  NEXT SECTOR <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
