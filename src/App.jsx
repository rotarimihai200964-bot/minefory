import React, { useState } from 'react';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [servers, setServers] = useState([
    { id: 1, name: 'Survival SMP', type: 'Minecraft Java', status: 'Online', cpu: '42%', ram: '2.1 GB / 4 GB', ramWidth: '52%', icon: 'fa-cubes' },
    { id: 2, name: 'Creative', type: 'Minecraft Java', status: 'Offline', cpu: '0%', ram: '0 GB / 2 GB', ramWidth: '0%', icon: 'fa-wand-magic-sparkles' },
    { id: 3, name: 'Bedrock Hub', type: 'Minecraft Bedrock', status: 'Online', cpu: '18%', ram: '0.8 GB / 2 GB', ramWidth: '40%', icon: 'fa-gamepad' }
  ]);

  const toggleServer = (id) => {
    setServers(servers.map(server => {
      if (server.id === id) {
        const isOnline = server.status === 'Online';
        return {
          ...server,
          status: isOnline ? 'Offline' : 'Online',
          cpu: isOnline ? '0%' : '25%',
          ram: isOnline ? '0 GB / ' + server.ram.split('/')[1].trim() : '1.5 GB / ' + server.ram.split('/')[1].trim(),
          ramWidth: isOnline ? '0%' : '45%'
        };
      }
      return server;
    }));
  };

  const onlineCount = servers.filter(s => s.status === 'Online').length;
  const filteredServers = servers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen overflow-hidden bg-[#080c14] text-gray-100 font-sans">
      {/* FontAwesome injectat direct pentru iconițe */}
      <link rel="stylesheet" href="https://cloudflare.com" />
      {/* Script Tailwind administrat prin browser */}
      <script src="https://jsdelivr.net"></script>

      {/* SIDEBAR */}
      <div className="w-64 bg-[#0d1321] border-r border-gray-800 flex flex-col justify-between p-4 z-10">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 border-b border-gray-800 mb-6">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/30">
              <i class="fa-solid fa-bolt text-xl"></i>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide text-white">MINEFORY</h1>
              <p class="text-xs text-gray-500 uppercase tracking-widest font-semibold">Hosting Panel</p>
            </div>
          </div>

          <nav className="space-y-1">
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-600/10 text-indigo-400 font-medium transition-all">
              <i className="fa-solid fa-chart-pie"></i> Overview
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-white transition-all">
              <i className="fa-solid fa-server"></i> Servere <span className="ml-auto bg-gray-800 text-xs px-2 py-0.5 rounded-full text-gray-400">{servers.length}</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-white transition-all">
              <i className="fa-solid fa-users"></i> Utilizatori
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-white transition-all">
              <i className="fa-solid fa-gears"></i> Setări
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3 p-2 bg-gray-900/40 rounded-xl border border-gray-800/60">
          <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-md">
            MA
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">Minefory Admin</h4>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#080c14]">
        {/* TOPBAR */}
        <header className="h-20 border-b border-gray-800/60 flex items-center justify-between px-8 bg-[#0d1321]/40 backdrop-blur-md sticky top-0 z-20">
          <div className="relative w-80">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
            <input 
              type="text" 
              placeholder="Caută un server..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-gray-200 transition-all"
            />
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
            <i className="fa-solid fa-plus mr-2"></i> Creează Server
          </button>
        </header>

        {/* DASHBOARD BODY */}
        <main className="p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* STATS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-gray-900/70 backdrop-blur-md border border-gray-800/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Servere</p>
                <h3 className="text-3xl font-bold mt-1 text-white">{servers.length}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 text-lg"><i className="fa-solid fa-layer-group"></i></div>
            </div>
            <div className="p-5 rounded-2xl bg-gray-900/70 backdrop-blur-md border border-gray-800/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Servere Online</p>
                <h3 className="text-3xl font-bold mt-1 text-emerald-400">{onlineCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-lg"><i className="fa-solid fa-circle-check"></i></div>
            </div>
            <div className="p-5 rounded-2xl bg-gray-900/70 backdrop-blur-md border border-gray-800/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilizare CPU</p>
                <h3 className="text-3xl font-bold mt-1 text-white">{onlineCount > 0 ? "9%" : "0%"}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 text-lg"><i className="fa-solid fa-microchip"></i></div>
            </div>
            <div className="p-5 rounded-2xl bg-gray-900/70 backdrop-blur-md border border-gray-800/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Memorie RAM</p>
                <h3 className="text-3xl font-bold mt-1 text-white">{onlineCount > 0 ? "2.9 GB" : "0 GB"}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 text-lg"><i className="fa-solid fa-memory"></i></div>
            </div>
          </div>

          {/* SERVERS LIST */}
          <div>
            <h2 className="text-xl font-bold text-white mb-5">Serverele tale</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredServers.map((server) => (
                <div key={server.id} className="p-6 rounded-2xl bg-gray-900/70 backdrop-blur-md border border-gray-800/50 hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <i className={`fa-solid ${server.icon} text-indigo-400`}></i> {server.name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                        server.status === 'Online' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${server.status === 'Online' ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
                        {server.status}
                      </span>
                    </div>

                    <div className="space-y-3 my-5 text-sm text-gray-400">
                      <div>
                        <div className="flex justify-between text-xs mb-1"><span>CPU</span><span>{server.cpu}</span></div>
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: server.status === 'Online' ? server.cpu : '0%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1"><span>RAM</span><span>{server.ram}</span></div>
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: server.ramWidth }}></div>
                        </div>
                      </div>
