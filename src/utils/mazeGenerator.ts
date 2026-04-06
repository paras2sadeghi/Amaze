import { Cell, Wall, Enemy, SkinType } from '../types';

export function generateMaze(width: number, height: number, shardCount: number = 3, level: number = 1): { grid: Cell[][], enemies: Enemy[] } {
  const grid: Cell[][] = [];

  // Initialize grid
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        visited: false,
        walls: { top: true, right: true, bottom: true, left: true },
        hasShard: false,
      });
    }
    grid.push(row);
  }

  const stack: Cell[] = [];
  const startCell = grid[0][0];
  startCell.visited = true;
  stack.push(startCell);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(current, grid, width, height);

    if (neighbors.length > 0) {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      removeWalls(current, next);
      next.visited = true;
      stack.push(next);
    } else {
      stack.pop();
    }
  }

  // Place shards randomly (avoiding start and end)
  let shardsPlaced = 0;
  while (shardsPlaced < shardCount) {
    const rx = Math.floor(Math.random() * width);
    const ry = Math.floor(Math.random() * height);
    
    // Don't place on start or end
    if ((rx === 0 && ry === 0) || (rx === width - 1 && ry === height - 1)) continue;
    
    if (!grid[ry][rx].hasShard) {
      grid[ry][rx].hasShard = true;
      shardsPlaced++;
    }
  }

  // Place obstacles (spikes) - starting from level 5, increasing every 5 levels
  if (level >= 5) {
    const obstacleCount = Math.floor(level / 5) * 2;
    let obstaclesPlaced = 0;
    while (obstaclesPlaced < obstacleCount) {
      const rx = Math.floor(Math.random() * width);
      const ry = Math.floor(Math.random() * height);
      if ((rx === 0 && ry === 0) || (rx === width - 1 && ry === height - 1)) continue;
      if (!grid[ry][rx].hasShard && !grid[ry][rx].isObstacle) {
        grid[ry][rx].isObstacle = true;
        obstaclesPlaced++;
      }
    }
  }

  // Place enemies - starting from level 8, increasing every 8 levels
  const enemies: Enemy[] = [];
  if (level >= 8) {
    const enemyCount = Math.floor(level / 8);
    for (let i = 0; i < enemyCount; i++) {
      let enemyPlaced = false;
      while (!enemyPlaced) {
        const rx = Math.floor(Math.random() * width);
        const ry = Math.floor(Math.random() * height);
        if ((rx === 0 && ry === 0) || (rx === width - 1 && ry === height - 1)) continue;
        if (!grid[ry][rx].hasShard && !grid[ry][rx].isObstacle) {
          enemies.push({
            id: `enemy-${i}`,
            x: rx,
            y: ry,
            type: Math.random() > 0.5 ? 'patrol' : 'random',
            direction: ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)] as any,
          });
          enemyPlaced = true;
        }
      }
    }
  }

  return { grid, enemies };
}

function getUnvisitedNeighbors(cell: Cell, grid: Cell[][], width: number, height: number): Cell[] {
  const neighbors: Cell[] = [];
  const { x, y } = cell;

  if (y > 0 && !grid[y - 1][x].visited) neighbors.push(grid[y - 1][x]);
  if (x < width - 1 && !grid[y][x + 1].visited) neighbors.push(grid[y][x + 1]);
  if (y < height - 1 && !grid[y + 1][x].visited) neighbors.push(grid[y + 1][x]);
  if (x > 0 && !grid[y][x - 1].visited) neighbors.push(grid[y][x - 1]);

  return neighbors;
}

function removeWalls(a: Cell, b: Cell) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  if (dx === 1) {
    a.walls.left = false;
    b.walls.right = false;
  } else if (dx === -1) {
    a.walls.right = false;
    b.walls.left = false;
  }

  if (dy === 1) {
    a.walls.top = false;
    b.walls.bottom = false;
  } else if (dy === -1) {
    a.walls.bottom = false;
    b.walls.top = false;
  }
}
