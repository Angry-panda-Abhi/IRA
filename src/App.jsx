import { useState, useEffect, useRef, useCallback } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip } from "recharts";

// ─── Config ───────────────────────────────────────────────────────────────────
const ROLES = [
  "Software Engineering", "Data Science / ML", "Product Management",
  "UI / UX Design", "Cybersecurity", "DevOps / Cloud",
];
const SKILLS_MAP = {
  "Software Engineering": ["JavaScript / TypeScript", "Python", "React / Vue / Angular", "Node.js / Backend", "SQL & Databases", "Data Structures & Algorithms", "System Design", "Git & CI/CD", "REST & GraphQL APIs", "Testing Practices"],
  "Data Science / ML": ["Python", "Machine Learning", "Deep Learning", "SQL", "Statistics & Probability", "Data Visualization", "Pandas & NumPy", "TensorFlow / PyTorch", "Feature Engineering", "Model Deployment / MLOps"],
  "Product Management": ["Product Strategy", "User Research", "SQL & Analytics", "A/B Testing", "Agile / Scrum", "Roadmapping", "Figma / Prototyping", "Go-to-Market", "Market Analysis", "OKR Setting"],
  "UI / UX Design": ["Figma", "User Research & Testing", "Wireframing", "Design Systems", "Prototyping", "Interaction Design", "HTML / CSS", "Accessibility", "Information Architecture", "Visual Design"],
  "Cybersecurity": ["Network Security", "Penetration Testing", "Linux / CLI", "Python Scripting", "SIEM Tools", "Cloud Security", "Incident Response", "Risk Assessment", "Cryptography", "CTF Experience"],
  "DevOps / Cloud": ["AWS / Azure / GCP", "Docker & Kubernetes", "CI/CD Pipelines", "Terraform / IaC", "Linux Administration", "Python / Bash", "Monitoring & Observability", "Git & GitOps", "Databases", "Networking Fundamentals"],
};
const EXP_LEVELS = ["Fresh Graduate", "< 1 Year", "1–2 Years", "2–4 Years", "4+ Years"];
const COMPANY_TIERS = [
  { id: "faang", icon: "◈", label: "FAANG & Big Tech", desc: "Google, Meta, Amazon, Microsoft" },
  { id: "unicorn", icon: "◇", label: "Unicorn Startups", desc: "Series C+ high-growth" },
  { id: "midmarket", icon: "◻", label: "Mid-size Tech", desc: "Series B, established firms" },
  { id: "any", icon: "○", label: "Open to All", desc: "Exploring every opportunity" },
];
const CIRC = 2 * Math.PI * 72;

// ─── AI Analysis (Qwen via OpenRouter) ────────────────────────────────────────
// Add your key to .env:  VITE_OPENROUTER_API_KEY=your_key_here
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

async function analyzeReadiness(d) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("Missing VITE_OPENROUTER_API_KEY in your .env file.");
  }

  const resumeSection = d.resumeText
    ? `\nResume Content (extracted text — use this heavily for scoring):\n${d.resumeText.slice(0, 4000)}`
    : `\nBackground context: ${d.resumeSummary || "not provided"}`;

  const prompt = `You are a senior technical recruiter with 15 years at FAANG. Analyze this candidate with surgical precision. Be calibrated, honest, and specific. Return ONLY valid JSON — no markdown, no fences.

Profile:
- Target Role: ${d.role}
- Experience Level: ${d.experience}
- Target Companies: ${d.companyTier}
- Self-selected skills (${d.skills.length}): ${d.skills.join(", ") || "none"}
- Has portfolio/GitHub: ${d.hasPortfolio === true ? "yes" : "no"}
- Self-rated Resume: ${d.resumeRating}/5
- Self-rated Communication: ${d.commRating}/5
- Self-rated Technical: ${d.techRating}/5
${resumeSection}

Return ONLY this JSON (no extra text):
{
  "overallScore": <integer 0-100, genuinely calibrated — penalize overconfidence, missing portfolio, and shallow skill lists>,
  "atsScore": <integer 0-100, specifically how well their profile would pass ATS filters for their target role>,
  "level": "<Novice|Developing|Proficient|Advanced|Expert>",
  "headline": "<One sharp honest sentence about their readiness — mention specific skills or gaps>",
  "hiringProbability": "<Low|Medium|High|Very High> chance at target tier companies",
  "categories": {
    "technical": {"score":<0-100>,"feedback":"<2-3 sentences specific to their skills and role — be precise>"},
    "resume": {"score":<0-100>,"feedback":"<2-3 sentences, include ATS and impact statement analysis if resume provided>"},
    "communication": {"score":<0-100>,"feedback":"<2-3 sentences about STAR method readiness and behavioral prep>"},
    "portfolio": {"score":<0-100>,"feedback":"<2-3 sentences about portfolio depth and public work>"},
    "ats": {"score":<0-100>,"feedback":"<2-3 sentences about keyword alignment, formatting, and ATS compatibility>"}
  },
  "strengths": ["<specific strength with evidence>","<specific strength>","<specific strength>"],
  "criticalGaps": ["<specific gap with why it matters>","<gap>","<gap>"],
  "quickWins": [
    {"action":"<concrete action doable in 48h>","impact":"High|Medium","effort":"Low|Medium"},
    {"action":"<concrete action>","impact":"High|Medium","effort":"Low|Medium"},
    {"action":"<concrete action>","impact":"High|Medium","effort":"Low|Medium"}
  ],
  "weeklyPlan": [
    {"week":"Week 1","focus":"<theme>","actions":["<specific action>","<specific action>","<specific action>"]},
    {"week":"Week 2","focus":"<theme>","actions":["<specific action>","<specific action>","<specific action>"]},
    {"week":"Week 3","focus":"<theme>","actions":["<specific action>","<specific action>","<specific action>"]},
    {"week":"Week 4","focus":"<theme>","actions":["<specific action>","<specific action>","<specific action>"]}
  ],
  "interviewQuestions": [
    {"category":"Technical","question":"<realistic hard question for this role>","tip":"<how to answer well>","difficulty":"Easy|Medium|Hard"},
    {"category":"Behavioral","question":"<STAR-method behavioral question>","tip":"<what recruiters look for>","difficulty":"Easy|Medium|Hard"},
    {"category":"Role-Specific","question":"<question specific to their domain>","tip":"<key insight>","difficulty":"Easy|Medium|Hard"},
    {"category":"System Design","question":"<design question appropriate to their level>","tip":"<framework to use>","difficulty":"Medium|Hard"}
  ],
  "salaryBenchmark": {"min":<number in USD>,"max":<number in USD>,"currency":"USD"},
  "nextMilestone": "<The single most impactful thing they can do this week>",
  "competitiveAnalysis": "<2 sentences on how they compare to typical applicants for this role and tier>"
}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": window.location.href, // Recommended by OpenRouter
      "X-Title": "IRA Assessment App" // Recommended by OpenRouter
    },
    body: JSON.stringify({
      model: "qwen/qwen-plus", // OpenRouter's specific model string for Qwen
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 2200,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenRouter API error: ${res.status}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text.replace(/```json\n?|```\n?/g, "").trim());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 80) return "#7fb069";
  if (s >= 65) return "#d4a843";
  if (s >= 50) return "#e07b39";
  if (s >= 35) return "#c0392b";
  return "#8e44ad";
}

function lvlInfo(s) {
  if (s >= 85) return { label: "Expert", col: "#7fb069", bg: "rgba(127,176,105,.13)" };
  if (s >= 70) return { label: "Advanced", col: "#d4a843", bg: "rgba(212,168,67,.11)" };
  if (s >= 55) return { label: "Proficient", col: "#e07b39", bg: "rgba(224,123,57,.11)" };
  if (s >= 35) return { label: "Developing", col: "#e74c3c", bg: "rgba(231,76,60,.1)" };
  return { label: "Novice", col: "#9b59b6", bg: "rgba(155,89,182,.1)" };
}

function useCountUp(target, dur = 2000, active = false) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active || !target) { setV(0); return; }
    let cur = 0;
    const step = target / (dur / 16);
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) { setV(target); clearInterval(t); }
      else setV(Math.floor(cur));
    }, 16);
    return () => clearInterval(t);
  }, [target, active]);
  return v;
}

async function extractTextFromPDF(arrayBuffer) {
  // Use pdf.js loaded from CDN
  if (!window.pdfjsLib) return null;
  try {
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(" ") + "\n";
    }
    return fullText.trim();
  } catch (e) {
    return null;
  }
}

async function extractTextFromFile(file) {
  return new Promise(async (resolve) => {
    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        // Try pdf.js first
        const pdfText = await extractTextFromPDF(e.target.result);
        if (pdfText && pdfText.length > 50) { resolve(pdfText); return; }
        // Fallback: binary scan
        const arr = new Uint8Array(e.target.result);
        let text = "";
        for (let i = 0; i < arr.length; i++) {
          const c = arr[i];
          if (c >= 32 && c <= 126) text += String.fromCharCode(c);
          else if (c === 10 || c === 13) text += " ";
        }
        resolve(text.replace(/\s+/g, " ").trim());
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsText(file);
    }
  });
}

// ─── Load pdf.js ──────────────────────────────────────────────────────────────
function loadPDFJS() {
  if (window.pdfjsLib) return;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; };
  document.head.appendChild(s);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti({ score }) {
  const canvasRef = useRef();
  useEffect(() => {
    if (score < 60) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const pieces = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      r: Math.random() * 6 + 3,
      d: Math.random() * 60 + 20,
      color: ["#7fb069","#d4a843","#e07b39","#5dade2","#af7ac5"][Math.floor(Math.random() * 5)],
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 2 + 1,
      angle: Math.random() * 360,
      spin: (Math.random() - 0.5) * 5,
    }));
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
        p.x += p.vx; p.y += p.vy; p.angle += p.spin;
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    const t = setTimeout(() => cancelAnimationFrame(frame), 3500);
    return () => { cancelAnimationFrame(frame); clearTimeout(t); };
  }, [score]);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999 }} />;
}

// ─── Timer Badge ──────────────────────────────────────────────────────────────
function TimerBadge({ startTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500);
    return () => clearInterval(t);
  }, [startTime]);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const over = elapsed > 120;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 14px", borderRadius: 100,
      background: over ? "rgba(231,76,60,.1)" : "rgba(127,176,105,.08)",
      border: `1px solid ${over ? "rgba(231,76,60,.25)" : "rgba(127,176,105,.2)"}`,
      fontFamily: "'DM Mono', monospace", fontSize: 12,
      color: over ? "#e74c3c" : "#7fb069",
      transition: "all .3s",
    }}>
      <span style={{ fontSize: 9 }}>⏱</span>
      {m}:{s.toString().padStart(2, "0")}
      {over && <span style={{ fontSize: 10 }}>  over 2 min</span>}
    </div>
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ display, target }) {
  const col = scoreColor(target);
  const offset = CIRC * (1 - display / 100);
  return (
    <div style={{ position: "relative", width: 200, height: 200, flexShrink: 0 }}>
      <svg width={200} height={200} viewBox="0 0 200 200" style={{ filter: `drop-shadow(0 0 20px ${col}30)` }}>
        <defs>
          <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={col} />
            <stop offset="100%" stopColor={scoreColor(Math.max(target - 20, 0))} />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <circle cx={100} cy={100} r={72} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={9} />
        <circle cx={100} cy={100} r={72} fill="none" stroke="url(#rg)" strokeWidth={9}
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 2.2s cubic-bezier(.34,1.56,.64,1)" }}
          filter="url(#glow)"
        />
        <text x={100} y={95} textAnchor="middle" fill="#f0ece4" fontSize={42} fontWeight={700} fontFamily="DM Mono,monospace">{display}</text>
        <text x={100} y={113} textAnchor="middle" fill="rgba(255,255,255,.3)" fontSize={11} fontFamily="Outfit,sans-serif" letterSpacing="2">/100</text>
      </svg>
    </div>
  );
}

// ─── ATS Meter ────────────────────────────────────────────────────────────────
function ATSMeter({ score }) {
  const col = scoreColor(score);
  const zones = [{ label: "Poor", max: 35, col: "#9b59b6" }, { label: "Fair", max: 50, col: "#e74c3c" }, { label: "Good", max: 65, col: "#e07b39" }, { label: "Strong", max: 80, col: "#d4a843" }, { label: "Excellent", max: 100, col: "#7fb069" }];
  const zone = zones.find(z => score <= z.max) || zones[zones.length - 1];
  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>ATS Compatibility</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 700, color: col }}>{score}</div>
          <div style={{ padding: "3px 10px", borderRadius: 100, background: `${zone.col}18`, border: `1px solid ${zone.col}30`, fontSize: 11, color: zone.col, fontFamily: "'DM Mono',monospace" }}>{zone.label}</div>
        </div>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,.06)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg, ${col}80, ${col})`, borderRadius: 8, transition: "width 2s cubic-bezier(.34,1.56,.64,1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {zones.map(z => (
          <div key={z.label} style={{ fontSize: 10, color: score <= z.max && score > (zones[zones.indexOf(z) - 1]?.max || 0) ? z.col : "rgba(255,255,255,.2)", fontFamily: "'DM Mono',monospace" }}>{z.label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0f0e0c;
  --bg2: #151411;
  --bg3: #1c1a16;
  --bg4: #232019;
  --border: rgba(255,255,255,.07);
  --border-h: rgba(255,255,255,.16);
  --text: #f0ece4;
  --muted: #6e6a60;
  --faint: rgba(255,255,255,.04);
  --accent: #d4a843;
  --accent2: #7fb069;
  --accent3: #e07b39;
}

body { background: var(--bg); }

.ira {
  font-family: 'Outfit', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
}

/* Background */
.bg-canvas { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.grain {
  position: absolute; inset: -50%; width: 200%; height: 200%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  opacity: 0.025; animation: grainShift 8s steps(10) infinite;
}
@keyframes grainShift { 0%,100%{transform:translate(0,0)} 10%{transform:translate(-2%,-3%)} 30%{transform:translate(2%,2%)} 50%{transform:translate(-1%,3%)} 70%{transform:translate(3%,-2%)} 90%{transform:translate(-2%,1%)} }
.mesh1 { position:absolute; width:800px; height:800px; top:-250px; right:-200px; background:radial-gradient(ellipse,rgba(212,168,67,.06) 0%,transparent 65%); border-radius:50%; }
.mesh2 { position:absolute; width:700px; height:700px; bottom:-200px; left:-180px; background:radial-gradient(ellipse,rgba(127,176,105,.05) 0%,transparent 65%); border-radius:50%; }
.mesh3 { position:absolute; width:500px; height:500px; top:35%; left:25%; background:radial-gradient(ellipse,rgba(224,123,57,.035) 0%,transparent 65%); border-radius:50%; }
.grid-lines {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px);
  background-size: 64px 64px;
}

/* Layout */
.wrap { position:relative; z-index:1; max-width:940px; margin:0 auto; padding:0 24px 100px; }

/* Animations */
@keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes spin { to{transform:rotate(360deg)} }
@keyframes pulse { 0%,100%{opacity:.35} 50%{opacity:1} }
@keyframes scanLine { 0%{top:-100%} 100%{top:200%} }
@keyframes glow { 0%,100%{opacity:.6} 50%{opacity:1} }

.fu { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) both; }
.fi { animation: fadeIn .4s ease both; }
.d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}
.d4{animation-delay:.2s}.d5{animation-delay:.25s}.d6{animation-delay:.3s}

/* Typography */
.serif { font-family: 'Cormorant Garamond', Georgia, serif; }
.mono  { font-family: 'DM Mono', monospace; }

/* Topbar */
.topbar { display:flex; justify-content:space-between; align-items:center; padding:24px 0 28px; }
.logo-mark {
  font-family: 'Cormorant Garamond', serif;
  font-weight:700; font-size:21px; letter-spacing:.05em; color:var(--text);
  display:flex; align-items:center; gap:10px;
}
.logo-dot { width:7px; height:7px; border-radius:50%; background:var(--accent3); display:inline-block; animation: glow 2.5s ease infinite; box-shadow:0 0 8px var(--accent3); }

/* Progress */
.prog-track { height:1px; background:rgba(255,255,255,.06); margin-bottom:40px; position:relative; }
.prog-fill {
  height:1px; background:linear-gradient(90deg,var(--accent3),var(--accent));
  transition:width .55s cubic-bezier(.22,1,.36,1); position:relative;
}
.prog-fill::after { content:''; position:absolute; right:-1px; top:-4px; width:9px; height:9px; border-radius:50%; background:var(--accent); box-shadow:0 0 12px var(--accent); }

/* Step tag */
.step-tag { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent3); margin-bottom:10px; display:block; }

/* Headings */
.display-h {
  font-family:'Cormorant Garamond',serif; font-weight:600; line-height:1.07;
  background:linear-gradient(145deg,#f5f0e8 30%,var(--accent) 100%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.section-h { font-family:'Cormorant Garamond',serif; font-weight:600; font-size:clamp(26px,4.5vw,40px); line-height:1.12; color:var(--text); margin-bottom:8px; }
.sub-p { font-size:14px; color:var(--muted); line-height:1.8; margin-bottom:28px; font-weight:300; }

/* Cards */
.card {
  background:linear-gradient(145deg,rgba(28,26,22,.95),rgba(21,20,17,.98));
  border:1px solid var(--border); border-radius:18px; padding:24px 26px;
  position:relative; overflow:hidden;
}
.card::before { content:''; position:absolute; inset:0; background:linear-gradient(145deg,rgba(255,255,255,.025) 0%,transparent 55%); pointer-events:none; }
.card-sm {
  background:rgba(21,20,17,.85); border:1px solid var(--border);
  border-radius:13px; padding:16px 20px;
  transition:border-color .22s, background .22s;
}
.card-sm:hover { border-color:var(--border-h); background:rgba(28,26,22,.9); }

/* Scan effect on card */
.card-scan::after {
  content:''; position:absolute; left:0; right:0; height:60px;
  background:linear-gradient(transparent,rgba(212,168,67,.03),transparent);
  animation:scanLine 4s linear infinite; pointer-events:none;
}

/* Buttons */
.btn-primary {
  background:linear-gradient(135deg,#b8732a,var(--accent3));
  color:#fff; font-weight:600; border:none;
  padding:14px 36px; border-radius:11px;
  cursor:pointer; font-family:'Outfit',sans-serif;
  font-size:15px; letter-spacing:.02em;
  transition:all .25s; position:relative; overflow:hidden;
}
.btn-primary::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.1),transparent); }
.btn-primary:hover { transform:translateY(-2px); box-shadow:0 12px 36px rgba(224,123,57,.3); }
.btn-primary:disabled { opacity:.25; cursor:not-allowed; transform:none; box-shadow:none; }

.btn-ghost {
  background:transparent; color:var(--muted);
  border:1px solid rgba(255,255,255,.08);
  padding:12px 22px; border-radius:10px;
  cursor:pointer; font-family:'Outfit',sans-serif;
  font-size:13.5px; transition:all .2s;
}
.btn-ghost:hover { border-color:var(--border-h); color:var(--text); }

.btn-accent {
  background:rgba(127,176,105,.1);
  color:var(--accent2); border:1px solid rgba(127,176,105,.25);
  padding:11px 22px; border-radius:10px;
  cursor:pointer; font-family:'Outfit',sans-serif;
  font-size:13.5px; transition:all .2s;
}
.btn-accent:hover { background:rgba(127,176,105,.15); border-color:rgba(127,176,105,.4); }

/* Select Buttons */
.sel-btn {
  padding:13px 16px; border-radius:11px;
  border:1px solid rgba(255,255,255,.06);
  background:rgba(21,20,17,.7);
  cursor:pointer; font-family:'Outfit',sans-serif;
  font-size:13.5px; color:var(--muted);
  transition:all .22s; text-align:left; width:100%;
}
.sel-btn:hover { border-color:var(--border-h); color:var(--text); background:rgba(28,26,22,.85); }
.sel-btn.active { border-color:rgba(212,168,67,.4); background:rgba(212,168,67,.07); color:var(--text); }

/* Chips */
.chip {
  display:inline-flex; align-items:center; gap:6px;
  padding:8px 15px; border-radius:100px;
  border:1px solid rgba(255,255,255,.06); background:transparent;
  cursor:pointer; font-family:'Outfit',sans-serif;
  font-size:13px; color:var(--muted);
  transition:all .18s; user-select:none;
}
.chip:hover { border-color:var(--border-h); color:var(--accent); }
.chip.active { border-color:rgba(127,176,105,.35); background:rgba(127,176,105,.09); color:var(--text); }
.chip-dot { width:5px; height:5px; border-radius:50%; background:var(--accent2); }

/* Rating */
.rat-btn {
  width:46px; height:46px; border-radius:9px;
  border:1px solid rgba(255,255,255,.06); background:transparent;
  cursor:pointer; font-family:'DM Mono',monospace;
  font-size:13px; color:var(--muted);
  transition:all .18s;
}
.rat-btn:hover { border-color:var(--border-h); color:var(--text); }
.rat-btn.active { background:var(--accent3); border-color:var(--accent3); color:#fff; font-weight:600; }

/* Textarea */
.ta {
  background:rgba(21,20,17,.85); border:1px solid var(--border);
  border-radius:11px; color:var(--text);
  font-family:'Outfit',sans-serif; font-size:14px;
  padding:14px 16px; resize:vertical; width:100%;
  transition:border-color .2s; outline:none; line-height:1.7;
}
.ta:focus { border-color:rgba(212,168,67,.3); }
.ta::placeholder { color:rgba(255,255,255,.12); }

/* Drop Zone */
.drop-zone {
  border:1.5px dashed rgba(255,255,255,.1);
  border-radius:16px; padding:38px 28px;
  text-align:center; cursor:pointer; transition:all .25s;
  background:rgba(21,20,17,.6); position:relative;
}
.drop-zone:hover, .drop-zone.drag-over { border-color:var(--accent); background:rgba(212,168,67,.03); }
.drop-icon {
  width:52px; height:52px; border-radius:14px;
  background:rgba(255,255,255,.04); border:1px solid var(--border);
  margin:0 auto 14px; display:flex; align-items:center; justify-content:center; font-size:22px;
}

/* Dimension bar */
.dim-bar-bg { height:5px; background:rgba(255,255,255,.05); border-radius:5px; overflow:hidden; flex:1; }
.dim-bar-fill { height:100%; border-radius:5px; transition:width 2s cubic-bezier(.34,1.56,.64,1); }

/* Week accordion */
.week-row { border:1px solid rgba(255,255,255,.06); border-radius:12px; overflow:hidden; margin-bottom:7px; transition:border-color .2s; }
.week-row:hover { border-color:var(--border-h); }
.week-head { padding:15px 20px; background:rgba(21,20,17,.85); cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; }
.week-body { padding:16px 20px; background:rgba(15,14,12,.9); border-top:1px solid rgba(255,255,255,.05); }

/* Question card */
.q-card { border:1px solid rgba(255,255,255,.06); border-radius:13px; padding:20px; background:rgba(21,20,17,.75); margin-bottom:11px; transition:border-color .2s; }
.q-card:hover { border-color:var(--border-h); }

/* Lists */
.list-item { display:flex; align-items:flex-start; gap:12px; padding:11px 0; border-bottom:1px solid rgba(255,255,255,.04); }
.list-item:last-child { border-bottom:none; }
.bullet { width:22px; height:22px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; margin-top:1px; }

/* Loading */
.spinner { width:44px; height:44px; border-radius:50%; border:2px solid rgba(255,255,255,.06); border-top-color:var(--accent3); animation:spin 1s linear infinite; }
.loading-item { display:flex; align-items:center; gap:12px; padding:10px 18px; background:rgba(21,20,17,.85); border:1px solid var(--border); border-radius:10px; font-size:13px; color:var(--muted); animation:fadeUp .45s ease both; opacity:0; }
.pulse-dot { width:6px; height:6px; border-radius:50%; background:var(--accent2); flex-shrink:0; animation:pulse 1.5s ease infinite; }

/* Radar chart text */
.recharts-polar-angle-axis-tick-value { fill:var(--muted)!important; font-size:11.5px!important; }

/* Quick win */
.qw-item { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07); border-radius:11px; }

/* Stat badges on landing */
.stat-badge { text-align:center; padding:20px 24px; background:rgba(28,26,22,.8); border:1px solid var(--border); border-radius:16px; }

/* Salary banner */
.salary-banner { background:linear-gradient(135deg,rgba(127,176,105,.08),rgba(212,168,67,.06)); border:1px solid rgba(127,176,105,.15); border-radius:14px; padding:20px 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }

/* Export button */
.btn-export { background:rgba(212,168,67,.08); color:var(--accent); border:1px solid rgba(212,168,67,.2); padding:10px 20px; border-radius:10px; cursor:pointer; font-family:'Outfit',sans-serif; font-size:13px; transition:all .2s; display:flex; align-items:center; gap:7px; }
.btn-export:hover { background:rgba(212,168,67,.13); border-color:rgba(212,168,67,.35); }

/* Mobile tweaks */
@media(max-width:640px){
  .wrap{padding:0 16px 80px;}
  .res-grid{grid-template-columns:1fr!important;}
  .mobile-stack{flex-direction:column!important;}
}
`;

// ─── Results ──────────────────────────────────────────────────────────────────
function ResultsView({ results, role, experience, onReset, scoreDisplay }) {
  const [openWeek, setOpenWeek] = useState(0);
  const lvl = lvlInfo(results.overallScore);
  const cats = [
    { k: "technical", label: "Technical", sym: "T" },
    { k: "resume", label: "Resume & CV", sym: "R" },
    { k: "communication", label: "Communication", sym: "C" },
    { k: "portfolio", label: "Portfolio", sym: "P" },
  ];
  const radarData = [
    { s: "Technical", v: results.categories?.technical?.score || 0 },
    { s: "Resume", v: results.categories?.resume?.score || 0 },
    { s: "Comm.", v: results.categories?.communication?.score || 0 },
    { s: "Portfolio", v: results.categories?.portfolio?.score || 0 },
    { s: "ATS", v: results.atsScore || results.categories?.ats?.score || 0 },
  ];
  const barData = cats.map(c => ({ name: c.label, score: results.categories?.[c.k]?.score || 0 }));

  const copyResults = () => {
    const text = `🎯 Interview Readiness Report\n\nOverall Score: ${results.overallScore}/100 (${results.level})\nATS Score: ${results.atsScore}/100\n\n${results.headline}\n\nStrengths:\n${results.strengths?.map(s => `• ${s}`).join("\n")}\n\nCritical Gaps:\n${results.criticalGaps?.map(g => `• ${g}`).join("\n")}\n\nNext Step: ${results.nextMilestone}`;
    navigator.clipboard.writeText(text).catch(() => {});
    alert("Results copied to clipboard!");
  };

  const probColor = { "Low": "#9b59b6", "Medium": "#e07b39", "High": "#d4a843", "Very High": "#7fb069" };
  const prob = results.hiringProbability || "Medium";

  return (
    <div>
      <Confetti score={results.overallScore} />

      {/* Score Header */}
      <div className="fu" style={{ paddingTop: 48, marginBottom: 32 }}>
        <span className="step-tag">Interview Readiness Report</span>

        {/* Export row */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20, gap: 8, flexWrap: "wrap" }}>
          <button className="btn-export" onClick={copyResults}>📋 Copy Summary</button>
          <button className="btn-export" onClick={onReset}>↩ New Assessment</button>
        </div>

        <div className="card card-scan" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 36, flexWrap: "wrap", alignItems: "center" }} className="mobile-stack">
            <ScoreRing display={scoreDisplay} target={results.overallScore} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ display: "inline-block", background: lvl.bg, border: `1px solid ${lvl.col}40`, borderRadius: 100, padding: "5px 18px", fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: ".1em", textTransform: "uppercase", color: lvl.col }}>{results.level}</div>
                <div style={{ display: "inline-block", background: `${probColor[prob] || "#e07b39"}15`, border: `1px solid ${probColor[prob] || "#e07b39"}30`, borderRadius: 100, padding: "5px 18px", fontSize: 11, fontFamily: "'DM Mono',monospace", color: probColor[prob] || "#e07b39" }}>{prob} hire probability</div>
              </div>
              <p className="serif" style={{ fontSize: "clamp(18px,3vw,26px)", fontWeight: 600, lineHeight: 1.3, marginBottom: 12, color: "#f0ece4" }}>{results.headline}</p>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "var(--muted)", letterSpacing: ".04em" }}>{role} · {experience}</div>

              {results.nextMilestone && (
                <div style={{ marginTop: 18, padding: "12px 16px", background: "rgba(212,168,67,.06)", border: "1px solid rgba(212,168,67,.15)", borderRadius: 10 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 5 }}>This Week's Priority</div>
                  <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>{results.nextMilestone}</div>
                </div>
              )}
            </div>
          </div>

          {/* ATS Meter */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.05)", marginTop: 20, paddingTop: 4 }}>
            <ATSMeter score={results.atsScore || results.categories?.ats?.score || 50} />
          </div>
        </div>

        {/* Salary Benchmark */}
        {results.salaryBenchmark && (
          <div className="salary-banner fu d1" style={{ marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Salary Benchmark</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--accent2)", fontFamily: "'DM Mono',monospace" }}>
                ${results.salaryBenchmark.min?.toLocaleString()} – ${results.salaryBenchmark.max?.toLocaleString()}
                <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>USD/yr</span>
              </div>
            </div>
            {results.competitiveAnalysis && (
              <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{results.competitiveAnalysis}</div>
            )}
          </div>
        )}
      </div>

      {/* Breakdown + Radar */}
      <div className="res-grid fu d2" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,.9fr)", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="step-tag" style={{ marginBottom: 18 }}>Score Breakdown</div>
          {cats.map(({ k, label, sym }) => {
            const c = results.categories?.[k] || { score: 0, feedback: "" };
            const col = scoreColor(c.score);
            return (
              <div key={k} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 25, height: 25, borderRadius: 7, background: `${col}18`, border: `1px solid ${col}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="mono" style={{ fontSize: 10, color: col }}>{sym}</span>
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: col }}>{c.score}</span>
                </div>
                <div className="dim-bar-bg">
                  <div className="dim-bar-fill" style={{ width: `${c.score}%`, background: `linear-gradient(90deg,${col}60,${col})` }} />
                </div>
                <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 7, lineHeight: 1.65 }}>{c.feedback}</p>
              </div>
            );
          })}
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="step-tag" style={{ marginBottom: 8 }}>Skill Radar</div>
          <div style={{ flex: 1, minHeight: 230 }}>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 14, right: 32, bottom: 14, left: 32 }}>
                <PolarGrid stroke="rgba(255,255,255,.06)" />
                <PolarAngleAxis dataKey="s" tick={{ fill: "var(--muted)", fontSize: 11.5, fontFamily: "Outfit,sans-serif" }} />
                <Radar dataKey="v" stroke="#d4a843" fill="#d4a843" fillOpacity={0.08} strokeWidth={1.5} dot={{ fill: "#d4a843", r: 3 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 14, marginTop: 4 }}>
            <div className="step-tag" style={{ marginBottom: 10 }}>Score Distribution</div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,.3)", fontSize: 10, fontFamily: "Outfit,sans-serif" }} axisLine={false} tickLine={false} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={scoreColor(entry.score)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strengths + Gaps */}
      <div className="res-grid fu d3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="step-tag" style={{ color: "#7fb069", marginBottom: 14 }}>✓ Your Strengths</div>
          {results.strengths?.map((s, i) => (
            <div key={i} className="list-item">
              <div className="bullet" style={{ background: "rgba(127,176,105,.09)", border: "1px solid rgba(127,176,105,.2)" }}>
                <span style={{ color: "#7fb069", fontSize: 10 }}>✓</span>
              </div>
              <span style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.65, opacity: .88 }}>{s}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="step-tag" style={{ color: "#e74c3c", marginBottom: 14 }}>! Critical Gaps</div>
          {results.criticalGaps?.map((g, i) => (
            <div key={i} className="list-item">
              <div className="bullet" style={{ background: "rgba(231,76,60,.09)", border: "1px solid rgba(231,76,60,.2)" }}>
                <span style={{ color: "#e74c3c", fontSize: 10 }}>!</span>
              </div>
              <span style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.65, opacity: .88 }}>{g}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Wins */}
      <div className="card fu d4" style={{ marginBottom: 16 }}>
        <div className="step-tag" style={{ color: "var(--accent)", marginBottom: 14 }}>⚡ Quick Wins — Do These First</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
          {results.quickWins?.map((w, i) => {
            const item = typeof w === "string" ? { action: w, impact: "High", effort: "Low" } : w;
            return (
              <div key={i} className="qw-item">
                <div className="mono" style={{ color: "var(--accent)", fontSize: 11, marginTop: 1, flexShrink: 0 }}>0{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6, marginBottom: 6 }}>{item.action}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: item.impact === "High" ? "rgba(127,176,105,.1)" : "rgba(212,168,67,.1)", color: item.impact === "High" ? "#7fb069" : "#d4a843", fontFamily: "'DM Mono',monospace" }}>{item.impact} impact</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(255,255,255,.04)", color: "var(--muted)", fontFamily: "'DM Mono',monospace" }}>{item.effort} effort</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ATS Category Feedback */}
      {results.categories?.ats && (
        <div className="card fu d4" style={{ marginBottom: 16 }}>
          <div className="step-tag" style={{ marginBottom: 10 }}>ATS Compatibility Analysis</div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7 }}>{results.categories.ats.feedback}</p>
        </div>
      )}

      {/* Interview Questions */}
      {results.interviewQuestions?.length > 0 && (
        <div className="fu d5" style={{ marginBottom: 16 }}>
          <h3 className="serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Questions You'll Face</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Calibrated to your role and target tier</p>
          {results.interviewQuestions.map((q, i) => {
            const catColors = { "Technical": "#7fb069", "Behavioral": "#d4a843", "Role-Specific": "#e07b39", "System Design": "#5dade2" };
            const diffColors = { "Easy": "#7fb069", "Medium": "#d4a843", "Hard": "#e74c3c" };
            const col = catColors[q.category] || "var(--muted)";
            return (
              <div key={i} className="q-card">
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ padding: "3px 10px", borderRadius: 100, background: `${col}12`, color: col, border: `1px solid ${col}22`, fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: ".1em", textTransform: "uppercase" }}>{q.category}</div>
                  {q.difficulty && <div style={{ padding: "3px 10px", borderRadius: 100, background: `${diffColors[q.difficulty] || "#e07b39"}12`, color: diffColors[q.difficulty] || "#e07b39", border: `1px solid ${diffColors[q.difficulty] || "#e07b39"}22`, fontSize: 10, fontFamily: "'DM Mono',monospace" }}>{q.difficulty}</div>}
                </div>
                <p className="serif" style={{ fontSize: 18, color: "var(--text)", lineHeight: 1.6, marginBottom: 10, fontStyle: "italic" }}>"{q.question}"</p>
                <div style={{ padding: "10px 12px", background: "rgba(255,255,255,.025)", borderRadius: 8, display: "flex", gap: 8 }}>
                  <span style={{ color: col, fontSize: 11, flexShrink: 0, marginTop: 1 }}>→</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65 }}>{q.tip}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 30-Day Plan */}
      <div className="fu" style={{ marginBottom: 28 }}>
        <h3 className="serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>30-Day Preparation Roadmap</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Structured path from where you are to where you need to be</p>
        {results.weeklyPlan?.map((w, i) => (
          <div key={i} className="week-row">
            <div className="week-head" onClick={() => setOpenWeek(openWeek === i ? -1 : i)}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--accent3)", letterSpacing: ".1em" }}>{w.week?.toUpperCase()}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{w.focus}</div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 11, transform: openWeek === i ? "rotate(180deg)" : "none", transition: "transform .2s", display: "inline-block" }}>▾</span>
            </div>
            {openWeek === i && (
              <div className="week-body">
                {w.actions?.map((a, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: j < w.actions.length - 1 ? 10 : 0 }}>
                    <div className="mono" style={{ color: "var(--accent3)", fontSize: 11, flexShrink: 0, marginTop: 1.5 }}>{j + 1}.</div>
                    <span style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.65 }}>{a}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", paddingTop: 12 }}>
        <button className="btn-ghost" onClick={onReset}>← Start a New Assessment</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [companyTier, setCompanyTier] = useState("");
  const [skills, setSkills] = useState([]);
  const [hasPortfolio, setHasPortfolio] = useState(null);
  const [resumeRating, setResumeRating] = useState(3);
  const [commRating, setCommRating] = useState(3);
  const [techRating, setTechRating] = useState(3);
  const [resumeSummary, setResumeSummary] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const skillList = role ? SKILLS_MAP[role] || [] : [];
  const scoreDisplay = useCountUp(results?.overallScore, 2000, step === 6);
  const toggleSkill = (s) => setSkills(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  useEffect(() => { loadPDFJS(); }, []);

  const beginAssessment = () => {
    setStartTime(Date.now());
    setStep(1);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setResumeFile(file);
    const text = await extractTextFromFile(file);
    setResumeText(text || "");
    setError("");
  };

  const handleAnalyze = async () => {
    setError(""); setStep(5);
    try {
      const r = await analyzeReadiness({ role, experience, companyTier, skills, hasPortfolio, resumeRating, commRating, techRating, resumeSummary, resumeText });
      setResults(r); setStep(6);
    } catch (e) {
      setError("Analysis failed. Please try again — it might be a network issue.");
      setStep(4);
    }
  };

  const reset = () => {
    setStep(0); setResults(null); setStartTime(null);
    setRole(""); setExperience(""); setCompanyTier(""); setSkills([]);
    setHasPortfolio(null); setResumeRating(3); setCommRating(3); setTechRating(3);
    setResumeSummary(""); setResumeText(""); setResumeFile(null); setError("");
  };

  const TopBar = () => (
    <div className="topbar">
      <div className="logo-mark">
        <span className="logo-dot" />
        IRA
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {startTime && step >= 1 && step <= 4 && <TimerBadge startTime={startTime} />}
        {step <= 4 && step >= 1 && (
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".08em" }}>Step {step} / 4</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="ira">
      <style>{CSS}</style>
      <div className="bg-canvas">
        <div className="grain" />
        <div className="grid-lines" />
        <div className="mesh1" /><div className="mesh2" /><div className="mesh3" />
      </div>
      <div className="wrap">

        {/* ─── LANDING ─── */}
        {step === 0 && (
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 48 }}>
            <div className="fu" style={{ marginBottom: 28 }}>
              <div className="logo-mark" style={{ marginBottom: 36, fontSize: 17 }}>
                <span className="logo-dot" />
                IRA &nbsp;·&nbsp; <span style={{ fontWeight: 300, color: "var(--muted)", fontFamily: "'Outfit',sans-serif", fontSize: 14 }}>Interview Readiness Assessment</span>
              </div>
            </div>

            <h1 className="fu d1 display-h" style={{ fontSize: "clamp(42px,7vw,86px)", marginBottom: 22 }}>
              Know Your Standing<br />Before the Room.
            </h1>

            <p className="fu d2" style={{ fontSize: "clamp(15px,2vw,18px)", color: "var(--muted)", maxWidth: 540, lineHeight: 1.85, marginBottom: 36, fontWeight: 300 }}>
              A precision, AI-powered assessment across Technical depth, Resume quality, ATS compatibility, Communication, and Portfolio — calibrated to real recruiter expectations.
            </p>

            <div className="fu d3" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 48, flexWrap: "wrap" }}>
              <button className="btn-primary" onClick={beginAssessment} style={{ fontSize: 16, padding: "15px 44px" }}>
                Begin Assessment →
              </button>
              <div style={{ padding: "10px 18px", borderRadius: 100, background: "rgba(127,176,105,.08)", border: "1px solid rgba(127,176,105,.18)", fontSize: 13, color: "var(--accent2)", fontFamily: "'DM Mono',monospace" }}>
                ⏱ Under 2 minutes
              </div>
            </div>

            {/* Stats */}
            <div className="fu d4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 14, marginBottom: 32 }}>
              {[
                { val: "5", unit: "Dimensions", desc: "Technical, Resume, ATS, Communication, Portfolio" },
                { val: "AI", unit: "Powered", desc: "Qwen Plus — recruiter-grade evaluation" },
                { val: "30", unit: "Day Roadmap", desc: "Personalized week-by-week action plan" },
                { val: "<2", unit: "Minutes", desc: "Fast, accurate, no account needed" },
              ].map(({ val, unit, desc }) => (
                <div key={unit} className="stat-badge">
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: "4px 0" }}>{unit}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>

            {/* Feature preview */}
            <div className="fu d5 card">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 20 }}>
                {[
                  { sym: "T", col: "#7fb069", title: "Technical Depth", desc: "DSA, system design, domain tools and language proficiency" },
                  { sym: "R", col: "#d4a843", title: "Resume Quality", desc: "Impact statements, ATS keywords, clarity and structure" },
                  { sym: "A", col: "#5dade2", title: "ATS Score", desc: "Applicant tracking system compatibility and keyword analysis" },
                  { sym: "C", col: "#e07b39", title: "Communication", desc: "STAR method, behavioral framing, interview storytelling" },
                  { sym: "P", col: "#af7ac5", title: "Portfolio Signal", desc: "GitHub presence, live projects, demonstrable real-world work" },
                ].map(({ sym, col, title, desc }) => (
                  <div key={sym} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: `${col}12`, border: `1px solid ${col}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span className="mono" style={{ fontSize: 11, color: col }}>{sym}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>{title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.65 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP HEADER ─── */}
        {step >= 1 && step <= 4 && (
          <>
            <TopBar />
            <div className="prog-track">
              <div className="prog-fill" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
          </>
        )}

        {/* ─── STEP 1: Target ─── */}
        {step === 1 && (
          <div className="fu">
            <span className="step-tag">Step 1 of 4 — Profile</span>
            <h2 className="section-h">What are you targeting?</h2>
            <p className="sub-p">This calibrates your assessment to the right benchmarks and competitive landscape.</p>

            <div style={{ marginBottom: 26 }}>
              <div className="step-tag" style={{ marginBottom: 12 }}>Target Domain</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
                {ROLES.map(r => (
                  <button key={r} className={`sel-btn ${role === r ? "active" : ""}`} onClick={() => { setRole(r); setSkills([]); }}>{r}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 26 }}>
              <div className="step-tag" style={{ marginBottom: 12 }}>Experience Level</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EXP_LEVELS.map(e => (
                  <button key={e} className={`sel-btn ${experience === e ? "active" : ""}`} style={{ width: "auto", padding: "11px 20px" }} onClick={() => setExperience(e)}>{e}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 40 }}>
              <div className="step-tag" style={{ marginBottom: 12 }}>Target Company Tier</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                {COMPANY_TIERS.map(c => (
                  <button key={c.id} className={`sel-btn ${companyTier === c.id ? "active" : ""}`} onClick={() => setCompanyTier(c.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 14, color: "var(--accent)" }}>{c.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", paddingLeft: 24 }}>{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary" onClick={() => setStep(2)} disabled={!role || !experience || !companyTier}>
              Continue →
            </button>
          </div>
        )}

        {/* ─── STEP 2: Skills ─── */}
        {step === 2 && (
          <div className="fu">
            <span className="step-tag">Step 2 of 4 — Skills</span>
            <h2 className="section-h">Which skills are you fluent in?</h2>
            <p className="sub-p">Select only what you'd confidently demonstrate in a real interview. &nbsp;<span className="mono" style={{ color: "var(--accent)", fontSize: 12 }}>{skills.length} selected</span></p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
              {skillList.map(s => (
                <button key={s} className={`chip ${skills.includes(s) ? "active" : ""}`} onClick={() => toggleSkill(s)}>
                  {skills.includes(s) && <span className="chip-dot" />}
                  {s}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 40 }}>
              <div className="step-tag" style={{ marginBottom: 12 }}>Portfolio & Public Work</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["✓  Yes — GitHub / live projects / portfolio site", true], ["✗  Not yet", false]].map(([label, val]) => (
                  <button key={String(val)} className={`sel-btn ${hasPortfolio === val ? "active" : ""}`}
                    style={{ width: "auto", padding: "11px 22px" }} onClick={() => setHasPortfolio(val)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn-primary" onClick={() => setStep(3)} disabled={skills.length < 2 || hasPortfolio === null}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Self-Rating ─── */}
        {step === 3 && (
          <div className="fu">
            <span className="step-tag">Step 3 of 4 — Self-Assessment</span>
            <h2 className="section-h">Rate yourself honestly.</h2>
            <p className="sub-p">Accurate self-rating produces accurate results. There's no benefit in overrating yourself here.</p>

            {[
              { label: "Resume & CV Quality", sub: "Clarity, impact statements, ATS compatibility, formatting", val: resumeRating, set: setResumeRating },
              { label: "Communication & Behavioral", sub: "STAR method, storytelling, expressing experience clearly", val: commRating, set: setCommRating },
              { label: "Technical Depth", sub: "DSA, system design, domain-specific knowledge for your role", val: techRating, set: setTechRating },
            ].map(({ label, sub, val, set }) => (
              <div key={label} className="card-sm" style={{ marginBottom: 11 }}>
                <div style={{ marginBottom: 13 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{sub}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} className={`rat-btn ${val === n ? "active" : ""}`} onClick={() => set(n)}>{n}</button>
                  ))}
                  <span style={{ marginLeft: 8, fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
                    {["", "Not prepared", "Some gaps", "Decent shape", "Well prepared", "Interview-ready"][val]}
                  </span>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
              <button className="btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn-primary" onClick={() => setStep(4)}>Continue →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Resume Upload ─── */}
        {step === 4 && (
          <div className="fu">
            <span className="step-tag">Step 4 of 4 — Resume & Context</span>
            <h2 className="section-h">Upload your resume.</h2>
            <p className="sub-p">Your resume is analyzed directly for a precise, personalized assessment. Adding background context deepens accuracy.</p>

            <div
              className={`drop-zone ${dragOver ? "drag-over" : ""}`}
              style={{ marginBottom: 18 }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              {resumeFile ? (
                <div>
                  <div className="drop-icon" style={{ background: "rgba(127,176,105,.08)", borderColor: "rgba(127,176,105,.18)" }}>📄</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{resumeFile.name}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, padding: "10px 16px", background: "rgba(127,176,105,.06)", border: "1px solid rgba(127,176,105,.18)", borderRadius: 10 }}>
                    <span style={{ color: "var(--accent2)", fontSize: 12 }}>✓</span>
                    <span style={{ fontSize: 13, color: "var(--accent2)" }}>Uploaded · {(resumeFile.size / 1024).toFixed(0)} KB</span>
                    {resumeText && resumeText.length > 50 && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'DM Mono',monospace" }}>· {resumeText.length} chars extracted</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>Click to replace</div>
                </div>
              ) : (
                <div>
                  <div className="drop-icon">↑</div>
                  <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>Drop your resume here</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>PDF, DOCX, or TXT — or click to browse</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "rgba(255,255,255,.15)", letterSpacing: ".07em" }}>OPTIONAL BUT HIGHLY RECOMMENDED</div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="step-tag" style={{ marginBottom: 8 }}>Additional Context</div>
              <textarea className="ta" rows={5}
                placeholder="Briefly describe your background — projects, internships, coursework, LeetCode progress, certifications, or anything relevant. The more specific, the sharper your report."
                value={resumeSummary} onChange={e => setResumeSummary(e.target.value)}
              />
              {resumeSummary && <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{resumeSummary.length} characters</div>}
            </div>

            {error && (
              <div style={{ marginBottom: 14, padding: "12px 16px", background: "rgba(231,76,60,.06)", border: "1px solid rgba(231,76,60,.2)", borderRadius: 10, color: "#e74c3c", fontSize: 13.5 }}>{error}</div>
            )}

            <div style={{ padding: "14px 18px", background: "rgba(212,168,67,.04)", border: "1px solid rgba(212,168,67,.1)", borderRadius: 11, marginBottom: 22, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
              <span style={{ color: "var(--accent)" }}>→</span> Your data is sent directly to the AI for analysis and is <strong style={{ color: "var(--text)" }}>not stored</strong> anywhere.
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost" onClick={() => setStep(3)}>← Back</button>
              <button className="btn-primary" onClick={handleAnalyze}>Generate Report →</button>
            </div>
          </div>
        )}

        {/* ─── LOADING ─── */}
        {step === 5 && (
          <div style={{ minHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ marginBottom: 32 }}>
              <div className="spinner" style={{ margin: "0 auto 24px" }} />
              <div style={{ width: 80, height: 80, borderRadius: "50%", border: "1px solid rgba(212,168,67,.15)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", top: -80 }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", border: "1px solid rgba(212,168,67,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 22 }}>🧠</span>
                </div>
              </div>
            </div>
            <h2 className="serif" style={{ fontSize: 28, fontWeight: 600, marginBottom: 10, color: "var(--text)", marginTop: -60 }}>Analyzing your profile</h2>
            <p style={{ color: "var(--muted)", maxWidth: 360, fontSize: 13.5, lineHeight: 1.75, marginBottom: 40 }}>
              Benchmarking against real recruiter expectations for {role} at {companyTier === "faang" ? "FAANG" : companyTier === "unicorn" ? "Unicorn" : companyTier === "midmarket" ? "Mid-size Tech" : "all company tiers"}.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 380 }}>
              {[
                "Parsing resume and background context…",
                "Evaluating technical skill depth…",
                "Running ATS compatibility check…",
                "Benchmarking against role requirements…",
                "Generating personalized roadmap…",
              ].map((msg, i) => (
                <div key={i} className="loading-item" style={{ animationDelay: `${i * 0.28}s` }}>
                  <div className="pulse-dot" style={{ animationDelay: `${i * 0.25}s` }} />
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── RESULTS ─── */}
        {step === 6 && results && (
          <>
            <div className="topbar">
              <div className="logo-mark"><span className="logo-dot" />IRA</div>
            </div>
            <ResultsView results={results} role={role} experience={experience} onReset={reset} scoreDisplay={scoreDisplay} />
          </>
        )}

      </div>
    </div>
  );
}