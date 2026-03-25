import React from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Colors } from '../styles/theme';

interface Props {
  board: number[];
  myMark: number;
  isMyTurn: boolean;
  winningLine: number[] | null;
  gameOver: boolean;
  onCellClick: (pos: number) => void;
}

export default function GameBoard({ board, myMark, isMyTurn, winningLine, gameOver, onCellClick }: Props) {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 48, 360);
  const cellSize = (boardSize - 8) / 3;

  const isWinCell = (idx: number) => winningLine?.includes(idx) ?? false;

  return (
    <View style={[s.board, { width: boardSize, height: boardSize }]}>
      {board.map((cell, idx) => {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const canPress = cell === 0 && isMyTurn && !gameOver;

        return (
          <TouchableOpacity
            key={idx}
            activeOpacity={canPress ? 0.6 : 1}
            onPress={() => canPress && onCellClick(idx)}
            style={[
              s.cell,
              {
                width: cellSize,
                height: cellSize,
                left: col * (cellSize + 4),
                top: row * (cellSize + 4),
              },
              isWinCell(idx) && s.winCell,
            ]}
          >
            {cell === 1 && <XMark size={cellSize * 0.5} winning={isWinCell(idx)} />}
            {cell === 2 && <OMark size={cellSize * 0.5} winning={isWinCell(idx)} />}
          </TouchableOpacity>
        );
      })}
      {/* Grid lines */}
      <View style={[s.lineH, { top: cellSize + 1, width: boardSize - 16, left: 8 }]} />
      <View style={[s.lineH, { top: cellSize * 2 + 5, width: boardSize - 16, left: 8 }]} />
      <View style={[s.lineV, { left: cellSize + 1, height: boardSize - 16, top: 8 }]} />
      <View style={[s.lineV, { left: cellSize * 2 + 5, height: boardSize - 16, top: 8 }]} />
    </View>
  );
}

function XMark({ size, winning }: { size: number; winning: boolean }) {
  const color = winning ? Colors.green : Colors.cyan;
  const thickness = 5;
  const diag = Math.sqrt(2) * size;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: diag, height: thickness, backgroundColor: color, borderRadius: 3, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: diag, height: thickness, backgroundColor: color, borderRadius: 3, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

function OMark({ size, winning }: { size: number; winning: boolean }) {
  const color = winning ? Colors.green : Colors.pink;
  const thickness = 5;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: thickness, borderColor: color,
    }} />
  );
}

const s = StyleSheet.create({
  board: {
    position: 'relative',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'center',
  },
  cell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winCell: {
    backgroundColor: 'rgba(105,240,174,0.1)',
    borderRadius: 8,
  },
  lineH: {
    position: 'absolute',
    height: 2,
    backgroundColor: 'rgba(74,85,104,0.8)',
    borderRadius: 1,
  },
  lineV: {
    position: 'absolute',
    width: 2,
    backgroundColor: 'rgba(74,85,104,0.8)',
    borderRadius: 1,
  },
});
