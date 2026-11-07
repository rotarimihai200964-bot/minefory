import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUp, Check, ChevronRight, CircleHelp, Copy,
  Cpu, ExternalLink, LayoutDashboard, LoaderCircle, LogOut, Mail,
  Menu, Plus, RefreshCw, Search, Server, Settings2, Shield, ShieldCheck, Terminal,
  Trash2, UserPlus, Users, X, Zap
} from 'lucide-react';
import { supabase } from './supabase.js';

const navigation = [
  { id: 'overview', label: 'Prezentare', icon: LayoutDashboard },
  { id: 'ubuntu', label: 'Ubuntu Linux', icon: Server },
  { id: 'termux', label: 'Termux', icon: Terminal },
  { id: 'admin', label: 'Admin Panel', icon: Settings2 },
  { id: 'ranks', label: 'Rankuri', icon: Shield }
];

const actions = [
  { id: 'status', label: 'Verifică status', icon: Activity },
  { id: 'resources', label: 'Resurse', icon: Cpu },
  { id: 'service_status', label: 'Status serviciu', icon: Check },
  { id: 'restart_service', label: 'Restart serviciu', icon: RefreshCw }
];

const errorText = error => error instanceof Error ? error.message : 'Operația nu a putut fi efectuată.';

export default function Dashboard({ authUser, role, globalError, onSignOut }) {
  const [activePage, setActivePage] = useState('overview');
  const [machines, setMachines] = useState([]);
  const [members, setMembers] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [machineFormOpen, setMachineFormOpen] = useState(false);
  const [actionResults, setActionResults] = useState({});

  const loadData = useCallback(async () => {
    setError('');
    const [machineResult, memberResult, sectionResult] = await Promise.all([
      supabase.from('minefory_machines').select('id,name,platform,endpoint,service_name,enabled,created_at').order('created_at', { ascending: false }),
      supabase.from('minefory_members').select('email,role,created_at').order('created_at', { ascending: true }),
      supabase.from('minefory_sections').select('id,name,description,url,created_at').order('created_at', { ascending: true })
    ]);
    const failed = [machineResult.error, memberResult.error, sectionResult.error].filter(Boolean);
    if (failed.length) throw failed[0];
    setMachines(machineResult.data || []);
    setMembers(memberResult.data || []);
    setSections(sectionResult.data || []);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadData()
      .catch(error => { if (active) setError(errorText(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadData]);

  const activeConfig = useMemo(() => navigation.find(item => item.id === activePage) || navigation[0], [activePage]);

  function openMachineForm() {
    setActivePage('admin');
    setMachineFormOpen(true);
    setMobileOpen(false);
  }

  async function runAction(machine, action) {
    if (action === 'reboot' && !window.confirm(`Confirmi reboot pentru ${machine.name}? Utilizatorii conectați vor fi deconectați.`)) return;
    const key = `${machine.id}:${action}`;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('host-action', {
        body: { operation: 'action', machine_id: machine.id, action, confirm_reboot: action === 'reboot' }
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setActionResults(previous => ({ ...previous, [machine.id]: { action, data, time: new Date().toLocaleTimeString() } }));
      setNotice(`${actionLabel(action)}: ${machine.name}`);
    } catch (error) {
      setError(`Acțiunea nu a reușit pentru ${machine.name}: ${errorText(error)}`);
    } finally {
      setBusy('');
    }
  }

  async function saveMachine(machine) {
    setBusy('machine');
    setError('');
    setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('host-action', {
        body: { operation: 'configure', machine }
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setNotice('Mașina a fost salvată. Tokenul nu este păstrat în browser.');
      await loadData();
      return true;
    } catch (error) {
      setError(`Mașina nu a putut fi salvată: ${errorText(error)}`);
      return false;
    } finally {
      setBusy('');
    }
  }

  async function deleteMachine(machine) {
    if (!window.confirm(`Ștergi mașina „${machine.name}” și tokenul ei de conectare?`)) return;
    setBusy(`delete:${machine.id}`);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('host-action', {
        body: { operation: 'delete', machine_id: machine.id }
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      await loadData();
      setNotice(`Mașina ${machine.name} a fost ștearsă.`);
    } catch (error) {
      setError(`Mașina nu a putut fi ștearsă: ${errorText(error)}`);
    } finally {
      setBusy('');
    }
  }

  async function addMember(email) {
    setBusy('member');
    setError('');
    setNotice('');
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const { error: insertError } = await supabase.from('minefory_members').insert({ email: normalizedEmail, role: 'co_owner' });
      if (insertError) throw insertError;
      await loadData();
      setNotice(`Co-owner adăugat: ${normalizedEmail}. Contul trebuie creat în Supabase Auth.`);
    } catch (error) {
      setError(`Membrul nu a putut fi adăugat: ${errorText(error)}`);
    } finally {
      setBusy('');
    }
  }

  async function removeMember(email) {
    if (!window.confirm(`Elimini accesul de co-owner pentru ${email}?`)) return;
    setBusy(`member:${email}`);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('minefory_members').delete().eq('email', email);
      if (deleteError) throw deleteError;
      await loadData();
      setNotice(`Accesul a fost eliminat pentru ${email}.`);
    } catch (error) {
      setError(`Membrul nu a putut fi eliminat: ${errorText(error)}`);
    } finally {
      setBusy('');
    }
  }

  async function saveSection(section) {
    setBusy('section');
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await supabase.from('minefory_sections').insert(section);
      if (saveError) throw saveError;
      await loadData();
      setNotice('Secțiunea a fost adăugată.');
      return true;
    } catch (error) {
      setError(`Secțiunea nu a putut fi adăugată: ${errorText(error)}`);
      return false;
    } finally {
      setBusy('');
    }
  }

  async function removeSection(section) {
    if (!window.confirm(`Ștergi secțiunea „${section.name}”?`)) return;
    setBusy(`section:${section.id}`);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('minefory_sections').delete().eq('id', section.id);
      if (deleteError) throw deleteError;
      await loadData();
      setNotice('Secțiunea a fost ștearsă.');
    } catch (error) {
      setError(`Secțiunea nu a putut fi ștearsă: ${errorText(error)}`);
    } finally {
      setBusy('');
    }
  }

  const shownMachines = activePage === 'ubuntu' || activePage === 'termux'
    ? machines.filter(machine => machine.platform === activePage)
    : machines;

  return <div className={`app-shell ${mobileOpen ? 'mobile-nav-open' : ''}`}>
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Zap size={21} fill="currentColor"/></div>
        <div><b>MINEFORY</b><span>HOST WORKSPACE</span></div>
        <button className="mobile-close" type="button" aria-label="Închide meniul" onClick={()=>setMobileOpen(false)}><X size={18}/></button>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="workspace-nav" aria-label="Workspace">
        {navigation.map(item => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} type="button" onClick={()=>{setActivePage(item.id);setMachineFormOpen(false);setMobileOpen(false);}}>
            <Icon size={17}/><span>{item.label}</span>
          </button>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><ShieldCheck size={18}/><b>Acces securizat</b><p>Comenzile sunt limitate la acțiuni prestabilite pentru mașinile tale.</p></div>
        <div className="profile">
          <div className="profile-avatar">{(authUser.email || 'M').slice(0, 1).toUpperCase()}</div>
          <div className="profile-info"><b>{authUser.email}</b><small>{roleLabel(role)}</small></div>
          <button className="logout-btn" type="button" title="Deconectare" aria-label="Deconectare" onClick={onSignOut}><LogOut size={16}/></button>
        </div>
      </div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" type="button" aria-label="Închide meniul" onClick={()=>setMobileOpen(false)}/>}

    <main className="main">
      <header className="topbar">
        <div className="top-left">
          <button className="mobile-menu" type="button" aria-label="Deschide meniul" onClick={()=>setMobileOpen(true)}><Menu size={19}/></button>
          <span className="crumb">Minefory</span><span className="slash">/</span><b>{activeConfig.label}</b>
        </div>
        <span className="system-pill"><i/> {roleLabel(role)} conectat</span>
      </header>
      <section className="content">
        <div className="page-heading">
          <div><div className="eyebrow">MINEFORY HOST CONTROL</div><h1>{activeConfig.label}</h1><p>{pageDescription(activePage)}</p></div>
          <div className="heading-actions"><span className="role-chip"><ShieldCheck size={14}/>{roleLabel(role)}</span><button className="icon-btn" type="button" aria-label="Reîncarcă datele" onClick={()=>{setLoading(true);void loadData().catch(error=>setError(errorText(error))).finally(()=>setLoading(false));}}><RefreshCw size={16}/></button></div>
        </div>
        {globalError && <div className="notice notice-error" role="alert"><AlertTriangle size={17}/><span>{globalError}</span></div>}
        {error && <div className="notice notice-error" role="alert"><AlertTriangle size={17}/><span>{error}</span></div>}
        {notice && <div className="notice notice-success" role="status"><Check size={17}/><span>{notice}</span></div>}
        {loading ? <div className="empty-state"><LoaderCircle className="spin" size={24}/><span>Se încarcă datele...</span></div>
          : <PageContent
              page={activePage}
              machines={shownMachines}
              allMachines={machines}
              machineFormOpen={machineFormOpen}
              members={members}
              sections={sections}
              role={role}
              busy={busy}
              results={actionResults}
              onOpenMachineForm={openMachineForm}
              onCloseMachineForm={()=>setMachineFormOpen(false)}
              onAction={runAction}
              onSaveMachine={saveMachine}
              onDeleteMachine={deleteMachine}
              onAddMember={addMember}
              onRemoveMember={removeMember}
              onSaveSection={saveSection}
              onRemoveSection={removeSection}
            />}
      </section>
    </main>
  </div>;
}

function PageContent({page,machines,allMachines,machineFormOpen,members,sections,role,busy,results,onOpenMachineForm,onCloseMachineForm,onAction,onSaveMachine,onDeleteMachine,onAddMember,onRemoveMember,onSaveSection,onRemoveSection}) {
  if (page === 'admin') return <AdminPanel
    machines={allMachines} sections={sections} role={role} busy={busy} machineFormOpen={machineFormOpen}
    onOpenMachineForm={onOpenMachineForm} onCloseMachineForm={onCloseMachineForm}
    onSaveMachine={onSaveMachine} onDeleteMachine={onDeleteMachine}
    onSaveSection={onSaveSection} onRemoveSection={onRemoveSection}
  />;
  if (page === 'ranks') return <MemberPanel members={members} role={role} busy={busy} onAdd={onAddMember} onRemove={onRemoveMember}/>;
  if (page === 'ubuntu' || page === 'termux') return <MachineList
    machines={machines} platform={page} busy={busy} results={results}
    onAction={onAction} onDelete={onDeleteMachine} onOpenMachineForm={onOpenMachineForm} canManage={role === 'owner' || role === 'co_owner'}
  />;
  return <Overview machines={allMachines} members={members} sections={sections} results={results}/>;
}

function Overview({machines,members,sections,results}) {
  const ubuntuCount = machines.filter(machine=>machine.platform === 'ubuntu').length;
  const termuxCount = machines.filter(machine=>machine.platform === 'termux').length;
  const latest = Object.entries(results).map(([id,result])=>({id,...result})).slice(-4).reverse();
  return <>
    <div className="stats-grid">
      <StatCard icon={Server} label="Mașini înregistrate" value={machines.length} detail="Ubuntu Linux și Termux"/>
      <StatCard icon={Cpu} label="Ubuntu Linux" value={ubuntuCount} detail="Mașini administrate"/>
      <StatCard icon={Terminal} label="Termux" value={termuxCount} detail="Dispozitive administrate"/>
      <StatCard icon={Users} label="Membri workspace" value={members.length} detail="Owner și Co-owner"/>
    </div>
    <section className="section-block">
      <div className="section-title"><div><span className="eyebrow">INFRASTRUCTURĂ</span><h2>Mașinile tale</h2></div></div>
      {machines.length ? <div className="machine-grid">{machines.slice(0,4).map(machine=><MachineCard key={machine.id} machine={machine} result={results[machine.id]} compact/>)}</div>
        : <div className="empty-state"><Server size={23}/><b>Nicio mașină încă</b><span>Adaugă un host Ubuntu sau Termux din Admin Panel.</span></div>}
    </section>
    {sections.length > 0 && <section className="section-block">
      <div className="section-title"><div><span className="eyebrow">SECȚIUNI PERSONALIZATE</span><h2>Linkuri și resurse</h2></div></div>
      <div className="custom-grid">{sections.map(section=><article className="custom-card" key={section.id}><div className="custom-icon"><LayoutDashboard size={18}/></div><div><h3>{section.name}</h3><p>{section.description}</p>{section.url && <a href={section.url} target="_blank" rel="noopener noreferrer">{section.url}<ChevronRight size={14}/></a>}</div></article>)}</div>
    </section>}
    <section className="section-block">
      <div className="section-title"><div><span className="eyebrow">ACTIVITATE RECENTĂ</span><h2>Ultimele verificări</h2></div></div>
      {latest.length ? <div className="activity-list">{latest.map(item=><div className="activity-row" key={`${item.id}-${item.time}`}><span className="activity-dot"/><span>{actionLabel(item.action)}</span><b>{machines.find(machine=>machine.id===item.id)?.name || 'Mașină'}</b><time>{item.time}</time></div>)}</div>
        : <div className="empty-state compact-empty"><Activity size={21}/><span>Acțiunile efectuate vor apărea aici.</span></div>}
    </section>
  </>;
}

function MachineList({machines,platform,busy,results,onAction,onDelete,onOpenMachineForm,canManage}) {
  return <section className="section-block">
    <div className="section-title"><div><span className="eyebrow">{platform === 'ubuntu' ? 'SERVER LINUX' : 'ANDROID LINUX ENVIRONMENT'}</span><h2>{platform === 'ubuntu' ? 'Ubuntu Linux' : 'Termux'} <span className="count-chip">{machines.length}</span></h2></div></div>
    <div className="info-banner"><CircleHelp size={17}/><p>Comenzile rulează numai prin agentul Minefory instalat pe mașina ta. Nu există terminal cu text liber; acțiunile sunt fixe și verificate.</p></div>
    {machines.length ? <div className="machine-grid">{machines.map(machine=><MachineCard key={machine.id} machine={machine} result={results[machine.id]} busy={busy} onAction={onAction} onDelete={onDelete} canManage={canManage}/>)}</div>
      : <div className="empty-state"><Server size={23}/><b>Niciun host {platform === 'ubuntu' ? 'Ubuntu' : 'Termux'}</b><span>Înregistrează o mașină din Admin Panel și instalează agentul pe host.</span></div>}
    <p className="subtle-note">Pentru Termux, restart serviciu cere pachetul <code>termux-services</code>. Reboot nu este disponibil din Termux.</p>
    <HostConsole platform={platform} canManage={canManage} onOpenMachineForm={onOpenMachineForm}/>
  </section>;
}

const hostResources = [
  { name: 'Ubuntu Server', platform: 'ubuntu', description: 'Documentație oficială pentru instalare și administrare servere Ubuntu.', url: 'https://ubuntu.com/server/docs' },
  { name: 'Termux', platform: 'termux', description: 'Site-ul oficial și informații despre instalarea Termux.', url: 'https://termux.dev/en/' },
  { name: 'Termux Wiki', platform: 'termux', description: 'Ghiduri comunitare despre pachete, servicii și utilizare Termux.', url: 'https://wiki.termux.com/wiki/Main_Page' },
  { name: 'Cloudflare Tunnel', platform: 'all', description: 'Documentație oficială pentru acces HTTPS către agentul local fără expunerea portului.', url: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/' },
  { name: 'Minefory pe GitHub', platform: 'all', description: 'Codul agentului Minefory și instrucțiunile complete de instalare.', url: 'https://github.com/rotarimihai200964-bot/minefory' },
  { name: 'Supabase Edge Functions', platform: 'all', description: 'Documentație pentru funcția securizată care transmite acțiunile către host.', url: 'https://supabase.com/docs/guides/functions' }
];

function hostCommands(platform) {
  const isTermux = platform === 'termux';
  return [
    { label: '1. Instalează pachetele necesare', description: isTermux ? 'Instalează Python și Git în Termux.' : 'Instalează Python 3 și Git pe Ubuntu.', command: isTermux ? 'pkg update && pkg install -y python git' : 'sudo apt update && sudo apt install -y python3 git' },
    { label: '2. Descarcă agentul Minefory', description: 'Clonează repository-ul oficial și intră în folderul proiectului.', command: 'git clone https://github.com/rotarimihai200964-bot/minefory.git && cd minefory' },
    { label: '3. Generează un token privat', description: 'Păstrează tokenul doar pe host și în formularul Admin Panel. Nu îl publica și nu îl trimite nimănui.', command: isTermux ? 'python -c "import secrets; print(secrets.token_urlsafe(48))"' : 'python3 -c "import secrets; print(secrets.token_urlsafe(48))"' },
    { label: '4. Pornește agentul', description: 'Înlocuiește TOKEN_GENERAT cu tokenul de mai sus. Agentul rămâne pornit în terminalul curent.', command: isTermux ? "export MINEFORY_AGENT_TOKEN='TOKEN_GENERAT'; export MINEFORY_PLATFORM=termux; python host-agent/agent.py" : "export MINEFORY_AGENT_TOKEN='TOKEN_GENERAT'; export MINEFORY_PLATFORM=ubuntu; export MINEFORY_SERVICE_NAME='minefory.service'; python3 host-agent/agent.py" },
    ...(isTermux ? [{ label: 'Opțional: servicii Termux', description: 'Instalează termux-services doar dacă vrei să verifici/repornești un serviciu configurat.', command: 'pkg install termux-services' }] : [{ label: 'Status serviciu Ubuntu', description: 'Exemplu de verificare locală pentru serviciul configurat pe host.', command: 'systemctl status minefory.service --no-pager' }]),
    { label: 'Resurse disc', description: 'Afișează spațiul folosit și disponibil pe host.', command: isTermux ? 'df -h "$PREFIX"' : 'df -h /' }
  ];
}

function HostConsole({platform,canManage,onOpenMachineForm}) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  const term = query.trim().toLocaleLowerCase();
  const commands = hostCommands(platform).filter(item => !term || (item.label + ' ' + item.description + ' ' + item.command).toLocaleLowerCase().includes(term));
  const resources = hostResources.filter(item => (item.platform === platform || item.platform === 'all') && (!term || (item.name + ' ' + item.description + ' ' + item.platform).toLocaleLowerCase().includes(term)));

  async function copyCommand(item) {
    try {
      await navigator.clipboard.writeText(item.command);
      setCopied(item.label); setCopyError('');
      window.setTimeout(() => setCopied(current => current === item.label ? '' : current), 1800);
    } catch { setCopyError('Nu s-a putut copia comanda. Selecteaz-o și copiaz-o manual.'); }
  }

  const webSearchUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(query.trim() + ' ' + (platform === 'termux' ? 'Termux' : 'Ubuntu') + ' host setup');
  return <section className="host-console" aria-labelledby={platform + '-console-title'}>
    <div className="host-console-heading"><div><span className="eyebrow">GHID DE CONFIGURARE</span><h2 id={platform + '-console-title'}><Terminal size={19}/> Consolă {platform === 'termux' ? 'Termux' : 'Ubuntu'}</h2><p>Comenzi verificate pentru configurarea hostului. Copiază-le și rulează-le doar pe mașina ta.</p></div>
      <div className="host-console-actions">{canManage && <button className="primary-btn small-btn" type="button" onClick={onOpenMachineForm}><Plus size={14}/>Adaugă host</button>}<span className="console-badge"><i/> COMENZI LOCALE</span></div></div>
    <label className="resource-search"><Search size={17}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Caută comenzi, ghiduri sau site-uri..." aria-label="Caută comenzi și site-uri de ajutor"/></label>
    {copyError && <p className="console-error" role="alert">{copyError}</p>}
    <div className="console-columns"><div className="console-command-list"><div className="console-subheading"><b>Comenzi și scripturi de configurare</b><span>{commands.length}</span></div>
      {commands.length ? commands.map(item=><article className="command-card" key={item.label}><div className="command-card-heading"><div><b>{item.label}</b><p>{item.description}</p></div><button className="icon-btn" type="button" aria-label={'Copiază: ' + item.label} onClick={()=>void copyCommand(item)}><Copy size={15}/></button></div><pre><code>{item.command}</code></pre>{copied === item.label && <span className="copy-feedback" role="status">Comandă copiată</span>}</article>) : <div className="empty-state compact-empty">Nu am găsit comenzi pentru „{query}”.</div>}
    </div><div className="console-resource-list"><div className="console-subheading"><b>Site-uri și documentație</b><span>{resources.length}</span></div>
      {resources.length ? resources.map(resource=><a className="resource-card" href={resource.url} key={resource.name} target="_blank" rel="noopener noreferrer"><span><b>{resource.name}</b><small>{resource.description}</small></span><ExternalLink size={15}/></a>) : <div className="empty-state compact-empty">Nu am găsit ghiduri potrivite.</div>}
      {term && <a className="web-search-link" href={webSearchUrl} target="_blank" rel="noopener noreferrer"><Search size={14}/> Caută „{query.trim()}” pe web <ExternalLink size={13}/></a>}
    </div></div>
    <div className="info-banner console-safety-note"><ShieldCheck size={17}/><p>Minefory nu execută text introdus în această consolă. Comenzile sunt afișate pentru copiere manuală; folosește doar surse de încredere. Configurează un Cloudflare Tunnel către <code>http://127.0.0.1:8787</code>, apoi apasă <b>Adaugă host</b> și completează URL-ul HTTPS al tunelului, platforma și tokenul privat.</p></div>
  </section>;
}

function MachineCard({machine,result,busy='',onAction,onDelete,canManage=false,compact=false}) {
  const supportedActions = actions.filter(action =>
    ['status', 'resources'].includes(action.id)
    || (machine.service_name && ['service_status', 'restart_service'].includes(action.id))
  );
  return <article className="machine-card">
    <div className="machine-head">
      <div className={`machine-icon ${machine.platform}`}><PlatformIcon platform={machine.platform}/></div>
      <div className="machine-title"><h3>{machine.name}</h3><span>{machine.platform === 'ubuntu' ? 'Ubuntu Linux' : 'Termux'}</span></div>
      <span className={`status-tag ${result ? 'status-online' : 'status-unknown'}`}><i/>{result ? 'RĂSPUNDE' : 'NEVERIFICAT'}</span>
    </div>
    {!compact && <div className="machine-meta">
      <span><span className="meta-label">Endpoint</span><code>{machine.endpoint}</code></span>
      {machine.service_name && <span><span className="meta-label">Serviciu allowlist</span><code>{machine.service_name}</code></span>}
    </div>}
    {result && <ResultPanel result={result}/>}
    {!compact && <div className="machine-actions">
      {supportedActions.map(action=><button className="action-btn" type="button" key={action.id} disabled={!!busy} onClick={()=>onAction(machine,action.id)}><action.icon size={14}/>{action.label}{busy === `${machine.id}:${action.id}` && <LoaderCircle className="spin" size={13}/>}</button>)}
      {machine.platform === 'ubuntu' && <button className="action-btn action-warning" type="button" disabled={!!busy} onClick={()=>onAction(machine,'reboot')}><RefreshCw size={14}/>Reboot{busy === `${machine.id}:reboot` && <LoaderCircle className="spin" size={13}/>}</button>}
      {canManage && onDelete && <button className="icon-btn icon-danger" type="button" title="Șterge mașina" aria-label={`Șterge ${machine.name}`} disabled={!!busy} onClick={()=>onDelete(machine)}><Trash2 size={15}/></button>}
    </div>}
  </article>;
}

function ResultPanel({result}) {
  const data = result.data?.result || result.data || {};
  const metrics = [
    ['Uptime', data.uptime],
    ['CPU', data.cpu_percent == null ? null : `${data.cpu_percent}%`],
    ['Memorie', data.memory_percent == null ? null : `${data.memory_percent}%`],
    ['Disc', data.disk_percent == null ? null : `${data.disk_percent}%`],
    ['Serviciu', data.service_status]
  ].filter(([,value])=>value !== undefined && value !== null);
  return <div className="result-panel" role="status"><div><Check size={14}/><b>{actionLabel(result.action)}</b><time>{result.time}</time></div>
    {data.message && <p>{data.message}</p>}
    {metrics.length > 0 && <div className="metric-list">{metrics.map(([label,value])=><span key={label}><small>{label}</small><b>{value}</b></span>)}</div>}
  </div>;
}

function AdminPanel({machines,sections,role,busy,machineFormOpen,onOpenMachineForm,onCloseMachineForm,onSaveMachine,onDeleteMachine,onSaveSection,onRemoveSection}) {
  const [showSectionForm,setShowSectionForm] = useState(false);
  const canManage = role === 'owner' || role === 'co_owner';
  return <>
    <div className="admin-grid">
      <section className="panel-card">
        <div className="section-title"><div><span className="eyebrow">HOSTURI</span><h2>Mașini conectate</h2></div>{canManage && <button className="primary-btn small-btn" type="button" onClick={onOpenMachineForm}><Plus size={15}/>Adaugă host</button>}</div>
        <p className="panel-description">Endpointurile sunt păstrate în baza de date; tokenurile de agent sunt salvate exclusiv server-side.</p>
        {machines.length ? <div className="admin-list">{machines.map(machine=><div className="admin-list-row" key={machine.id}><div className={`machine-icon small ${machine.platform}`}><PlatformIcon platform={machine.platform}/></div><span><b>{machine.name}</b><small>{machine.platform === 'ubuntu' ? 'Ubuntu Linux' : 'Termux'}</small></span><button className="icon-btn icon-danger" type="button" aria-label={`Șterge ${machine.name}`} disabled={!!busy} onClick={()=>onDeleteMachine(machine)}><Trash2 size={14}/></button></div>)}</div>
          : <div className="empty-state compact-empty"><Server size={20}/><span>Adaugă primul tău host.</span></div>}
      </section>
      <section className="panel-card">
        <div className="section-title"><div><span className="eyebrow">PERSONALIZARE</span><h2>Secțiuni și resurse</h2></div>{canManage && <button className="primary-btn small-btn" type="button" onClick={()=>setShowSectionForm(true)}><Plus size={15}/>Adaugă secțiune</button>}</div>
        <p className="panel-description">Adaugă linkuri și descrieri pentru orice resursă vrei să apară în workspace.</p>
        {sections.length ? <div className="admin-list">{sections.map(section=><div className="admin-list-row" key={section.id}><div className="section-list-icon"><LayoutDashboard size={15}/></div><span><b>{section.name}</b><small>{section.url || section.description}</small></span><button className="icon-btn icon-danger" type="button" aria-label={`Șterge ${section.name}`} disabled={!!busy} onClick={()=>onRemoveSection(section)}><Trash2 size={14}/></button></div>)}</div>
          : <div className="empty-state compact-empty"><LayoutDashboard size={20}/><span>Nu ai adăugat secțiuni personalizate.</span></div>}
      </section>
    </div>
    <section className="section-block admin-warning"><ShieldCheck size={18}/><div><b>Comenzi cu allowlist</b><p>Nu se acceptă comenzi arbitrare. Agentul permite doar status, resurse, status/restart pentru serviciul configurat și reboot Ubuntu cu confirmare.</p></div></section>
    {machineFormOpen && <MachineForm busy={busy==='machine'} onClose={onCloseMachineForm} onSave={async machine=>{if(await onSaveMachine(machine))onCloseMachineForm();}}/>}
    {showSectionForm && <SectionForm busy={busy==='section'} onClose={()=>setShowSectionForm(false)} onSave={async section=>{if(await onSaveSection(section))setShowSectionForm(false);}}/>}
  </>;
}

function MachineForm({busy,onClose,onSave}) {
  const [name,setName] = useState('');
  const [platform,setPlatform] = useState('ubuntu');
  const [endpoint,setEndpoint] = useState('');
  const [serviceName,setServiceName] = useState('');
  const [token,setToken] = useState('');
  const [formError,setFormError] = useState('');
  function submit(event) {
    event.preventDefault();
    setFormError('');
    let parsed;
    try { parsed = new URL(endpoint); } catch { setFormError('Introdu un endpoint HTTPS valid pentru agentul instalat.'); return; }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      setFormError('Endpointul agentului trebuie să fie HTTPS și să nu conțină credențiale sau parametri.');
      return;
    }
    if (token.trim().length < 32) { setFormError('Tokenul agentului trebuie să aibă cel puțin 32 de caractere aleatorii.'); return; }
    if (platform === 'ubuntu' && !/^[a-zA-Z0-9_.@-]+$/.test(serviceName)) { setFormError('Introdu numele serviciului Ubuntu configurat în agent.'); return; }
    void onSave({
      id: crypto.randomUUID(),
      name: name.trim(),
      platform,
      endpoint: parsed.origin + parsed.pathname.replace(/\/+$/, ''),
      service_name: serviceName.trim() || null,
      enabled: true,
      agent_token: token.trim()
    });
  }
  return <Modal title="Adaugă mașină" onClose={onClose}>
    <form className="management-form" onSubmit={submit}>
      <label>Nume<input value={name} onChange={event=>setName(event.target.value)} required maxLength={60} placeholder="Ubuntu principal"/></label>
      <label>Platformă<select value={platform} onChange={event=>setPlatform(event.target.value)}><option value="ubuntu">Ubuntu Linux</option><option value="termux">Termux</option></select></label>
      <label>Endpoint HTTPS al agentului<input type="url" value={endpoint} onChange={event=>setEndpoint(event.target.value)} required placeholder="https://host.exemplu.ro"/></label>
      <label>Serviciu allowlist{platform === 'termux' && ' (opțional)'}<input value={serviceName} onChange={event=>setServiceName(event.target.value)} required={platform === 'ubuntu'} maxLength={100} placeholder={platform === 'ubuntu' ? 'minefory.service' : 'numele serviciului termux-services'}/></label>
      <label>Token generat pe host<input type="password" autoComplete="new-password" value={token} onChange={event=>setToken(event.target.value)} required minLength={32}/><small>Tokenul este transmis către Function și nu se păstrează în browser.</small></label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="modal-actions"><button className="secondary-btn" type="button" onClick={onClose}>Anulează</button><button className="primary-btn" type="submit" disabled={busy || !name.trim()}>{busy ? 'Se salvează...' : 'Salvează hostul'}</button></div>
    </form>
  </Modal>;
}

function SectionForm({busy,onClose,onSave}) {
  const [name,setName] = useState('');
  const [description,setDescription] = useState('');
  const [url,setUrl] = useState('');
  const [formError,setFormError] = useState('');
  function submit(event) {
    event.preventDefault();
    setFormError('');
    if (url.trim()) {
      try {
        const parsed = new URL(url.trim());
        if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      } catch {
        setFormError('Linkul trebuie să fie un URL HTTP sau HTTPS valid, fără credențiale.');
        return;
      }
    }
    void onSave({name:name.trim(),description:description.trim(),url:url.trim() || null});
  }
  return <Modal title="Adaugă secțiune" onClose={onClose}>
    <form className="management-form" onSubmit={submit}>
      <label>Nume secțiune<input value={name} onChange={event=>setName(event.target.value)} required maxLength={60} placeholder="Monitorizare"/></label>
      <label>Descriere<textarea value={description} onChange={event=>setDescription(event.target.value)} required maxLength={300} rows={3}/></label>
      <label>Link (opțional)<input type="url" value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://"/></label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="modal-actions"><button className="secondary-btn" type="button" onClick={onClose}>Anulează</button><button className="primary-btn" type="submit" disabled={busy || !name.trim()}>{busy ? 'Se salvează...' : 'Adaugă'}</button></div>
    </form>
  </Modal>;
}

function MemberPanel({members,role,busy,onAdd,onRemove}) {
  const [email,setEmail] = useState('');
  const isOwner = role === 'owner';
  function submit(event) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return;
    void onAdd(email);
    setEmail('');
  }
  return <>
    <div className="info-banner"><ShieldCheck size={17}/><p><b>Owner</b> are control complet. <b>Co-owner</b> poate administra hosturi și secțiuni, dar nu poate modifica rolurile membrilor.</p></div>
    {isOwner && <section className="panel-card member-add-card"><div className="section-title"><div><span className="eyebrow">ACCES</span><h2>Adaugă Co-owner</h2></div></div>
      <form className="member-add-form" onSubmit={submit}><label htmlFor="co-owner-email">E-mailul contului Supabase</label><div><Mail size={16}/><input id="co-owner-email" type="email" value={email} onChange={event=>setEmail(event.target.value)} required placeholder="nume@exemplu.ro"/><button className="primary-btn small-btn" type="submit" disabled={busy==='member'}><UserPlus size={15}/>{busy==='member'?'Se adaugă...':'Acordă acces'}</button></div></form>
      <p className="panel-description">Contul trebuie creat în Supabase Authentication înainte de a se putea conecta.</p>
    </section>}
    <section className="section-block">
      <div className="section-title"><div><span className="eyebrow">ECHIPĂ</span><h2>Membri și rankuri</h2></div><span className="count-chip">{members.length}</span></div>
      <div className="member-list">{members.map(member=><div className="member-row" key={member.email}><div className="profile-avatar">{member.email.slice(0,1).toUpperCase()}</div><div className="member-info"><b>{member.email}</b><small>{member.role === 'owner' ? 'Owner' : 'Co-owner'}</small></div><span className={`rank-badge ${member.role}`}>{member.role === 'owner' ? 'OWNER' : 'CO-OWNER'}</span>{isOwner && member.role !== 'owner' && <button className="icon-btn icon-danger" type="button" aria-label={`Elimină ${member.email}`} disabled={!!busy} onClick={()=>onRemove(member.email)}><Trash2 size={15}/></button>}</div>)}</div>
    </section>
  </>;
}

function StatCard({icon:Icon,label,value,detail}) {
  return <article className="stat-card"><div className="stat-icon"><Icon size={18}/></div><span>{label}</span><b>{value}</b><small>{detail}</small></article>;
}

function PlatformIcon({platform}) {
  return platform === 'termux' ? <Terminal size={19}/> : <ArrowUp size={19}/>;
}

function Modal({title,onClose,children}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-btn" type="button" aria-label="Închide" onClick={onClose}><X size={17}/></button></div>
      {children}
    </section>
  </div>;
}

function actionLabel(action) {
  return {
    status:'Verificare status', resources:'Citire resurse', service_status:'Status serviciu',
    restart_service:'Restart serviciu', reboot:'Reboot mașină'
  }[action] || 'Acțiune host';
}

function roleLabel(role) {
  return role === 'owner' ? 'Owner' : 'Co-owner';
}

function pageDescription(page) {
  return {
    overview:'Starea infrastructurii și activitatea workspace-ului.',
    ubuntu:'Mașinile Ubuntu Linux înregistrate în workspace.',
    termux:'Dispozitivele Termux înregistrate în workspace.',
    admin:'Gestionează mașini și personalizează resursele workspace-ului.',
    ranks:'Gestionează Owner și Co-owner.'
  }[page] || '';
}
