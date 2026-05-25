/* =============================================================
   EVENT LIBRARY
   All events from the design spreadsheet.

   LINKED EVENTS SYSTEM:
   - A choice can set a flag via `effects: { flag_x: true }`
   - An event can require a flag via `requires_flag: "flag_x"`
   - A choice can queue a follow-up event via `queue: ["E007_LONDON"]`
     (queued events trigger on the next quarter, bypassing random selection)
   - Events with `linked_only: true` only appear via queueing, never randomly.

   COST SUB-CATEGORY EFFECTS:
   Effects with keys like `cost_rent`, `cost_subscriptions` update the
   monthly cost breakdown (shown in the distribution chip hover).
   ============================================================= */

const EVENTS = [
  // ---------- EARLY LIFE / COLLEGE (18-22) ----------
  {
    id: "E001",
    category: "College",
    age_min: 18, age_max: 22,
    prompt: "Your friends are going on a spring break trip. Cost: £800.",
    choices: [
      { label: "Go & make memories", effects: { cash: -800, happiness: 15, relationships: 10, life_experiences: 1 } },
      { label: "Stay home, save the money", effects: { savings: 200, happiness: -5, relationships: -5 } }
    ],
    concept: "Opportunity cost",
    explanation: "Every pound spent on experiences is a pound not saved. Both choices have value — the key is being intentional, not automatic."
  },
  {
    id: "E003",
    category: "Saving",
    age_min: 18, age_max: 22,
    prompt: "You got £500 as a birthday gift from your grandparents. What do you do?",
    choices: [
      { label: "Spend it — I deserve it", effects: { cash: -500, happiness: 8, life_experiences: 1 } },
      { label: "Save it all", effects: { savings: 500, happiness: -2 } },
      { label: "Split: 50% save, 50% treat", effects: { cash: -250, savings: 250, happiness: 4, knowledge: 3 } }
    ],
    concept: "Saving vs spending balance",
    explanation: "The 50/50 rule reduces the guilt of saving and the regret of spending. Small habits compound over decades into real wealth."
  },
  {
    id: "E004",
    category: "Work",
    age_min: 18, age_max: 21,
    prompt: "You're tight on cash. Want to pick up a part-time job? Most uni students do — coffee shops, retail, bars.",
    choices: [
      { label: "Coffee shop, 15 hrs/wk", effects: { income_side: 540, happiness: -8, life_experiences: 1, flag_has_partime: true } },
      { label: "Retail, 10 hrs/wk", effects: { income_side: 360, happiness: -5, flag_has_partime: true } },
      { label: "Tutor / freelance, 6 hrs/wk", effects: { income_side: 300, happiness: -2, knowledge: 5, flag_has_partime: true } },
      { label: "Focus on studies", effects: { knowledge: 8 } }
    ],
    concept: "Trading time for money",
    explanation: "Most students earn while studying — it's normal and helps you build a cushion. The cost is real (less time for grades, friends, sleep), but so is the benefit. Tutoring pays similar to coffee work but is less draining."
  },

  // Quick burst-income events for college years to keep the early game moving
  {
    id: "E004B",
    category: "Work",
    age_min: 19, age_max: 22,
    requires_flag: "flag_has_partime",
    prompt: "Your manager offers a few extra weekend shifts. £200 for the weekend, but you'll be wrecked.",
    choices: [
      { label: "Take it — money first", effects: { cash: 200, happiness: -6, health: -3 } },
      { label: "Decline — I need rest", effects: { happiness: 4 } }
    ],
    concept: "Burnout as a hidden cost",
    explanation: "Pulling extra shifts feels productive but health and happiness costs are real. Burnout in your 20s shows up as reduced earnings in your 30s — a long-tail cost most people ignore."
  },

  {
    id: "E004C",
    category: "Work",
    age_min: 18, age_max: 22,
    prompt: "Online tutoring platform offers a flexible side hustle: £25/hr, set your own hours.",
    choices: [
      { label: "Sign up — £400/qtr realistic", effects: { income_side: 400, happiness: -2, knowledge: 5 } },
      { label: "Already too busy", effects: {} }
    ],
    concept: "Skill-based income",
    explanation: "Skilled side income (tutoring, freelance writing, design) pays more per hour than service work and grows your career. Worth more than a coffee shop hour-for-hour."
  },
  {
    id: "E005",
    category: "Impulse",
    age_min: 19, age_max: 25,
    prompt: "It's 11pm. A £60 jacket pops up with 'only 2 left!' Klarna offers '4 payments of £15'.",
    choices: [
      { label: "Use Klarna — no pain", effects: { other_debt: 60, happiness: 5, knowledge: 2 } },
      { label: "Pay in full now", effects: { cash: -60, happiness: 3 } },
      { label: "Walk away", effects: { happiness: -1, knowledge: 4 } }
    ],
    concept: "BNPL psychology (Thaler's Nudge)",
    explanation: "BNPL services split pain into smaller pieces so your brain doesn't register the real cost. The £60 you 'didn't feel' still comes out of your bank account. Repeat enough times and it adds up."
  },

  // ---------- EARLY CAREER (22-28) ----------
  {
    id: "E006",
    category: "Career",
    age_min: 21, age_max: 24,
    prompt: "🎓 You've graduated! Maintenance loans and parental support stop now. Time to choose a real job — and where to live.",
    choices: [
      {
        label: "Hometown £28k",
        effects: { income_salary: 7000, happiness: 5, flag_chose_hometown: true, has_full_job: true },
        queue: ["E007_HOMETOWN"],
        chain: true
      },
      {
        label: "London £36k",
        effects: { income_salary: 9000, flag_chose_london: true, has_full_job: true },
        queue: ["E007_LONDON"],
        chain: true
      },
      {
        label: "Keep searching",
        effects: { happiness: -5, knowledge: 2 }
      }
    ],
    concept: "Graduation: the income cliff",
    explanation: "The day you graduate, three things change at once: no more maintenance loan, no more parental support, AND your debt repayments start. Many graduates don't budget for this transition and overdraft hard in their first 6 months. We'll move straight to housing next."
  },

  // Housing — HOMETOWN variant (normal rent, queued after hometown job)
  {
    id: "E007_HOMETOWN",
    category: "Housing",
    age_min: 21, age_max: 30,
    linked_only: true,
    excludes_flag: "is_homeowner",
    prompt: "Now you've got a job in your hometown — time to find a place to live.",
    choices: [
      { label: "Shared flat", effects: { set_cost_rent: 400, happiness: -3, flag_had_housing_event: true } },
      { label: "Solo apartment", effects: { set_cost_rent: 800, happiness: 8, flag_had_housing_event: true } },
      { label: "Stay with parents", effects: { set_cost_rent: 100, happiness: -5, relationships: 5, flag_had_housing_event: true } }
    ],
    concept: "Housing & savings tradeoff",
    explanation: "Housing is typically 30%+ of your spending. £500/month saved = £6000/year = £60k over a decade, not counting compound growth."
  },

  // Housing — LONDON variant (brutal rent, queued after London job)
  {
    id: "E007_LONDON",
    category: "Housing",
    age_min: 21, age_max: 30,
    linked_only: true,
    excludes_flag: "is_homeowner",
    prompt: "London rent is brutal. Welcome to the real cost of your new £36k salary.",
    choices: [
      { label: "House-share in Zone 3", effects: { set_cost_rent: 850, happiness: -5, flag_had_housing_event: true } },
      { label: "Flat share in Zone 2", effects: { set_cost_rent: 1200, happiness: 3, flag_had_housing_event: true } },
      { label: "Studio in Zone 1", effects: { set_cost_rent: 1800, happiness: 10, flag_had_housing_event: true } }
    ],
    concept: "Cost of living eats wages",
    explanation: "A £1200 London flat share costs the same as a £400 hometown room — your £8k salary bump just evaporated. 'Take-home after rent' is what actually matters."
  },

  // Generic housing fallback — fires if player never took a job event
  {
    id: "E007",
    category: "Housing",
    age_min: 22, age_max: 26,
    excludes_flag: "flag_had_housing_event",
    prompt: "It's time to move out. Where will you live?",
    choices: [
      { label: "Cheap shared flat", effects: { set_cost_rent: 400, happiness: -3, flag_had_housing_event: true } },
      { label: "Nice solo apartment", effects: { set_cost_rent: 900, happiness: 8, flag_had_housing_event: true } },
      { label: "Stay with parents", effects: { set_cost_rent: 100, happiness: -5, relationships: 5, flag_had_housing_event: true } }
    ],
    concept: "Housing & savings tradeoff",
    explanation: "Housing is typically 30%+ of your spending. £500/month saved = £6000/year = £60k over a decade, not counting compound growth."
  },

  {
    id: "E008",
    category: "Retirement",
    age_min: 22, age_max: 28,
    requires_flag: "has_full_job",
    prompt: "Your employer offers a pension match: you contribute, they match up to 5%. This becomes ongoing — every quarter forever.",
    choices: [
      { label: "Yes — match max (5%)", effects: { pension_contribution_rate_set: 0.05, knowledge: 10, happiness: 2 } },
      { label: "Skip — I need the cash", effects: { happiness: 2 } },
      { label: "Minimum (3%)", effects: { pension_contribution_rate_set: 0.03, knowledge: 5 } }
    ],
    concept: "Employer pension match",
    explanation: "An employer match is a 100% instant return — the best deal in personal finance. Each quarter, your contribution comes out of cash, your employer's match goes straight into your locked pension. Watch it compound for decades. View it under 'Pension' tab in Investments."
  },

  // ---------- ESTABLISHMENT (23-35) ----------
  {
    id: "E009",
    category: "Lifestyle",
    age_min: 23, age_max: 30,
    prompt: "All your friends have new cars. Yours runs fine but looks old.",
    choices: [
      { label: "Finance a £25k new car", effects: { cash: -3000, other_debt: 22000, happiness: 8, set_cost_transport: 200, has_financed_car: true } },
      { label: "Buy a reliable £5k used", effects: { cash: -5000, happiness: 3, set_cost_transport: 50, has_used_car: true } },
      { label: "Keep current car", effects: { happiness: -4, relationships: -2, knowledge: 4 } }
    ],
    concept: "Lifestyle inflation",
    explanation: "As income rises, social pressure rises faster. The 'keep up with friends' tax costs more than the car — it compounds into a lifestyle you can't step back from."
  },

  // Follow-up: only fires if you took a used car. Cars need repairs.
  {
    id: "E009B",
    category: "Lifestyle",
    age_min: 25, age_max: 35,
    requires_flag: "has_used_car",
    prompt: "Your used car needs repairs. The mechanic quotes £1,200.",
    choices: [
      { label: "Pay for the repair", effects: { cash: -1200, knowledge: 3 } },
      { label: "Put it on credit card", effects: { credit_card_debt: 1200, happiness: -3 } },
      { label: "Sell it, switch to public transport", effects: { cash: 1500, set_cost_transport: 30, has_used_car: false, knowledge: 5 } }
    ],
    concept: "True cost of car ownership",
    explanation: "Cars cost roughly 10-15% of their purchase price per year in maintenance, insurance, and depreciation. The 'cheap' used car has hidden costs."
  },
  {
    id: "E010",
    category: "Emergency",
    age_min: 22, age_max: 65,
    prompt: "Your laptop just died. You need one for work.",
    choices: [
      { label: "Pay £1500 cash", effects: { cash: -1500 } },
      { label: "Finance 12 months no-interest", effects: { other_debt: 1500 } },
      { label: "Buy refurbished for £600", effects: { cash: -600, knowledge: 3 } }
    ],
    concept: "Emergency fund importance",
    explanation: "A 3-6 month emergency fund means you pay cash, not credit, for life's surprises. No emergency fund turns every small problem into debt."
  },
  {
    id: "E011",
    category: "Investing",
    age_min: 19, age_max: 28,
    prompt: "A friend mentions they've started investing through an app. Want to learn how?",
    choices: [
      {
        label: "Open an investment account",
        effects: { has_investment_account: true, knowledge: 8 }
      },
      {
        label: "Not interested right now",
        effects: { knowledge: 2 }
      }
    ],
    concept: "Getting started with investing",
    explanation: "The hardest part of investing is starting. Opening an account takes 10 minutes. Look for the pulsing Invest button on the left — that's where you'll manage your portfolio from now on. Even small regular contributions compound into serious wealth over decades."
  },

  // ---------- MIDLIFE (25-45) ----------
  // Step 1 of mortgage flow: pick a house. Sets house_price and chains
  // immediately into the mortgage decision (E012_MORTGAGE) on the same turn.
  {
    id: "E012",
    category: "Housing",
    age_min: 25, age_max: 40,
    excludes_flag: "is_homeowner",
    excludes_flags: ["has_bankruptcy"],
    prompt: "You're ready to buy your first home. Which type of property?",
    choices: [
      {
        label: "Modest 2-bed (£200k)",
        effects: { house_price: 200000, deposit_required: 20000 },
        queue: ["E012_MORTGAGE"],
        chain: true
      },
      {
        label: "Family home (£350k)",
        effects: { house_price: 350000, deposit_required: 35000 },
        queue: ["E012_MORTGAGE"],
        chain: true
      },
      {
        label: "Stretch buy (£500k)",
        effects: { house_price: 500000, deposit_required: 50000 },
        queue: ["E012_MORTGAGE"],
        chain: true
      },
      {
        label: "Keep renting for now",
        effects: { knowledge: 3 }
      }
    ],
    concept: "How much house can you afford?",
    explanation: "Lenders typically allow 4-4.5× annual income. A bigger house costs more upfront AND ongoing — bigger mortgage, more maintenance, higher utilities, more council tax."
  },

  // Step 2: mortgage decision — uses house_price set by E012, computes real
  // monthly payments via amortization. Special apply_consequences logic in
  // game.js handles the actual mortgage stat setup.
  {
    id: "E012_MORTGAGE",
    category: "Housing",
    age_min: 25, age_max: 40,
    linked_only: true,
    prompt: "Now choose your mortgage. The market base rate is currently around 4.5%.",
    choices: [
      {
        label: "25yr fixed",
        effects: { set_cost_rent: 0, is_homeowner: true, happiness: 8, knowledge: 6 }
      },
      {
        label: "30yr fixed",
        effects: { set_cost_rent: 0, is_homeowner: true, happiness: 8, knowledge: 6 }
      },
      {
        label: "30yr variable (MMR + 1.5%)",
        effects: { set_cost_rent: 0, is_homeowner: true, happiness: 5, knowledge: 8 }
      }
    ],
    concept: "Fixed vs Variable mortgages",
    explanation: "MMR (Mortgage Market Rate) tracks the central bank rate. Variable mortgages re-price quarterly — they're cheaper when rates are low but become brutal if rates rise. Fixed locks your payment for the term."
  },
  {
    id: "E013",
    category: "Family",
    age_min: 25, age_max: 40,
    excludes_flag: "is_married",
    prompt: "Your partner wants to get married. Wedding options:",
    choices: [
      { label: "Dream wedding £25k", effects: { cash: -25000, happiness: 15, relationships: 20, life_experiences: 1, is_married: true } },
      { label: "Modest wedding £5k", effects: { cash: -5000, happiness: 8, relationships: 15, life_experiences: 1, is_married: true } },
      { label: "Courthouse + honeymoon", effects: { cash: -1500, happiness: 10, relationships: 10, life_experiences: 1, is_married: true } },
      { label: "Decline — not ready", effects: { happiness: -5, relationships: -10 } }
    ],
    concept: "Spending on life events",
    explanation: "Weddings are one day. Marriages are forever. £20k saved and invested now = ~£100k in 25 years. No right answer — but know the tradeoff."
  },
  {
    id: "E014",
    category: "Emergency",
    age_min: 28, age_max: 65,
    requires_flag: "has_full_job",
    excludes_flag: "is_unemployed",
    prompt: "Restructuring at your company. Your role is being eliminated — you have 2 weeks left. Your salary stops; your costs don't.",
    choices: [
      {
        // No immediate cash penalty — running costs naturally drain savings via the cost system.
        label: "Live off savings while job hunting",
        effects: { knowledge: 5, set_income_salary: 0, is_unemployed: true, has_full_job: false, lost_job_at: 0 },
        queue: ["E014_JOBSEARCH"]
      },
      {
        // Player floats costs on credit instead of savings — adds ongoing CC debt risk
        label: "Float costs on credit cards",
        effects: { happiness: -5, set_income_salary: 0, is_unemployed: true, has_full_job: false, lost_job_at: 0, flag_using_cc_during_unemployment: true },
        queue: ["E014_JOBSEARCH"]
      },
      {
        // Family helps with rent/food — soft cost but big relationship hit
        label: "Move home with family",
        effects: { relationships: -10, happiness: -8, set_income_salary: 0, is_unemployed: true, has_full_job: false, lost_job_at: 0, flag_back_with_family: true, set_cost_rent: 100 },
        queue: ["E014_JOBSEARCH"]
      }
    ],
    concept: "What happens when income stops",
    explanation: "Losing your job doesn't reduce your costs — rent, groceries, utilities, debt payments all continue. Without savings, you turn to credit (which compounds), or family (which strains relationships). The 'cheapest' option in pounds (moving home) often costs the most in autonomy and dignity. This is why an emergency fund matters."
  },

  {
    id: "E014_JOBSEARCH",
    category: "Career",
    age_min: 25, age_max: 65,
    linked_only: true,
    prompt: "It's been a few months. The job market is tight. Three offers come in — none are exciting.",
    choices: [
      {
        label: "Lateral move — same field, slight pay cut",
        effects: { income_salary_set_relative: -800, happiness: -2, is_unemployed: false, has_full_job: true, flag_using_cc_during_unemployment: false, flag_back_with_family: false }
      },
      {
        label: "Pivot to new industry — bigger pay cut, fresh start",
        effects: { income_salary_set_relative: -1500, happiness: 5, knowledge: 8, is_unemployed: false, has_full_job: true, flag_using_cc_during_unemployment: false, flag_back_with_family: false }
      },
      {
        label: "Take a contract role at last salary",
        effects: { income_salary_set_relative: 0, happiness: -3, knowledge: 5, is_unemployed: false, has_full_job: true, flag_contract_role: true, flag_using_cc_during_unemployment: false, flag_back_with_family: false }
      }
    ],
    concept: "Recovery after redundancy",
    explanation: "After a job loss, returning to the same salary often takes 1-2 years. Most people end up taking a step back to step forward — that's normal, not failure."
  },
  {
    id: "E015",
    category: "Health",
    age_min: 30, age_max: 65,
    requires_flag: "is_uninsured",
    excludes_flag: "has_bankruptcy",
    prompt: "Medical emergency. You're uninsured. Bill: £15,000.",
    choices: [
      { label: "Pay cash", effects: { cash: -15000 } },
      { label: "Payment plan 24 months", effects: { other_debt: 15000, happiness: -8, cost_other: 100 } },
      // Bankruptcy: wipes unsecured debt but flag locks player out of credit for years
      { label: "Declare bankruptcy",
        effects: { happiness: -20, knowledge: 10,
                   set_credit_card_debt: 0, set_other_debt: 0, set_overdraft_debt: 0,
                   has_bankruptcy: true } }
    ],
    concept: "Insurance value",
    explanation: "Insurance is boring until it's the only thing standing between you and financial ruin. Bankruptcy wipes most debt — but it locks you out of credit, mortgages, and many jobs for 6+ years."
  },

  // ---------- LATER LIFE (35-65) ----------
  {
    id: "E016",
    category: "Investing",
    age_min: 35, age_max: 55,
    requires_flag: "has_investment_account",
    prompt: "Market shock! Stocks down 30%, crypto down 60%. But your bonds are up 8% — money is fleeing equities for safety.",
    choices: [
      { label: "Panic sell everything", effects: { flag_panic_sold: true, knowledge: 10 } },
      { label: "Hold and wait", effects: { knowledge: 8 } },
      { label: "Buy more at low prices", effects: { cash: -10000, flag_bought_dip: true, knowledge: 12 } }
    ],
    concept: "Flight to quality & diversification",
    explanation: "When stocks crash, money often flows into bonds — they move inversely. This is why diversification matters: a portfolio of just stocks loses everything in a crash, but a mix of stocks AND bonds softens the blow because they're partially uncorrelated."
  },
  {
    id: "E017",
    category: "Career",
    age_min: 40, age_max: 55,
    requires_flag: "has_full_job",
    prompt: "Midlife career crossroads. A scrappy startup wants to recruit you — pay cut, but a £80,000 equity grant vesting over 4 years.",
    choices: [
      { label: "Stay safe at current job", effects: { knowledge: 3, happiness: -3 } },
      { label: "Join startup", effects: { income_salary: -2500, knowledge: 8, happiness: 5, grant_equity_80k: true } },
      { label: "Negotiate remote at current job", effects: { happiness: 8, income_salary: 500 } }
    ],
    concept: "Risk-adjusted returns & equity comp",
    explanation: "Equity grants vest over time — typically 4 years with a 1-year cliff. The 'value' on paper is theoretical: 80% of startup grants end up worth zero, but the 20% that hit can be life-changing. Look at the income breakdown each quarter to track vesting."
  },
  {
    id: "E018",
    category: "Family",
    age_min: 30, age_max: 45,
    requires_flag: "is_married",
    excludes_flag: "has_kids",
    prompt: "You and your partner are talking about kids. The costs are real — about £230k over 18 years.",
    choices: [
      { label: "Private schooling plan",
        effects: { cash: -8000, happiness: 10, life_experiences: 1, cost_other: 400, has_kids: true } },
      { label: "Public schools + save for uni",
        effects: { cash: -3000, happiness: 8, life_experiences: 1, cost_other: 200, has_kids: true } },
      { label: "Childfree decision",
        effects: { happiness: 3, relationships: -5, flag_childfree: true } }
    ],
    concept: "Cost of children",
    explanation: "Children are one of life's biggest financial decisions — roughly £230k over 18 years in the UK. No right answer, but plan ahead either way. Childcare costs hit hardest in the first 5 years."
  },
  {
    id: "E019",
    category: "Retirement",
    age_min: 50, age_max: 60,
    // Only fires if pension is actually behind: < 5x annual income at age 50
    // (rule of thumb: should have 6-7x by 50, 10x by 60)
    requires_condition: "behind_on_retirement",
    prompt: "Retirement check-in. Your pension and investments are well below the rule-of-thumb for your age (you should have 5-7× annual salary by 50). Time to course-correct.",
    choices: [
      {
        label: "Aggressive catch-up — boost pension to 15%",
        effects: { pension_contribution_rate_set: 0.15, happiness: -5, knowledge: 8 }
      },
      {
        label: "Plan to work until 70",
        effects: { happiness: -3, knowledge: 5, plan_work_until_70: true }
      },
      {
        label: "Downsize home, free up capital",
        effects: { downsize_home: true, happiness: -8, knowledge: 6 }
      }
    ],
    concept: "Retirement math (4% rule)",
    explanation: "The 4% rule: you need ~25× your annual expenses invested to retire safely. At 50 you've lost most of compound interest's runway, so options narrow to: save more (less life now), work longer (less retirement), or spend less (smaller lifestyle). There's no easy fourth option."
  },
  {
    id: "E020",
    category: "Behavioral",
    age_min: 18, age_max: 65,
    prompt: "You see a £60 item you don't need. 'Subscribe & save 20%' pops up — £48 every month.",
    choices: [
      { label: "Subscribe (it's a deal!)", effects: { cash: -48, happiness: 3, cost_subscriptions: 48 } },
      { label: "Buy once at £60", effects: { cash: -60, happiness: 3 } },
      { label: "Skip it entirely", effects: { happiness: -1, knowledge: 4 } }
    ],
    concept: "Subscription creep",
    explanation: "Subscriptions exploit the fact you'll never notice the recurring charge. £48/month = £576/year. That 'deal' becomes more expensive than the one-time purchase within 2 months."
  },

  // ---------- SALARY PROGRESSION (the missing piece) ----------
  // These fire periodically once employed. Without them, salary is fixed forever
  // and the player can never out-earn their debt.

  {
    id: "E020B",
    category: "Career",
    age_min: 24, age_max: 32,
    requires_flag: "has_full_job",
    excludes_flag: "has_postgrad",
    prompt: "Master's / postgrad opportunity. Realistic UK tuition is £14-30k+ depending on field, plus living costs while you study.",
    choices: [
      {
        label: "Full-time MSc (£32k loan, quit job)",
        effects: { student_debt: 32000, set_income_salary: 0, has_postgrad: true, knowledge: 15, happiness: 3, flag_doing_msc_full: true },
        queue: ["E020B_RETURN"]
      },
      {
        label: "Part-time MSc (£18k tuition, keep job)",
        // Part-time costs ~half. Keeps job. Doesn't auto-boost salary —
        // any salary lift comes via E020B_RETURN below.
        effects: { cash: -3000, student_debt: 15000, has_postgrad: true, knowledge: 10, happiness: -5, flag_doing_msc_part: true },
        queue: ["E020B_RETURN_PT"]
      },
      {
        label: "Skip — career experience is enough",
        effects: { knowledge: 2 }
      }
    ],
    concept: "Education ROI",
    explanation: "A targeted MSc (data, finance, healthcare, engineering) can add £8-15k/year to lifetime earnings. Many MScs don't pay off — ROI depends entirely on the field and the school. Full-time is faster but costs more in lost wages; part-time is slower and harder but you keep your salary."
  },
  // After full-time MSc: real return-to-workforce event
  {
    id: "E020B_RETURN",
    category: "Career",
    age_min: 25, age_max: 35,
    linked_only: true,
    prompt: "MSc completed. Job market reality check — your degree opens doors but doesn't guarantee outcomes.",
    choices: [
      { label: "Senior role at top firm", effects: { income_salary_set_relative: 3500, has_full_job: true, happiness: 12, knowledge: 5 } },
      { label: "Specialist role with good benefits", effects: { income_salary_set_relative: 2000, has_full_job: true, happiness: 8 } },
      { label: "Take time to find the right fit (3 months)", effects: { income_salary_set_relative: 1000, has_full_job: true, happiness: 3 } }
    ],
    concept: "MSc payoff (full-time)",
    explanation: "A relevant master's typically lifts your starting salary by 15-30% in your field. The two years of lost earnings + tuition need to be recovered — usually takes 4-7 years post-graduation."
  },
  // After part-time MSc: smaller bumps, since you didn't pause earning
  {
    id: "E020B_RETURN_PT",
    category: "Career",
    age_min: 26, age_max: 36,
    linked_only: true,
    prompt: "You finished your part-time MSc. Time to leverage the new credentials.",
    choices: [
      { label: "Internal promotion based on new skills", effects: { income_salary: 1500, happiness: 8, knowledge: 5 } },
      { label: "Switch to a competitor for a bump", effects: { income_salary: 2500, happiness: 5, knowledge: 6 } },
      { label: "Stay put — credentials are their own reward", effects: { income_salary: 400, happiness: 2 } }
    ],
    concept: "Part-time MSc payoff",
    explanation: "Part-time MScs often yield smaller salary bumps because you've kept earning during the program — the wage gap to fill is narrower. The win is usually unlocking new roles or industries you couldn't reach before."
  },

  {
    id: "E021",
    category: "Career",
    age_min: 24, age_max: 28,
    requires_flag: "has_full_job",
    excludes_flag: "is_unemployed",
    prompt: "After two solid years, your manager wants to discuss your role.",
    choices: [
      { label: "Ask for a raise (15%)", effects: { income_salary: 1500, happiness: 8, knowledge: 5 } },
      { label: "Push for a promotion", effects: { income_salary: 2200, happiness: 10, knowledge: 8 } },
      { label: "Keep your head down", effects: { happiness: -3 } }
    ],
    concept: "Negotiating raises",
    explanation: "Most career income growth comes from job changes and negotiated raises, not annual cost-of-living adjustments. Asking is uncomfortable but it's the single highest-paid hour of your year."
  },

  {
    id: "E022",
    category: "Career",
    age_min: 27, age_max: 32,
    requires_flag: "has_full_job",
    excludes_flag: "is_unemployed",
    prompt: "A recruiter reaches out. Another company offers you 25% more.",
    choices: [
      { label: "Take the new job", effects: { income_salary: 2500, happiness: 5, knowledge: 6 } },
      { label: "Use it as leverage at current job", effects: { income_salary: 1800, happiness: 8, relationships: -3 } },
      { label: "Stay put — too risky", effects: { happiness: -2, knowledge: 2 } }
    ],
    concept: "Job-hopping for raises",
    explanation: "Switching jobs typically yields 10-25% raises vs 3-5% for staying. Loyalty rarely pays — but constant job-hopping has its own costs (no equity, no expertise compounding)."
  },

  {
    id: "E023",
    category: "Career",
    age_min: 30, age_max: 40,
    requires_flag: "has_full_job",
    excludes_flag: "is_unemployed",
    prompt: "Mid-career inflection point — you've been at it long enough to make a serious move.",
    choices: [
      { label: "Senior promotion (40% bump)", effects: { income_salary: 4000, happiness: 12, knowledge: 8 } },
      { label: "Lateral to better company", effects: { income_salary: 2500, happiness: 6, knowledge: 10 } },
      { label: "Stay where you are", effects: { income_salary: 800, happiness: -5 } }
    ],
    concept: "Career compounding",
    explanation: "Income growth in your 30s sets the trajectory for the rest of your career. A 40% raise at 32 compounds for 30+ years — it's worth way more than the same raise at 55."
  },

  {
    id: "E024",
    category: "Career",
    age_min: 35, age_max: 50,
    requires_flag: "has_full_job",
    excludes_flag: "is_unemployed",
    prompt: "Year-end performance review. Your numbers were strong.",
    choices: [
      { label: "Negotiate hard", effects: { income_salary: 1800, happiness: 5, knowledge: 5 } },
      { label: "Accept the standard 4%", effects: { income_salary: 600, happiness: 0 } },
      { label: "Skip the review entirely", effects: { happiness: -8, income_salary: 200 } }
    ],
    concept: "Annual raise compounding",
    explanation: "A 4% raise vs an 8% raise feels small in any single year. Over 20 years it's the difference between £80k and £210k annual income. Negotiate every single year."
  },

  // ---------- WEALTH EVENTS (rare positive lottery-like) ----------
  // These are the "ridiculously rich" moments. Low probability, big impact.

  {
    id: "E025",
    category: "Bonus",
    age_min: 28, age_max: 50,
    requires_flag: "has_full_job",
    excludes_flag: "is_unemployed",
    prompt: "Year-end bonus time. Your team crushed targets.",
    choices: [
      { label: "Bank it all", effects: { cash: 8000, happiness: 5 } },
      { label: "Invest most, treat yourself", effects: { cash: 6000, happiness: 12, life_experiences: 1 } },
      { label: "Lifestyle upgrade — new car!", effects: { cash: -2000, happiness: 18, set_cost_transport: 150, life_experiences: 1 } }
    ],
    concept: "Windfall psychology",
    explanation: "Lump sums get spent more easily than steady income (the 'house money effect'). The boring move — banking or investing — usually wins long-term."
  },

  {
    id: "E026",
    category: "Family",
    age_min: 35, age_max: 60,
    prompt: "A close relative passes away. You're not in the will, but you're expected to contribute to funeral costs, host the family, and travel for the service.",
    choices: [
      { label: "Cover full share of funeral + travel", effects: { cash: -3500, happiness: -10, relationships: 8, knowledge: 4 } },
      { label: "Contribute to funeral, skip travel", effects: { cash: -1500, happiness: -8, relationships: -5, knowledge: 4 } },
      { label: "Send flowers, attend the service only", effects: { cash: -300, happiness: -12, relationships: -10 } }
    ],
    concept: "The hidden cost of family",
    explanation: "Death isn't a financial windfall for most people — it's a cost. Funeral attendance, time off work, hosting relatives, and contributing to expenses can run £1-5k. These are real budget items that emergency funds need to cover, just like medical surprises."
  },

  {
    id: "E027",
    category: "Bonus",
    age_min: 30, age_max: 55,
    requires_flag: "has_full_job",
    excludes_flag: "is_unemployed",
    prompt: "Your company gives stock options. They've vested. Worth £35,000 if you sell now.",
    choices: [
      { label: "Sell all — secure the win", effects: { cash: 35000, happiness: 10, knowledge: 8 } },
      { label: "Hold half, sell half", effects: { cash: 17500, happiness: 6, knowledge: 6, flag_has_company_stock: true } },
      { label: "Hold all — maximum upside", effects: { happiness: 3, knowledge: 4, flag_has_company_stock: true } }
    ],
    concept: "Concentration risk",
    explanation: "Holding lots of company stock means your job AND your wealth depend on the same company. If it tanks, you lose both. Most financial advisors suggest selling vested equity immediately."
  },

  {
    id: "E028",
    category: "Bonus",
    age_min: 25, age_max: 45,
    prompt: "Side project that started as a hobby gets traction. Someone offers £15k for it.",
    choices: [
      { label: "Sell — take the cash", effects: { cash: 15000, happiness: 12, life_experiences: 1 } },
      { label: "Keep building it", effects: { income_side: 800, happiness: 5, knowledge: 8 } },
      { label: "Decline both, refocus on day job", effects: { happiness: -3, knowledge: 3 } }
    ],
    concept: "Optionality vs cash now",
    explanation: "A bird in the hand is worth two in the bush — but a side income that grows can vastly outperform a one-time payout. There's no right answer; it depends on your risk appetite and runway."
  },

  // ---------- LATE-CAREER WEALTH ----------
  {
    id: "E029",
    category: "Career",
    age_min: 45, age_max: 60,
    requires_flag: "has_full_job",
    excludes_flag: "is_unemployed",
    prompt: "Executive role opens up. Major step. £50k more, but 60-hour weeks.",
    choices: [
      { label: "Take it", effects: { income_salary: 12500, happiness: -5, health: -8, relationships: -10 } },
      { label: "Decline politely", effects: { happiness: 5 } },
      { label: "Negotiate part-time exec role", effects: { income_salary: 7500, happiness: 8, knowledge: 10 } }
    ],
    concept: "Diminishing returns on income",
    explanation: "After ~£75k, additional income stops meaningfully buying happiness — but does buy stress, time poverty, and health costs. 'How much is enough?' is one of the most important financial questions."
  },

  // ---------- LATE-LIFE HAPPINESS EVENTS ----------
  // These offset the -2/qtr happiness decay once players have means.
  // They're also genuinely realistic — once you have money, life starts
  // offering more meaningful tradeoffs around how to spend it.

  {
    id: "E030",
    category: "Family",
    age_min: 32, age_max: 42,
    requires_flag: "has_kids",
    prompt: "Your partner brings up having another child. The first one is going well.",
    choices: [
      { label: "Yes — go for it", effects: { cash: -3000, happiness: 18, relationships: 12, life_experiences: 1, cost_other: 200 } },
      { label: "Wait a few more years", effects: { happiness: 2, relationships: -3 } },
      { label: "We're done at one", effects: { happiness: 5, relationships: -8 } }
    ],
    concept: "Life decisions vs financial optimization",
    explanation: "Children are emotionally meaningful and financially expensive. There's no spreadsheet that 'solves' this — it's a values decision that costs money either way."
  },

  {
    id: "E031",
    category: "Lifestyle",
    age_min: 30, age_max: 50,
    prompt: "Friends are planning a 2-week European trip. £3,500 if you go all-in.",
    choices: [
      { label: "Join them — make memories", effects: { cash: -3500, happiness: 20, relationships: 15, life_experiences: 2 } },
      { label: "Budget version (£1,500)", effects: { cash: -1500, happiness: 10, relationships: 8, life_experiences: 1 } },
      { label: "Skip this one", effects: { happiness: -8, relationships: -10 } }
    ],
    concept: "Spending on experiences",
    explanation: "Research consistently shows experiences buy more durable happiness than possessions. Travel memories appreciate over time; the new TV doesn't."
  },

  {
    id: "E032",
    category: "Health",
    age_min: 35, age_max: 55,
    prompt: "You've been feeling rundown. A wellness retreat costs £2,000 for a week, and a personal trainer is £200/month.",
    choices: [
      { label: "Wellness retreat", effects: { cash: -2000, happiness: 15, health: 15, life_experiences: 1 } },
      { label: "Personal trainer (£200/mo)", effects: { cost_other: 200, happiness: 8, health: 12 } },
      { label: "Just do free workouts", effects: { happiness: 3, health: 5, knowledge: 3 } }
    ],
    concept: "Health is wealth",
    explanation: "Healthcare costs explode in your 60s. Money spent on prevention in your 30s and 40s saves multiples later — both financially and in quality of life."
  },

  {
    id: "E033",
    category: "Lifestyle",
    age_min: 40, age_max: 60,
    requires_flag: "is_homeowner",
    prompt: "Home renovation time. The kitchen is dated.",
    choices: [
      { label: "Full remodel (£35,000)", effects: { cash: -35000, happiness: 18, life_experiences: 1 } },
      { label: "Modest refresh (£8,000)", effects: { cash: -8000, happiness: 10 } },
      { label: "DIY weekend project (£1,500)", effects: { cash: -1500, happiness: 6, knowledge: 4, life_experiences: 1 } }
    ],
    concept: "Discretionary spending on assets",
    explanation: "Home improvements rarely 'pay for themselves' on resale. They're worth doing for quality of life — but don't pretend they're investments."
  },

  {
    id: "E034",
    category: "Family",
    age_min: 38, age_max: 55,
    requires_flag: "has_kids",
    prompt: "Your child wants to play a competitive sport. Equipment, lessons, travel: £2,500/year.",
    choices: [
      { label: "Fully fund it", effects: { cost_other: 200, happiness: 8, relationships: 10, life_experiences: 1 } },
      { label: "Compromise — local club only", effects: { cost_other: 80, happiness: 4, relationships: 5 } },
      { label: "Decline — focus on academics", effects: { happiness: -5, relationships: -8 } }
    ],
    concept: "Cost of raising kids",
    explanation: "Activity costs add up quickly. The 'extras' of childhood (sports, music, travel) are often where parents over-extend financially without realizing it."
  },

  {
    id: "E035",
    category: "Lifestyle",
    age_min: 42, age_max: 58,
    prompt: "A passion project — pottery? Music? Language? — calls you. Classes are £80/month.",
    choices: [
      { label: "Sign up — long overdue", effects: { cost_other: 80, happiness: 12, knowledge: 5, life_experiences: 1 } },
      { label: "Try the free YouTube version", effects: { happiness: 4, knowledge: 3 } },
      { label: "Too busy", effects: { happiness: -4 } }
    ],
    concept: "Hedonic spending vs hedonic adaptation",
    explanation: "Hobbies that involve learning and progress avoid 'hedonic adaptation' — the trap where new things stop making you happy. Classes can be one of the best returns on spending."
  },

  {
    id: "E036",
    category: "Bonus",
    age_min: 38, age_max: 55,
    requires_flag: "has_full_job",
    prompt: "Sabbatical opportunity — 3 months at half pay to travel or rest. Some companies fully-fund this perk.",
    choices: [
      { label: "Take 3-month paid sabbatical", effects: { cash: -3000, happiness: 25, life_experiences: 2, relationships: 10 } },
      { label: "6 weeks at full pay", effects: { cash: -1500, happiness: 14, life_experiences: 1, relationships: 5 } },
      { label: "Stay focused on career", effects: { happiness: -5, knowledge: 2 } }
    ],
    concept: "Sabbatical economics",
    explanation: "Many UK companies offer paid or partially-paid sabbaticals after 5-10 years tenure. Even half-pay leave is a steep discount compared to taking the same time off after retirement — you preserve career momentum while gaining experience."
  },

  {
    id: "E037",
    category: "Family",
    age_min: 36, age_max: 55,
    excludes_flag: "has_pet",
    prompt: "A dog at the local shelter is calling your name. Adoption fee + setup: £600. Ongoing: £100/month.",
    choices: [
      { label: "Adopt — life is better with dogs", effects: { cash: -600, cost_other: 100, happiness: 15, has_pet: true, life_experiences: 1 } },
      { label: "Wait for the right time", effects: { happiness: -3 } }
    ],
    concept: "Recurring costs of joy",
    explanation: "A pet is a 10-15 year financial commitment averaging £15-25k total. Worth it for many — but it's a real budget line, not a one-time decision."
  },

  {
    id: "E038",
    category: "Bonus",
    age_min: 45, age_max: 60,
    requires_flag: "has_full_job",
    prompt: "Year-end bonus: £15,000. Treat or invest?",
    choices: [
      { label: "All into investments", effects: { cash: 15000, happiness: 4, knowledge: 6 } },
      { label: "Half invest, half a memorable holiday", effects: { cash: 7500, happiness: 18, life_experiences: 2, relationships: 8 } },
      { label: "Major splurge — luxury watch / handbag", effects: { cash: 12000, happiness: 14 } }
    ],
    concept: "The middle path",
    explanation: "Pure savers get rich and unhappy. Pure spenders get broke and miserable. Splitting bonuses between investing and joy is usually the most sustainable choice."
  },

  {
    id: "E039",
    category: "Family",
    age_min: 50, age_max: 65,
    requires_flag: "has_kids",
    prompt: "Your teenager is applying to university. Costs incoming.",
    choices: [
      { label: "Full support (£30,000 over 3 yrs)", effects: { cash: -30000, happiness: 12, relationships: 15 } },
      { label: "Split: parent help + student loans", effects: { cash: -10000, happiness: 6, relationships: 8 } },
      { label: "They figure it out themselves", effects: { happiness: -5, relationships: -10, knowledge: 3 } }
    ],
    concept: "Generational wealth transfer",
    explanation: "How much to fund kids' education is one of the most consequential parenting decisions. The 'they figure it out' approach often hurts both parties — but full funding can hurt your retirement."
  }
];
