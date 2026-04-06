import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { Trophy, Timer, Move, Play, ChevronRight, Database, Eye, Sparkles, Rabbit, Cat, PawPrint, Carrot, Fish, Leaf, Circle, Lock, Skull, Flame, Heart, User, Dog, Bone, Zap, Ghost, Rocket } from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateMaze } from './utils/mazeGenerator';
import { Cell, GameState, SkinType, Enemy, SkinCharacter } from './types';
import Leaderboard from './components/Leaderboard';
import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, handleFirestoreError, OperationType } from './firebase';

const Dot = ({ size, className }: { size: number; className?: string }) => (
  <div 
    className={`${className} rounded-full bg-current`} 
    style={{ width: size * 0.4, height: size * 0.4 }} 
  />
);

// Progressive difficulty calculation
const getLevelConfig = (level: number) => {
  const size = Math.min(5 + Math.floor(level / 2), 25); // Starts at 5x5, increases every 2 levels
  const shards = Math.min(1 + Math.floor(level / 2), 12); // Starts at 1 shard, increases every 2 levels
  return { size, shards };
};

const SKINS: { type: SkinType; name: string; icon: any; shard: any; color: string; shardColor: string; perk: string; unlockLevel?: number }[] = [
  { type: 'default', name: 'Circle', icon: Circle, shard: Database, color: 'text-slate-400', shardColor: 'text-slate-500', perk: 'Standard: No special abilities' },
  { type: 'spark', name: 'Spark', icon: Zap, shard: Database, color: 'text-cyan-400', shardColor: 'text-fuchsia-500', perk: 'Hyper-Drive: Faster movement speed', unlockLevel: 10 },
  { type: 'bunny', name: 'Bunny', icon: Rabbit, shard: Carrot, color: 'text-pink-400', shardColor: 'text-orange-500', perk: 'Vitality: Start with 5 lives', unlockLevel: 20 },
  { type: 'cat', name: 'Cat', icon: Cat, shard: Fish, color: 'text-yellow-400', shardColor: 'text-blue-400', perk: 'Vision: Scanner lasts 5 seconds', unlockLevel: 30 },
  { type: 'dog', name: 'Doggo', icon: Dog, shard: Bone, color: 'text-white', shardColor: 'text-emerald-500', perk: 'Magnet: Collect adjacent shards', unlockLevel: 40 },
];

export default function App() {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
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
    activeSkin: 'default',
    unlockedSkins: ['default'],
    lives: 3,
  });
  const [skinCharacter, setSkinCharacter] = useState<SkinCharacter | null>(null);
  const [time, setTime] = useState(0);
  const [cellSize, setCellSize] = useState(40);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSkinSelection, setShowSkinSelection] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('maze_player_name') || '');
  const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMoveTime = useRef<number>(0);

  // Leaderboard listener
  useEffect(() => {
    const q = query(collection(db, 'leaderboard'), orderBy('level', 'desc'), orderBy('time', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeaderboardEntries(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leaderboard');
    });
    return () => unsubscribe();
  }, []);

  const submitScore = async () => {
    if (!playerName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    localStorage.setItem('maze_player_name', playerName.trim());
    try {
      await addDoc(collection(db, 'leaderboard'), {
        name: playerName.trim(),
        level: gameState.level,
        time: time,
        moves: gameState.moves,
        skin: gameState.activeSkin,
        createdAt: serverTimestamp()
      });
      initGame(gameState.level + 1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'leaderboard');
    } finally {
      setIsSubmitting(false);
    }
  };
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
    const { grid: newGrid, enemies: newEnemies } = generateMaze(config.size, config.size, config.shards, level);
    
    setGrid(newGrid);
    setEnemies(newEnemies);
    setPlayerPos({ x: 0, y: 0 });
    
    // Spawn Skin Character every 10 levels
    const skinToSpawn = SKINS.find(s => s.unlockLevel === level);
    if (skinToSpawn) {
      setSkinCharacter({
        type: skinToSpawn.type,
        x: config.size - 1,
        y: config.size - 1,
        isCaught: false
      });
    } else {
      setSkinCharacter(null);
    }

    const initialLives = gameState.activeSkin === 'bunny' ? 5 : 3;

    setGameState(prev => ({
      ...prev,
      status: 'playing',
      level,
      moves: 0,
      shardsCollected: 0,
      totalShards: config.shards,
      startTime: Date.now(),
      endTime: null,
      lives: initialLives,
    }));
    setTime(0);
    setIsScannerActive(false);
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  }, [gameState.level, gameState.activeSkin]);

  const handleGameOver = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState(prev => ({ ...prev, status: 'gameover' }));
  }, []);

  const handleHit = useCallback(() => {
    setGameState(prev => {
      const newLives = prev.lives - 1;
      if (newLives <= 0) {
        handleGameOver();
        return { ...prev, lives: 0 };
      }
      // Reset player position on hit
      setPlayerPos({ x: 0, y: 0 });
      return { ...prev, lives: newLives };
    });
  }, [handleGameOver]);

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

    const moveCooldown = gameState.activeSkin === 'spark' ? 30 : 50;
    const now = Date.now();
    if (now - lastMoveTime.current < moveCooldown) return;
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
      let shardsFound = 0;
      
      if (nextCell.hasShard) {
        nextCell.hasShard = false;
        shardsFound++;
      }

      // Skin Character collection
      if (skinCharacter && !skinCharacter.isCaught && newX === skinCharacter.x && newY === skinCharacter.y) {
        setSkinCharacter(prev => prev ? { ...prev, isCaught: true } : null);
        setGameState(s => ({ 
          ...s, 
          activeSkin: skinCharacter.type,
          unlockedSkins: [...s.unlockedSkins, skinCharacter.type]
        }));
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { x: 0.5, y: 0.5 },
          colors: ['#06b6d4', '#d946ef']
        });
      }

      // Panda Magnet Perk: Collect adjacent shards
      if (gameState.activeSkin === 'dog') {
        const neighbors = [
          { nx: newX + 1, ny: newY },
          { nx: newX - 1, ny: newY },
          { nx: newX, ny: newY + 1 },
          { nx: newX, ny: newY - 1 },
        ];
        neighbors.forEach(({ nx, ny }) => {
          if (nx >= 0 && nx < config.size && ny >= 0 && ny < config.size) {
            const neighborCell = grid[ny][nx];
            if (neighborCell.hasShard) {
              neighborCell.hasShard = false;
              shardsFound++;
            }
          }
        });
      }

      if (shardsFound > 0) {
        setGameState(s => ({ ...s, shardsCollected: s.shardsCollected + shardsFound }));
      }

      // Obstacle collision
      if (nextCell.isObstacle) {
        handleHit();
        return prev;
      }

      setGameState(s => ({ ...s, moves: s.moves + 1 }));

      // Win check (must have all shards)
      if (newX === config.size - 1 && newY === config.size - 1) {
        if (gameState.shardsCollected + shardsFound >= gameState.totalShards) {
          handleWin();
        }
      }

      return { x: newX, y: newY };
    });
  }, [grid, gameState.status, gameState.level, gameState.shardsCollected, gameState.totalShards, gameState.activeSkin, handleWin, handleHit]);

  // Enemy movement
  useEffect(() => {
    if (gameState.status !== 'playing' || enemies.length === 0) return;

    const interval = setInterval(() => {
      setEnemies(prevEnemies => prevEnemies.map(enemy => {
        const directions: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];
        let nextDir = enemy.direction;

        if (enemy.type === 'random' && Math.random() > 0.7) {
          nextDir = directions[Math.floor(Math.random() * 4)];
        }

        let dx = 0, dy = 0;
        if (nextDir === 'up') dy = -1;
        else if (nextDir === 'down') dy = 1;
        else if (nextDir === 'left') dx = -1;
        else if (nextDir === 'right') dx = 1;

        const newX = enemy.x + dx;
        const newY = enemy.y + dy;
        const config = getLevelConfig(gameState.level);

        if (newX >= 0 && newX < config.size && newY >= 0 && newY < config.size) {
          const cell = grid[enemy.y][enemy.x];
          let blocked = false;
          if (dx === 1 && cell.walls.right) blocked = true;
          if (dx === -1 && cell.walls.left) blocked = true;
          if (dy === 1 && cell.walls.bottom) blocked = true;
          if (dy === -1 && cell.walls.top) blocked = true;

          if (!blocked) {
            return { ...enemy, x: newX, y: newY, direction: nextDir };
          }
        }

        return { ...enemy, direction: directions[Math.floor(Math.random() * 4)] };
      }));
    }, Math.max(400, 800 - (gameState.level * 10))); // Enemies get faster

    return () => clearInterval(interval);
  }, [gameState.status, enemies.length, grid, gameState.level]);

  // Collision check with enemies
  useEffect(() => {
    if (gameState.status !== 'playing') return;
    const hit = enemies.find(e => e.x === playerPos.x && e.y === playerPos.y);
    if (hit) {
      handleHit();
    }
  }, [playerPos, enemies, gameState.status, handleHit]);

  const activateScanner = () => {
    if (isScannerActive || gameState.status !== 'playing') return;
    setIsScannerActive(true);
    const duration = gameState.activeSkin === 'cat' ? 5000 : 2500;
    setTimeout(() => setIsScannerActive(false), duration);
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
              LEVEL {gameState.level}
            </div>
          </div>
          <div className="flex gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Timer size={10} /> {time}s</span>
            <span className="flex items-center gap-1"><Move size={10} /> {gameState.moves}</span>
            {enemies.length > 0 && (
              <span className="flex items-center gap-1 text-red-500"><Heart size={10} fill="currentColor" /> {gameState.lives}</span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">LOOT</div>
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

                {skinCharacter && !skinCharacter.isCaught && x === skinCharacter.x && y === skinCharacter.y && (
                  <motion.div 
                    animate={{ 
                      y: [0, -4, 0],
                      scale: [1, 1.1, 1],
                      filter: ['drop-shadow(0 0 5px rgba(255,255,255,0.5))', 'drop-shadow(0 0 15px rgba(255,255,255,0.8))', 'drop-shadow(0 0 5px rgba(255,255,255,0.5))']
                    }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 flex items-center justify-center p-1 z-10"
                  >
                    {(() => {
                      const SkinIcon = SKINS.find(s => s.type === skinCharacter.type)?.icon || Sparkles;
                      const skinColor = SKINS.find(s => s.type === skinCharacter.type)?.color || 'text-white';
                      return <SkinIcon size={cellSize * 0.8} className={`${skinColor} animate-pulse`} />;
                    })()}
                  </motion.div>
                )}

                {cell.isObstacle && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Flame size={cellSize * 0.6} className="text-red-500 animate-pulse" />
                  </div>
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
                y: playerPos.y * cellSize,
                scale: gameState.status === 'playing' ? 1 : 0.8,
                rotate: gameState.lives < 3 ? [0, -10, 10, -10, 0] : 0
              }}
              transition={{ 
                x: { type: 'spring', stiffness: 500, damping: 40 },
                y: { type: 'spring', stiffness: 500, damping: 40 },
                rotate: { duration: 0.4 }
              }}
              style={{ width: cellSize, height: cellSize }}
            >
              <PlayerIcon size={cellSize * 0.8} className={`${activeSkinData.color} drop-shadow-[0_0_10px_currentColor]`} />
            </motion.div>

            {enemies.map(enemy => (
              <motion.div
                key={enemy.id}
                className="absolute z-20 flex items-center justify-center"
                animate={{ x: enemy.x * cellSize, y: enemy.y * cellSize }}
                transition={{ type: 'tween', duration: 0.8 }}
                style={{ width: cellSize, height: cellSize }}
              >
                <Skull size={cellSize * 0.7} className="text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
              </motion.div>
            ))}
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
              X-RAY VISION
            </div>
            <div className="text-[8px] text-slate-500 font-mono">
              {gameState.activeSkin === 'cat' ? 'SUPER POWER (5s)' : 'NORMAL (2.5s)'}
            </div>
          </div>
          {isScannerActive && (
            <motion.div 
              layoutId="scanner-progress"
              className="absolute bottom-0 left-0 h-1 bg-white"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: gameState.activeSkin === 'cat' ? 5 : 2.5, ease: "linear" }}
            />
          )}
        </button>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <Sparkles size={14} className="text-fuchsia-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">WIGGLE TO MOVE</span>
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
                <p className="text-slate-400 text-sm">
                  Run through the maze, grab the loot, and unlock cool pets every 10 levels! 🚀
                </p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <Circle size={48} className="text-slate-400" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Starting Out</div>
                    <div className="text-xl font-black text-white">Circle</div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You're just a circle for now. Reach Level 10 to find your first pet! 🐶
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => initGame()}
                  className="w-full py-5 bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white rounded-3xl font-black tracking-widest shadow-2xl shadow-cyan-500/20 active:scale-95 transition-transform text-lg"
                >
                  LET'S GOOO!
                </button>

                <button 
                  onClick={() => setShowLeaderboard(true)}
                  className="w-full py-4 bg-slate-900/50 border border-slate-800 text-slate-400 rounded-2xl font-bold tracking-widest hover:border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <Trophy size={18} /> LEGENDS ONLY
                </button>

                {gameState.unlockedSkins.length > 1 && (
                  <button 
                    onClick={() => setShowSkinSelection(true)}
                    className="w-full py-4 bg-slate-900/50 border border-slate-800 text-slate-400 rounded-2xl font-bold tracking-widest hover:border-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    <User size={18} /> CHANGE SKIN
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSkinSelection && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full space-y-8 text-center"
            >
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter text-white">SELECT SKIN</h2>
                <p className="text-slate-400 text-sm">Choose from your unlocked evolutions.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {SKINS.map((skin) => {
                  const isUnlocked = gameState.unlockedSkins.includes(skin.type);
                  const isActive = gameState.activeSkin === skin.type;
                  const Icon = skin.icon;
                  return (
                    <button
                      key={skin.type}
                      disabled={!isUnlocked}
                      onClick={() => {
                        setGameState(s => ({ ...s, activeSkin: skin.type }));
                        setShowSkinSelection(false);
                      }}
                      className={`relative p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 text-left ${
                        isActive 
                          ? 'bg-slate-900 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                          : isUnlocked ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-950 border-slate-900 opacity-20 grayscale'
                      }`}
                    >
                      {!isUnlocked && <Lock size={14} className="absolute top-2 right-2 text-slate-600" />}
                      <Icon size={32} className={skin.color} />
                      <div className="text-[10px] font-bold uppercase tracking-widest">{skin.name}</div>
                      {isUnlocked && <div className="text-[8px] text-slate-500 leading-tight">{skin.perk.split(':')[0]}</div>}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setShowSkinSelection(false)}
                className="w-full py-4 bg-slate-100 text-slate-950 rounded-2xl font-black tracking-widest active:scale-95 transition-transform"
              >
                BACK
              </button>
            </motion.div>
          </motion.div>
        )}

        {showLeaderboard && (
          <Leaderboard 
            onClose={() => setShowLeaderboard(false)} 
            entries={leaderboardEntries} 
          />
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
                <h2 className="text-4xl font-black tracking-tighter">BOOM! LEVEL SMASHED!</h2>
                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Level {gameState.level} Done & Dusted</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Clock</div>
                      <div className="text-2xl font-bold text-cyan-400">{time}s</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Steps</div>
                      <div className="text-2xl font-bold text-fuchsia-400">{gameState.moves}</div>
                    </div>
                  </div>
                  
                  {!localStorage.getItem('maze_player_name') && (
                    <div className="pt-4 border-t border-slate-800">
                      <input 
                        type="text" 
                        placeholder="WHAT'S YOUR COOL NAME?"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-sm font-bold tracking-widest text-white focus:border-cyan-500 outline-none transition-all"
                        maxLength={12}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => initGame()}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors"
                >
                  AGAIN!
                </button>
                <button 
                  onClick={submitScore}
                  disabled={!playerName.trim() || isSubmitting}
                  className="flex-[2] py-4 bg-white text-slate-950 rounded-2xl font-black tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                >
                  {isSubmitting ? 'SAVING...' : 'NEXT LEVEL'} <ChevronRight size={20} />
                </button>
              </div>

              <button 
                onClick={() => setShowLeaderboard(true)}
                className="w-full py-3 bg-slate-900/50 border border-slate-800 text-slate-500 rounded-xl font-bold tracking-widest hover:border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Trophy size={16} /> WHO'S THE BEST?
              </button>
            </motion.div>
          </motion.div>
        )}
        {gameState.status === 'gameover' && (
          <motion.div 
            key="gameover-overlay"
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
              <div className="w-24 h-24 mx-auto bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30">
                <Skull size={48} className="text-red-500" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter text-red-500">OUCH! TRY AGAIN!</h2>
                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Level {gameState.level} was too tough!</p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => initGame()}
                  className="w-full py-5 bg-red-600 text-white rounded-3xl font-black tracking-widest shadow-2xl shadow-red-500/20 active:scale-95 transition-transform text-lg"
                >
                  GIVE IT ANOTHER GO!
                </button>

                <button 
                  onClick={() => setShowLeaderboard(true)}
                  className="w-full py-4 bg-slate-900/50 border border-slate-800 text-slate-500 rounded-2xl font-bold tracking-widest hover:border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <Trophy size={18} /> LEADERBOARD
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
