"use client";

import { Scanner } from "@yudiel/react-qr-scanner";

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
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
        />
      </div>
      <button
        onClick={onClose}
        className="w-full rounded-lg bg-zinc-200 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
      >
        關閉掃描器
      </button>
    </div>
  );
}
