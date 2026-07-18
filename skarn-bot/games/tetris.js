// Tetris game engine
const { createCanvas } = require('canvas');

const COLS = 10;
const ROWS = 20;
const CELL = 28;

const PIECES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00e5ff' },
  O: { shape: [[1,1],[1,1]], color: '#f1c40f' },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#9b59b6' },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#2ecc71' },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#e74c3c' },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#3498db' },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#e67e22' },
};

const PIECE_NAMES = Object.keys(PIECES);

class TetrisGame {
  constructor(player1Id, player2Id) {
    this.players = {
      [player1Id]: { board: this.emptyBoard(), piece: null, next: null, score: 0, lost: false },
      [player2Id]: { board: this.emptyBoard(), piece: null, next: null, score: 0, lost: false },
    };
    this.player1Id = player1Id;
    this.player2Id = player2Id;
    this.currentTurn = player1Id;
    this.turnCount = 0;
    this.games = [player1Id, player2Id];
    this.spawnPiece(player1Id);
    this.spawnPiece(player2Id);
  }

  emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  randomPiece() {
    const name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
    return { name, shape: PIECES[name].shape.map(r => [...r]), color: PIECES[name].color, x: 3, y: 0 };
  }

  spawnPiece(playerId) {
    const p = this.players[playerId];
    if (p.next) {
      p.piece = { ...p.next, x: 3, y: 0 };
    } else {
      p.piece = this.randomPiece();
    }
    p.next = this.randomPiece();
    if (this.collides(playerId, p.piece.shape, p.piece.x, p.piece.y)) {
      p.lost = true;
    }
  }

  collides(playerId, shape, px, py) {
    const board = this.players[playerId].board;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = px + c;
        const ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  rotate(shape) {
    const n = shape.length;
    const rotated = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        rotated[c][n - 1 - r] = shape[r][c];
      }
    }
    return rotated;
  }

  lock(playerId) {
    const p = this.players[playerId];
    const piece = p.piece;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const ny = piece.y + r;
        const nx = piece.x + c;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
          p.board[ny][nx] = piece.color;
        }
      }
    }
    const lines = this.clearLines(playerId);
    if (lines > 0) {
      const opponentId = playerId === this.player1Id ? this.player2Id : this.player1Id;
      this.addGarbage(opponentId, lines);
      p.score += lines * 100;
    }
    this.spawnPiece(playerId);
  }

  clearLines(playerId) {
    const board = this.players[playerId].board;
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(cell => cell !== null)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    return cleared;
  }

  addGarbage(playerId, lines) {
    const board = this.players[playerId].board;
    for (let i = 0; i < lines; i++) {
      board.shift();
      const garbage = Array(COLS).fill('#888888');
      garbage[Math.floor(Math.random() * COLS)] = null;
      board.push(garbage);
    }
  }

  move(playerId, dx) {
    const p = this.players[playerId];
    if (!p.piece || p.lost) return false;
    const nx = p.piece.x + dx;
    if (!this.collides(playerId, p.piece.shape, nx, p.piece.y)) {
      p.piece.x = nx;
      return true;
    }
    return false;
  }

  rotatePiece(playerId) {
    const p = this.players[playerId];
    if (!p.piece || p.lost) return false;
    const rotated = this.rotate(p.piece.shape);
    if (!this.collides(playerId, rotated, p.piece.x, p.piece.y)) {
      p.piece.shape = rotated;
      return true;
    }
    return false;
  }

  softDrop(playerId) {
    const p = this.players[playerId];
    if (!p.piece || p.lost) return false;
    if (!this.collides(playerId, p.piece.shape, p.piece.x, p.piece.y + 1)) {
      p.piece.y++;
      p.score += 1;
      return true;
    }
    return false;
  }

  hardDrop(playerId) {
    const p = this.players[playerId];
    if (!p.piece || p.lost) return;
    while (!this.collides(playerId, p.piece.shape, p.piece.x, p.piece.y + 1)) {
      p.piece.y++;
      p.score += 2;
    }
    this.lock(playerId);
  }

  nextTurn() {
    this.turnCount++;
    this.currentTurn = this.currentTurn === this.player1Id ? this.player2Id : this.player1Id;
    return this.currentTurn;
  }

  render(playerId) {
    const p = this.players[playerId];
    const board = p.board.map(r => [...r]);

    // Draw current piece on board copy
    if (p.piece && !p.lost) {
      for (let r = 0; r < p.piece.shape.length; r++) {
        for (let c = 0; c < p.piece.shape[r].length; c++) {
          if (!p.piece.shape[r][c]) continue;
          const ny = p.piece.y + r;
          const nx = p.piece.x + c;
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
            board[ny][nx] = p.piece.color;
          }
        }
      }
    }

    const width = COLS * CELL + 40;
    const height = ROWS * CELL + 40;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CELL + 20;
        const y = r * CELL + 20;
        if (board[r][c]) {
          ctx.fillStyle = board[r][c];
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(x + 1, y + 1, CELL - 2, 4);
        } else {
          ctx.fillStyle = '#16213e';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.strokeStyle = '#0f3460';
          ctx.strokeRect(x, y, CELL, CELL);
        }
      }
    }

    // Border
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, COLS * CELL + 4, ROWS * CELL + 4);

    return canvas.toBuffer('image/png');
  }
}

// Active games store
const activeGames = new Map();

module.exports = { TetrisGame, activeGames };
