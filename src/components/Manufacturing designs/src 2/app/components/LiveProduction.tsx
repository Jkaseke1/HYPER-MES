import { Play, Circle } from 'lucide-react';

interface LiveProductionProps {
  activeStation: string;
  setActiveStation: (station: string) => void;
}

export function LiveProduction({ activeStation, setActiveStation }: LiveProductionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
          <h3 className="text-[13px] text-gray-900 uppercase tracking-wide">Live Production Floor</h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span>Status:</span>
          <span className="text-[#00d4aa]">Running</span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00d4aa] rounded flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
            <div>
              <p className="text-[15px] text-gray-900">{activeStation}</p>
              <p className="text-[11px] text-gray-500">Current active line on the floor</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Runtime</p>
            <p className="text-[15px] text-gray-900">07:34:12</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-200">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Throughput</p>
            <p className="text-[15px] text-gray-900">847 units/hr</p>
            <div className="h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-[#00d4aa] rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">OEE Score</p>
            <p className="text-[15px] text-gray-900">92.4%</p>
            <div className="h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '92%' }}></div>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Temp</p>
            <p className="text-[15px] text-gray-900">68°C</p>
            <div className="h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: '68%' }}></div>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Operators</p>
            <p className="text-[15px] text-gray-900">4 Active</p>
            <div className="flex gap-1 mt-2">
              <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center">MJ</div>
              <div className="w-5 h-5 rounded-full bg-purple-500 text-white text-[9px] flex items-center justify-center">RK</div>
              <div className="w-5 h-5 rounded-full bg-pink-500 text-white text-[9px] flex items-center justify-center">ST</div>
              <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center">AL</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
