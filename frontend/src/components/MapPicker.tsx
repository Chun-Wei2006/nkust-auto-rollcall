"use client";

// 地圖選點：畫面中央固定準星，拖動地圖到教室位置後按「使用此位置」
// 只在 client 端載入（ZuvioPanel 以 next/dynamic ssr:false 匯入），Leaflet 需要 window
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordinates } from "@/lib/zuvio";
import { formatCoordinates } from "@/lib/zuvio";

interface MapPickerProps {
  initial: Coordinates | null;
  onPick: (coords: Coordinates) => void;
  onClose: () => void;
}

// 預設落在高科大楠梓校區
const DEFAULT_CENTER: Coordinates = { lat: 22.7257, lng: 120.3165 };
const DEFAULT_ZOOM = 17;
const PICK_ZOOM = 18;

const LAYERS = {
  street: {
    label: "地圖",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    label: "衛星",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
} as const;

type LayerKey = keyof typeof LAYERS;

function round6(value: number) {
  return Number(value.toFixed(6));
}

export default function MapPicker({ initial, onPick, onClose }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const [layer, setLayer] = useState<LayerKey>("satellite");
  const [center, setCenter] = useState<Coordinates>(initial ?? DEFAULT_CENTER);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 建立地圖（只跑一次）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = initial ?? DEFAULT_CENTER;
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: initial ? PICK_ZOOM : DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });
    map.on("move", () => {
      const c = map.getCenter();
      setCenter({ lat: round6(c.lat), lng: round6(c.lng) });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
    // initial 只在建立時使用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切換底圖
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    const def = LAYERS[layer];
    tileRef.current = L.tileLayer(def.url, {
      attribution: def.attribution,
      maxZoom: def.maxZoom,
    }).addTo(map);
  }, [layer]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setError("此瀏覽器不支援定位");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], PICK_ZOOM);
        setLocating(false);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? "定位權限被拒絕" : "無法取得目前位置");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="在地圖上選擇教室位置"
    >
      <div className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:h-[80vh] sm:rounded-2xl dark:bg-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <span className="font-medium text-zinc-900 dark:text-white">拖動地圖，把準星對準教室</span>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            關閉
          </button>
        </div>

        <div className="relative flex-1">
          <div ref={containerRef} className="h-full w-full" />
          {/* 準星：固定在地圖中央，不攔截觸控 */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-1/2">
            <div className="h-6 w-6 rounded-full border-2 border-red-500 bg-red-500/20" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
          </div>
          {/* 底圖切換與定位 */}
          <div className="absolute right-2 top-2 z-[400] flex flex-col gap-1">
            <div className="flex overflow-hidden rounded-md bg-white shadow dark:bg-zinc-700">
              {(Object.keys(LAYERS) as LayerKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLayer(key)}
                  className={`px-2 py-1 text-xs ${
                    layer === key
                      ? "bg-blue-600 text-white"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-600"
                  }`}
                >
                  {LAYERS[key].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              className="rounded-md bg-white px-2 py-1 text-xs text-zinc-700 shadow hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
            >
              {locating ? "定位中" : "目前位置"}
            </button>
          </div>
        </div>

        <div className="space-y-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
              {formatCoordinates(center)}
            </span>
            <button
              type="button"
              onClick={() => onPick(center)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              使用此位置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
