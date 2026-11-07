import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Check, ExternalLink, Eye, EyeOff, KeyRound, LockKeyhole,
  LogOut, Mail, PanelTop, Save, Server, ShieldCheck, X, Zap
} from 'lucide-react';
import { adminEmail, supabase, supabaseConfigMissing } from './supabase.js';

const normalizeEmail = email => email.trim().toLowerCase();
const panelUrlStorageKey = 'minefory.pterodactyl.url';

function normalizePanelUrl(value) {
  const input = value.trim();
  if (!input) throw new Error('Introdu URL-ul panelului Pterodactyl.');

  const withProtocol = /^https?:\/\//i.test(input)
    ? input
    : `${/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(input) ? 'http' : 'https'}://${input}`;
  let url;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error('Introdu un URL valid, de exemplu http://localhost sau https://panel.exemplu.ro.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('URL-ul trebuie să folosească HTTP sau HTTPS și să nu conțină credențiale ori fragment.');
  }
  return url.toString().replace(/\/+$/, '');
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [passwordUpdateBusy, setPasswordUpdateBusy] = useState(false);
  const [passwordUpdateError, setPasswordUpdateError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [panelUrl, setPanelUrl] = useState('http://localhost');
  const [panelUrlDraft, setPanelUrlDraft] = useState('http://localhost');
  const [panelError, setPanelError] = useState('');
  const [panelSaved, setPanelSaved] = useState(false);
  const [showMobile, setShowMobile] = useState(false);

  useEffect(() => {
    try {
      const savedUrl = window.localStorage.getItem(panelUrlStorageKey);
      if (savedUrl) {
        const normalizedUrl = normalizePanelUrl(savedUrl);
        setPanelUrl(normalizedUrl);
        setPanelUrlDraft(normalizedUrl);
      }
    } catch (error) {
      setPanelError(error instanceof Error ? `Adresa salvată nu a putut fi citită: ${error.message}` : 'Adresa salvată nu a putut fi citită.');
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let active = true;
    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const user = data.session?.user ?? null;
        if (user && normalizeEmail(user.email || '') !== adminEmail) {
          await supabase.auth.signOut();
          if (active) setAuthError('Acest cont nu este administratorul configurat pentru Minefory.');
          return;
        }
        if (active) setAuthUser(user);
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? `Sesiunea nu a putut fi verificată: ${error.message}` : 'Sesiunea nu a putut fi verificată.');
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      if (user && normalizeEmail(user.email || '') !== adminEmail) {
        setAuthUser(null);
        setAuthError('Acest cont nu este administratorul configurat pentru Minefory.');
        setAuthLoading(false);
        window.setTimeout(async () => {
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (data.session?.user && normalizeEmail(data.session.user.email || '') !== adminEmail) {
              const { error: signOutError } = await supabase.auth.signOut();
              if (signOutError) throw signOutError;
            }
            setAuthError('Acest cont nu este administratorul configurat pentru Minefory.');
          } catch (error) {
            setAuthError(`Deconectarea contului neautorizat a eșuat: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
          }
        }, 0);
        return;
      }
      setAuthUser(user);
      setAuthLoading(false);
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

  async function authenticate({ email, password }) {
    if (!supabase) {
      setAuthError('Autentificarea Supabase nu este configurată.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password
      });
      if (error) throw error;
      if (normalizeEmail(data.user.email || '') !== adminEmail) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw new Error(`Acest cont nu este administratorul configurat, iar deconectarea a eșuat: ${signOutError.message}`);
        setAuthError('Acest cont nu este administratorul configurat pentru Minefory.');
        return;
      }
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
      if (error) throw error;
      setAuthUser(null);
    } catch (error) {
      setPanelError(`Deconectarea a eșuat: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
    }
  }

  async function sendPasswordReset(email) {
    if (!supabase) return;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setAuthError('Introdu adresa de e-mail pentru a primi linkul de resetare.');
      return;
    }
    if (normalizedEmail !== adminEmail) {
      setAuthError('Introdu adresa administratorului configurat pentru Minefory.');
      return;
    }
    setResetBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: window.location.origin
      });
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
      setAuthMessage('Parola a fost actualizată.');
    } catch (error) {
      setPasswordUpdateError(error instanceof Error ? error.message : 'Parola nu a putut fi actualizată.');
    } finally {
      setPasswordUpdateBusy(false);
    }
  }

  function savePanelUrl(event) {
    event.preventDefault();
    setPanelError('');
    setPanelSaved(false);
    try {
      const normalizedUrl = normalizePanelUrl(panelUrlDraft);
      window.localStorage.setItem(panelUrlStorageKey, normalizedUrl);
      setPanelUrl(normalizedUrl);
      setPanelUrlDraft(normalizedUrl);
      setPanelSaved(true);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : 'Adresa panelului nu a putut fi salvată.');
    }
  }

  if (authLoading) {
    return <div className="auth-loading"><div className="welcome-mark"><Zap size={24} fill="currentColor"/></div><span>Se verifică sesiunea...</span></div>;
  }
  if (passwordRecovery) {
    return <ResetPassword busy={passwordUpdateBusy} error={passwordUpdateError} onSubmit={updatePassword}/>;
  }
  if (!authUser) {
    return <Login
      error={authError}
      message={authMessage}
      busy={authBusy}
      resetBusy={resetBusy}
      configured={!supabaseConfigMissing}
      onSubmit={authenticate}
      onReset={sendPasswordReset}
    />;
  }

  return <div className={`app-shell ${showMobile ? 'mobile-nav-open' : ''}`}>
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Zap size={21} fill="currentColor"/></div>
        <div><b>MINEFORY</b><span>PTERODACTYL PANEL</span></div>
        <button className="mobile-close" type="button" aria-label="Închide meniul" onClick={()=>setShowMobile(false)}><X size={18}/></button>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <div className="nav-item active"><PanelTop size={17}/> Panel Pterodactyl</div>
      <div className="sidebar-bottom">
        <div className="help-card">
          <ShieldCheck size={18}/>
          <b>Acces administrator</b>
          <p>Adresa panelului este salvată doar în acest browser.</p>
        </div>
        <div className="profile">
          <div className="profile-avatar">{(authUser.email || 'M').slice(0, 1).toUpperCase()}</div>
          <div className="profile-info"><b>{authUser.email}</b><small>Administrator</small></div>
          <button className="logout-btn" type="button" title="Deconectare" aria-label="Deconectare" onClick={signOut}><LogOut size={16}/></button>
        </div>
      </div>
    </aside>
    {showMobile && <button className="mobile-scrim" type="button" aria-label="Închide meniul" onClick={()=>setShowMobile(false)}/>}

    <main className="main">
      <header className="topbar">
        <div className="top-left">
          <button className="mobile-menu" type="button" aria-label="Deschide meniul" onClick={()=>setShowMobile(true)}><PanelTop size={19}/></button>
          <span className="crumb">Minefory</span><span className="slash">/</span><b>Pterodactyl</b>
        </div>
        <span className="system-pill"><i/> Administrator conectat</span>
      </header>
      <section className="content">
        <div className="page-heading">
          <div><div className="eyebrow">HOSTING CONTROL</div><h1>Panel Pterodactyl</h1><p>Configurează adresa panelului și deschide interfața Pterodactyl.</p></div>
        </div>
        <section className="ptero-card">
          <div className="ptero-icon"><PanelTop size={24}/></div>
          <div className="ptero-copy">
            <span className="ptero-status"><i/> GATA DE CONECTARE</span>
            <h2>Conectează panelul tău</h2>
            <p>Introdu adresa instanței Pterodactyl. Pentru o instalare locală, încearcă <code>http://localhost</code> sau adaugă portul configurat, de exemplu <code>http://localhost:8080</code>.</p>
          </div>
          <form className="panel-url-form" onSubmit={savePanelUrl}>
            <label htmlFor="pterodactyl-url">URL Pterodactyl</label>
            <div className="panel-url-input">
              <PanelTop size={17}/>
              <input
                id="pterodactyl-url"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="http://localhost"
                value={panelUrlDraft}
                onChange={event=>{setPanelUrlDraft(event.target.value);setPanelSaved(false);}}
              />
              <button type="submit" className="save-url-btn"><Save size={15}/> Salvează</button>
            </div>
            {panelError && <p className="panel-error" role="alert">{panelError}</p>}
            {panelSaved && <p className="panel-success" role="status"><Check size={14}/> Adresa panelului a fost salvată.</p>}
          </form>
          <div className="ptero-actions">
            <a className="primary-btn ptero-open-btn" href={panelUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16}/> Intră în Pterodactyl
            </a>
            <span>Se va deschide într-o filă nouă.</span>
          </div>
        </section>
        <div className="ptero-note">
          <ShieldCheck size={17}/>
          <p><b>Important:</b> Minefory doar deschide panelul indicat; nu instalează Pterodactyl și nu transmite parole sau chei API. Panelul trebuie instalat și pornit separat. Adresa poate fi <code>http://localhost</code> dacă serviciul local o folosește.</p>
        </div>
      </section>
    </main>
  </div>;
}

function ResetPassword({busy, error, onSubmit}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  async function submit(event) {
    event.preventDefault();
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
    <section className="login-card">
      <div className="login-emblem"><LockKeyhole size={22}/><span/></div>
      <div className="eyebrow">SECURITATE CONT</div>
      <h1>Schimbă parola</h1>
      <p className="login-subtitle">Alege o parolă nouă de cel puțin 8 caractere.</p>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="new-password">Parolă nouă</label>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={event=>setPassword(event.target.value)} required disabled={busy}/></div>
        <label htmlFor="new-password-confirm">Confirmă parola nouă</label>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="new-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} required disabled={busy}/></div>
        {(formError || error) && <div className="login-error" role="alert">{formError || error}</div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Se actualizează...' : 'Actualizează parola'} <ArrowRight size={17}/></button>
      </form>
    </section>
  </main>;
}

function Login({error, message, busy, resetBusy, configured, onSubmit, onReset}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!configured) return;
    await onSubmit({ email: normalizeEmail(email), password });
  }

  return <main className="login-screen">
    <div className="login-glow login-glow-one"/><div className="login-glow login-glow-two"/>
    <section className="login-card">
      <div className="login-emblem"><Server size={23}/><span/></div>
      <div className="eyebrow">ACCES ADMINISTRATOR</div>
      <h1>Intră în panelul tău</h1>
      <p className="login-subtitle">Autentificare securizată pentru contul administrator Minefory.</p>
      {!configured && <div className="auth-config-warning"><ShieldCheck size={17}/><span><b>Configurarea autentificării admin lipsește.</b> Verifică URL-ul, cheia publică și VITE_ADMIN_EMAIL în setările locale.</span></div>}
      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Adresă de e-mail</label>
        <div className="login-input-wrap"><Mail size={17}/><input id="login-email" type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required disabled={!configured || busy}/></div>
        <div className="password-label"><label htmlFor="login-password">Parolă</label><button type="button" className="forgot-link" onClick={()=>onReset(email)} disabled={!configured || busy || resetBusy}>{resetBusy ? 'Se trimite...' : 'Ai uitat parola?'}</button></div>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Introdu parola contului tău" value={password} onChange={event=>setPassword(event.target.value)} required disabled={!configured || busy}/><button type="button" className="password-toggle" aria-label={showPassword ? 'Ascunde parola' : 'Afișează parola'} onClick={()=>setShowPassword(!showPassword)} disabled={!configured || busy}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        <button className="login-submit" type="submit" disabled={!configured || busy}>{busy ? 'Se verifică...' : 'Autentifică-te'} {!busy && <ArrowRight size={17}/>}</button>
      </form>
      {error && <div className="login-error auth-response" role="alert">{error}</div>}
      {message && <div className="auth-success" role="status"><Mail size={16}/><span>{message}</span></div>}
      <div className="login-demo"><KeyRound size={15}/><span><b>Administrator</b> · Autentificarea publică nu este disponibilă.</span></div>
    </section>
  </main>;
}
