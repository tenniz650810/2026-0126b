
import React from 'react';

interface AudioSettingsProps {
  show: boolean;
  onClose: () => void;
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
  sfxVolume: number;
  setSfxVolume: (volume: number) => void;
}

const AudioSettings: React.FC<AudioSettingsProps> = ({
  show,
  onClose,
  masterVolume,
  setMasterVolume,
  sfxVolume,
  setSfxVolume,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#fdfaf5] rounded-2xl shadow-2xl max-w-sm w-full p-8 border-8 border-double border-stone-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-800 transition-colors"
          aria-label="Close settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-black text-stone-800 mb-6 border-b-4 border-stone-800 pb-2 tracking-widest text-center">律呂調諧</h2>

        <div className="space-y-8">
          {/* Master Volume */}
          <div className="px-3">
            <label htmlFor="masterVolume" className="block text-xs font-bold text-stone-500 uppercase tracking-[0.2em] mb-3 text-center">總主音量 (Master)</label>
            <input
              type="range"
              id="masterVolume"
              min="0" max="1" step="0.05"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800"
            />
          </div>

          <div className="h-px bg-stone-200 mx-3"></div>

          {/* SFX Volume Slider */}
          <div className="px-3">
            <label htmlFor="sfxVolume" className="block text-xs font-bold text-stone-500 uppercase tracking-[0.2em] mb-3 text-center">器物音效 (SFX)</label>
            <input
              type="range"
              id="sfxVolume"
              min="0" max="1" step="0.05"
              value={sfxVolume}
              onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>
        </div>
        
        <div className="mt-10 text-center">
            <button 
                onClick={onClose} 
                className="bg-stone-800 text-white px-10 py-3 rounded-full font-black text-sm shadow-xl hover:bg-black transition-all border-b-4 border-stone-900 active:translate-y-1 active:border-b-0 tracking-widest"
            >
                調和完畢
            </button>
        </div>
      </div>
    </div>
  );
};

export default AudioSettings;
