"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, BrandMark, Eye, EyeOff } from "../components/Icon";
import { getTextColor } from "../lib/colors";
import "./login-updates.css";

const errands = [
  { color: "#FFD9B8", task: "Pay the electric bill", time: "Today, 5:00 PM" },
  { color: "#B8E8E0", task: "Buy milk and eggs", time: "On the way home" },
  { color: "#DCCFF5", task: "Submit the project file", time: "Due 11:59 PM" },
  { color: "#F7CADB", task: "Call mom", time: "6:30 PM" },
  { color: "#FFF0A8", task: "Book the dentist", time: "This week" },
  { color: "#C5DDF8", task: "Announce the new memo", time: "Now" },
];

type LoginField = "email" | "password";

export default function LoginPage() {
  return <main className="login-shell">
    <section className="login-art" aria-label="Everyday reminders">
      <div className="art-glow" />
      <div className="art-copy"><h1>Your thoughts,<br />is what we keep.</h1></div>
      <div className="errand-board">{errands.map((note, index) => <div key={note.task} className={"floating-note note-" + (index + 1)} style={{ background: note.color, color: getTextColor(note.color) }}><span className="sticky-tape" /><strong>{note.task}</strong><small>{note.time}</small></div>)}</div>
    </section>
    <section className="login-side"><LoginForm /></section>
  </main>;
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<LoginField | null>(null);
  const [errorAttempt, setErrorAttempt] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isReturning, setIsReturning] = useState<boolean | null>(null);

  useEffect(() => {
    // Browser storage is loaded after hydration to keep the first render stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReturning(localStorage.getItem("notely-returning") !== null);
    if (sessionStorage.getItem("isLoggedIn") === "true") router.replace("/notes");
  }, [router]);

  function clearError() {
    setError("");
    setInvalidField(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let message = "";
    let field: LoginField = "email";
    if (!email.trim()) message = "Email is required.";
    else if (!email.trim().toLowerCase().endsWith("@gmail.com")) message = "Email must end with @gmail.com.";
    else if (password.length <= 8) { message = "Password must be more than 8 characters."; field = "password"; }
    if (message) {
      setError(message);
      setInvalidField(field);
      setErrorAttempt((attempt) => attempt + 1);
      return;
    }
    sessionStorage.setItem("isLoggedIn", "true");
    sessionStorage.setItem("userEmail", email.trim());
    localStorage.setItem("notely-returning", "true");
    router.push("/notes");
  }

  return <form className="login-card" onSubmit={submit} noValidate>
    <Link className="brand" href="/" aria-label="Notely home"><BrandMark /><span>notely</span></Link>
    <h2 className="login-greeting" aria-live="polite">{isReturning === null ? null : isReturning ? <>Welcome back,<br />Good to see you again.</> : <>Welcome,<br />It&apos;s good to see you</>}</h2>
    <p className="form-intro">Sign in to pick up where your thoughts left off.</p>
    <div className={"login-fields" + (error ? " shake" : "")} data-error-cycle={errorAttempt % 2}>
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" placeholder="you@gmail.com" value={email} autoComplete="email" onChange={(event) => { setEmail(event.target.value); clearError(); }} aria-invalid={invalidField === "email"} aria-describedby={invalidField === "email" ? "login-error" : undefined} />
      <div className="field-heading"><label htmlFor="password">Password</label><span id="password-hint">At least 9 characters</span></div>
      <div className="password-wrap"><input id="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} autoComplete="current-password" onChange={(event) => { setPassword(event.target.value); clearError(); }} aria-invalid={invalidField === "password"} aria-describedby={invalidField === "password" ? "password-hint login-error" : "password-hint"} /><button type="button" className="text-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
    </div>
    <button className="login-button" type="submit">Login <ArrowUpRight size={17} /></button>
    <div id="login-error" className="login-error" role="alert"><span key={errorAttempt} className={error ? "visible" : ""}>{error}</span></div>
  </form>;
}
