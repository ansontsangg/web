/* =============================================================
   INVESTMENT PORTAL
   - Asset class definitions with realistic volatility
   - Quarterly price updates via random walks
   - Modal UI: Portfolio overview + tabs per asset class
   - Auto-contribute unlocks after first manual investment
   ============================================================= */

const ASSETS = {
  savings: {
    id: "savings",
    name: "High-Yield Savings",
    icon: "🏦",
    color: "#4E9A6A",
    description: "FDIC-insured cash account. Boring but safe.",
    annual_return: 0.025,
    quarterly_volatility: 0.00,
    unit_price_start: 1.00,
    risk_label: "None",
    teaches: "Inflation erodes savings — even 'safe' money loses value over time."
  },
  bonds: {
    id: "bonds",
    name: "Government Bonds",
    icon: "📜",
    color: "#7FB3C7",
    description: "Lend money to the government. Steady, low returns.",
    annual_return: 0.04,
    quarterly_volatility: 0.02,
    unit_price_start: 100.00,
    risk_label: "Low",
    teaches: "Bonds are the classic 'safe' investment — but they lose to inflation in bad years."
  },
  sp500: {
    id: "sp500",
    name: "S&P 500 Index",
    icon: "📈",
    color: "#E37890",
    description: "Own a slice of the 500 biggest US companies. Diversified by default.",
    annual_return: 0.07,
    quarterly_volatility: 0.08,
    unit_price_start: 400.00,
    risk_label: "Medium",
    teaches: "Index funds historically beat 80%+ of actively picked stocks over 20+ years."
  },
  stocks: {
    id: "stocks",
    name: "Individual Stocks",
    icon: "🎯",
    color: "#F4D06F",
    description: "Bet on specific companies. High potential, high risk.",
    annual_return: 0.06,
    quarterly_volatility: 0.18,
    unit_price_start: 150.00,
    risk_label: "High",
    teaches: "Single stocks are much riskier than indexes — you're concentrated in one company's fate."
  },
  crypto: {
    id: "crypto",
    name: "Crypto",
    icon: "⚡",
    color: "#B794F4",
    description: "Digital assets. Wildly volatile, speculative.",
    annual_return: 0.15,
    quarterly_volatility: 0.40,
    unit_price_start: 50000.00,
    risk_label: "Extreme",
    teaches: "Crypto can 10x or go to zero. Never invest more than you can afford to lose."
  }
};


/* =============================================================
   PRICE HISTORY INITIALIZATION
   Each asset tracks: current_price, history[], player's units owned
   ============================================================= */
function initInvestmentState() {
  const portfolio = {};
  for (const [id, asset] of Object.entries(ASSETS)) {
    portfolio[id] = {
      units: 0,
      current_price: asset.unit_price_start,
      cost_basis: 0, // total spent buying this asset
      price_history: [asset.unit_price_start],
      auto_contribute: 0 // £ per quarter auto-invested (unlocked after first manual buy)
    };
  }
  return portfolio;
}


/* =============================================================
   QUARTERLY PRICE UPDATE
   Geometric Brownian-ish motion: price * (1 + drift + noise)
   ============================================================= */
function updateAssetPrices() {
  if (!state.portfolio) return;

  for (const [id, asset] of Object.entries(ASSETS)) {
    const holding = state.portfolio[id];
    const drift = asset.annual_return / 4;
    // Normal-ish noise via Box-Muller approximation (sum of 3 uniforms, scaled)
    const noise = ((Math.random() + Math.random() + Math.random()) - 1.5) * asset.quarterly_volatility;
    let newPrice = holding.current_price * (1 + drift + noise);
    // Floor so prices don't go negative or absurdly low (especially crypto)
    newPrice = Math.max(newPrice, asset.unit_price_start * 0.05);
    holding.current_price = newPrice;
    holding.price_history.push(newPrice);

    // Run auto-contributions
    if (holding.auto_contribute > 0 && state.cash >= holding.auto_contribute) {
      executeTrade(id, "buy", holding.auto_contribute, true);
    }
  }
}


/* =============================================================
   TRADE EXECUTION
   ============================================================= */
function executeTrade(assetId, direction, poundAmount, isAuto = false) {
  const holding = state.portfolio[assetId];
  const asset = ASSETS[assetId];

  if (direction === "buy") {
    if (poundAmount > state.cash) {
      if (!isAuto) alert(`Not enough cash. You have ${money(state.cash)}.`);
      return false;
    }
    const units = poundAmount / holding.current_price;
    state.cash -= poundAmount;
    holding.units += units;
    holding.cost_basis += poundAmount;

    if (!state.flag_first_investment) {
      state.flag_first_investment = true;
    }
  } else {
    // Sell
    const currentValue = holding.units * holding.current_price;
    if (poundAmount > currentValue) {
      poundAmount = currentValue; // sell all
    }
    const unitsToSell = poundAmount / holding.current_price;
    holding.units -= unitsToSell;
    state.cash += poundAmount;
    // Reduce cost basis proportionally
    const proportion = (holding.units + unitsToSell) > 0
      ? unitsToSell / (holding.units + unitsToSell)
      : 0;
    holding.cost_basis = Math.max(0, holding.cost_basis * (1 - proportion));
  }

  // Log trade
  state.trade_history = state.trade_history || [];
  state.trade_history.push({
    age: ageYears(),
    quarter: state.quarter,
    asset: assetId,
    direction,
    amount: poundAmount,
    price: holding.current_price,
    auto: isAuto
  });

  return true;
}


/* =============================================================
   PORTFOLIO VALUE HELPERS
   ============================================================= */
function totalInvestmentValue() {
  if (!state.portfolio) return 0;
  return Object.entries(state.portfolio).reduce((sum, [id, h]) => {
    return sum + h.units * h.current_price;
  }, 0);
}

function assetValue(assetId) {
  if (!state.portfolio) return 0;
  const h = state.portfolio[assetId];
  return h.units * h.current_price;
}


/* =============================================================
   MODAL UI
   ============================================================= */
let currentTab = "portfolio";
let miniChart = null;

function openInvestmentModal() {
  // Warn if player is in net-negative cash position. They can still proceed —
  // it's a teaching moment about opportunity cost of investing while in debt.
  const overdraftLevel = state.overdraft_debt || 0;
  const ccDebt = state.credit_card_debt || 0;
  const expensiveDebt = overdraftLevel + ccDebt;

  if (expensiveDebt > 100 && !state._dismissedInvestWarning) {
    showInvestWarningModal(expensiveDebt);
    return;
  }

  reallyOpenInvestmentModal();
}

// Themed warning modal — replaces native confirm()
function showInvestWarningModal(expensiveDebt) {
  const existing = document.getElementById("invest-warning-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "invest-warning-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="warning-modal">
      <div class="warning-modal-icon">⚠️</div>
      <h2 class="warning-modal-title">Hold up</h2>
      <p class="warning-modal-body">
        You currently have <strong>£${Math.round(expensiveDebt).toLocaleString()}</strong>
        in high-interest debt (overdraft + credit cards).
      </p>
      <div class="warning-modal-comparison">
        <div class="warning-row">
          <span class="warning-row-label">Your overdraft accrues</span>
          <span class="warning-row-value warn">35% APR</span>
        </div>
        <div class="warning-row">
          <span class="warning-row-label">Index funds average</span>
          <span class="warning-row-value">~7%</span>
        </div>
        <div class="warning-row warning-row-highlight">
          <span class="warning-row-label">Paying down debt is a guaranteed</span>
          <span class="warning-row-value good">35% return</span>
        </div>
      </div>
      <div class="warning-modal-actions">
        <button class="warning-btn-secondary" onclick="dismissInvestWarning(false)">
          Pay debt instead
        </button>
        <button class="warning-btn-primary" onclick="dismissInvestWarning(true)">
          Invest anyway
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function dismissInvestWarning(proceed) {
  const modal = document.getElementById("invest-warning-modal");
  if (modal) modal.remove();

  if (proceed) {
    state._dismissedInvestWarning = true;
    reallyOpenInvestmentModal();
  } else {
    // Player chose "pay debt instead" — open the debt paydown modal
    if (typeof openDebtPaydownModal === "function") {
      openDebtPaydownModal();
    }
  }
}

function reallyOpenInvestmentModal() {
  // Mark button as clicked so the highlight pulse stops
  state._invest_button_clicked = true;

  const modal = document.getElementById("investment-modal");
  modal.classList.remove("hidden");
  currentTab = "portfolio";
  renderInvestmentModal();
}

function closeInvestmentModal() {
  document.getElementById("investment-modal").classList.add("hidden");
  if (miniChart) {
    miniChart.destroy();
    miniChart = null;
  }
}

function switchTab(tabId) {
  currentTab = tabId;
  renderInvestmentModal();
}

function renderInvestmentModal() {
  const tabs = document.getElementById("inv-tabs");
  const content = document.getElementById("inv-content");

  // Persistent cash display in modal header
  const cashEl = document.getElementById("inv-cash-display");
  if (cashEl) cashEl.textContent = money(state.cash);

  // Tab buttons — Portfolio, then Pension (if active), Mortgage (if active), then asset tabs
  const tabList = [
    { id: "portfolio", label: "Portfolio", icon: "💼" }
  ];
  // Show Pension tab once player has either a contribution rate set OR a balance
  if (state.pension_contribution_rate > 0 || state.pension_balance > 0) {
    tabList.push({ id: "pension", label: "Pension", icon: "🔒" });
  }
  // Show Mortgage tab if player has an active mortgage
  if (state.mortgage_principal > 0 || state.is_homeowner) {
    tabList.push({ id: "mortgage", label: "Mortgage", icon: "🏠" });
  }
  Object.values(ASSETS).forEach(a => {
    tabList.push({ id: a.id, label: a.name, icon: a.icon });
  });

  tabs.innerHTML = tabList.map(t => `
    <button class="inv-tab ${currentTab === t.id ? 'active' : ''}"
            onclick="switchTab('${t.id}')">
      <span class="inv-tab-icon">${t.icon}</span>
      <span>${t.label}</span>
    </button>
  `).join("");

  if (currentTab === "portfolio") {
    content.innerHTML = renderPortfolioTab();
  } else if (currentTab === "pension") {
    content.innerHTML = renderPensionTab();
  } else if (currentTab === "mortgage") {
    content.innerHTML = renderMortgageTab();
  } else {
    content.innerHTML = renderAssetTab(currentTab);
    // Render mini chart for the asset
    setTimeout(() => renderMiniChart(currentTab), 50);
  }
}

function renderMortgageTab() {
  const principal = state.mortgage_principal || 0;
  const monthly = state.cost_mortgage || 0;
  const apr = state.mortgage_apr || 0;
  const houseValue = state.house_value || state.house_price || 0;
  const equity = houseValue - principal;
  const termYears = state.mortgage_term_years || 0;

  // Quarters elapsed since mortgage start, converted back to months and years remaining
  const quartersElapsed = state.quarter - (state.mortgage_start_quarter || 0);
  const monthsElapsed = quartersElapsed * 3;
  const totalMonths = termYears * 12;
  const monthsLeft = Math.max(0, totalMonths - monthsElapsed);
  const yearsLeft = (monthsLeft / 12).toFixed(1);

  // Total remaining interest if we keep paying as scheduled
  const totalRemainingPayments = monthly * monthsLeft;
  const totalRemainingInterest = Math.max(0, totalRemainingPayments - principal);

  if (principal === 0) {
    return `
      <div class="inv-portfolio">
        <div class="inv-hero" style="background: linear-gradient(135deg, #E8F5E9, #FFF8DC);">
          <div class="inv-hero-label">🎉 Mortgage paid off!</div>
          <div class="inv-hero-value">${money(houseValue)}</div>
          <div class="inv-hero-sub">Home value · 100% equity, no debt</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="inv-portfolio">
      <div class="inv-hero" style="background: linear-gradient(135deg, #FCE4EC, #E3F2FD);">
        <div class="inv-hero-label">🏠 Home Equity</div>
        <div class="inv-hero-value">${money(equity)}</div>
        <div class="inv-hero-sub">Home worth ${money(houseValue)} · ${money(principal)} mortgage left</div>
      </div>

      <div class="inv-stats-grid" style="margin-top: 18px;">
        <div class="inv-stat">
          <div class="inv-stat-label">Monthly payment</div>
          <div class="inv-stat-value">${money(monthly)}</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Current rate</div>
          <div class="inv-stat-value">${(apr * 100).toFixed(2)}%</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Years remaining</div>
          <div class="inv-stat-value">${yearsLeft}</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Type</div>
          <div class="inv-stat-value">${state.mortgage_type === "variable" ? "Variable" : "Fixed"}</div>
        </div>
      </div>

      <div style="background: white; border: 2px solid var(--ink); border-radius: 12px; padding: 14px; margin-top: 16px;">
        <div style="font-family: 'Inter'; font-size: 0.85rem; color: var(--ink-soft); margin-bottom: 6px;">Total interest still to pay</div>
        <div style="font-family: 'DM Mono'; font-size: 1.5rem; font-weight: 700; color: var(--danger);">${money(totalRemainingInterest)}</div>
        <div style="font-family: 'Inter'; font-size: 0.78rem; color: var(--ink-soft); margin-top: 4px;">if you stick to the regular schedule</div>
      </div>

      <div style="background: var(--bg-paper); border: 2px solid var(--ink); border-radius: 12px; padding: 14px; margin-top: 16px;">
        <div style="font-family: 'Inter'; font-size: 0.92rem; font-weight: 600; margin-bottom: 10px;">Pay extra against principal</div>
        <div style="font-family: 'Inter'; font-size: 0.82rem; color: var(--ink-soft); margin-bottom: 10px;">
          Every £1 of extra principal saves you the future interest on that £1. The earlier you pay, the more you save.
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="inv-quick-btn" onclick="payMortgageExtra(1000)">£1,000</button>
          <button class="inv-quick-btn" onclick="payMortgageExtra(5000)">£5,000</button>
          <button class="inv-quick-btn" onclick="payMortgageExtra(10000)">£10,000</button>
          <button class="inv-quick-btn pay-all" onclick="payMortgageExtra(${principal})">Pay off entirely (${money(principal)})</button>
        </div>
      </div>

      <div class="inv-teaches" style="margin-top: 18px;">
        <span class="inv-teaches-label">💡 Mortgage payoff math:</span>
        <span>Paying off a 5% mortgage early is equivalent to a guaranteed 5% return — better than bonds, comparable to long-term stocks but risk-free. The only catch: that money becomes locked in your house. Don't pay it off if you don't have a healthy emergency fund first.</span>
      </div>
    </div>
  `;
}

function payMortgageExtra(amount) {
  if (amount > state.cash) {
    alert(`Not enough cash. You have ${money(state.cash)}.`);
    return;
  }
  if (amount > state.mortgage_principal) {
    amount = state.mortgage_principal;
  }
  state.cash -= amount;
  state.mortgage_principal -= amount;

  if (state.mortgage_principal <= 0) {
    state.mortgage_principal = 0;
    state.cost_mortgage = 0;
    state.log.push({ age: ageYears(), text: "🎉 Mortgage paid off in full!" });
  } else {
    // Recalculate monthly payment based on remaining principal & term
    const quartersElapsed = state.quarter - (state.mortgage_start_quarter || 0);
    const remainingMonths = state.mortgage_term_years * 12 - quartersElapsed * 3;
    if (remainingMonths > 0) {
      state.cost_mortgage = mortgageMonthlyPayment(state.mortgage_principal, state.mortgage_apr, remainingMonths / 12);
    }
    state.log.push({ age: ageYears(), text: `Paid £${amount.toLocaleString()} extra against mortgage principal.` });
  }

  renderInvestmentModal();
  render();
}

function renderPensionTab() {
  const balance = state.pension_balance || 0;
  const rate = state.pension_contribution_rate || 0;
  const annualSalary = state.income_salary * 4;
  const yearlyContribution = annualSalary * rate;
  const yearlyMatch = annualSalary * Math.min(rate, 0.05);
  const yearlyTotal = yearlyContribution + yearlyMatch;

  // Project balance at age 65 if contributions and growth continue at current rate
  const yearsToRetirement = Math.max(0, 65 - ageYears());
  let projectedBalance = balance;
  for (let y = 0; y < yearsToRetirement; y++) {
    projectedBalance = projectedBalance * 1.06 + yearlyTotal;
  }

  return `
    <div class="inv-portfolio">
      <div class="inv-hero" style="background: linear-gradient(135deg, #FFF8DC, #E8F5E9);">
        <div class="inv-hero-label">🔒 Pension Balance</div>
        <div class="inv-hero-value">${money(balance)}</div>
        <div class="inv-hero-sub">Locked until retirement · grows at ~6% APR</div>
      </div>

      <div class="inv-stats-grid" style="margin-top: 18px;">
        <div class="inv-stat">
          <div class="inv-stat-label">Your contribution</div>
          <div class="inv-stat-value">${(rate * 100).toFixed(0)}%</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Employer match</div>
          <div class="inv-stat-value positive">${(Math.min(rate, 0.05) * 100).toFixed(0)}%</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Yearly total in</div>
          <div class="inv-stat-value">${money(yearlyTotal)}</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Projected at 65</div>
          <div class="inv-stat-value positive">${money(projectedBalance)}</div>
        </div>
      </div>

      <div class="inv-teaches" style="margin-top: 18px;">
        <span class="inv-teaches-label">💡 Why locked?</span>
        <span>Pensions are tax-advantaged but you can't access them until age 55-57 in the UK.
        That's the trade: lose flexibility, gain tax breaks + employer match + decades of compound growth.
        ${rate === 0
          ? "<br><br><strong>You're not contributing yet.</strong> The pension match event (E008) sets this up — leaving free money on the table is the most expensive 'choice' you can make."
          : ""}</span>
      </div>

      ${balance === 0 ? "" : `
        <div class="inv-allocation" style="margin-top: 18px;">
          <div class="inv-allocation-label">Compound growth visualization</div>
          <p style="font-family: 'Inter'; font-size: 0.85rem; color: var(--ink-soft); line-height: 1.5;">
            At your current contribution, your pension will roughly
            <strong>${balance > 0 && projectedBalance > balance ? (projectedBalance / balance).toFixed(1) + "×" : ""}</strong>
            by the time you retire. Time is the real ingredient — every year you delay starting
            costs you significantly more than the contribution itself.
          </p>
        </div>
      `}
    </div>
  `;
}

function renderPortfolioTab() {
  const total = totalInvestmentValue();
  const pension = state.pension_balance || 0;
  const totalWithPension = total + pension;
  const cashAvailable = state.cash;

  const holdings = Object.entries(state.portfolio)
    .filter(([id, h]) => h.units > 0)
    .map(([id, h]) => {
      const asset = ASSETS[id];
      const value = h.units * h.current_price;
      const pctOfPortfolio = totalWithPension > 0 ? (value / totalWithPension * 100) : 0;
      const pnl = value - h.cost_basis;
      const pnlPct = h.cost_basis > 0 ? (pnl / h.cost_basis * 100) : 0;
      return { id, asset, value, units: h.units, pctOfPortfolio, pnl, pnlPct, price: h.current_price };
    });

  // Pension as a synthetic "holding" for display
  const pensionPct = totalWithPension > 0 ? (pension / totalWithPension * 100) : 0;

  return `
    <div class="inv-portfolio">
      <div class="inv-hero">
        <div class="inv-hero-label">Total Wealth in Investments + Pension</div>
        <div class="inv-hero-value">${money(totalWithPension)}</div>
        <div class="inv-hero-sub">${money(cashAvailable)} cash available · ${money(pension)} locked in pension</div>
      </div>

      ${(holdings.length === 0 && pension === 0) ? `
        <div class="inv-empty">
          <p>You haven't invested in anything yet.</p>
          <p class="inv-empty-sub">Pick an asset tab above to get started. Your first investment unlocks auto-contributions.</p>
        </div>
      ` : `
        <div class="inv-allocation">
          <div class="inv-allocation-label">Allocation</div>
          <div class="inv-allocation-bar">
            ${holdings.map(h => `
              <div class="inv-allocation-seg"
                   style="width: ${h.pctOfPortfolio}%; background: ${h.asset.color};"
                   title="${h.asset.name}: ${h.pctOfPortfolio.toFixed(1)}%"></div>
            `).join("")}
            ${pension > 0 ? `
              <div class="inv-allocation-seg"
                   style="width: ${pensionPct}%; background: #4E9A6A;"
                   title="Pension: ${pensionPct.toFixed(1)}%"></div>
            ` : ""}
          </div>
        </div>

        <div class="inv-holdings">
          ${holdings.map(h => `
            <div class="inv-holding">
              <div class="inv-holding-icon" style="color: ${h.asset.color};">${h.asset.icon}</div>
              <div class="inv-holding-main">
                <div class="inv-holding-name">${h.asset.name}</div>
                <div class="inv-holding-sub">${h.units.toFixed(4)} units @ ${money(h.price)}</div>
              </div>
              <div class="inv-holding-value">
                <div class="inv-holding-amount">${money(h.value)}</div>
                <div class="inv-holding-pnl ${h.pnl >= 0 ? 'positive' : 'negative'}">
                  ${h.pnl >= 0 ? '+' : ''}${money(h.pnl)} (${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(1)}%)
                </div>
              </div>
            </div>
          `).join("")}
          ${pension > 0 ? `
            <div class="inv-holding">
              <div class="inv-holding-icon" style="color: #4E9A6A;">🔒</div>
              <div class="inv-holding-main">
                <div class="inv-holding-name">Pension (locked)</div>
                <div class="inv-holding-sub">Contribution rate: ${((state.pension_contribution_rate || 0) * 100).toFixed(0)}% · Grows at 6% APR</div>
              </div>
              <div class="inv-holding-value">
                <div class="inv-holding-amount">${money(pension)}</div>
                <div class="inv-holding-pnl positive">${pensionPct.toFixed(1)}% of wealth</div>
              </div>
            </div>
          ` : ""}
        </div>
      `}
    </div>
  `;
}

function renderAssetTab(assetId) {
  const asset = ASSETS[assetId];
  const holding = state.portfolio[assetId];
  const value = holding.units * holding.current_price;
  const pnl = value - holding.cost_basis;
  const pnlPct = holding.cost_basis > 0 ? (pnl / holding.cost_basis * 100) : 0;

  const priceFirst = holding.price_history[0];
  const priceNow = holding.current_price;
  const totalReturn = ((priceNow / priceFirst) - 1) * 100;

  const canAutoContribute = state.flag_first_investment;

  return `
    <div class="inv-asset">
      <div class="inv-asset-header">
        <div class="inv-asset-title">
          <span class="inv-asset-icon" style="color: ${asset.color};">${asset.icon}</span>
          <div>
            <h3>${asset.name}</h3>
            <p class="inv-asset-desc">${asset.description}</p>
          </div>
        </div>
        <div class="inv-asset-risk" data-risk="${asset.risk_label.toLowerCase()}">
          ${asset.risk_label} risk
        </div>
      </div>

      <div class="inv-asset-chart">
        <canvas id="inv-mini-chart"></canvas>
      </div>

      <div class="inv-stats-grid">
        <div class="inv-stat">
          <div class="inv-stat-label">Current Price</div>
          <div class="inv-stat-value">${money(priceNow)}</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Lifetime Return</div>
          <div class="inv-stat-value ${totalReturn >= 0 ? 'positive' : 'negative'}">
            ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%
          </div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Your Holdings</div>
          <div class="inv-stat-value">${money(value)}</div>
        </div>
        <div class="inv-stat">
          <div class="inv-stat-label">Your P/L</div>
          <div class="inv-stat-value ${pnl >= 0 ? 'positive' : 'negative'}">
            ${pnl >= 0 ? '+' : ''}${money(pnl)}
          </div>
        </div>
      </div>

      <div class="inv-trade">
        <div class="inv-trade-row">
          <label class="inv-trade-label">Buy with:</label>
          <div class="inv-quick-buttons">
            <button class="inv-quick-btn" onclick="quickBuy('${assetId}', 100)">£100</button>
            <button class="inv-quick-btn" onclick="quickBuy('${assetId}', 500)">£500</button>
            <button class="inv-quick-btn" onclick="quickBuy('${assetId}', 1000)">£1,000</button>
            <div class="inv-custom-amount">
              <span class="inv-custom-prefix">£</span>
              <input type="number" id="custom-amount-${assetId}" class="inv-custom-input"
                     placeholder="Custom" min="1" step="50"
                     onkeydown="if(event.key==='Enter'){submitCustomBuy('${assetId}')}">
              <button class="inv-custom-go" onclick="submitCustomBuy('${assetId}')">Buy</button>
            </div>
          </div>
        </div>
        ${holding.units > 0 ? `
          <div class="inv-trade-row">
            <label class="inv-trade-label">Sell:</label>
            <div class="inv-quick-buttons">
              <button class="inv-quick-btn sell" onclick="quickSell('${assetId}', 0.25)">25%</button>
              <button class="inv-quick-btn sell" onclick="quickSell('${assetId}', 0.5)">50%</button>
              <button class="inv-quick-btn sell" onclick="quickSell('${assetId}', 1.0)">All</button>
            </div>
          </div>
        ` : ''}
        ${canAutoContribute ? `
          <div class="inv-trade-row inv-auto">
            <label class="inv-trade-label">Auto-invest per quarter:</label>
            <div class="inv-auto-controls">
              <input type="number" id="auto-amount-${assetId}" value="${holding.auto_contribute}"
                     min="0" step="50" class="inv-auto-input">
              <button class="inv-quick-btn" onclick="setAutoContribute('${assetId}')">Set</button>
            </div>
          </div>
        ` : `
          <div class="inv-auto-locked">
            🔒 Auto-invest unlocks after your first manual investment
          </div>
        `}
      </div>

      <div class="inv-teaches">
        <span class="inv-teaches-label">💡 Concept:</span>
        <span>${asset.teaches}</span>
      </div>
    </div>
  `;
}

function renderMiniChart(assetId) {
  const canvas = document.getElementById("inv-mini-chart");
  if (!canvas) return;

  if (miniChart) miniChart.destroy();

  const asset = ASSETS[assetId];
  const holding = state.portfolio[assetId];

  miniChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: holding.price_history.map((_, i) => i === 0 ? "Start" : `Q${i}`),
      datasets: [{
        label: asset.name + " price",
        data: holding.price_history,
        borderColor: asset.color,
        backgroundColor: asset.color + "22",
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#2B2118",
          callbacks: {
            label: ctx => money(ctx.raw)
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10, family: "DM Mono" } } },
        y: { grid: { color: "rgba(43,33,24,0.05)" }, ticks: { font: { size: 10, family: "DM Mono" } } }
      }
    }
  });
}

function quickBuy(assetId, amount) {
  if (executeTrade(assetId, "buy", amount)) {
    renderInvestmentModal();
    render();
  }
}

function quickBuyCustom(assetId) {
  // Legacy fallback if anything still calls this
  submitCustomBuy(assetId);
}

function submitCustomBuy(assetId) {
  const input = document.getElementById("custom-amount-" + assetId);
  if (!input) return;
  const amount = parseFloat(input.value);
  if (!amount || amount <= 0) {
    input.focus();
    return;
  }
  if (amount > state.cash) {
    // Brief visual feedback on the input
    input.style.borderColor = "var(--danger)";
    input.style.background = "#FDE0DD";
    setTimeout(() => {
      input.style.borderColor = "";
      input.style.background = "";
    }, 800);
    return;
  }
  if (executeTrade(assetId, "buy", amount)) {
    input.value = "";
    renderInvestmentModal();
    render();
  }
}

function quickSell(assetId, fraction) {
  const value = assetValue(assetId);
  const toSell = value * fraction;
  if (executeTrade(assetId, "sell", toSell)) {
    renderInvestmentModal();
    render();
  }
}

function setAutoContribute(assetId) {
  const input = document.getElementById("auto-amount-" + assetId);
  const amount = parseFloat(input.value) || 0;
  state.portfolio[assetId].auto_contribute = amount;
  renderInvestmentModal();
}
