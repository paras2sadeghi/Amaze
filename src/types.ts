export type Wall = 'top' | 'right' | 'bottom' | 'left';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type SkinType = 'spark' | 'bunny' | 'cat' | 'panda';

export interface Cell {
  x: number;
  y: number;
  walls: Record<Wall, boolean>;
  visited: boolean;
  hasShard?: boolean;
}

export interface GameState {
  status: 'start' | 'playing' | 'won' | 'gameover';
  difficulty: Difficulty;
  level: number;
  moves: number;
  shardsCollected: number;
  totalShards: number;
  startTime: number | null;
  endTime: number | null;
  activeSkin: SkinType;
}
