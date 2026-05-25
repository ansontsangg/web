/* =============================================================
   GAME LOGIC
   Sections:
   - STATE
   - SPLASH & INIT
   - STARTING CONDITIONS
   - HELPERS
   - COST & INCOME BREAKDOWN
   - EFFECT PREVIEW & APPLICATION
   - RENDER
   - CHART
   - QUARTERLY TICK
   - EVENT SELECTION (with linked events)
   - LIFE SCORE
   - EXPORT
   ============================================================= */

let state = null;
let startingRolls = null;
let chart = null;


/* =============================================================
   STATE
   ============================================================= */
function createFreshState() {
  return {
    age_quarters: 72,
    quarter: 0,
    max_age_quarters: 72 + (42 * 4), // play through age 18 to 60 — full career arc

    cash: 500,
    savings: 0,
    student_debt: 0,
    credit_card_debt: 0,
    other_debt: 0,
    overdraft_debt: 0, // Auto-accumulates when costs exceed cash. Tiered APR.

    // Income breakdown (quarterly)
    income_salary: 0,
    income_side: 0,
    last_employed_salary: 0, // Used during unemployment to remember prior salary
    is_unemployed: false,
    monthly_parental_support: 0,    // Active until age 22, paid quarterly (×3)
    maintenance_loan_quarterly: 0,  // Student maintenance loan, until age 22

    // Cost breakdown (monthly amounts; quarterly = ×3)
    cost_rent: 300, // student/uni accommodation baseline; reset on first housing event
    cost_mortgage: 0,
    mortgage_principal: 0,    // outstanding mortgage balance (separate from other_debt)
    mortgage_apr: 0,          // current mortgage rate
    mortgage_type: null,      // "fixed" or "variable" or null
    mortgage_term_years: 0,
    market_rate: 0.045,       // base "central bank" rate, drifts each quarter
    house_value: 0,            // current market value (appreciates over time)

    // Pension — locked retirement account. Grows at 6% APR via auto-tick.
    // Player contributes via events; can't withdraw until retirement.
    pension_balance: 0,
    pension_contribution_rate: 0, // % of salary, set by E008 pension event

    // Equity income — vesting stock from job. Pays out as a cash bonus each
    // year until vesting period ends. Set by E017 startup choice etc.
    equity_grant_total: 0,        // total grant value
    equity_vesting_quarters_left: 0, // quarters remaining in vesting
    cost_utilities: 100,
    cost_groceries: 250,
    cost_transport: 80,
    cost_subscriptions: 20,
    cost_other: 50,

    col_multiplier: 1.0,

    happiness: 70,
    health: 90,
    relationships: 60,
    knowledge: 10,
    life_experiences: 0,

    has_credit_card: true, // Default — most adults have one by college age
    has_investment_account: false,
    is_uninsured: false,
    flag_first_investment: false,
    flag_chose_london: false,
    flag_chose_hometown: false,
    flag_had_housing_event: false,
    flag_panic_sold: false,
    flag_bought_dip: false,

    concepts_learned: [],
    decisions: [],
    history: [],
    log: [],
    queued_events: [], // linked events waiting to fire
    starting_rolls: null,

    // Investment portfolio (built on beginGame)
    portfolio: null,
    trade_history: []
  };
}


/* =============================================================
   SPLASH SCREEN
   ============================================================= */
function initSplash() {
  const container = document.getElementById("floating-symbols");
  const symbols = ["$", "£", "€", "¥", "$", "£", "€", "$", "£"];
  const colors = ["var(--accent-pink-deep)", "var(--accent-green-deep)", "var(--accent-yellow)", "var(--accent-blue)", "var(--accent-pink)", "var(--accent-green)"];

  symbols.forEach((sym, i) => {
    const span = document.createElement("span");
    span.textContent = sym;
    span.style.left = Math.random() * 90 + 5 + "%";
    span.style.top = Math.random() * 90 + 5 + "%";
    span.style.fontSize = (2 + Math.random() * 3) + "rem";
    span.style.color = colors[i % colors.length];
    const rot = (Math.random() - 0.5) * 40;
    span.style.setProperty("--rot", rot + "deg");
    span.style.transform = `rotate(${rot}deg)`;
    span.style.animationDelay = (Math.random() * 4) + "s";
    span.style.animationDuration = (6 + Math.random() * 4) + "s";
    container.appendChild(span);
  });
}

function startGame() {
  state = createFreshState();
  state.seed = generateSeed();
  startingRolls = rollStartingConditions();
  state.starting_rolls = startingRolls;
  showStartingModal();
}

function generateSeed() {
  const chars = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // omit confusable chars (I, L, O, 0, 1)
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}


/* =============================================================
   STARTING CONDITIONS MODAL
   ============================================================= */
function showStartingModal() {
  const modal = document.getElementById("starting-modal");
  const cardsContainer = document.getElementById("starting-cards");

  cardsContainer.innerHTML = Object.values(startingRolls).map(roll => `
    <div class="starting-card">
      <div class="starting-card-header">
        <span class="starting-card-icon">${roll.icon}</span>
        <span class="starting-card-label">${roll.categoryLabel}</span>
      </div>
      <div class="starting-card-value">${roll.display}</div>
      <div class="starting-card-desc">${roll.desc}</div>
    </div>
  `).join("");

  document.getElementById("splash-screen").classList.add("hidden");
  modal.classList.remove("hidden");
}

/*
 * Two-pass effect application:
 * 1. Apply all delta effects (cash: 2000 means += 2000)
 * 2. Apply all `set_xxx` absolute effects (set_student_debt: 0 forces value)
 * This fixes the bug where "parents pay tuition" was canceled by a later
 * college-loan delta.
 */
function beginGame() {
  // PASS 1: deltas and flags
  Object.values(startingRolls).forEach(roll => {
    if (!roll.effects) return;
    for (const [key, value] of Object.entries(roll.effects)) {
      if (key.startsWith("set_")) continue; // handled in pass 2
      if (typeof state[key] === "number") {
        state[key] += value;
      } else {
        state[key] = value;
      }
    }
  });

  // PASS 2: absolute overrides
  Object.values(startingRolls).forEach(roll => {
    if (!roll.effects) return;
    for (const [key, value] of Object.entries(roll.effects)) {
      if (!key.startsWith("set_")) continue;
      const realKey = key.slice(4); // strip "set_"
      state[realKey] = value;
    }
  });

  state.happiness = clamp(state.happiness, 0, 100);
  state.health = clamp(state.health, 0, 100);
  state.knowledge = clamp(state.knowledge, 0, 100);

  // Initialize investment portfolio now that state exists
  state.portfolio = initInvestmentState();

  state.log.push({
    age: ageYears(),
    text: `Started life: ${startingRolls.collegePath.display}, ${startingRolls.costOfLiving.display}.`
  });

  state.history.push({
    age: ageYears(),
    netWorth: netWorth(),
    costs: quarterlyCosts(),
    happiness: state.happiness,
    cash: Math.round(state.cash),
    investments: 0,
    pension: 0,
    homeEquity: 0,
    debt: Math.round(state.student_debt + state.credit_card_debt + state.other_debt + state.overdraft_debt)
  });

  document.getElementById("starting-modal").classList.add("hidden");
  document.getElementById("game-ui").classList.remove("hidden");

  initChart();
  render();
  showAdvanceButton();
}


/* =============================================================
   HELPERS
   ============================================================= */
function ageYears() { return Math.floor(state.age_quarters / 4); }

function ageLabel() {
  const seasons = ["Spring", "Summer", "Autumn", "Winter"];
  const season = seasons[state.age_quarters % 4];
  const year = ageYears() - 17;
  return `${season}, Year ${year}`;
}

function netWorth() {
  const invValue = typeof totalInvestmentValue === "function" ? totalInvestmentValue() : 0;
  // Home is an asset at its current market value (we model 3% annual appreciation)
  // Mortgage principal is the liability; the difference is your home equity.
  const homeValue = state.is_homeowner ? (state.house_value || state.house_price || 0) : 0;
  // Pension counted as net worth (it's yours, just locked)
  return state.cash + state.savings + invValue + state.pension_balance + homeValue
    - state.student_debt - state.credit_card_debt - state.other_debt
    - state.overdraft_debt - state.mortgage_principal;
}

// Standard amortization formula: monthly payment for a given principal/APR/term
function mortgageMonthlyPayment(principal, annualRate, years) {
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// Pre-employment / student years: ages 18-21 (inclusive) AND no career yet.
// During these years, costs are reduced (shared rooms, parents help with food, etc.)
// AND parental support + maintenance loan flow as income.
function isStudentYears() {
  return ageYears() < 22 && state.income_salary === 0;
}

function studentMultiplier() {
  // Student life is cheaper but not trivial — uni accommodation, basic food,
  // no commute. Maintenance loan is meant to *roughly cover* costs, not
  // generate large surplus.
  return isStudentYears() ? 0.6 : 1.0;
}

function quarterlyIncome_legacy_unused() {
  // Removed duplicate — see real quarterlyIncome below
  return 0;
}

// Quarterly cost = monthly cost × 3, with COL multiplier and student multiplier
// Mortgage is NOT subject to student multiplier — once a homeowner, you owe it
function pensionContributionQuarterly() {
  // The player's contribution. Doesn't include employer match (that's a benefit).
  if (state.pension_contribution_rate > 0 && state.income_salary > 0) {
    return Math.round(state.income_salary * state.pension_contribution_rate);
  }
  return 0;
}

function quarterlyCosts() {
  // Rent is location-priced via the housing event itself (London £850 vs hometown £400),
  // so it should NOT be scaled by COL multiplier. Same for mortgage.
  // COL multiplier only applies to "everyday" costs: utilities, groceries, transport, subs, other.
  const colCosts = (state.cost_utilities + state.cost_groceries
                  + state.cost_transport + state.cost_subscriptions + state.cost_other) * 3;
  const rentCost = state.cost_rent * 3;
  const mortgageCosts = state.cost_mortgage * 3;
  const pensionCost = pensionContributionQuarterly();
  return Math.round(colCosts * state.col_multiplier * studentMultiplier()
                  + rentCost * studentMultiplier()
                  + mortgageCosts + pensionCost);
}

// Individual cost categories as quarterly amounts (for distribution bar)
function costBreakdown() {
  const colM = state.col_multiplier * studentMultiplier();
  const studentM = studentMultiplier();
  const breakdown = {
    rent:          Math.round(state.cost_rent * 3 * studentM),       // NOT col-scaled
    utilities:     Math.round(state.cost_utilities * 3 * colM),
    groceries:     Math.round(state.cost_groceries * 3 * colM),
    transport:     Math.round(state.cost_transport * 3 * colM),
    subscriptions: Math.round(state.cost_subscriptions * 3 * colM),
    other:         Math.round(state.cost_other * 3 * colM)
  };
  if (state.cost_mortgage > 0) {
    breakdown.mortgage = Math.round(state.cost_mortgage * 3); // not scaled
  }
  const pension = pensionContributionQuarterly();
  if (pension > 0) {
    breakdown.pension = pension;
  }
  return breakdown;
}

function incomeBreakdown() {
  const breakdown = {
    salary: state.income_salary,
    side:   state.income_side
  };
  if (isStudentYears()) {
    breakdown.parental_support = state.monthly_parental_support * 3;
    breakdown.maintenance_loan = state.maintenance_loan_quarterly;
  }
  // Show equity vesting as income while it's paying out
  if (state.equity_vesting_quarters_left > 0 && state.equity_grant_total > 0) {
    breakdown.equity = Math.round(state.equity_grant_total / (state.equity_vesting_quarters_left + 12));
  }
  return breakdown;
}

function quarterlyIncome() {
  let total = state.income_salary + state.income_side;
  if (isStudentYears()) {
    total += state.monthly_parental_support * 3;
    total += state.maintenance_loan_quarterly;
  }
  if (state.equity_vesting_quarters_left > 0 && state.equity_grant_total > 0) {
    total += Math.round(state.equity_grant_total / (state.equity_vesting_quarters_left + 12));
  }
  return total;
}

function money(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "£" + Math.abs(Math.round(n)).toLocaleString();
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }


/* =============================================================
   EFFECT PREVIEW & APPLICATION
   ============================================================= */

const EFFECT_DISPLAY = {
  cash:               { label: "Cash",          unit: "£" },
  savings:            { label: "Savings",       unit: "£" },
  student_debt:       { label: "Student Debt",  unit: "£", invertPositive: true },
  credit_card_debt:   { label: "Credit Debt",   unit: "£", invertPositive: true },
  other_debt:         { label: "Debt",          unit: "£", invertPositive: true },
  income_salary:      { label: "Salary",        unit: "£/qtr" },
  income_side:        { label: "Side income",   unit: "£/qtr" },
  cost_rent:          { label: "Rent",          unit: "£/mo", invertPositive: true },
  cost_subscriptions: { label: "Subs",          unit: "£/mo", invertPositive: true },
  cost_transport:     { label: "Transport",     unit: "£/mo", invertPositive: true },
  cost_other:         { label: "Other costs",   unit: "£/mo", invertPositive: true },
  happiness:          { label: "Happiness",     unit: "" },
  health:             { label: "Health",        unit: "" },
  relationships:      { label: "Relationships", unit: "" },
  knowledge:          { label: "Knowledge",     unit: "", hidden: true },
  life_experiences:   { label: "Experiences",   unit: "" },
  has_credit_card:    { label: "Get credit card", bool: true },
  has_investment_account: { label: "Open investment account", bool: true }
};

function buildEffectPreview(effects) {
  const tags = [];
  for (const [key, value] of Object.entries(effects)) {
    // Show relative salary changes as the resulting absolute salary,
    // not as a delta — it's clearer for the player who's currently unemployed.
    if (key === "income_salary_set_relative") {
      const base = state.last_employed_salary || state.income_salary || 0;
      const resulting = Math.max(0, base + value);
      const tagType = value > 0 ? "positive" : (value < 0 ? "negative" : "neutral");
      tags.push({
        text: `Salary: £${resulting.toLocaleString()}/qtr`,
        type: tagType
      });
      continue;
    }
    // Hide set_ effects (mostly admin), but expose key consequences
    if (key === "set_income_salary" && value === 0) {
      tags.push({ text: "Lose your job", type: "negative" });
      continue;
    }
    if (key.startsWith("set_") || key === "lost_job_at") {
      // Show rent changes (set_cost_rent → "Rent: £X/mo") so player sees impact
      if (key === "set_cost_rent" && value > 0) {
        tags.push({
          text: `Rent: £${value.toLocaleString()}/mo`,
          type: value > state.cost_rent ? "negative" : (value < state.cost_rent ? "positive" : "neutral")
        });
      }
      continue;
    }

    const cfg = EFFECT_DISPLAY[key];
    if (!cfg || cfg.hidden) continue;

    if (cfg.bool) {
      if (value === true) tags.push({ text: cfg.label, type: "neutral" });
      continue;
    }

    const isIncrease = value > 0;
    const isGood = cfg.invertPositive ? !isIncrease : isIncrease;
    const sign = value > 0 ? "+" : "";
    const minusSign = value < 0 ? "−" : "";
    const tagType = value === 0 ? "neutral" : (isGood ? "positive" : "negative");

    let text;
    if (cfg.unit === "£" || cfg.unit === "£/qtr" || cfg.unit === "£/mo") {
      const tail = cfg.unit === "£" ? "" : " " + cfg.unit.slice(1);
      text = `${minusSign}${sign}£${Math.abs(value).toLocaleString()}${tail} ${cfg.label}`;
    } else {
      text = `${sign}${value} ${cfg.label}`;
    }
    tags.push({ text, type: tagType });
  }
  return tags;
}

function applyEffects(effects) {
  // Track previous salary for relative-set effects.
  // We use 'last_employed_salary' specifically for events that fire AFTER
  // a redundancy (where current salary is 0), so they can offer wages
  // based on the salary you HAD, not your current £0.
  const prevSalary = state.last_employed_salary || state.income_salary;

  for (const [key, value] of Object.entries(effects)) {
    // Absolute set: set_<stat> => state.<stat> = value
    if (key.startsWith("set_")) {
      const realKey = key.slice(4);
      state[realKey] = value;
      // When salary is force-set to 0 (redundancy), preserve previous salary
      if (realKey === "income_salary" && value === 0) {
        state.last_employed_salary = state.income_salary || prevSalary;
      }
      continue;
    }

    // Relative set: income_salary_set_relative => salary becomes prev + value
    // Used by job-search events after redundancy. Pulls from last_employed_salary.
    if (key === "income_salary_set_relative") {
      const base = state.last_employed_salary || prevSalary;
      state.income_salary = Math.max(0, base + value);
      // Clear the stored salary now that we're employed again
      state.last_employed_salary = 0;
      continue;
    }

    // pension_contribution_rate_set: setter that establishes ongoing pension contributions
    if (key === "pension_contribution_rate_set") {
      state.pension_contribution_rate = value;
      continue;
    }

    // lost_job_at: store the quarter so events can reference time-since-loss
    if (key === "lost_job_at") {
      state.lost_job_at = state.quarter;
      continue;
    }

    if (typeof state[key] === "number") {
      state[key] += value;
    } else if (typeof state[key] === "boolean") {
      state[key] = value;
    } else {
      state[key] = value;
    }
  }
  state.happiness = clamp(state.happiness, 0, 100);
  state.health = clamp(state.health, 0, 100);
  state.relationships = clamp(state.relationships, 0, 100);
  state.knowledge = clamp(state.knowledge, 0, 100);

  state.cost_rent = Math.max(0, state.cost_rent);
  state.cost_subscriptions = Math.max(0, state.cost_subscriptions);
}


/* =============================================================
   RENDER
   ============================================================= */
function render() {
  document.getElementById("age-display").textContent = ageYears();
  document.getElementById("age-season").textContent = ageLabel();

  // Seed (set once but safe to update)
  const seedEl = document.getElementById("seed-display");
  if (seedEl && state.seed) seedEl.textContent = state.seed;

  // Highlight Invest button if account opened but never used
  const investBtn = document.getElementById("btn-invest");
  if (investBtn) {
    if (state.has_investment_account && !state._invest_button_clicked) {
      investBtn.classList.add("highlight-pulse");
    } else {
      investBtn.classList.remove("highlight-pulse");
    }
  }

  document.getElementById("stat-cash").textContent = money(state.cash);
  document.getElementById("stat-cash").className = "stat-value " + (state.cash < 0 ? "negative" : "");
  document.getElementById("stat-investments").textContent = money(totalInvestmentValue());
  // Debt with warning state and tooltip data
  const totalDebt = state.student_debt + state.credit_card_debt + state.other_debt + state.overdraft_debt;
  const debtEl = document.getElementById("stat-debt");
  debtEl.textContent = money(totalDebt);
  // Warning level: how much of total debt is high-interest (overdraft + credit card)?
  const expensiveDebt = state.overdraft_debt + state.credit_card_debt;
  if (expensiveDebt > 2000) {
    debtEl.classList.add("debt-warn");
  } else {
    debtEl.classList.remove("debt-warn");
  }
  renderDebtTooltip();
  document.getElementById("stat-networth").textContent = money(netWorth());
  document.getElementById("stat-networth").className = "stat-value " + (netWorth() >= 0 ? "positive" : "negative");

  // Income & cost chips
  document.getElementById("chip-income-value").textContent = money(quarterlyIncome());
  document.getElementById("chip-cost-value").textContent = money(quarterlyCosts());

  renderBreakdown("income-breakdown", incomeBreakdown(), INCOME_COLORS);
  renderBreakdown("cost-breakdown", costBreakdown(), COST_COLORS);

  // Bars
  ["happiness", "health", "relationships", "knowledge"].forEach(b => {
    document.getElementById("bar-" + b).style.width = state[b] + "%";
    document.getElementById("val-" + b).textContent = Math.round(state[b]);
  });

  // Note: log no longer renders to a separate container — it's shown inline
  // with the advance button (see showAdvanceButton).
  // Re-render the advance/log panel if it's currently visible (so log updates
  // after every paydown / investment action).
  const slot = document.getElementById("event-slot");
  if (slot && slot.querySelector(".advance-panel")) {
    showAdvanceButton();
  }

  updateChart();
}

// Colors for breakdown bars (ordered)
const COST_COLORS = {
  rent:          "#E37890",
  mortgage:      "#9C27B0",
  utilities:     "#7FB3C7",
  groceries:     "#8BC49A",
  transport:     "#F4D06F",
  subscriptions: "#B794F4",
  other:         "#B8A990",
  pension:       "#4E9A6A"
};

const INCOME_COLORS = {
  salary: "#4E9A6A",
  side:   "#F4A7B9",
  parental_support: "#7FB3C7",
  maintenance_loan: "#F4D06F",
  equity: "#9C27B0"
};

const BREAKDOWN_LABELS = {
  rent: "Rent",
  mortgage: "Mortgage",
  utilities: "Utilities",
  groceries: "Groceries",
  transport: "Transport",
  subscriptions: "Subscriptions",
  other: "Other",
  pension: "Pension contribution",
  salary: "Salary",
  side: "Side income",
  parental_support: "Parents",
  maintenance_loan: "Maintenance loan",
  equity: "Equity vesting"
};

function renderDebtTooltip() {
  const container = document.getElementById("debt-breakdown");
  if (!container) return;

  const items = [
    { key: "overdraft_debt", label: "Overdraft",     balance: state.overdraft_debt,     apr: 0.35, color: "#D9534F", note: "First £500 free" },
    { key: "credit_card_debt", label: "Credit Card", balance: state.credit_card_debt,   apr: 0.19, color: "#E37890" },
    { key: "other_debt",     label: "Other / BNPL", balance: state.other_debt,         apr: 0.05, color: "#F4D06F" },
    { key: "student_debt",   label: "Student Loan",  balance: state.student_debt,       apr: 0.06, color: "#7FB3C7" }
  ].filter(i => i.balance > 0);

  if (items.length === 0) {
    container.innerHTML = `<div class="bkdn-empty">No debt — keep it that way 🎉</div>`;
    return;
  }

  const totalQuarterlyInterest = items.reduce((sum, i) => sum + i.balance * (i.apr / 4), 0);

  container.innerHTML = `
    <div class="debt-tooltip-header">Compounding right now:</div>
    ${items.map(i => {
      const quarterlyCost = i.balance * (i.apr / 4);
      return `
        <div class="debt-tooltip-row">
          <div class="debt-tooltip-color" style="background: ${i.color};"></div>
          <div class="debt-tooltip-label">${i.label}</div>
          <div class="debt-tooltip-rate">${(i.apr * 100).toFixed(0)}% APR</div>
          <div class="debt-tooltip-amount">+${money(quarterlyCost)}/qtr</div>
        </div>
      `;
    }).join("")}
    <div class="debt-tooltip-total">
      Total cost this quarter: <strong class="debt-warn-text">+${money(totalQuarterlyInterest)}</strong>
    </div>
    ${state.overdraft_debt > 400 ? `
      <div class="debt-warn-banner">
        ⚠️ Overdraft approaching the £500 free zone — costs accelerate beyond.
      </div>
    ` : ""}
  `;
}

function renderBreakdown(containerId, breakdown, colors) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) {
    container.innerHTML = `<div class="breakdown-empty">No ${containerId.startsWith("income") ? "income" : "costs"} yet</div>`;
    return;
  }

  // Distribution bar
  const barHtml = Object.entries(breakdown)
    .filter(([k, v]) => v > 0)
    .map(([k, v]) => {
      const pct = (v / total * 100).toFixed(1);
      return `<div class="bkdn-seg" style="width: ${pct}%; background: ${colors[k]};"
                   title="${BREAKDOWN_LABELS[k]}: ${money(v)}"></div>`;
    }).join("");

  // Legend
  const legendHtml = Object.entries(breakdown)
    .filter(([k, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const pct = (v / total * 100).toFixed(0);
      return `
        <div class="bkdn-item">
          <span class="bkdn-dot" style="background: ${colors[k]};"></span>
          <span class="bkdn-label">${BREAKDOWN_LABELS[k]}</span>
          <span class="bkdn-value">${money(v)} <span class="bkdn-pct">${pct}%</span></span>
        </div>
      `;
    }).join("");

  container.innerHTML = `
    <div class="bkdn-bar">${barHtml}</div>
    <div class="bkdn-legend">${legendHtml}</div>
    <div class="bkdn-total">Total: <strong>${money(total)}</strong></div>
  `;
}


/* =============================================================
   CHART
   ============================================================= */
function initChart() {
  const ctx = document.getElementById("lifeChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Net Worth (£)", data: [], borderColor: "#4E9A6A",
          backgroundColor: "rgba(139, 196, 154, 0.15)", borderWidth: 3, fill: true,
          tension: 0.3, yAxisID: "y", pointRadius: 3, pointBackgroundColor: "#4E9A6A"
        },
        {
          label: "Quarterly Costs (£)", data: [], borderColor: "#D9534F",
          borderWidth: 2, tension: 0.3, yAxisID: "y", pointRadius: 2
        },
        {
          label: "Happiness", data: [], borderColor: "#E37890",
          backgroundColor: "rgba(244, 167, 185, 0.1)", borderWidth: 2,
          tension: 0.3, yAxisID: "y1", pointRadius: 2, borderDash: [5, 3]
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", labels: { font: { family: "Fraunces, serif", size: 12 }, color: "#2B2118" } },
        tooltip: { backgroundColor: "#2B2118" }
      },
      scales: {
        x: { title: { display: true, text: "Age" }, grid: { color: "rgba(43, 33, 24, 0.08)" } },
        y: { position: "left", title: { display: true, text: "£" }, grid: { color: "rgba(43, 33, 24, 0.08)" } },
        y1: { position: "right", min: 0, max: 100, title: { display: true, text: "Happiness" }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function updateChart() {
  if (!chart) return;
  chart.data.labels = state.history.map(h => h.age);
  chart.data.datasets[0].data = state.history.map(h => h.netWorth);
  chart.data.datasets[1].data = state.history.map(h => h.costs);
  chart.data.datasets[2].data = state.history.map(h => h.happiness);
  chart.update("none");
}


/* =============================================================
   QUARTERLY TICK
   ============================================================= */
function quarterlyTick() {
  state.age_quarters += 1;
  state.quarter += 1;

  // Income lands first
  state.cash += quarterlyIncome();

  // Costs come out — but if cash can't cover them, the shortfall becomes
  // overdraft debt rather than negative cash. This mimics how real bank
  // overdrafts work.
  const costs = quarterlyCosts();
  if (costs <= state.cash) {
    state.cash -= costs;
  } else {
    const shortfall = costs - state.cash;
    state.cash = 0;
    // If player chose to float costs on credit cards during unemployment,
    // shortfall lands in CC debt (19% APR) instead of overdraft (35% APR but free first £500).
    // Different teaching moment: CC debt grows steadily even without overdraft fees.
    if (state.flag_using_cc_during_unemployment && state.has_credit_card) {
      state.credit_card_debt += shortfall;
      if (shortfall > 100) {
        state.log.push({
          age: ageYears(),
          text: `Charged £${Math.round(shortfall).toLocaleString()} to credit card.`
        });
      }
    } else {
      state.overdraft_debt += shortfall;
      if (shortfall > 100) {
        state.log.push({
          age: ageYears(),
          text: `Went £${Math.round(shortfall).toLocaleString()} into overdraft this quarter.`
        });
      }
    }
  }

  // Tiered overdraft interest: first £500 is 0% (student account perk),
  // anything above accrues at 35% APR / 4 = 8.75% per quarter.
  if (state.overdraft_debt > 500) {
    const chargeable = state.overdraft_debt - 500;
    state.overdraft_debt = 500 + chargeable * 1.0875;
  }

  // Sweep raw savings into HYSA holding (kept invisible to player as a stat row).
  // Events that grant `savings` still work — the money just flows into the
  // savings asset where it earns interest via the price model.
  if (state.savings > 0 && state.portfolio && state.portfolio.savings) {
    state.portfolio.savings.units += state.savings;
    state.portfolio.savings.cost_basis += state.savings;
    state.savings = 0;
  }

  // Debt interest rates per quarter (realistic)
  state.student_debt *= 1.015;     // ~6% APR — UK student loan rate-ish
  state.credit_card_debt *= 1.0475; // ~19% APR — slightly less brutal
  // Other debt is a mix of 0% promotional financing and small loans — keep low
  state.other_debt *= 1.012;       // ~5% APR average

  // Investment prices update (savings asset will have ~0% volatility, ~2.5% drift)
  updateAssetPrices();

  // Market interest rate drift (mean-reverts to ~4.5%, with quarterly noise).
  // Used by variable mortgages and bond pricing.
  const meanRate = 0.045;
  const reversion = (meanRate - state.market_rate) * 0.05;
  const noise = (Math.random() - 0.5) * 0.008;
  state.market_rate = clamp(state.market_rate + reversion + noise, 0.005, 0.12);

  // House value appreciation — UK historical avg ~3% annual, with some noise
  if (state.is_homeowner && state.house_value > 0) {
    const drift = 0.03 / 4;
    const noise = (Math.random() - 0.5) * 0.012;
    state.house_value *= (1 + drift + noise);
  }

  // Mortgage amortization. Each quarter the player pays cost_mortgage*3,
  // some goes to interest, the rest reduces principal.
  if (state.mortgage_principal > 0) {
    // Variable mortgages re-price quarterly: new APR = market_rate + spread
    if (state.mortgage_type === "variable") {
      state.mortgage_apr = state.market_rate + 0.015;
      // Recalculate monthly payment based on new rate and remaining term
      const remainingMonths = state.mortgage_term_years * 12 - (state.quarter - state.mortgage_start_quarter) * 3;
      if (remainingMonths > 0) {
        state.cost_mortgage = mortgageMonthlyPayment(state.mortgage_principal, state.mortgage_apr, remainingMonths / 12);
      }
    }
    // Apply quarterly interest, then subtract the actual quarterly payment
    const quarterlyInterest = state.mortgage_principal * (state.mortgage_apr / 4);
    const quarterlyPayment = state.cost_mortgage * 3;
    state.mortgage_principal = Math.max(0, state.mortgage_principal + quarterlyInterest - quarterlyPayment);
    if (state.mortgage_principal === 0) {
      state.cost_mortgage = 0;
      state.log.push({ age: ageYears(), text: "🎉 Mortgage paid off!" });
    }
  }

  // Pension growth — locked, grows at 6% APR via compounding
  if (state.pension_balance > 0) {
    state.pension_balance *= 1.015;
  }
  // Pension contribution if enrolled.
  // NOTE: cash deduction happens in quarterlyCosts() via pensionContributionQuarterly()
  // so it shows in the cost breakdown. Here we ONLY add to pension balance.
  if (state.pension_contribution_rate > 0 && state.income_salary > 0) {
    const playerContribution = state.income_salary * state.pension_contribution_rate;
    const employerMatch = state.income_salary * Math.min(state.pension_contribution_rate, 0.05);
    state.pension_balance += playerContribution + employerMatch;
  }

  // Equity vesting — pay out a slice each quarter until grant fully vests
  if (state.equity_vesting_quarters_left > 0 && state.equity_grant_total > 0) {
    const slice = state.equity_grant_total / (state.equity_vesting_quarters_left + 12);
    state.cash += slice;
    state.equity_grant_total -= slice;
    state.equity_vesting_quarters_left -= 1;
    if (state.equity_vesting_quarters_left === 0) {
      state.equity_grant_total = 0;
    }
  }

  // Natural happiness decay — variable based on life quality.
  // A baseline of -1/qtr, modified by:
  //  - Strong relationships protect (high relationships = less decay)
  //  - Recent life experiences buffer
  //  - Health below 50 makes decay worse
  //  - Heavy debt load makes decay worse
  let decay = 1.0;
  if (state.relationships > 70) decay -= 0.4;
  else if (state.relationships < 30) decay += 0.5;
  if (state.health < 50) decay += 0.5;
  if (state.life_experiences >= 3) decay -= 0.3;
  // Crushing high-interest debt is genuinely depressing
  const expensiveDebt = state.credit_card_debt + state.overdraft_debt;
  if (expensiveDebt > 5000) decay += 0.5;

  state.happiness -= decay;
  state.happiness = clamp(state.happiness, 0, 100);

  state.history.push({
    age: ageYears(),
    netWorth: Math.round(netWorth()),
    costs: Math.round(quarterlyCosts()),
    happiness: Math.round(state.happiness),
    // Components for end-of-game stacked chart
    cash: Math.round(state.cash),
    investments: Math.round(typeof totalInvestmentValue === "function" ? totalInvestmentValue() : 0),
    pension: Math.round(state.pension_balance || 0),
    homeEquity: Math.round(state.is_homeowner ? Math.max(0, (state.house_value || 0) - state.mortgage_principal) : 0),
    debt: Math.round(state.student_debt + state.credit_card_debt + state.other_debt + state.overdraft_debt)
  });
}


/* =============================================================
   EVENT SELECTION — with linked events
   Priority order:
   1. Queued linked events fire first
   2. Otherwise, random eligible event (respecting flags)
   ============================================================= */
function pickEvent() {
  const age = ageYears();

  // 1. Queued events take priority
  if (state.queued_events.length > 0) {
    const queuedId = state.queued_events.shift();
    const event = EVENTS.find(e => e.id === queuedId);
    if (event) return event;
  }

  // 2. Random eligible event
  const eligible = EVENTS.filter(e => {
    if (e.linked_only) return false; // linked-only events skipped in random selection
    if (age < e.age_min || age > e.age_max) return false;
    if (state.decisions.find(d => d.event_id === e.id)) return false; // no repeats

    // Flag checks
    if (e.requires_flag && !state[e.requires_flag]) return false;
    if (e.requires_flags && !e.requires_flags.every(f => state[f])) return false;
    if (e.excludes_flag && state[e.excludes_flag]) return false;
    if (e.excludes_flags && e.excludes_flags.some(f => state[f])) return false;
    // Dynamic conditions (computed from state, not just flags)
    if (e.requires_condition && !checkCondition(e.requires_condition)) return false;

    return true;
  });

  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

function showEvent(event) {
  const slot = document.getElementById("event-slot");
  const choicesClass = event.choices.length === 2 ? "two" : event.choices.length === 4 ? "four" : "three";

  slot.innerHTML = `
    <div class="event-card">
      <span class="event-category">${event.category}</span>
      <p class="event-prompt">${event.prompt}</p>
      <div class="choices ${choicesClass}">
        ${event.choices.map((c, i) => {
          let extraTags = [];
          // Special case: mortgage choices show computed monthly payment + total interest
          if (event.id === "E012_MORTGAGE" && state.house_price) {
            const principal = state.house_price - (state.deposit_required || 0);
            const ratesByIdx = [
              { years: 25, apr: state.market_rate + 0.010, type: "fixed" },
              { years: 30, apr: state.market_rate + 0.0125, type: "fixed" },
              { years: 30, apr: state.market_rate + 0.015, type: "variable" }
            ];
            const cfg = ratesByIdx[i];
            if (cfg) {
              const monthly = mortgageMonthlyPayment(principal, cfg.apr, cfg.years);
              const totalPaid = monthly * cfg.years * 12;
              const totalInterest = totalPaid - principal;
              extraTags.push({ text: `£${Math.round(monthly).toLocaleString()}/mo`, type: "negative" });
              extraTags.push({ text: `Rate: ${(cfg.apr * 100).toFixed(2)}%`, type: "neutral" });
              extraTags.push({ text: `Total interest: £${Math.round(totalInterest).toLocaleString()}`, type: cfg.years > 25 ? "negative" : "neutral" });
              extraTags.push({ text: "Replaces rent", type: "positive" });
            }
          }
          // Special case: house pick shows deposit + chip
          if (event.id === "E012" && c.effects.house_price) {
            extraTags.push({ text: `Deposit: £${(c.effects.deposit_required).toLocaleString()}`, type: "negative" });
            extraTags.push({ text: `Borrow: £${(c.effects.house_price - c.effects.deposit_required).toLocaleString()}`, type: "neutral" });
          }
          const baseTags = buildEffectPreview(c.effects);
          const allTags = [...extraTags, ...baseTags];
          const tagsHtml = allTags.length
            ? `<div class="effects-preview">
                ${allTags.map(t => `<span class="effect-tag ${t.type}">${t.text}</span>`).join("")}
              </div>`
            : "";
          return `
            <button class="choice-btn" onclick="makeChoice('${event.id}', ${i})">
              <strong>Option ${String.fromCharCode(65 + i)}</strong>
              <span>${c.label}</span>
              ${tagsHtml}
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function showAdvanceButton() {
  const slot = document.getElementById("event-slot");
  const recentEntries = state.log.slice(-6).reverse();

  slot.innerHTML = `
    <div class="card card-yellow advance-panel">
      <button class="advance-btn" onclick="advanceQuarter()">
        ➤ Advance to next quarter
      </button>
      <div class="log-inline">
        <div class="log-inline-title">Recent events</div>
        <div class="log-inline-list">
          ${recentEntries.length === 0
            ? '<div class="log-inline-empty">Your story begins here.</div>'
            : recentEntries.map(entry =>
                `<div class="log-entry"><span class="log-age">Age ${entry.age}</span>${entry.text}</div>`
              ).join("")}
        </div>
      </div>
    </div>
  `;
}

function makeChoice(eventId, choiceIdx) {
  const event = EVENTS.find(e => e.id === eventId);
  const choice = event.choices[choiceIdx];

  applyEffects(choice.effects);

  // Apply event-specific consequences that need code (not just stat deltas)
  applyEventConsequences(eventId, choiceIdx);

  // Queue linked follow-up events
  if (choice.queue && Array.isArray(choice.queue)) {
    state.queued_events.push(...choice.queue);
    // chain: true on the choice means the queued event fires this same turn,
    // right after the player dismisses the concept card. No advance click.
    if (choice.chain) {
      state._chainNext = true;
    }
  }

  state.decisions.push({
    event_id: eventId, category: event.category,
    choice_idx: choiceIdx, choice_label: choice.label,
    age: ageYears(), quarter: state.quarter
  });

  if (!state.concepts_learned.includes(event.concept)) {
    state.concepts_learned.push(event.concept);
    state.knowledge = clamp(state.knowledge + 5, 0, 100);
  }

  state.log.push({
    age: ageYears(),
    text: `${event.category}: "${choice.label.substring(0, 38)}${choice.label.length > 38 ? '...' : ''}"`
  });

  showConceptCard(event);
  render();
}

/* =============================================================
   EVENT-SPECIFIC CONSEQUENCES
   For consequences that can't be expressed as simple stat deltas.
   This is where e.g. "market crash hits actual portfolio prices" lives.
   ============================================================= */
function applyEventConsequences(eventId, choiceIdx) {
  // E019: pension contribution rate setter (so player can boost to 15% from event)
  if (eventId === "E019" && choiceIdx === 0) {
    state.pension_contribution_rate = 0.15;
  }
  // E019: downsize home — sell house, free up equity, reduce mortgage cost
  if (eventId === "E019" && choiceIdx === 2 && state.is_homeowner) {
    // Sell at current house_price (no appreciation modeled here — kept simple).
    // Player gets back: house_price - remaining mortgage principal
    const equity = (state.house_price || 250000) - state.mortgage_principal;
    state.cash += Math.max(0, equity);
    // Reset to renting cheaper place
    state.mortgage_principal = 0;
    state.cost_mortgage = 0;
    state.is_homeowner = false;
    state.cost_rent = 600; // smaller rented place
    state.log.push({
      age: ageYears(),
      text: `Sold home, freed £${Math.round(Math.max(0, equity)).toLocaleString()} equity, moved to a smaller rental.`
    });
  }

  // Equity grant (E017 startup): 60/25/15 outcome distribution
  if (eventId === "E017" && choiceIdx === 1) {
    const headline = 80000;
    const outcome = Math.random();
    let realized;
    if (outcome < 0.6) realized = headline * 0.3;       // most startups underperform
    else if (outcome < 0.85) realized = headline * 1.0; // modest success
    else realized = headline * 3.0;                     // big exit
    state.equity_grant_total = realized;
    state.equity_vesting_quarters_left = 16; // 4 years
    state.log.push({
      age: ageYears(),
      text: `Joined startup. Equity grant: £${Math.round(realized).toLocaleString()} vesting over 4 years.`
    });
  }

  // E012_MORTGAGE: actually set up the mortgage with proper math
  if (eventId === "E012_MORTGAGE") {
    const housePrice = state.house_price || 250000;
    const deposit = state.deposit_required || Math.round(housePrice * 0.10);

    // Deposit comes out of cash (not added to debt)
    state.cash -= deposit;

    // Principal = price minus deposit
    const principal = housePrice - deposit;
    state.mortgage_principal = principal;
    state.mortgage_start_quarter = state.quarter;
    state.house_value = housePrice; // initial value = purchase price; appreciates quarterly

    // Choice index determines term & rate type
    if (choiceIdx === 0) { // 25yr fixed at market+1%
      state.mortgage_apr = state.market_rate + 0.010;
      state.mortgage_term_years = 25;
      state.mortgage_type = "fixed";
    } else if (choiceIdx === 1) { // 30yr fixed at market+1.25%
      state.mortgage_apr = state.market_rate + 0.0125;
      state.mortgage_term_years = 30;
      state.mortgage_type = "fixed";
    } else { // 30yr variable: starts at market+1.5%, re-prices each quarter
      state.mortgage_apr = state.market_rate + 0.015;
      state.mortgage_term_years = 30;
      state.mortgage_type = "variable";
    }

    state.cost_mortgage = mortgageMonthlyPayment(principal, state.mortgage_apr, state.mortgage_term_years);
    state.log.push({
      age: ageYears(),
      text: `Bought home for £${housePrice.toLocaleString()}, monthly mortgage £${Math.round(state.cost_mortgage).toLocaleString()}.`
    });
  }

  // E016: Market crash — flight-to-quality scenario.
  // Stocks/SP500/crypto crash. Bonds GAIN (investors flee equities for safety).
  // Savings unaffected. This teaches: in real markets, asset classes are often
  // negatively correlated — diversification across them softens the blow.
  if (eventId === "E016") {
    if (state.portfolio) {
      const impact = {
        sp500: 0.70,    // -30%
        stocks: 0.55,   // -45% (single-stock concentration is brutal)
        crypto: 0.40,   // -60% (crypto crashes hardest)
        bonds: 1.08,    // +8% (flight to quality)
        savings: 1.00   // unchanged
      };
      for (const [id, factor] of Object.entries(impact)) {
        if (state.portfolio[id]) {
          state.portfolio[id].current_price *= factor;
          state.portfolio[id].price_history.push(state.portfolio[id].current_price);
        }
      }

      // Panic sell: liquidate everything except savings, lock in losses
      if (choiceIdx === 0) {
        for (const id of ["sp500", "stocks", "crypto", "bonds"]) {
          const h = state.portfolio[id];
          if (h && h.units > 0) {
            state.cash += h.units * h.current_price;
            h.units = 0;
            h.cost_basis = 0;
          }
        }
        state.log.push({ age: ageYears(), text: `Panic-sold portfolio at the bottom.` });
      } else if (choiceIdx === 2) {
        // Buy the dip into S&P at the new low price
        const sp = state.portfolio.sp500;
        if (sp) {
          sp.units += 10000 / sp.current_price;
          sp.cost_basis += 10000;
        }
      }
    }
  }

  // E027: Equity payout — sell-half choice creates a held asset position
  if (eventId === "E027" && choiceIdx === 1 && state.portfolio) {
    // Add £17500 worth of "stocks" (concentrated company stock)
    const stocksHolding = state.portfolio.stocks;
    if (stocksHolding) {
      stocksHolding.units += 17500 / stocksHolding.current_price;
      stocksHolding.cost_basis += 17500;
    }
  }
  if (eventId === "E027" && choiceIdx === 2 && state.portfolio) {
    // Hold all: full position, more risk
    const stocksHolding = state.portfolio.stocks;
    if (stocksHolding) {
      stocksHolding.units += 35000 / stocksHolding.current_price;
      stocksHolding.cost_basis += 35000;
    }
  }
}

function showConceptCard(event) {
  const slot = document.getElementById("event-slot");
  slot.innerHTML = `
    <div class="concept-card">
      <div class="concept-label">💡 What you just learned</div>
      <h3>${event.concept}</h3>
      <p>${event.explanation}</p>
      <button class="dismiss-btn" onclick="continueAfterChoice()">Got it — continue</button>
    </div>
  `;
}

function continueAfterChoice() {
  // If there's a queued event tagged for immediate firing, skip the
  // advance button and show the next event in the same turn.
  // We detect this by checking if there's a queued event AND the previous
  // event's chosen choice had chain_immediately: true (set in state).
  if (state._chainNext && state.queued_events.length > 0) {
    state._chainNext = false;
    const queuedId = state.queued_events.shift();
    const event = EVENTS.find(e => e.id === queuedId);
    if (event) {
      showEvent(event);
      return;
    }
  }
  state._chainNext = false;
  showAdvanceButton();
}


/* =============================================================
   MAIN LOOP
   ============================================================= */
function advanceQuarter() {
  quarterlyTick();

  if (state.age_quarters >= state.max_age_quarters) {
    endGame();
    return;
  }

  // Event chance: high in early game and just after life transitions, lower later.
  const queueForce = state.queued_events.length > 0;
  const earlyForce = state.quarter <= 3; // first 3 quarters always have events
  const eligibleCount = countEligibleEvents();
  const baseChance = state.quarter < 12 ? 0.7 : 0.5; // college years more eventful

  const shouldHaveEvent = queueForce || earlyForce || (Math.random() < baseChance);
  const event = shouldHaveEvent ? pickEvent() : null;

  if (event) {
    showEvent(event);
  } else {
    state.log.push({ age: ageYears(), text: `${ageLabel()} passed quietly.` });
    showAdvanceButton();
  }

  render();
}

function countEligibleEvents() {
  const age = ageYears();
  return EVENTS.filter(e => {
    if (e.linked_only) return false;
    if (age < e.age_min || age > e.age_max) return false;
    if (state.decisions.find(d => d.event_id === e.id)) return false;
    if (e.requires_flag && !state[e.requires_flag]) return false;
    if (e.requires_flags && !e.requires_flags.every(f => state[f])) return false;
    if (e.excludes_flag && state[e.excludes_flag]) return false;
    if (e.excludes_flags && e.excludes_flags.some(f => state[f])) return false;
    if (e.requires_condition && !checkCondition(e.requires_condition)) return false;
    return true;
  }).length;
}

// Dynamic condition checks for events that need to inspect state, not just flags.
function checkCondition(condition) {
  if (condition === "behind_on_retirement") {
    // "Behind" = pension + investments < 5x annual salary at age 50+
    const annualSalary = state.income_salary * 4;
    if (annualSalary === 0) return false; // no job, no benchmark
    const retirementAssets = state.pension_balance + (typeof totalInvestmentValue === "function" ? totalInvestmentValue() : 0);
    return retirementAssets < annualSalary * 5;
  }
  return true;
}


/* =============================================================
   LIFE SCORE
   ============================================================= */
function calculateLifeScore() {
  const age = ageYears();
  const benchmark = Math.max(5000, (age - 17) * 2500);

  const W = clamp((netWorth() / benchmark) * 100, 0, 100);
  const H = state.happiness;
  const R = state.relationships;
  const E = clamp(state.life_experiences * 20, 0, 100);
  const K = state.knowledge;

  const base = W * 0.40 + H * 0.30 + R * 0.10 + E * 0.10 + K * 0.10;

  const scores = [W, H, R, E, K];
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  const balanceMult = clamp(1.2 - 0.5 * (stddev / 50), 0.7, 1.2);

  return {
    final: Math.round(base * balanceMult),
    base: Math.round(base),
    balanceMult: balanceMult.toFixed(2),
    breakdown: { W: Math.round(W), H: Math.round(H), R: Math.round(R), E: Math.round(E), K: Math.round(K) }
  };
}

function endGame() {
  document.getElementById("game-ui").classList.add("hidden");
  document.getElementById("end-screen").classList.remove("hidden");

  const score = calculateLifeScore();
  const finalNW = netWorth();

  document.getElementById("end-score-num").textContent = score.final;
  document.getElementById("end-net-worth").textContent = money(finalNW);

  // Commentary based on score
  let commentary = "";
  if (score.final >= 80) commentary = "A well-lived life. You balanced saving, spending, and connection.";
  else if (score.final >= 60) commentary = "Solid choices. A stable foundation to build on.";
  else if (score.final >= 40) commentary = "Some rough patches. Life threw surprises you weren't always ready for.";
  else commentary = "A hard road. Many lessons learned the expensive way.";

  commentary += `<br><br><span class="mono" style="font-size: 0.85rem; color: var(--ink-soft);">
    Wealth: ${score.breakdown.W} · Happiness: ${score.breakdown.H} · Relationships: ${score.breakdown.R}
    · Experiences: ${score.breakdown.E} · Knowledge: ${score.breakdown.K}
    · Balance multiplier: ${score.balanceMult}×</span>`;

  document.getElementById("end-commentary").innerHTML = commentary;

  renderEndChart();
  renderEndStats();
  renderInvestmentPerformance();
  renderConceptsLearned();
}

// Switch end-screen tabs
function switchEndTab(tabId) {
  document.querySelectorAll(".end-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabId);
  });
  document.querySelectorAll(".end-tab-content").forEach(c => c.classList.remove("active"));
  document.getElementById("end-tab-" + tabId)?.classList.add("active");

  // Re-render charts when tab becomes visible (Chart.js needs a visible canvas)
  if (tabId === "investments") {
    setTimeout(() => renderRiskChart(), 50);
  }
}

// Build performance table per asset class
function renderInvestmentPerformance() {
  const table = document.getElementById("end-perf-table");
  if (!table) return;

  // Compute realized return for each asset based on price history
  const rows = [];
  const totalQuarters = state.history.length - 1;
  const totalYears = totalQuarters / 4;

  for (const [id, asset] of Object.entries(ASSETS || {})) {
    const holding = state.portfolio?.[id];
    if (!holding) continue;
    const startPrice = holding.price_history[0];
    const endPrice = holding.current_price;
    const totalReturn = ((endPrice / startPrice) - 1) * 100;
    const annualizedReturn = totalYears > 0
      ? ((Math.pow(endPrice / startPrice, 1 / totalYears) - 1) * 100)
      : 0;

    // Realized volatility (stddev of quarterly returns)
    const qReturns = [];
    for (let i = 1; i < holding.price_history.length; i++) {
      qReturns.push((holding.price_history[i] / holding.price_history[i-1]) - 1);
    }
    const meanR = qReturns.reduce((a, b) => a + b, 0) / Math.max(1, qReturns.length);
    const variance = qReturns.reduce((a, b) => a + (b - meanR) ** 2, 0) / Math.max(1, qReturns.length);
    const stddevQuarterly = Math.sqrt(variance) * 100;
    const stddevAnnualized = stddevQuarterly * 2; // sqrt(4) for annualized

    // Player's actual P/L
    const currentValue = holding.units * holding.current_price;
    const playerPnL = currentValue - holding.cost_basis;

    rows.push({
      id, asset, totalReturn, annualizedReturn,
      stddevAnnualized, currentValue, playerPnL,
      hadPosition: holding.cost_basis > 0
    });
  }

  // Pension as a synthetic row (fixed 6% APR)
  if (state.pension_balance > 0 || state.pension_contribution_rate > 0) {
    rows.push({
      id: "pension",
      asset: { name: "Pension (locked)", icon: "🔒", color: "#4E9A6A" },
      totalReturn: ((Math.pow(1.06, totalYears) - 1) * 100),
      annualizedReturn: 6.0,
      stddevAnnualized: 0,
      currentValue: state.pension_balance,
      playerPnL: 0,
      hadPosition: state.pension_balance > 0,
      isPension: true
    });
  }

  table.innerHTML = `
    <table class="perf-table">
      <thead>
        <tr>
          <th>Asset</th>
          <th>Annual Return</th>
          <th>Annual Volatility</th>
          <th>Final Value</th>
          <th>Your P/L</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr class="${r.hadPosition ? '' : 'perf-row-empty'}">
            <td>
              <span style="color: ${r.asset.color};">${r.asset.icon}</span>
              ${r.asset.name}
            </td>
            <td class="${r.annualizedReturn >= 0 ? 'positive' : 'negative'}">
              ${r.annualizedReturn >= 0 ? '+' : ''}${r.annualizedReturn.toFixed(2)}%
            </td>
            <td>${r.stddevAnnualized.toFixed(1)}%</td>
            <td>${r.hadPosition ? money(r.currentValue) : '—'}</td>
            <td class="${r.playerPnL >= 0 ? 'positive' : 'negative'}">
              ${r.hadPosition && !r.isPension ? (r.playerPnL >= 0 ? '+' : '') + money(r.playerPnL) : '—'}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <p class="perf-note">
      💡 <strong>Annual Return</strong> is the compound average growth rate.
      <strong>Annual Volatility</strong> (standard deviation) measures how bumpy the ride was.
      Higher return is good; lower volatility is good. The S&P 500 typically beats individual
      stocks because of lower volatility, despite similar averages.
    </p>
  `;
}

// Risk vs Return scatter chart
function renderRiskChart() {
  const canvas = document.getElementById("endRiskChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Re-create existing chart instance if any
  if (window._riskChart) window._riskChart.destroy();

  const totalQuarters = state.history.length - 1;
  const totalYears = totalQuarters / 4;

  const points = [];
  for (const [id, asset] of Object.entries(ASSETS || {})) {
    const holding = state.portfolio?.[id];
    if (!holding) continue;
    const startPrice = holding.price_history[0];
    const endPrice = holding.current_price;
    const annualizedReturn = totalYears > 0
      ? ((Math.pow(endPrice / startPrice, 1 / totalYears) - 1) * 100)
      : 0;
    const qReturns = [];
    for (let i = 1; i < holding.price_history.length; i++) {
      qReturns.push((holding.price_history[i] / holding.price_history[i-1]) - 1);
    }
    const meanR = qReturns.reduce((a, b) => a + b, 0) / Math.max(1, qReturns.length);
    const variance = qReturns.reduce((a, b) => a + (b - meanR) ** 2, 0) / Math.max(1, qReturns.length);
    const stddevAnnualized = Math.sqrt(variance) * 100 * 2;

    points.push({
      label: asset.name,
      data: [{ x: stddevAnnualized, y: annualizedReturn }],
      backgroundColor: asset.color,
      borderColor: "#2B2118",
      borderWidth: 2,
      pointRadius: 9,
      pointHoverRadius: 12
    });
  }

  // Add pension as risk-free point
  if (state.pension_balance > 0 || state.pension_contribution_rate > 0) {
    points.push({
      label: "Pension (locked, 6%)",
      data: [{ x: 0, y: 6 }],
      backgroundColor: "#4E9A6A",
      borderColor: "#2B2118",
      borderWidth: 2,
      pointRadius: 9,
      pointHoverRadius: 12,
      pointStyle: "rectRot"
    });
  }

  window._riskChart = new Chart(ctx, {
    type: "scatter",
    data: { datasets: points },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { font: { family: "Inter", size: 11 }, color: "#2B2118", boxWidth: 14 }
        },
        tooltip: {
          backgroundColor: "#2B2118",
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}% return @ ${ctx.parsed.x.toFixed(1)}% volatility`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Annual Volatility (Risk) %", font: { family: "Inter" } },
          grid: { color: "rgba(43, 33, 24, 0.08)" },
          ticks: { callback: v => v + "%" }
        },
        y: {
          title: { display: true, text: "Annualized Return %", font: { family: "Inter" } },
          grid: { color: "rgba(43, 33, 24, 0.08)" },
          ticks: { callback: v => v + "%" }
        }
      }
    }
  });
}

// Concepts learned: list each concept with the event that taught it and your choice
function renderConceptsLearned() {
  const container = document.getElementById("end-concepts-list");
  if (!container) return;

  // Build per-decision: concept + the choice the player made
  const items = state.decisions.map(d => {
    const event = EVENTS.find(e => e.id === d.event_id);
    if (!event) return null;
    return {
      age: d.age,
      category: event.category,
      concept: event.concept,
      choice: d.choice_label,
      explanation: event.explanation
    };
  }).filter(Boolean);

  // De-dupe by concept (keep first occurrence)
  const seen = new Set();
  const uniqueItems = items.filter(item => {
    if (seen.has(item.concept)) return false;
    seen.add(item.concept);
    return true;
  });

  if (uniqueItems.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--muted);">No concepts learned yet.</p>`;
    return;
  }

  container.innerHTML = uniqueItems.map(item => `
    <div class="concept-item">
      <div class="concept-item-header">
        <span class="concept-item-cat">${item.category}</span>
        <span class="concept-item-age">Age ${item.age}</span>
      </div>
      <h4 class="concept-item-title">${item.concept}</h4>
      <p class="concept-item-choice">Your choice: <em>"${item.choice}"</em></p>
      <p class="concept-item-explain">${item.explanation}</p>
    </div>
  `).join("");
}

function renderEndChart() {
  const ctx = document.getElementById("endChart").getContext("2d");
  const labels = state.history.map(h => h.age);

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Pension (locked)",
          data: state.history.map(h => h.pension || 0),
          borderColor: "#4E9A6A",
          backgroundColor: "rgba(78, 154, 106, 0.4)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          stack: "wealth"
        },
        {
          label: "Investments",
          data: state.history.map(h => h.investments || 0),
          borderColor: "#E37890",
          backgroundColor: "rgba(227, 120, 144, 0.4)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          stack: "wealth"
        },
        {
          label: "Home Equity",
          data: state.history.map(h => h.homeEquity || 0),
          borderColor: "#9C27B0",
          backgroundColor: "rgba(156, 39, 176, 0.4)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          stack: "wealth"
        },
        {
          label: "Cash",
          data: state.history.map(h => h.cash || 0),
          borderColor: "#F4D06F",
          backgroundColor: "rgba(244, 208, 111, 0.5)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          stack: "wealth"
        },
        {
          label: "Net Worth (total)",
          data: state.history.map(h => h.netWorth),
          borderColor: "#2B2118",
          borderWidth: 3,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          pointBackgroundColor: "#2B2118"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { font: { family: "Fraunces, serif", size: 12 }, color: "#2B2118" }
        },
        tooltip: {
          backgroundColor: "#2B2118",
          callbacks: {
            label: ctx => `${ctx.dataset.label}: £${Math.round(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Age" },
          grid: { color: "rgba(43, 33, 24, 0.08)" }
        },
        y: {
          title: { display: true, text: "£" },
          grid: { color: "rgba(43, 33, 24, 0.08)" },
          ticks: { callback: v => "£" + v.toLocaleString() }
        }
      }
    }
  });
}

function renderEndStats() {
  // Calculate interesting derived stats
  const finalNW = netWorth();
  const totalDecisions = state.decisions.length;
  const conceptsLearned = state.concepts_learned.length;
  const totalTrades = (state.trade_history || []).length;
  const totalInterestPaid = computeTotalInterestPaid();
  const peakNetWorth = Math.max(...state.history.map(h => h.netWorth));
  const peakAge = state.history.find(h => h.netWorth === peakNetWorth)?.age || ageYears();

  // Pension contribution lessons
  const pensionFinal = state.pension_balance || 0;
  const investmentsFinal = typeof totalInvestmentValue === "function" ? totalInvestmentValue() : 0;
  const homeEquityFinal = state.is_homeowner ? Math.max(0, (state.house_value || 0) - state.mortgage_principal) : 0;

  // Compound multiplier insight: if you'd stuffed cash under a mattress vs investing
  const startingCash = state.history[0]?.cash || 500;
  const yearsLived = (state.age_quarters - 72) / 4;

  const stats = [
    {
      label: "Peak Net Worth",
      value: money(peakNetWorth),
      sub: `at age ${peakAge}`
    },
    {
      label: "Decisions Made",
      value: totalDecisions.toString(),
      sub: `${conceptsLearned} concepts learned`
    },
    {
      label: "Pension Balance",
      value: money(pensionFinal),
      sub: pensionFinal > 0 ? `from compound growth` : `you didn't enroll — biggest miss`
    },
    {
      label: "Investments",
      value: money(investmentsFinal),
      sub: `${totalTrades} trades made`
    },
    {
      label: "Home Equity",
      value: money(homeEquityFinal),
      sub: state.is_homeowner ? `you bought a place` : `you stayed renting`
    },
    {
      label: "Total Debt Interest Paid",
      value: money(totalInterestPaid),
      sub: `over ${Math.round(yearsLived)} years`
    }
  ];

  // Add pension insight if applicable
  if (pensionFinal > 0 && state.pension_contribution_rate > 0) {
    // Rough estimate of total contributions vs balance shows compound effect
    const yearsContributing = Math.max(1, yearsLived - 2);
    const avgYearlyContribution = state.income_salary * state.pension_contribution_rate * 4 * 2; // rough w/ match
    const estTotalIn = avgYearlyContribution * yearsContributing;
    const compoundGain = pensionFinal - estTotalIn;
    if (compoundGain > 0) {
      stats.push({
        label: "Pension Compound Gain",
        value: money(compoundGain),
        sub: `growth on top of contributions`
      });
    }
  }

  // Render
  document.getElementById("end-stats-grid").innerHTML = stats.map(s => `
    <div class="end-stat">
      <div class="end-stat-label">${s.label}</div>
      <div class="end-stat-value">${s.value}</div>
      <div class="end-stat-sub">${s.sub}</div>
    </div>
  `).join("");
}

function computeTotalInterestPaid() {
  // Rough estimate: sum quarterly interest accrued on debts over the lifetime
  // We don't track this exactly, so we use APR × time × average balance proxy.
  // For credit card and overdraft we can use a conservative estimate.
  // For mortgage we can use payments minus principal paid down.
  let total = 0;
  if (state.is_homeowner || state.mortgage_principal > 0 || state.house_value > 0) {
    // total mortgage interest = total payments to date − principal paid down so far
    const startingPrincipal = (state.house_price || 0) - (state.deposit_required || 0);
    const principalPaid = startingPrincipal - state.mortgage_principal;
    const quartersOfMortgage = Math.max(0, state.quarter - (state.mortgage_start_quarter || 0));
    const totalPaid = state.cost_mortgage * 3 * quartersOfMortgage;
    total += Math.max(0, totalPaid - principalPaid);
  }
  // Rough credit card interest estimate (assume current balance has been there a while)
  total += state.credit_card_debt * 0.3; // crude proxy
  total += state.overdraft_debt * 0.2;
  return Math.round(total);
}


/* =============================================================
   DEBT PAYDOWN MODAL
   Lets the player pay down each debt category from cash.
   Order suggestion: highest APR first (overdraft beyond £500, then CC).
   ============================================================= */
function openDebtPaydownModal() {
  document.getElementById("debt-modal").classList.remove("hidden");
  renderDebtPaydownModal();
}

function closeDebtPaydownModal() {
  document.getElementById("debt-modal").classList.add("hidden");
}

function renderDebtPaydownModal() {
  const cashEl = document.getElementById("debt-cash-display");
  if (cashEl) cashEl.textContent = money(state.cash);

  const list = document.getElementById("debt-paydown-list");
  const debts = [
    { key: "overdraft_debt",   label: "Overdraft",     apr: 0.35, color: "#D9534F", priority: 1 },
    { key: "credit_card_debt", label: "Credit Card",   apr: 0.19, color: "#E37890", priority: 2 },
    { key: "other_debt",       label: "Other / BNPL",  apr: 0.05, color: "#F4D06F", priority: 3 },
    { key: "student_debt",     label: "Student Loan",  apr: 0.06, color: "#7FB3C7", priority: 4 }
  ].filter(d => state[d.key] > 1);

  if (debts.length === 0) {
    list.innerHTML = `
      <div class="debt-empty-card">
        <div class="debt-empty-icon">🎉</div>
        <h3>You're debt-free!</h3>
        <p>Channel that energy into investments. Compounding growth becomes your friend instead of your enemy.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = debts.map(d => {
    const balance = state[d.key];
    const quarterlyCost = balance * (d.apr / 4);
    const canPay = Math.min(state.cash, balance);

    return `
      <div class="debt-paydown-row">
        <div class="debt-paydown-header">
          <div class="debt-paydown-color" style="background: ${d.color};"></div>
          <div class="debt-paydown-label">${d.label}</div>
          <div class="debt-paydown-apr">${(d.apr * 100).toFixed(0)}% APR</div>
        </div>
        <div class="debt-paydown-stats">
          <div class="debt-paydown-stat">
            <span class="debt-paydown-stat-label">Balance</span>
            <span class="debt-paydown-stat-val">${money(balance)}</span>
          </div>
          <div class="debt-paydown-stat">
            <span class="debt-paydown-stat-label">Costing you</span>
            <span class="debt-paydown-stat-val warn">${money(quarterlyCost)}/qtr</span>
          </div>
        </div>
        <div class="debt-paydown-actions">
          <button class="debt-pay-btn" ${canPay < 100 ? "disabled" : ""} onclick="payDownDebt('${d.key}', 100)">£100</button>
          <button class="debt-pay-btn" ${canPay < 500 ? "disabled" : ""} onclick="payDownDebt('${d.key}', 500)">£500</button>
          <button class="debt-pay-btn" ${canPay < 2000 ? "disabled" : ""} onclick="payDownDebt('${d.key}', 2000)">£2,000</button>
          <button class="debt-pay-btn pay-all" ${canPay < 1 ? "disabled" : ""} onclick="payDownDebt('${d.key}', 'all')">Pay max (${money(canPay)})</button>
        </div>
      </div>
    `;
  }).join("");
}

function payDownDebt(debtKey, amount) {
  const balance = state[debtKey];
  let toPay;
  if (amount === "all") {
    toPay = Math.min(state.cash, balance);
  } else {
    toPay = Math.min(amount, state.cash, balance);
  }
  if (toPay < 1) return;
  state.cash -= toPay;
  state[debtKey] -= toPay;
  if (state[debtKey] < 1) state[debtKey] = 0;

  state.log.push({
    age: ageYears(),
    text: `Paid £${Math.round(toPay).toLocaleString()} toward ${debtKey.replace("_debt", "").replace("_", " ")}.`
  });

  renderDebtPaydownModal();
  render();
}
function exportResults() {
  const participantId = prompt("Enter your participant ID (or leave blank):") || "anonymous";
  const feedback = prompt("Any feedback on the experience? (optional)") || "";

  const score = calculateLifeScore();
  const startingSummary = {};
  for (const [k, v] of Object.entries(state.starting_rolls || {})) {
    startingSummary[k] = v.value;
  }

  const results = {
    participant_id: participantId,
    timestamp: new Date().toISOString(),
    starting_conditions: startingSummary,
    final_state: {
      age: ageYears(),
      cash: Math.round(state.cash),
      savings: Math.round(state.savings),
      investments_value: Math.round(totalInvestmentValue()),
      total_debt: Math.round(state.student_debt + state.credit_card_debt + state.other_debt + state.overdraft_debt),
      overdraft_debt: Math.round(state.overdraft_debt),
      net_worth: Math.round(netWorth()),
      happiness: Math.round(state.happiness),
      health: Math.round(state.health),
      relationships: Math.round(state.relationships),
      knowledge: Math.round(state.knowledge),
      life_experiences: state.life_experiences
    },
    life_score: score,
    decisions: state.decisions,
    trade_history: state.trade_history || [],
    concepts_learned: state.concepts_learned,
    quarterly_history: state.history,
    qualitative_feedback: feedback
  };

  const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `results_${participantId}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}


/* =============================================================
   INIT
   ============================================================= */
window.addEventListener("DOMContentLoaded", initSplash);
