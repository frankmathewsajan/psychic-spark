import React, { useState, useEffect } from "react";
import { MessageSquareText, Clock, HelpCircle, X, ChevronUp, ChevronDown } from "lucide-react";

export interface SpeakerNoteData {
  talkingPoints: string[];
  examinerQuestions: { question: string; answer: string }[];
  keyTakeaway: string;
}

export function SpeakerNotes({
  isOpen,
  onClose,
  notes,
  slideIndex,
  totalSlides,
}: {
  isOpen: boolean;
  onClose: () => void;
  notes: SpeakerNoteData;
  slideIndex: number;
  totalSlides: number;
}) {
  const [seconds, setSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimerRunning) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md text-white border-t-2 border-blue-500 shadow-2xl transition-all max-h-[45vh] overflow-y-auto p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-blue-600/30 text-blue-400 rounded-md">
              <MessageSquareText className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Viva Defense Speaker Notes (Slide {slideIndex + 1} of {totalSlides})
              </h4>
              <p className="text-[11px] text-slate-400">
                Key takeaway: <span className="text-blue-300 font-medium">{notes.keyTakeaway}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full font-mono text-xs text-cyan-400">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatTime(seconds)}</span>
              <button
                onClick={() => setIsTimerRunning((r) => !r)}
                className="text-[10px] ml-1 text-slate-400 hover:text-white"
              >
                {isTimerRunning ? "Pause" : "Play"}
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 text-xs">
          {/* TALKING POINTS */}
          <div>
            <h5 className="font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              What to Say to Examiners
            </h5>
            <ul className="space-y-2 text-slate-300 leading-relaxed">
              {notes.talkingPoints.map((pt, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-blue-400 text-[11px]">{idx + 1}.</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ANTICIPATED EXAMINER QUESTIONS */}
          <div>
            <h5 className="font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-[11px]">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              Anticipated Examiner Q&A
            </h5>
            <div className="space-y-3">
              {notes.examinerQuestions.map((q, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                  <div className="font-bold text-amber-300 text-[11px]">Q: {q.question}</div>
                  <div className="text-slate-300 mt-1 leading-normal text-[11px]">
                    <span className="text-emerald-400 font-semibold">A:</span> {q.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
