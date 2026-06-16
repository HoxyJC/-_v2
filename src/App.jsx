import React, { useState, useMemo, useEffect } from "react";

// ============================================================
// 세금/공제 로직 (2026 기준) — 공식 출처 검증
// 모두 만원 단위로 계산
// ============================================================
const TAX_BRACKETS = [
  { limit: 1400, rate: 0.06, ded: 0 },
  { limit: 5000, rate: 0.15, ded: 126 },
  { limit: 8800, rate: 0.24, ded: 576 },
  { limit: 15000, rate: 0.35, ded: 1544 },
  { limit: 30000, rate: 0.38, ded: 1994 },
  { limit: 50000, rate: 0.40, ded: 2594 },
  { limit: Infinity, rate: 0.42, ded: 3594 },
];
function calcTax(base) {
  if (base <= 0) return 0;
  const b = TAX_BRACKETS.find((x) => base <= x.limit);
  return base * b.rate - b.ded;
}
function marginalRate(base) {
  if (base <= 0) return 0;
  return TAX_BRACKETS.find((x) => base <= x.limit).rate;
}
function pensionCreditRate(salary) {
  return salary <= 5500 ? 0.165 : 0.132;
}
function earnedIncomeDeduction(annual) {
  let d;
  if (annual <= 500) d = annual * 0.7;
  else if (annual <= 1500) d = 350 + (annual - 500) * 0.4;
  else if (annual <= 4500) d = 750 + (annual - 1500) * 0.15;
  else if (annual <= 10000) d = 1200 + (annual - 4500) * 0.05;
  else d = 1475 + (annual - 10000) * 0.02;
  return Math.min(d, 2000);
}
function laborTaxCredit(computed) {
  const c = computed <= 130 ? computed * 0.55 : 130 * 0.55 + (computed - 130) * 0.30;
  return Math.min(c, 66);
}

// 4대보험 (근로자 부담, 2026)
const RATES = { np: 0.0475, npCeiling: 637, hi: 0.03595, ltc: 0.1314, ei: 0.009 };
function insurance(salaryMan) {
  const monthly = salaryMan / 12;
  const np = Math.min(monthly, RATES.npCeiling) * RATES.np * 12;
  const hi = salaryMan * RATES.hi;
  const ltc = hi * RATES.ltc;
  const ei = salaryMan * RATES.ei;
  return { np, hi, ltc, ei, total: np + hi + ltc + ei };
}

// 정밀 소득세 (연말정산식, 만원). personalDedMan = 인적공제액(만원, 기본 본인 150)
function preciseIncomeTax(salary, personalDedMan = 150, extraDeduction = 0, pensionCredit = 0) {
  const earnedDed = earnedIncomeDeduction(salary);
  const earnedIncome = salary - earnedDed;
  const ins = insurance(salary);
  const taxBase = Math.max(0, earnedIncome - personalDedMan - ins.np - extraDeduction);
  const computed = calcTax(taxBase);
  const afterLabor = Math.max(0, computed - laborTaxCredit(computed));
  const afterPension = Math.max(0, afterLabor - pensionCredit);
  return { taxBase, computed, incomeTax: afterPension, localTax: afterPension * 0.1, total: afterPension * 1.1, marginal: marginalRate(taxBase) };
}

// 간이세액(월) 근사 — 실제 국세청 표보다 약간 높을 수 있음(참고용)
function simpleMonthlyTax(salary, personalDedMan = 150) {
  const r = preciseIncomeTax(salary, personalDedMan);
  return r.total / 12;
}

// 국민연금 예상 월 수령액 (공단 공식, 2026 A값 319.35만)
function npsMonthly(avgIncomeMan, joinYears, constant = 1.29, A = 319.35) {
  const B = Math.min(avgIncomeMan, 659);
  const n = Math.max(0, (joinYears - 20) * 12);
  return constant * (A + B) * (1 + 0.05 * n / 12) / 12;
}
// 완전노령연금 개시 연령 (출생연도 기준, 성별 무관하나 기대수명은 성별차)
function npsStartAge(birthYear) {
  if (birthYear <= 1952) return 60;
  if (birthYear <= 1956) return 61;
  if (birthYear <= 1960) return 62;
  if (birthYear <= 1964) return 63;
  if (birthYear <= 1968) return 64;
  return 65;
}
// 기대수명 (성별, 통계청 근사)
const LIFE_EXPECTANCY = { M: 86, F: 90 };

// 포맷
const won = (n) => {
  if (n == null || isNaN(n)) return "—";
  const man = Math.round(n);
  if (Math.abs(man) >= 10000) return (man / 10000).toFixed(2).replace(/\.?0+$/, "") + "억";
  return man.toLocaleString("ko-KR") + "만";
};
const wonW = (n) => (n == null || isNaN(n)) ? "—" : Math.round(n).toLocaleString("ko-KR") + "원";
// 만원 단위 → "1억 6천만" 형태 (대출 원금 등). 1억 미만은 그냥 만 단위.
const eokCheon = (man) => {
  if (man == null || isNaN(man)) return "—";
  man = Math.round(man);
  if (man === 0) return "0";
  if (Math.abs(man) < 10000) return man.toLocaleString("ko-KR") + "만";
  const eok = Math.floor(man / 10000);
  const rest = man % 10000;
  let s = `${eok}억`;
  if (rest) s += ` ${rest.toLocaleString("ko-KR")}만`;
  return s;
};
const pct = (n) => (n * 100).toFixed(2) + "%";

const C = {
  ink: "#1a1f2e", paper: "#f7f5f0", card: "#ffffff", line: "#e3ddd2", sub: "#6b6456",
  teal: "#2c6e6a", tealLt: "#e6f0ef", gold: "#b08d3f", goldLt: "#f5edd8",
  rust: "#a8483a", rustLt: "#f3e0dc", navy: "#34507a", navyLt: "#eef2f8",
  purple: "#6a4c8c", purpleLt: "#efe9f5",
};
const accentOf = (i) => [C.teal, C.navy, C.gold, C.rust][i % 4];
const bgOf = (i) => [C.tealLt, C.navyLt, C.goldLt, C.rustLt][i % 4];

// 생년월 자동 포맷: 숫자만 입력해도 YYYY-MM 형태로 (예: 199410 → 1994-10)
function formatBirth(input) {
  const digits = String(input).replace(/[^0-9]/g, "").slice(0, 6);
  if (digits.length <= 4) return digits;
  return digits.slice(0, 4) + "-" + digits.slice(4);
}

// ============================================================
// 공통 UI
// ============================================================
function NumIn({ label, value, onChange, suffix = "만원", step = 100, hint, max }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");
  const display = focused ? raw : (value === "" || value == null || isNaN(value) ? "" : Number(value).toLocaleString("ko-KR"));
  const over = max != null && value > max;
  return (
    <label style={{ display: "block", marginBottom: 11 }}>
      <span style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 4 }}>{label}</span>
      <span style={{ position: "relative", display: "block" }}>
        <input type="text" inputMode="numeric" value={display}
          onFocus={() => { setRaw(value == null || isNaN(value) ? "" : String(value)); setFocused(true); }}
          onBlur={() => setFocused(false)}
          onChange={(e) => { const c = e.target.value.replace(/,/g, ""); let n = c === "" || c === "-" ? 0 : (parseFloat(c) || 0); if (max != null && n > max) { n = max; setRaw(String(max)); } else { setRaw(c); } onChange(n); }}
          style={{ width: "100%", padding: "8px 40px 8px 10px", fontSize: 14, border: `1px solid ${over ? C.rust : C.line}`, borderRadius: 7, background: C.card, color: C.ink, fontFamily: "inherit", boxSizing: "border-box" }} />
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11.5, color: C.sub, pointerEvents: "none" }}>{suffix}</span>
      </span>
      {max != null && <span style={{ fontSize: 10.5, color: C.gold, marginTop: 3, display: "block" }}>최대 한도: {max.toLocaleString("ko-KR")}만원</span>}
      {hint && <span style={{ fontSize: 10.5, color: C.sub, marginTop: 3, display: "block", lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}
function TextIn({ label, value, onChange }) {
  return (
    <label style={{ display: "block", marginBottom: 11 }}>
      <span style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 4 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "8px 10px", fontSize: 14, border: `1px solid ${C.line}`, borderRadius: 7, fontFamily: "inherit", boxSizing: "border-box" }} />
    </label>
  );
}
function Stat({ label, value, sub, accent = C.teal, bg }) {
  return (
    <div style={{ background: bg || C.card, border: `1px solid ${C.line}`, borderRadius: 11, padding: "13px 15px", flex: "1 1 0", minWidth: 120 }}>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: accent, fontFamily: "'Fraunces', Georgia, serif", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function Row({ k, v, bold, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span style={{ color: C.sub, fontWeight: bold ? 600 : 400 }}>{k}</span>
      <span style={{ color: accent || C.ink, fontWeight: bold ? 700 : 500 }}>{v}</span>
    </div>
  );
}
function Section({ title, desc, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 600, margin: "0 0 4px" }}>{title}</h2>
      {desc && <p style={{ fontSize: 12, color: C.sub, margin: "0 0 14px", lineHeight: 1.55 }}>{desc}</p>}
      {children}
    </div>
  );
}
const btn = { padding: "8px 14px", fontSize: 12.5, border: `1px solid ${C.line}`, borderRadius: 8, background: C.card, color: C.ink, cursor: "pointer", fontFamily: "inherit" };

// 테이블 셀용 쉼표 입력. max 지정 시 초과하면 자동으로 max로 제한
function CommaCell({ value, onChange, style, placeholder, warn, max, memo, onMemo }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");
  const [editMemo, setEditMemo] = useState(false);
  const display = focused ? raw : (value === "" || value == null || isNaN(value) || value === 0 ? (placeholder !== undefined ? "" : (value === 0 ? "0" : "")) : Number(value).toLocaleString("ko-KR"));
  const over = max != null && value > max;
  const hasMemo = memo && memo.length > 0;
  return (
    <div style={{ position: "relative", display: "inline-block" }}
      onContextMenu={onMemo ? (e) => { e.preventDefault(); setEditMemo(true); } : undefined}>
      <input type="text" inputMode="numeric" value={display} placeholder={placeholder}
        title={hasMemo ? `메모: ${memo}` : (max != null ? `최대 한도: ${max.toLocaleString("ko-KR")}만원 (우클릭으로 메모)` : (onMemo ? "우클릭으로 메모 추가" : undefined))}
        onFocus={() => { setRaw(value == null || isNaN(value) || value === 0 ? "" : String(value)); setFocused(true); }}
        onBlur={() => setFocused(false)}
        onChange={(e) => { const c = e.target.value.replace(/,/g, ""); let n = c === "" || c === "-" ? 0 : (parseFloat(c) || 0); if (max != null && n > max) { n = max; setRaw(String(max)); } else { setRaw(c); } onChange(n); }}
        style={{ ...style, border: `1px solid ${(warn || over) ? C.rust : (hasMemo ? C.gold : C.line)}` }} />
      {hasMemo && <span style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 6px 6px 0", borderColor: `transparent ${C.gold} transparent transparent`, pointerEvents: "none" }} />}
      {editMemo && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 50, background: C.card, border: `1px solid ${C.gold}`, borderRadius: 6, padding: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 160 }}>
          <input autoFocus value={memo || ""} onChange={(e) => onMemo(e.target.value)} placeholder="메모 (돈 출처 등)"
            onKeyDown={(e) => { if (e.key === "Enter") setEditMemo(false); }}
            style={{ width: "100%", padding: "4px 6px", fontSize: 11, border: `1px solid ${C.line}`, borderRadius: 4, fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <button onClick={() => { onMemo(""); setEditMemo(false); }} style={{ fontSize: 10, border: "none", background: "none", color: C.sub, cursor: "pointer" }}>삭제</button>
            <button onClick={() => setEditMemo(false)} style={{ fontSize: 10, border: "none", background: C.gold, color: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 원 단위로 입력받아 만원으로 저장. 표시는 만원 단위(소수 가능).
// value는 만원 단위 저장값. 입력 시 원 단위 숫자를 받아 /10000 해서 저장.
function WonCell({ value, onChange, style, placeholder, memo, onMemo, inherited }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");
  const [editMemo, setEditMemo] = useState(false);
  // 포커스 중: 원 단위 raw 그대로. 평소: 만원 단위로 표시(쉼표)
  const manwon = value == null || isNaN(value) || value === 0 ? null : value;
  const display = focused ? raw : (manwon == null ? "" : `${Math.round(manwon).toLocaleString("ko-KR")}만`);
  const hasMemo = memo && memo.length > 0;
  return (
    <div style={{ position: "relative", display: "inline-block" }}
      onContextMenu={onMemo ? (e) => { e.preventDefault(); setEditMemo(true); } : undefined}>
      <input type="text" inputMode="numeric" value={display} placeholder={placeholder}
        title={hasMemo ? `메모: ${memo}` : (inherited ? "지난달 값 자동 이어받음 (입력하면 이 달 값으로 바뀜)" : (onMemo ? "원 단위로 입력 (표시는 만원). 우클릭으로 메모" : "원 단위로 입력"))}
        onFocus={() => { setRaw(manwon == null ? "" : String(Math.round(manwon * 10000))); setFocused(true); }}
        onBlur={() => setFocused(false)}
        onChange={(e) => { const c = e.target.value.replace(/[,만원\s]/g, ""); const won = c === "" || c === "-" ? 0 : (parseFloat(c) || 0); setRaw(c); onChange(won / 10000); }}
        style={{ ...style, color: (inherited && !focused) ? C.sub : C.ink, fontStyle: (inherited && !focused) ? "italic" : "normal", border: `1px solid ${hasMemo ? C.gold : C.line}` }} />
      {hasMemo && <span style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 6px 6px 0", borderColor: `transparent ${C.gold} transparent transparent`, pointerEvents: "none" }} />}
      {editMemo && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 50, background: C.card, border: `1px solid ${C.gold}`, borderRadius: 6, padding: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: 160 }}>
          <input autoFocus value={memo || ""} onChange={(e) => onMemo(e.target.value)} placeholder="메모 (돈 출처 등)"
            onKeyDown={(e) => { if (e.key === "Enter") setEditMemo(false); }}
            style={{ width: "100%", padding: "4px 6px", fontSize: 11, border: `1px solid ${C.line}`, borderRadius: 4, fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <button onClick={() => { onMemo(""); setEditMemo(false); }} style={{ fontSize: 10, border: "none", background: "none", color: C.sub, cursor: "pointer" }}>삭제</button>
            <button onClick={() => setEditMemo(false)} style={{ fontSize: 10, border: "none", background: C.gold, color: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 메인
// ============================================================
export default function App() {
  const [tab, setTab] = useState(0);
  const [household, setHousehold] = useState({ children: 0 });

  const [people, setPeople] = useState([
    { name: "최진리", birth: "1995-01", gender: "F", salary: 6900, credit: 1500, check: 300, market: 100, transit: 120, pensionSaving: 600, irp: 300, jeonseRepay: 0, jeonseEligible: false,
      growth: 5, retireAge: 55, recvYears: 30, pensionStart: 2022, npsPast: 5 },
    { name: "김진형", birth: "1994-01", gender: "M", salary: 4600, credit: 1200, check: 200, market: 80, transit: 100, pensionSaving: 300, irp: 0, jeonseRepay: 400, jeonseEligible: true,
      growth: 5, retireAge: 55, recvYears: 30, pensionStart: 2025, npsPast: 6 },
  ]);

  const [policy, setPolicy] = useState({
    isaTaxFree: 200, isaLimit: 2000, isaExcess: 0.099, pensionCap: 900, isaExtraCap: 300, pensionLowLimit: 1500,
    finThreshold: 2000, finWithhold: 0.154, healthRate: 0.0719, ltcRate: 0.1314, highDivOn: false, highDivRate: 0.099,
  });

  const [planCfg, setPlanCfg] = useState({ startYear: 2026 });
  const [planOverride, setPlanOverride] = useState({});

  // 대출 목록
  const [loans, setLoans] = useState([
    { name: "주택대출(혜원)", bank: "", type: "전세", owner: "공동", principal: 10000, rate: 0, termYear: 2027, method: "수시상환", balance: 10000 },
    { name: "주택대출(은행)", bank: "", type: "주담대", owner: "공동", principal: 16000, rate: 4.0, termYear: 2045, method: "원리금균등", balance: 16000 },
  ]);
  // 소비 (월별 기록): 실제 가계부 데이터 (만원 단위)
  const [spending, setSpending] = useState(() => {
    const base = {
    "2024-01": {inc0_ac23: 100},
    "2024-02": {inc0_ac23: 50},
    "2024-03": {inc0_ac23: 50},
    "2024-04": {inc0_ac23: 100},
    "2024-05": {inc0_ac23: 50},
    "2024-07": {inc0_ac23: 50},
    "2024-08": {inc0_ac23: 50},
    "2024-11": {mgmt: 30, internet: 3.3, inc0_ac23: 50},
    "2024-12": {living: 709, mgmt: 30, internet: 3.3, inc0_ac23: 50},
    "2025-01": {living: 424.5, mgmt: 30, internet: 3.3, subscribe: 2.6, inc0_ac23: 55},
    "2025-02": {living: 472, mgmt: 42.7, internet: 3.3, subscribe: 5.6, inc0_ac23: 45},
    "2025-03": {living: 119, mgmt: 41.2, internet: 3.3, subscribe: 5.6, inc0_ac23: 20},
    "2025-04": {living: 202.2, mgmt: 29.9, internet: 3.3, subscribe: 5.6},
    "2025-05": {living: 181.3, mgmt: 28.6, internet: 3.3, subscribe: 5.9, inc0_ac23: 10},
    "2025-06": {living: 98.1, mgmt: 23.7, internet: 3.3, subscribe: 5.8, inc0_ac23: 10},
    "2025-07": {living: 63, mgmt: 25.3, internet: 3.3, subscribe: 3.8, inc0_ac23: 40},
    "2025-08": {living: 127, mgmt: 28.9, internet: 3.3, subscribe: 6},
    "2025-09": {living: 127.8, mgmt: 29.3, internet: 3.3, subscribe: 5.1, inc0_ac23: 10},
    "2025-10": {living: 165.6, mgmt: 25.4, internet: 3.3, subscribe: 5.1, inc0_ac23: 10},
    "2025-11": {living: 89.2, mgmt: 24.3, internet: 3.3, subscribe: 3.6, inc0_ac23: 320},
    "2025-12": {living: 139.9, mgmt: 31, internet: 3.3, subscribe: 3.6, inc0_ac23: 80},
    "2026-01": {living: 53, mgmt: 40, internet: 3.3, inc0_ac23: 20},
    "2026-02": {living: 241.8, mgmt: 47.6, internet: 3.3, inc0_ac23: 130},
    "2026-03": {living: 165.8, mgmt: 36.6, internet: 3.3, inc0_ac23: 100},
    "2026-04": {mgmt: 33.4, internet: 3.3},
    "2026-05": {living: 135.8, mgmt: 28.1, internet: 3.3, inc0_ac23: 50},
    "2026-06": {mgmt: 30, internet: 3.3, inc0_ac24: 10},
    "2026-07": {inc0_ac25: 100},
    "2026-08": {inc0_ac23: 150},
    "2026-09": {inc0_ac25: 50},
    "2026-10": {inc0_ac25: 50},
    "2026-11": {inc0_ac25: 50, inc0_ac24: 90},
    "2026-12": {inc0_ac23: 150, inc0_ac25: 50, inc0_ac24: 50},
    };
    // 김진형 IRP(ac28): 2022-01 ~ 2026-06 매월 25만 (누적 1350만)
    let y = 2022, m = 1;
    for (let i = 0; i < 54; i++) {
      const ym = `${y}-${String(m).padStart(2, "0")}`;
      base[ym] = { ...(base[ym] || {}), inc1_ac28: 25 };
      m++; if (m > 12) { m = 1; y++; }
    }
    return base;
  });
  // 대출 월별 상환 기록: 원금(혜원=loan0, 은행=loan1) / 이자(은행)
  const [loanPay, setLoanPay] = useState({
    "2024-11": {loan1_interest: 65},
    "2024-12": {loan1_interest: 65},
    "2025-01": {loan1_interest: 65.2},
    "2025-02": {loan1_principal: 1700, loan1_interest: 74.2},
    "2025-03": {loan1_interest: 60.7},
    "2025-04": {loan1_interest: 60.7},
    "2025-05": {loan1_interest: 58.8},
    "2025-06": {loan1_interest: 58.3},
    "2025-07": {loan1_principal: 3800, loan1_interest: 84.6},
    "2025-08": {loan1_interest: 42.8},
    "2025-09": {loan1_interest: 42.8},
    "2025-10": {loan1_interest: 41.3},
    "2025-11": {loan0_principal: 4000, loan1_principal: 1600, loan1_interest: 33.5},
    "2025-12": {loan1_principal: 400, loan1_interest: 33.8},
    "2026-01": {loan0_principal: 2000, loan1_interest: 34.6},
    "2026-02": {loan1_principal: 400, loan1_interest: 35.4},
    "2026-03": {loan1_principal: 100, loan1_interest: 29.7},
    "2026-04": {loan1_interest: 32.5},
    "2026-05": {loan1_interest: 31.5},
    "2026-06": {loan1_interest: 31.5},
    "2026-07": {loan1_interest: 31.5},
    "2026-08": {loan1_interest: 31.5},
    "2026-09": {loan1_interest: 31.5},
    "2026-10": {loan1_interest: 31.5},
    "2026-11": {loan0_principal: 2200, loan1_interest: 31.5},
    "2027-10": {loan0_principal: 1800, loan1_interest: 31.5},
  });
  // 공개여부 토글: 기본 전부 비공개(false). 키: person0, person1, loan0..., spending, goals
  const [shareFlags, setShareFlags] = useState({});
  const toggleShare = (key) => setShareFlags((s) => ({ ...s, [key]: !s[key] }));
  // 셀 메모: { "2025-02_living": "보너스" } 형태
  const [cellMemos, setCellMemos] = useState({});
  // 계좌 관리: 사용자별 통장(적금·예금·카드·증권 등)
  const [accounts, setAccounts] = useState([
    // 적금
    { id: "ac1", owner: "0", type: "적금", bank: "하나", name: "손님케어", use: true, open: "2026-03-20", rate: 4.0, months: 12, monthly: 20, taxType: "일반", share: false },
    { id: "ac2", owner: "0", type: "적금", bank: "우리", name: "우리 빙고 (진리)", use: true, open: "2025-03-05", rate: 10, months: 12, monthly: 50, taxType: "일반", share: false },
    { id: "ac3", owner: "0", type: "적금", bank: "우리", name: "우리 빙고 (진형)", use: true, open: "2025-03-05", rate: 10, months: 12, monthly: 50, taxType: "일반", share: false },
    { id: "ac4", owner: "0", type: "적금", bank: "신한", name: "1982 전설", use: true, open: "2025-07-16", rate: 7, months: 12, monthly: 30, taxType: "일반", share: false },
    { id: "ac5", owner: "0", type: "적금", bank: "신한", name: "모두의 적금", use: true, open: "2025-07-16", rate: 7, months: 12, monthly: 30, taxType: "일반", share: false },
    { id: "ac6", owner: "0", type: "적금", bank: "NH농협", name: "주택 청약", use: true, open: "2026-01-01", rate: 2.0, months: 0, monthly: 0, taxType: "일반", share: false },
    { id: "ac7", owner: "0", type: "적금", bank: "토스", name: "굴비", use: true, open: "2025-02-19", rate: 4.3, months: 6, monthly: 30, taxType: "일반", share: false },
    { id: "ac8", owner: "0", type: "적금", bank: "KB국민", name: "청년 미래", use: true, open: "2026-01-01", rate: 5, months: 36, monthly: 50, taxType: "비과세", share: false },
    { id: "ac9", owner: "공동", type: "입출금", bank: "토스", name: "여행 적금", use: true, open: "2026-01-01", rate: 0, months: 0, monthly: 15, taxType: "일반", share: false },
    // 비상금 (입출금)
    { id: "ac10", owner: "0", type: "입출금", bank: "KB국민", name: "비상금", use: true, open: "2026-01-01", rate: 0, months: 0, monthly: 0, taxType: "일반", share: false },
    // 카드
    { id: "ac11", owner: "0", type: "카드", bank: "고양페이", name: "", use: true, open: "", rate: 0, months: 0, monthly: 0, taxType: "일반", share: false },
    { id: "ac12", owner: "0", type: "카드", bank: "삼성카드", name: "신세계 아울렛", use: true, open: "", rate: 0, months: 0, monthly: 0, taxType: "일반", share: false },
    { id: "ac13", owner: "0", type: "카드", bank: "삼성카드", name: "Global ID", use: true, open: "", rate: 0, months: 0, monthly: 0, taxType: "일반", share: false },
    { id: "ac14", owner: "0", type: "카드", bank: "삼성카드", name: "삼성 4", use: true, open: "", rate: 0, months: 0, monthly: 0, taxType: "일반", share: false },
    { id: "ac15", owner: "0", type: "카드", bank: "우리카드", name: "Skypass", use: true, open: "", rate: 0, months: 0, monthly: 0, taxType: "일반", share: false },
    { id: "ac16", owner: "0", type: "카드", bank: "롯데카드", name: "Like It", use: true, open: "", rate: 0, months: 0, monthly: 0, taxType: "일반", share: false },
    { id: "ac17", owner: "0", type: "카드", bank: "현대카드", name: "G마켓", use: true, open: "", rate: 0, months: 0, monthly: 0, taxType: "일반", share: false },
    { id: "ac18", owner: "0", type: "예금", bank: "토스", name: "예금", use: true, open: "2026-01-01", rate: 2.0, months: 3, monthly: 100, taxType: "일반", share: false },
    { id: "ac19", owner: "0", type: "증권", bank: "키움증권", name: "키움", use: true, share: false },
    { id: "ac20", owner: "0", type: "증권", bank: "키움증권", name: "키움 Global", use: true, share: false },
    { id: "ac21", owner: "0", type: "증권", bank: "토스증권", name: "토스 주식", use: true, share: false },
    { id: "ac22", owner: "0", type: "증권", bank: "기타", name: "코인", use: true, share: false },
    { id: "ac23", owner: "0", type: "연금", bank: "미래에셋증권", name: "미래에셋 개인연금", use: true, share: false },
    { id: "ac24", owner: "0", type: "연금", bank: "미래에셋증권", name: "미래에셋 ISA", use: true, share: false },
    { id: "ac25", owner: "0", type: "연금", bank: "미래에셋증권", name: "미래에셋 IRP", use: true, share: false },
    { id: "ac26", owner: "0", type: "연금", bank: "KB국민", name: "KB 개인연금", use: true, share: false },
    { id: "ac27", owner: "0", type: "연금", bank: "KB국민", name: "KB 퇴직연금(IRP)", use: true, share: false },
    { id: "ac28", owner: "1", type: "연금", bank: "미래에셋증권", name: "IRP (진형)", use: true, share: false },
  ]);

  // ===== 구글 드라이브 연동 =====
  const [gdConfig, setGdConfig] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem("gdConfig") || "{}"); } catch { return {}; }
  });
  const [gdReady, setGdReady] = useState(false);      // 라이브러리 로드됨
  const [gdToken, setGdToken] = useState(null);        // 로그인 토큰
  const [gdFileId, setGdFileId] = useState(() => window.localStorage.getItem("gdFileId") || null);
  const [gdStatus, setGdStatus] = useState("");        // 상태 메시지
  const [gdModal, setGdModal] = useState(false);
  const tokenClientRef = React.useRef(null);
  const GD_FILENAME = "자산플랜_데이터.json";

  // 구글 라이브러리 스크립트 로드
  useEffect(() => {
    if (!gdConfig.clientId || !gdConfig.apiKey) return;
    const load = (src, id) => new Promise((res) => {
      if (document.getElementById(id)) { res(); return; }
      const s = document.createElement("script"); s.src = src; s.id = id; s.onload = res; document.body.appendChild(s);
    });
    Promise.all([
      load("https://apis.google.com/js/api.js", "gapi-script"),
      load("https://accounts.google.com/gsi/client", "gis-script"),
    ]).then(async () => {
      await new Promise((res) => window.gapi.load("client", res));
      await window.gapi.client.init({ apiKey: gdConfig.apiKey, discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] });
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: gdConfig.clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (resp) => { if (resp.access_token) { setGdToken(resp.access_token); setGdStatus("로그인됨 ✓"); } },
      });
      setGdReady(true); setGdStatus("준비됨 (로그인 필요)");
    }).catch(() => setGdStatus("구글 라이브러리 로드 실패 — 인터넷/설정 확인"));
  }, [gdConfig.clientId, gdConfig.apiKey]);

  const gdLogin = () => { if (tokenClientRef.current) tokenClientRef.current.requestAccessToken(); else setGdStatus("아직 준비 안 됨"); };

  // 드라이브에 저장 (파일 있으면 덮어쓰기, 없으면 새로 생성)
  const gdSave = async () => {
    if (!gdToken) { setGdStatus("먼저 로그인하세요"); return; }
    setGdStatus("저장 중...");
    const content = JSON.stringify(collectState(), null, 2);
    const metadata = { name: GD_FILENAME, mimeType: "application/json" };
    try {
      let fileId = gdFileId;
      // 기존 파일 있는지 이름으로 확인 (fileId 없을 때)
      if (!fileId) {
        const q = encodeURIComponent(`name='${GD_FILENAME}' and trashed=false`);
        const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, { headers: { Authorization: `Bearer ${gdToken}` } });
        const j = await r.json();
        if (j.files && j.files.length) fileId = j.files[0].id;
      }
      const boundary = "-------314159265358979323846";
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
      const method = fileId ? "PATCH" : "POST";
      const url = fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
      const resp = await fetch(url, { method, headers: { Authorization: `Bearer ${gdToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
      const result = await resp.json();
      if (result.id) { setGdFileId(result.id); window.localStorage.setItem("gdFileId", result.id); setGdStatus(`저장 완료 ✓ (${new Date().toLocaleTimeString("ko-KR")}) — 같은 파일 덮어쓰기`); }
      else setGdStatus("저장 실패: " + JSON.stringify(result).slice(0, 100));
    } catch (e) { setGdStatus("저장 오류: " + String(e).slice(0, 80)); }
  };

  // 임의 파일(블롭)을 드라이브에 업로드 (엑셀 등). 이름별로 새 파일 또는 덮어쓰기
  const gdSaveBlob = async (blob, filename) => {
    if (!gdToken) { setGdStatus("먼저 로그인하세요"); alert("구글 드라이브에 먼저 로그인하세요 (☁️ 버튼)"); return; }
    setGdStatus("엑셀 저장 중...");
    try {
      // 같은 이름 파일 찾기
      let fileId = null;
      const q = encodeURIComponent(`name='${filename}' and trashed=false`);
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, { headers: { Authorization: `Bearer ${gdToken}` } });
      const j = await r.json();
      if (j.files && j.files.length) fileId = j.files[0].id;
      // 블롭 → base64
      const b64 = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(",")[1]); fr.readAsDataURL(blob); });
      const boundary = "-------314159265358979323846";
      const metadata = { name: filename, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}\r\n--${boundary}--`;
      const method = fileId ? "PATCH" : "POST";
      const url = fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
      const resp = await fetch(url, { method, headers: { Authorization: `Bearer ${gdToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
      const result = await resp.json();
      if (result.id) { setGdStatus(`엑셀 저장 완료 ✓ (${new Date().toLocaleTimeString("ko-KR")})`); alert(`구글 드라이브에 '${filename}' 저장 완료!`); }
      else { setGdStatus("엑셀 저장 실패"); alert("저장 실패: " + JSON.stringify(result).slice(0, 100)); }
    } catch (e) { setGdStatus("엑셀 저장 오류: " + String(e).slice(0, 80)); alert("오류: " + String(e).slice(0, 80)); }
  };

  // 드라이브에서 불러오기
  const gdLoad = async () => {
    if (!gdToken) { setGdStatus("먼저 로그인하세요"); return; }
    setGdStatus("불러오는 중...");
    try {
      let fileId = gdFileId;
      if (!fileId) {
        const q = encodeURIComponent(`name='${GD_FILENAME}' and trashed=false`);
        const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, { headers: { Authorization: `Bearer ${gdToken}` } });
        const j = await r.json();
        if (j.files && j.files.length) { fileId = j.files[0].id; setGdFileId(fileId); window.localStorage.setItem("gdFileId", fileId); }
      }
      if (!fileId) { setGdStatus("드라이브에 저장된 파일이 없어요"); return; }
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${gdToken}` } });
      const data = await resp.json();
      applyState(data);
      setGdStatus(`불러오기 완료 ✓ (${new Date().toLocaleTimeString("ko-KR")})`);
    } catch (e) { setGdStatus("불러오기 오류: " + String(e).slice(0, 80)); }
  };
  const saveGdConfig = (clientId, apiKey) => {
    const c = { clientId: clientId.trim(), apiKey: apiKey.trim() };
    setGdConfig(c); window.localStorage.setItem("gdConfig", JSON.stringify(c));
    setGdStatus("설정 저장됨 — 페이지를 새로고침하면 적용돼요");
  };

  // 소득자 수 조절 (숫자 입력 방식)
  const setEarnerCount = (n) => {
    n = Math.max(1, Math.min(4, n));
    setPeople((arr) => {
      if (n === arr.length) return arr;
      if (n < arr.length) return arr.slice(0, n);
      const add = [];
      for (let i = arr.length; i < n; i++) add.push({ name: `구성원${i + 1}`, birth: "2000-01", gender: "M", salary: 0, credit: 0, check: 0, market: 0, transit: 0, pensionSaving: 0, irp: 0, jeonseRepay: 0, jeonseEligible: false, growth: 5, retireAge: 55, recvYears: 30, pensionStart: 2026 });
      return [...arr, ...add];
    });
  };

  // === 저장 / 불러오기 ===
  const collectState = () => ({ version: 3, savedAt: new Date().toISOString(), people, household, policy, planCfg, planOverride, loans, spending, loanPay, shareFlags, cellMemos, accounts });

  // 공동분만 추출: 공개 토글된 항목만. 사람은 공개된 사람만, 대출은 공개된 건만
  const collectShared = () => {
    // 비공개인 사람은 이름만 (다른 정보 일절 없음). 공개한 사람만 전체 포함
    const sharedPeople = people.map((p, i) => shareFlags[`person${i}`] ? { ...p } : { name: p.name, _hidden: true });
    const anyPersonShared = people.some((p, i) => shareFlags[`person${i}`]);
    const sharedLoans = loans.filter((l) => l.owner === "공동" || shareFlags[`loan${loans.indexOf(l)}`]);
    return {
      version: 3, shared: true, savedAt: new Date().toISOString(),
      people: sharedPeople,
      loans: sharedLoans,
      spending: shareFlags["spending"] ? spending : {},
      loanPay: shareFlags["spending"] ? loanPay : {},
      household: shareFlags["goals"] ? household : null,
      // shareFlags는 공유하지 않음 (내 토글 상태는 사적 정보)
    };
  };
  // 공동분 병합: 받은 공동 파일에서 공개된 것만 내 데이터에 합침 (내 개인 데이터는 유지)
  const mergeShared = (s) => {
    if (!s.shared) { alert("이 파일은 '공동분' 파일이 아니에요. '파일 불러오기'를 쓰세요."); return; }
    // 배우자가 공개한 사람만 내 people에 추가/갱신 (_hidden 제외)
    if (s.people) {
      setPeople((cur) => {
        const merged = [...cur];
        s.people.forEach((sp) => {
          if (sp._hidden) return;
          const idx = merged.findIndex((m) => m.name === sp.name);
          if (idx >= 0) merged[idx] = sp; else merged.push(sp);
        });
        return merged;
      });
    }
    if (s.loans && s.loans.length) setLoans((cur) => {
      const merged = [...cur];
      s.loans.forEach((sl) => { if (!merged.find((m) => m.name === sl.name)) merged.push(sl); });
      return merged;
    });
    alert("배우자가 공개한 공동 항목을 합쳤어요. 내 개인 데이터는 그대로예요.");
  };
  const applyState = (s) => {
    if (s.people) setPeople(s.people);
    if (s.household) setHousehold(s.household);
    if (s.policy) setPolicy(s.policy);
    if (s.planCfg) setPlanCfg(s.planCfg);
    if (s.planOverride) setPlanOverride(s.planOverride);
    if (s.loans) setLoans(s.loans);
    if (s.spending) setSpending(s.spending);
    if (s.loanPay) setLoanPay(s.loanPay);
    if (s.shareFlags) setShareFlags(s.shareFlags);
    if (s.cellMemos) setCellMemos(s.cellMemos);
    if (s.accounts) setAccounts(s.accounts);
  };
  // 공동분 저장 (공개 항목만)
  const saveSharedFile = () => {
    // 공유될 내용 미리 안내 (비공개 항목 제외 확인)
    const sharedNames = people.filter((p, i) => shareFlags[`person${i}`]).map((p) => p.name);
    const hiddenNames = people.filter((p, i) => !shareFlags[`person${i}`]).map((p) => p.name);
    const sharedLoanNames = loans.filter((l) => l.owner === "공동" || shareFlags[`loan${loans.indexOf(l)}`]).map((l) => l.name);
    const msg = `[배우자에게 공유될 내용]\n\n`
      + `공개 인물: ${sharedNames.length ? sharedNames.join(", ") : "없음"}\n`
      + `비공개(제외됨): ${hiddenNames.length ? hiddenNames.join(", ") : "없음"}\n`
      + `공유 대출: ${sharedLoanNames.length ? sharedLoanNames.join(", ") : "없음"}\n`
      + `소비·가계부: ${shareFlags["spending"] ? "공개" : "비공개(제외)"}\n\n`
      + `비공개 인물의 연봉·연금 등은 빠집니다. 이대로 저장할까요?`;
    if (!window.confirm(msg)) return;
    try {
      const blob = new Blob([JSON.stringify(collectShared(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      a.href = url; a.download = `공동분_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { alert("이 환경에선 파일 저장이 막혀 있어요. 배포/로컬에서 작동합니다."); }
  };
  const loadSharedFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { mergeShared(JSON.parse(ev.target.result)); } catch { alert("파일을 읽을 수 없어요."); } };
    reader.readAsText(file); e.target.value = "";
  };

  // 첫 로드 시 브라우저 저장 데이터 복원
  const [loaded, setLoaded] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("financeSimState");
      if (saved) applyState(JSON.parse(saved));
    } catch (e) { /* 무시 */ }
    setLoaded(true);
  }, []);
  // 변경 시 자동저장 (배포/로컬 환경에서 작동, 미리보기에선 무시될 수 있음)
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem("financeSimState", JSON.stringify(collectState())); } catch (e) { /* 무시 */ }
  }, [loaded, people, household, policy, planCfg, planOverride, loans, spending, loanPay, shareFlags, cellMemos, accounts]);
  const saveToFile = () => {
    try {
      const blob = new Blob([JSON.stringify(collectState(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      a.href = url; a.download = `자산플랜_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      // 이 미리보기 환경에선 파일 다운로드가 막혀 있음 → 텍스트 저장으로 안내
      alert("이 환경에선 파일 다운로드가 막혀 있어요. 대신 '텍스트 저장'을 사용하세요.");
      openSaveText();
    }
  };
  // SheetJS(xlsx) 동적 로드
  const loadXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("XLSX 로드 실패"));
    document.head.appendChild(s);
  });

  // 앱 데이터를 탭별 시트로 묶은 엑셀(workbook) 생성
  const buildWorkbook = (XLSX) => {
    const wb = XLSX.utils.book_new();
    // ① 가족 구성원
    const famRows = people.map((p, i) => ({ 구성원: p.name || `구성원${i + 1}`, "생년월": p.birth, "성별": p.sex, "연봉(만원)": p.salary }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(famRows), "①가족");
    // ⑤ 계좌
    const acctRows = accounts.map((a) => ({
      소유자: a.owner === "공동" ? "부부공동" : (people[parseInt(a.owner)]?.name || a.owner),
      종류: a.type, 은행: a.bank, 상품명: a.name, 사용: a.use ? "사용" : "비활성",
      개설일: a.open || "", "금리(%)": a.rate || "", "기간(개월)": a.months || "", "월납입/예치(만원)": a.monthly || "", 세금: a.taxType || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(acctRows), "⑤계좌");
    // ③ 수입 (월별 × 항목)
    const incKeys = new Set();
    Object.values(spending).forEach((m) => Object.keys(m).forEach((k) => { if (k.startsWith("inc")) incKeys.add(k); }));
    const incCols = [...incKeys];
    const incRows = Object.keys(spending).sort().map((ym) => {
      const row = { 연월: ym };
      incCols.forEach((k) => { row[incLabel(k)] = spending[ym]?.[k] ?? ""; });
      return row;
    }).filter((r) => Object.keys(r).length > 1);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incRows.length ? incRows : [{ 연월: "(데이터 없음)" }]), "③수입");
    // ④ 지출/대출
    const spendRows = Object.keys(spending).sort().map((ym) => ({
      연월: ym, 생활비: spending[ym]?.living ?? "", 관리비: spending[ym]?.mgmt ?? "", 인터넷: spending[ym]?.internet ?? "", 구독료: spending[ym]?.subscribe ?? "",
      "혜원대출상환": loanPay[ym]?.loan0_principal ?? "", "은행대출상환": loanPay[ym]?.loan1_principal ?? "", "대출이자": loanPay[ym]?.loan1_interest ?? "",
    })).filter((r) => Object.values(r).some((v, i) => i > 0 && v !== ""));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spendRows.length ? spendRows : [{ 연월: "(데이터 없음)" }]), "④지출대출");
    // ② 대출 정보
    const loanRows = loans.map((l) => ({ 대출명: l.name, 명의: l.owner === "공동" ? "부부공동" : (people[parseInt(l.owner)]?.name || l.owner), "원금(만원)": l.principal, "금리(%)": l.rate, 만기: l.termYear, "잔액(만원)": l.balance }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loanRows), "②대출");
    return wb;
  };
  // 수입 항목 키(inc0_ac1)를 사람·계좌명 라벨로
  const incLabel = (k) => {
    const m = k.match(/^inc(\d+)_(.+)$/); if (!m) return k;
    const pi = m[1], rest = m[2];
    const who = people[parseInt(pi)]?.name || `사람${pi}`;
    if (rest === "salary") return `${who}_월급`;
    if (rest === "etcincome") return `${who}_기타`;
    const acc = accounts.find((a) => a.id === rest);
    return `${who}_${acc ? acc.name : rest}`;
  };

  // 엑셀 파일로 다운로드
  const exportExcel = async () => {
    try {
      const XLSX = await loadXLSX();
      const wb = buildWorkbook(XLSX);
      const d = new Date();
      XLSX.writeFile(wb, `자산플랜_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.xlsx`);
    } catch (err) { alert("엑셀 생성 실패: " + err.message); }
  };

  // 엑셀로 만들어 구글 드라이브에 저장
  const exportExcelToDrive = async () => {
    try {
      const XLSX = await loadXLSX();
      const wb = buildWorkbook(XLSX);
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      await gdSaveBlob(blob, `자산플랜_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { alert("드라이브 엑셀 저장 실패: " + err.message); }
  };

  const loadFromFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (ev) => { try { applyState(JSON.parse(ev.target.result)); alert("불러오기 완료!"); } catch { alert("파일을 읽을 수 없어요. 올바른 저장 파일인지 확인해주세요."); } };
      reader.onerror = () => alert("파일을 읽을 수 없어요.");
      reader.readAsText(file);
    } catch { alert("이 환경에선 파일 읽기가 제한될 수 있어요. '텍스트 불러오기'를 사용하세요."); }
    e.target.value = "";
  };
  // 브라우저 자동저장 (이 환경에선 작동 안 할 수 있음 — 본인 환경/배포 시 작동)
  const saveToBrowser = () => {
    try { window.localStorage.setItem("financeSimState", JSON.stringify(collectState())); alert("브라우저에 저장됐어요. (이 환경에선 새로고침 시 사라질 수 있어요)"); }
    catch { alert("이 환경에선 브라우저 저장이 지원되지 않아요. '파일로 저장'을 사용하세요."); }
  };
  const loadFromBrowser = () => {
    try { const s = window.localStorage.getItem("financeSimState"); if (s) { applyState(JSON.parse(s)); alert("불러오기 완료!"); } else alert("저장된 데이터가 없어요."); }
    catch { alert("이 환경에선 브라우저 저장이 지원되지 않아요."); }
  };
  // 텍스트 저장/불러오기 (환경 제약 우회) — 모달
  const [textModal, setTextModal] = useState(null); // 'save' | 'load' | null
  const [textData, setTextData] = useState("");
  const openSaveText = () => { setTextData(JSON.stringify(collectState())); setTextModal("save"); };
  const openLoadText = () => { setTextData(""); setTextModal("load"); };
  const doLoadText = () => { try { applyState(JSON.parse(textData)); setTextModal(null); alert("불러오기 완료!"); } catch { alert("텍스트 형식이 올바르지 않아요."); } };

  const tabs = ["① 가족 구성원 정보", "② 100세 플랜", "③ 수입", "④ 지출/대출", "⑤ 세금·공제 분석", "⑥ 계좌 관리"];

  return (
    <div style={{ fontFamily: "'Pretendard', -apple-system, sans-serif", background: C.paper, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { outline: 2px solid ${C.teal}33; border-color: ${C.teal} !important; }
      `}</style>

      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 25, fontWeight: 600, margin: 0 }}>가족 자산·세금 시뮬레이터</h1>
              <span style={{ fontSize: 12, color: C.sub }}>2026 세제 기준</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => setGdModal(true)} style={{ ...btn, fontSize: 12, background: "#4285F4", color: "#fff", border: "none", fontWeight: 600 }}>☁️ 구글 드라이브 저장</button>
              <button onClick={() => setSettingsModal(true)} style={{ ...btn, fontSize: 12 }}>⚙️ 설정</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 16, flexWrap: "wrap" }}>
            {tabs.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{ padding: "10px 14px", fontSize: 13, fontWeight: tab === i ? 600 : 400, border: "none", background: "none", cursor: "pointer", color: tab === i ? C.teal : C.sub, borderBottom: tab === i ? `2px solid ${C.teal}` : "2px solid transparent", fontFamily: "inherit" }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1600, margin: "0 auto", padding: 24 }}>
        {tab === 0 && <TabFamily people={people} setPeople={setPeople} household={household} setHousehold={setHousehold} setEarnerCount={setEarnerCount} shareFlags={shareFlags} toggleShare={toggleShare} />}
        {tab === 1 && <TabPlan people={people} setPeople={setPeople} planCfg={planCfg} setPlanCfg={setPlanCfg} planOverride={planOverride} setPlanOverride={setPlanOverride} policy={policy} loans={loans} spending={spending} loanPay={loanPay} accounts={accounts} />}
        {tab === 2 && <TabIncome people={people} setPeople={setPeople} accounts={accounts} planOverride={planOverride} setPlanOverride={setPlanOverride} spending={spending} setSpending={setSpending} cellMemos={cellMemos} setCellMemos={setCellMemos} />}
        {tab === 3 && <TabLoanSpending people={people} loans={loans} setLoans={setLoans} spending={spending} setSpending={setSpending} loanPay={loanPay} setLoanPay={setLoanPay} cellMemos={cellMemos} setCellMemos={setCellMemos} />}
        {tab === 4 && <TabTaxAnalysis people={people} setPeople={setPeople} household={household} policy={policy} setPolicy={setPolicy} />}
        {tab === 5 && <TabAccounts people={people} accounts={accounts} setAccounts={setAccounts} spending={spending} setSpending={setSpending} loans={loans} setLoans={setLoans} loanPay={loanPay} />}
      </div>

      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "0 24px 40px" }}>
        <p style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.6, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
          ※ 2026 세율·4대보험·공제 기준(국세청·건강보험공단). 소득세는 연말정산식(근로세액공제 반영) 정밀 계산 + 간이세액 참고치. 의료비·기부금 등은 미반영. 국민연금 수령액은 공단 공식 추정. 정확한 값은 홈택스·공단 조회.
        </p>
      </div>

      {settingsModal && (
        <div onClick={() => setSettingsModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 16px", fontFamily: "'Fraunces', serif", fontSize: 18 }}>⚙️ 설정</h3>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.teal }}>📁 파일 백업</div>
              <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>구글 드라이브 대신 파일로 백업할 때 써요. 부부 공동분 공유도 여기서.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={saveToFile} style={{ ...btn, fontSize: 12 }}>💾 내 전체 저장</button>
                <label style={{ ...btn, fontSize: 12, cursor: "pointer" }}>📂 불러오기<input type="file" accept=".json,application/json" onChange={loadFromFile} style={{ display: "none" }} /></label>
                <button onClick={saveSharedFile} style={{ ...btn, fontSize: 12, color: C.gold, borderColor: C.gold }}>🔓 공동분 저장</button>
                <label style={{ ...btn, fontSize: 12, cursor: "pointer", borderColor: C.gold, color: C.gold }}>🤝 공동분 받기<input type="file" accept=".json,application/json" onChange={loadSharedFile} style={{ display: "none" }} /></label>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.navy }}>📊 엑셀로 내보내기</div>
              <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>가족·계좌·수입·지출/대출 데이터를 각각 시트로 묶은 엑셀(.xlsx)로 만들어요. 드라이브 저장은 ☁️ 로그인 후 같은 이름이면 덮어써요.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={exportExcel} style={{ ...btn, fontSize: 12, color: C.navy, borderColor: C.navy }}>📊 엑셀 다운로드</button>
                <button onClick={exportExcelToDrive} style={{ ...btn, fontSize: 12, background: "#0F9D58", color: "#fff", border: "none", fontWeight: 600 }}>☁️ 드라이브에 엑셀 저장</button>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.rust }}>↺ 초기화</div>
              <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>브라우저에 저장된 데이터를 지우고 기본값으로 되돌려요. ⚠️ 저장 안 한 내용은 사라집니다.</div>
              <button onClick={() => {
                if (window.confirm("정말 초기화할까요? 브라우저에 저장된 데이터가 지워지고 기본값으로 되돌아갑니다.")) {
                  if (window.confirm("한 번 더 확인할게요. 저장 안 한 내용은 영구히 사라집니다. 계속할까요?")) {
                    window.localStorage.removeItem("financeSimState"); window.location.reload();
                  }
                }
              }} style={{ ...btn, fontSize: 12, color: C.rust, borderColor: C.rust }}>↺ 기본값으로 초기화</button>
            </div>

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button onClick={() => setSettingsModal(false)} style={btn}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {gdModal && (
        <div onClick={() => setGdModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, padding: 24, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 6px", fontFamily: "'Fraunces', serif", fontSize: 18 }}>☁️ 구글 드라이브 연동</h3>
            <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "0 0 16px" }}>
              로그인하면 데이터를 드라이브의 <b>{GD_FILENAME}</b> 파일에 저장해요. 저장할 때마다 <b>같은 파일을 덮어쓰기</b>(업데이트)하고, 다른 기기서도 불러올 수 있어요.
            </p>

            {(!gdConfig.clientId || !gdConfig.apiKey) ? (
              <div style={{ padding: "14px 16px", background: C.goldLt, borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>① 먼저 설정 (한 번만)</div>
                <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.6, marginBottom: 10 }}>
                  구글 클라우드에서 발급한 <b>Client ID</b>와 <b>API Key</b>를 넣으세요. 발급법은 함께 드린 "구글드라이브_설정.md"를 보세요.
                </div>
                <input id="gd-cid" placeholder="Client ID (xxx.apps.googleusercontent.com)" defaultValue={gdConfig.clientId || ""}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 8, boxSizing: "border-box", fontFamily: "inherit" }} />
                <input id="gd-key" placeholder="API Key" defaultValue={gdConfig.apiKey || ""}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" }} />
                <button onClick={() => saveGdConfig(document.getElementById("gd-cid").value, document.getElementById("gd-key").value)}
                  style={{ ...btn, background: "#4285F4", color: "#fff", border: "none" }}>설정 저장</button>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {!gdToken
                    ? <button onClick={gdLogin} disabled={!gdReady} style={{ ...btn, background: gdReady ? "#4285F4" : C.line, color: "#fff", border: "none" }}>🔑 구글 로그인</button>
                    : <>
                        <button onClick={gdSave} style={{ ...btn, background: C.teal, color: "#fff", border: "none" }}>💾 드라이브에 저장(덮어쓰기)</button>
                        <button onClick={gdLoad} style={{ ...btn, borderColor: C.teal, color: C.teal }}>📥 드라이브에서 불러오기</button>
                      </>}
                </div>
                <button onClick={() => { setGdConfig({}); window.localStorage.removeItem("gdConfig"); setGdToken(null); setGdStatus(""); }}
                  style={{ fontSize: 11, border: "none", background: "none", color: C.sub, cursor: "pointer", textDecoration: "underline" }}>설정 초기화</button>
              </div>
            )}

            {gdStatus && <div style={{ padding: "8px 12px", background: C.paper, borderRadius: 8, fontSize: 12, color: C.ink, marginBottom: 12 }}>{gdStatus}</div>}

            <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.5, marginBottom: 14 }}>
              💡 한 번 로그인하면 "저장" 누를 때마다 같은 파일을 덮어써요(새 파일 안 생김). 다른 기기에선 로그인 후 "불러오기"하면 이어서 작업할 수 있어요.
            </div>
            <div style={{ textAlign: "right" }}>
              <button onClick={() => setGdModal(false)} style={btn}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {textModal && (
        <div onClick={() => setTextModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, padding: 22, maxWidth: 520, width: "100%" }}>
            <h3 style={{ margin: "0 0 8px", fontFamily: "'Fraunces', serif", fontSize: 17 }}>{textModal === "save" ? "📋 텍스트로 저장" : "📥 텍스트로 불러오기"}</h3>
            <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, margin: "0 0 12px" }}>
              {textModal === "save"
                ? "아래 텍스트를 전체 선택(Ctrl+A)해서 복사한 뒤 메모장 등에 붙여넣어 보관하세요. 나중에 '텍스트 불러오기'에 붙여넣으면 복원됩니다."
                : "저장해둔 텍스트를 아래에 붙여넣고 '불러오기'를 누르세요."}
            </p>
            <textarea value={textData} onChange={(e) => setTextData(e.target.value)} readOnly={textModal === "save"}
              onFocus={(e) => textModal === "save" && e.target.select()}
              style={{ width: "100%", height: 160, fontSize: 11, fontFamily: "monospace", border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setTextModal(null)} style={btn}>닫기</button>
              {textModal === "load" && <button onClick={doLoadText} style={{ ...btn, background: C.teal, color: "#fff", border: "none" }}>불러오기</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ============================================================
function TabFamily({ people, setPeople, household, setHousehold, setEarnerCount, shareFlags, toggleShare }) {
  const upd = (i, k, v) => setPeople((arr) => arr.map((p, j) => j === i ? { ...p, [k]: v } : p));
  // 자녀 인적공제는 최고 소득자에게 몰아줌 (절세)
  const maxSalaryIdx = people.reduce((best, p, i) => p.salary > people[best].salary ? i : best, 0);

  return (
    <div>
      <div style={{ padding: "14px 18px", background: C.tealLt, borderRadius: 12, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
        💡 여기가 <b>모든 계산의 출발점</b>이에요. 구성원 정보를 넣으면 다른 모든 탭에 자동 반영돼요.
        이 탭의 소득세는 <b>연봉(근로소득)에 대한 것만</b> 계산해요. 배당·이자 같은 금융소득세는 <b>⑤ 투자수익 세금 탭</b>에서 따로 봐요.
      </div>

      <Section title="가구 구성" desc="소득자 수와 소득 없는 자녀 수를 숫자로 입력하세요. 소득자 수만큼 입력 카드가 생깁니다.">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 130 }}>
            <NumIn label="소득자 수" value={people.length} step={1} suffix="명" onChange={(v) => setEarnerCount(v)} hint="최대 4명" />
          </div>
          <div style={{ minWidth: 130 }}>
            <NumIn label="소득 없는 자녀 수" value={household.children} step={1} suffix="명" onChange={(v) => setHousehold({ ...household, children: v })} hint="인적공제용" />
          </div>
          <div style={{ fontSize: 12, color: C.sub, paddingBottom: 14 }}>
            인적공제 합계 <b style={{ color: C.teal }}>{won((people.length + household.children) * 150)}원</b>
            <span style={{ display: "block", fontSize: 10.5, marginTop: 2 }}>자녀공제는 최고소득자({people[maxSalaryIdx].name})에게 적용(절세)</span>
          </div>
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        {people.map((p, i) => {
          // 본인 150만 + (최고소득자면 자녀공제 추가)
          const personalDed = 150 + (i === maxSalaryIdx ? household.children * 150 : 0);
          const ins = insurance(p.salary);
          const precise = preciseIncomeTax(p.salary, personalDed);
          const simpleMonthly = simpleMonthlyTax(p.salary, personalDed);
          const effRate = p.salary > 0 ? precise.total / p.salary : 0; // 실효세율(연봉 대비)
          const monthlyGross = p.salary / 12;
          const monthlyNet = monthlyGross - ins.total / 12 - precise.total / 12;
          return (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ background: accentOf(i), padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#fff", fontFamily: "'Fraunces', serif", fontSize: 18 }}>{p.name || `구성원 ${i + 1}`}</span>
                <button onClick={() => toggleShare(`person${i}`)} title="배우자에게 이 사람 정보 공개 여부"
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "none", fontWeight: 600, background: shareFlags[`person${i}`] ? "#fff" : "rgba(255,255,255,0.25)", color: shareFlags[`person${i}`] ? accentOf(i) : "#fff" }}>
                  {shareFlags[`person${i}`] ? "🔓 공개" : "🔒 비공개"}
                </button>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <TextIn label="이름" value={p.name} onChange={(v) => upd(i, "name", v)} />
                  <label style={{ display: "block", marginBottom: 11 }}>
                    <span style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 4 }}>생년월</span>
                    <input value={p.birth} onChange={(e) => upd(i, "birth", formatBirth(e.target.value))} placeholder="1995-01" inputMode="numeric"
                      style={{ width: "100%", padding: "8px 10px", fontSize: 14, border: `1px solid ${C.line}`, borderRadius: 7, fontFamily: "inherit", boxSizing: "border-box" }} />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "block", marginBottom: 11 }}>
                    <span style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 4 }}>성별</span>
                    <select value={p.gender} onChange={(e) => upd(i, "gender", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 14, border: `1px solid ${C.line}`, borderRadius: 7, fontFamily: "inherit", background: C.card }}>
                      <option value="F">여성</option><option value="M">남성</option>
                    </select>
                  </label>
                  <NumIn label="현재 연봉(세전)" value={p.salary} onChange={(v) => upd(i, "salary", v)} />
                </div>

                <div style={{ marginTop: 6, padding: "12px 14px", background: C.paper, borderRadius: 10, fontSize: 12.5 }}>
                  <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, marginBottom: 6 }}>월 급여명세 (근로소득 기준 자동계산)</div>
                  <Row k="월급 (연봉÷12)" v={wonW(monthlyGross * 10000)} bold />
                  <Row k={`국민연금 (${pct(RATES.np)})`} v={`−${wonW(ins.np / 12 * 10000)}`} />
                  <Row k={`건강보험 (${pct(RATES.hi)})`} v={`−${wonW(ins.hi / 12 * 10000)}`} />
                  <Row k={`장기요양 (건보 ${pct(RATES.ltc)})`} v={`−${wonW(ins.ltc / 12 * 10000)}`} />
                  <Row k={`고용보험 (${pct(RATES.ei)})`} v={`−${wonW(ins.ei / 12 * 10000)}`} />
                  <Row k={`근로소득세 (실효 ${pct(effRate)})`} v={`−${wonW(simpleMonthly / 1.1 * 10000)}`} />
                  <Row k="지방소득세 (10%)" v={`−${wonW(simpleMonthly / 1.1 * 0.1 * 10000)}`} />
                  <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0", paddingTop: 6 }}>
                    <Row k="월 실수령액 (대략)" v={wonW(monthlyNet * 10000)} bold accent={accentOf(i)} />
                  </div>
                </div>

                <div style={{ marginTop: 10, padding: "12px 14px", background: bgOf(i), borderRadius: 10, fontSize: 12.5 }}>
                  <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, marginBottom: 6 }}>연간 소득세 (최종 확정 기준)</div>
                  <Row k="과세표준" v={`${won(precise.taxBase)}원`} />
                  <Row k="한계세율 (마지막 구간)" v={pct(precise.marginal)} accent={accentOf(i)} bold />
                  <Row k="실효세율 (연봉 대비)" v={pct(effRate)} accent={accentOf(i)} />
                  <Row k="연 근로소득세(지방세 포함)" v={`${won(precise.total)}원`} accent={C.rust} />
                  <Row k="연 4대보험" v={`${won(ins.total)}원`} accent={C.navy} />
                  <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0", paddingTop: 6 }}>
                    <Row k="연 실수령액" v={`${won(p.salary - precise.total - ins.total)}원`} bold accent={accentOf(i)} />
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6, lineHeight: 1.4 }}>
                  ※ <b>한계세율</b>({pct(precise.marginal)}) = 소득의 마지막 구간 세율(하단 참고표 기준). <b>실효세율</b>({pct(effRate)}) = 연봉 대비 실제 부담률. 배당·금융소득세는 ⑤탭, 카드·연금공제는 ②탭.
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <RefTable />
    </div>
  );
}

// ============================================================
// 탭 2: 소득공제 최적화 (카드+연금+전세대출)
// ============================================================
function TabDeduction({ people, setPeople, household, policy }) {
  const upd = (i, k, v) => setPeople((arr) => arr.map((p, j) => j === i ? { ...p, [k]: v } : p));
  const margs = people.map((p) => preciseIncomeTax(p.salary, 150).marginal);
  const maxIdx = margs.indexOf(Math.max(...margs));
  const minIdx = margs.indexOf(Math.min(...margs));

  return (
    <div>
      <div style={{ padding: "12px 16px", background: C.goldLt, borderRadius: 10, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
        💡 <b>카드</b>: 총급여 25%까진 공제 0(신용카드 혜택 챙기는 구간), 이후는 체크/현금(공제율 2배). <b>연금계좌·전세대출</b> 공제도 함께 봐요.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        {people.map((p, i) => <DeductionCard key={i} p={p} i={i} upd={upd} policy={policy} />)}
      </div>

      {people.length >= 2 && (
        <Section title="누가 어떤 공제를 맡는 게 유리한가" desc="소득공제는 한계세율 높은 사람이 받을수록 절세가 커요.">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {people.map((p, i) => (
              <div key={i} style={{ flex: 1, minWidth: 160, padding: 14, background: bgOf(i), borderRadius: 12 }}>
                <div style={{ fontWeight: 700, color: accentOf(i), marginBottom: 6, fontFamily: "'Fraunces', serif" }}>{p.name}</div>
                <Row k="한계세율" v={pct(margs[i])} accent={accentOf(i)} bold />
                <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>공제 100만원당 약 {wonW(1000000 * margs[i] * 1.1)} 절세</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: "12px 16px", background: C.tealLt, borderRadius: 10, fontSize: 12.5, lineHeight: 1.6 }}>
              <b>📥 소득공제(카드·전세대출)는 → {people[maxIdx].name}</b> (세율 {pct(margs[maxIdx])})
              <div style={{ color: C.sub, marginTop: 3 }}>이유: 소득공제는 과세표준을 줄여주는데, <b>세율이 높은 사람</b>일수록 같은 공제로 더 많은 세금을 아껴요. 100만원 공제 시 {people[maxIdx].name}는 {wonW(1000000 * margs[maxIdx] * 1.1)}, {people[minIdx].name}는 {wonW(1000000 * margs[minIdx] * 1.1)} 절세.</div>
            </div>
            <div style={{ padding: "12px 16px", background: C.navyLt, borderRadius: 10, fontSize: 12.5, lineHeight: 1.6 }}>
              <b>💰 배당 자산은 → {people[minIdx].name}</b> (세율 {pct(margs[minIdx])})
              <div style={{ color: C.sub, marginTop: 3 }}>이유: 배당+이자가 연 2,000만 넘으면 <b>종합과세</b>로 근로소득과 합산돼 누진세율을 맞아요. <b>소득이 낮은 사람</b>이 받아야 합산해도 낮은 세율 구간에 머물러 세금이 적어요. ({people[minIdx].name}가 여유 있음)</div>
            </div>
            <div style={{ padding: "12px 16px", background: C.goldLt, borderRadius: 10, fontSize: 12.5, lineHeight: 1.6 }}>
              <b>🏠 전세대출 소득공제는 → 명의자만</b>
              <div style={{ color: C.sub, marginTop: 3 }}>이유: 전세대출 원리금 상환액 공제는 <b>대출·계약 명의자 본인</b>만 받을 수 있어요(부부 공동이라도 명의자만). 만약 둘 다 명의 가능한 상황이면, 세율 높은 <b>{people[maxIdx].name}</b> 명의로 빌리는 게 공제 효과가 커요.</div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function DeductionCard({ p, i, upd, policy }) {
  const threshold = p.salary * 0.25;
  const limit = p.salary <= 7000 ? 300 : 250;
  // 카드공제 (신용카드부터 문턱 소진)
  const card = useMemo(() => {
    let remain = threshold, creditEff = p.credit, checkEff = p.check, mk = p.market, tr = p.transit;
    const c1 = Math.min(creditEff, remain); creditEff -= c1; remain -= c1;
    const c2 = Math.min(checkEff, remain); checkEff -= c2; remain -= c2;
    const c3 = Math.min(mk, remain); mk -= c3; remain -= c3;
    const c4 = Math.min(tr, remain); tr -= c4; remain -= c4;
    const basicRaw = creditEff * 0.15 + checkEff * 0.30;
    const basic = Math.min(basicRaw, limit);
    const extra = Math.min((mk + tr) * 0.40, p.salary <= 7000 ? 300 : 200);
    return { basic, basicRaw, extra, total: basic + extra };
  }, [p, threshold, limit]);

  const pensionTotal = Math.min(p.pensionSaving, 600) + Math.min(p.irp, 300);
  const pensionCreditBase = Math.min(p.pensionSaving + p.irp, policy.pensionCap);
  const pensionRefund = pensionCreditBase * pensionCreditRate(p.salary);
  const jeonseDed = p.jeonseEligible ? Math.min(p.jeonseRepay * 0.4, 400) : 0;

  const totalDed = card.total + jeonseDed;
  const marg = preciseIncomeTax(p.salary, 150).marginal;
  const cardSaving = totalDed * marg * 1.1;
  const overThreshold = (p.credit + p.check + p.market + p.transit) > threshold;
  const maxSpend = threshold + limit / 0.30;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: bgOf(i), padding: "12px 16px", borderBottom: `1px solid ${C.line}`, fontWeight: 700, color: accentOf(i), fontFamily: "'Fraunces', serif" }}>{p.name} <span style={{ fontSize: 11, fontWeight: 400, color: C.sub }}>· 한계세율 {pct(marg)}</span></div>
      <div style={{ padding: 16 }}>
        <div style={{ padding: "9px 12px", background: C.paper, borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
          <Row k="① 최소: 25% 문턱(공제 0)" v={`${won(threshold)}원`} accent={C.rust} bold />
          <Row k="② 최대: 한도 채우는 사용액" v={`${won(maxSpend)}원`} accent={C.teal} bold />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <NumIn label="신용카드(15%)" value={p.credit} onChange={(v) => upd(i, "credit", v)} />
          <NumIn label="체크/현금(30%)" value={p.check} onChange={(v) => upd(i, "check", v)} />
          <NumIn label="전통시장(40%)" value={p.market} onChange={(v) => upd(i, "market", v)} />
          <NumIn label="대중교통(40%)" value={p.transit} onChange={(v) => upd(i, "transit", v)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 4 }}>
          <NumIn label="연금저축 납입" value={p.pensionSaving} onChange={(v) => upd(i, "pensionSaving", v)} max={600} />
          <NumIn label="IRP 납입" value={p.irp} onChange={(v) => upd(i, "irp", v)} max={900} hint="연금저축과 합산 900만까지 공제" />
        </div>
        <NumIn label="전세대출 원리금 상환(연)" value={p.jeonseRepay} onChange={(v) => upd(i, "jeonseRepay", v)} hint="상환액 40%, 한도 400만, 명의자·무주택세대주" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer", fontSize: 12.5 }}>
          <input type="checkbox" checked={p.jeonseEligible} onChange={(e) => upd(i, "jeonseEligible", e.target.checked)} />
          전세대출 소득공제 대상 (무주택 세대주·명의 본인)
        </label>

        {/* 결과 */}
        <div style={{ padding: "12px 14px", background: bgOf(i), borderRadius: 10, fontSize: 12.5 }}>
          <Row k="카드 소득공제" v={`${won(card.total)}원`} />
          {jeonseDed > 0 && <Row k="전세대출 소득공제" v={`${won(jeonseDed)}원`} />}
          <Row k="→ 소득공제 절세" v={`${won(cardSaving)}원`} accent={C.teal} />
          <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0", paddingTop: 6 }}>
            <Row k={`연금 세액공제 (${pct(pensionCreditRate(p.salary))})`} v={`${won(pensionRefund)}원`} bold accent={C.gold} />
          </div>
          <Row k="총 환급/절세 효과" v={`${won(cardSaving + pensionRefund)}원`} bold accent={accentOf(i)} />
        </div>

        <div style={{ marginTop: 10, padding: "10px 12px", background: card.basicRaw >= limit ? C.tealLt : C.goldLt, borderRadius: 9, fontSize: 11.5, lineHeight: 1.5 }}>
          {!overThreshold ? <>25% 문턱({won(threshold)}) 미달 — 지금은 공제 0. 문턱까진 신용카드 혜택 챙기세요.</>
            : card.basicRaw >= limit ? <>✅ 카드 기본공제 한도({won(limit)}) 다 채웠어요. 더 써도 기본공제는 안 늘어요.</>
              : <>📈 체크/현금으로 약 {won(Math.max(0, (limit - card.basicRaw) / 0.30))}원 더 쓰면 한도({won(limit)})를 채워요.</>}
        </div>
      </div>
    </div>
  );
}

function RefTable() {
  const brackets = [["1,400만 이하", "6%"], ["1,400~5,000만", "15%"], ["5,000~8,800만", "24%"], ["8,800만~1.5억", "35%"], ["1.5억~3억", "38%"], ["3억~5억", "40%"], ["5억~10억", "42%"], ["10억 초과", "45%"]];
  return (
    <Section title="📚 참고: 세율·요율 기준 (2026, 세전 총급여 기준)" desc="모든 판단은 세후가 아니라 세전 총급여·과세표준 기준입니다.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>소득세 한계세율 (과세표준)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><tbody>
            {brackets.map(([r, rate], i) => (<tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "5px 8px", color: C.sub }}>{r}</td><td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: C.teal }}>{rate}</td></tr>))}
          </tbody></table>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>※ 지방소득세 10% 별도</div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>연금 세액공제율 (총급여)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><tbody>
            <tr style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "5px 8px", color: C.sub }}>5,500만 이하</td><td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: C.teal }}>16.5%</td></tr>
            <tr style={{ borderBottom: `1px solid ${C.line}` }}><td style={{ padding: "5px 8px", color: C.sub }}>5,500만 초과</td><td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: C.teal }}>13.2%</td></tr>
          </tbody></table>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 12, marginBottom: 6 }}>4대보험 (2026 근로자)</div>
          <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.7 }}>국민연금 4.75% · 건강보험 3.595% · 장기요양 건보료의 13.14% · 고용보험 0.9%. 국민연금은 55~65세 이후 국민연금으로 돌려받아요(③100세 플랜).</div>
        </div>
      </div>
    </Section>
  );
}

// ============================================================
// 탭 3: 100세 플랜 (fill-forward, 연금저축/IRP 분리)
// ============================================================
function TabPlan({ people, setPeople, planCfg, setPlanCfg, planOverride, setPlanOverride, policy, loans, spending, loanPay, accounts }) {
  // 수입탭(spending)에서 특정 사람·연도의 연금 납입을 종류별로 연 합산
  // kind: "ps"(개인연금) | "irp" | "isa"
  const sumPensionFromIncome = (pi, year, kind) => {
    if (!accounts || !spending) return null;
    // 해당 종류의 계좌 id 목록
    const accIds = accounts.filter((a) => {
      if (a.type !== "연금") return false;
      if (String(a.owner) !== String(pi) && a.owner !== "공동") return false;
      const nm = (a.name || "");
      if (kind === "isa") return nm.includes("ISA");
      if (kind === "irp") return nm.includes("IRP") || nm.includes("퇴직");
      // ps = 개인연금 (ISA·IRP 아닌 연금)
      return !nm.includes("ISA") && !nm.includes("IRP") && !nm.includes("퇴직");
    }).map((a) => a.id);
    if (!accIds.length) return null;
    let sum = 0, found = false;
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, "0")}`;
      accIds.forEach((id) => { const v = spending[ym]?.[`inc${pi}_${id}`]; if (v != null) { sum += v; found = true; } });
    }
    return found ? sum : null;
  };
  // override를 fill-forward로 해석: 어떤 연도 값이 있으면 다음 입력 전까지 그 값 유지
  const getVal = (year, key, def) => {
    // year 이하의 가장 최근 override 찾기
    let val = def, bestYear = -1;
    for (const yStr in planOverride) {
      const y = parseInt(yStr);
      if (y <= year && planOverride[yStr][key] != null && y > bestYear) {
        val = planOverride[yStr][key]; bestYear = y;
      }
    }
    return val;
  };

  const plan = useMemo(() => {
    const rows = [];
    const birthYears = people.map((p) => parseInt(String(p.birth || "1995").replace(/[^0-9]/g, "").slice(0, 4)) || 1995);
    const thisYear = 2026;
    const pensionStarts = people.map((p) => p.pensionStart || thisYear);
    let bal = people.map(() => ({ ps: 0, irp: 0, isa: 0 })); // 계좌별 잔고
    let retireBal = people.map(() => null);
    let npsYears = people.map((p) => p.npsPast || 0), npsSum = people.map((p) => (p.npsPast || 0) * Math.min(p.salary / 12, 659)), npsAmt = people.map(() => null);
    let salaries = people.map((p) => p.salary);
    // 표시·계산 시작 = 가장 이른 연금 시작연도 (또는 수입탭에 연금 입력이 있는 가장 이른 해)
    let incomeMinYear = 9999;
    if (spending) { for (const ym in spending) { const hasPen = Object.keys(spending[ym] || {}).some((k) => /^inc\d+_/.test(k)); if (hasPen) { const y = parseInt(ym.split("-")[0]); if (y < incomeMinYear) incomeMinYear = y; } } }
    const startYear = Math.min(...pensionStarts, incomeMinYear);
    const loopStart = startYear;

    for (let year = loopStart; year <= 2026 + 74; year++) {
      const perPerson = people.map((p, i) => {
        const age = year - birthYears[i];
        const retireAge = p.retireAge || 55;
        const retired = age >= retireAge;
        const g = (p.growth || 5) / 100;
        const npsStart = npsStartAge(birthYears[i]);
        const pensionStarted = year >= pensionStarts[i]; // 연금 적립 시작 여부

        if (!retired && salaries[i] > 0) { npsYears[i] += 1; npsSum[i] += Math.min(salaries[i] / 12, 659); }

        let ps = 0, irp = 0, isa = 0, refund = 0, recv = 0, nps = 0, dissolved = 0, isaTransferRefund = 0;
        const psInc0 = sumPensionFromIncome(i, year, "ps");
        const irpInc0 = sumPensionFromIncome(i, year, "irp");
        const isaInc0 = sumPensionFromIncome(i, year, "isa");
        const hasIncomeInput = psInc0 != null || irpInc0 != null || isaInc0 != null;
        if (!retired && (pensionStarted || hasIncomeInput)) {
          ps = psInc0 != null ? psInc0 : getVal(year, `p${i}_ps`, pensionStarted ? Math.min(p.pensionSaving, 600) : 0);
          irp = irpInc0 != null ? irpInc0 : getVal(year, `p${i}_irp`, pensionStarted ? Math.min(p.irp, 300) : 0);
          isa = isaInc0 != null ? isaInc0 : getVal(year, `p${i}_isa`, 0);
          bal[i] = { ps: (bal[i].ps + ps) * (1 + g), irp: (bal[i].irp + irp) * (1 + g), isa: (bal[i].isa + isa) * (1 + g) };
          // 기본 연금 세액공제 (당해 현금 납입분)
          refund = Math.min(ps + irp, policy.pensionCap) * pensionCreditRate(salaries[i]);

          // ISA 해지 이벤트 (해당 연도에만, fill-forward 아님)
          const ev = planOverride[year];
          if (ev && ev[`p${i}_isaDissolve`]) {
            const dissolveAmt = bal[i].isa; // 해지 시 ISA 청산액
            const toPension = ev[`p${i}_toPension`] || 0;
            const toIrp = ev[`p${i}_toIrp`] || 0;
            const toNewIsa = ev[`p${i}_toNewIsa`] || 0;
            // ISA 이전 추가공제: 이전액(연금+IRP)의 10%, 최대 300
            const transferToPension = toPension + toIrp;
            const extraCredit = Math.min(transferToPension * 0.1, policy.isaExtraCap);
            const creditBase = Math.min(transferToPension, policy.pensionCap + extraCredit);
            // 이미 위에서 기본 refund 계산했으니, ISA이전분 추가공제만 더함 (당해 현금납입과 별개로 가정)
            isaTransferRefund = creditBase * pensionCreditRate(salaries[i]);
            // 연금/IRP로 간 돈은 연금잔고에 합류, 새 ISA만 ISA잔고로 재시작
            bal[i] = { ps: bal[i].ps + toPension, irp: bal[i].irp + toIrp, isa: toNewIsa };
            dissolved = dissolveAmt;
            refund += isaTransferRefund;
          }
          if (age === retireAge - 1) retireBal[i] = bal[i].ps + bal[i].irp + bal[i].isa;
        } else {
          if (retireBal[i] == null) retireBal[i] = bal[i].ps + bal[i].irp + bal[i].isa;
          const recvYears = p.recvTo100 ? Math.max(1, 100 - retireAge) : (p.recvYears || 30);
          if (age - retireAge < recvYears) recv = retireBal[i] / recvYears;
        }
        if (age >= npsStart) {
          if (npsAmt[i] == null) { const avg = npsYears[i] > 0 ? npsSum[i] / npsYears[i] : 0; npsAmt[i] = npsMonthly(avg, npsYears[i]); }
          nps = npsAmt[i] * 12;
        }
        const totalBal = bal[i].ps + bal[i].irp + bal[i].isa;
        return { age, retired, ps, irp, isa, refund, recv, nps, bal: totalBal, isaBal: bal[i].isa, dissolved, pensionStarted, notStarted: !pensionStarted && !retired };
      });
      rows.push({ year, perPerson });
    }
    return rows;
  }, [people, planOverride, policy, spending, accounts]);

  // 대출·소비 연별 집계 (⑥탭 데이터)
  const yearlyExpense = useMemo(() => {
    const agg = {};
    const allYM = new Set([...Object.keys(spending || {}), ...Object.keys(loanPay || {})]);
    for (const ym of allYM) {
      const year = parseInt(ym.split("-")[0]);
      if (!agg[year]) agg[year] = { spending: 0, loanPay: 0 };
      const sp = (spending || {})[ym] || {};
      agg[year].spending += (sp.living || 0) + (sp.mgmt || 0) + (sp.internet || 0) + (sp.subscribe || 0) + (sp.etc || 0);
      const lp = (loanPay || {})[ym] || {};
      (loans || []).forEach((l, i) => { agg[year].loanPay += lp[`loan${i}`] || 0; });
    }
    return agg;
  }, [spending, loanPay, loans]);

  // 세액공제: 올해(시작연도) + 누적, 개인별 + 총합
  const thisYearRow = plan.find((r) => r.year === 2026) || plan[0];
  const refundThisYear = people.map((_, i) => thisYearRow.perPerson[i]?.refund || 0);
  const refundCumByPerson = people.map((_, i) => plan.reduce((a, r) => a + (r.perPerson[i]?.refund || 0), 0));
  const refundThisYearTotal = refundThisYear.reduce((a, b) => a + b, 0);
  const refundCumTotal = refundCumByPerson.reduce((a, b) => a + b, 0);

  const totalRefund = refundCumTotal;
  const peakAsset = Math.max(...plan.map((r) => r.perPerson.reduce((b, p) => b + p.bal, 0)));
  const retireRow = plan.find((r) => r.perPerson.every((p) => p.retired)) || plan[plan.length - 1];

  // 사람별 은퇴시점 자산 + 은퇴후 월 연금(사적+국민)
  const retireAssetByPerson = people.map((_, i) => {
    const r = plan.find((row) => row.perPerson[i]?.retired) || plan[plan.length - 1];
    // 은퇴 직전 마지막 적립 행의 자산
    let last = 0;
    for (const row of plan) { if (!row.perPerson[i]?.retired) last = row.perPerson[i]?.bal || last; }
    return last;
  });
  // 사람별: 사적연금 월액 / 국민연금 월액 / 각 개시나이 (나눠서 표시)
  const pensionDetailByPerson = people.map((p, i) => {
    const retireAge = p.retireAge || 55;
    const npsStartA = npsStartAge(parseInt(String(p.birth || "1995").replace(/[^0-9]/g, "").slice(0, 4)) || 1995);
    // 사적연금 월액: 수령 시작 직후 행의 recv/12
    let privM = 0, npsM = 0;
    for (const row of plan) {
      const pp = row.perPerson[i]; if (!pp) continue;
      if (pp.recv > 0) privM = Math.max(privM, pp.recv / 12);
      if (pp.nps > 0) npsM = Math.max(npsM, pp.nps / 12);
    }
    return { priv: privM, nps: npsM, retireAge, npsStartA, recvYears: p.recvTo100 ? Math.max(1, 100 - retireAge) : (p.recvYears || 30) };
  });
  // 합계(둘 다 최대로 받을 때의 가족 월액 = 사적합 + 국민합)
  const pensionByPerson = pensionDetailByPerson.map((d) => d.priv + d.nps);

  const displayRows = plan.filter((r) => Math.max(...r.perPerson.map((p) => p.age)) <= 90);
  const birthYears = people.map((p) => parseInt(String(p.birth || "1995").replace(/[^0-9]/g, "").slice(0, 4)) || 1995);

  return (
    <div>
      <div style={{ padding: "14px 18px", background: C.tealLt, borderRadius: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Fraunces', serif", color: C.teal, marginBottom: 4 }}>{people.map((p) => p.name).join(" + ")} · 100세 자산 플랜</div>
        <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>
          매해 연금저축·IRP·ISA를 얼마 넣으면 세액공제 얼마 받고, 자산이 얼마로 불어나고, 은퇴 후 연금을 얼마 받는지 한눈에.
          <b> 한 해 값을 바꾸면 그 다음 해부터 자동으로 같은 값이 채워져요</b>(다음에 바꾸는 해 전까지).
        </div>
      </div>

      {/* 세액공제 요약: 사람(행) × 항목(열) */}
      <Section title="연금 자산·수령 요약" desc="사람별로 은퇴시점 연금 자산과, 은퇴 후 받을 월 연금(사적+국민)을 봅니다.">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: C.teal, color: "#fff" }}>
              <th style={thS}>구성원</th>
              <th style={thS}>올해 세금 환급</th>
              <th style={{ ...thS, background: C.gold }}>은퇴시점 연금 자산</th>
              <th style={{ ...thS, background: C.navy }}>월 연금 총합<br />(사적+국민)</th>
              <th style={{ ...thS, background: C.navy }}>사적연금 월액</th>
              <th style={{ ...thS, background: C.navy }}>국민연금 월액</th>
            </tr></thead>
            <tbody>
              {people.map((p, i) => {
                const d = pensionDetailByPerson[i];
                const endAge = d.retireAge + d.recvYears;
                return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ ...tdS, fontWeight: 700, color: "#fff", textAlign: "left", background: accentOf(i) }}>{p.name}</td>
                  <td style={{ ...tdS, color: C.teal, fontWeight: 600 }}>{won(refundThisYear[i])}원</td>
                  <td style={{ ...tdS, color: C.gold, fontWeight: 600 }}>{won(retireAssetByPerson[i])}원</td>
                  <td style={{ ...tdS, color: C.navy, fontWeight: 700 }}>{won(d.priv + d.nps)}원</td>
                  <td style={{ ...tdS, color: C.navy, fontWeight: 600 }}>{won(d.priv)}원<br /><span style={{ fontSize: 9.5, color: C.sub, fontWeight: 400 }}>{d.retireAge}세~{endAge}세 ({d.recvYears}년)</span></td>
                  <td style={{ ...tdS, color: C.navy, fontWeight: 600 }}>{won(d.nps)}원<br /><span style={{ fontSize: 9.5, color: C.sub, fontWeight: 400 }}>{d.npsStartA}세~평생</span></td>
                </tr>
                );
              })}
              <tr style={{ borderTop: `2px solid ${C.line}`, background: C.tealLt + "55" }}>
                <td style={{ ...tdS, fontWeight: 700, textAlign: "left" }}>총합</td>
                <td style={{ ...tdS, fontWeight: 700, color: C.teal }}>{won(refundThisYearTotal)}원</td>
                <td style={{ ...tdS, fontWeight: 700, color: C.gold }}>{won(retireAssetByPerson.reduce((a, b) => a + b, 0))}원</td>
                <td style={{ ...tdS, fontWeight: 700, color: C.navy }}>{won(pensionDetailByPerson.reduce((a, d) => a + d.priv + d.nps, 0))}원</td>
                <td style={{ ...tdS, fontWeight: 700, color: C.navy }}>{won(pensionDetailByPerson.reduce((a, d) => a + d.priv, 0))}원</td>
                <td style={{ ...tdS, fontWeight: 700, color: C.navy }}>{won(pensionDetailByPerson.reduce((a, d) => a + d.nps, 0))}원</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8, lineHeight: 1.6 }}>
          ※ <b>올해 세금 환급</b> = 2026년 연금저축·IRP 납입으로 연말정산 때 돌려받는 세금.<br />
          ※ <b>은퇴시점 연금 자산</b> = 연금 개시 직전까지 적립된 연금 자산(연금저축+IRP+ISA).<br />
          ※ <b>사적연금 월액</b> = 은퇴시점 연금 자산 ÷ 수령분할년수 ÷ 12 (은퇴나이부터 수령). <b>국민연금 월액</b> = 공단 공식 추정 (개시나이부터 평생). 둘은 받는 시점·기간이 달라 나눠서 표시해요.
        </div>
      </Section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <Stat label="올해 세금 환급 (가족)" value={`${won(refundThisYearTotal)}원`} accent={C.teal} bg={C.tealLt} />
        <Stat label="은퇴후 월 연금 (가족, 사적+국민)" value={`${won(pensionDetailByPerson.reduce((a, d) => a + d.priv + d.nps, 0))}원`} accent={C.navy} bg={C.navyLt} />
      </div>

      {/* 사람별 가정 */}
      <Section title="사람별 플랜 가정" desc="연금 시작연도·성장률·은퇴 나이를 사람마다 다르게 설정할 수 있어요. 표는 가장 이른 연금 시작연도부터 자동으로 시작됩니다.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          {people.map((p, i) => (
            <div key={i} style={{ padding: 14, background: bgOf(i), borderRadius: 12 }}>
              <div style={{ fontWeight: 700, color: accentOf(i), marginBottom: 10, fontFamily: "'Fraunces', serif" }}>{p.name} <span style={{ fontSize: 11, fontWeight: 400, color: C.sub }}>({p.gender === "F" ? "여" : "남"}·{birthYears[i]}년생, 국민연금 {npsStartAge(birthYears[i])}세 개시, 기대수명 {LIFE_EXPECTANCY[p.gender]}세)</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <NumIn label="연금 시작연도" value={p.pensionStart || 2026} step={1} suffix="년" onChange={(v) => setPeople((arr) => arr.map((x, j) => j === i ? { ...x, pensionStart: v } : x))} hint="이 해부터 적립 시작" />
                <NumIn label="자산성장률" value={p.growth} step={0.5} suffix="%" onChange={(v) => setPeople((arr) => arr.map((x, j) => j === i ? { ...x, growth: v } : x))} />
                <NumIn label="연금개시(은퇴)" value={p.retireAge} step={1} suffix="세" onChange={(v) => setPeople((arr) => arr.map((x, j) => j === i ? { ...x, retireAge: v } : x))} />
                {p.recvTo100
                  ? <NumIn label="수령분할(100세까지)" value={Math.max(1, 100 - (p.retireAge || 55))} suffix="년" onChange={() => {}} />
                  : <NumIn label="수령분할" value={p.recvYears} step={1} suffix="년" onChange={(v) => setPeople((arr) => arr.map((x, j) => j === i ? { ...x, recvYears: v } : x))} />}
                <NumIn label="국민연금 기가입" value={p.npsPast || 0} step={1} suffix="년" onChange={(v) => setPeople((arr) => arr.map((x, j) => j === i ? { ...x, npsPast: v } : x))} hint="지금까지 낸 가입연수(과거분)" />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.sub, gridColumn: "1 / -1", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!p.recvTo100} onChange={(e) => setPeople((arr) => arr.map((x, j) => j === i ? { ...x, recvTo100: e.target.checked } : x))} />
                  사적연금을 <b>100세까지</b> 나눠 받기 (은퇴~100세 = {Math.max(1, 100 - (p.retireAge || 55))}년)
                </label>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 타임라인 */}
      <Section title="연도별 플랜 (결과 보기)" desc="연금저축·IRP·ISA 납입은 ③ 수입 탭에서 입력해요. 여기서는 그 값으로 계산한 세액공제·은퇴자산·연금수령 결과를 보여줍니다.">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: C.teal, color: "#fff" }}>
                <th style={thS}>연도</th><th style={thS}>나이</th>
                {people.map((p, i) => <th key={i} style={{ ...thS, borderLeft: "2px solid #fff", background: accentOf(i) }} colSpan={6}>{p.name}</th>)}
                <th style={{ ...thS, borderLeft: "2px solid #fff" }}>연지출</th><th style={thS}>해당 해<br />적립</th><th style={thS}>누적 자산</th><th style={thS}>총 월 연금<br />(사적+국민)</th>
              </tr>
              <tr style={{ background: C.teal, color: "#fff", fontSize: 10 }}>
                <th style={thS}></th><th style={thS}></th>
                {people.map((p, i) => (<React.Fragment key={i}><th style={{ ...thS, borderLeft: "2px solid #fff", background: accentOf(i), opacity: 0.85 }}>연금저축</th><th style={{ ...thS, background: accentOf(i), opacity: 0.85 }}>IRP</th><th style={{ ...thS, background: accentOf(i), opacity: 0.85 }}>ISA</th><th style={{ ...thS, background: accentOf(i), opacity: 0.85 }}>세금환급</th><th style={{ ...thS, background: accentOf(i), opacity: 0.85 }}>사적수령</th><th style={{ ...thS, background: accentOf(i), opacity: 0.85 }}>국민연금</th></React.Fragment>))}
                <th style={{ ...thS, borderLeft: "2px solid #fff" }}></th><th style={thS}></th><th style={{ ...thS, fontSize: 8.5, fontWeight: 400 }}>(연금저축<br />+IRP+ISA)</th><th style={thS}></th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, ri) => {
                const refundSum = r.perPerson.reduce((a, p) => a + p.refund, 0);
                const assetSum = r.perPerson.reduce((a, p) => a + p.bal, 0);
                const contribThisYear = r.perPerson.reduce((a, p) => a + (p.ps || 0) + (p.irp || 0) + (p.isa || 0), 0);
                const pensionMonthly = r.perPerson.reduce((a, p) => a + (p.recv + p.nps) / 12, 0);
                const expense = (yearlyExpense[r.year]?.spending || 0) + (yearlyExpense[r.year]?.loanPay || 0);
                const anyNps = r.perPerson.some((p) => p.nps > 0);
                const anyRetired = r.perPerson.some((p) => p.retired);
                return (
                  <React.Fragment key={ri}>
                  <tr style={{ background: anyNps ? C.navyLt : (anyRetired ? C.goldLt : (ri % 2 ? C.paper : C.card)), borderBottom: `1px solid ${C.line}` }}>
                    <td style={tdS} title={planOverride[r.year]?.memo || "우클릭으로 메모"} onContextMenu={(e) => { e.preventDefault(); const m = prompt("이 해 메모:", planOverride[r.year]?.memo || ""); if (m != null) setPlanOverride((o) => ({ ...o, [r.year]: { ...o[r.year], memo: m } })); }}>{r.year}{planOverride[r.year]?.memo ? " 📝" : ""}</td>
                    <td style={tdS}>{r.perPerson.map((p) => p.age).join("/")}</td>
                    {r.perPerson.map((p, i) => (
                      <React.Fragment key={i}>
                        {p.notStarted ? (
                          <>
                            <td style={{ ...tdS, borderLeft: `2px solid ${C.line}`, color: C.sub }} title="연금 시작연도 이전">—</td>
                            <td style={{ ...tdS, color: C.sub }}>—</td>
                            <td style={{ ...tdS, color: C.sub }}>—</td>
                            <td style={{ ...tdS, color: C.sub }}>—</td>
                            <td style={{ ...tdS, color: C.sub }}>—</td>
                            <td style={{ ...tdS, color: C.sub }}>—</td>
                          </>
                        ) : (<>
                        <td style={{ ...tdS, borderLeft: `2px solid ${bgOf(i)}`, background: bgOf(i) + "40", color: C.sub }}>{p.retired ? "—" : won(getVal(r.year, `p${i}_ps`, Math.min(people[i].pensionSaving, 600)))}</td>
                        <td style={{ ...tdS, background: bgOf(i) + "40", color: C.sub }}>{p.retired ? "—" : won(getVal(r.year, `p${i}_irp`, Math.min(people[i].irp, 300)))}</td>
                        <td style={{ ...tdS, background: planOverride[r.year]?.[`p${i}_isaDissolve`] ? C.rustLt : bgOf(i) + "40", color: C.sub }}>{p.retired ? "—" : (
                          <div style={{ textAlign: "center" }}>
                            {won(getVal(r.year, `p${i}_isa`, 0))}
                            {planOverride[r.year]?.[`p${i}_isaDissolve`] && p.dissolved > 0 && (
                              <div style={{ fontSize: 9, color: C.rust, fontWeight: 700, lineHeight: 1.1 }}>↻ 해지 {won(p.dissolved)}</div>
                            )}
                          </div>
                        )}</td>
                        <td style={{ ...tdS, background: bgOf(i) + "40", color: p.refund > 0 ? C.teal : C.sub, fontWeight: p.refund > 0 ? 600 : 400 }}>{p.refund > 0 ? won(p.refund) : "—"}</td>
                        <td style={{ ...tdS, background: bgOf(i) + "40", color: p.recv > 1500 ? C.rust : (p.recv > 0 ? C.gold : C.sub), fontWeight: p.recv > 1500 ? 700 : 400 }} title={p.recv > 1500 ? "연 1,500만 초과! 초과분은 16.5% 분리과세 또는 종합과세로 불리" : undefined}>{p.recv > 0 ? (won(p.recv) + (p.recv > 1500 ? " ⚠️" : "")) : "—"}</td>
                        <td style={{ ...tdS, background: bgOf(i) + "40", color: p.nps > 0 ? C.navy : C.sub }}>{p.nps > 0 ? won(p.nps) : "—"}</td>
                        </>)}
                      </React.Fragment>
                    ))}
                    <td style={{ ...tdS, borderLeft: `2px solid ${C.line}`, color: expense > 0 ? C.rust : C.sub }}>{expense > 0 ? won(expense) : "—"}</td>
                    <td style={{ ...tdS, color: C.sub }}>{contribThisYear > 0 ? won(contribThisYear) : "—"}</td>
                    <td style={{ ...tdS, fontWeight: 700 }}>{won(assetSum)}</td>
                    <td style={{ ...tdS, fontWeight: 700, color: pensionMonthly > 0 ? C.navy : C.sub }}>{pensionMonthly > 0 ? won(pensionMonthly) : "—"}</td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>


        <div style={{ fontSize: 10.5, color: C.sub, marginTop: 10, lineHeight: 1.5 }}>
          ※ 사람별 색상으로 구분돼요. <b>해당 해 적립</b> = 그 해 새로 넣은 연금저축+IRP+ISA. <b>누적 자산</b> = 그때까지 쌓여 불어난 연금 자산(연금저축+IRP+ISA, 인출 시 차감). <b>총 월 연금</b> = 그 해 받는 사적+국민연금의 월 합계.<br />
          ※ 연도 칸을 <b>우클릭</b>하면 그 해 메모를 남길 수 있어요(📝 표시). 금색=사적연금 개시 / 남색=국민연금 개시 이후.
          <br /><b style={{ color: C.rust }}>⚠️ 사적연금(연금저축+IRP) 수령액이 연 1,500만을 넘으면</b> 저율과세(3.3~5.5%)가 안 되고 초과분이 16.5% 분리과세 또는 종합과세로 불리해져요.
        </div>
        <div style={{ marginTop: 12 }}><button onClick={() => exportExcel(displayRows, people)} style={{ ...btn, background: C.teal, color: "#fff", border: "none" }}>📥 엑셀로 내보내기</button></div>
      </Section>
    </div>
  );
}

const thS = { padding: "6px 5px", textAlign: "center", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "middle" };
const tdS = { padding: "4px 5px", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" };
const cellIn = { width: 48, padding: "3px 4px", fontSize: 11, textAlign: "center", border: `1px solid ${C.line}`, borderRadius: 5, fontFamily: "inherit", background: "#fff" };

async function exportExcel(rows, people) {
  if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const XLSX = window.XLSX;
  const header = ["연도", "나이"];
  people.forEach((p) => header.push(`${p.name}_연금저축`, `${p.name}_IRP`, `${p.name}_ISA`, `${p.name}_사적수령`, `${p.name}_국민연금`));
  header.push("환급", "가족자산", "총연금월액");
  const data = [header];
  rows.forEach((r) => {
    const row = [r.year, r.perPerson.map((p) => p.age).join("/")];
    r.perPerson.forEach((p) => row.push(p.retired ? 0 : Math.round(p.ps), p.retired ? 0 : Math.round(p.irp), p.retired ? 0 : Math.round(p.isa), Math.round(p.recv), Math.round(p.nps)));
    row.push(Math.round(r.perPerson.reduce((a, p) => a + p.refund, 0)), Math.round(r.perPerson.reduce((a, p) => a + p.bal, 0)), Math.round(r.perPerson.reduce((a, p) => a + (p.recv + p.nps) / 12, 0)));
    data.push(row);
  });
  const ws = XLSX.utils.aoa_to_sheet(data), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "100세플랜");
  XLSX.writeFile(wb, "100세_자산플랜.xlsx");
}

// ============================================================
// 탭 4: ISA·연금 시뮬
// ============================================================
function TabIsa({ people, policy, setPolicy }) {
  return (
    <div>
      <div style={{ padding: "12px 16px", background: C.tealLt, borderRadius: 10, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
        💡 ISA를 몇 년 굴릴지 정하고 연차별 납입·수익률을 넣으면 만기 평가금액이 계산돼요. 만기에 연금저축/IRP/새 ISA로 옮길 때 혜택도 봐요.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${people.length}, 1fr)`, gap: 16 }}>
        {people.map((p, i) => <IsaSim key={i} person={p} idx={i} policy={policy} />)}
      </div>
    </div>
  );
}

function IsaSim({ person, idx, policy }) {
  const [years, setYears] = useState(3);
  const [startY, setStartY] = useState(2026);
  const [deposits, setDeposits] = useState([2000, 2000, 2000, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [returns, setReturns] = useState([6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]);
  const [transfer, setTransfer] = useState({ pension: 600, irp: 600, newIsa: 2000 });
  const creditRate = pensionCreditRate(person.salary);
  const slots = years + 1;

  const res = useMemo(() => {
    let bal = 0, principal = 0;
    for (let y = 0; y < slots; y++) { principal += deposits[y] || 0; bal = (bal + (deposits[y] || 0)) * (1 + (returns[y] || 0) / 100); }
    const profit = bal - principal;
    const isaTax = Math.max(0, profit - policy.isaTaxFree) * policy.isaExcess;
    return { bal, principal, profit, isaTax, afterTax: bal - isaTax };
  }, [slots, deposits, returns, policy]);

  const tTotal = transfer.pension + transfer.irp;
  const extra = Math.min(tTotal * 0.1, policy.isaExtraCap);
  const creditBase = Math.min(tTotal, policy.pensionCap + extra);
  const refund = creditBase * creditRate;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: bgOf(idx), padding: "12px 16px", borderBottom: `1px solid ${C.line}`, fontWeight: 700, color: accentOf(idx), fontFamily: "'Fraunces', serif" }}>{person.name} · ISA <span style={{ fontSize: 11, fontWeight: 400, color: C.sub }}>(공제율 {pct(creditRate)})</span></div>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ width: 120 }}>
            <NumIn label="가입 연수" value={years} step={1} suffix="년" onChange={(v) => setYears(Math.max(1, Math.min(10, v)))} hint="직접 입력 (1~10)" />
          </div>
          <div style={{ fontSize: 11, color: C.sub, paddingBottom: 14 }}>의무가입 3년 이상</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", fontSize: 11, color: C.sub, marginBottom: 4, paddingLeft: 4 }}><span style={{ width: 52 }}>연도</span><span style={{ width: 44 }}>연차</span><span style={{ flex: 1 }}>납입(만원)</span><span style={{ width: 70 }}>수익률%</span></div>
          {Array.from({ length: slots }).map((_, y) => (
            <div key={y} style={{ display: "flex", gap: 5, marginBottom: 5, alignItems: "center" }}>
              <input type="number" value={startY + y} disabled={y !== 0} onChange={(e) => { if (y === 0) setStartY(parseFloat(e.target.value) || 2026); }} style={{ width: 52, padding: "6px 4px", fontSize: 12, textAlign: "center", border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit", background: y === 0 ? C.card : C.paper, color: y === 0 ? C.ink : C.sub }} />
              <span style={{ width: 44, fontSize: 12, fontWeight: 600 }}>{y + 1}년차</span>
              <input type="number" value={deposits[y]} step={100}
                onChange={(e) => { const v = parseFloat(e.target.value) || 0; setDeposits((a) => a.map((d, j) => j >= y ? v : d)); }}
                title="이 값이 이후 연차에도 자동 적용돼요(개별 수정 가능)"
                style={{ flex: 1, padding: "6px 8px", fontSize: 13, border: `1px solid ${deposits[y] > policy.isaLimit ? C.rust : C.line}`, borderRadius: 6, fontFamily: "inherit" }} />
              <input type="number" value={returns[y]} step={0.5}
                onChange={(e) => { const v = parseFloat(e.target.value) || 0; setReturns((a) => a.map((d, j) => j >= y ? v : d)); }}
                title="이 값이 이후 연차에도 자동 적용돼요(개별 수정 가능)"
                style={{ width: 70, padding: "6px 8px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit" }} />
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>{years}년 가입 → 연 중간 개설 시 {slots}개 연차 납입 가능. 한 칸 입력하면 이후 연차에 자동 복사(전년도값 유지).</div>
        </div>
        <div style={{ padding: "12px 14px", background: C.paper, borderRadius: 10, fontSize: 12.5, marginBottom: 12 }}>
          <Row k="적립원금" v={`${won(res.principal)}원`} />
          <Row k="평가금액" v={`${won(res.bal)}원`} accent={accentOf(idx)} bold />
          <Row k="수익" v={`+${won(res.profit)}원`} accent={C.teal} />
          <Row k={`ISA 세금(비과세 ${policy.isaTaxFree}만)`} v={`−${won(res.isaTax)}원`} accent={C.rust} />
          <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0", paddingTop: 6 }}><Row k="세후 수령액" v={`${won(res.afterTax)}원`} bold accent={accentOf(idx)} /></div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 6 }}>만기 이관 배분 (세후 수령액 {won(res.afterTax)}원 내에서)</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <NumIn label="→연금저축" value={transfer.pension} onChange={(v) => setTransfer({ ...transfer, pension: v })} max={600} />
            <NumIn label="→IRP" value={transfer.irp} onChange={(v) => setTransfer({ ...transfer, irp: v })} max={900} hint="연금저축과 합산 900 공제" />
            <NumIn label="→새 ISA(재가입)" value={transfer.newIsa} onChange={(v) => setTransfer({ ...transfer, newIsa: v })} />
            <NumIn label="→기타(예금·투자 등)" value={transfer.other || 0} onChange={(v) => setTransfer({ ...transfer, other: v })} />
          </div>
        </div>
        <div style={{ padding: "12px 14px", background: C.goldLt, borderRadius: 10, fontSize: 12.5 }}>
          <Row k="배분 합계" v={`${won(tTotal + transfer.newIsa + (transfer.other || 0))}원`} />
          {(() => {
            const allocated = tTotal + transfer.newIsa + (transfer.other || 0);
            const leftover = res.afterTax - allocated;
            return <Row k={leftover >= 0 ? "남은 현금(미배분)" : "⚠️ 초과 배분"} v={`${won(leftover)}원`} accent={leftover >= 0 ? C.teal : C.rust} bold />;
          })()}
          <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0", paddingTop: 6 }}>
            <Row k="연금+IRP 이전액" v={`${won(tTotal)}원`} />
            <Row k="ISA이전 추가공제(10%)" v={`+${won(extra)}원`} accent={C.teal} />
            <Row k="공제대상" v={`${won(creditBase)}원`} />
            <Row k={`연금 세액공제 환급(${pct(creditRate)})`} v={`${won(refund)}원`} bold accent={C.gold} />
            {transfer.newIsa > 0 && <Row k="새 ISA 비과세 한도 확보" v={`${won(transfer.newIsa)}원`} accent={C.navy} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 탭 5: 투자수익 세금
// ============================================================
function TabInvest({ people, policy, setPolicy }) {
  const [invest, setInvest] = useState(people.map(() => ({ domDiv: 0, frnDiv: 0, interest: 0 })));
  const [compareProfit, setCompareProfit] = useState(1000);
  // people 변경 시 invest 길이 보정
  const inv = people.map((_, i) => invest[i] || { domDiv: 0, frnDiv: 0, interest: 0 });
  const updI = (i, k, v) => setInvest((arr) => { const c = people.map((_, j) => arr[j] || { domDiv: 0, frnDiv: 0, interest: 0 }); c[i] = { ...c[i], [k]: v }; return c; });

  function finTax(person, iv) {
    const total = iv.domDiv + iv.frnDiv + iv.interest;
    if (total <= policy.finThreshold) return { total, over: 0, final: total * policy.finWithhold, health: 0, method: "분리과세 종결" };
    const over = total - policy.finThreshold;
    const sep = total * policy.finWithhold;
    const r = preciseIncomeTax(person.salary, 150);
    const marg = marginalRate(r.taxBase + over);
    const comp = (policy.finThreshold * 0.14 + over * marg) * 1.1;
    const final = Math.max(sep, comp);
    const health = over * policy.healthRate * (1 + policy.ltcRate);
    return { total, over, final, health, method: final === comp ? "종합과세" : "분리(비교과세)" };
  }

  const P = compareProfit;
  const products = [
    { name: "일반계좌 국내주식 양도", tax: 0, note: "비과세", color: C.teal },
    { name: "일반계좌 배당/이자", tax: P * 0.154, note: "15.4%(2천 넘으면 종합과세)", color: C.rust },
    { name: "일반계좌 해외주식 양도", tax: Math.max(0, P - 250) * 0.22, note: "250만공제후 22%", color: C.rust },
    { name: "ISA 안", tax: Math.max(0, P - policy.isaTaxFree) * policy.isaExcess, note: `비과세 ${policy.isaTaxFree}만+9.9%·종합과세 제외`, color: C.teal },
    { name: "연금계좌 안", tax: 0, note: "과세이연·종합과세 제외", color: C.gold },
  ];
  if (policy.highDivOn) products.splice(2, 0, { name: "일반계좌 고배당(분리)", tax: P * policy.highDivRate, note: `분리 ${(policy.highDivRate * 100).toFixed(1)}%`, color: C.gold });
  const maxTax = Math.max(...products.map((x) => x.tax), 1);

  return (
    <div>
      <div style={{ padding: "14px 18px", background: C.tealLt, borderRadius: 12, marginBottom: 18, fontSize: 12.5, lineHeight: 1.65 }}>
        <div style={{ fontWeight: 700, color: C.teal, marginBottom: 6 }}>💡 이 탭은 언제 쓰나? (지금은 참고용)</div>
        배당을 키우다 보면 <b>연 배당+이자가 2,000만을 넘는 순간</b> 세금이 뛰고 건보료가 붙어요. 그때 ISA·연금으로 옮기거나 부부가 나눠 담으라고 알려주는 도구예요.
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
          <b>분리과세</b>=다른 소득과 안 합치고 그 자리서 끝. <b>일반계좌</b>도 배당/이자는 분리과세(15.4%)지만 <b>연 2천만까지만</b>—넘으면 종합과세. <b>ISA</b>는 비과세+9.9%+2천만 합산 제외, <b>연금</b>은 과세이연으로 합산 제외. 그래서 절세 우산이에요.
        </div>
      </div>

      <Section title="금융소득 종합과세 (일반계좌, 2천만 선)" desc="일반계좌 이자+배당만. ISA·연금 안 수익은 제외. 개인별 판단이라 나눌수록 유리.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {people.map((p, i) => {
            const f = finTax(p, inv[i]);
            return (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: bgOf(i), padding: "10px 16px", fontWeight: 700, color: accentOf(i), fontFamily: "'Fraunces', serif" }}>{p.name}</div>
                <div style={{ padding: 16 }}>
                  <NumIn label="국내배당" value={inv[i].domDiv} onChange={(v) => updI(i, "domDiv", v)} />
                  <NumIn label="해외배당" value={inv[i].frnDiv} onChange={(v) => updI(i, "frnDiv", v)} />
                  <NumIn label="이자소득" value={inv[i].interest} onChange={(v) => updI(i, "interest", v)} />
                  <div style={{ padding: "10px 12px", background: C.paper, borderRadius: 8, fontSize: 12.5, marginTop: 4 }}>
                    <Row k="과세방식" v={f.method} accent={f.over > 0 ? C.rust : C.teal} />
                    <Row k="금융소득세" v={`${won(f.final)}원`} />
                    {f.over > 0 && <><Row k="건보료 추가(장기요양포함)" v={`${won(f.health)}원`} accent={C.rust} /><div style={{ borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 6 }}><Row k="세금+건보료" v={`${won(f.final + f.health)}원`} bold accent={C.rust} /></div></>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="같은 수익, 계좌·상품별 세금" desc="ISA·연금은 종합과세에서도 빠진다는 게 핵심.">
        <div style={{ maxWidth: 200, marginBottom: 14 }}><NumIn label="비교할 수익금액" value={compareProfit} onChange={setCompareProfit} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {products.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 165, fontSize: 11.5, flexShrink: 0 }}>{a.name}</span>
              <div style={{ flex: 1, position: "relative", height: 26, background: C.paper, borderRadius: 5, overflow: "hidden" }}><div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(a.tax / maxTax) * 100}%`, minWidth: a.tax > 0 ? 2 : 0, background: a.color, opacity: 0.85 }} /><span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11.5, fontWeight: 600, color: a.tax / maxTax > 0.4 ? "#fff" : C.ink }}>{a.tax === 0 ? "세금 0" : won(a.tax) + "원"}</span></div>
              <span style={{ width: 165, fontSize: 10.5, color: C.sub, flexShrink: 0 }}>{a.note}</span>
            </div>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer", fontSize: 12.5 }}>
          <input type="checkbox" checked={policy.highDivOn} onChange={(e) => setPolicy({ ...policy, highDivOn: e.target.checked })} />
          고배당기업 배당 분리과세 (2026 시행, 세부 변동 가능)
        </label>
      </Section>
    </div>
  );
}

// ============================================================
// 탭 6: 대출·소비 관리 (월별 입력 → 연별 집계)
// ============================================================
const _now = new Date();
const TODAY_YM = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`; // 과거/미래 경계 (오늘 기준 자동)

function ymList(startYM, endYM) {
  const [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  const list = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    list.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return list;
}

function TabLoanSpending({ people, loans, setLoans, spending, setSpending, loanPay, setLoanPay, cellMemos, setCellMemos }) {
  const setMemo = (key, v) => setCellMemos((m) => { const n = { ...m }; if (v) n[key] = v; else delete n[key]; return n; });
  // 연도별 접기 상태: 올해(現)만 펼침
  const thisYear = parseInt(TODAY_YM.split("-")[0]);
  const [openYears, setOpenYears] = useState({ [thisYear]: true });
  const [openSections, setOpenSections] = useState({ current: true }); // before/current/after
  const toggleSection = (k) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));
  // 전달(직전 달) ym 구하기: "2026-03" → "2026-02"
  const prevYm = (ym) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const toggleYear = (y) => setOpenYears((o) => ({ ...o, [y]: !o[y] }));
  const [rangeStart, setRangeStart] = useState("2021-01");
  const [rangeEnd, setRangeEnd] = useState("2027-12");
  const months = ymList(rangeStart, rangeEnd);

  const updLoan = (i, k, v) => setLoans((arr) => arr.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const addLoan = () => setLoans((arr) => [...arr, { name: `대출${arr.length + 1}`, bank: "", type: "신용", owner: "0", principal: 1000, rate: 4.0, termYear: 2035, method: "원리금균등", balance: 1000 }]);
  const removeLoan = (i) => setLoans((arr) => arr.filter((_, j) => j !== i));

  const setSpend = (ym, key, v) => setSpending((o) => ({ ...o, [ym]: { ...o[ym], [key]: v } }));
  const setPay = (ym, key, v) => setLoanPay((o) => ({ ...o, [ym]: { ...o[ym], [key]: v } }));

  // 대출 잔액 자동 추적: 원금에서 매월 상환액 누적 차감
  const loanBalances = useMemo(() => {
    const result = {}; // { ym: { loanI: balance } }
    const running = loans.map((l) => l.principal);
    for (const ym of months) {
      result[ym] = {};
      loans.forEach((l, i) => {
        const principalPay = loanPay[ym]?.[`loan${i}_principal`] || 0; // 원금만 잔액 차감
        running[i] = Math.max(0, running[i] - principalPay);
        result[ym][i] = running[i];
      });
    }
    return result;
  }, [loans, loanPay, months]);

  // 연별 집계 (소비 합계 + 대출 원금상환 + 이자)
  const yearly = useMemo(() => {
    const agg = {};
    for (const ym of months) {
      const year = ym.split("-")[0];
      if (!agg[year]) agg[year] = { spending: 0, principal: 0, interest: 0, income: 0 };
      const sp = spending[ym] || {};
      agg[year].spending += (sp.living || 0) + (sp.mgmt || 0) + (sp.internet || 0) + (sp.subscribe || 0) + (sp.etc || 0);
      people.forEach((p, pi) => { agg[year].income += sp[`income${pi}`] || 0; });
      const lp = loanPay[ym] || {};
      loans.forEach((l, i) => {
        agg[year].principal += lp[`loan${i}_principal`] || 0;
        agg[year].interest += lp[`loan${i}_interest`] || 0;
      });
    }
    return agg;
  }, [spending, loanPay, months, loans, people]);

  const isPast = (ym) => ym <= TODAY_YM;

  // 명의별 그룹: 각 구성원 → 부부공동 순서. 원본 인덱스 유지
  const ownerGroups = useMemo(() => {
    const groups = [];
    people.forEach((p, pi) => {
      const items = loans.map((l, i) => ({ l, i })).filter((x) => x.l.owner === String(pi));
      if (items.length) groups.push({ key: String(pi), label: `${p.name} 명의`, color: accentOf(pi), bg: bgOf(pi), items });
    });
    const joint = loans.map((l, i) => ({ l, i })).filter((x) => x.l.owner === "공동");
    if (joint.length) groups.push({ key: "공동", label: "부부공동", color: C.rust, bg: C.rustLt, items: joint });
    return groups;
  }, [loans, people]);

  return (
    <div>
      <div style={{ padding: "14px 18px", background: C.tealLt, borderRadius: 12, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
        💡 월별로 소비·대출 상환을 기록하면 <b>연별로 자동 집계</b>되고, 그 값이 <b>③ 100세 플랜의 자산 계산에 반영</b>돼요.
        오늘({TODAY_YM}) 기준 <b>이전은 실적, 이후는 계획</b>으로 구분돼요. (단위: 만원)
      </div>

      {/* 대출 정보는 ⑥ 계좌 관리로 이동 */}
      <div style={{ padding: "12px 16px", background: C.rustLt, borderRadius: 10, fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 18 }}>
        💳 대출의 <b>기본 정보</b>(원금·금리·만기·명의)는 이제 <b>⑥ 계좌 관리</b> 탭에서 관리해요. 여기서는 <b>월별 상환액</b>만 입력합니다.
      </div>

      {/* 기간 설정 */}
      <Section title="월별 기록" desc="연도를 클릭하면 펼치기/접기. 회색=과거(실적), 흰색=미래(계획). 각 칸에 우클릭하면 메모(돈 출처 등)를 달 수 있어요(메모 있는 칸은 금색 삼각형 표시).">
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: C.sub, fontSize: 13 }}>📅 표시 기간:</span>
          <input type="month" value={rangeStart} onChange={(e) => e.target.value && setRangeStart(e.target.value)} style={{ width: 150, height: 32, padding: "0 10px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit", background: C.card, color: C.ink }} />
          <span style={{ color: C.sub }}>~</span>
          <input type="month" value={rangeEnd} onChange={(e) => e.target.value && setRangeEnd(e.target.value)} style={{ width: 150, height: 32, padding: "0 10px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit", background: C.card, color: C.ink }} />
          <span style={{ fontSize: 11, color: C.sub }}>{months.length}개월 ({Math.floor(months.length / 12)}년 {months.length % 12}개월)</span>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr style={{ background: C.teal, color: "#fff" }}>
                <th style={thS}>연-월</th>
                <th style={thS}>생활비</th><th style={thS}>관리비</th><th style={thS}>인터넷</th><th style={thS}>구독료</th><th style={thS}>기타</th>
                {ownerGroups.flatMap((g) => g.items).map(({ l, i }) => {
                  const g = ownerGroups.find((gr) => gr.items.some((x) => x.i === i));
                  return <th key={`p${i}`} style={{ ...thS, borderLeft: "2px solid #fff", background: g.color }}>{l.name}<br />원금</th>;
                })}
                {ownerGroups.flatMap((g) => g.items).map(({ l, i }) => {
                  const g = ownerGroups.find((gr) => gr.items.some((x) => x.i === i));
                  return <th key={`int${i}`} style={{ ...thS, borderLeft: "1px solid #fff", background: g.color, opacity: 0.9 }}>{l.name}<br />이자</th>;
                })}
                {ownerGroups.flatMap((g) => g.items).map(({ l, i }) => {
                  const g = ownerGroups.find((gr) => gr.items.some((x) => x.i === i));
                  return <th key={`bal${i}`} style={{ ...thS, borderLeft: "1px solid #fff", fontSize: 10, background: g.color, opacity: 0.8 }}>{l.name}<br />잔액</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const orderedLoans = ownerGroups.flatMap((g) => g.items);
                const colCount = 6 + orderedLoans.length * 3;
                const curYear = thisYear;
                // 전달값 가져오기 (placeholder용)
                const prevVal = (ym, key) => { const p = spending[prevYm(ym)]; return p && p[key] ? Number(p[key]).toLocaleString("ko-KR") : ""; };
                const prevPay = (ym, key) => { const p = loanPay[prevYm(ym)]; return p && p[key] ? Number(p[key]).toLocaleString("ko-KR") : ""; };
                // 한 달 행 렌더
                const renderMonth = (ym) => {
                  const past = isPast(ym);
                  const sp = spending[ym] || {};
                  return (
                    <tr key={ym} style={{ background: past ? C.paper : C.card, borderBottom: `1px solid ${C.line}` }}>
                      <td style={{ ...tdS, fontWeight: 600, whiteSpace: "nowrap" }}>{ym}{past ? "" : " 📋"}</td>
                      {["living", "mgmt", "internet", "subscribe", "etc"].map((key) => (
                        <td key={key} style={tdS}><WonCell value={sp[key]} onChange={(v) => setSpend(ym, key, v)} style={spIn} memo={cellMemos[`${ym}_${key}`]} onMemo={(t) => setMemo(`${ym}_${key}`, t)} /></td>
                      ))}
                      {orderedLoans.map(({ l, i }) => {
                        const g = ownerGroups.find((gr) => gr.items.some((x) => x.i === i));
                        return (
                          <td key={`p${i}`} style={{ ...tdS, borderLeft: `2px solid ${g.bg}` }}>
                            <WonCell value={loanPay[ym]?.[`loan${i}_principal`]} onChange={(v) => setPay(ym, `loan${i}_principal`, v)} style={spIn} memo={cellMemos[`${ym}_loan${i}p`]} onMemo={(t) => setMemo(`${ym}_loan${i}p`, t)} />
                          </td>
                        );
                      })}
                      {orderedLoans.map(({ l, i }) => (
                        <td key={`int${i}`} style={{ ...tdS, borderLeft: `1px solid ${C.line}` }}>
                          <WonCell value={loanPay[ym]?.[`loan${i}_interest`]} onChange={(v) => setPay(ym, `loan${i}_interest`, v)} style={spIn} memo={cellMemos[`${ym}_loan${i}i`]} onMemo={(t) => setMemo(`${ym}_loan${i}i`, t)} />
                        </td>
                      ))}
                      {orderedLoans.map(({ l, i }) => (
                        <td key={`bal${i}`} style={{ ...tdS, borderLeft: `1px solid ${C.line}`, color: C.sub }}>{eokCheon(loanBalances[ym]?.[i] ?? l.principal)}</td>
                      ))}
                    </tr>
                  );
                };
                // 연도 그룹 렌더 (섹션 안에서)
                const renderYearGroups = (monthsSubset) => {
                  const byYear = {};
                  monthsSubset.forEach((ym) => { const y = ym.split("-")[0]; (byYear[y] = byYear[y] || []).push(ym); });
                  const out = [];
                  Object.keys(byYear).sort().forEach((year) => {
                    const open = openYears[year];
                    out.push(
                      <tr key={`yr${year}`} style={{ background: C.tealLt, cursor: "pointer" }} onClick={() => toggleYear(year)}>
                        <td colSpan={colCount} style={{ ...tdS, fontWeight: 700, color: C.teal, padding: "8px 10px", paddingLeft: 28 }}>
                          {open ? "▼" : "▶"} {year}년 <span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}>({byYear[year].length}개월)</span>
                        </td>
                      </tr>
                    );
                    if (open) byYear[year].forEach((ym) => out.push(renderMonth(ym)));
                  });
                  return out;
                };
                // 3단 분류
                const before = months.filter((ym) => parseInt(ym.split("-")[0]) < curYear);
                const current = months.filter((ym) => parseInt(ym.split("-")[0]) === curYear);
                const after = months.filter((ym) => parseInt(ym.split("-")[0]) > curYear);
                const rows = [];
                const sectionHeader = (key, label, count, color) => (
                  <tr key={`sec${key}`} style={{ background: color, cursor: "pointer" }} onClick={() => toggleSection(key)}>
                    <td colSpan={colCount} style={{ ...tdS, fontWeight: 700, color: "#fff", padding: "10px 12px", fontSize: 13 }}>
                      {openSections[key] ? "▼" : "▶"} {label} <span style={{ fontWeight: 400, opacity: 0.85, fontSize: 11 }}>({count}개월){openSections[key] ? "" : " — 클릭"}</span>
                    </td>
                  </tr>
                );
                if (before.length) { rows.push(sectionHeader("before", `📁 이전 데이터 보기`, before.length, C.sub)); if (openSections.before) rows.push(...renderYearGroups(before)); }
                if (current.length) { current.forEach((ym) => rows.push(renderMonth(ym))); }
                if (after.length) { rows.push(sectionHeader("after", `📂 이후 데이터 보기`, after.length, C.sub)); if (openSections.after) rows.push(...renderYearGroups(after)); }
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 연별 집계 */}
      <Section title="연별 집계 (100세 플랜에 반영)" desc="월별 입력이 연 단위로 자동 합산됩니다. 원금 상환은 자산이동(빚↓), 이자는 순수 비용이에요.">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ background: C.teal, color: "#fff" }}>
              <th style={thS}>연도</th><th style={{ ...thS, background: C.navy }}>총 수입</th><th style={thS}>총 소비</th><th style={thS}>원금 상환</th><th style={thS}>이자(비용)</th><th style={thS}>총 지출(소비+이자)</th><th style={thS}>수지(수입-지출)</th>
            </tr></thead>
            <tbody>
              {Object.keys(yearly).sort().map((year) => {
                const totalSpend = yearly[year].spending + yearly[year].interest;
                const balance = yearly[year].income - totalSpend;
                return (
                <tr key={year} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ ...tdS, fontWeight: 600 }}>{year}</td>
                  <td style={{ ...tdS, color: C.navy, background: C.navyLt }}>{won(yearly[year].income)}</td>
                  <td style={tdS}>{won(yearly[year].spending)}</td>
                  <td style={{ ...tdS, color: C.teal }}>{won(yearly[year].principal)}</td>
                  <td style={{ ...tdS, color: C.rust }}>{won(yearly[year].interest)}</td>
                  <td style={{ ...tdS, fontWeight: 700, color: C.rust }}>{won(totalSpend)}</td>
                  <td style={{ ...tdS, fontWeight: 700, color: balance >= 0 ? C.teal : C.rust }}>{balance >= 0 ? "+" : ""}{won(balance)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
          ※ <b>원금 상환</b>은 빚이 줄어드는 거라 순수 지출이 아니에요(자산↔부채 이동). <b>이자</b>만 실제 나가는 비용. 그래서 '총 지출'은 소비+이자로 계산해요.
        </div>
      </Section>
    </div>
  );
}

const miniIn = { padding: "5px 6px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 5, fontFamily: "inherit", boxSizing: "border-box" };
const spIn = { width: 64, padding: "4px 4px", fontSize: 11, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 5, fontFamily: "inherit" };
// 계좌 탭 입력칸 통일 스타일 (높이·폰트 동일하게 → 줄맞춤)
const acctInStyle = { width: "100%", height: 34, padding: "0 10px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box", background: C.card, color: C.ink };
const acctCell = { width: "100%", height: 30, padding: "0 6px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 5, fontFamily: "inherit", boxSizing: "border-box", background: C.card, color: C.ink };
const acctSuffix = { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.sub, pointerEvents: "none" };
const incIn = { width: 64, height: 30, padding: "0 5px", fontSize: 11.5, textAlign: "right", border: `1px solid ${C.line}`, borderRadius: 5, fontFamily: "inherit", boxSizing: "border-box", display: "block", verticalAlign: "middle" };

// ============================================================
// 탭 7: 계좌 관리 (네이버 가계부식 — 통장 등록 + 사용토글 + 만기계산)
// ============================================================
// 적금/예금 만기 이자 계산
function maturityInterest(acc) {
  const rate = (acc.rate || 0) / 100;
  const months = acc.months || 0;
  if (acc.type === "예금") {
    // 예금: 목돈(monthly칸을 원금으로 사용) × 이율 × 기간
    return (acc.monthly || 0) * rate * (months / 12);
  } else if (acc.type === "적금") {
    // 적금: 매달 납입, 각 회차 단리
    let interest = 0;
    for (let i = 1; i <= months; i++) interest += (acc.monthly || 0) * rate / 12 * (months - i + 1);
    return interest;
  }
  return 0;
}
function taxRate(taxType) {
  return taxType === "비과세" ? 0 : taxType === "세금우대" ? 0.095 : 0.154;
}

// 한국 금융기관 목록
const KR_BANKS = ["KB국민", "신한", "하나", "우리", "NH농협", "IBK기업", "SC제일", "씨티", "케이뱅크", "카카오뱅크", "토스", "수협", "iM뱅크(대구)", "부산", "경남", "광주", "전북", "제주", "산업", "수출입", "새마을금고", "신협", "우체국", "KDB산업"];
const KR_CARDS = ["신한카드", "삼성카드", "KB국민카드", "현대카드", "롯데카드", "우리카드", "하나카드", "BC카드", "NH농협카드", "씨티카드", "고양페이", "지역화폐"];
const KR_SECURITIES = ["미래에셋증권", "삼성증권", "KB증권", "NH투자증권", "한국투자증권", "키움증권", "신한투자증권", "대신증권", "메리츠증권", "하나증권", "유안타증권", "토스증권", "카카오페이증권", "한화투자증권", "교보증권", "현대차증권", "DB금융투자", "IBK투자증권"];

// 종류별 기관 목록 매핑
function instOptions(type) {
  if (type === "카드") return KR_CARDS;
  if (type === "증권" || type === "연금") return [...KR_SECURITIES, ...KR_BANKS, "기타"];
  if (type === "대출") return [...KR_BANKS, "기타(개인 등)"];
  return [...KR_BANKS, "기타"]; // 적금·예금·입출금
}
// 카테고리 설명
const TYPE_DESC = {
  "적금": "매달 일정액을 납입 → 만기에 원금+이자 (은행)",
  "예금": "목돈을 한 번에 예치 → 만기에 원금+이자 (은행)",
  "입출금": "자유롭게 넣고 빼는 통장 (은행)",
  "카드": "신용/체크카드 (카드사)",
  "증권": "주식·ETF 등 투자 계좌 (증권사/은행)",
  "연금": "개인연금·IRP·퇴직연금 (증권사/은행)",
  "대출": "갚아야 할 빚 (은행/개인 등) — 상환은 ⑥탭에서",
};

function TabAccounts({ people, accounts, setAccounts, spending, setSpending, loans, setLoans, loanPay }) {
  const updLoan = (i, k, v) => setLoans((arr) => arr.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const addLoan = () => setLoans((arr) => [...arr, { name: `대출${arr.length + 1}`, bank: "", type: "신용", owner: "0", principal: 1000, rate: 4.0, termYear: 2035, method: "원리금균등", balance: 1000 }]);
  const removeLoan = (i) => setLoans((arr) => arr.filter((_, j) => j !== i));
  const upd = (id, k, v) => setAccounts((arr) => arr.map((a) => a.id === id ? { ...a, [k]: v } : a));
  const addAccount = (owner, type = "적금") => setAccounts((arr) => [...arr, {
    id: "a" + Date.now(), owner, type, bank: instOptions(type)[0] || "KB국민", name: "", use: true,
    open: "2026-01-01", rate: type === "적금" || type === "예금" ? 3.0 : 0, months: type === "적금" || type === "예금" ? 12 : 0, monthly: type === "적금" || type === "예금" ? 50 : 0, taxType: "일반", share: false,
  }]);
  const [addType, setAddType] = useState({}); // 그룹별 추가할 종류
  const removeAccount = (id) => setAccounts((arr) => arr.filter((a) => a.id !== id));
  const [showInactive, setShowInactive] = useState({}); // 그룹별 비활성 펼침
  // 일괄 공개/비공개, 일괄 사용/비활성
  const bulkSet = (ownerKey, field, value) => setAccounts((arr) => arr.map((a) => a.owner === ownerKey ? { ...a, [field]: value } : a));

  // 이 계좌의 월납입을 수입탭(spending)의 개설월~만기월에 자동 채움 (만기 후엔 안 채움)
  const autofillIncome = (a) => {
    if (!a.open || !(a.months > 0) || !(a.monthly > 0)) { alert("개설일·기간·월납입이 있어야 자동 채울 수 있어요. (주택청약처럼 기간 없는 건 수입탭에서 직접 입력)"); return; }
    const pi = a.owner === "공동" ? 0 : parseInt(a.owner); // 공동은 사람0 기준
    if (!window.confirm(`'${a.name || a.bank}'의 월 ${a.monthly}만원을 개설월부터 ${a.months}개월간 수입탭에 자동으로 넣을까요? (만기 이후는 안 넣어요)`)) return;
    setSpending((s) => {
      const next = { ...s };
      const [oy, om] = a.open.split("-").map(Number);
      for (let i = 0; i < a.months; i++) {
        const d = new Date(oy, om - 1 + i);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const key = `inc${pi}_${a.id}`;
        if (!next[ym]) next[ym] = {};
        next[ym][key] = a.monthly;
      }
      return next;
    });
    alert("수입탭에 채웠어요! ③ 수입 탭에서 확인하세요.");
  };

  // 사용자별 그룹 (+ 공동)
  const groups = [...people.map((p, i) => ({ key: String(i), label: p.name, color: accentOf(i), bg: bgOf(i) })),
    { key: "공동", label: "부부공동", color: C.rust, bg: C.rustLt }];
  const TYPE_ORDER = ["적금", "예금", "입출금", "대출", "카드", "증권", "연금"];

  // 종류별 표 렌더 (적금/예금은 결과 컬럼 포함)
  const renderTypeTable = (type, accs, gbg) => {
    const isProduct = type === "적금" || type === "예금";
    const isLoan = type === "대출";
    const th = { padding: "5px 6px", fontSize: 10.5, fontWeight: 600, color: C.sub, textAlign: "left", whiteSpace: "nowrap", borderBottom: `1px solid ${C.line}` };
    const td = { padding: "4px 6px", verticalAlign: "middle", borderBottom: `1px solid ${C.line}` };
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: isProduct ? 720 : 360 }}>
          <thead><tr>
            <th style={th}>은행</th>
            <th style={th}>상품명</th>
            {isProduct && <><th style={th}>개설일</th><th style={th}>금리</th><th style={th}>기간</th><th style={th}>월납입/예치</th><th style={th}>세금</th></>}
            {isLoan && <><th style={th}>대출원금</th><th style={th}>금리</th><th style={th}>만기</th></>}
            {isProduct && <><th style={{ ...th, color: C.teal }}>원금</th><th style={{ ...th, color: C.teal }}>만기이자</th><th style={{ ...th, color: C.rust }}>세금</th><th style={{ ...th, color: C.gold }}>세후수령</th></>}
            <th style={th}>상태</th><th style={th}>공개</th>{isProduct && <th style={th}>수입</th>}<th style={th}></th>
          </tr></thead>
          <tbody>
            {accs.map((a) => {
              const interest = maturityInterest(a);
              const tax = interest * taxRate(a.taxType);
              const principal = a.type === "예금" ? (a.monthly || 0) : (a.monthly || 0) * (a.months || 0);
              const noTerm = isProduct && (!a.months || a.months === 0);
              return (
                <tr key={a.id} style={{ background: a.use ? "transparent" : C.paper, opacity: a.use ? 1 : 0.6 }}>
                  <td style={td}><select value={a.bank} onChange={(e) => upd(a.id, "bank", e.target.value)} style={{ ...acctCell, width: 96 }}>{instOptions(a.type).map((b) => <option key={b}>{b}</option>)}</select></td>
                  <td style={td}><input value={a.name} onChange={(e) => upd(a.id, "name", e.target.value)} placeholder="상품명" style={{ ...acctCell, width: 120 }} /></td>
                  {isProduct && <>
                    <td style={td}><input type="date" value={a.open} onChange={(e) => upd(a.id, "open", e.target.value)} style={{ ...acctCell, width: 130 }} /></td>
                    <td style={td}><div style={{ position: "relative", width: 58 }}><input value={a.rate} onChange={(e) => upd(a.id, "rate", parseFloat(e.target.value) || 0)} style={{ ...acctCell, paddingRight: 16 }} /><span style={{ position: "absolute", right: 5, top: 7, fontSize: 10, color: C.sub }}>%</span></div></td>
                    <td style={td}><div style={{ position: "relative", width: 62 }}><input value={a.months || ""} onChange={(e) => upd(a.id, "months", parseInt(e.target.value) || 0)} placeholder="—" style={{ ...acctCell, paddingRight: 24 }} /><span style={{ position: "absolute", right: 4, top: 7, fontSize: 9, color: C.sub }}>개월</span></div></td>
                    <td style={td}><div style={{ position: "relative", width: 70 }}><input value={a.monthly == null ? "" : Number(a.monthly).toLocaleString("ko-KR")} onChange={(e) => upd(a.id, "monthly", parseInt(e.target.value.replace(/,/g, "")) || 0)} style={{ ...acctCell, paddingRight: 24 }} /><span style={{ position: "absolute", right: 4, top: 7, fontSize: 9, color: C.sub }}>만원</span></div></td>
                    <td style={td}><select value={a.taxType} onChange={(e) => upd(a.id, "taxType", e.target.value)} style={{ ...acctCell, width: 78 }}><option>일반</option><option>세금우대</option><option>비과세</option></select></td>
                    <td style={{ ...td, fontSize: 11.5 }}>{won(principal)}</td>
                    <td style={{ ...td, fontSize: 11.5, color: C.teal }}>{noTerm ? "—" : won(interest)}</td>
                    <td style={{ ...td, fontSize: 11.5, color: C.rust }}>{noTerm ? "—" : won(tax)}</td>
                    <td style={{ ...td, fontSize: 11.5, color: C.gold, fontWeight: 700 }}>{noTerm ? "—" : won(principal + interest - tax)}</td>
                  </>}
                  {isLoan && <>
                    <td style={td}><div style={{ position: "relative", width: 80 }}><input value={a.loanPrincipal == null ? "" : Number(a.loanPrincipal).toLocaleString("ko-KR")} onChange={(e) => upd(a.id, "loanPrincipal", parseInt(e.target.value.replace(/,/g, "")) || 0)} style={{ ...acctCell, paddingRight: 24 }} /><span style={{ position: "absolute", right: 4, top: 7, fontSize: 9, color: C.sub }}>만원</span></div></td>
                    <td style={td}><div style={{ position: "relative", width: 58 }}><input value={a.rate} onChange={(e) => upd(a.id, "rate", parseFloat(e.target.value) || 0)} style={{ ...acctCell, paddingRight: 16 }} /><span style={{ position: "absolute", right: 5, top: 7, fontSize: 10, color: C.sub }}>%</span></div></td>
                    <td style={td}><input value={a.termYear || ""} onChange={(e) => upd(a.id, "termYear", parseInt(e.target.value) || 0)} placeholder="2030" style={{ ...acctCell, width: 60 }} /></td>
                  </>}
                  <td style={td}><button onClick={() => upd(a.id, "use", !a.use)} style={{ height: 28, fontSize: 10, padding: "0 8px", borderRadius: 5, cursor: "pointer", border: "none", fontWeight: 600, background: a.use ? C.teal : C.line, color: a.use ? "#fff" : C.sub, whiteSpace: "nowrap" }}>{a.use ? "●사용" : "○비활성"}</button></td>
                  <td style={td}><button onClick={() => upd(a.id, "share", !a.share)} style={{ height: 28, fontSize: 10, padding: "0 8px", borderRadius: 5, cursor: "pointer", border: "none", fontWeight: 600, background: a.share ? C.gold : "#E8E3D8", color: a.share ? "#fff" : C.sub, whiteSpace: "nowrap" }}>{a.share ? "🔓공개" : "🔒나만"}</button></td>
                  {isProduct && <td style={td}><button onClick={() => autofillIncome(a)} title="이 적금의 월납입을 수입탭 개설월~만기까지 자동 입력" style={{ height: 28, fontSize: 10, padding: "0 8px", borderRadius: 5, cursor: "pointer", border: `1px solid ${C.teal}`, background: "transparent", color: C.teal, whiteSpace: "nowrap" }}>⚡채우기</button></td>}
                  <td style={td}><button onClick={() => removeAccount(a.id)} style={{ border: "none", background: "none", color: C.sub, cursor: "pointer", fontSize: 15 }}>×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isProduct && <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>※ 기간이 비어있으면(주택청약 등) 만기 계산은 생략돼요. 종류 변경은 계좌를 지우고 다시 추가하거나 아래에서.</div>}
      </div>
    );
  };

  // 계좌 카드 렌더 (적금·예금·대출 외 종류용: 카드·증권·연금·입출금)
  const renderCard = (a, gbg) => {
    const isProduct = a.type === "적금" || a.type === "예금";
    const interest = maturityInterest(a);
    const tax = interest * taxRate(a.taxType);
    const principal = a.type === "예금" ? (a.monthly || 0) : (a.monthly || 0) * (a.months || 0);
    return (
      <div key={a.id} style={{ marginBottom: 10, padding: 14, background: a.use ? gbg : C.paper, borderRadius: 10, opacity: a.use ? 1 : 0.7, border: a.use ? "none" : `1px dashed ${C.line}` }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: isProduct ? 10 : 0 }}>
          <div style={{ width: 90 }}>
            <span style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 4, fontWeight: 600, height: 14, lineHeight: "14px" }}>① 종류</span>
            <select value={a.type} onChange={(e) => { const t = e.target.value; const opts = instOptions(t); upd(a.id, "type", t); if (!opts.includes(a.bank)) upd(a.id, "bank", opts[0]); }} style={acctInStyle}>
              {TYPE_ORDER.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ width: 120 }}>
            <span style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 4, fontWeight: 600, height: 14, lineHeight: "14px" }}>② {a.type === "카드" ? "카드사" : a.type === "대출" ? "대출처" : (a.type === "증권" || a.type === "연금") ? "증권/은행" : "은행"}</span>
            <select value={a.bank} onChange={(e) => upd(a.id, "bank", e.target.value)} style={acctInStyle}>
              {instOptions(a.type).map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ width: 130 }}>
            <span style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 4, fontWeight: 600, height: 14, lineHeight: "14px" }}>③ 상품명</span>
            <input value={a.name} onChange={(e) => upd(a.id, "name", e.target.value)} placeholder="예: 청년도약계좌" style={acctInStyle} />
          </div>
          <button onClick={() => upd(a.id, "use", !a.use)} title="현재 쓰는 계좌인지" style={{ height: 34, fontSize: 11, padding: "0 10px", borderRadius: 6, cursor: "pointer", border: "none", fontWeight: 600, background: a.use ? C.teal : C.line, color: a.use ? "#fff" : C.sub }}>
            {a.use ? "● 사용중" : "○ 비활성"}
          </button>
          <button onClick={() => upd(a.id, "share", !a.share)} title="배우자에게 보여줄지" style={{ height: 34, fontSize: 11, padding: "0 10px", borderRadius: 6, cursor: "pointer", border: "none", fontWeight: 600, background: a.share ? C.gold : "#E8E3D8", color: a.share ? "#fff" : C.sub }}>
            {a.share ? "🔓 공개(배우자도)" : "🔒 나만 보기"}
          </button>
          <button onClick={() => removeAccount(a.id)} style={{ height: 34, border: "none", background: "none", color: C.sub, cursor: "pointer", fontSize: 16, marginLeft: "auto" }}>×</button>
        </div>
        {isProduct && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "110px 80px 80px 110px 100px", gap: 8 }}>
              {[
                { lab: "개설일", el: <input type="date" value={a.open} onChange={(e) => upd(a.id, "open", e.target.value)} style={acctInStyle} /> },
                { lab: "금리", el: <div style={{ position: "relative" }}><input type="text" inputMode="decimal" value={a.rate} onChange={(e) => upd(a.id, "rate", parseFloat(e.target.value.replace(/,/g, "")) || 0)} style={{ ...acctInStyle, paddingRight: 22 }} /><span style={acctSuffix}>%</span></div> },
                { lab: "기간", el: <div style={{ position: "relative" }}><input type="text" inputMode="numeric" value={a.months} onChange={(e) => upd(a.id, "months", parseInt(e.target.value.replace(/,/g, "")) || 0)} style={{ ...acctInStyle, paddingRight: 34 }} /><span style={acctSuffix}>개월</span></div> },
                { lab: a.type === "예금" ? "예치 원금" : "월 납입", el: <div style={{ position: "relative" }}><input type="text" inputMode="numeric" value={a.monthly == null ? "" : Number(a.monthly).toLocaleString("ko-KR")} onChange={(e) => upd(a.id, "monthly", parseInt(e.target.value.replace(/,/g, "")) || 0)} style={{ ...acctInStyle, paddingRight: 30 }} /><span style={acctSuffix}>만원</span></div> },
                { lab: "세금", el: <select value={a.taxType} onChange={(e) => upd(a.id, "taxType", e.target.value)} style={acctInStyle}><option>일반</option><option>세금우대</option><option>비과세</option></select> },
              ].map((f, k) => (
                <div key={k}>
                  <span style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 4, height: 14, lineHeight: "14px" }}>{f.lab}</span>
                  {f.el}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: "10px 12px", background: C.card, borderRadius: 8, fontSize: 12.5, display: "flex", gap: 18, flexWrap: "wrap" }}>
              <span>원금 <b>{won(principal)}</b></span>
              <span style={{ color: C.teal }}>만기이자 <b>{won(interest)}</b></span>
              <span style={{ color: C.rust }}>세금({a.taxType === "일반" ? "15.4%" : a.taxType === "세금우대" ? "9.5%" : "0%"}) <b>{won(tax)}</b></span>
              <span style={{ color: C.gold, fontWeight: 700 }}>세후 수령 {won(principal + interest - tax)}원</span>
            </div>
          </div>
        )}
        {a.type === "대출" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "120px 80px 100px 110px", gap: 8 }}>
              {[
                { lab: "대출원금", el: <div style={{ position: "relative" }}><input type="text" inputMode="numeric" value={a.loanPrincipal == null ? "" : Number(a.loanPrincipal).toLocaleString("ko-KR")} onChange={(e) => upd(a.id, "loanPrincipal", parseInt(e.target.value.replace(/,/g, "")) || 0)} style={{ ...acctInStyle, paddingRight: 30 }} /><span style={acctSuffix}>만원</span></div> },
                { lab: "금리", el: <div style={{ position: "relative" }}><input type="text" inputMode="decimal" value={a.rate} onChange={(e) => upd(a.id, "rate", parseFloat(e.target.value.replace(/,/g, "")) || 0)} style={{ ...acctInStyle, paddingRight: 22 }} /><span style={acctSuffix}>%</span></div> },
                { lab: "만기(연도)", el: <input type="text" inputMode="numeric" value={a.termYear || ""} onChange={(e) => upd(a.id, "termYear", parseInt(e.target.value.replace(/,/g, "")) || 0)} placeholder="2030" style={acctInStyle} /> },
                { lab: "상환방식", el: <select value={a.method || "원리금균등"} onChange={(e) => upd(a.id, "method", e.target.value)} style={acctInStyle}><option>원리금균등</option><option>원금균등</option><option>만기일시</option><option>수시상환</option></select> },
              ].map((f, k) => (
                <div key={k}>
                  <span style={{ fontSize: 11, color: C.sub, display: "block", marginBottom: 4, height: 14, lineHeight: "14px" }}>{f.lab}</span>
                  {f.el}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.rustLt, borderRadius: 8, fontSize: 11.5, color: C.sub }}>
              💡 대출원금은 시작 잔액이에요. 매달 상환(원금/이자)은 <b>⑥ 지출·대출 관리 탭</b>에서 입력하면 잔액이 자동으로 줄어들어요.
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ padding: "14px 18px", background: C.tealLt, borderRadius: 12, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
        💡 사용자별로 계좌를 등록하세요. <b>종류별로 자동 정리</b>되고, <b>● 사용중 / ○ 비활성</b>으로 현재 쓰는지 표시해요(비활성은 맨 아래로 내려가 접힘).
        <b> 🔒 비공개(나만) / 🔓 공개(배우자도)</b>로 배우자 공개 여부를 정해요. 적금·예금은 개설일·금리·기간으로 만기 수익·세금이 자동 계산돼요. (단위: 만원)
      </div>

      {groups.map((g) => {
        const items = accounts.filter((a) => a.owner === g.key);
        const active = items.filter((a) => a.use);
        const inactive = items.filter((a) => !a.use);
        const totalMaturity = active.filter((a) => a.type === "적금" || a.type === "예금")
          .reduce((sum, a) => { const it = maturityInterest(a); return sum + it * (1 - taxRate(a.taxType)); }, 0);
        // 활성 계좌를 종류별로 묶기
        const byType = {};
        active.forEach((a) => { (byType[a.type] = byType[a.type] || []).push(a); });
        return (
          <Section key={g.key} title={`${g.label}의 계좌`} desc={active.length ? `사용 중인 적금·예금의 세후 만기이자 합계: 약 ${won(totalMaturity)}원` : "사용 중인 계좌가 없어요."}>
            <div style={{ borderLeft: `4px solid ${g.color}`, paddingLeft: 12 }}>
              {TYPE_ORDER.filter((t) => byType[t]).map((t) => (
                <div key={t} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${C.line}` }}>
                    {t} <span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}>· {TYPE_DESC[t]}</span>
                  </div>
                  {renderTypeTable(t, byType[t], g.bg)}
                </div>
              ))}
              {active.length === 0 && <div style={{ fontSize: 12, color: C.sub, padding: "8px 0" }}>아직 사용 중인 계좌가 없어요.</div>}

              {/* 비활성 계좌 접기 */}
              {inactive.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => setShowInactive((s) => ({ ...s, [g.key]: !s[g.key] }))}
                    style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1px dashed ${C.line}`, background: C.paper, color: C.sub, width: "100%", textAlign: "left" }}>
                    {showInactive[g.key] ? "▼" : "▶"} 비활성 계좌 {inactive.length}개 {showInactive[g.key] ? "접기" : "보기"}
                  </button>
                  {showInactive[g.key] && <div style={{ marginTop: 10 }}>{(() => {
                    const byT = {}; inactive.forEach((a) => { (byT[a.type] = byT[a.type] || []).push(a); });
                    return TYPE_ORDER.filter((t) => byT[t]).map((t) => (
                      <div key={t} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 4 }}>{t}</div>
                        {renderTypeTable(t, byT[t], g.bg)}
                      </div>
                    ));
                  })()}</div>}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                <select value={addType[g.key] || "적금"} onChange={(e) => setAddType((s) => ({ ...s, [g.key]: e.target.value }))} style={{ ...acctCell, width: 90, height: 32 }}>
                  {TYPE_ORDER.map((t) => <option key={t}>{t}</option>)}
                </select>
                <button onClick={() => addAccount(g.key, addType[g.key] || "적금")} style={{ ...btn, borderColor: g.color, color: g.color }}>+ {g.label} 계좌 추가</button>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: C.sub }}>일괄:</span>
                <button onClick={() => bulkSet(g.key, "share", true)} style={{ ...btn, fontSize: 11, padding: "4px 8px", color: C.gold, borderColor: C.gold }}>🔓 전체 공개</button>
                <button onClick={() => bulkSet(g.key, "share", false)} style={{ ...btn, fontSize: 11, padding: "4px 8px" }}>🔒 전체 비공개</button>
              </div>
            </div>
          </Section>
        );
      })}

      {/* 대출 정보 (지출/대출 탭에서 이동) */}
      <Section title="💳 대출 정보" desc="대출 원금·금리·만기를 관리해요. 월별 상환액은 ④ 지출/대출 탭에서 입력해요.">
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
            <thead><tr>
              {["대출명", "명의", "원금", "금리", "만기(년)", "상환방식", "메모", ""].map((h, i) => <th key={i} style={{ padding: "5px 6px", fontSize: 10.5, fontWeight: 600, color: C.sub, textAlign: "left", whiteSpace: "nowrap", borderBottom: `1px solid ${C.line}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {loans.map((l, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td style={{ padding: "4px 6px" }}><input value={l.name} onChange={(e) => updLoan(i, "name", e.target.value)} style={{ ...acctCell, width: 120 }} /></td>
                  <td style={{ padding: "4px 6px" }}>
                    <select value={l.owner} onChange={(e) => updLoan(i, "owner", e.target.value)} style={{ ...acctCell, width: 90 }}>
                      {people.map((p, pi) => <option key={pi} value={String(pi)}>{p.name}</option>)}
                      <option value="공동">부부공동</option>
                    </select>
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <div style={{ position: "relative", width: 86 }}><input value={l.principal == null ? "" : Number(l.principal).toLocaleString("ko-KR")} onChange={(e) => updLoan(i, "principal", parseInt(e.target.value.replace(/,/g, "")) || 0)} style={{ ...acctCell, paddingRight: 24 }} /><span style={{ position: "absolute", right: 4, top: 7, fontSize: 9, color: C.sub }}>만원</span></div>
                    <div style={{ fontSize: 9.5, color: C.sub, marginTop: 2 }}>{eokCheon(l.principal)}</div>
                  </td>
                  <td style={{ padding: "4px 6px" }}><div style={{ position: "relative", width: 56 }}><input type="number" value={l.rate} step={0.1} onChange={(e) => updLoan(i, "rate", parseFloat(e.target.value) || 0)} style={{ ...acctCell, paddingRight: 16 }} /><span style={{ position: "absolute", right: 5, top: 7, fontSize: 10, color: C.sub }}>%</span></div></td>
                  <td style={{ padding: "4px 6px" }}><input type="number" value={l.termYear} onChange={(e) => updLoan(i, "termYear", parseFloat(e.target.value) || 0)} style={{ ...acctCell, width: 60 }} /></td>
                  <td style={{ padding: "4px 6px" }}><select value={l.method} onChange={(e) => updLoan(i, "method", e.target.value)} style={{ ...acctCell, width: 92 }}><option>원리금균등</option><option>원금균등</option><option>만기일시</option><option>수시상환</option></select></td>
                  <td style={{ padding: "4px 6px" }}><input value={l.memo || ""} onChange={(e) => updLoan(i, "memo", e.target.value)} placeholder="예: 신혼대출" style={{ ...acctCell, width: 100 }} /></td>
                  <td style={{ padding: "4px 6px" }}><button onClick={() => removeLoan(i)} style={{ border: "none", background: "none", color: C.sub, cursor: "pointer", fontSize: 15 }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addLoan} style={{ ...btn, marginTop: 10, borderColor: C.rust, color: C.rust }}>+ 대출 추가</button>
      </Section>
    </div>
  );
}


// ============================================================
// 탭 3: 월별 수입 (계좌 기준으로 항목 생성 · 원 입력 / 만원 표시)
// 단기: 적금·예금·기타(비상금) / 중기: 주택청약·주식·코인 / 장기: 개인연금·IRP·ISA
// 월급·기타소득(만기이자)은 고정 항목(다른 색)
// 데이터: spending[ym]["inc{pi}_{accId 또는 fixedKey}"]
// ============================================================
function TabIncome({ people, setPeople, accounts, planOverride, setPlanOverride, spending, setSpending, cellMemos, setCellMemos }) {
  const nowYear = new Date().getFullYear();
  const thisYear = nowYear;
  const [openSections, setOpenSections] = useState({ current: true });
  const [openYears, setOpenYears] = useState({ [thisYear]: true });
  const [openPerson, setOpenPerson] = useState({ 0: true });
  const [collapsedGroups, setCollapsedGroups] = useState({}); // "단기"/"중기"/"장기" 접힘
  const toggleGroup = (name) => setCollapsedGroups((s) => ({ ...s, [name]: !s[name] }));
  const [startYm, setStartYm] = useState("2021-01");
  const [endYm, setEndYm] = useState(`${thisYear + 5}-12`);
  const toggleSection = (k) => setOpenSections((s) => ({ ...s, [k]: !s[k] }));
  const toggleYear = (y) => setOpenYears((s) => ({ ...s, [y]: !s[y] }));

  const months = [];
  { let [y, m] = startYm.split("-").map(Number); const [ey, em] = endYm.split("-").map(Number);
    while (!((y > ey) || (y === ey && m > em))) { months.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } } }
  const TODAY_YM = `${nowYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const isPast = (ym) => ym <= TODAY_YM;
  const prevYm = (ym) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

  const setInc = (ym, key, v) => setSpending((s) => ({ ...s, [ym]: { ...s[ym], [key]: v } }));
  const getRaw = (ym, key) => spending[ym]?.[key]; // 그 달에 직접 입력한 값
  // 직접 입력한 값만 사용 (빈 칸은 0/빈칸). 자동 이어받기(fill-forward) 안 함.
  const getInc = (ym, key) => spending[ym]?.[key];
  const setMemo = (k, t) => setCellMemos((m) => ({ ...m, [k]: t }));

  // 사람 pi의 수입 항목을 계좌 기준으로 구성 (활성 계좌만)
  const buildGroups = (pi) => {
    const owned = accounts.filter((a) => (a.owner === String(pi) || a.owner === "공동") && a.use !== false);
    const isCoin = (a) => (a.name || "").includes("코인") || (a.bank || "").includes("코인");
    const isSubscribe = (a) => (a.name || "").includes("청약");
    const fixed = [
      { key: `inc${pi}_salary`, label: "월급", fixed: true },
      { key: `inc${pi}_etcincome`, label: "기타", fixed: true },
    ];
    const toItems = (accs) => accs.map((a) => ({ key: `inc${pi}_${a.id}`, label: a.name || a.bank, sub: a.bank }));
    const rawGroups = [
        { name: "단기", color: C.gold, bg: C.goldLt, subgroups: [
          { sub: "적금", items: toItems(owned.filter((a) => a.type === "적금" && !isSubscribe(a))) },
          { sub: "예금", items: toItems(owned.filter((a) => a.type === "예금" && !isSubscribe(a))) },
          { sub: "기타(비상금)", items: toItems(owned.filter((a) => a.type === "입출금")) },
        ] },
        { name: "중기", color: C.teal, bg: C.tealLt, subgroups: [
          { sub: "주택청약", items: toItems(owned.filter((a) => (a.type === "적금" || a.type === "예금") && isSubscribe(a))) },
          { sub: "주식", items: toItems(owned.filter((a) => a.type === "증권" && !isCoin(a))) },
          { sub: "코인", items: toItems(owned.filter(isCoin)) },
        ] },
        { name: "장기", color: C.navy, bg: C.navyLt, subgroups: [
          { sub: "개인연금·IRP·ISA", items: toItems(owned.filter((a) => a.type === "연금")) },
        ] },
    ];
    // 빈 소그룹 제거 + 소그룹이 다 빈 그룹 제거
    const groups = rawGroups
      .map((g) => ({ ...g, subgroups: g.subgroups.filter((sg) => sg.items.length > 0) }))
      .filter((g) => g.subgroups.length > 0);
    return { fixed, groups };
  };

  const renderPersonTable = (p, pi) => {
    const { fixed, groups } = buildGroups(pi);
    // 평탄화된 컬럼 목록 (접힌 그룹은 합계 열 1개로)
    const flatCols = [
      ...fixed.map((f) => ({ ...f, isFixed: true })),
      ...groups.flatMap((g) => {
        if (collapsedGroups[g.name]) {
          // 접힘: 그룹 전체 항목 key 모아서 합계 열 1개
          const allKeys = g.subgroups.flatMap((sg) => sg.items.map((it) => it.key));
          return [{ key: `groupsum_${g.name}`, groupSum: true, groupName: g.name, keys: allKeys, bg: g.bg, color: g.color }];
        }
        return g.subgroups.flatMap((sg) => sg.items.length ? sg.items.map((it) => ({ ...it, bg: g.bg })) : [{ key: `empty_${g.name}_${sg.sub}`, empty: true, bg: g.bg }]);
      }),
    ];
    const colCount = 1 + flatCols.length;

    const renderMonth = (ym) => {
      const past = isPast(ym);
      return (
        <tr key={ym} style={{ background: past ? C.paper : C.card, borderBottom: `1px solid ${C.line}` }}>
          <td style={{ ...tdS, fontWeight: 600, whiteSpace: "nowrap", position: "sticky", left: 0, background: past ? C.paper : C.card, zIndex: 3, boxShadow: `1px 0 0 ${C.line}` }}>{ym}{past ? "" : " 📋"}</td>
          {flatCols.map((col) => {
            if (col.empty) return <td key={col.key} style={{ ...tdS, background: col.bg }}></td>;
            if (col.groupSum) {
              const sum = col.keys.reduce((a, k) => a + (getInc(ym, k) || 0), 0);
              return <td key={col.key} style={{ ...tdS, background: col.bg, fontWeight: 600, color: col.color }}>{sum > 0 ? won(sum) : "—"}</td>;
            }
            const mk = `${ym}_${col.key}`;
            const shown = getInc(ym, col.key);
            return (
              <td key={col.key} style={{ ...tdS, background: col.isFixed ? C.purpleLt : col.bg }}>
                <WonCell value={shown} onChange={(v) => setInc(ym, col.key, v)} style={incIn} memo={cellMemos[mk]} onMemo={(t) => setMemo(mk, t)} />
              </td>
            );
          })}
        </tr>
      );
    };
    const renderYearGroups = (subset) => {
      const byYear = {};
      subset.forEach((ym) => { const y = ym.split("-")[0]; (byYear[y] = byYear[y] || []).push(ym); });
      const out = [];
      Object.keys(byYear).sort().forEach((year) => {
        const open = openYears[year];
        out.push(
          <tr key={`yr${year}`} style={{ background: C.tealLt, cursor: "pointer" }} onClick={() => toggleYear(year)}>
            <td colSpan={colCount} style={{ ...tdS, fontWeight: 700, color: C.teal, padding: "8px 10px", textAlign: "left", paddingLeft: 28 }}>{open ? "▼" : "▶"} {year}년 ({byYear[year].length}개월)</td>
          </tr>
        );
        if (open) byYear[year].forEach((ym) => out.push(renderMonth(ym)));
      });
      return out;
    };
    const before = months.filter((ym) => parseInt(ym.split("-")[0]) < thisYear);
    const current = months.filter((ym) => parseInt(ym.split("-")[0]) === thisYear);
    const after = months.filter((ym) => parseInt(ym.split("-")[0]) > thisYear);
    const secHeader = (key, label, count, color) => (
      <tr key={`sec${key}`} style={{ background: color, cursor: "pointer" }} onClick={() => toggleSection(key)}>
        <td colSpan={colCount} style={{ ...tdS, fontWeight: 700, color: "#fff", padding: "10px 12px", fontSize: 13, textAlign: "left" }}>{openSections[key] ? "▼" : "▶"} {label} ({count}개월){openSections[key] ? "" : " — 클릭"}</td>
      </tr>
    );
    const rows = [];
    if (before.length) { rows.push(secHeader("before", "📁 이전 데이터 보기", before.length, C.sub)); if (openSections.before) rows.push(...renderYearGroups(before)); }
    current.forEach((ym) => rows.push(renderMonth(ym)));
    if (after.length) { rows.push(secHeader("after", "📂 이후 데이터 보기", after.length, C.sub)); if (openSections.after) rows.push(...renderYearGroups(after)); }

    // 헤더: 1행 = 단기/중기/장기 + 고정, 2행 = 소그룹, 3행 = 항목
    return { flatCols, colCount, groups, fixed, rows };
  };

  return (
    <div>
      <div style={{ padding: "14px 18px", background: C.navyLt, borderRadius: 12, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
        💡 항목은 <b>⑥ 계좌 관리</b>에 등록한 계좌에서 자동으로 가져와요(사람마다 계좌가 다르니까). <b>단기</b>(적금·예금·기타) · <b>중기</b>(주택청약·주식·코인) · <b>장기</b>(개인연금·IRP·ISA)로 나뉘고, <b>월급·기타소득</b>은 보라색 고정칸이에요.
        <br />💴 <b>입력은 원 단위</b>로 하면 화면엔 <b>만원으로</b> 보여요 (예: 5,300,000 입력 → 530만 표시). 빈 칸엔 지난달 값이 흐리게, 각 칸 <b>우클릭으로 메모</b>.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, flexWrap: "wrap" }}>
        <span style={{ color: C.sub }}>📅 표시 기간:</span>
        <input type="month" value={startYm} onChange={(e) => e.target.value && setStartYm(e.target.value)} style={{ width: 150, height: 32, padding: "0 10px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit", background: C.card, color: C.ink }} />
        <span style={{ color: C.sub }}>~</span>
        <input type="month" value={endYm} onChange={(e) => e.target.value && setEndYm(e.target.value)} style={{ width: 150, height: 32, padding: "0 10px", fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "inherit", background: C.card, color: C.ink }} />
        <span style={{ color: C.sub, fontSize: 11 }}>(시작·끝 연월을 직접 고르세요 · 표의 <b>단기/중기/장기 제목을 클릭</b>하면 접어서 합계로 볼 수 있어요)</span>
      </div>

      {people.map((p, pi) => {
        const open = openPerson[pi] !== false;
        const ptable = renderPersonTable(p, pi);
        const { groups, fixed } = ptable;
        return (
          <div key={pi} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 600, margin: 0 }}>{p.name}의 월별 수입</h2>
              <button onClick={() => setOpenPerson((s) => ({ ...s, [pi]: !open }))} style={{ ...btn, fontSize: 11, padding: "4px 10px" }}>{open ? "▼ 접기" : "▶ 펼치기"}</button>
            </div>
            {open && (
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 500, borderLeft: `4px solid ${accentOf(pi)}`, paddingLeft: 8 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    {/* 1행: 대분류 (클릭하면 접기/펼치기) */}
                    <tr>
                      <th rowSpan={3} style={{ ...thS, position: "sticky", left: 0, top: 0, background: accentOf(pi), color: "#fff", zIndex: 5 }}>연-월</th>
                      <th colSpan={fixed.length} style={{ ...thS, position: "sticky", top: 0, height: 26, background: C.purple, color: "#fff", zIndex: 4 }}>고정 수입</th>
                      {groups.map((g) => {
                        const collapsed = collapsedGroups[g.name];
                        const n = collapsed ? 1 : g.subgroups.reduce((s, sg) => s + Math.max(sg.items.length, 1), 0);
                        return <th key={g.name} colSpan={n} onClick={() => toggleGroup(g.name)} title="클릭하면 접기/펼치기" style={{ ...thS, position: "sticky", top: 0, height: 26, background: g.color, color: "#fff", borderLeft: "2px solid #fff", zIndex: 4, cursor: "pointer" }}>{collapsed ? "▶" : "▼"} {g.name}</th>;
                      })}
                    </tr>
                    {/* 2행: 소분류 */}
                    <tr>
                      <th colSpan={fixed.length} style={{ ...thS, position: "sticky", top: 26, height: 24, background: C.purpleLt, color: C.purple, fontSize: 10.5, zIndex: 4 }}>월급·기타</th>
                      {groups.flatMap((g) => collapsedGroups[g.name]
                        ? [<th key={g.name + "_sum"} style={{ ...thS, position: "sticky", top: 26, height: 24, background: g.bg, color: g.color, fontSize: 10.5, borderLeft: "1px solid #fff", zIndex: 4 }}>합계</th>]
                        : g.subgroups.map((sg) => <th key={g.name + sg.sub} colSpan={Math.max(sg.items.length, 1)} style={{ ...thS, position: "sticky", top: 26, height: 24, background: g.bg, color: g.color, fontSize: 10.5, borderLeft: "1px solid #fff", zIndex: 4 }}>{sg.sub}</th>))}
                    </tr>
                    {/* 3행: 항목(계좌명/기관) */}
                    <tr>
                      {fixed.map((f) => <th key={f.key} style={{ ...thS, position: "sticky", top: 50, height: 24, background: C.purpleLt, color: C.purple, fontSize: 10, minWidth: 58, whiteSpace: "pre-line", zIndex: 4 }}>{f.label}</th>)}
                      {groups.flatMap((g) => collapsedGroups[g.name]
                        ? [<th key={g.name + "_sumcol"} style={{ ...thS, position: "sticky", top: 50, height: 24, background: g.bg, color: g.color, fontSize: 9, minWidth: 64, zIndex: 4 }}>접힘<br /><span style={{ fontWeight: 400, fontSize: 8 }}>(눌러 펼치기)</span></th>]
                        : g.subgroups.flatMap((sg) => sg.items.map((it) => <th key={it.key} style={{ ...thS, position: "sticky", top: 50, height: 24, background: g.bg, color: g.color, fontSize: 9.5, minWidth: 56, zIndex: 4 }}><span style={{ fontWeight: 400, fontSize: 9, opacity: 0.8 }}>{it.sub}</span><br />{it.label}</th>)))}
                    </tr>
                  </thead>
                  <tbody>{ptable.rows}</tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ padding: "12px 16px", background: C.tealLt, borderRadius: 10, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
        ✅ 항목을 추가하려면 <b>⑥ 계좌 관리</b>에서 계좌를 등록하세요. 여기 입력한 수입은 <b>② 100세 플랜</b>에 연 단위로 합산 반영될 예정이에요(연동은 다음 단계).
      </div>
    </div>
  );
}

// ============================================================
// 탭 6: 세금·공제 분석 (소득공제 + ISA·연금 시뮬 + 투자수익 세금 통합)
// ============================================================
function TabTaxAnalysis({ people, setPeople, household, policy, setPolicy }) {
  const [sub, setSub] = useState("deduction"); // deduction / isa / invest
  const subTabs = [
    { key: "deduction", label: "소득공제 최적화" },
    { key: "isa", label: "ISA·연금 시뮬" },
    { key: "invest", label: "투자수익 세금" },
  ];
  return (
    <div>
      <div style={{ padding: "14px 18px", background: C.tealLt, borderRadius: 12, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
        💡 세금과 공제 관련 분석을 한곳에 모았어요. 아래 버튼으로 <b>소득공제 최적화 · ISA/연금 시뮬 · 투자수익 세금</b>을 전환하며 볼 수 있어요.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {subTabs.map((t) => (
          <button key={t.key} onClick={() => setSub(t.key)}
            style={{ padding: "8px 16px", fontSize: 13, borderRadius: 8, cursor: "pointer", border: "none", fontWeight: 600, background: sub === t.key ? C.teal : C.card, color: sub === t.key ? "#fff" : C.sub, boxShadow: sub === t.key ? "none" : `inset 0 0 0 1px ${C.line}` }}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === "deduction" && <TabDeduction people={people} setPeople={setPeople} household={household} policy={policy} />}
      {sub === "isa" && <TabIsa people={people} policy={policy} setPolicy={setPolicy} />}
      {sub === "invest" && <TabInvest people={people} policy={policy} setPolicy={setPolicy} />}
    </div>
  );
}
