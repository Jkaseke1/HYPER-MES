import { Package, Users, FileText, Settings, Search, Bell, ChevronRight, Circle, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { ProductionFloor } from './components/ProductionFloor';
import { OperationsTrends } from './components/OperationsTrends';
import { StockAlerts } from './components/StockAlerts';
import { LiveProduction } from './components/LiveProduction';
import { useState } from 'react';

export default function App() {
  const [activeStation, setActiveStation] = useState('Assembly Line 3');

  return (
    <div className="size-full bg-[#f8f9fb] flex">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[#0c1f2e] flex flex-col">
        <div className="p-5 pb-4">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 bg-[#00d4aa] rounded flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
            </div>
            <div className="leading-tight">
              <h1 className="text-[13px] tracking-wide text-white/90 uppercase">ACME</h1>
              <p className="text-[11px] text-white/50 uppercase tracking-wider">Manufacturing Systems</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded bg-white/5 text-white/90 text-[13px]">
            <div className="w-1 h-1 rounded-full bg-[#00d4aa]"></div>
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            Inventory Management
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            Equipment & MTTR
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            Work Scheduling
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            Usage Badges
          </a>

          <div className="my-3 border-t border-white/5"></div>

          <div className="px-3 mb-2">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Operations</p>
          </div>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            SKU Maintenance / Inventory
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            Stock Take
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            Quality Inspections
          </a>

          <div className="my-3 border-t border-white/5"></div>

          <div className="px-3 mb-2">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Production Control</p>
          </div>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            FIFO & FEFO
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 mb-0.5 text-white/50 hover:text-white/70 text-[13px] transition-colors">
            <div className="w-1 h-1 rounded-full bg-transparent"></div>
            Day Cut
          </a>
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 bg-[#00d4aa]/20 rounded-full flex items-center justify-center text-[11px] text-[#00d4aa]">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/80 truncate">John Doe</p>
              <p className="text-[10px] text-white/40">Floor Manager</p>
            </div>
            <Settings className="w-4 h-4 text-white/30" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-7 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[22px] text-gray-900 tracking-tight">Operations Command Center</h2>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-[12px]">
                  <Circle className="w-3 h-3 fill-[#00d4aa] text-[#00d4aa]" />
                  <span className="text-gray-500">Stations:</span>
                  <span className="text-gray-900">2</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px]">
                  <Circle className="w-3 h-3 fill-blue-500 text-blue-500" />
                  <span className="text-gray-500">Active Probabilities:</span>
                  <span className="text-gray-900">1</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px]">
                  <Circle className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span className="text-gray-500">Active:</span>
                  <span className="text-gray-900">1</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-2">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">Updated 10:52:15</p>
                <p className="text-[12px] text-gray-600">Sunday, May 10</p>
              </div>
              <button className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                <Search className="w-4 h-4 text-gray-500" />
              </button>
              <button className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 relative">
                <Bell className="w-4 h-4 text-gray-500" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              </button>
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-[12px] text-white">
                JD
              </div>
            </div>
          </div>
        </header>

        <div className="p-7">
          {/* Live Production Floor */}
          <LiveProduction activeStation={activeStation} setActiveStation={setActiveStation} />

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-5 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Current Cycle</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-[32px] text-gray-900 tracking-tight">01</h3>
                <TrendingUp className="w-4 h-4 text-green-500 mb-1.5" />
              </div>
              <p className="text-[12px] text-gray-500 mt-1">Running smooth</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Load Complete</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-[32px] text-gray-900 tracking-tight">0</h3>
                <span className="text-[12px] text-gray-400 mb-1.5">pending</span>
              </div>
              <p className="text-[12px] text-gray-500 mt-1">No loads waiting</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Load Exceptions</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-[32px] text-gray-900 tracking-tight">0</h3>
                <span className="text-[12px] text-green-500 mb-1.5">clear</span>
              </div>
              <p className="text-[12px] text-gray-500 mt-1">All within spec</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Defect Rate</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-[32px] text-gray-900 tracking-tight">0%</h3>
                <TrendingDown className="w-4 h-4 text-green-500 mb-1.5" />
              </div>
              <p className="text-[12px] text-gray-500 mt-1">Target: &lt;2%</p>
            </div>
          </div>

          {/* Charts and Alerts */}
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2">
              <OperationsTrends />
            </div>
            <div className="space-y-5">
              <StockAlerts />
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] text-gray-900 tracking-tight">Pending Approvals</h3>
                  <span className="text-[11px] text-gray-400">3 items</span>
                </div>
                <div className="text-[12px] text-gray-500 text-center py-8">
                  No pending approvals
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}