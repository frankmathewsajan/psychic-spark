import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MessageSquareText,
  LayoutGrid,
  Zap,
  Sliders,
  CheckCircle,
  Shield,
  FileSpreadsheet,
  ExternalLink,
  Code2,
} from "lucide-react";
import { SLIDES, SlideData } from "./data/slides";
import { AsciiMeter, AsciiPipeline, AsciiHazard, AsciiDiscomSeal } from "./components/AsciiLibrary";
import { InteractiveSimulator } from "./components/InteractiveSimulator";
import { SpeakerNotes } from "./components/SpeakerNotes";

export default function App() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const slide = SLIDES[currentSlideIndex];

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((idx) => Math.min(idx + 1, SLIDES.length - 1));
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((idx) => Math.max(idx - 1, 0));
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSimulator && e.key === "Escape") {
        setShowSimulator(false);
        return;
      }
      if (showGrid && e.key === "Escape") {
        setShowGrid(false);
        return;
      }

      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "n" || e.key === "N") {
        setShowNotes((n) => !n);
      } else if (e.key === "g" || e.key === "G") {
        setShowGrid((g) => !g);
      } else if (e.key === "s" || e.key === "S") {
        setShowSimulator((s) => !s);
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, showSimulator, showGrid]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 select-none">
      {/* TOP APP HEADER */}
      <header className="h-14 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            N
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>NOVO EDGE-AI</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono font-medium">
                VIVA DEFENSE
              </span>
            </h1>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2">
          {/* SIMULATOR BUTTON */}
          <button
            onClick={() => setShowSimulator(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Interactive Simulator</span>
          </button>

          {/* SPEAKER NOTES BUTTON */}
          <button
            onClick={() => setShowNotes((n) => !n)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              showNotes
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
            title="Press 'N' to toggle notes"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Notes</span>
          </button>

          {/* GRID OVERVIEW */}
          <button
            onClick={() => setShowGrid(true)}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
            title="Slide overview ('G')"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* FULLSCREEN */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
            title="Fullscreen ('F')"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MAIN SLIDE STAGE */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        {/* SLIDE CARD */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-elevation3 p-6 sm:p-10 flex flex-col justify-between min-h-[580px] transition-all">
          {/* SLIDE HEADER */}
          <div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                {slide.category}
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold">
                SLIDE {String(currentSlideIndex + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2 leading-tight">
              {slide.title}
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              {slide.subtitle}
            </p>
          </div>

          {/* SLIDE BODY */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6 items-center">
            {/* LEFT COLUMN: POINTS OR CODE */}
            <div className={slide.asciiType ? "lg:col-span-7 space-y-4" : "lg:col-span-12 space-y-4"}>
              {slide.points && (
                <ul className="space-y-3">
                  {slide.points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              )}

              {slide.codeSnippet && (
                <div className="mt-4 rounded-xl bg-slate-950 p-4 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto shadow-inner">
                  <pre>{slide.codeSnippet}</pre>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: ASCII ART */}
            {slide.asciiType && (
              <div className="lg:col-span-5 flex justify-center">
                {slide.asciiType === "meter" && <AsciiMeter reading="01428.5" status="PASS" />}
                {slide.asciiType === "pipeline" && <AsciiPipeline />}
                {slide.asciiType === "hazard" && <AsciiHazard />}
                {slide.asciiType === "discom" && <AsciiDiscomSeal />}
              </div>
            )}
          </div>

          {/* METRICS ROW */}
          {slide.metrics && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {slide.metrics.map((m, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">
                    {m.label}
                  </div>
                  <div className={`text-lg font-bold font-mono mt-0.5 ${m.color || "text-slate-900"}`}>
                    {m.value}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{m.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* BOTTOM CONTROLS & NAVIGATION */}
      <footer className="h-16 border-t border-slate-200 bg-white px-4 sm:px-8 flex items-center justify-between sticky bottom-0 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={prevSlide}
            disabled={currentSlideIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>

          <button
            onClick={nextSlide}
            disabled={currentSlideIndex === SLIDES.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition shadow-sm"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* PROGRESS INDICATOR DOTS */}
        <div className="hidden sm:flex items-center gap-1.5">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentSlideIndex
                  ? "w-8 bg-blue-600"
                  : "w-2 bg-slate-200 hover:bg-slate-400"
              }`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* KEYBOARD SHORTCUTS CUE */}
        <div className="text-[11px] font-mono text-slate-400 hidden md:block">
          Use <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">←</kbd> /{" "}
          <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">→</kbd> or{" "}
          <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">N</kbd> Notes
        </div>
      </footer>

      {/* SPEAKER NOTES DRAWER */}
      <SpeakerNotes
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
        notes={slide.notes}
        slideIndex={currentSlideIndex}
        totalSlides={SLIDES.length}
      />

      {/* INTERACTIVE SIMULATOR MODAL */}
      {showSimulator && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setShowSimulator(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <InteractiveSimulator />
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowSimulator(false)}
                className="px-4 py-2 bg-white text-slate-800 text-xs font-semibold rounded-lg shadow-sm hover:bg-slate-100"
              >
                Close Simulator (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLIDE GRID OVERVIEW MODAL */}
      {showGrid && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowGrid(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Slide Navigator</h3>
              <button
                onClick={() => setShowGrid(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700"
              >
                Close (Esc)
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              {SLIDES.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setCurrentSlideIndex(idx);
                    setShowGrid(false);
                  }}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                    idx === currentSlideIndex
                      ? "border-blue-600 bg-blue-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-400 bg-white"
                  }`}
                >
                  <div className="text-[10px] font-mono text-slate-400 font-bold">SLIDE {idx + 1}</div>
                  <div className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{s.title}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{s.subtitle}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
