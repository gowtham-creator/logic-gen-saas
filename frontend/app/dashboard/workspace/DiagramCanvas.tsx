'use client';

import { useState, useRef } from 'react';
import { SearchPlus, SearchMinus, Maximize, Hand } from '@mynaui/icons-react';

interface DiagramCanvasProps {
  children?: React.ReactNode;
}

export default function DiagramCanvas({ children }: DiagramCanvasProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    // Pan with middle mouse button or space + left click
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setStartPos({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Handle zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.min(Math.max(0.1, scale + delta), 3);
      setScale(newScale);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setScale(Math.min(scale + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale(Math.max(scale - 0.2, 0.1));
  };

  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full bg-gray-50 overflow-hidden">
      {/* Grid Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${position.x}px ${position.y}px`,
        }}
      />

      {/* Canvas Content */}
      <div
        ref={canvasRef}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{
          cursor: isPanning ? 'grabbing' : 'default',
        }}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {children}
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-white rounded-xl shadow-lg border border-gray-200 p-2">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
          title="Zoom In"
        >
          <SearchPlus className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
        </button>
        <div className="h-px bg-gray-200" />
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
          title="Zoom Out"
        >
          <SearchMinus className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
        </button>
        <div className="h-px bg-gray-200" />
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
          title="Reset View"
        >
          <Maximize className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
        </button>
      </div>

      {/* Zoom Indicator */}
      <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-md border border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Hand className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
