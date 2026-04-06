export type Wall = 'top' | 'right' | 'bottom' | 'left';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type SkinType = 'default' | 'spark' | 'bunny' | 'cat' | 'dog';

export interface SkinCharacter {
  type: SkinType;
  x: number;
  y: number;
  isCaught: boolean;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  type: 'patrol' | 'random';
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface Cell {
  x: number;
  y: number;
  walls: Record<Wall, boolean>;
  visited: boolean;
  hasShard?: boolean;
  isObstacle?: boolean;
}

export type GameStatus = 'start' | 'playing' | 'won' | 'gameover' | 'selecting';

export interface GameState {
  status: GameStatus;
  difficulty: Difficulty;
  level: number;
  moves: number;
  shardsCollected: number;
  totalShards: number;
  startTime: number | null;
  endTime: number | null;
  activeSkin: SkinType;
  unlockedSkins: SkinType[];
  lives: number;
}
