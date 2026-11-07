import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, Box, ChevronDown, CircleHelp, Cpu, Database,
  HardDrive, LayoutDashboard, LogOut, Menu, Plus, Search, Server,
  Settings, ShieldCheck, Users, Wifi, X, Play, Square, RotateCw,
  Terminal, Zap, Eye, EyeOff, LockKeyhole, Mail, Trash2,
  ArrowRight, KeyRound, ArrowLeft, FileText, Folder, Plug,
  Download, Save, ChevronRight, Code2
} from 'lucide-react';
import { adminEmail, supabase, supabaseConfigMissing } from './supabase.js';
import { apiRequest, checkApiHealth } from './api.js';

const javaVersions = ['Java 25', 'Java 21', 'Java 17', 'Java 11', 'Java 8'];
const normalizeEmail = email => email.trim().toLowerCase();
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
const normalizeServerFiles = value => Array.isArray(value)
  ? value.filter(file => file && typeof file.path === 'string')
  : starterFiles;

const Icon = ({ children, size=18 }) => <span className="icon"><span style={{display:'inline-flex'}}>{React.cloneElement(children, { size })}</span></span>;

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [passwordUpdateBusy, setPasswordUpdateBusy] = useState(false);
  const [passwordUpdateError, setPasswordUpdateError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(false);
  const [serversLoadError, setServersLoadError] = useState('');
  const [serversReloadKey, setServersReloadKey] = useState(0);
  const [serverCreating, setServerCreating] = useState(false);
  const [page, setPage] = useState('Overview');
  const [selected, setSelected] = useState('');
  const [welcomeServer, setWelcomeServer] = useState('');
  const [serverToDelete, setServerToDelete] = useState(null);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newSoftware, setNewSoftware] = useState('Paper');
  const [newJavaVersion, setNewJavaVersion] = useState('Java 21');
  const [newVersionOptions, setNewVersionOptions] = useState([]);
  const [newVersionsLoading, setNewVersionsLoading] = useState(false);
  const [newVersionsError, setNewVersionsError] = useState('');
  const [toast, setToast] = useState('');
  const [consoleInput, setConsoleInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [adminApiState, setAdminApiState] = useState({ checking: true, error: '' });
  const [apiHealthCheckKey, setApiHealthCheckKey] = useState(0);
  const [accessProfile, setAccessProfile] = useState(null);
  const [accessError, setAccessError] = useState('');
  const [accessCheckKey, setAccessCheckKey] = useState(0);

  useEffect(() => {
    if (!showCreate || !authUser) return undefined;
    let active = true;
    setNewVersionsLoading(true);
    setNewVersionsError('');
    apiRequest(`/versions?software=${encodeURIComponent(newSoftware)}`)
      .then(({ versions, defaultVersion }) => {
        if (!Array.isArray(versions) || versions.some(version => !version || typeof version.id !== 'string' || typeof version.javaVersion !== 'string')) {
          throw new Error('API-ul nu a returnat lista versiunilor de joc.');
        }
        if (active) {
          setNewVersionOptions(versions);
          setNewVersion(current => versions.some(version => version.id === current) ? current : defaultVersion || '');
        }
      })
      .catch(error => {
        if (active) setNewVersionsError(error instanceof Error ? error.message : 'Versiunile nu au putut fi încărcate.');
      })
      .finally(() => {
        if (active) setNewVersionsLoading(false);
      });
    return () => { active = false; };
  }, [showCreate, newSoftware, authUser?.id]);

  useEffect(() => {
    const selectedVersion = newVersionOptions.find(version => version.id === newVersion);
    if (selectedVersion) setNewJavaVersion(selectedVersion.javaVersion);
  }, [newVersionOptions, newVersion]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    const loadSession = async () => {
      let sessionHasUser = false;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) setAuthError(`Sesiunea nu a putut fi verificată: ${error.message}`);
        const user = data.session?.user ?? null;
        sessionHasUser = Boolean(user);
        setAuthUser(user);
        setAccessProfile(null);
        setAuthLoading(sessionHasUser);
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? error.message : 'Sesiunea nu a putut fi verificată.');
      } finally {
        if (active && !sessionHasUser) setAuthLoading(false);
      }
    };
    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      setAccessProfile(null);
      setAccessError('');
      setAuthLoading(Boolean(user));
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (!user) setPasswordRecovery(false);
      setAuthError('');
      setAuthMessage('');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!authUser) {
      setAccessProfile(null);
      return undefined;
    }
    let active = true;
    setAuthLoading(true);
    setAccessError('');
    apiRequest('/access/me')
      .then(({ access }) => {
        if (!access || !Array.isArray(access.permissions)) throw new Error('API-ul nu a returnat rolul contului.');
        if (active) {
          setAccessProfile(access);
          setAccessError('');
        }
      })
      .catch(error => {
        if (!active) return;
        setAccessProfile(null);
        setAccessError(error instanceof Error ? error.message : 'Contul nu are acces la acest panel.');
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => { active = false; };
  }, [authUser?.id, accessCheckKey]);
  useEffect(() => {
    if (!authUser) {
      setServers([]);
      setServersLoading(false);
      setServersLoadError('');
      return;
    }
    let active = true;
    setServersLoading(true);
    setServersLoadError('');
    apiRequest('/servers')
      .then(({ servers: ownedServers }) => {
        if (!Array.isArray(ownedServers)) throw new Error('API-ul nu a returnat lista serverelor. Verifică VITE_API_URL și pornește serviciul API.');
        if (active) setServers(ownedServers);
      })
      .catch(error => {
        if (active) setServersLoadError(error instanceof Error ? error.message : 'Serverele nu au putut fi încărcate.');
      })
      .finally(() => {
        if (active) setServersLoading(false);
      });
    return () => { active = false; };
  }, [authUser?.id, serversReloadKey]);
  useEffect(() => {
    setServers([]);
    setLogs([]);
    setSelected('');
    setQuery('');
    setPage('Overview');
  }, [authUser?.id]);
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
  useEffect(() => {
    if (page !== 'Admin panel') return undefined;
    let active = true;
    const check = async () => {
      try {
        await checkApiHealth();
        if (active) setAdminApiState({ checking: false, error: '' });
      } catch (error) {
        if (active) setAdminApiState({
          checking: false,
          error: error instanceof Error ? error.message : 'Starea API-ului nu a putut fi verificată.'
        });
      }
    };
    setAdminApiState({ checking: true, error: '' });
    void check();
    const timer = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [page, apiHealthCheckKey]);

  const current = servers.find(s => s.id === selected) || servers[0];
  const filtered = useMemo(() => servers.filter(s => s.name.toLowerCase().includes(query.toLowerCase())), [servers, query]);
  const online = servers.filter(s => s.status === 'Online').length;
  const totalRam = servers.reduce((n,s) => n+s.ram, 0);
  const canViewServers = accessProfile?.permissions.includes('view_servers') ?? false;
  const canCreateServers = accessProfile?.permissions.includes('create_server') ?? false;
  const canManageServers = accessProfile?.permissions.includes('manage_servers') ?? false;
  const canUseConsole = accessProfile?.permissions.includes('console') ?? false;
  const canManageFiles = accessProfile?.permissions.includes('files') ?? false;
  const canDeleteServers = accessProfile?.permissions.includes('delete_servers') ?? false;

  async function authenticate({ email, password }) {
    if (!supabase) {
      setAuthError('Autentificarea Supabase nu este configurată.');
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const normalizedEmail = normalizeEmail(email);
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) throw error;
      setAuthUser(data.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Autentificarea a eșuat. Încearcă din nou.');
    } finally {
      setAuthBusy(false);
    }
  }
  async function signOut() {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setToast(`Deconectarea a eșuat: ${error.message}`);
        return;
      }
      setAuthUser(null);
    } catch (error) {
      setToast(`Deconectarea a eșuat: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
    }
  }
  async function sendPasswordReset(email) {
    if (!supabase) return;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setAuthError('Introdu adresa de e-mail pentru a primi linkul de resetare.');
      return;
    }
    setResetBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: window.location.origin });
      if (error) throw error;
      setAuthMessage('Dacă există un cont pentru această adresă, vei primi un e-mail cu pașii de resetare.');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Nu s-a putut trimite e-mailul de resetare.');
    } finally {
      setResetBusy(false);
    }
  }
  async function updatePassword(password) {
    if (!supabase) return;
    setPasswordUpdateBusy(true);
    setPasswordUpdateError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPasswordRecovery(false);
      setToast('Parola a fost actualizată.');
    } catch (error) {
      setPasswordUpdateError(error instanceof Error ? error.message : 'Parola nu a putut fi actualizată.');
    } finally {
      setPasswordUpdateBusy(false);
    }
  }
  function openServer(server) {
    setSelected(server.id);
    setWelcomeServer(server.name);
  }
  async function deleteServer() {
    if (!serverToDelete) return;
    try {
      await apiRequest(`/servers/${serverToDelete.id}`, { method: 'DELETE' });
      const remaining = servers.filter(server => server.id !== serverToDelete.id);
      setServers(remaining);
      if (selected === serverToDelete.id) {
        setSelected(remaining[0]?.id || '');
        if (page === 'Server detail') setPage('Servers');
      }
      setServerToDelete(null);
      setToast(`Serverul „${serverToDelete.name}” a fost șters de pe host.`);
    } catch (error) {
      setToast(`Serverul nu a putut fi șters: ${error.message}`);
    }
  }
  async function changeStatus(id, status) {
    try {
      const result = await apiRequest(`/servers/${id}/${status === 'Online' ? 'start' : 'stop'}`, { method: 'POST' });
      if (result.server) setServers(prev => prev.map(server => server.id === id ? { ...server, ...result.server } : server));
      setToast(`Comanda de ${status === 'Online' ? 'pornire' : 'oprire'} a fost trimisă hostului.`);
    } catch (error) {
      setToast(`Serverul nu a putut fi ${status === 'Online' ? 'pornit' : 'oprit'}: ${error.message}`);
    }
  }
  async function restartServer(id) {
    try {
      await apiRequest(`/servers/${id}/restart`, { method: 'POST' });
      setToast('Comanda de repornire a fost trimisă hostului.');
    } catch (error) {
      setToast(`Serverul nu a putut fi repornit: ${error.message}`);
    }
  }
  async function clearServerLogs(id) {
    try {
      await apiRequest(`/servers/${id}/logs`, { method: 'DELETE' });
      setLogs([]);
    } catch (error) {
      setToast(`Jurnalul nu a putut fi curățat: ${error.message}`);
    }
  }
  async function updateServer(id, updates) {
    const { server } = await apiRequest(`/servers/${id}`, { method: 'PATCH', body: updates });
    setServers(prev => prev.map(item => item.id === id ? { ...item, ...server } : item));
    return server;
  }
  async function createServer(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setServerCreating(true);
    try {
      const { server } = await apiRequest('/servers', { method: 'POST', body: { name: newName.trim(), version: newVersion, software: newSoftware, javaVersion: newJavaVersion, ram: 2 } });
      setServers(prev => [...prev, server]);
      setSelected(server.id); setNewName(''); setShowCreate(false); setPage('Servers');
      setToast(`${server.software} ${server.version} a fost instalat și verificat pentru ${server.name}.`);
    } catch (error) {
      setToast(`Serverul nu a putut fi instalat: ${error.message}`);
    } finally {
      setServerCreating(false);
    }
  }
  async function sendCommand(e) {
    e.preventDefault();
    if (!consoleInput.trim()) return;
    try {
      await apiRequest(`/servers/${selected}/command`, { method: 'POST', body: { command: consoleInput } });
      setConsoleInput('');
    } catch (error) {
      setToast(`Comanda nu a putut fi trimisă: ${error.message}`);
    }
  }

  const nav = [
    { label: 'Overview', icon: <LayoutDashboard/> },
    ...(canViewServers ? [{ label: 'Servers', icon: <Server/> }] : []),
    { label: 'Admin panel', icon: <ShieldCheck/> },
    { label: 'Settings', icon: <Settings/> }
  ];

  if (authLoading) return <div className="auth-loading"><div className="welcome-mark"><Zap size={24} fill="currentColor"/></div><span>Se verifică sesiunea...</span></div>;
  if (passwordRecovery) return <ResetPassword busy={passwordUpdateBusy} error={passwordUpdateError} onSubmit={updatePassword}/>;
  if (!authUser) return <Login error={authError} message={authMessage} busy={authBusy} resetBusy={resetBusy} configured={!supabaseConfigMissing} adminEmail={adminEmail} onSubmit={authenticate} onReset={sendPasswordReset}/>;
  if (!accessProfile) return <div className="auth-gate">
    <div className="welcome-mark"><ShieldCheck size={24}/></div>
    <h1>Accesul nu a putut fi verificat</h1>
    <p role="alert">{accessError || 'Așteaptă verificarea contului înainte să folosești panelul.'}</p>
    <div className="auth-gate-actions">
      <button className="primary-btn" onClick={()=>setAccessCheckKey(key=>key+1)}>Încearcă din nou</button>
      <button className="small-btn" onClick={signOut}>Deconectează-te</button>
    </div>
  </div>;

  return <div className="app-shell">
    <aside className={`sidebar ${showMobile ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Zap size={21} fill="currentColor"/></div><div><b>MINEFORY</b><span>HOSTING PANEL</span></div><button className="mobile-close" onClick={()=>setShowMobile(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className="workspace"><span className="workspace-avatar">M</span><span><b>Minefory Host</b><small>Personal workspace</small></span><ChevronDown size={15}/></button>
      <div className="nav-label">MANAGEMENT</div>
      <nav>{nav.map(n=><button key={n.label} className={`nav-item ${(page===n.label || (page==='Server detail' && n.label==='Servers'))?'active':''}`} onClick={()=>{setPage(n.label);setShowMobile(false)}}><Icon>{n.icon}</Icon>{n.label}{n.label==='Servers'&&<span className="nav-count">{servers.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><b>Ai nevoie de ajutor?</b><p>Ghiduri și informații pentru panel.</p><button onClick={()=>setToast('Centrul de ajutor va fi disponibil în curând.')}>Deschide centrul de ajutor <span>↗</span></button></div><div className="profile"><div className="profile-avatar">{(authUser?.user_metadata?.full_name || authUser?.email || 'M').slice(0,1).toUpperCase()}</div><div><b>{authUser?.user_metadata?.full_name || authUser?.email}</b><small>Cont Supabase</small></div><button className="logout-btn" title="Deconectare" aria-label="Deconectare" onClick={signOut}><LogOut size={16}/></button></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="top-left"><button className="mobile-menu" onClick={()=>setShowMobile(true)}><Menu/></button><span className="crumb">Workspace</span><span className="slash">/</span><b>{page === 'Server detail' ? (current?.name || 'Server') : page}</b></div><div className="top-actions"><div className="system-pill"><span className={`pulse ${page === 'Admin panel' && adminApiState.error ? 'pulse-error' : page === 'Admin panel' && adminApiState.checking ? 'pulse-checking' : ''}`}></span>{page === 'Admin panel' ? adminApiState.checking ? 'Se verifică API-ul' : adminApiState.error ? 'API host deconectat' : 'API host conectat' : 'Toate sistemele funcționează'}</div><button className="icon-button" onClick={()=>setToast('Nu ai notificări noi.')}><Bell size={18}/><i/></button><div className="top-avatar">M</div></div></header>

      <div className="content">
        {page === 'Overview' && <>
          <div className="page-heading"><div><div className="eyebrow">BINE AI VENIT ÎNAPOI</div><h1>Dashboard</h1><p>O privire de ansamblu asupra serviciilor tale.</p></div>{canCreateServers && <button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Creează server</button>}</div>
          <div className="stats-grid">
            <Stat icon={<Server/>} label="Total servere" value={servers.length} note={`${online} online`} tone="violet"/>
            <Stat icon={<Activity/>} label="Servere online" value={online} note="Stare raportată de host" tone="green"/>
            <Stat icon={<Cpu/>} label="CPU utilizat" value="—" note="Metrica nu este disponibilă" tone="blue"/>
            <Stat icon={<Database/>} label="RAM alocată" value={`${totalRam} GB`} note="Configurația serverelor tale" tone="orange"/>
          </div>
          <div className="section-row"><div><h2>Serverele tale</h2><p>Gestionează instanțele de joc.</p></div><button className="text-btn" onClick={()=>setPage('Servers')}>Vezi toate <span>→</span></button></div>
          {serversLoading ? <ServerLoading/> : servers.length === 0 ? <EmptyServers onCreate={canCreateServers ? ()=>setShowCreate(true) : null}/> : <div className="server-grid">{servers.slice(0,3).map(s=><ServerCard key={s.id} server={s} onOpen={()=>openServer(s)} onDelete={()=>setServerToDelete(s)} onToggle={()=>changeStatus(s.id,s.status==='Online'?'Offline':'Online')} canManage={canManageServers} canDelete={canDeleteServers}/>)}</div>}
          <div className="bottom-grid"><div className="panel-card"><div className="panel-title"><div><h3>Resurse alocate</h3><p>Limită configurată: 32 GB RAM per cont</p></div><span className="period">HOST</span></div><Resource label="RAM" used={totalRam} total={32} unit="GB" color="purple"/><p className="muted">Utilizarea CPU și spațiul pe disc nu sunt măsurate de API.</p></div><div className="panel-card activity-card"><div className="panel-title"><div><h3>Cont și servere</h3><p>Datele contului autentificat</p></div><span className="live-tag">SUPABASE</span></div><div className="activity-line"><span className="activity-dot green-dot"></span><div><b>Cont conectat</b><small>{authUser.email}</small></div></div><div className="activity-line"><span className="activity-dot purple-dot"></span><div><b>{servers.length} servere</b><small>Administrate de acest cont</small></div></div><div className="activity-line"><span className="activity-dot blue-dot"></span><div><b>{totalRam} GB RAM alocată</b><small>Limită per cont: 32 GB</small></div></div></div></div>
        </>}

        {page === 'Servers' && canViewServers && <><div className="page-heading"><div><div className="eyebrow">INFRASTRUCTURĂ</div><h1>Servere</h1><p>Administrează serverele tale de joc.</p></div>{canCreateServers && <button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Creează server</button>}</div>
          <div className="toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Caută un server..."/></div><span className="muted">{filtered.length} servere</span></div>
          {serversLoading ? <ServerLoading/> : filtered.length > 0 ? <div className="server-list">{filtered.map(s=><ServerCard key={s.id} server={s} onOpen={()=>openServer(s)} onDelete={()=>setServerToDelete(s)} onToggle={()=>changeStatus(s.id,s.status==='Online'?'Offline':'Online')} canManage={canManageServers} canDelete={canDeleteServers}/>)}</div> : <EmptyServers onCreate={canCreateServers ? ()=>setShowCreate(true) : null} searching={servers.length > 0}/>}
        </>}

        {page === 'Admin panel' && <AdminPanel
          adminEmail={adminEmail}
          accessProfile={accessProfile}
          apiState={adminApiState}
          servers={servers}
          serversLoading={serversLoading}
          serversLoadError={serversLoadError}
          totalRam={totalRam}
          online={online}
          onCreate={canCreateServers ? ()=>setShowCreate(true) : null}
          onReloadServers={()=>setServersReloadKey(key=>key+1)}
          onCheckApi={()=>setApiHealthCheckKey(key=>key+1)}
          onOpen={openServer}
          onDelete={setServerToDelete}
          onToggle={changeStatus}
        />}

        {page === 'Server detail' && current && <ServerDetail server={current} logs={logs} setLogs={setLogs} setServers={setServers} consoleInput={consoleInput} setConsoleInput={setConsoleInput} canManage={canManageServers} canUseConsole={canUseConsole} canManageFiles={canManageFiles} canDelete={canDeleteServers} onBack={()=>setPage('Servers')} onDelete={()=>setServerToDelete(current)} onStatus={status=>changeStatus(current.id,status)} onRestart={()=>restartServer(current.id)} onClearLogs={()=>clearServerLogs(current.id)} onCommand={sendCommand} onUpdate={updates=>updateServer(current.id,updates)} onToast={setToast}/>}

        {page === 'Settings' && <><div className="page-heading"><div><div className="eyebrow">PREFERINȚE</div><h1>Setări</h1><p>Configurarea workspace-ului Minefory Host.</p></div></div><div className="panel-card settings-panel"><div className="setting-row"><div className="setting-symbol"><ShieldCheck/></div><div><b>Autentificare</b><p>{authUser.email} · Supabase Auth</p></div><span className="muted">Conectat</span></div><div className="setting-row"><div className="setting-symbol"><Server/></div><div><b>Servere</b><p>Gestionate de API-ul hostului</p></div><span className="muted">{servers.length} total</span></div><div className="setting-row"><div className="setting-symbol"><HardDrive/></div><div><b>Resurse configurate</b><p>{totalRam} GB RAM alocată · limită 32 GB per cont</p></div><span className="muted">API</span></div></div></>}
        <footer>© 2026 <b>Minefory Host</b> · Serverele și fișierele sunt gestionate de API-ul hostului.</footer>
      </div>
    </main>
    {showCreate && <div className="modal-backdrop" onClick={()=>!serverCreating&&setShowCreate(false)}><form className="modal" onSubmit={createServer} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">CONFIGURARE</div><h2>Creează un server</h2><p>Instalează automat server.jar pentru software-ul și versiunea aleasă.</p></div><button type="button" className="icon-button" disabled={serverCreating} onClick={()=>setShowCreate(false)}><X/></button></div><label>Numele serverului<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ex: Survival SMP" required disabled={serverCreating}/></label><label>Software server<select value={newSoftware} onChange={e=>{setNewSoftware(e.target.value);setNewVersion('');}} disabled={serverCreating}><option value="Paper">PaperMC (pluginuri)</option><option value="Vanilla">Vanilla oficial</option></select></label><label>Versiune Minecraft<select value={newVersion} onChange={e=>setNewVersion(e.target.value)} disabled={serverCreating || newVersionsLoading || newVersionOptions.length===0} required>{newVersionsLoading ? <option value="">Se încarcă versiunile...</option> : newVersionOptions.map(version=><option key={version.id} value={version.id}>{version.id} · necesită {version.javaVersion}+</option>)}</select></label><label>Java necesar<input value={newJavaVersion} readOnly aria-label="Versiune Java necesară" /></label>{newVersionsError && <div className="login-error" role="alert">{newVersionsError}</div>}<div className="modal-note"><Zap size={16}/> La creare se descarcă JAR-ul și se verifică integritatea lui. Pentru pornire trebuie să fie configurată versiunea Java indicată și să accepți EULA în setările serverului.</div><div className="modal-actions"><button type="button" className="small-btn" disabled={serverCreating} onClick={()=>setShowCreate(false)}>Anulează</button><button className="primary-btn" type="submit" disabled={serverCreating || newVersionsLoading || newVersionOptions.length===0 || Boolean(newVersionsError)}><Plus size={16}/>{serverCreating?' Se instalează...':' Creează server'}</button></div></form></div>}
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
    <p>{searching ? 'Încearcă alt termen de căutare.' : onCreate ? 'Creează primul server ca să începi să-ți gestionezi infrastructura.' : 'Nu ai servere atribuite momentan. Cere Ownerului să-ți acorde acces.'}</p>
    {!searching && onCreate && <button className="primary-btn" onClick={onCreate}><Plus size={16}/> Creează primul server</button>}
  </div>;
}
function ServerLoading() {
  return <div className="server-loading" role="status"><span className="pulse"/><span>Se încarcă serverele de pe host...</span></div>;
}
function ResetPassword({busy,error,onSubmit}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setFormError('');
    if (password.length < 8) {
      setFormError('Parola trebuie să aibă cel puțin 8 caractere.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Parolele nu coincid.');
      return;
    }
    await onSubmit(password);
  }

  return <main className="login-screen">
    <div className="login-glow login-glow-one"/><div className="login-glow login-glow-two"/>
    <div className="login-brand"><div className="brand-mark"><Zap size={21} fill="currentColor"/></div><div><b>MINEFORY</b><span>GAME SERVER HOSTING</span></div></div>
    <section className="login-card">
      <div className="login-emblem"><LockKeyhole size={22}/><span/></div>
      <div className="eyebrow">SECURITATE CONT</div>
      <h1>Schimbă parola</h1>
      <p className="login-subtitle">Alege o parolă nouă de cel puțin 8 caractere.</p>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="new-password">Parolă nouă</label>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></div>
        <label htmlFor="new-password-confirm">Confirmă parola nouă</label>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="new-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required disabled={busy}/></div>
        {(formError || error) && <div className="login-error" role="alert">{formError || error}</div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Se actualizează...' : 'Actualizează parola'} {!busy && <ArrowRight size={17}/>}</button>
      </form>
    </section>
    <div className="login-footer"><span><i/> Infrastructură monitorizată</span><span>© 2026 Minefory Host</span></div>
  </main>;
}
function Login({error,message,busy,resetBusy,configured,adminEmail,onSubmit,onReset}) {
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!configured) return;
    await onSubmit({ email: normalizeEmail(email), password });
  }

  return <main className="login-screen">
    <div className="login-glow login-glow-one"/><div className="login-glow login-glow-two"/>
    <div className="login-brand"><div className="brand-mark"><Zap size={21} fill="currentColor"/></div><div><b>MINEFORY</b><span>GAME SERVER HOSTING</span></div></div>
    <section className="login-card">
      <div className="login-emblem"><Server size={23}/><span/></div>
      <div className="eyebrow">ACCES ADMINISTRATOR</div>
      <h1>Intră în panelul tău</h1>
      <p className="login-subtitle">Autentificare securizată pentru conturile Minefory autorizate.</p>
      {!configured && <div className="auth-config-warning"><ShieldCheck size={17}/><span><b>Configurarea autentificării admin lipsește.</b> Verifică URL-ul, cheia publică și VITE_ADMIN_EMAIL în setările de build ale site-ului.</span></div>}
      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Adresă de e-mail</label>
        <div className="login-input-wrap"><Mail size={17}/><input id="login-email" type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required disabled={!configured || busy}/></div>
        <div className="password-label"><label htmlFor="login-password">Parolă</label><button type="button" className="forgot-link" onClick={()=>onReset(email)} disabled={!configured || busy || resetBusy}>{resetBusy?'Se trimite...':'Ai uitat parola?'}</button></div>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="login-password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Introdu parola contului tău" value={password} onChange={e=>setPassword(e.target.value)} required disabled={!configured || busy}/><button type="button" className="password-toggle" aria-label={showPassword?'Ascunde parola':'Afișează parola'} onClick={()=>setShowPassword(!showPassword)} disabled={!configured || busy}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
        <button className="login-submit" type="submit" disabled={!configured || busy}>{busy ? 'Se verifică...' : 'Autentifică-te'} {!busy && <ArrowRight size={17}/>}</button>
      </form>
      {error && <div className="login-error auth-response" role="alert">{error}</div>}
      {message && <div className="auth-success" role="status"><Mail size={16}/><span>{message}</span></div>}
      <div className="login-demo"><KeyRound size={15}/><span><b>Administrator</b> · Înregistrarea publică este dezactivată.</span></div>
    </section>
    <div className="login-footer"><span><i/> Infrastructură monitorizată</span><span>© 2026 Minefory Host</span></div>
  </main>;
}
function AdminPanel({adminEmail,accessProfile,apiState,servers,serversLoading,serversLoadError,totalRam,online,onCreate,onReloadServers,onCheckApi,onOpen,onDelete,onToggle}) {
  const [members, setMembers] = useState([]);
  const [teamServers, setTeamServers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamRefresh, setTeamRefresh] = useState(0);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [memberPermissions, setMemberPermissions] = useState(['view_servers']);
  const [memberServerIds, setMemberServerIds] = useState([]);
  const [editingEmail, setEditingEmail] = useState('');
  const canManageAccess = Boolean(accessProfile?.canManageAccess);
  const permissionOptions = [
    { id: 'view_servers', label: 'Vezi serverele' },
    { id: 'manage_servers', label: 'Pornește, oprește și configurează' },
    { id: 'console', label: 'Consolă și jurnale' },
    { id: 'files', label: 'Gestionează fișierele' },
    { id: 'delete_servers', label: 'Șterge servere' }
  ];

  useEffect(() => {
    if (!canManageAccess) return undefined;
    let active = true;
    setTeamLoading(true);
    setTeamError('');
    apiRequest('/access/members')
      .then(({ members: currentMembers, servers: currentServers }) => {
        if (!Array.isArray(currentMembers) || !Array.isArray(currentServers)) throw new Error('API-ul nu a returnat lista membrilor și serverelor.');
        if (active) {
          setMembers(currentMembers);
          setTeamServers(currentServers);
        }
      })
      .catch(error => {
        if (active) setTeamError(error instanceof Error ? error.message : 'Lista echipei nu a putut fi încărcată.');
      })
      .finally(() => {
        if (active) setTeamLoading(false);
      });
    return () => { active = false; };
  }, [canManageAccess, teamRefresh]);

  function resetMemberForm() {
    setMemberEmail('');
    setMemberRole('member');
    setMemberPermissions(['view_servers']);
    setMemberServerIds([]);
    setEditingEmail('');
  }

  async function saveMember(event) {
    event.preventDefault();
    setTeamSaving(true);
    setTeamError('');
    const body = {
      email: memberEmail.trim().toLowerCase(),
      role: memberRole,
      permissions: memberRole === 'member' ? memberPermissions : [],
      serverIds: memberRole === 'member' ? memberServerIds : []
    };
    try {
      await apiRequest(editingEmail
        ? `/access/members/${encodeURIComponent(editingEmail)}`
        : '/access/members', {
        method: editingEmail ? 'PATCH' : 'POST',
        body
      });
      resetMemberForm();
      setTeamRefresh(key => key + 1);
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : 'Membrul nu a putut fi salvat.');
    } finally {
      setTeamSaving(false);
    }
  }

  function editMember(member) {
    setEditingEmail(member.email);
    setMemberEmail(member.email);
    setMemberRole(member.role);
    setMemberPermissions(member.permissions || []);
    setMemberServerIds(member.serverIds || []);
  }

  async function removeMember(email) {
    if (!window.confirm(`Revoci accesul pentru ${email}?`)) return;
    setTeamSaving(true);
    setTeamError('');
    try {
      await apiRequest(`/access/members/${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (editingEmail === email) resetMemberForm();
      setTeamRefresh(key => key + 1);
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : 'Accesul membrului nu a putut fi revocat.');
    } finally {
      setTeamSaving(false);
    }
  }

  return <>
    <div className="page-heading">
      <div>
        <div className="eyebrow">MINEFORY CONTROL</div>
        <h1>Admin panel</h1>
        <p>Gestionează infrastructura și serverele din contul de administrator.</p>
      </div>
      {onCreate && <button className="primary-btn" onClick={onCreate}><Plus size={17}/> Creează server</button>}
    </div>
    <div className={`panel-card admin-api-status ${apiState.error ? 'admin-api-error' : ''}`} role="status">
      <div className="setting-symbol"><Activity size={17}/></div>
      <div>
        <b>{apiState.checking ? 'Se verifică API-ul hostului...' : apiState.error ? 'API-ul hostului nu este conectat' : 'API-ul hostului este conectat'}</b>
        <p>{apiState.error || 'Starea se verifică automat la fiecare 30 de secunde.'}</p>
      </div>
      <button className="small-btn admin-refresh-btn" onClick={onCheckApi} disabled={apiState.checking}><RotateCw size={14}/> Verifică</button>
      <span className={`admin-health-badge ${apiState.error ? 'offline' : apiState.checking ? 'checking' : 'online'}`}>
        {apiState.checking ? 'VERIFICARE' : apiState.error ? 'DECONECTAT' : 'ONLINE'}
      </span>
    </div>
    <div className="stats-grid admin-stats-grid">
      <Stat icon={<Server/>} label="Servere administrate" value={servers.length} note={`${online} online`} tone="violet"/>
      <Stat icon={<Activity/>} label="Servere online" value={online} note="Stare raportată de API" tone="green"/>
      <Stat icon={<Database/>} label="RAM alocată" value={`${totalRam} GB`} note="Limită: 32 GB" tone="orange"/>
      <Stat icon={<ShieldCheck/>} label="Rol activ" value={accessProfile?.role || '—'} note={accessProfile?.role === 'member' ? 'Permisiuni personalizate' : 'Acces bazat pe rol'} tone="blue"/>
    </div>
    <section className="admin-account-card panel-card">
      <div className="setting-symbol"><Users size={17}/></div>
      <div><b>Cont Owner</b><p>{adminEmail} · contul Owner nu poate fi modificat din panel.</p></div>
      <span className="role-tag">{accessProfile?.role === 'owner' ? 'OWNER' : accessProfile?.role === 'co-owner' ? 'CO-OWNER' : accessProfile?.role === 'developer' ? 'DEVELOPER' : 'MEMBER'}</span>
    </section>
    {canManageAccess && <section className="panel-card team-access-card">
      <div className="section-row team-access-heading">
        <div><h2>Echipa și permisiuni</h2><p>Adaugă e-mailuri cu cont Supabase existent și controlează accesul în host.</p></div>
        <span className="live-tag">ACCES CONTROLAT DE API</span>
      </div>
      {teamError && <div className="login-error team-error" role="alert">{teamError}</div>}
      <form className="team-form" onSubmit={saveMember}>
        <label>E-mail<input type="email" required value={memberEmail} onChange={event=>setMemberEmail(event.target.value)} placeholder="nume@exemplu.ro" disabled={teamSaving || Boolean(editingEmail)}/></label>
        <label>Rol<select value={memberRole} onChange={event=>setMemberRole(event.target.value)} disabled={teamSaving}><option value="member">Member — permisiuni selectate</option><option value="developer">Developer — gestionare fără ștergere</option><option value="co-owner">Co-owner — acces complet</option></select></label>
        {memberRole === 'member' && <fieldset className="team-permissions">
          <legend>Permisiuni pentru Member</legend>
          <div className="team-check-grid">{permissionOptions.map(permission=><label key={permission.id}><input type="checkbox" checked={memberPermissions.includes(permission.id)} onChange={event=>setMemberPermissions(current=>event.target.checked ? [...new Set([...current, permission.id])] : current.filter(value=>value!==permission.id))} disabled={teamSaving || permission.id==='view_servers'}/>{permission.label}</label>)}</div>
          <div className="team-server-options"><b>Servere accesibile</b>{teamServers.length ? teamServers.map(server=><label key={server.id}><input type="checkbox" checked={memberServerIds.includes(server.id)} onChange={event=>setMemberServerIds(current=>event.target.checked ? [...current, server.id] : current.filter(id=>id!==server.id))} disabled={teamSaving}/>{server.name}</label>) : <span className="muted">Nu există încă servere; poți edita accesul după ce creezi unul.</span>}</div>
        </fieldset>}
        <div className="team-form-actions">
          {editingEmail && <button type="button" className="small-btn" onClick={resetMemberForm} disabled={teamSaving}>Anulează editarea</button>}
          <button type="submit" className="primary-btn" disabled={teamSaving}>{teamSaving ? 'Se salvează...' : editingEmail ? 'Salvează permisiunile' : 'Adaugă membru'}</button>
        </div>
        <p className="team-footnote">Adăugarea nu creează cont și nu trimite parolă. Persoana trebuie să se autentifice cu contul Supabase al aceleiași adrese.</p>
      </form>
      <div className="team-member-list">
        <div className="team-list-heading"><b>Membri cu acces</b><button className="small-btn" onClick={()=>setTeamRefresh(key=>key+1)} disabled={teamLoading || teamSaving}><RotateCw size={14}/> Reîncarcă</button></div>
        {teamLoading ? <ServerLoading/> : members.length === 0 ? <p className="muted">Nu ai adăugat membri încă.</p> : members.map(member=><article className="team-member-row" key={member.email}>
          <div className="team-member-info"><b>{member.email}</b><span className="role-tag">{member.role === 'co-owner' ? 'CO-OWNER' : member.role === 'developer' ? 'DEVELOPER' : 'MEMBER'}</span>
            <small>{member.role === 'member' ? `${(member.permissions || []).map(id=>permissionOptions.find(option=>option.id===id)?.label || id).join(' · ')} · ${(member.serverIds || []).length} servere` : member.role === 'developer' ? 'Toate serverele · fără ștergere sau gestionare membri' : 'Acces complet la panel și gestionarea echipei'}</small>
          </div>
          <div className="team-member-actions"><button className="small-btn" onClick={()=>editMember(member)} disabled={teamSaving}>Editează</button><button className="danger-outline" onClick={()=>removeMember(member.email)} disabled={teamSaving}>Revocă</button></div>
        </article>)}
      </div>
    </section>}
    <div className="section-row admin-server-heading">
      <div><h2>Servere</h2><p>Pornește, oprește, deschide sau șterge serverele tale.</p></div>
      <div className="admin-server-actions">
        <button className="small-btn" onClick={onReloadServers} disabled={serversLoading}><RotateCw size={14}/> Reîncarcă</button>
        {onCreate && <button className="text-btn" onClick={onCreate}>Adaugă server <span>→</span></button>}
      </div>
    </div>
    {serversLoading
      ? <ServerLoading/>
      : serversLoadError
        ? <div className="empty-state admin-load-error" role="alert"><div className="empty-state-icon"><Wifi size={22}/></div><h3>Serverele nu s-au putut încărca</h3><p>{serversLoadError}</p><button className="primary-btn" onClick={onReloadServers}><RotateCw size={15}/> Încearcă din nou</button></div>
      : servers.length === 0
        ? <EmptyServers onCreate={onCreate}/>
        : <div className="server-grid">{servers.map(server =>
          <ServerCard
            key={server.id}
            server={server}
            onOpen={()=>onOpen(server)}
            onDelete={()=>onDelete(server)}
            onToggle={()=>onToggle(server.id,server.status==='Online'?'Offline':'Online')}
            canManage={accessProfile?.permissions.includes('manage_servers')}
            canDelete={accessProfile?.permissions.includes('delete_servers')}
          />
        )}</div>}
  </>;
}
function Status({status}) { return <span className={`status ${status==='Online'?'online':'offline'}`}><i/>{status}</span> }
function Resource({label,used,total,unit,color}) { const pct=total > 0 ? Math.min(100,Math.round(used/total*100)) : 0; return <div className="resource"><div className="resource-top"><b>{label}</b><span>{used.toFixed(1)} {unit} <small>/ {total} {unit}</small></span></div><div className="progress"><i className={color} style={{width:`${pct}%`}}/></div></div> }
function ServerDetail({server,logs,setLogs,setServers,consoleInput,setConsoleInput,canManage,canUseConsole,canManageFiles,canDelete,onBack,onDelete,onStatus,onRestart,onClearLogs,onCommand,onUpdate,onToast}) {
  const [tab, setTab] = useState('Overview');
  const [minecraftVersion, setMinecraftVersion] = useState(server.version);
  const [javaVersion, setJavaVersion] = useState(server.javaVersion || 'Java 21');
  const [software, setSoftware] = useState(server.software || 'Paper');
  const [ram, setRam] = useState(server.ram || 2);
  const [serverName, setServerName] = useState(server.name);
  const [maxPlayers, setMaxPlayers] = useState(server.maxPlayers || '20');
  const [motd, setMotd] = useState(server.motd || 'Minefory Server');
  const [eulaAccepted, setEulaAccepted] = useState(Boolean(server.eulaAccepted));
  const [versionOptions, setVersionOptions] = useState([{ id: server.version, javaVersion: server.javaVersion || 'Java 21' }]);
  const [versionOptionsError, setVersionOptionsError] = useState('');
  const [files, setFiles] = useState(() => normalizeServerFiles(server.files));
  const [currentFolder, setCurrentFolder] = useState('');
  const [openFile, setOpenFile] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [pluginSearch, setPluginSearch] = useState('');
  const installedPlugins = Array.isArray(server.plugins) ? server.plugins : [];

  useEffect(() => {
    setMinecraftVersion(server.version);
    setJavaVersion(server.javaVersion || 'Java 21');
    setSoftware(server.software || 'Paper');
    setRam(server.ram || 2);
    setServerName(server.name);
    setMaxPlayers(server.maxPlayers || '20');
    setMotd(server.motd || 'Minefory Server');
    setEulaAccepted(Boolean(server.eulaAccepted));
    setFiles(normalizeServerFiles(server.files));
  }, [server.id, server.version, server.javaVersion, server.software, server.ram, server.name, server.maxPlayers, server.motd, server.files]);

  useEffect(() => {
    if (tab !== 'Files') return undefined;
    let active = true;
    apiRequest(`/servers/${server.id}/files`)
      .then(({ files: serverFiles }) => {
        if (!Array.isArray(serverFiles)) throw new Error('API-ul nu a returnat lista fișierelor.');
        if (active) setFiles(normalizeServerFiles(serverFiles));
      })
      .catch(error => { if (active) onToast(`Fișierele nu au putut fi încărcate: ${error.message}`); });
    return () => { active = false; };
  }, [tab, server.id, onToast]);
  useEffect(() => {
    if (tab !== 'Settings') return undefined;
    let active = true;
    setVersionOptionsError('');
    apiRequest(`/versions?software=${encodeURIComponent(software)}`)
      .then(({ versions, defaultVersion }) => {
        if (!Array.isArray(versions) || versions.some(version => !version || typeof version.id !== 'string' || typeof version.javaVersion !== 'string')) {
          throw new Error('API-ul nu a returnat lista versiunilor de joc.');
        }
        if (!active) return;
        const selectedVersion = versions.find(version => version.id === minecraftVersion);
        const nextVersion = selectedVersion?.id || defaultVersion;
        setVersionOptions(versions);
        if (nextVersion && nextVersion !== minecraftVersion) setMinecraftVersion(nextVersion);
        const nextJavaVersion = versions.find(version => version.id === nextVersion)?.javaVersion;
        if (nextJavaVersion) setJavaVersion(current => Number(current.replace('Java ', '')) < Number(nextJavaVersion.replace('Java ', '')) ? nextJavaVersion : current);
      })
      .catch(error => {
        if (active) setVersionOptionsError(error instanceof Error ? error.message : 'Versiunile nu au putut fi încărcate.');
      });
    return () => { active = false; };
  }, [tab, software, server.id]);
  useEffect(() => {
    if (tab !== 'Overview') return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const results = await Promise.all([
          ...(canUseConsole ? [apiRequest(`/servers/${server.id}/logs`)] : []),
          apiRequest(`/servers/${server.id}`)
        ]);
        if (!active) return;
        const serverResult = results.at(-1);
        const logResult = canUseConsole ? results[0] : null;
        if (!serverResult.server || (logResult && !Array.isArray(logResult.logs))) throw new Error('API-ul a returnat o stare de server invalidă.');
        if (logResult) setLogs(logResult.logs);
        setServers(prev => prev.map(item => item.id === server.id ? { ...item, ...serverResult.server } : item));
      } catch (error) {
        if (active) onToast(`Starea serverului nu a putut fi actualizată: ${error.message}`);
      }
    };
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tab, server.id, canUseConsole, setLogs, setServers, onToast]);

  const directories = [...new Set(files.map(file => {
    const remainder = file.path.slice(currentFolder.length).replace(/^\//, '');
    const separator = remainder.indexOf('/');
    return separator > -1 ? remainder.slice(0, separator) : '';
  }).filter(Boolean))].sort();
  const visibleFiles = files.filter(file => {
    const remainder = file.path.slice(currentFolder.length).replace(/^\//, '');
    return file.type === 'file' && remainder && !remainder.includes('/') && remainder.toLowerCase().includes(fileSearch.toLowerCase());
  });
  const visiblePlugins = pluginCatalog.filter(plugin => `${plugin.name} ${plugin.description} ${plugin.category}`.toLowerCase().includes(pluginSearch.toLowerCase()));
  const selectedFile = files.find(file => file.path === openFile);
  const minimumJava = versionOptions.find(version => version.id === minecraftVersion)?.javaVersion || 'Java 8';

  async function saveSettings(e) {
    e.preventDefault();
    const properties = `# Configurare server Minecraft\ngamemode=survival\nmax-players=${maxPlayers}\nmotd=${motd}\nonline-mode=true\n`;
    const nextFiles = files.some(file => file.path === 'server.properties')
      ? files.map(file => file.path === 'server.properties' ? { ...file, content: properties } : file)
      : [...files, { path: 'server.properties', content: properties }];
    setFiles(nextFiles);
    try {
      await onUpdate({ name: serverName.trim() || server.name, version: minecraftVersion, javaVersion, software, ram, maxPlayers, motd, eulaAccepted });
      onToast('Setările au fost salvate pe host.');
    } catch (error) {
      onToast(`Setările nu au putut fi salvate: ${error.message}`);
    }
  }
  async function addRam() {
    if (server.ram >= 32) {
      onToast('Serverul are deja 32 GB RAM alocați.');
      return;
    }
    const nextRam = Math.min(32, server.ram + 1);
    try {
      await onUpdate({ ram: nextRam });
      setRam(nextRam);
      onToast(`Alocarea a crescut la ${nextRam} GB RAM.`);
    } catch (error) {
      onToast(`RAM-ul nu a putut fi modificat: ${error.message}`);
    }
  }
  async function openServerFile(filePath) {
    try {
      const { content } = await apiRequest(`/servers/${server.id}/files/${encodeURIComponent(filePath)}`);
      setFiles(prev => prev.map(file => file.path === filePath ? { ...file, content } : file));
      setOpenFile(filePath);
    } catch (error) {
      onToast(`Fișierul nu a putut fi deschis: ${error.message}`);
    }
  }
  function changeFileContent(content) {
    setFiles(prev => prev.map(file => file.path === openFile ? { ...file, content } : file));
  }
  async function saveFiles() {
    if (!selectedFile) return;
    try {
      await apiRequest(`/servers/${server.id}/files/${encodeURIComponent(selectedFile.path)}`, { method: 'PUT', body: { content: selectedFile.content } });
      onToast('Fișierul a fost salvat pe host.');
    } catch (error) {
      onToast(`Fișierul nu a putut fi salvat: ${error.message}`);
    }
  }
  async function addFile() {
    const path = `${currentFolder}${currentFolder ? '/' : ''}nou.txt`;
    if (files.some(file => file.path === path)) {
      onToast('Fișierul nou.txt există deja în acest folder.');
      return;
    }
    try {
      await apiRequest(`/servers/${server.id}/files`, { method: 'POST', body: { path, content: '' } });
      const { files: serverFiles } = await apiRequest(`/servers/${server.id}/files`);
      if (!Array.isArray(serverFiles)) throw new Error('API-ul nu a returnat lista fișierelor.');
      setFiles(normalizeServerFiles(serverFiles));
      setCurrentFolder(currentFolder);
      await openServerFile(path);
    } catch (error) {
      onToast(`Fișierul nu a putut fi creat: ${error.message}`);
    }
  }
  async function togglePlugin(id) {
    const next = installedPlugins.includes(id)
      ? installedPlugins.filter(pluginId => pluginId !== id)
      : [...installedPlugins, id];
    const plugin = pluginCatalog.find(item => item.id === id);
    try {
      await onUpdate({ plugins: next });
      onToast(`${plugin?.name || 'Plugin'} ${next.includes(id) ? 'adăugat la' : 'eliminat din'} lista serverului.`);
    } catch (error) {
      onToast(`Pluginul nu a putut fi actualizat: ${error.message}`);
    }
  }

  return <section className="server-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Înapoi la servere</button>
    <div className="server-hero">
      <div className="server-hero-main"><div className="server-symbol"><Box size={24}/></div><div><div className="eyebrow">MINEFORY SERVER</div><h1>{server.name}</h1><p>{server.software || 'Paper'} · Minecraft {server.version} · {server.id}</p></div></div>
      <div className="server-hero-actions"><Status status={server.status}/>{canDelete && <button className="danger-outline" onClick={onDelete}><Trash2 size={15}/> Șterge</button>}</div>
    </div>
    {canManage && <div className="detail-actions"><button className="small-btn green-action" onClick={()=>onStatus('Online')}><Play size={15}/> Pornește</button><button className="small-btn" onClick={()=>onStatus('Offline')}><Square size={15}/> Oprește</button><button className="small-btn" onClick={onRestart}><RotateCw size={15}/> Repornește</button></div>}
    <div className="server-tabs" role="tablist" aria-label="Secțiuni server">{[
      { name: 'Overview', label: 'Prezentare', icon: <Activity size={16}/> },
      ...(canManageFiles ? [{ name: 'Files', label: 'Fișiere', icon: <Folder size={16}/> }] : []),
      ...(canManage ? [
        { name: 'Plugins', label: 'Pluginuri', icon: <Plug size={16}/> },
        { name: 'Settings', label: 'Setări', icon: <Settings size={16}/> }
      ] : [])
    ].map(item=><button key={item.name} role="tab" aria-selected={tab===item.name} className={`server-tab ${tab===item.name?'active':''}`} onClick={()=>setTab(item.name)}>{item.icon}{item.label}</button>)}</div>
    {tab === 'Overview' && <>
      <div className="server-overview-grid">
        <div className="server-info-card"><span>ADRESĂ SERVER</span><b>{server.address}</b></div>
        <div className="server-info-card ram-info-card"><span>MEMORIE RAM</span><b>{server.ram} GB configurați</b>{canManage && <button className="ram-upgrade-btn" onClick={addRam} disabled={server.ram >= 32}><Plus size={13}/> Adaugă 1 GB</button>}</div>
        <div className="server-info-card"><span>PROCESOR</span><b>—</b></div>
        <div className="server-info-card"><span>JUCĂTORI ONLINE</span><b>—</b></div>
      </div>
      {canUseConsole && <div className="panel-card server-console-card"><div className="console-head"><div><Terminal size={17}/><b>Consolă</b><span className="demo-label">HOST API</span></div><button className="clear-btn" onClick={onClearLogs}>Curăță</button></div><div className="console-output">{logs.map((line,index)=><div key={`${index}-${line}`}>{line}</div>)}</div><form className="console-form" onSubmit={onCommand}><span>$</span><input value={consoleInput} onChange={e=>setConsoleInput(e.target.value)} placeholder="Scrie o comandă..." /><button type="submit">Trimite</button></form></div>}
    </>}
    {tab === 'Files' && <div className="panel-card server-section-card">
      <div className="section-heading"><div><div className="eyebrow">FILE MANAGER</div><h2>Fișierele serverului</h2><p>Explorează și editează fișierele de configurare de pe host.</p></div>{canManageFiles && <button className="small-btn" onClick={addFile}><Plus size={15}/> Fișier nou</button>}</div>
      <div className="file-toolbar"><div className="file-breadcrumb"><button onClick={()=>{setCurrentFolder('');setOpenFile('');}}>server</button>{currentFolder && <><ChevronRight size={14}/><button onClick={()=>setOpenFile('')}>{currentFolder}</button></>}</div><div className="search-box file-search"><Search size={15}/><input value={fileSearch} onChange={e=>setFileSearch(e.target.value)} placeholder="Caută fișier..."/></div></div>
      <div className="file-manager">
        <div className="file-list">{directories.map(directory=><button key={directory} className="file-row" onClick={()=>{setCurrentFolder(`${currentFolder}${currentFolder?'/':''}${directory}`);setOpenFile('');}}><Folder size={17}/><span><b>{directory}</b><small>Folder</small></span><ChevronRight size={15}/></button>)}{visibleFiles.map(file=><button key={file.path} className={`file-row ${openFile===file.path?'selected':''}`} onClick={()=>setOpenFile(file.path)}><FileText size={17}/><span><b>{file.path.slice(file.path.lastIndexOf('/')+1)}</b><small>Fișier de configurare</small></span><ChevronRight size={15}/></button>)}{directories.length===0&&visibleFiles.length===0&&<div className="file-empty">Nu există fișiere în acest folder.</div>}</div>
        <div className="file-editor">{selectedFile ? <><div className="file-editor-head"><div><Code2 size={16}/><b>{selectedFile.path}</b></div>{canManageFiles && <button className="small-btn" onClick={saveFiles}><Save size={14}/> Salvează</button>}</div><textarea aria-label={`Conținutul fișierului ${selectedFile.path}`} spellCheck="false" value={selectedFile.content} onChange={e=>changeFileContent(e.target.value)} readOnly={!canManageFiles}/></> : <div className="file-placeholder"><FileText size={25}/><b>Selectează un fișier</b><span>Alege un fișier din listă pentru a-i vedea conținutul.</span></div>}</div>
      </div>
      <div className="demo-notice"><Zap size={14}/> Fișierele text sunt citite și salvate pe host. Serverul trebuie oprit înainte de editare.</div>
    </div>}
    {tab === 'Plugins' && canManage && <div className="panel-card server-section-card">
      <div className="section-heading"><div><div className="eyebrow">PLUGIN MANAGER</div><h2>Pluginuri</h2><p>Descoperă pluginuri și gestionează lista serverului.</p></div><span className="plugin-count">{installedPlugins.length} în listă</span></div>
      {software === 'Vanilla' && <div className="compatibility-notice"><ShieldCheck size={17}/><span>Pluginurile Bukkit necesită software Paper sau Spigot. Schimbă software-ul din setările serverului pentru a le activa.</span></div>}
      <div className="search-box plugin-search"><Search size={16}/><input value={pluginSearch} onChange={e=>setPluginSearch(e.target.value)} placeholder="Caută după nume sau categorie..."/></div>
      {visiblePlugins.length ? <div className="plugin-grid">{visiblePlugins.map(plugin=>{const isInstalled=installedPlugins.includes(plugin.id);return <article className="plugin-card" key={plugin.id}><div className="plugin-card-top"><div className="plugin-icon"><Plug size={18}/></div><span className={`plugin-category ${plugin.category==='Protecție'?'security':''}`}>{plugin.category}</span></div><h3>{plugin.name}</h3><p>{plugin.description}</p><button className={`plugin-action ${isInstalled?'installed':''}`} disabled={software==='Vanilla'} onClick={()=>togglePlugin(plugin.id)}>{isInstalled?<><span className="installed-dot"/> În listă</>:<><Download size={14}/> Adaugă în listă</>}</button></article>})}</div> : <div className="file-empty">Nu am găsit pluginuri pentru această căutare.</div>}
      <div className="demo-notice"><Zap size={14}/> Se salvează selecția pluginurilor; fișierele JAR nu se descarcă automat.</div>
    </div>}
    {tab === 'Settings' && canManage && <form className="panel-card server-section-card settings-form" onSubmit={saveSettings}>
      <div className="section-heading"><div><div className="eyebrow">CONFIGURARE SERVER</div><h2>Setări</h2><p>Versiuni, runtime Java și preferințe de joc.</p></div><span className="demo-label">HOST API</span></div>
      <div className="settings-fields">
        <label>Numele serverului<input value={serverName} onChange={e=>setServerName(e.target.value)} maxLength={40} required/></label>
        <label>Versiune Minecraft<select value={minecraftVersion} onChange={e=>{const version=e.target.value;setMinecraftVersion(version);const requirement=versionOptions.find(option=>option.id===version)?.javaVersion;if(requirement)setJavaVersion(current=>Number(current.replace('Java ',''))<Number(requirement.replace('Java ',''))?requirement:current);}}>{versionOptions.map(version=><option key={version.id} value={version.id}>{version.id} · Java {version.javaVersion.replace('Java ','')}+</option>)}</select><small>Alege versiunea pe care dorești să o configurezi.</small></label>
        <label>Software server<select value={software} onChange={e=>setSoftware(e.target.value)}><option>Paper</option><option>Vanilla</option></select><small>Paper permite pluginuri; Vanilla este versiunea oficială fără pluginuri.</small></label>
        <label>Versiune Java<select value={javaVersion} onChange={e=>setJavaVersion(e.target.value)}>{javaVersions.filter(version=>Number(version.replace('Java ',''))>=Number(minimumJava.replace('Java ',''))).map(version=><option key={version}>{version}</option>)}</select><small>Versiunea selectată cere minimum {minimumJava}.</small></label>
        <label>RAM alocat<select value={ram} onChange={e=>setRam(Number(e.target.value))}>{[1,2,3,4,6,8,12,16,24,32].map(amount=><option key={amount} value={amount}>{amount} GB</option>)}</select><small>Poți aloca maximum 32 GB RAM per cont.</small></label>
        <label>Număr maxim de jucători<input type="number" min="1" max="500" value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)} required/></label>
        <label className="settings-wide">Mesaj server (MOTD)<input value={motd} onChange={e=>setMotd(e.target.value)} maxLength={100}/></label>
        <label className="eula-accept"><input type="checkbox" checked={eulaAccepted} onChange={e=>setEulaAccepted(e.target.checked)}/><span>Accept Minecraft EULA și condițiile de utilizare.<small>Serverul nu pornește până nu confirmi acceptarea.</small></span></label>
      </div>
      <div className="settings-footer"><span><Zap size={14}/> Setările se salvează pe host.</span><button className="primary-btn" type="submit"><Save size={15}/> Salvează setările</button></div>
      {versionOptionsError && <div className="login-error" role="alert">{versionOptionsError}</div>}
    </form>}
  </section>;
}
function ServerCard({server,onOpen,onDelete,onToggle,canManage=false,canDelete=false}) {
  return <div className="server-card">
    <div className="server-card-top"><div className="server-symbol"><Box size={20}/></div><div className="server-card-tools"><Status status={server.status}/>{canDelete && <button className="delete-server-btn" aria-label={`Șterge serverul ${server.name}`} title="Șterge serverul" onClick={onDelete}><Trash2 size={15}/></button>}</div></div>
    <button className="server-name" onClick={onOpen}>{server.name}<span>↗</span></button><div className="server-sub">{server.game} · {server.version}</div>
    <div className="server-stats"><div><Cpu size={14}/><span>CPU —</span></div><div><Database size={14}/><span>{server.ram} GB RAM alocați</span></div></div>
    <div className="server-card-bottom"><button className="open-server-btn" onClick={onOpen}>Deschide serverul <ArrowRight size={14}/></button>{canManage && <button className={`power-btn ${server.status==='Online'?'is-on':''}`} onClick={onToggle}>{server.status==='Online'?<Square size={14}/>:<Play size={14}/>} {server.status==='Online'?'Stop':'Start'}</button>}</div>
  </div>;
}

export default App;
