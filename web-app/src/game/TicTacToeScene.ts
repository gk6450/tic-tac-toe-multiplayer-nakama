import Phaser from 'phaser';

export interface BoardState {
  board: number[];
  myMark: number;
  isMyTurn: boolean;
  winningLine: number[] | null;
  gameOver: boolean;
}

export class TicTacToeScene extends Phaser.Scene {
  private readonly CELL = 110;
  private readonly OFFSET = 35;
  private readonly PAD = 25;

  private gridGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private winGfx!: Phaser.GameObjects.Graphics;
  private markGfxList: Phaser.GameObjects.Graphics[] = [];

  private board: number[] = Array(9).fill(0);
  private myMark = 0;
  private isMyTurn = false;
  private winningLine: number[] | null = null;
  private gameOver = false;

  private cellClickCb: ((pos: number) => void) | null = null;
  private ready = false;
  private pending: BoardState | null = null;
  private pendingMark: { idx: number; mark: number } | null = null;

  constructor() {
    super({ key: 'TicTacToe' });
  }

  create() {
    this.gridGfx = this.add.graphics();
    this.hoverGfx = this.add.graphics();
    this.winGfx = this.add.graphics();

    this.drawGrid();
    this.createZones();

    this.ready = true;
    if (this.pending) {
      this.applyState(this.pending);
      this.pending = null;
    }
  }

  setCellClickCallback(cb: (pos: number) => void) {
    this.cellClickCb = cb;
  }

  placeOptimistic(idx: number, mark: number) {
    if (!this.ready || this.board[idx] !== 0) return;
    this.pendingMark = { idx, mark };
    this.board[idx] = mark;
    this.drawMark(idx, mark);
    this.hoverGfx.clear();
  }

  updateGameState(state: BoardState) {
    if (!this.ready) {
      this.pending = state;
      return;
    }
    this.applyState(state);
  }

  private applyState(s: BoardState) {
    this.pendingMark = null;
    const changed = this.board.some((v, i) => v !== s.board[i]);
    this.board = [...s.board];
    this.myMark = s.myMark;
    this.isMyTurn = s.isMyTurn;
    this.winningLine = s.winningLine;
    this.gameOver = s.gameOver;

    if (changed) this.redrawMarks();
    this.winGfx.clear();
    if (s.winningLine) this.drawWinLine(s.winningLine);
    this.hoverGfx.clear();
  }

  /* ---- drawing ---- */

  private drawGrid() {
    const g = this.gridGfx;
    g.lineStyle(3, 0x4a5568, 0.8);
    for (let i = 1; i < 3; i++) {
      const x = this.OFFSET + i * this.CELL;
      g.beginPath();
      g.moveTo(x, this.OFFSET + 8);
      g.lineTo(x, this.OFFSET + 3 * this.CELL - 8);
      g.strokePath();

      const y = this.OFFSET + i * this.CELL;
      g.beginPath();
      g.moveTo(this.OFFSET + 8, y);
      g.lineTo(this.OFFSET + 3 * this.CELL - 8, y);
      g.strokePath();
    }
  }

  private createZones() {
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const cx = this.OFFSET + col * this.CELL + this.CELL / 2;
      const cy = this.OFFSET + row * this.CELL + this.CELL / 2;
      const idx = i;

      const zone = this.add
        .zone(cx, cy, this.CELL, this.CELL)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        if (this.board[idx] === 0 && this.isMyTurn && !this.gameOver && this.cellClickCb) {
          this.cellClickCb(idx);
        }
      });

      zone.on('pointerover', () => {
        if (this.board[idx] === 0 && this.isMyTurn && !this.gameOver) {
          this.showHover(idx);
        }
      });

      zone.on('pointerout', () => this.hoverGfx.clear());
    }
  }

  private showHover(idx: number) {
    this.hoverGfx.clear();
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const x = this.OFFSET + col * this.CELL;
    const y = this.OFFSET + row * this.CELL;
    this.hoverGfx.fillStyle(0xffffff, 0.06);
    this.hoverGfx.fillRoundedRect(x + 4, y + 4, this.CELL - 8, this.CELL - 8, 8);
  }

  private redrawMarks() {
    this.markGfxList.forEach(g => g.destroy());
    this.markGfxList = [];
    for (let i = 0; i < 9; i++) {
      if (this.board[i] !== 0) this.drawMark(i, this.board[i]);
    }
  }

  private drawMark(idx: number, mark: number) {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const cx = this.OFFSET + col * this.CELL + this.CELL / 2;
    const cy = this.OFFSET + row * this.CELL + this.CELL / 2;
    const half = this.CELL / 2 - this.PAD;

    const g = this.add.graphics();

    if (mark === 1) {
      g.lineStyle(5, 0x00e5ff, 1);
      g.beginPath();
      g.moveTo(cx - half, cy - half);
      g.lineTo(cx + half, cy + half);
      g.strokePath();
      g.beginPath();
      g.moveTo(cx + half, cy - half);
      g.lineTo(cx - half, cy + half);
      g.strokePath();
    } else {
      g.lineStyle(5, 0xff4081, 1);
      g.strokeCircle(cx, cy, half);
    }

    this.markGfxList.push(g);
  }

  private drawWinLine(line: number[]) {
    if (line.length < 2) return;
    const s = line[0], e = line[line.length - 1];
    const sr = Math.floor(s / 3), sc = s % 3;
    const er = Math.floor(e / 3), ec = e % 3;
    const sx = this.OFFSET + sc * this.CELL + this.CELL / 2;
    const sy = this.OFFSET + sr * this.CELL + this.CELL / 2;
    const ex = this.OFFSET + ec * this.CELL + this.CELL / 2;
    const ey = this.OFFSET + er * this.CELL + this.CELL / 2;

    this.winGfx.lineStyle(10, 0x69f0ae, 0.3);
    this.winGfx.beginPath();
    this.winGfx.moveTo(sx, sy);
    this.winGfx.lineTo(ex, ey);
    this.winGfx.strokePath();

    this.winGfx.lineStyle(4, 0x69f0ae, 1);
    this.winGfx.beginPath();
    this.winGfx.moveTo(sx, sy);
    this.winGfx.lineTo(ex, ey);
    this.winGfx.strokePath();
  }
}
