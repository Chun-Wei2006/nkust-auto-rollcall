"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [zoom, setZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [supportsZoom, setSupportsZoom] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const applyZoom = useCallback(async (newZoom: number) => {
    const track = trackRef.current;
    if (!track) return;

    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
      if (capabilities.zoom) {
        const clampedZoom = Math.min(Math.max(newZoom, 1), capabilities.zoom.max);
        await track.applyConstraints({
          advanced: [{ zoom: clampedZoom } as MediaTrackConstraintSet],
        });
        setZoom(clampedZoom);
      }
    } catch (error) {
      console.error("Failed to apply zoom:", error);
    }
  }, []);

  useEffect(() => {
    const checkZoomSupport = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        const videoTrack = stream.getVideoTracks()[0];
        trackRef.current = videoTrack;

        const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } };

        if (capabilities.zoom) {
          setSupportsZoom(true);
          setMaxZoom(capabilities.zoom.max);
        }

        // 不要停止 stream，讓 Scanner 元件使用它
      } catch (error) {
        console.error("Failed to check zoom support:", error);
      }
    };

    checkZoomSupport();

    return () => {
      // 清理時停止 track
      if (trackRef.current) {
        trackRef.current.stop();
      }
    };
  }, []);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    applyZoom(newZoom);
  };

  const incrementZoom = () => {
    applyZoom(Math.min(zoom + 0.5, maxZoom));
  };

  const decrementZoom = () => {
    applyZoom(Math.max(zoom - 0.5, 1));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg">
        <Scanner
          onScan={(result) => {
            if (result && result.length > 0) {
              onScan(result[0].rawValue);
            }
          }}
          onError={(error) => {
            console.error("QR Scanner error:", error);
          }}
          styles={{
            container: {
              width: "100%",
            },
          }}
          constraints={{
            facingMode: "environment",
          }}
        />
      </div>

      {/* 縮放控制 */}
      {supportsZoom && (
        <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              鏡頭縮放
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {zoom.toFixed(1)}x
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={decrementZoom}
              disabled={zoom <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-200 text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
            >
              -
            </button>
            <input
              type="range"
              min="1"
              max={maxZoom}
              step="0.1"
              value={zoom}
              onChange={handleZoomChange}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-zinc-300 dark:bg-zinc-600"
            />
            <button
              type="button"
              onClick={incrementZoom}
              disabled={zoom >= maxZoom}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-200 text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
            >
              +
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full rounded-lg bg-zinc-200 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
      >
        關閉掃描器
      </button>
    </div>
  );
}
