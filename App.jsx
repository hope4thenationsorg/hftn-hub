import { useState, useEffect, useRef } from "react";
import {
  loadEntry, saveEntry, loadAllForMonth, getMonthsWithData,
  loadNeeds, addNeed, updateNeed, deleteNeed,
} from "./supabase.js";
const HOUSES = [
  "Joshua House",
  "Esther House",
  "OCTO",
  "Ukraine",
  "EMBO Kids",
  "House of Hope",
];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth();
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY;
async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const d = await res.json();
  return d.content?.map(b => b.text || "").join("") || "";
}
// Parse a "YYYY-MM-DD" string as a LOCAL calendar date, not UTC.
// `new Date("2026-06-01")` is parsed as UTC midnight by the JS spec, which
// silently rolls back to the previous day (and sometimes previous month) in
// any timezone behind UTC. This helper avoids that entirely.
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
// ── palette ───────────────────────────────────────────────────────────────────
const C = {
  cream:  "#FDF8F2",
  gold:   "#C9963A",
  goldlt: "#EDD28A",
  navy:   "#1A2C45",
  navylt: "#2A4266",
  teal:   "#3D7A6F",
  teallt: "#EBF5F3",
  warm:   "#F5EEE4",
  border: "#E4D9C8",
  text:   "#2D2A24",
  muted:  "#7A6F63",
  white:  "#FFFFFF",
  danger: "#C0392B",
};
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.cream};font-family:'Inter',sans-serif;color:${C.text};min-height:100vh}
  .app{display:flex;flex-direction:column;min-height:100vh}
  .header{background:${C.navy};padding:18px 28px;display:flex;align-items:center;gap:14px}
  .header-cross{color:${C.gold};font-size:26px;line-height:1}
  .header-title{color:${C.white};font-family:'Playfair Display',serif;font-size:20px;font-weight:700;line-height:1.1}
  .header-sub{color:${C.goldlt};font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-top:2px}
  .body{display:flex;flex:1}
  .sidebar{width:210px;min-height:calc(100vh - 60px);background:${C.navylt};padding:16px 0;flex-shrink:0}
  .main{flex:1;padding:28px 32px;overflow-y:auto}
  .sidebar-section{color:${C.goldlt};font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:6px 18px 4px;margin-top:8px}
  .sidebar-item{padding:9px 18px;cursor:pointer;color:#C8D8EC;font-size:13.5px;font-weight:500;border-left:3px solid transparent;transition:all .15s}
  .sidebar-item:hover{background:rgba(255,255,255,.07);color:${C.white}}
  .sidebar-item.active{background:rgba(201,150,58,.13);color:${C.goldlt};border-left-color:${C.gold}}
  .sidebar-divider{height:1px;background:rgba(255,255,255,.1);margin:12px 16px}
  .tabs{display:flex;gap:0;border-bottom:2px solid ${C.border};margin-bottom:24px}
  .tab{padding:8px 18px;font-size:13px;font-weight:500;color:${C.muted};cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s}
  .tab:hover{color:${C.navy}}
  .tab.active{color:${C.navy};border-bottom-color:${C.gold};font-weight:600}
  .month-row{display:flex;align-items:center;gap:10px;margin-bottom:22px;flex-wrap:wrap}
  .month-btn{padding:5px 12px;border:1px solid ${C.border};border-radius:20px;background:${C.white};font-size:12px;cursor:pointer;color:${C.muted};transition:all .15s}
  .month-btn:hover{border-color:${C.gold};color:${C.navy}}
  .month-btn.active{background:${C.gold};border-color:${C.gold};color:${C.white};font-weight:600}
  .month-btn.has-data{border-color:${C.teal};color:${C.teal}}
  .month-btn.has-data.active{background:${C.teal};border-color:${C.teal};color:${C.white}}
  .year-nav{display:flex;align-items:center;gap:8px;margin-bottom:16px}
  .year-arrow{background:none;border:1px solid ${C.border};border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:14px;color:${C.muted};display:flex;align-items:center;justify-content:center}
  .year-arrow:hover{border-color:${C.gold};color:${C.gold}}
  .year-label{font-size:15px;font-weight:600;color:${C.navy};min-width:44px;text-align:center}
  .card{background:${C.white};border:1px solid ${C.border};border-radius:10px;padding:20px 22px;margin-bottom:18px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
  .card-title{font-family:'Playfair Display',serif;font-size:15px;color:${C.navy};margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .card-title span{font-size:11px;font-family:'Inter',sans-serif;font-weight:500;color:${C.muted};letter-spacing:.04em;text-transform:uppercase}
  label{display:block;font-size:12px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;margin-top:14px}
  textarea,input[type=text],input[type=number],select{width:100%;border:1px solid ${C.border};border-radius:7px;padding:9px 12px;font-size:13.5px;font-family:'Inter',sans-serif;color:${C.text};background:${C.cream};resize:vertical;transition:border .15s}
  textarea:focus,input[type=text]:focus,input[type=number]:focus,select:focus{outline:none;border-color:${C.gold};background:${C.white}}
  textarea{min-height:90px}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s}
  .btn-primary{background:${C.gold};color:${C.white}}
  .btn-primary:hover{background:#b8862e}
  .btn-secondary{background:${C.white};border:1px solid ${C.border};color:${C.navy}}
  .btn-secondary:hover{border-color:${C.gold};color:${C.gold}}
  .btn-teal{background:${C.teal};color:${C.white}}
  .btn-teal:hover{background:#2e6159}
  .btn-danger{background:${C.white};border:1px solid ${C.danger};color:${C.danger}}
  .btn-danger:hover{background:${C.danger};color:${C.white}}
  .btn-sm{padding:5px 11px;font-size:12px}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .output-box{background:${C.teallt};border:1px solid #B2D8D2;border-radius:8px;padding:14px 16px;font-size:13.5px;line-height:1.7;white-space:pre-wrap;margin-top:14px;color:${C.text}}
  .output-label{font-size:11px;font-weight:700;color:${C.teal};text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
  .photo-strip{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
  .photo-thumb{width:90px;height:70px;border-radius:7px;object-fit:cover;border:2px solid ${C.border}}
  .photo-add{width:90px;height:70px;border-radius:7px;border:2px dashed ${C.border};display:flex;align-items:center;justify-content:center;cursor:pointer;color:${C.muted};font-size:22px;background:${C.warm};transition:all .15s}
  .photo-add:hover{border-color:${C.gold};color:${C.gold}}
  .empty{text-align:center;padding:40px 20px;color:${C.muted};font-size:14px}
  .empty-icon{font-size:38px;margin-bottom:10px}
  .tag{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;background:${C.warm};color:${C.muted};border:1px solid ${C.border}}
  .tag.filled{background:${C.teallt};color:${C.teal};border-color:#B2D8D2}
  .tag.open{background:#FBEAEA;color:${C.danger};border-color:#F0C7C7}
  .tag.partial{background:#FCF3E3;color:#A9761F;border-color:${C.goldlt}}
  .tag.fulfilled{background:${C.teallt};color:${C.teal};border-color:#B2D8D2}
  .nl-section{margin-bottom:28px}
  .nl-house{font-family:'Playfair Display',serif;font-size:17px;color:${C.navy};border-bottom:2px solid ${C.goldlt};padding-bottom:6px;margin-bottom:10px}
  .nl-entry{font-size:13.5px;line-height:1.7;color:${C.text};margin-bottom:8px}
  .loading{display:flex;align-items:center;gap:8px;color:${C.teal};font-size:13px;padding:10px 0}
  .dot{width:6px;height:6px;border-radius:50%;background:${C.teal};animation:bounce 1.2s infinite}
  .dot:nth-child(2){animation-delay:.2s}
  .dot:nth-child(3){animation-delay:.4s}
  @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
  .copy-flash{font-size:11px;color:${C.teal};margin-left:8px;opacity:0;transition:opacity .3s}
  .copy-flash.show{opacity:1}
  .status-bar{background:${C.warm};border-top:1px solid ${C.border};padding:6px 28px;font-size:12px;color:${C.muted};text-align:right}
  .author-tag{font-size:11px;color:${C.muted};font-style:italic}
  .need-card{border:1px solid ${C.border};border-radius:9px;padding:14px 16px;margin-bottom:12px;background:${C.white}}
  .need-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
  .need-house{font-size:11px;font-weight:700;color:${C.gold};text-transform:uppercase;letter-spacing:.06em}
  .need-desc{font-size:14px;color:${C.text};margin-top:3px;font-weight:600}
  .need-meta{font-size:11.5px;color:${C.muted};margin-top:3px}
  .progress-track{width:100%;height:8px;border-radius:5px;background:${C.warm};margin-top:10px;overflow:hidden}
  .progress-fill{height:100%;background:${C.teal};border-radius:5px;transition:width .3s}
  .progress-fill.open{background:${C.danger}}
  .progress-fill.partial{background:${C.gold}}
  .need-amounts{display:flex;justify-content:space-between;font-size:12px;color:${C.muted};margin-top:5px}
  .needs-summary{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px}
  .summary-stat{background:${C.white};border:1px solid ${C.border};border-radius:9px;padding:12px 18px;min-width:140px}
  .summary-stat-label{font-size:10.5px;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  .summary-stat-value{font-size:20px;color:${C.navy};font-family:'Playfair Display',serif;font-weight:700;margin-top:2px}
  .filter-row{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
  .inline-edit{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
  .inline-edit input{width:110px}
`;
export default function App() {
  const [activeHouse, setActiveHouse] = useState(HOUSES[0]);
  const [activeTab, setActiveTab] = useState("log");
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [entryData, setEntryData] = useState(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [monthsWithData, setMonthsWithData] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [nlOutput, setNlOutput] = useState("");
  const [smOutput, setSmOutput] = useState("");
  const [allNlData, setAllNlData] = useState({});
  const [copyFlash, setCopyFlash] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const photoInputRef = useRef();
  const [notes, setNotes] = useState("");
  const [highlights, setHighlights] = useState("");
  const [prayerPoints, setPrayerPoints] = useState("");
  const [author, setAuthor] = useState("");
  const [photos, setPhotos] = useState([]);
  // ── Needs Tracker state ──────────────────────────────────────────────────
  const [needs, setNeeds] = useState([]);
  const [needsLoading, setNeedsLoading] = useState(false);
  const [needsFilterHouse, setNeedsFilterHouse] = useState("All");
  const [needsFilterStatus, setNeedsFilterStatus] = useState("All");
  const [needsYear, setNeedsYear] = useState(CURRENT_YEAR);
  const [needsMonth, setNeedsMonth] = useState(CURRENT_MONTH); // defaults to current month, like Newsletter tab; click "All" to see everything
  const [collapsedHouses, setCollapsedHouses] = useState({});
  const [newNeed, setNewNeed] = useState({
    house: HOUSES[0], description: "", amount_needed: "", amount_raised: "0", source: "", photos: [],
  });
  const [addingNeed, setAddingNeed] = useState(false);
  const [editingRaisedId, setEditingRaisedId] = useState(null);
  const [editingRaisedValue, setEditingRaisedValue] = useState("");
  const needDescRef = useRef();
  const needPhotoInputRef = useRef();
  useEffect(() => {
    setNlOutput(""); setSmOutput("");
    loadCurrentEntry();
    loadMonthsWithData();
  }, [activeHouse, selectedYear, selectedMonth]);
  useEffect(() => {
    if (activeTab === "newsletter") loadAllForNewsletter();
  }, [activeTab, selectedYear, selectedMonth]);
  useEffect(() => {
    if (activeTab === "needs") loadNeedsList();
  }, [activeTab]);
  async function loadCurrentEntry() {
    setLoadingEntry(true);
    const d = await loadEntry(activeHouse, selectedYear, selectedMonth);
    if (d) {
      setNotes(d.notes || "");
      setHighlights(d.highlights || "");
      setPrayerPoints(d.prayer_points || "");
      setAuthor(d.author || "");
      setPhotos(d.photos || []);
      setEntryData(d);
    } else {
      setNotes(""); setHighlights(""); setPrayerPoints(""); setAuthor(""); setPhotos([]);
      setEntryData(null);
    }
    setLoadingEntry(false);
  }
  async function loadMonthsWithData() {
    const months = await getMonthsWithData(activeHouse, selectedYear);
    setMonthsWithData(months);
  }
  async function handleSave() {
    setSaving(true);
    const ok = await saveEntry(activeHouse, selectedYear, selectedMonth, {
      notes,
      highlights,
      prayer_points: prayerPoints,
      author,
      photos,
    });
    setStatusMsg(ok ? `✓ Saved — ${MONTHS[selectedMonth]} ${selectedYear} · ${activeHouse}` : "Save failed. Check your connection.");
    setTimeout(() => setStatusMsg(""), 3500);
    setSaving(false);
    loadMonthsWithData();
    loadCurrentEntry();
  }
  function handlePhotoAdd(e) {
    const files = Array.from(e.target.files);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPhotos(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }
  async function generateNewsletter() {
    if (!notes && !highlights) return;
    setGenerating(true); setNlOutput("");
    const prompt = `You are writing for the Hope For The Nations nonprofit newsletter.
House: ${activeHouse}
Month: ${MONTHS[selectedMonth]} ${selectedYear}
Updates / Notes: ${notes}
Highlights: ${highlights}
Prayer Points: ${prayerPoints}
Write a warm, faith-filled newsletter paragraph (3–5 sentences) about this home for the month. Use a compassionate, ministry voice. Flowing prose only — no bullet points, no em dashes.`;
    const out = await callClaude("You write warm, ministry-focused newsletter content for a Christian nonprofit.", prompt);
    setNlOutput(out);
    setGenerating(false);
  }
  async function generateSocial() {
    if (!notes && !highlights) return;
    setGenerating(true); setSmOutput("");
    const prompt = `You are writing a Facebook/Instagram caption for Hope For The Nations, a Christian nonprofit.
House: ${activeHouse}
Month: ${MONTHS[selectedMonth]} ${selectedYear}
Updates / Notes: ${notes}
Highlights: ${highlights}
Write two versions:
1. Facebook caption (2–3 sentences, warm and storytelling, ends with a call to prayer or support)
2. Instagram caption (shorter, punchy, 1–2 sentences + 3–5 relevant hashtags)
Keep both faith-centered and uplifting. No em dashes. No repeated phrases between the two.`;
    const out = await callClaude("You write social media content for a Christian nonprofit.", prompt);
    setSmOutput(out);
    setGenerating(false);
  }
  async function loadAllForNewsletter() {
    const result = await loadAllForMonth(selectedYear, selectedMonth);
    setAllNlData(result);
  }
  async function generateFullNewsletter() {
    setGenerating(true); setNlOutput("");
    const sections = Object.entries(allNlData);
    if (!sections.length) { setGenerating(false); return; }
    const parts = sections.map(([h, d]) =>
      `House: ${h}\nNotes: ${d.notes || ""}\nHighlights: ${d.highlights || ""}\nPrayer: ${d.prayer_points || ""}`
    ).join("\n\n---\n\n");
    const out = await callClaude(
      "You write warm, faith-filled nonprofit newsletter content.",
      `Write a full newsletter section for Hope For The Nations for ${MONTHS[selectedMonth]} ${selectedYear}. Cover each home listed below in flowing prose paragraphs. Compassionate, ministry voice. No bullets, no em dashes.\n\n${parts}`
    );
    setNlOutput(out);
    setGenerating(false);
  }
  function copyText(txt) {
    navigator.clipboard.writeText(txt);
    setCopyFlash("Copied!");
    setTimeout(() => setCopyFlash(""), 2000);
  }
  // ── Needs Tracker handlers ───────────────────────────────────────────────
  async function loadNeedsList() {
    setNeedsLoading(true);
    const data = await loadNeeds();
    setNeeds(data);
    setNeedsLoading(false);
  }
  function handleNeedPhotoAdd(e) {
    const files = Array.from(e.target.files);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setNewNeed(prev => ({ ...prev, photos: [...prev.photos, ev.target.result] }));
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }
  async function handleAddNeed() {
    if (!newNeed.description) return;
    setAddingNeed(true);
    // Use the year/month currently selected in the filter above, so a need added while
    // viewing "June" is actually logged as June — not always today's date.
    const loggedDate = needsMonth === -1
      ? new Date().toISOString().slice(0, 10)
      : `${needsYear}-${String(needsMonth + 1).padStart(2, "0")}-01`;
    const ok = await addNeed({
      house: newNeed.house,
      description: newNeed.description,
      amount_needed: Number(newNeed.amount_needed) || 0,
      amount_raised: Number(newNeed.amount_raised) || 0,
      source: newNeed.source || null,
      date_logged: loggedDate,
      photos: newNeed.photos,
    });
    if (ok) {
      // Keep the same house selected so logging several needs for one house in a row is fast —
      // only the description/amount/source/photos fields clear.
      setNewNeed(prev => ({ house: prev.house, description: "", amount_needed: "", amount_raised: "0", source: "", photos: [] }));
      setStatusMsg("✓ Need added");
      setTimeout(() => setStatusMsg(""), 2500);
      loadNeedsList();
      needDescRef.current?.focus();
    } else {
      setStatusMsg("Could not add need. Check your connection.");
      setTimeout(() => setStatusMsg(""), 3500);
    }
    setAddingNeed(false);
  }
  function startEditRaised(need) {
    setEditingRaisedId(need.id);
    setEditingRaisedValue(String(need.amount_raised));
  }
  async function saveEditRaised(need) {
    const ok = await updateNeed(need.id, {
      house: need.house,
      description: need.description,
      amount_needed: need.amount_needed,
      amount_raised: Number(editingRaisedValue) || 0,
      source: need.source,
    });
    setEditingRaisedId(null);
    if (ok) loadNeedsList();
  }
  async function handleDeleteNeed(id) {
    const ok = await deleteNeed(id);
    if (ok) loadNeedsList();
  }
  const filteredNeeds = needs.filter(n => {
    if (needsFilterHouse !== "All" && n.house !== needsFilterHouse) return false;
    if (needsFilterStatus !== "All" && n.status !== needsFilterStatus) return false;
    const logged = parseLocalDate(n.date_logged);
    if (!logged) return false;
    if (logged.getFullYear() !== needsYear) return false;
    if (needsMonth !== -1 && logged.getMonth() !== needsMonth) return false;
    return true;
  });
  const groupedNeeds = HOUSES.map(h => ({
    house: h,
    items: filteredNeeds.filter(n => n.house === h),
  })).filter(g => g.items.length > 0);
  function toggleHouseCollapsed(house) {
    setCollapsedHouses(prev => ({ ...prev, [house]: !prev[house] }));
  }
  const totalNeeded = filteredNeeds.reduce((s, n) => s + Number(n.amount_needed || 0), 0);
  const totalRaised = filteredNeeds.reduce((s, n) => s + Number(n.amount_raised || 0), 0);
  const openCount = filteredNeeds.filter(n => n.status !== "fulfilled").length;
  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div className="header-cross">✟</div>
          <div>
            <div className="header-title">Hope For The Nations</div>
            <div className="header-sub">House Updates Hub</div>
          </div>
        </div>
        <div className="body">
          <div className="sidebar">
            <div className="sidebar-section">Our Homes</div>
            {HOUSES.map(h => (
              <div key={h} className={`sidebar-item ${activeHouse === h && activeTab !== "newsletter" && activeTab !== "needs" ? "active" : ""}`}
                onClick={() => { setActiveHouse(h); setActiveTab("log"); }}>
                🏠 {h}
              </div>
            ))}
            <div className="sidebar-divider" />
            <div className="sidebar-section">Reports</div>
            <div className={`sidebar-item ${activeTab === "newsletter" ? "active" : ""}`}
              onClick={() => setActiveTab("newsletter")}>
              📰 Newsletter
            </div>
            <div className={`sidebar-item ${activeTab === "needs" ? "active" : ""}`}
              onClick={() => setActiveTab("needs")}>
              💰 Needs Tracker
            </div>
          </div>
          <div className="main">
            {activeTab !== "newsletter" && activeTab !== "needs" && (
              <>
                <div className="year-nav">
                  <button className="year-arrow" onClick={() => setSelectedYear(y => y - 1)}>‹</button>
                  <span className="year-label">{selectedYear}</span>
                  <button className="year-arrow" onClick={() => setSelectedYear(y => y + 1)}>›</button>
                  <span style={{color: C.muted, fontSize: 13, marginLeft: 6}}>{activeHouse}</span>
                </div>
                <div className="month-row">
                  {MONTHS.map((m, i) => (
                    <button key={m}
                      className={`month-btn ${selectedMonth === i ? "active" : ""} ${monthsWithData.includes(i) && selectedMonth !== i ? "has-data" : ""}`}
                      onClick={() => setSelectedMonth(i)}>
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <div className="tabs">
                  {["log", "social"].map(t => (
                    <div key={t} className={`tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
                      {t === "log" ? "📝 Log Updates" : "📱 Social Media"}
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* LOG TAB */}
            {activeTab === "log" && (
              <div className="card">
                <div className="card-title">
                  {MONTHS[selectedMonth]} {selectedYear} <span>· {activeHouse}</span>
                  {entryData && <span className="tag filled">Saved</span>}
                  {entryData?.author && <span className="author-tag">by {entryData.author}</span>}
                </div>
                {loadingEntry ? (
                  <div className="loading"><div className="dot"/><div className="dot"/><div className="dot"/> Loading...</div>
                ) : (
                  <>
                    <label>Your Name</label>
                    <input type="text" placeholder="Who is logging this update?" value={author} onChange={e => setAuthor(e.target.value)} />
                    <label>Updates / Monthly Notes</label>
                    <textarea placeholder="What happened this month? Residents, activities, needs, changes..." value={notes} onChange={e => setNotes(e.target.value)} rows={5} />
                    <label>Highlights & Praise Reports</label>
                    <textarea placeholder="Answered prayers, milestones, special moments..." value={highlights} onChange={e => setHighlights(e.target.value)} rows={3} />
                    <label>Prayer Points</label>
                    <textarea placeholder="Specific needs for prayer this month..." value={prayerPoints} onChange={e => setPrayerPoints(e.target.value)} rows={2} />
                    <label>Photos</label>
                    <div className="photo-strip">
                      {photos.map((p, i) => (
                        <div key={i} style={{position:"relative"}}>
                          <img src={p} alt="" className="photo-thumb" />
                          <button onClick={() => setPhotos(prev => prev.filter((_,j) => j!==i))}
                            style={{position:"absolute",top:-6,right:-6,background:C.danger,color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                        </div>
                      ))}
                      <div className="photo-add" onClick={() => photoInputRef.current.click()}>+</div>
                      <input ref={photoInputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handlePhotoAdd} />
                    </div>
                    <div style={{marginTop:18,display:"flex",gap:10,flexWrap:"wrap"}}>
                      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "💾 Save Entry"}
                      </button>
                      <button className="btn btn-teal" onClick={generateNewsletter} disabled={generating || (!notes && !highlights)}>
                        {generating ? "Generating..." : "📰 Draft Newsletter Para"}
                      </button>
                    </div>
                    {generating && <div className="loading" style={{marginTop:12}}><div className="dot"/><div className="dot"/><div className="dot"/> Writing...</div>}
                    {nlOutput && (
                      <div style={{marginTop:14}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div className="output-label">Newsletter Paragraph</div>
                          <button className="btn btn-secondary btn-sm" onClick={() => copyText(nlOutput)}>Copy</button>
                          <span className={`copy-flash ${copyFlash ? "show" : ""}`}>{copyFlash}</span>
                        </div>
                        <div className="output-box">{nlOutput}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {/* SOCIAL TAB */}
            {activeTab === "social" && (
              <div className="card">
                <div className="card-title">
                  Social Media — {MONTHS[selectedMonth]} {selectedYear} <span>· {activeHouse}</span>
                </div>
                {!entryData ? (
                  <div className="empty">
                    <div className="empty-icon">📝</div>
                    No data logged for this month yet. Add notes in the Log tab first.
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:13.5,color:C.text,lineHeight:1.6,marginBottom:12}}>
                      <strong>Notes on file:</strong> {entryData.notes || "—"}
                    </div>
                    {entryData.photos?.length > 0 && (
                      <>
                        <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Photos</div>
                        <div className="photo-strip">
                          {entryData.photos.map((p,i) => <img key={i} src={p} alt="" className="photo-thumb" />)}
                        </div>
                      </>
                    )}
                    <div style={{marginTop:16}}>
                      <button className="btn btn-teal" onClick={generateSocial} disabled={generating}>
                        {generating ? "Generating..." : "✨ Generate Captions"}
                      </button>
                    </div>
                    {generating && <div className="loading" style={{marginTop:12}}><div className="dot"/><div className="dot"/><div className="dot"/> Drafting captions...</div>}
                    {smOutput && (
                      <div style={{marginTop:14}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div className="output-label">Facebook & Instagram Captions</div>
                          <button className="btn btn-secondary btn-sm" onClick={() => copyText(smOutput)}>Copy All</button>
                          <span className={`copy-flash ${copyFlash ? "show" : ""}`}>{copyFlash}</span>
                        </div>
                        <div className="output-box">{smOutput}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {/* NEWSLETTER TAB */}
            {activeTab === "newsletter" && (
              <div>
                <div className="year-nav" style={{marginBottom:14}}>
                  <button className="year-arrow" onClick={() => setSelectedYear(y => y - 1)}>‹</button>
                  <span className="year-label">{selectedYear}</span>
                  <button className="year-arrow" onClick={() => setSelectedYear(y => y + 1)}>›</button>
                </div>
                <div className="month-row" style={{marginBottom:22}}>
                  {MONTHS.map((m,i) => (
                    <button key={m} className={`month-btn ${selectedMonth === i ? "active" : ""}`} onClick={() => setSelectedMonth(i)}>
                      {m.slice(0,3)}
                    </button>
                  ))}
                </div>
                <div className="card">
                  <div className="card-title">📰 Newsletter — {MONTHS[selectedMonth]} {selectedYear}</div>
                  {Object.keys(allNlData).length === 0 ? (
                    <div className="empty">
                      <div className="empty-icon">🏠</div>
                      No entries logged for any home this month yet.
                    </div>
                  ) : (
                    <>
                      <div style={{marginBottom:16}}>
                        {HOUSES.map(h => (
                          <div key={h} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <span style={{fontSize:13}}>{allNlData[h] ? "✅" : "⬜"}</span>
                            <span style={{fontSize:13.5,color:allNlData[h] ? C.teal : C.muted}}>{h}</span>
                            {allNlData[h]?.author && <span className="author-tag">· logged by {allNlData[h].author}</span>}
                            {!allNlData[h] && <span className="tag" style={{fontSize:10}}>no data yet</span>}
                          </div>
                        ))}
                      </div>
                      {Object.entries(allNlData).map(([house, d]) => (
                        <div key={house} className="nl-section">
                          <div className="nl-house">{house}</div>
                          {d.notes && <div className="nl-entry"><strong>Notes:</strong> {d.notes}</div>}
                          {d.highlights && <div className="nl-entry"><strong>Highlights:</strong> {d.highlights}</div>}
                          {d.prayer_points && <div className="nl-entry"><strong>Prayer:</strong> {d.prayer_points}</div>}
                          {d.photos?.length > 0 && (
                            <div className="photo-strip">
                              {d.photos.map((p,i) => <img key={i} src={p} alt="" className="photo-thumb"/>)}
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{marginTop:8}}>
                        <button className="btn btn-teal" onClick={generateFullNewsletter} disabled={generating}>
                          {generating ? "Generating..." : "✨ Generate Full Newsletter Draft"}
                        </button>
                      </div>
                    </>
                  )}
                  {generating && <div className="loading" style={{marginTop:12}}><div className="dot"/><div className="dot"/><div className="dot"/> Writing newsletter...</div>}
                  {nlOutput && (
                    <div style={{marginTop:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div className="output-label">Full Newsletter Draft</div>
                        <button className="btn btn-secondary btn-sm" onClick={() => copyText(nlOutput)}>Copy</button>
                        <span className={`copy-flash ${copyFlash ? "show" : ""}`}>{copyFlash}</span>
                      </div>
                      <div className="output-box">{nlOutput}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* NEEDS TRACKER TAB */}
            {activeTab === "needs" && (
              <div>
                <div className="card-title" style={{marginBottom:16}}>
                  💰 Needs Tracker <span>· {needsMonth === -1 ? `all of ${needsYear}` : `${MONTHS[needsMonth]} ${needsYear}`}</span>
                </div>
                <div className="year-nav" style={{marginBottom:14}}>
                  <button className="year-arrow" onClick={() => setNeedsYear(y => y - 1)}>‹</button>
                  <span className="year-label">{needsYear}</span>
                  <button className="year-arrow" onClick={() => setNeedsYear(y => y + 1)}>›</button>
                </div>
                <div className="month-row" style={{marginBottom:22}}>
                  <button className={`month-btn ${needsMonth === -1 ? "active" : ""}`} onClick={() => setNeedsMonth(-1)}>All</button>
                  {MONTHS.map((m, i) => (
                    <button key={m} className={`month-btn ${needsMonth === i ? "active" : ""}`} onClick={() => setNeedsMonth(i)}>
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <div className="needs-summary">
                  <div className="summary-stat">
                    <div className="summary-stat-label">Total Needed</div>
                    <div className="summary-stat-value">${totalNeeded.toLocaleString()}</div>
                  </div>
                  <div className="summary-stat">
                    <div className="summary-stat-label">Total Raised</div>
                    <div className="summary-stat-value">${totalRaised.toLocaleString()}</div>
                  </div>
                  <div className="summary-stat">
                    <div className="summary-stat-label">Still Open</div>
                    <div className="summary-stat-value">{openCount}</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Add a Need</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:-6,marginBottom:10}}>
                    Will be logged under <strong>{needsMonth === -1 ? "today's date" : `${MONTHS[needsMonth]} ${needsYear}`}</strong> — change the month tabs above to log it elsewhere.
                  </div>
                  <label>House</label>
                  <select value={newNeed.house} onChange={e => setNewNeed({...newNeed, house: e.target.value})}>
                    {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <label>Description</label>
                  <input ref={needDescRef} type="text" placeholder="e.g. Bricks, brickforce, river sand and cement to window level"
                    value={newNeed.description} onChange={e => setNewNeed({...newNeed, description: e.target.value})} />
                  <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                    <div style={{flex:"1 1 140px"}}>
                      <label>Amount Needed ($) — optional</label>
                      <input type="number" placeholder="Leave blank if amount is unknown" value={newNeed.amount_needed}
                        onChange={e => setNewNeed({...newNeed, amount_needed: e.target.value})} />
                    </div>
                    <div style={{flex:"1 1 140px"}}>
                      <label>Amount Already Raised ($)</label>
                      <input type="number" placeholder="0" value={newNeed.amount_raised}
                        onChange={e => setNewNeed({...newNeed, amount_raised: e.target.value})} />
                    </div>
                  </div>
                  <label>Source (optional)</label>
                  <input type="text" placeholder="e.g. WhatsApp update, June 2026"
                    value={newNeed.source} onChange={e => setNewNeed({...newNeed, source: e.target.value})} />
                  <label>Photos (optional)</label>
                  <div className="photo-strip">
                    {newNeed.photos.map((p, i) => (
                      <div key={i} style={{position:"relative"}}>
                        <img src={p} alt="" className="photo-thumb" />
                        <button onClick={() => setNewNeed(prev => ({...prev, photos: prev.photos.filter((_,j) => j!==i)}))}
                          style={{position:"absolute",top:-6,right:-6,background:C.danger,color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                      </div>
                    ))}
                    <div className="photo-add" onClick={() => needPhotoInputRef.current.click()}>+</div>
                    <input ref={needPhotoInputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handleNeedPhotoAdd} />
                  </div>
                  <div style={{marginTop:16}}>
                    <button className="btn btn-primary" onClick={handleAddNeed} disabled={addingNeed || !newNeed.description}>
                      {addingNeed ? "Adding..." : "+ Add Need"}
                    </button>
                  </div>
                </div>
                <div className="filter-row">
                  <select style={{width:"auto"}} value={needsFilterHouse} onChange={e => setNeedsFilterHouse(e.target.value)}>
                    <option value="All">All Houses</option>
                    {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select style={{width:"auto"}} value={needsFilterStatus} onChange={e => setNeedsFilterStatus(e.target.value)}>
                    <option value="All">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="partial">Partially Funded</option>
                    <option value="fulfilled">Fulfilled</option>
                  </select>
                </div>
                {needsLoading ? (
                  <div className="loading"><div className="dot"/><div className="dot"/><div className="dot"/> Loading needs...</div>
                ) : groupedNeeds.length === 0 ? (
                  <div className="empty">
                    <div className="empty-icon">💰</div>
                    No needs logged for this period{needsFilterHouse !== "All" ? ` for ${needsFilterHouse}` : ""}.
                  </div>
                ) : (
                  groupedNeeds.map(group => {
                    const isCollapsed = !!collapsedHouses[group.house];
                    const groupNeeded = group.items.reduce((s, n) => s + Number(n.amount_needed || 0), 0);
                    const groupRaised = group.items.reduce((s, n) => s + Number(n.amount_raised || 0), 0);
                    return (
                      <div key={group.house} style={{marginBottom:20}}>
                        <div
                          onClick={() => toggleHouseCollapsed(group.house)}
                          style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"8px 4px",borderBottom:`2px solid ${C.goldlt}`,marginBottom:isCollapsed?0:12}}
                        >
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:12,color:C.muted}}>{isCollapsed ? "▶" : "▼"}</span>
                            <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:C.navy}}>{group.house}</span>
                            <span className="tag">{group.items.length} need{group.items.length !== 1 ? "s" : ""}</span>
                          </div>
                          <span style={{fontSize:12.5,color:C.muted}}>
                            ${groupRaised.toLocaleString()} raised of ${groupNeeded.toLocaleString()}
                          </span>
                        </div>
                        {!isCollapsed && group.items.map(n => {
                          const pct = n.amount_needed > 0 ? Math.min(100, Math.round((n.amount_raised / n.amount_needed) * 100)) : 0;
                          return (
                            <div key={n.id} className="need-card">
                              <div className="need-top">
                                <div>
                                  <div className="need-desc">{n.description}</div>
                                  <div className="need-meta">
                                    Logged {parseLocalDate(n.date_logged)?.toLocaleDateString()}
                                    {n.source ? ` · ${n.source}` : ""}
                                  </div>
                                </div>
                                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                  <span className={`tag ${n.status}`}>
                                    {n.status === "fulfilled" ? "Fulfilled" : n.status === "partial" ? "Partially Funded" : "Open"}
                                  </span>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteNeed(n.id)}>Delete</button>
                                </div>
                              </div>
                              {n.photos?.length > 0 && (
                                <div className="photo-strip">
                                  {n.photos.map((p, i) => <img key={i} src={p} alt="" className="photo-thumb" />)}
                                </div>
                              )}
                              {n.amount_needed > 0 ? (
                                <>
                                  <div className="progress-track">
                                    <div className={`progress-fill ${n.status}`} style={{width: `${pct}%`}} />
                                  </div>
                                  <div className="need-amounts">
                                    <span>${Number(n.amount_raised).toLocaleString()} raised of ${Number(n.amount_needed).toLocaleString()}</span>
                                    <span>{pct}%</span>
                                  </div>
                                </>
                              ) : (
                                <div className="need-amounts" style={{marginTop:10}}>
                                  <span className="tag" style={{fontStyle:"italic"}}>Amount not yet set{n.amount_raised > 0 ? ` · $${Number(n.amount_raised).toLocaleString()} raised so far` : ""}</span>
                                </div>
                              )}
                              {editingRaisedId === n.id ? (
                                <div className="inline-edit">
                                  <input type="number" value={editingRaisedValue} onChange={e => setEditingRaisedValue(e.target.value)} />
                                  <button className="btn btn-teal btn-sm" onClick={() => saveEditRaised(n)}>Save</button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingRaisedId(null)}>Cancel</button>
                                </div>
                              ) : (
                                <div style={{marginTop:10}}>
                                  <button className="btn btn-secondary btn-sm" onClick={() => startEditRaised(n)}>Update Amount Raised</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
        {statusMsg && <div className="status-bar">{statusMsg}</div>}
      </div>
    </>
  );
}
