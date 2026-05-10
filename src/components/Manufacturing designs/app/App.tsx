import { Save, Plus, RefreshCw, Download, Upload, Filter, MoreHorizontal, Calendar, Package, Truck, ClipboardList, BarChart3, X } from 'lucide-react';
import { ProductionOrdersTable } from './components/ProductionOrdersTable';
import { GoodsReceivedForm } from './components/GoodsReceivedForm';
import { InventoryTransactions } from './components/InventoryTransactions';
import { useState } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('production-orders');
  const [showGRNForm, setShowGRNForm] = useState(false);

  return (
    <div className="size-full bg-[#e8eaed] flex flex-col">
      {/* Top Menu Bar - SAP Style */}
      <div className="bg-[#2c3e50] text-white px-4 py-1 flex items-center justify-between text-[12px]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#3498db] flex items-center justify-center text-[10px] font-bold">
              AM
            </div>
            <span className="font-semibold">ACME Manufacturing</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[#3498db] transition-colors">File</a>
            <a href="#" className="hover:text-[#3498db] transition-colors">Edit</a>
            <a href="#" className="hover:text-[#3498db] transition-colors">View</a>
            <a href="#" className="hover:text-[#3498db] transition-colors">Logistics</a>
            <a href="#" className="hover:text-[#3498db] transition-colors">Production</a>
            <a href="#" className="hover:text-[#3498db] transition-colors">Finance</a>
            <a href="#" className="hover:text-[#3498db] transition-colors">Reports</a>
            <a href="#" className="hover:text-[#3498db] transition-colors">Tools</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span>User: J.Doe</span>
          <span>|</span>
          <span>Plant: 1000</span>
          <span>|</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-[220px] bg-white border-r border-gray-300 flex flex-col">
          <div className="p-3 border-b border-gray-300 bg-gray-50">
            <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Menu</h3>
          </div>
          <nav className="flex-1 overflow-auto">
            <div className="py-1">
              <div className="px-3 py-2 bg-gray-100">
                <p className="text-[10px] font-semibold text-gray-600 uppercase">Production</p>
              </div>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('production-orders'); }}
                className={`block px-4 py-2 text-[12px] ${activeTab === 'production-orders' ? 'bg-[#3498db] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Production Orders
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
              >
                Work Centers
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
              >
                Capacity Planning
              </a>
            </div>
            <div className="py-1 border-t border-gray-200">
              <div className="px-3 py-2 bg-gray-100">
                <p className="text-[10px] font-semibold text-gray-600 uppercase">Inventory</p>
              </div>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('goods-received'); }}
                className={`block px-4 py-2 text-[12px] ${activeTab === 'goods-received' ? 'bg-[#3498db] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Goods Receipt
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('inventory-transactions'); }}
                className={`block px-4 py-2 text-[12px] ${activeTab === 'inventory-transactions' ? 'bg-[#3498db] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Stock Transactions
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
              >
                Stock Overview
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
              >
                Material Master
              </a>
            </div>
            <div className="py-1 border-t border-gray-200">
              <div className="px-3 py-2 bg-gray-100">
                <p className="text-[10px] font-semibold text-gray-600 uppercase">Quality</p>
              </div>
              <a
                href="#"
                className="block px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
              >
                Inspection Lots
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
              >
                Quality Notifications
              </a>
            </div>
            <div className="py-1 border-t border-gray-200">
              <div className="px-3 py-2 bg-gray-100">
                <p className="text-[10px] font-semibold text-gray-600 uppercase">Reports</p>
              </div>
              <a
                href="#"
                className="block px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
              >
                Production Dashboard
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-100"
              >
                Stock Analysis
              </a>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Content Header */}
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[16px] font-semibold text-gray-800">
                  {activeTab === 'production-orders' && 'Production Orders'}
                  {activeTab === 'goods-received' && 'Goods Receipt'}
                  {activeTab === 'inventory-transactions' && 'Inventory Stock Transactions'}
                </h1>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {activeTab === 'production-orders' && 'Manage and monitor production orders'}
                  {activeTab === 'goods-received' && 'Record incoming materials and goods'}
                  {activeTab === 'inventory-transactions' && 'View and manage stock movements'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-[12px] text-gray-700 rounded flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
                <button className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-[12px] text-gray-700 rounded flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
                {activeTab === 'goods-received' && (
                  <button
                    onClick={() => setShowGRNForm(!showGRNForm)}
                    className="px-3 py-1.5 bg-[#3498db] hover:bg-[#2980b9] text-white text-[12px] rounded flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New GRN
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="bg-gray-100 border-b border-gray-300 px-4 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('production-orders')}
              className={`px-4 py-2 text-[12px] border-t-2 ${
                activeTab === 'production-orders'
                  ? 'bg-white border-[#3498db] text-gray-900'
                  : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
              }`}
            >
              Production Orders
            </button>
            <button
              onClick={() => setActiveTab('goods-received')}
              className={`px-4 py-2 text-[12px] border-t-2 ${
                activeTab === 'goods-received'
                  ? 'bg-white border-[#3498db] text-gray-900'
                  : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
              }`}
            >
              Goods Receipt
            </button>
            <button
              onClick={() => setActiveTab('inventory-transactions')}
              className={`px-4 py-2 text-[12px] border-t-2 ${
                activeTab === 'inventory-transactions'
                  ? 'bg-white border-[#3498db] text-gray-900'
                  : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
              }`}
            >
              Stock Transactions
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-white">
            {activeTab === 'production-orders' && <ProductionOrdersTable />}
            {activeTab === 'goods-received' && <GoodsReceivedForm show={showGRNForm} onClose={() => setShowGRNForm(false)} />}
            {activeTab === 'inventory-transactions' && <InventoryTransactions />}
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <div className="bg-[#34495e] text-white px-4 py-1 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-4">
          <span>System Status: Online</span>
          <span>|</span>
          <span>Server: PROD-01</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Version 2.4.1</span>
        </div>
      </div>
    </div>
  );
}