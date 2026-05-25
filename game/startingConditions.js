/* =============================================================
   STARTING CONDITIONS
   Randomized rolls at game start.

   Two kinds of effects:
   - Additive (delta): `{ cash: 500 }` adds 500 to current value
   - Absolute (set):   `{ set_student_debt: 0 }` forces the value
     Absolute effects are applied AFTER all deltas, so they win.
     This fixes the bug where "parents pay tuition" still left debt.
   ============================================================= */

const STARTING_CONDITIONS = {

  parentalSupport: {
    icon: "👨‍👩‍👧",
    label: "Parental Support",
    options: [
      // monthly_parental_support: paid quarterly (×3) until age 22.
      // College-year support is what keeps the student afloat before a job.
      { weight: 25, value: "none",
        display: "On your own",
        desc: "Your parents can't help you financially. Every pound is yours to earn.",
        effects: { cash: -200, monthly_parental_support: 0 } },
      { weight: 35, value: "partial",
        display: "Partial help — rent covered",
        desc: "Your parents cover your accommodation while you study. £400/month until you graduate.",
        effects: { cash: 500, monthly_parental_support: 400 } },
      { weight: 25, value: "full",
        display: "Full support — rent & tuition",
        desc: "Your parents handle university costs and send you £700/month for living expenses. No student loans.",
        effects: { cash: 800, monthly_parental_support: 700, set_student_debt: 0 } },
      { weight: 15, value: "generous",
        display: "Generous family + allowance",
        desc: "Your family is well-off. £1000/month allowance, no debt, and a real financial cushion.",
        effects: { cash: 2000, monthly_parental_support: 1000, set_student_debt: 0 } },
    ]
  },

  collegePath: {
    icon: "🎓",
    label: "Education Path",
    options: [
      // For loan paths: maintenance loan adds quarterly income until age 22.
      // This reflects how UK maintenance loans actually work — you take on
      // debt but it covers living costs while you study.
      { weight: 10, value: "scholarship_full",
        display: "Full scholarship",
        desc: "Your grades earned you a full ride. No debt, plus a £400/month bursary while studying.",
        effects: { set_student_debt: 0, knowledge: 10, maintenance_loan_quarterly: 1200 } },
      { weight: 20, value: "scholarship_partial",
        display: "Partial scholarship",
        desc: "Some help on tuition (£15k debt) plus a maintenance loan covering basics.",
        effects: { student_debt: 15000, maintenance_loan_quarterly: 1800 } },
      { weight: 40, value: "loans_standard",
        display: "Standard student loans",
        desc: "Tuition + maintenance loans. £2000/quarter to live on, but it all counts as debt.",
        effects: { student_debt: 35000, maintenance_loan_quarterly: 2000 } },
      { weight: 15, value: "loans_heavy",
        display: "Heavy loans — private uni",
        desc: "Private uni tuition is expensive. Bigger maintenance loan to match your higher costs.",
        effects: { student_debt: 60000, maintenance_loan_quarterly: 2500 } },
      { weight: 15, value: "no_college",
        display: "No college — straight to work",
        desc: "You entered the workforce at 18 in a junior role. Lower ceiling, but earning from day one.",
        effects: { set_student_debt: 0, knowledge: 5, income_salary: 4500, has_full_job: true } },
    ]
  },

  parentalFinanceHealth: {
    icon: "💭",
    label: "Family Money Culture",
    options: [
      { weight: 15, value: "heavy_debt",
        display: "Parents in heavy debt",
        desc: "Your parents struggle with money. You grew up anxious about bills and worry about ending up like them.",
        effects: { happiness: -10 } },
      { weight: 35, value: "paycheck_to_paycheck",
        display: "Paycheck to paycheck",
        desc: "Money was always tight growing up. You learned to make do with what you have.",
        effects: { happiness: -5 } },
      { weight: 35, value: "middle_class",
        display: "Comfortable middle class",
        desc: "Stable household with occasional money talks at the dinner table.",
        effects: { knowledge: 5 } },
      { weight: 15, value: "wealthy_savvy",
        display: "Wealthy and money-savvy",
        desc: "Your parents actively taught you about investing and long-term planning.",
        effects: { knowledge: 15, cash: 1000 } },
    ]
  },

  costOfLiving: {
    icon: "📍",
    label: "Where You Live",
    options: [
      { weight: 25, value: "low",
        display: "Low-cost town",
        desc: "Rent is cheap, but opportunities and wages are smaller too.",
        effects: { set_col_multiplier: 0.8 } },
      { weight: 50, value: "average",
        display: "Average UK city",
        desc: "A balanced cost of living. Typical rents, typical wages.",
        effects: { set_col_multiplier: 1.0 } },
      { weight: 25, value: "high",
        display: "Major metro (London)",
        desc: "Expensive as hell, but more job opportunities and higher ceilings.",
        effects: { set_col_multiplier: 1.4 } },
    ]
  },

  health: {
    icon: "🏥",
    label: "Health Status",
    options: [
      { weight: 60, value: "healthy_insured",
        display: "Healthy, on parents' plan",
        desc: "No health worries right now. You're covered until 26.",
        effects: { set_health: 95 } },
      { weight: 25, value: "minor_chronic",
        display: "Minor chronic condition",
        desc: "Manageable but ongoing medical costs — nothing serious, but a reality of your life.",
        effects: { set_health: 75 } },
      { weight: 15, value: "uninsured",
        display: "Uninsured",
        desc: "You have no health coverage. One big medical event could devastate you financially.",
        effects: { set_health: 85, is_uninsured: true } },
    ]
  },

  impulseTendency: {
    icon: "🛍️",
    label: "Your Personality",
    options: [
      { weight: 25, value: "disciplined",
        display: "Disciplined spender",
        desc: "You rarely feel tempted to splurge. Planning comes naturally to you.",
        effects: { knowledge: 5 } },
      { weight: 50, value: "average",
        display: "Average self-control",
        desc: "You have normal temptations. Sometimes you splurge, sometimes you save.",
        effects: {} },
      { weight: 25, value: "impulsive",
        display: "High impulse spender",
        desc: "That new jacket or gadget is always calling your name. Resisting takes effort.",
        effects: { happiness: 5 } },
    ]
  }

};

/* =============================================================
   ROLL LOGIC
   ============================================================= */
function rollStartingConditions() {
  const rolls = {};
  for (const [categoryKey, category] of Object.entries(STARTING_CONDITIONS)) {
    rolls[categoryKey] = weightedPick(category.options);
    rolls[categoryKey].categoryLabel = category.label;
    rolls[categoryKey].icon = category.icon;
  }
  return rolls;
}

function weightedPick(options) {
  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
  let random = Math.random() * totalWeight;
  for (const option of options) {
    random -= option.weight;
    if (random <= 0) return option;
  }
  return options[options.length - 1];
}
