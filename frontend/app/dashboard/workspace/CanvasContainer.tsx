'use client';

interface CanvasContainerProps {
  children: React.ReactNode;
}

export default function CanvasContainer({ children }: CanvasContainerProps) {
  return (
    <div className="h-full flex flex-col bg-white relative">
      {children}
    </div>
  );
}
