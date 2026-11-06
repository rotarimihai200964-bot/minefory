import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, Box, ChevronDown, CircleHelp, Cpu, Database,
  HardDrive, LayoutDashboard, LogOut, Menu, Plus, Search, Server,
  Settings, ShieldCheck, Users, Wifi, X, Play, Square, RotateCw,
  Terminal, Zap, Eye, EyeOff, LockKeyhole, Mail, Trash2,
  ArrowRight, KeyRound, ArrowLeft, FileText, Folder, Plug,
  Download, Save, ChevronRight, Code2
} from 'lucide-react';

const sampleServerIds = new Set(['mf-001', 'mf-002', 'mf-003']);
const minecraftVersions = ['1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.2', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.8'];
const javaVersions = ['Java 25', 'Java 21', 'Java 17', 'Java 11', 'Java 8'];
const pluginCatalog = [
  { id: 'essentialsx', name: 'EssentialsX', description: 'Comenzi uzuale, teleportare și instrumente pentru administrare.', category: 'Administrare' },
  { id: 'luckperms', name: 'LuckPerms', description: 'Gestionează grupuri, roluri și permisiuni.', category: 'Permisiuni' },
  { id: 'worldedit', name: 'WorldEdit', description: 'Construiește și editează rapid lumea jocului.', category: 'Construcții' },
  { id: 'vault', name: 'Vault', description: 'API de economie și permisiuni pentru alte pluginuri.', category: 'Economie' },
  { id: 'placeholderapi', name: 'PlaceholderAPI', description: 'Placeholdere dinamice pentru pluginuri compatibile.', category: 'Utilitare' },
  { id: 'viaversion', name: 'ViaVersion', description: 'Compatibilitate pentru mai multe versiuni de client.', category: 'Compatibilitate' },
  { id: 'coreprotect', name: 'CoreProtect', description: 'Jurnal și rollback pentru modificările din lume.', category: 'Protecție' },
  { id: 'griefprevention', name: 'GriefPrevention', description: 'Protejează terenurile construite de jucători.', category: 'Protecție' }
];
const starterFiles = [
  { path: 'server.properties', content: '# Configurare server Minecraft\ngamemode=survival\nmax-players=20\nmotd=Minefory Server\nonline-mode=true\n' },
  { path: 'eula.txt', content: 'eula=false\n' },
  { path: 'whitelist.json', content: '[]\n' },
  { path: 'ops.json', content: '[]\n' },
  { path: 'plugins/README.txt', content: 'Pluginurile serverului apar în acest folder după instalare.\n' }
];

const Icon = ({ children, size=18 }) => <span className="icon"><span style={{display:'inline-flex'}}>{React.cloneElement(children, { size })}</span></span>;

function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('mf-demo-session') === 'active');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [servers, setServers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mf-servers'));
      return Array.isArray(saved) ? saved.filter(server => server && !sampleServerIds.has(server.id)) : [];
    } catch { return []; }
  });
  const [page, setPage] = useState('Overview');
  const [selected, setSelected] = useState('');
  const [welcomeServer, setWelcomeServer] = useState('');
  const [serverToDelete, setServerToDelete] = useState(null);
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
  useEffect(() => {
    if (!welcomeServer) return;
    const timer = setTimeout(() => {
      setPage('Server detail');
      setWelcomeServer('');
    }, 1100);
    return () => clearTimeout(timer);
  }, [welcomeServer]);

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
  function openServer(server) {
    setSelected(server.id);
    setWelcomeServer(server.name);
  }
  function deleteServer() {
    if (!serverToDelete) return;
    const remaining = servers.filter(server => server.id !== serverToDelete.id);
    setServers(remaining);
    if (selected === serverToDelete.id) {
      setSelected(remaining[0]?.id || '');
      if (page === 'Server detail') setPage('Servers');
    }
    setServerToDelete(null);
    setToast(`Serverul „${serverToDelete.name}” a fost șters.`);
  }
  function changeStatus(id, status) {
    setServers(prev => prev.map(s => s.id === id ? {...s, status, cpu: status === 'Online' ? Math.max(s.cpu, 6) : 0, used: status === 'Online' ? Math.max(s.used, .4) : 0, players: status === 'Online' ? s.players : 0} : s));
    setToast(`Serverul a fost ${status === 'Online' ? 'pornit' : 'oprit'} (mod demo).`);
    if (id === selected) setLogs(prev => [...prev, `[PANEL] Server ${status === 'Online' ? 'started' : 'stopped'} (demo)`]);
  }
  function updateServer(id, updates) {
    setServers(prev => prev.map(server => server.id === id ? { ...server, ...updates } : server));
  }
  function createServer(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const id = `mf-${String(Date.now()).slice(-5)}`;
    const item = { id, name: newName.trim(), game: 'Minecraft Java', version: newVersion, javaVersion: 'Java 21', software: 'Paper', plugins: [], files: starterFiles, status: 'Offline', ram: 2, used: 0, cpu: 0, players: 0, address: `${newName.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.minefory.ro:25565` };
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
      <nav>{nav.map(n=><button key={n.label} className={`nav-item ${(page===n.label || (page==='Server detail' && n.label==='Servers'))?'active':''}`} onClick={()=>{setPage(n.label);setShowMobile(false)}}><Icon>{n.icon}</Icon>{n.label}{n.label==='Servers'&&<span className="nav-count">{servers.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><b>Ai nevoie de ajutor?</b><p>Ghiduri și informații pentru panel.</p><button onClick={()=>setToast('Centrul de ajutor va fi disponibil în curând.')}>Deschide centrul de ajutor <span>↗</span></button></div><div className="profile"><div className="profile-avatar">M</div><div><b>{loginEmail || 'Minefory Admin'}</b><small>Administrator</small></div><button className="logout-btn" title="Deconectare" aria-label="Deconectare" onClick={signOut}><LogOut size={16}/></button></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="top-left"><button className="mobile-menu" onClick={()=>setShowMobile(true)}><Menu/></button><span className="crumb">Workspace</span><span className="slash">/</span><b>{page === 'Server detail' ? (current?.name || 'Server') : page}</b></div><div className="top-actions"><div className="system-pill"><span className="pulse"></span> Toate sistemele funcționează</div><button className="icon-button" onClick={()=>setToast('Nu ai notificări noi.')}><Bell size={18}/><i/></button><div className="top-avatar">M</div></div></header>

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
          {servers.length === 0 ? <EmptyServers onCreate={()=>setShowCreate(true)}/> : <div className="server-grid">{servers.slice(0,3).map(s=><ServerCard key={s.id} server={s} onOpen={()=>openServer(s)} onDelete={()=>setServerToDelete(s)} onToggle={()=>changeStatus(s.id,s.status==='Online'?'Offline':'Online')}/>)}</div>}
          <div className="bottom-grid"><div className="panel-card"><div className="panel-title"><div><h3>Utilizare resurse</h3><p>Consumul total al serverelor demo</p></div><span className="period">ACUM</span></div><Resource label="RAM" used={usedRam} total={totalRam} unit="GB" color="purple"/><Resource label="CPU" used={servers.reduce((a,s)=>a+s.cpu,0)/Math.max(servers.length,1)} total={100} unit="%" color="blue"/><Resource label="Disk" used={servers.length ? 18 : 0} total={100} unit="GB" color="orange"/></div><div className="panel-card activity-card"><div className="panel-title"><div><h3>Activitate recentă</h3><p>Ultimele evenimente din panel</p></div><span className="live-tag">LIVE DEMO</span></div><div className="activity-line"><span className="activity-dot green-dot"></span><div><b>Panelul este pregătit</b><small>Acum · Sistem</small></div></div><div className="activity-line"><span className="activity-dot purple-dot"></span><div><b>{servers.length} servere înregistrate</b><small>Acum · Servere</small></div></div><div className="activity-line"><span className="activity-dot blue-dot"></span><div><b>Workspace Minefory Host</b><small>Acum · Cont</small></div></div></div></div>
        </>}

        {page === 'Servers' && <><div className="page-heading"><div><div className="eyebrow">INFRASTRUCTURĂ</div><h1>Servere</h1><p>Administrează serverele tale de joc.</p></div><button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Creează server</button></div>
          <div className="toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Caută un server..."/></div><span className="muted">{filtered.length} servere</span></div>
          {filtered.length > 0 ? <div className="server-list">{filtered.map(s=><ServerCard key={s.id} server={s} onOpen={()=>openServer(s)} onDelete={()=>setServerToDelete(s)} onToggle={()=>changeStatus(s.id,s.status==='Online'?'Offline':'Online')}/>)}</div> : <EmptyServers onCreate={()=>setShowCreate(true)} searching={servers.length > 0}/>}
        </>}

        {page === 'Server detail' && current && <ServerDetail server={current} logs={logs} consoleInput={consoleInput} setConsoleInput={setConsoleInput} onBack={()=>setPage('Servers')} onDelete={()=>setServerToDelete(current)} onStatus={status=>changeStatus(current.id,status)} onRestart={()=>{setLogs(p=>[...p,'[PANEL] Restart requested (demo)']);changeStatus(current.id,'Online')}} onClearLogs={()=>setLogs([])} onCommand={sendCommand} onUpdate={updates=>updateServer(current.id,updates)} onToast={setToast}/>}

        {page === 'Users' && <><div className="page-heading"><div><div className="eyebrow">CONTURI</div><h1>Utilizatori</h1><p>Utilizatorii din workspace-ul tău.</p></div><button className="primary-btn" onClick={()=>setToast('Invitațiile vor fi disponibile în versiunea următoare.')}><Plus size={17}/> Invită utilizator</button></div><div className="panel-card users-panel"><div className="user-row user-header"><span>UTILIZATOR</span><span>ROL</span><span>STATUS</span><span>ACȚIUNI</span></div><div className="user-row"><div className="user-info"><div className="profile-avatar">M</div><div><b>Minefory Admin</b><small>{loginEmail || 'admin@minefory.ro'}</small></div></div><span className="role-tag">Owner</span><span className="user-active">● Activ</span><button className="more-btn" onClick={()=>setToast('Acesta este contul principal.')}>•••</button></div></div></>}

        {page === 'Settings' && <><div className="page-heading"><div><div className="eyebrow">PREFERINȚE</div><h1>Setări</h1><p>Configurarea workspace-ului Minefory Host.</p></div></div><div className="panel-card settings-panel"><div className="setting-row"><div className="setting-symbol"><ShieldCheck/></div><div><b>Numele workspace-ului</b><p>Minefory Host</p></div><button className="small-btn" onClick={()=>setToast('Editarea numelui va fi disponibilă în curând.')}>Editează</button></div><div className="setting-row"><div className="setting-symbol"><Wifi/></div><div><b>Regiune</b><p>Europe · România (afișare demo)</p></div><span className="muted">Demo</span></div><div className="setting-row"><div className="setting-symbol"><HardDrive/></div><div><b>Stocare</b><p>Resurse locale simulate în browser</p></div><span className="muted">Local</span></div></div></>}
        <footer>© 2026 <b>Minefory Host</b> · Panel demonstrativ · Nu este conectat la un server real.</footer>
      </div>
    </main>
    {showCreate && <div className="modal-backdrop" onClick={()=>setShowCreate(false)}><form className="modal" onSubmit={createServer} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">CONFIGURARE</div><h2>Creează un server</h2><p>Adaugă o instanță demo în panel.</p></div><button type="button" className="icon-button" onClick={()=>setShowCreate(false)}><X/></button></div><label>Numele serverului<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ex: Survival SMP" required/></label><label>Versiune Minecraft<select value={newVersion} onChange={e=>setNewVersion(e.target.value)}>{minecraftVersions.map(version=><option key={version}>{version}</option>)}</select></label><div className="modal-note"><Zap size={16}/> Serverul va fi creat în modul demonstrativ, fără resurse reale.</div><div className="modal-actions"><button type="button" className="small-btn" onClick={()=>setShowCreate(false)}>Anulează</button><button className="primary-btn" type="submit"><Plus size={16}/> Creează server</button></div></form></div>}
    {serverToDelete && <div className="modal-backdrop" onClick={()=>setServerToDelete(null)}><div className="modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title" onClick={e=>e.stopPropagation()}><div className="delete-icon"><Trash2 size={20}/></div><h2 id="delete-title">Ștergi serverul?</h2><p>Serverul <b>{serverToDelete.name}</b> va fi eliminat din lista ta. Acțiunea nu poate fi anulată.</p><div className="modal-actions"><button className="small-btn" onClick={()=>setServerToDelete(null)}>Anulează</button><button className="danger-btn" onClick={deleteServer}><Trash2 size={15}/> Șterge serverul</button></div></div></div>}
    {welcomeServer && <div className="welcome-overlay" role="status" aria-live="polite"><div className="welcome-content"><div className="welcome-mark"><Zap size={25} fill="currentColor"/></div><span className="eyebrow">MINEFORY HOST</span><h2>Bun venit pe Minefory</h2><p>Se deschide serverul <b>{welcomeServer}</b></p><div className="welcome-loader"><i/></div></div></div>}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}

function Stat({icon,label,value,note,tone}) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div> }
function EmptyServers({onCreate,searching=false}) {
  return <div className="empty-state">
    <div className="empty-state-icon"><Server size={22}/></div>
    <h3>{searching ? 'Niciun server găsit' : 'Lista ta de servere este goală'}</h3>
    <p>{searching ? 'Încearcă alt termen de căutare.' : 'Creează primul server ca să începi să-ți gestionezi infrastructura.'}</p>
    {!searching && <button className="primary-btn" onClick={onCreate}><Plus size={16}/> Creează primul server</button>}
  </div>;
}
function Login({email,setEmail,password,setPassword,showPassword,setShowPassword,error,onSubmit,onForgot}) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  function handleSubmit(e) {
    if (mode === 'register') {
      e.preventDefault();
      if (!name.trim()) {
        setFormError('Completează numele tău.');
        return;
      }
      if (password.length < 8) {
        setFormError('Parola trebuie să aibă cel puțin 8 caractere.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Parolele nu coincid.');
        return;
      }
      setFormError('');
    }
    onSubmit(e);
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setFormError('');
    setConfirmPassword('');
  }

  const isRegister = mode === 'register';
  return <main className="login-screen">
    <div className="login-glow login-glow-one"/><div className="login-glow login-glow-two"/>
    <div className="login-brand"><div className="brand-mark"><Zap size={21} fill="currentColor"/></div><div><b>MINEFORY</b><span>GAME SERVER HOSTING</span></div></div>
    <section className="login-card">
      <div className="login-emblem"><Server size={23}/><span/></div>
      <div className="eyebrow">{isRegister ? 'ÎNCEPE CU MINEFORY' : 'BINE AI VENIT LA MINEFORY'}</div>
      <h1>{isRegister ? 'Creează-ți contul' : 'Intră în panelul tău'}</h1>
      <p className="login-subtitle">{isRegister ? 'Creează un cont pentru a-ți administra serverele de joc.' : 'Gestionează serverele și resursele tale dintr-un singur loc.'}</p>
      <form className="login-form" onSubmit={handleSubmit}>
        {isRegister && <>
          <label htmlFor="register-name">Numele tău</label>
          <div className="login-input-wrap"><Users size={17}/><input id="register-name" autoComplete="name" placeholder="Nume și prenume" value={name} onChange={e=>setName(e.target.value)} required/></div>
        </>}
        <label htmlFor="login-email">Adresă de e-mail</label>
        <div className="login-input-wrap"><Mail size={17}/><input id="login-email" type="email" autoComplete="username" placeholder="nume@exemplu.ro" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        <div className="password-label"><label htmlFor="login-password">Parolă</label>{!isRegister && <button type="button" className="forgot-link" onClick={onForgot}>Ai uitat parola?</button>}</div>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="login-password" type={showPassword?'text':'password'} autoComplete={isRegister?'new-password':'current-password'} minLength={isRegister?8:undefined} placeholder={isRegister?'Minimum 8 caractere':'Introdu parola'} value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" className="password-toggle" aria-label={showPassword?'Ascunde parola':'Afișează parola'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
        {isRegister && <>
          <label htmlFor="confirm-password">Confirmă parola</label>
          <div className="login-input-wrap"><LockKeyhole size={17}/><input id="confirm-password" type={showPassword?'text':'password'} autoComplete="new-password" placeholder="Introdu din nou parola" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/></div>
        </>}
        {(formError || (!isRegister && error)) && <div className="login-error">{formError || error}</div>}
        <button className="login-submit" type="submit">{isRegister ? 'Creează cont demo' : 'Intră în panel'} <ArrowRight size={17}/></button>
      </form>
      <div className="auth-switch">{isRegister ? 'Ai deja un cont?' : 'Nu ai încă un cont?'} <button type="button" onClick={()=>switchMode(isRegister?'login':'register')}>{isRegister ? 'Autentifică-te' : 'Creează cont'}</button></div>
      <div className="login-demo"><KeyRound size={15}/><span><b>Mod demonstrativ</b> · {isRegister ? 'Contul nu este salvat și nu va putea fi folosit după reîncărcare.' : 'Folosește orice e-mail și parolă pentru previzualizare.'}</span></div>
    </section>
    <div className="login-footer"><span><i/> Infrastructură monitorizată</span><span>© 2026 Minefory Host</span></div>
  </main>;
}
function Status({status}) { return <span className={`status ${status==='Online'?'online':'offline'}`}><i/>{status}</span> }
function Resource({label,used,total,unit,color}) { const pct=total > 0 ? Math.min(100,Math.round(used/total*100)) : 0; return <div className="resource"><div className="resource-top"><b>{label}</b><span>{used.toFixed(1)} {unit} <small>/ {total} {unit}</small></span></div><div className="progress"><i className={color} style={{width:`${pct}%`}}/></div></div> }
function ServerDetail({server,logs,consoleInput,setConsoleInput,onBack,onDelete,onStatus,onRestart,onClearLogs,onCommand,onUpdate,onToast}) {
  const [tab, setTab] = useState('Overview');
  const [minecraftVersion, setMinecraftVersion] = useState(server.version);
  const [javaVersion, setJavaVersion] = useState(server.javaVersion || 'Java 21');
  const [software, setSoftware] = useState(server.software || 'Paper');
  const [ram, setRam] = useState(server.ram || 2);
  const [serverName, setServerName] = useState(server.name);
  const [maxPlayers, setMaxPlayers] = useState(server.maxPlayers || '20');
  const [motd, setMotd] = useState(server.motd || 'Minefory Server');
  const [files, setFiles] = useState(server.files || starterFiles);
  const [currentFolder, setCurrentFolder] = useState('');
  const [openFile, setOpenFile] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [pluginSearch, setPluginSearch] = useState('');
  const installedPlugins = server.plugins || [];

  useEffect(() => {
    setMinecraftVersion(server.version);
    setJavaVersion(server.javaVersion || 'Java 21');
    setSoftware(server.software || 'Paper');
    setRam(server.ram || 2);
    setServerName(server.name);
    setMaxPlayers(server.maxPlayers || '20');
    setMotd(server.motd || 'Minefory Server');
    setFiles(server.files || starterFiles);
  }, [server.id, server.version, server.javaVersion, server.software, server.ram, server.name, server.maxPlayers, server.motd, server.files]);

  const directories = [...new Set(files.map(file => {
    const remainder = file.path.slice(currentFolder.length).replace(/^\//, '');
    const separator = remainder.indexOf('/');
    return separator > -1 ? remainder.slice(0, separator) : '';
  }).filter(Boolean))].sort();
  const visibleFiles = files.filter(file => {
    const remainder = file.path.slice(currentFolder.length).replace(/^\//, '');
    return remainder && !remainder.includes('/') && remainder.toLowerCase().includes(fileSearch.toLowerCase());
  });
  const visiblePlugins = pluginCatalog.filter(plugin => `${plugin.name} ${plugin.description} ${plugin.category}`.toLowerCase().includes(pluginSearch.toLowerCase()));
  const selectedFile = files.find(file => file.path === openFile);

  function saveSettings(e) {
    e.preventDefault();
    const properties = `# Configurare server Minecraft\ngamemode=survival\nmax-players=${maxPlayers}\nmotd=${motd}\nonline-mode=true\n`;
    const nextFiles = files.some(file => file.path === 'server.properties')
      ? files.map(file => file.path === 'server.properties' ? { ...file, content: properties } : file)
      : [...files, { path: 'server.properties', content: properties }];
    setFiles(nextFiles);
    onUpdate({ name: serverName.trim() || server.name, version: minecraftVersion, javaVersion, software, ram, used: Math.min(server.used, ram), maxPlayers, motd, files: nextFiles });
    onToast('Setările serverului au fost salvate local (demo).');
  }
  function addRam() {
    if (server.ram >= 32) {
      onToast('Serverele demo pot avea până la 32 GB RAM.');
      return;
    }
    const nextRam = Math.min(32, server.ram + 1);
    setRam(nextRam);
    onUpdate({ ram: nextRam });
    onToast(`Alocarea a crescut la ${nextRam} GB RAM (demo).`);
  }
  function changeFileContent(content) {
    setFiles(prev => prev.map(file => file.path === openFile ? { ...file, content } : file));
  }
  function saveFiles() {
    onUpdate({ files });
    onToast('Fișierele au fost salvate local (demo).');
  }
  function addFile() {
    const path = `${currentFolder}${currentFolder ? '/' : ''}nou.txt`;
    if (files.some(file => file.path === path)) {
      onToast('Fișierul nou.txt există deja în acest folder.');
      return;
    }
    const nextFiles = [...files, { path, content: '' }];
    setFiles(nextFiles);
    setOpenFile(path);
  }
  function togglePlugin(id) {
    const next = installedPlugins.includes(id)
      ? installedPlugins.filter(pluginId => pluginId !== id)
      : [...installedPlugins, id];
    onUpdate({ plugins: next });
    const plugin = pluginCatalog.find(item => item.id === id);
    onToast(`${plugin?.name || 'Plugin'} ${next.includes(id) ? 'adăugat la' : 'eliminat din'} lista demo.`);
  }

  return <section className="server-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Înapoi la servere</button>
    <div className="server-hero">
      <div className="server-hero-main"><div className="server-symbol"><Box size={24}/></div><div><div className="eyebrow">MINEFORY SERVER</div><h1>{server.name}</h1><p>{server.software || 'Paper'} · Minecraft {server.version} · {server.id}</p></div></div>
      <div className="server-hero-actions"><Status status={server.status}/><button className="danger-outline" onClick={onDelete}><Trash2 size={15}/> Șterge</button></div>
    </div>
    <div className="detail-actions"><button className="small-btn green-action" onClick={()=>onStatus('Online')}><Play size={15}/> Pornește</button><button className="small-btn" onClick={()=>onStatus('Offline')}><Square size={15}/> Oprește</button><button className="small-btn" onClick={onRestart}><RotateCw size={15}/> Repornește</button></div>
    <div className="server-tabs" role="tablist" aria-label="Secțiuni server">{[
      { name: 'Overview', label: 'Prezentare', icon: <Activity size={16}/> },
      { name: 'Files', label: 'Fișiere', icon: <Folder size={16}/> },
      { name: 'Plugins', label: 'Pluginuri', icon: <Plug size={16}/> },
      { name: 'Settings', label: 'Setări', icon: <Settings size={16}/> }
    ].map(item=><button key={item.name} role="tab" aria-selected={tab===item.name} className={`server-tab ${tab===item.name?'active':''}`} onClick={()=>setTab(item.name)}>{item.icon}{item.label}</button>)}</div>
    {tab === 'Overview' && <>
      <div className="server-overview-grid">
        <div className="server-info-card"><span>ADRESĂ SERVER</span><b>{server.address}</b></div>
        <div className="server-info-card ram-info-card"><span>MEMORIE RAM</span><b>{server.used} / {server.ram} GB alocați</b><div className="mini-progress"><i style={{width:`${server.ram > 0 ? Math.min(100,server.used/server.ram*100) : 0}%`}}/></div><button className="ram-upgrade-btn" onClick={addRam} disabled={server.ram >= 32}><Plus size={13}/> Adaugă 1 GB</button></div>
        <div className="server-info-card"><span>PROCESOR</span><b>{server.cpu}%</b></div>
        <div className="server-info-card"><span>JUCĂTORI ONLINE</span><b>{server.players}</b></div>
      </div>
      <div className="panel-card server-console-card"><div className="console-head"><div><Terminal size={17}/><b>Consolă</b><span className="demo-label">SIMULARE</span></div><button className="clear-btn" onClick={onClearLogs}>Curăță</button></div><div className="console-output">{logs.map((line,index)=><div key={`${index}-${line}`}>{line}</div>)}</div><form className="console-form" onSubmit={onCommand}><span>$</span><input value={consoleInput} onChange={e=>setConsoleInput(e.target.value)} placeholder="Scrie o comandă..." /><button type="submit">Trimite</button></form></div>
    </>}
    {tab === 'Files' && <div className="panel-card server-section-card">
      <div className="section-heading"><div><div className="eyebrow">FILE MANAGER</div><h2>Fișierele serverului</h2><p>Explorează și editează configurările demo.</p></div><button className="small-btn" onClick={addFile}><Plus size={15}/> Fișier nou</button></div>
      <div className="file-toolbar"><div className="file-breadcrumb"><button onClick={()=>{setCurrentFolder('');setOpenFile('');}}>server</button>{currentFolder && <><ChevronRight size={14}/><button onClick={()=>setOpenFile('')}>{currentFolder}</button></>}</div><div className="search-box file-search"><Search size={15}/><input value={fileSearch} onChange={e=>setFileSearch(e.target.value)} placeholder="Caută fișier..."/></div></div>
      <div className="file-manager">
        <div className="file-list">{directories.map(directory=><button key={directory} className="file-row" onClick={()=>{setCurrentFolder(`${currentFolder}${currentFolder?'/':''}${directory}`);setOpenFile('');}}><Folder size={17}/><span><b>{directory}</b><small>Folder</small></span><ChevronRight size={15}/></button>)}{visibleFiles.map(file=><button key={file.path} className={`file-row ${openFile===file.path?'selected':''}`} onClick={()=>setOpenFile(file.path)}><FileText size={17}/><span><b>{file.path.slice(file.path.lastIndexOf('/')+1)}</b><small>Fișier de configurare</small></span><ChevronRight size={15}/></button>)}{directories.length===0&&visibleFiles.length===0&&<div className="file-empty">Nu există fișiere în acest folder.</div>}</div>
        <div className="file-editor">{selectedFile ? <><div className="file-editor-head"><div><Code2 size={16}/><b>{selectedFile.path}</b></div><button className="small-btn" onClick={saveFiles}><Save size={14}/> Salvează</button></div><textarea aria-label={`Conținutul fișierului ${selectedFile.path}`} spellCheck="false" value={selectedFile.content} onChange={e=>changeFileContent(e.target.value)}/></> : <div className="file-placeholder"><FileText size={25}/><b>Selectează un fișier</b><span>Alege un fișier din listă pentru a-i vedea conținutul.</span></div>}</div>
      </div>
      <div className="demo-notice"><Zap size={14}/> Managerul de fișiere este demonstrativ; modificările se salvează doar în acest browser.</div>
    </div>}
    {tab === 'Plugins' && <div className="panel-card server-section-card">
      <div className="section-heading"><div><div className="eyebrow">PLUGIN MANAGER</div><h2>Pluginuri</h2><p>Descoperă pluginuri și gestionează lista serverului.</p></div><span className="plugin-count">{installedPlugins.length} active</span></div>
      {software === 'Vanilla' && <div className="compatibility-notice"><ShieldCheck size={17}/><span>Pluginurile Bukkit necesită software Paper sau Spigot. Schimbă software-ul din setările serverului pentru a le activa.</span></div>}
      <div className="search-box plugin-search"><Search size={16}/><input value={pluginSearch} onChange={e=>setPluginSearch(e.target.value)} placeholder="Caută după nume sau categorie..."/></div>
      {visiblePlugins.length ? <div className="plugin-grid">{visiblePlugins.map(plugin=>{const isInstalled=installedPlugins.includes(plugin.id);return <article className="plugin-card" key={plugin.id}><div className="plugin-card-top"><div className="plugin-icon"><Plug size={18}/></div><span className={`plugin-category ${plugin.category==='Protecție'?'security':''}`}>{plugin.category}</span></div><h3>{plugin.name}</h3><p>{plugin.description}</p><button className={`plugin-action ${isInstalled?'installed':''}`} disabled={software==='Vanilla'} onClick={()=>togglePlugin(plugin.id)}>{isInstalled?<><span className="installed-dot"/> Adăugat</>:<><Download size={14}/> Adaugă plugin</>}</button></article>})}</div> : <div className="file-empty">Nu am găsit pluginuri pentru această căutare.</div>}
      <div className="demo-notice"><Zap size={14}/> Instalarea pluginurilor este simulată; nu se descarcă fișiere pe server.</div>
    </div>}
    {tab === 'Settings' && <form className="panel-card server-section-card settings-form" onSubmit={saveSettings}>
      <div className="section-heading"><div><div className="eyebrow">CONFIGURARE SERVER</div><h2>Setări</h2><p>Versiuni, runtime Java și preferințe de joc.</p></div><span className="demo-label">DEMO</span></div>
      <div className="settings-fields">
        <label>Numele serverului<input value={serverName} onChange={e=>setServerName(e.target.value)} maxLength={40} required/></label>
        <label>Versiune Minecraft<select value={minecraftVersion} onChange={e=>setMinecraftVersion(e.target.value)}>{minecraftVersions.map(version=><option key={version}>{version}</option>)}</select><small>Alege versiunea pe care dorești să o configurezi.</small></label>
        <label>Software server<select value={software} onChange={e=>setSoftware(e.target.value)}><option>Paper</option><option>Purpur</option><option>Spigot</option><option>Vanilla</option></select><small>Paper, Purpur și Spigot acceptă pluginuri.</small></label>
        <label>Versiune Java<select value={javaVersion} onChange={e=>setJavaVersion(e.target.value)}>{javaVersions.map(version=><option key={version}>{version}</option>)}</select><small>Compatibilitatea depinde de versiunea Minecraft selectată.</small></label>
        <label>RAM alocat<select value={ram} onChange={e=>setRam(Number(e.target.value))}>{[1,2,3,4,6,8,12,16,24,32].map(amount=><option key={amount} value={amount}>{amount} GB</option>)}</select><small>Poți aloca între 1 și 32 GB în modul demo.</small></label>
        <label>Număr maxim de jucători<input type="number" min="1" max="500" value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)} required/></label>
        <label className="settings-wide">Mesaj server (MOTD)<input value={motd} onChange={e=>setMotd(e.target.value)} maxLength={100}/></label>
      </div>
      <div className="settings-footer"><span><Zap size={14}/> Setările se salvează local, în modul demo.</span><button className="primary-btn" type="submit"><Save size={15}/> Salvează setările</button></div>
    </form>}
  </section>;
}
function ServerCard({server,onOpen,onDelete,onToggle}) {
  const ramPercent = server.ram > 0 ? Math.min(100,server.used/server.ram*100) : 0;
  return <div className="server-card">
    <div className="server-card-top"><div className="server-symbol"><Box size={20}/></div><div className="server-card-tools"><Status status={server.status}/><button className="delete-server-btn" aria-label={`Șterge serverul ${server.name}`} title="Șterge serverul" onClick={onDelete}><Trash2 size={15}/></button></div></div>
    <button className="server-name" onClick={onOpen}>{server.name}<span>↗</span></button><div className="server-sub">{server.game} · {server.version}</div>
    <div className="server-stats"><div><Cpu size={14}/><span>{server.cpu}% CPU</span></div><div><Database size={14}/><span>{server.used} / {server.ram} GB RAM</span></div></div>
    <div className="mini-progress"><i style={{width:`${ramPercent}%`}}/></div>
    <div className="server-card-bottom"><button className="open-server-btn" onClick={onOpen}>Deschide serverul <ArrowRight size={14}/></button><button className={`power-btn ${server.status==='Online'?'is-on':''}`} onClick={onToggle}>{server.status==='Online'?<Square size={14}/>:<Play size={14}/>} {server.status==='Online'?'Stop':'Start'}</button></div>
  </div>;
}

export default App;
