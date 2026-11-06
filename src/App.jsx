import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, Box, ChevronDown, CircleHelp, Cpu, Database,
  HardDrive, LayoutDashboard, LogOut, Menu, Plus, Search, Server,
  Settings, ShieldCheck, Users, Wifi, X, Play, Square, RotateCw,
  Terminal, Zap, Eye, EyeOff, LockKeyhole, Mail,
  ArrowRight, KeyRound
} from 'lucide-react';

const initialServers = [
  { id: 'mf-001', name: 'Survival SMP', game: 'Minecraft Java', version: '1.21.4', status: 'Online', ram: 4, used: 2.1, cpu: 18, players: 12, address: 'play.minefory.ro:25565' },
  { id: 'mf-002', name: 'Creative', game: 'Minecraft Java', version: '1.20.4', status: 'Offline', ram: 3, used: 0, cpu: 0, players: 0, address: 'creative.minefory.ro:25565' },
  { id: 'mf-003', name: 'Bedrock Hub', game: 'Minecraft Bedrock', version: '1.21.50', status: 'Online', ram: 2, used: 0.8, cpu: 9, players: 5, address: 'bedrock.minefory.ro:19132' }
];

const Icon = ({ children, size=18 }) => <span className="icon"><span style={{display:'inline-flex'}}>{React.cloneElement(children, { size })}</span></span>;

function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('mf-demo-session') === 'active');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [servers, setServers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mf-servers')) || initialServers; }
    catch { return initialServers; }
  });
  const [page, setPage] = useState('Overview');
  const [selected, setSelected] = useState('mf-001');
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState('1.21.4');
  const [toast, setToast] = useState('');
  const [consoleInput, setConsoleInput] = useState('');
  const [logs, setLogs] = useState([
    '[INFO] Starting Minecraft server...',
    '[INFO] Loading properties',
    '[INFO] Preparing level "world"',
    '[INFO] Done! For help, type "help"'
  ]);

  useEffect(() => localStorage.setItem('mf-servers', JSON.stringify(servers)), [servers]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const current = servers.find(s => s.id === selected) || servers[0];
  const filtered = useMemo(() => servers.filter(s => s.name.toLowerCase().includes(query.toLowerCase())), [servers, query]);
  const online = servers.filter(s => s.status === 'Online').length;
  const totalRam = servers.reduce((n,s) => n+s.ram, 0);
  const usedRam = servers.reduce((n,s) => n+s.used, 0);

  function signIn(e) {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Completează adresa de e-mail și parola.');
      return;
    }
    sessionStorage.setItem('mf-demo-session', 'active');
    setLoginError('');
    setLoggedIn(true);
    setToast('Ai intrat în panelul demonstrativ.');
  }
  function signOut() {
    sessionStorage.removeItem('mf-demo-session');
    setLoggedIn(false);
    setLoginPassword('');
  }
  function changeStatus(id, status) {
    setServers(prev => prev.map(s => s.id === id ? {...s, status, cpu: status === 'Online' ? Math.max(s.cpu, 6) : 0, used: status === 'Online' ? Math.max(s.used, .4) : 0, players: status === 'Online' ? s.players : 0} : s));
    setToast(`Serverul a fost ${status === 'Online' ? 'pornit' : 'oprit'} (mod demo).`);
    if (id === selected) setLogs(prev => [...prev, `[PANEL] Server ${status === 'Online' ? 'started' : 'stopped'} (demo)`]);
  }
  function createServer(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const id = `mf-${String(Date.now()).slice(-5)}`;
    const item = { id, name: newName.trim(), game: 'Minecraft Java', version: newVersion, status: 'Offline', ram: 2, used: 0, cpu: 0, players: 0, address: `${newName.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.minefory.ro:25565` };
    setServers(prev => [...prev, item]);
    setSelected(id); setNewName(''); setShowCreate(false); setPage('Servers');
    setToast('Server demo creat cu succes.');
  }
  function sendCommand(e) {
    e.preventDefault();
    if (!consoleInput.trim()) return;
    setLogs(prev => [...prev, `> ${consoleInput}`, `[DEMO] Comanda "${consoleInput}" a fost trimisă doar în interfața demonstrativă.`]);
    setConsoleInput('');
  }

  const nav = [
    { label: 'Overview', icon: <LayoutDashboard/> },
    { label: 'Servers', icon: <Server/> },
    { label: 'Users', icon: <Users/> },
    { label: 'Settings', icon: <Settings/> }
  ];

  if (!loggedIn) return <Login email={loginEmail} setEmail={setLoginEmail} password={loginPassword} setPassword={setLoginPassword} showPassword={showPassword} setShowPassword={setShowPassword} error={loginError} onSubmit={signIn} onForgot={()=>setLoginError('Recuperarea parolei necesită configurarea unui backend de autentificare.')}/>;

  return <div className="app-shell">
    <aside className={`sidebar ${showMobile ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Zap size={21} fill="currentColor"/></div><div><b>MINEFORY</b><span>HOSTING PANEL</span></div><button className="mobile-close" onClick={()=>setShowMobile(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className="workspace"><span className="workspace-avatar">M</span><span><b>Minefory Host</b><small>Personal workspace</small></span><ChevronDown size={15}/></button>
      <div className="nav-label">MANAGEMENT</div>
      <nav>{nav.map(n=><button key={n.label} className={`nav-item ${page===n.label?'active':''}`} onClick={()=>{setPage(n.label);setShowMobile(false)}}><Icon>{n.icon}</Icon>{n.label}{n.label==='Servers'&&<span className="nav-count">{servers.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><b>Ai nevoie de ajutor?</b><p>Ghiduri și informații pentru panel.</p><button onClick={()=>setToast('Centrul de ajutor va fi disponibil în curând.')}>Deschide centrul de ajutor <span>↗</span></button></div><div className="profile"><div className="profile-avatar">M</div><div><b>{loginEmail || 'Minefory Admin'}</b><small>Administrator</small></div><button className="logout-btn" title="Deconectare" aria-label="Deconectare" onClick={signOut}><LogOut size={16}/></button></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="top-left"><button className="mobile-menu" onClick={()=>setShowMobile(true)}><Menu/></button><span className="crumb">Workspace</span><span className="slash">/</span><b>{page}</b></div><div className="top-actions"><div className="system-pill"><span className="pulse"></span> Toate sistemele funcționează</div><button className="icon-button" onClick={()=>setToast('Nu ai notificări noi.')}><Bell size={18}/><i/></button><div className="top-avatar">M</div></div></header>

      <div className="content">
        {page === 'Overview' && <>
          <div className="page-heading"><div><div className="eyebrow">BINE AI VENIT ÎNAPOI</div><h1>Dashboard</h1><p>O privire de ansamblu asupra serviciilor tale.</p></div><button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Creează server</button></div>
          <div className="stats-grid">
            <Stat icon={<Server/>} label="Total servere" value={servers.length} note={`${online} online`} tone="violet"/>
            <Stat icon={<Activity/>} label="Servere online" value={online} note="Stare în timp real (demo)" tone="green"/>
            <Stat icon={<Cpu/>} label="CPU utilizat" value={`${Math.round(servers.reduce((a,s)=>a+s.cpu,0)/Math.max(servers.length,1))}%`} note="Medie servere" tone="blue"/>
            <Stat icon={<Database/>} label="Memorie RAM" value={`${usedRam.toFixed(1)} GB`} note={`din ${totalRam} GB alocați`} tone="orange"/>
          </div>
          <div className="section-row"><div><h2>Serverele tale</h2><p>Gestionează instanțele de joc.</p></div><button className="text-btn" onClick={()=>setPage('Servers')}>Vezi toate <span>→</span></button></div>
          <div className="server-grid">{servers.slice(0,3).map(s=><ServerCard key={s.id} server={s} onOpen={()=>{setSelected(s.id);setPage('Servers')}} onToggle={()=>changeStatus(s.id,s.status==='Online'?'Offline':'Online')}/>)}</div>
          <div className="bottom-grid"><div className="panel-card"><div className="panel-title"><div><h3>Utilizare resurse</h3><p>Consumul total al serverelor demo</p></div><span className="period">ACUM</span></div><Resource label="RAM" used={usedRam} total={Math.max(totalRam,1)} unit="GB" color="purple"/><Resource label="CPU" used={servers.reduce((a,s)=>a+s.cpu,0)/Math.max(servers.length,1)} total={100} unit="%" color="blue"/><Resource label="Disk" used={18} total={100} unit="GB" color="orange"/></div><div className="panel-card activity-card"><div className="panel-title"><div><h3>Activitate recentă</h3><p>Ultimele evenimente din panel</p></div><span className="live-tag">LIVE DEMO</span></div><div className="activity-line"><span className="activity-dot green-dot"></span><div><b>Panelul este pregătit</b><small>Acum · Sistem</small></div></div><div className="activity-line"><span className="activity-dot purple-dot"></span><div><b>{servers.length} servere înregistrate</b><small>Acum · Servere</small></div></div><div className="activity-line"><span className="activity-dot blue-dot"></span><div><b>Workspace Minefory Host</b><small>Acum · Cont</small></div></div></div></div>
        </>}

        {page === 'Servers' && <><div className="page-heading"><div><div className="eyebrow">INFRASTRUCTURĂ</div><h1>Servere</h1><p>Administrează serverele tale de joc.</p></div><button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Creează server</button></div>
          <div className="toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Caută un server..."/></div><span className="muted">{filtered.length} servere</span></div>
          <div className="server-list">{filtered.map(s=><ServerCard key={s.id} server={s} onOpen={()=>setSelected(s.id)} selected={selected===s.id} onToggle={()=>changeStatus(s.id,s.status==='Online'?'Offline':'Online')}/>)}</div>
          {current && <div className="panel-card server-detail"><div className="detail-head"><div><div className="eyebrow">SERVER SELECTAT</div><h2>{current.name}</h2><p>{current.id} · {current.game} {current.version}</p></div><Status status={current.status}/></div><div className="detail-actions"><button className="small-btn green-action" onClick={()=>changeStatus(current.id,'Online')}><Play size={15}/> Start</button><button className="small-btn" onClick={()=>changeStatus(current.id,'Offline')}><Square size={15}/> Stop</button><button className="small-btn" onClick={()=>{setLogs(p=>[...p,'[PANEL] Restart requested (demo)']);changeStatus(current.id,'Online')}}><RotateCw size={15}/> Restart</button></div><div className="detail-metrics"><div><span>Adresa serverului</span><b>{current.address}</b></div><div><span>RAM alocat</span><b>{current.ram} GB</b></div><div><span>Jucători online</span><b>{current.players}</b></div></div><div className="console-head"><div><Terminal size={17}/><b>Consolă</b><span className="demo-label">SIMULARE</span></div><button className="clear-btn" onClick={()=>setLogs([])}>Curăță</button></div><div className="console-output">{logs.map((l,i)=><div key={i}>{l}</div>)}</div><form className="console-form" onSubmit={sendCommand}><span>$</span><input value={consoleInput} onChange={e=>setConsoleInput(e.target.value)} placeholder="Scrie o comandă..." /><button type="submit">Trimite</button></form></div>}
        </>}

        {page === 'Users' && <><div className="page-heading"><div><div className="eyebrow">CONTURI</div><h1>Utilizatori</h1><p>Utilizatorii din workspace-ul tău.</p></div><button className="primary-btn" onClick={()=>setToast('Invitațiile vor fi disponibile în versiunea următoare.')}><Plus size={17}/> Invită utilizator</button></div><div className="panel-card users-panel"><div className="user-row user-header"><span>UTILIZATOR</span><span>ROL</span><span>STATUS</span><span>ACȚIUNI</span></div><div className="user-row"><div className="user-info"><div className="profile-avatar">M</div><div><b>Minefory Admin</b><small>{loginEmail || 'admin@minefory.ro'}</small></div></div><span className="role-tag">Owner</span><span className="user-active">● Activ</span><button className="more-btn" onClick={()=>setToast('Acesta este contul principal.')}>•••</button></div></div></>}

        {page === 'Settings' && <><div className="page-heading"><div><div className="eyebrow">PREFERINȚE</div><h1>Setări</h1><p>Configurarea workspace-ului Minefory Host.</p></div></div><div className="panel-card settings-panel"><div className="setting-row"><div className="setting-symbol"><ShieldCheck/></div><div><b>Numele workspace-ului</b><p>Minefory Host</p></div><button className="small-btn" onClick={()=>setToast('Editarea numelui va fi disponibilă în curând.')}>Editează</button></div><div className="setting-row"><div className="setting-symbol"><Wifi/></div><div><b>Regiune</b><p>Europe · România (afișare demo)</p></div><span className="muted">Demo</span></div><div className="setting-row"><div className="setting-symbol"><HardDrive/></div><div><b>Stocare</b><p>Resurse locale simulate în browser</p></div><span className="muted">Local</span></div></div></>}
        <footer>© 2026 <b>Minefory Host</b> · Panel demonstrativ · Nu este conectat la un server real.</footer>
      </div>
    </main>
    {showCreate && <div className="modal-backdrop" onClick={()=>setShowCreate(false)}><form className="modal" onSubmit={createServer} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">CONFIGURARE</div><h2>Creează un server</h2><p>Adaugă o instanță demo în panel.</p></div><button type="button" className="icon-button" onClick={()=>setShowCreate(false)}><X/></button></div><label>Numele serverului<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ex: Survival SMP" required/></label><label>Versiune Minecraft<select value={newVersion} onChange={e=>setNewVersion(e.target.value)}><option>1.21.4</option><option>1.21.1</option><option>1.20.4</option><option>1.19.4</option><option>1.16.5</option></select></label><div className="modal-note"><Zap size={16}/> Serverul va fi creat în modul demonstrativ, fără resurse reale.</div><div className="modal-actions"><button type="button" className="small-btn" onClick={()=>setShowCreate(false)}>Anulează</button><button className="primary-btn" type="submit"><Plus size={16}/> Creează server</button></div></form></div>}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}

function Stat({icon,label,value,note,tone}) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div> }
function Login({email,setEmail,password,setPassword,showPassword,setShowPassword,error,onSubmit,onForgot}) {
  return <main className="login-screen">
    <div className="login-glow login-glow-one"/><div className="login-glow login-glow-two"/>
    <div className="login-brand"><div className="brand-mark"><Zap size={21} fill="currentColor"/></div><div><b>MINEFORY</b><span>GAME SERVER HOSTING</span></div></div>
    <section className="login-card">
      <div className="login-emblem"><Server size={23}/><span/></div>
      <div className="eyebrow">BINE AI VENIT LA MINEFORY</div>
      <h1>Intră în panelul tău</h1>
      <p className="login-subtitle">Gestionează serverele și resursele tale dintr-un singur loc.</p>
      <form className="login-form" onSubmit={onSubmit}>
        <label htmlFor="login-email">Adresă de e-mail</label>
        <div className="login-input-wrap"><Mail size={17}/><input id="login-email" type="email" autoComplete="username" placeholder="nume@exemplu.ro" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        <div className="password-label"><label htmlFor="login-password">Parolă</label><button type="button" className="forgot-link" onClick={onForgot}>Ai uitat parola?</button></div>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="login-password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Introdu parola" value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" className="password-toggle" aria-label={showPassword?'Ascunde parola':'Afișează parola'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
        {error && <div className="login-error">{error}</div>}
        <button className="login-submit" type="submit">Intră în panel <ArrowRight size={17}/></button>
      </form>
      <div className="login-demo"><KeyRound size={15}/><span><b>Mod demonstrativ</b> · Folosește orice e-mail și parolă pentru previzualizare.</span></div>
    </section>
    <div className="login-footer"><span><i/> Infrastructură monitorizată</span><span>© 2026 Minefory Host</span></div>
  </main>;
}
function Status({status}) { return <span className={`status ${status==='Online'?'online':'offline'}`}><i/>{status}</span> }
function Resource({label,used,total,unit,color}) { const pct=Math.min(100,Math.round(used/total*100)); return <div className="resource"><div className="resource-top"><b>{label}</b><span>{used.toFixed(1)} {unit} <small>/ {total} {unit}</small></span></div><div className="progress"><i className={color} style={{width:`${pct}%`}}/></div></div> }
function ServerCard({server,onOpen,onToggle,selected=false}) { return <div className={`server-card ${selected?'selected':''}`}><div className="server-card-top"><div className="server-symbol"><Box size={20}/></div><Status status={server.status}/></div><button className="server-name" onClick={onOpen}>{server.name}<span>↗</span></button><div className="server-sub">{server.game} · {server.version}</div><div className="server-stats"><div><Cpu size={14}/><span>{server.cpu}% CPU</span></div><div><Database size={14}/><span>{server.used} / {server.ram} GB RAM</span></div></div><div className="mini-progress"><i style={{width:`${Math.min(100,server.used/server.ram*100)}%`}}/></div><div className="server-card-bottom"><span><Users size={14}/> {server.players} jucători</span><button className={`power-btn ${server.status==='Online'?'is-on':''}`} onClick={onToggle}>{server.status==='Online'?<Square size={14}/>:<Play size={14}/>} {server.status==='Online'?'Stop':'Start'}</button></div></div> }

export default App;
