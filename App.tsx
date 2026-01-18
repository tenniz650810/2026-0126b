
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, TileType, TrialCard, FateCard, ChanceCard, Character, GameMode } from './types';
import { BOARD_TILES, TRIAL_CARDS, FATE_CARDS, CHANCE_CARDS } from './constants';
import Board from './components/Board';
import PlayerInfo from './components/PlayerInfo';
import { CardModal } from './components/CardModal';
import AudioSettings from './components/AudioSettings';
import StartScreen from './components/StartScreen';
import MeatEffect from './components/MeatEffect';
import VictoryOverlay from './components/VictoryOverlay';
import RecoveryEffect from './components/RecoveryEffect';
import PauseEffect from './components/PauseEffect';
import { GoogleGenAI, Type } from "@google/genai";

class SoundEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  sfxGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.1);
  }

  setSfxVolume(v: number) {
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.1);
  }

  playSfx(type: string) {
    this.resume();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.connect(this.sfxGain!);

    switch (type) {
      case 'diceRoll':
        const o1 = this.ctx.createOscillator();
        o1.type = 'square'; o1.frequency.setValueAtTime(150, t);
        o1.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0, t + 0.1);
        o1.connect(g); o1.start(); o1.stop(t + 0.1);
        break;
      case 'move':
        const o2 = this.ctx.createOscillator();
        o2.type = 'sine'; o2.frequency.setValueAtTime(600, t);
        o2.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
        g.gain.setValueAtTime(0.05, t); g.gain.linearRampToValueAtTime(0, t + 0.05);
        o2.connect(g); o2.start(); o2.stop(t + 0.05);
        break;
      case 'getMeat':
        [523.25, 659.25, 783.99].forEach((f, i) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle'; osc.frequency.setValueAtTime(f, t + i * 0.1);
          gain.gain.setValueAtTime(0, t + i * 0.1);
          gain.gain.linearRampToValueAtTime(0.1, t + i * 0.1 + 0.05);
          gain.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.3);
          osc.connect(gain); gain.connect(this.sfxGain!);
          osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.3);
        });
        break;
      case 'click':
      case 'turnStart':
        const o3 = this.ctx.createOscillator();
        o3.type = 'sine'; o3.frequency.setValueAtTime(880, t);
        g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0, t + 0.05);
        o3.connect(g); o3.start(); o3.stop(t + 0.05);
        break;
      case 'correctAnswer':
        [659.25, 880].forEach((f, i) => {
          const osc = this.ctx!.createOscillator();
          osc.frequency.setValueAtTime(f, t + i * 0.1);
          g.gain.setValueAtTime(0.1, t + i * 0.1);
          g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.2);
          osc.connect(g); osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.2);
        });
        break;
      case 'incorrectAnswer':
        const o4 = this.ctx.createOscillator();
        o4.type = 'sawtooth'; o4.frequency.setValueAtTime(100, t);
        o4.frequency.linearRampToValueAtTime(50, t + 0.3);
        g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0, t + 0.3);
        o4.connect(g); o4.start(); o4.stop(t + 0.3);
        break;
      case 'winGame':
        [523.25, 783.99, 1046.50].forEach((f, i) => {
          const osc = this.ctx!.createOscillator();
          osc.frequency.setValueAtTime(f, t + i * 0.1);
          g.gain.setValueAtTime(0.1, t + i * 0.1);
          g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.4);
          osc.connect(g); osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.4);
        });
        break;
      case 'cardFlip':
        const o5 = this.ctx.createOscillator();
        o5.type = 'sawtooth'; o5.frequency.setValueAtTime(200, t);
        o5.frequency.linearRampToValueAtTime(100, t + 0.1);
        g.gain.setValueAtTime(0.05, t); g.gain.linearRampToValueAtTime(0, t + 0.1);
        o5.connect(g); o5.start(); o5.stop(t + 0.1);
        break;
    }
  }
}

const engine = new SoundEngine();

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('normal');
  const [players, setPlayers] = useState<Player[]>([]);
  const [winCondition, setWinCondition] = useState(10);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceRolls, setDiceRolls] = useState<[number, number]>([1, 1]);
  const [isRolling, setIsRolling] = useState(false);
  const [isPlayerMoving, setIsPlayerMoving] = useState(false);
  const [activeModal, setActiveModal] = useState<'TRIAL' | 'FATE' | 'CHANCE' | 'WIN' | 'EVENT_DETAIL' | null>(null);
  const [activeTrial, setActiveTrial] = useState<TrialCard | null>(null);
  const [activeFate, setActiveFate] = useState<FateCard | null>(null);
  const [activeChance, setActiveChance] = useState<ChanceCard | null>(null);
  const [activeEventData, setActiveEventData] = useState<{title: string, content: string, effectLabel: string, effectType?: 'PAUSE' | 'LOSE_MEAT' | 'GAIN_MEAT'} | null>(null);
  const [gameLog, setGameLog] = useState<string[]>(['【公告】歡迎來到孔子周遊列國！願君子之德如風。']);

  const [isAiGeneratingTrial, setIsAiGeneratingTrial] = useState(false);
  const [showBigIcon, setShowBigIcon] = useState<'CHANCE' | 'FATE' | null>(null);
  const [trialSelection, setTrialSelection] = useState<{ selected: number | null, isRevealed: boolean }>({ selected: null, isRevealed: false });
  const [showRecovery, setShowRecovery] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [waitingForHumanConfirmation, setWaitingForHumanConfirmation] = useState(false);
  const [aiDecisionMadeInModal, setAiDecisionMadeInModal] = useState<any>(null);

  const [masterVolume, setMasterVolume] = useState(0.8);
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  
  const [meatAnimationTarget, setMeatAnimationTarget] = useState<number | null>(null);
  const [meatAnimationAmount, setMeatAnimationAmount] = useState(0);
  const [meatAnimationTitle, setMeatAnimationTitle] = useState<string | null>(null);
  const [meatAnimationCallback, setMeatAnimationCallback] = useState<(() => void) | null>(null);
  const [isBoardCelebrating, setIsBoardCelebrating] = useState(false);

  const rollTimeoutRef = useRef<number | null>(null); 
  const aiRollTimeoutRef = useRef<number | null>(null); 
  const aiModalDecisionTimeoutRef = useRef<number | null>(null);

  const handleTileActionRef = useRef<((tileIndex: number) => Promise<void>) | null>(null);
  const movePlayerRef = useRef<((steps: number, targetPlayerId?: number) => Promise<void>) | null>(null);
  const resolveTrialRef = useRef<((correct: boolean, aiChosenIndex?: number) => void) | null>(null);
  const onFateResolveRef = useRef<(() => void) | null>(null);
  const onChanceResolveRef = useRef<(() => void) | null>(null);
  const onEventResolveRef = useRef<(() => void) | null>(null);
  
  const log = useCallback((msg: string) => {
    setGameLog(prev => [msg, ...prev].slice(0, 15));
  }, []);

  useEffect(() => {
    engine.init();
    engine.setMasterVolume(masterVolume);
    engine.setSfxVolume(sfxVolume);
  }, []);

  useEffect(() => {
    engine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  useEffect(() => {
    engine.setSfxVolume(sfxVolume);
  }, [sfxVolume]);

  const playSfx = useCallback((soundName: string) => {
    engine.resume();
    engine.playSfx(soundName);
  }, []);

  const currentPlayer = players[currentPlayerIndex];

  const checkWin = useCallback((updatedPlayers: Player[]) => {
    const winner = updatedPlayers.find(p => p.meat >= winCondition);
    if (winner) {
      log(`【終局】${winner.character} 率先獲得 ${winner.meat} 塊祭肉，完成教化旅程！`);
      playSfx('winGame');
      setActiveModal('WIN');
      return true;
    }
    return false;
  }, [playSfx, winCondition, log]);

  const showVictoryEffect = useCallback((playerIndex: number, amount: number, callback: () => void, customTitle?: string) => {
    setMeatAnimationTarget(playerIndex);
    setMeatAnimationAmount(amount);
    setMeatAnimationTitle(customTitle || null);
    setMeatAnimationCallback(() => callback);
    if (amount > 0) setIsBoardCelebrating(true);
  }, []);

  const handleCentralMeatAnimationComplete = useCallback(() => {
    setIsBoardCelebrating(false);
  }, []);

  const nextTurn = useCallback(() => {
    if (activeModal === 'WIN') return;

    if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current);
    if (aiRollTimeoutRef.current) window.clearTimeout(aiRollTimeoutRef.current);
    if (aiModalDecisionTimeoutRef.current) window.clearTimeout(aiModalDecisionTimeoutRef.current);
    rollTimeoutRef.current = null; 
    aiRollTimeoutRef.current = null; 
    aiModalDecisionTimeoutRef.current = null;

    setIsRolling(false);
    setIsPlayerMoving(false);
    setActiveModal(null);
    setShowBigIcon(null);
    setShowPause(false);
    setShowRecovery(false);
    setTrialSelection({ selected: null, isRevealed: false });
    setWaitingForHumanConfirmation(false);
    setAiDecisionMadeInModal(null);
    setIsAiGeneratingTrial(false);
    setMeatAnimationTarget(null);

    const nextIndex = (currentPlayerIndex + 1) % players.length;
    setCurrentPlayerIndex(nextIndex);
    playSfx('turnStart');
    
    const nextP = players[nextIndex];
    if (nextP.isPaused && nextP.turnsToSkip > 0) {
      log(`【暫停】${nextP.character} 本回合需暫停行動。`);
      setShowPause(true);
      if (gameMode === 'quick' && nextP.isAI) {
        window.setTimeout(() => handlePauseConfirm(), 800); 
      }
    } else if (nextP.wasPaused) {
      setShowRecovery(true);
      setTimeout(() => {
        setShowRecovery(false);
        setPlayers(prev => prev.map((p, i) => i === nextIndex ? { ...p, wasPaused: false } : p));
        log(`【恢復】${nextP.character} 重返周遊列國之途。`);
      }, 1000);
    } else {
      log(`【輪值】${nextP.isAI ? '[電腦] ' : ''}${nextP.character} 開始本回合的探索。`);
    }
  }, [players, currentPlayerIndex, playSfx, activeModal, log, gameMode]);

  const handlePauseConfirm = useCallback(() => {
    playSfx('click');
    setShowPause(false);
    setPlayers(prev => prev.map((p, i) => {
        if (i === currentPlayerIndex) {
            const newTurns = Math.max(0, p.turnsToSkip - 1);
            return { ...p, turnsToSkip: newTurns, isPaused: newTurns > 0, wasPaused: newTurns === 0 };
        }
        return p;
    }));
    setTimeout(nextTurn, 300);
  }, [playSfx, nextTurn, currentPlayerIndex]);

  const onEventResolve = useCallback(() => {
    const effect = activeEventData?.effectType;
    if (effect === 'GAIN_MEAT' || effect === 'LOSE_MEAT') {
        const amount = effect === 'GAIN_MEAT' ? 1 : -1;
        setActiveModal(null);
        showVictoryEffect(currentPlayerIndex, amount, () => {
            setPlayers(prev => {
                const updated = prev.map((p, i) => i === currentPlayerIndex ? { ...p, meat: Math.max(0, p.meat + amount) } : p);
                log(`【事件】${currentPlayer.character} 在「${activeEventData?.title}」歷史現場${amount > 0 ? '獲得' : '扣除'}了 1 份祭肉。`);
                if (!checkWin(updated)) nextTurn();
                return updated;
            });
        });
    } else {
        setActiveModal(null);
        if (effect === 'PAUSE') {
            setPlayers(prev => prev.map((p, i) => i === currentPlayerIndex ? { ...p, isPaused: true, turnsToSkip: p.turnsToSkip + 1 } : p));
            log(`【事件】${currentPlayer.character} 遭遇「${activeEventData?.title}」，需暫停行動並自省一回合。`);
        }
        setTimeout(nextTurn, 500);
    }
  }, [currentPlayerIndex, activeEventData, nextTurn, showVictoryEffect, checkWin, currentPlayer, log]);
  onEventResolveRef.current = onEventResolve;

  const resolveTrial = useCallback((correct: boolean, aiChosenIndex?: number) => {
    if (activeModal === 'WIN') return;
    if (correct) {
      log(`【試煉】${currentPlayer.character} 展現博學與仁德，成功解答文化試煉，獲贈祭肉。`);
      setActiveModal(null); 
      setTimeout(() => { 
        showVictoryEffect(currentPlayerIndex, 1, () => {
          setPlayers(prev => {
            const updated = prev.map((p, i) => i === currentPlayerIndex ? { ...p, meat: p.meat + 1 } : p);
            if (!checkWin(updated)) {
                playSfx('correctAnswer');
                setTimeout(nextTurn, 500);
            }
            return updated;
          });
        });
      }, 400);
    } else {
      log(`【試煉】${currentPlayer.character} 遺憾未能解答試煉，錯失了獲得認可的機會。`);
      playSfx('incorrectAnswer');
      setActiveModal(null);
      setTimeout(nextTurn, 500);
    }
  }, [currentPlayerIndex, checkWin, playSfx, nextTurn, activeModal, showVictoryEffect, currentPlayer, log]);
  resolveTrialRef.current = resolveTrial;

  const onFateResolve = useCallback(() => {
    if (activeModal === 'WIN') return;
    const fate = activeFate;
    if (!fate) { setActiveModal(null); nextTurn(); return; }
    const meatChange = fate.effect.meat || 0;
    
    log(`【命運】${currentPlayer.character} 遭遇命運插曲：「${fate.title}」。其情境為：${fate.description}`);

    const finalize = (actualMeat: number) => {
        setPlayers(prev => {
            let copy = [...prev];
            let me = { ...copy[currentPlayerIndex] };
            me.meat = Math.max(0, me.meat + actualMeat);
            if (fate.effect.isPaused) { me.isPaused = true; me.turnsToSkip++; }
            if (fate.effect.special === 'HAS_PROTECTION') {
                me.hasProtection = true;
                log(`【狀態】${me.character} 獲得「仁德護體」，將可抵禦一次懲罰。`);
            }
            copy[currentPlayerIndex] = me;
            if (fate.effect.position !== undefined) {
                me.position = fate.effect.position;
                copy[currentPlayerIndex] = me;
                log(`【異動】因命運驅使，${me.character} 移至新的疆域。`);
                setTimeout(() => handleTileActionRef.current?.(me.position), 100);
            } else if (!checkWin(copy)) nextTurn();
            return copy;
        });
    };
    setActiveModal(null);
    if (meatChange !== 0) showVictoryEffect(currentPlayerIndex, meatChange, () => finalize(meatChange));
    else finalize(0);
  }, [activeFate, currentPlayerIndex, checkWin, nextTurn, showVictoryEffect, currentPlayer, log]);
  onFateResolveRef.current = onFateResolve;

  const onChanceResolve = useCallback(() => {
    if (activeModal === 'WIN') return;
    const chance = activeChance;
    if (!chance) { setActiveModal(null); nextTurn(); return; }
    
    log(`【機緣】${currentPlayer.character} 遭遇機緣：「${chance.title}」。挑戰內容：${chance.challenge}`);

    const finalize = (finalMeat: number) => {
      setPlayers(prev => {
        let copy = [...prev];
        let me = { ...copy[currentPlayerIndex] };
        me.meat = Math.max(0, me.meat + finalMeat);
        copy[currentPlayerIndex] = me;
        if (!checkWin(copy)) nextTurn();
        return copy;
      });
    };
    setActiveModal(null);
    let meat = chance.effect?.meat || 0;
    if (meat !== 0) {
        log(`【機緣結果】${currentPlayer.character} 獲得 ${meat} 份機緣祭肉。`);
        showVictoryEffect(currentPlayerIndex, meat, () => finalize(meat));
    } else {
        log(`【機緣結果】${currentPlayer.character} 完成了機緣挑戰。`);
        finalize(0);
    }
  }, [activeChance, currentPlayerIndex, nextTurn, checkWin, showVictoryEffect, currentPlayer, log]);
  onChanceResolveRef.current = onChanceResolve;

  const movePlayer = useCallback(async (steps: number, targetPlayerId?: number) => {
    setIsPlayerMoving(true);
    const pId = targetPlayerId ?? currentPlayerIndex;
    let tempPos = players[pId].position;
    let passStart = false;

    for (let i = 0; i < steps; i++) {
      await new Promise(r => setTimeout(r, 400));
      const nextPos = (tempPos + 1) % BOARD_TILES.length;
      if (tempPos !== 0 && nextPos === 0) passStart = true;
      tempPos = nextPos;
      playSfx('move'); 
      setPlayers(prev => prev.map((p, idx) => idx === pId ? { ...p, position: nextPos } : p));
    }

    if (passStart && pId === currentPlayerIndex) {
      log(`【魯國省親】${players[pId].character} 回到儒學故鄉魯國，領取祭肉一份。`);
      showVictoryEffect(pId, 1, () => {
        setPlayers(prev => {
          const updated = prev.map((p, idx) => idx === pId ? { ...p, meat: p.meat + 1 } : p);
          if (!checkWin(updated)) {
              setIsPlayerMoving(false);
              handleTileActionRef.current?.(tempPos);
          }
          return updated;
        });
      }, "經過魯國");
    } else {
      setTimeout(() => {
          setIsPlayerMoving(false);
          if (pId === currentPlayerIndex) handleTileActionRef.current?.(tempPos);
          else nextTurn();
      }, 500);
    }
  }, [players, currentPlayerIndex, showVictoryEffect, checkWin, nextTurn, playSfx, log]);
  movePlayerRef.current = movePlayer;

  const handleTileAction = useCallback(async (tileIndex: number) => {
    const tile = BOARD_TILES[tileIndex];
    if (!currentPlayer) return;
    playSfx('cardFlip');
    log(`【行止】${currentPlayer.character} 停留在「${tile.name}」。`);

    switch (tile.type) {
      case TileType.STATE:
        setActiveModal('TRIAL');
        let trial = gameMode === 'advanced' ? await generateAiTrial(tile.state || tile.name) : TRIAL_CARDS[Math.floor(Math.random() * TRIAL_CARDS.length)];
        setActiveTrial(trial || TRIAL_CARDS[0]);
        break;
      case TileType.FATE:
        setShowBigIcon('FATE');
        setTimeout(() => {
            setShowBigIcon(null); setActiveModal('FATE');
            setActiveFate(FATE_CARDS[Math.floor(Math.random() * FATE_CARDS.length)]);
        }, 1200);
        break;
      case TileType.CHANCE:
        setShowBigIcon('CHANCE');
        setTimeout(() => {
            setShowBigIcon(null); setActiveModal('CHANCE');
            setActiveChance(CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)]);
        }, 1200);
        break;
      case TileType.EVENT:
        if (tile.name.includes('匡')) {
            setActiveEventData({ title: "受困於匡", content: "匡人因孔子貌似陽虎而圍困之，孔子展現無畏天命之精神，講誦弦歌不絕。", effectLabel: "暫停一回合", effectType: 'PAUSE' });
            setActiveModal('EVENT_DETAIL');
        } else if (tile.name.includes('鄭')) {
            setActiveEventData({ title: "喪家之犬", content: "孔子在鄭國與弟子走散，自嘲如喪家之犬，體現隨遇而安的曠達境界。", effectLabel: "扣除祭肉一份", effectType: 'LOSE_MEAT' });
            setActiveModal('EVENT_DETAIL');
        } else if (tile.name.includes('陳蔡')) {
            setActiveEventData({ title: "陳蔡絕糧", content: "在陳蔡之間遭遇糧斷，孔子依然講習不輟，教導君子處困窮而不改其節。", effectLabel: "暫停一回合", effectType: 'PAUSE' });
            setActiveModal('EVENT_DETAIL');
        } else if (tile.name.includes('葉公')) {
            setActiveEventData({ title: "葉公問政", content: "葉公向孔子問政，孔子答以「近者說，遠者來」，獲得葉公賞識。", effectLabel: "獲得祭肉一份", effectType: 'GAIN_MEAT' });
            setActiveModal('EVENT_DETAIL');
        } else nextTurn();
        break;
      default: nextTurn();
    }
  }, [currentPlayer, playSfx, nextTurn, log, gameMode]);
  handleTileActionRef.current = handleTileAction;

  const generateAiTrial = async (stateName: string): Promise<TrialCard | null> => {
    try {
      setIsAiGeneratingTrial(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `生成一則關於「${stateName}」與儒家思想的單選題。`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              answerIndex: { type: Type.INTEGER },
              analysis: { type: Type.STRING },
              quote: { type: Type.STRING }
            },
            required: ["question", "options", "answerIndex", "analysis", "quote"]
          }
        }
      });
      const trial = JSON.parse(response.text.trim());
      return { ...trial, id: Date.now(), isAiGenerated: true };
    } catch { return null; } finally { setIsAiGeneratingTrial(false); }
  };

  const handleRoll = useCallback(() => {
    engine.resume();
    if (isRolling || isPlayerMoving || activeModal || showBigIcon || showRecovery || showPause || waitingForHumanConfirmation || isAiGeneratingTrial || meatAnimationTarget !== null) return;
    playSfx('diceRoll');
    setIsRolling(true);
    rollTimeoutRef.current = window.setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1, d2 = Math.floor(Math.random() * 6) + 1;
      setDiceRolls([d1, d2]); setIsRolling(false);
      log(`【卜行】${currentPlayer.character} 擲出了 ${d1+d2} 點，繼續教化之行。`);
      movePlayerRef.current?.(d1 + d2);
    }, 600);
  }, [isRolling, isPlayerMoving, activeModal, showBigIcon, showRecovery, showPause, waitingForHumanConfirmation, playSfx, currentPlayer, isAiGeneratingTrial, meatAnimationTarget, log]);

  useEffect(() => {
    if (gameStarted && players[currentPlayerIndex]?.isAI && !isRolling && !isPlayerMoving && !activeModal && !showBigIcon && !showRecovery && !showPause && !players[currentPlayerIndex].isPaused && !waitingForHumanConfirmation && !isAiGeneratingTrial && meatAnimationTarget === null) {
        aiRollTimeoutRef.current = window.setTimeout(() => handleRoll(), gameMode === 'quick' ? 800 : 2000); 
    }
    return () => { if (aiRollTimeoutRef.current) window.clearTimeout(aiRollTimeoutRef.current); };
  }, [gameStarted, currentPlayerIndex, isRolling, isPlayerMoving, activeModal, showBigIcon, showRecovery, showPause, players, handleRoll, waitingForHumanConfirmation, isAiGeneratingTrial, gameMode, meatAnimationTarget]);

  useEffect(() => {
    if (activeModal && currentPlayer?.isAI && !waitingForHumanConfirmation && !aiDecisionMadeInModal && activeModal !== 'WIN') {
        const delay = gameMode === 'quick' ? 500 : 1500;
        aiModalDecisionTimeoutRef.current = window.setTimeout(() => {
            if (activeModal === 'TRIAL' && activeTrial) {
                const choice = Math.random() < 0.7 ? activeTrial.answerIndex : Math.floor(Math.random() * 4);
                setAiDecisionMadeInModal({ type: 'TRIAL', choice });
                if (gameMode === 'normal' || gameMode === 'advanced') setWaitingForHumanConfirmation(true);
                else resolveTrialRef.current?.(choice === activeTrial.answerIndex, choice);
            } else {
                setAiDecisionMadeInModal({ type: activeModal });
                if (gameMode === 'normal' || gameMode === 'advanced') setWaitingForHumanConfirmation(true);
                else {
                    if (activeModal === 'FATE') onFateResolveRef.current?.();
                    else if (activeModal === 'CHANCE') onChanceResolveRef.current?.();
                    else if (activeModal === 'EVENT_DETAIL') onEventResolveRef.current?.();
                }
            }
        }, delay);
    }
    return () => { if (aiModalDecisionTimeoutRef.current) window.clearTimeout(aiModalDecisionTimeoutRef.current); };
  }, [activeModal, currentPlayer, gameMode, activeTrial, waitingForHumanConfirmation, aiDecisionMadeInModal]);

  const handleHumanConfirmation = useCallback(() => {
    if (!aiDecisionMadeInModal) return;
    const decision = aiDecisionMadeInModal;
    setWaitingForHumanConfirmation(false);
    setAiDecisionMadeInModal(null);
    
    if (decision.type === 'TRIAL') {
      resolveTrialRef.current?.(decision.choice === activeTrial?.answerIndex, decision.choice);
    } else if (decision.type === 'FATE') {
      onFateResolveRef.current?.();
    } else if (decision.type === 'CHANCE') {
      onChanceResolveRef.current?.();
    } else if (decision.type === 'EVENT_DETAIL') {
      onEventResolveRef.current?.();
    }
  }, [aiDecisionMadeInModal, activeTrial]);

  const handleStartGame = (configuredPlayers: Player[], goal: number, mode: GameMode) => {
    engine.init();
    engine.resume();
    playSfx('click');
    setWinCondition(goal); setPlayers(configuredPlayers); setGameStarted(true); setGameMode(mode);
  };

  const handleRestart = useCallback(() => {
    // 徹底重置所有相關狀態
    setGameStarted(false);
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setGameLog(['【公告】重新開始教化旅程。願君子之德如風。']);
    setActiveModal(null);
    setIsRolling(false);
    setIsPlayerMoving(false);
    setDiceRolls([1, 1]);
    setShowBigIcon(null);
    setShowPause(false);
    setShowRecovery(false);
    setWaitingForHumanConfirmation(false);
    setAiDecisionMadeInModal(null);
    setIsAiGeneratingTrial(false);
    setMeatAnimationTarget(null);
    setMeatAnimationAmount(0);
    setMeatAnimationTitle(null);
    setMeatAnimationCallback(null);
    setIsBoardCelebrating(false);
    
    // 清除計時器
    if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current);
    if (aiRollTimeoutRef.current) window.clearTimeout(aiRollTimeoutRef.current);
    if (aiModalDecisionTimeoutRef.current) window.clearTimeout(aiModalDecisionTimeoutRef.current);
  }, []);

  if (!gameStarted) return <StartScreen onStartGame={handleStartGame} playSfx={playSfx} />;

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-start bg-stone-100 overflow-x-hidden relative font-serif" onClick={() => engine.resume()}>
      <MeatEffect targetIndex={meatAnimationTarget} amount={meatAnimationAmount} customTitle={meatAnimationTitle} playSfx={playSfx} onComplete={() => { meatAnimationCallback?.(); setMeatAnimationTarget(null); setMeatAnimationCallback(null); }} onCentralAnimationComplete={handleCentralMeatAnimationComplete} />
      {showRecovery && <RecoveryEffect character={currentPlayer?.character || ''} />}
      {showPause && <PauseEffect character={currentPlayer?.character || ''} showConfirmButton={gameMode !== 'quick' || !currentPlayer?.isAI} onConfirm={handlePauseConfirm} />}
      {activeModal === 'WIN' && <VictoryOverlay winner={players.find(p => p.meat >= winCondition)!} allPlayers={players} onRestart={handleRestart} />}
      
      <header className="mb-8 text-center"><h1 className="text-4xl md:text-5xl font-black text-stone-800 tracking-widest border-b-4 border-stone-800 inline-block px-6">孔子周遊列國</h1></header>
      <button onClick={() => { playSfx('click'); setShowAudioSettings(true); }} className="absolute top-4 right-4 p-3 bg-white shadow-lg rounded-full z-40 transition-transform active:scale-90 hover:bg-stone-50">⚙️</button>
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* 左側：賢士資訊 + 玩法說明 (與紀錄互換位置) */}
        <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
          <PlayerInfo players={players} currentIndex={currentPlayerIndex} winCondition={winCondition} />
          
          <div className="space-y-4 text-xs bg-white p-6 rounded-xl shadow-md border border-stone-200 overflow-y-auto max-h-[50vh] scrollbar-thin">
            <h3 className="font-black mb-4 flex items-center text-lg border-b-2 border-amber-600 pb-2">📖 聖賢之路指南</h3>
            <div className="space-y-4 text-stone-700 leading-relaxed">
              <section>
                <h4 className="font-bold text-amber-800 mb-1">【 終極目標 】</h4>
                <p>首位在週遊各國旅途中，累積獲得 <span className="font-bold text-red-800">{winCondition} 塊祭肉</span> 的賢士即獲得最終勝利。祭肉象徵德行的認可與對儒學教化的貢獻。</p>
              </section>
              <section>
                <h4 className="font-bold text-amber-800 mb-1">【 魯國歸鄉 】</h4>
                <p>每回合擲骰前進。若經過起點「魯國」，代表飲水思源，可額外領取一塊祭肉。</p>
              </section>
              <section>
                <h4 className="font-bold text-amber-800 mb-1">【 文化試煉 】</h4>
                <p>停留在各國城池時，需接受儒家經典試煉。答對可獲祭肉認可，答錯則失去獲取良機。</p>
              </section>
              <section>
                <h4 className="font-bold text-amber-800 mb-1">【 歷史名場面 】</h4>
                <ul className="list-disc ml-4 space-y-1 text-[10px]">
                  <li><span className="font-bold text-stone-900">陳蔡絕糧：</span>考驗「君子固窮」，暫停行動。</li>
                  <li><span className="font-bold text-stone-900">喪家之犬：</span>體悟對名利的曠達，扣除祭肉。</li>
                  <li><span className="font-bold text-stone-900">仁德護體：</span>部分機緣可獲得特殊保護狀態。</li>
                </ul>
              </section>
              <section>
                <h4 className="font-bold text-amber-800 mb-1">【 遊戲模式 】</h4>
                <p><span className="font-bold">進階模式：</span>採用 AI 即時命題系統，根據當前國家歷史動態生成全新考驗。</p>
              </section>
              <p className="italic text-stone-400 mt-4 border-t pt-2">「君子憂道不憂貧。」</p>
            </div>
          </div>
        </div>

        {/* 中間：棋盤 */}
        <div className="lg:col-span-2 order-1 lg:order-2 flex flex-col items-center">
          <Board tiles={BOARD_TILES} players={players} diceRolls={diceRolls} isRolling={isRolling} handleRoll={handleRoll} isModalActive={!!activeModal} isPlayerMoving={isPlayerMoving} currentPlayerIndex={currentPlayerIndex} isBoardCelebrating={isBoardCelebrating} showBigIcon={showBigIcon} playSfx={playSfx} isWaitingForHumanConfirmation={waitingForHumanConfirmation} handleHumanConfirmation={handleHumanConfirmation} gameMode={gameMode} meatAnimationTarget={meatAnimationTarget} />
        </div>

        {/* 右側：遊記紀錄 (與指南互換位置) */}
        <div className="lg:col-span-1 order-3 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-md border border-stone-200">
            <h3 className="font-black mb-4 flex items-center text-lg border-b-2 border-stone-800 pb-2">📜 遊記紀錄</h3>
            <div className="text-sm space-y-2 h-[80vh] overflow-y-auto scrollbar-thin">
              {gameLog.map((m, i) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 shadow-sm transition-all duration-300 ${i === 0 ? "bg-amber-50 border-amber-500 font-bold scale-105" : "bg-stone-50 border-stone-200 opacity-80"}`}>
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CardModal type={activeModal} trial={activeTrial} fate={activeFate} chance={activeChance} eventData={activeEventData} currentPlayerName={currentPlayer?.character} onTrialResolve={(idx) => setTrialSelection({ selected: idx, isRevealed: true })} onTrialConfirm={() => { if (trialSelection.selected !== null) resolveTrialRef.current?.(trialSelection.selected === activeTrial?.answerIndex); }} onFateResolve={() => onFateResolveRef.current?.()} onChanceResolve={() => onChanceResolveRef.current?.()} onEventResolve={() => onEventResolveRef.current?.()} onClose={() => setActiveModal(null)} playSfx={playSfx} isAI={currentPlayer?.isAI || false} trialSelection={trialSelection} gameMode={gameMode} waitingForHumanConfirmation={waitingForHumanConfirmation} aiDecisionMadeInModal={aiDecisionMadeInModal} handleHumanConfirmation={handleHumanConfirmation} />
      <AudioSettings show={showAudioSettings} onClose={() => setShowAudioSettings(false)} masterVolume={masterVolume} setMasterVolume={setMasterVolume} sfxVolume={sfxVolume} setSfxVolume={setSfxVolume} />
    </div>
  );
};

export default App;
