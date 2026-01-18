
import React from 'react';
import { BoardTile, Player, TileType, GameMode } from '../types';

interface BoardProps {
  tiles: BoardTile[];
  players: Player[];
  diceRolls: [number, number];
  isRolling: boolean;
  handleRoll: () => void;
  isModalActive: boolean;
  isPlayerMoving: boolean;
  currentPlayerIndex: number;
  isBoardCelebrating: boolean;
  showBigIcon?: 'CHANCE' | 'FATE' | null;
  playSfx: (sound: any) => void;
  isWaitingForHumanConfirmation: boolean;
  handleHumanConfirmation: () => void;
  gameMode: GameMode;
  meatAnimationTarget: number | null;
}

const Dice3D: React.FC<{ value: number; rolling: boolean }> = ({ value, rolling }) => {
  return (
    <div className="dice-scene scale-75 md:scale-90">
      <div className={`dice-cube ${rolling ? 'animate-dice-rolling' : `show-${value}`}`}>
        <div className="dice-face face-1"><div className="dot"></div></div>
        <div className="dice-face face-2"><div className="dot"></div><div className="dot"></div></div>
        <div className="dice-face face-3"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
        <div className="dice-face face-4"><div className="dot"></div><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
        <div className="dice-face face-5"><div className="dot"></div><div className="dot"></div><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
        <div className="dice-face face-6"><div className="dot"></div><div className="dot"></div><div className="dot"></div><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
      </div>
    </div>
  );
};

const STATE_COLORS: Record<string, string> = {
  '魯國': 'bg-[#C04851]', 
  '衛國': 'bg-[#806D9E]', 
  '曹國': 'bg-[#758A99]', 
  '宋國': 'bg-[#248067]', 
  '鄭國': 'bg-[#664032]', 
  '陳國': 'bg-[#F0C239]', 
  '蔡國': 'bg-[#50616D]', 
  '楚國': 'bg-[#A61B29]', 
};

const Board: React.FC<BoardProps> = ({ 
  tiles, players, diceRolls, isRolling, handleRoll, 
  isModalActive, isPlayerMoving, currentPlayerIndex, isBoardCelebrating, showBigIcon, playSfx,
  isWaitingForHumanConfirmation, handleHumanConfirmation, gameMode, meatAnimationTarget
}) => {
  const renderTile = (tile: BoardTile, originalIndex: number) => {
    if (!tile) return <div key={`empty-${originalIndex}`} className="h-full w-full"></div>;
    const playersOnTile = players.filter(p => p.position === originalIndex);
    
    let bgColor = "bg-[#fdfaf5]";
    let textColor = "text-stone-900";
    let subTextColor = "text-amber-900 bg-amber-200/80";
    let borderColor = "border-stone-300";
    let isStart = tile.type === TileType.START;

    for (const [stateName, colorClass] of Object.entries(STATE_COLORS)) {
      if (tile.name.includes(stateName)) {
        bgColor = colorClass;
        textColor = "text-white";
        subTextColor = "text-white bg-black/20";
        borderColor = "border-black/10";
        break;
      }
    }

    // 優化功能格配色：採用典雅淺互補色
    if (tile.type === TileType.FATE) {
      bgColor = "bg-[#E8EAF6]"; // 月白紫
      textColor = "text-[#283593]"; // 深靛藍
      borderColor = "border-[#3F51B5]/30";
    } else if (tile.type === TileType.CHANCE) {
      bgColor = "bg-[#FFFDE7]"; // 牙色
      textColor = "text-[#5D4037]"; // 深赭石
      borderColor = "border-[#8D6E63]/20";
    } else if (tile.type === TileType.EVENT) {
      bgColor = "bg-[#E9D7DF]"; 
      textColor = "text-stone-800";
      subTextColor = "text-red-900 bg-red-100/50";
    }

    if (isStart) {
      bgColor = "bg-[#8B0000]"; 
      textColor = "text-[#FFD700]"; 
      borderColor = "border-[#FFD700]";
    }

    return (
      <div key={originalIndex} className={`relative border ${isStart ? 'border-4' : borderColor} flex flex-col items-center justify-between h-full w-full text-center transition-all ${bgColor} hover:brightness-105 overflow-hidden min-h-0 min-w-0 shadow-inner group`}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
          {tile.type === TileType.CHANCE && <span className="text-[50px] md:text-[60px] font-black text-[#5D4037] opacity-40 group-hover:opacity-60 transition-opacity">？</span>}
          {tile.type === TileType.FATE && <span className="text-[50px] md:text-[60px] font-black text-[#283593] opacity-40 group-hover:opacity-60 transition-opacity">！</span>}
          {isStart && <span className="text-[50px] font-black text-[#FFD700] opacity-10">魯</span>}
        </div>

        <div className="w-full px-0.5 z-10 relative flex flex-col items-center pt-1 md:pt-2">
          <div className={`text-[10px] md:text-[14px] font-black leading-tight break-keep line-clamp-2 h-7 md:h-10 flex items-center justify-center drop-shadow-sm ${isStart ? 'text-[#FFD700] text-sm md:text-base' : textColor}`}>
            {tile.name}
          </div>
          {tile.type === TileType.STATE && (
            <div className={`text-[7px] md:text-[9px] font-black px-1.5 py-0.5 rounded-sm shadow-sm mt-0.5 tracking-tighter ${subTextColor}`}>
              試煉
            </div>
          )}
        </div>

        <div className="flex-1 w-full flex items-center justify-center relative z-30 pointer-events-none min-h-0">
          <div className="relative w-full h-full flex items-center justify-center">
            {playersOnTile.map((p) => {
              const isActiveMoving = isPlayerMoving && p.id === players[currentPlayerIndex].id;
              return (
                <div 
                  key={p.id} 
                  className={`absolute w-7 h-7 md:w-10 md:h-10 rounded-sm border ${p.color} overflow-hidden shadow-lg ring-1 ring-white/50 transition-all duration-300 transform bg-stone-50 ${isActiveMoving ? 'animate-piece-jump z-50 scale-125 opacity-100 !static' : 'opacity-90'}`} 
                  title={p.character}
                >
                  <img src={p.avatar} alt={p.character} className="w-full h-full p-0.5" />
                </div>
              );
            })}
          </div>
        </div>
        <div className="h-1 md:h-2 w-full"></div>
      </div>
    );
  };

  const gridRows = [];
  gridRows.push(tiles.slice(12, 19).map((t, i) => renderTile(t, 12 + i)));
  
  for (let i = 0; i < 5; i++) {
    const row = [];
    row.push(renderTile(tiles[11 - i], 11 - i));
    
    if (i === 2) {
      row.push(
        <div key="dice-area" className="col-span-5 flex items-center justify-center z-10 h-full w-full relative min-h-0 min-w-0">
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(90deg, transparent 95%, #4a3728 95%)', backgroundSize: '20px 100%' }}></div>
          
          <div className="flex flex-col items-center justify-center space-y-4 md:space-y-6 z-20 w-full h-full pt-12">
            <div className="flex space-x-6 md:space-x-10">
              <Dice3D value={diceRolls[0]} rolling={isRolling} />
              <Dice3D value={diceRolls[1]} rolling={isRolling} />
            </div>
            
            <div className="w-full max-w-[180px] md:max-w-[240px] px-4">
              <button 
                onClick={() => { playSfx('click'); handleRoll(); }}
                disabled={isRolling || isModalActive || isPlayerMoving || !!showBigIcon || (players[currentPlayerIndex]?.isAI && gameMode === 'quick') || isWaitingForHumanConfirmation || meatAnimationTarget !== null}
                className={`w-full py-2 md:py-3.5 rounded-full font-black text-xs md:text-lg transition-all shadow-xl border-b-4 
                  ${isRolling || isModalActive || isPlayerMoving || !!showBigIcon || (players[currentPlayerIndex]?.isAI && gameMode === 'quick') || isWaitingForHumanConfirmation || meatAnimationTarget !== null
                    ? 'bg-stone-300 border-stone-400 text-stone-500 cursor-not-allowed' 
                    : 'bg-[#88ADA6] border-[#5B7471] text-white hover:bg-[#7EA1A1] active:scale-95 active:translate-y-1 shadow-[#4D6262]/20'}`}
              >
                {players[currentPlayerIndex]?.isAI && gameMode !== 'quick' ? `代 ${players[currentPlayerIndex].character} 啟程` : '啟程周遊'}
              </button>
              <div className="text-[9px] md:text-[12px] text-stone-600 font-serif italic tracking-[0.2em] text-center mt-2.5 drop-shadow-sm font-bold">
                「敏於事而慎於言」
              </div>
              {isWaitingForHumanConfirmation && players[currentPlayerIndex]?.isAI && (
                <button
                  onClick={() => { playSfx('click'); handleHumanConfirmation(); }}
                  className="w-full mt-4 py-2 md:py-3 bg-red-800 text-white rounded-full font-black text-xs md:text-base transition-all shadow-xl hover:bg-red-900 active:scale-95 animate-pulse"
                >
                  確認 AI 行動
                </button>
              )}
            </div>
          </div>

          {showBigIcon && (
            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>
                <div className="relative flex items-center justify-center">
                    {showBigIcon === 'CHANCE' ? (
                        <div className="text-[180px] md:text-[300px] font-black text-[#5D4037] drop-shadow-[0_0_30px_rgba(141,110,99,0.5)] filter animate-chance-card-reveal">？</div>
                    ) : (
                        <div className="text-[180px] md:text-[300px] font-black text-[#283593] drop-shadow-[0_0_30px_rgba(63,81,181,0.5)] filter animate-fate-card-reveal">！</div>
                    )}
                </div>
            </div>
          )}
        </div>
      );
    } else {
      row.push(<div key={`empty-row-${i}-center`} className="col-span-5 h-full w-full pointer-events-none"></div>);
    }

    row.push(renderTile(tiles[19 + i], 19 + i));
    gridRows.push(row);
  }
  
  gridRows.push(tiles.slice(0, 7).reverse().map((t, i) => renderTile(t, 6 - i)));

  return (
    <div className={`w-full max-w-[620px] aspect-square board-grid bg-[#3d2b1f] gap-0.5 p-1 rounded shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border-4 border-[#2a1d15] relative overflow-hidden ${isBoardCelebrating ? 'animate-board-celebrate' : ''}`}>
      <div className="absolute z-0 row-start-2 row-end-7 col-start-2 col-end-7 bg-[#FFBB73] pointer-events-none border-[3px] border-[#d1a062] m-0.5 rounded-sm shadow-inner">
        <div className="absolute inset-0 opacity-[0.2] bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
      </div>
      {isBoardCelebrating && <div className="confetti-overlay"></div>}
      {gridRows.flat()}
    </div>
  );
};

export default Board;
