import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, Server,
  ShieldCheck, Zap
} from 'lucide-react';
import Dashboard from './Dashboard.jsx';
import { supabase, supabaseConfigMissing } from './supabase.js';

const normalizeEmail = email => email.trim().toLowerCase();

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [memberRole, setMemberRole] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [passwordUpdateBusy, setPasswordUpdateBusy] = useState(false);
  const [passwordUpdateError, setPasswordUpdateError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

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
        if (active) setAuthUser(data.session?.user ?? null);
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? `Sesiunea nu a putut fi verificată: ${error.message}` : 'Sesiunea nu a putut fi verificată.');
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (!session) setPasswordRecovery(false);
      setAuthError('');
      setAuthMessage('');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!authUser?.email || !supabase) {
      setMemberRole('');
      setMemberError('');
      setMemberLoading(false);
      return undefined;
    }

    setMemberRole('');
    setMemberLoading(true);
    setMemberError('');
    void supabase.from('minefory_members')
      .select('role')
      .eq('email', normalizeEmail(authUser.email))
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Acest cont nu este membru autorizat Minefory. Cere Owner-ului să te adauge.');
        if (active) setMemberRole(data.role);
      })
      .catch(error => {
        if (active) setMemberError(error instanceof Error ? error.message : 'Rolul contului nu a putut fi verificat.');
      })
      .finally(() => {
        if (active) setMemberLoading(false);
      });

    return () => { active = false; };
  }, [authUser]);

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
      setAuthError('');
    } catch (error) {
      setAuthError(`Deconectarea a eșuat: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
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
  if (memberLoading) return <div className="auth-loading"><div className="welcome-mark"><Zap size={24} fill="currentColor"/></div><span>Se verifică rolul...</span></div>;
  if (!memberRole) return <main className="login-screen"><section className="login-card"><div className="eyebrow">ACCES RESTRICȚIONAT</div><h1>Nu ai acces la workspace</h1><p className="login-subtitle">{memberError || 'Rolul contului nu a putut fi verificat.'}</p><button className="login-submit" type="button" onClick={signOut}>Deconectare</button></section></main>;
  return <Dashboard authUser={authUser} role={memberRole} globalError={authError} onSignOut={signOut}/>;
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
      <div className="eyebrow">ACCES MINEFORY</div>
      <h1>Intră în workspace</h1>
      <p className="login-subtitle">Autentificare securizată pentru membrii autorizați Minefory.</p>
      {!configured && <div className="auth-config-warning"><ShieldCheck size={17}/><span><b>Configurarea Supabase lipsește.</b> Verifică VITE_SUPABASE_URL și VITE_SUPABASE_PUBLISHABLE_KEY în setările locale.</span></div>}
      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Adresă de e-mail</label>
        <div className="login-input-wrap"><Mail size={17}/><input id="login-email" type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required disabled={!configured || busy}/></div>
        <div className="password-label"><label htmlFor="login-password">Parolă</label><button type="button" className="forgot-link" onClick={()=>onReset(email)} disabled={!configured || busy || resetBusy}>{resetBusy ? 'Se trimite...' : 'Ai uitat parola?'}</button></div>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Introdu parola contului tău" value={password} onChange={event=>setPassword(event.target.value)} required disabled={!configured || busy}/><button type="button" className="password-toggle" aria-label={showPassword ? 'Ascunde parola' : 'Afișează parola'} onClick={()=>setShowPassword(!showPassword)} disabled={!configured || busy}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        <button className="login-submit" type="submit" disabled={!configured || busy}>{busy ? 'Se verifică...' : 'Autentifică-te'} {!busy && <ArrowRight size={17}/>}</button>
      </form>
      {error && <div className="login-error auth-response" role="alert">{error}</div>}
      {message && <div className="auth-success" role="status"><Mail size={16}/><span>{message}</span></div>}
      <div className="login-demo"><KeyRound size={15}/><span><b>Acces privat</b> · Cere Owner-ului să îți creeze contul și să îți acorde rolul.</span></div>
    </section>
  </main>;
}
