// Free study material for CAT and GMAT — written by Collegeolo (original notes, formulas, strategy and solved questions).
// Exam patterns are taken from the official bodies (IIMs for CAT, GMAC for GMAT); everything else is our own writing.

export type Q = { q: string; options?: string[]; answer: string; solution: string };
export type Topic = { title: string; points: string[] };
export type Section = { name: string; short: string; about: string; topics: Topic[]; strategy: string[]; practice: Q[] };
export type Prep = {
  slug: string; exam: string; title: string; intro: string;
  pattern: { rows: [string, string, string, string][]; notes: string[]; source: { label: string; href: string } };
  sections: Section[];
  plan: { week: string; focus: string }[];
  free: { label: string; href: string; note: string }[];
  checked: string;
};

export const PREP: Record<string, Prep> = {
  cat: {
    slug: 'cat', exam: 'CAT', title: 'CAT free study material',
    intro: 'Notes, formulas, strategy and solved questions for the Common Admission Test (CAT) — the entrance exam for the IIMs and most top MBA colleges in India. Read section by section, then practise with the official mock on iimcat.ac.in and the free mock tests on Collegeolo.',
    pattern: {
      rows: [
        ['Verbal Ability & Reading Comprehension (VARC)', '24', '40 min', 'RC passages, para-jumbles, para-summary, odd sentence'],
        ['Data Interpretation & Logical Reasoning (DILR)', '22', '40 min', 'Sets of 4–6 questions on tables, charts, arrangements, games'],
        ['Quantitative Ability (QA)', '22', '40 min', 'Arithmetic, algebra, geometry, number system, modern maths'],
      ],
      notes: [
        'CAT 2025: 68 questions, 120 minutes, computer-based. Fixed order VARC → DILR → QA; you cannot move between sections.',
        'Marking: +3 for a correct answer, −1 for a wrong multiple-choice answer, no negative mark for type-in-the-answer (TITA) questions.',
        'An on-screen calculator is allowed. The pattern can change each year — check the official notice on iimcat.ac.in.',
      ],
      source: { label: 'iimcat.ac.in (official CAT website)', href: 'https://iimcat.ac.in/' },
    },
    sections: [
      {
        name: 'Quantitative Ability', short: 'QA',
        about: 'About half of QA is arithmetic. Strong basics in percentages, ratios and equations score more than rare advanced topics.',
        topics: [
          { title: 'Percentages, profit & loss', points: [
            'x% of y = y% of x — use it to make mental maths easy (16% of 25 = 25% of 16 = 4).',
            'Successive change of a% and b%: net = a + b + ab/100. A 20% rise then 20% fall = −4%.',
            'Profit % is on cost price; discount % is on marked price. SP = CP × (1 + profit%) = MP × (1 − discount%).',
            'If price rises by r%, consumption must fall by r/(100 + r) × 100% to keep spending the same.',
          ] },
          { title: 'Ratio, mixtures, averages', points: [
            'Alligation: mixing prices c1 and c2 to get mean m → quantities in ratio (c2 − m) : (m − c1).',
            'Average of an arithmetic sequence = (first + last) / 2.',
            'If one value changes by d in a group of n, the average changes by d / n.',
          ] },
          { title: 'Time, speed, distance & work', points: [
            'Average speed for equal distances at a and b = 2ab / (a + b) (not the simple average).',
            'Relative speed: add when moving towards each other, subtract when in the same direction.',
            'Work: if A takes a days and B takes b days, together they take ab / (a + b) days.',
            'Pipes: filling pipes add work, leaking pipes subtract it — use rates per hour.',
          ] },
          { title: 'Interest', points: [
            'Simple interest = P × R × T / 100. Compound amount = P(1 + R/100)^T.',
            'For 2 years, CI − SI = P(R/100)². For 3 years, CI − SI = P(R/100)²(3 + R/100).',
          ] },
          { title: 'Algebra', points: [
            'For ax² + bx + c = 0: sum of roots = −b/a, product = c/a; real roots when b² − 4ac ≥ 0.',
            'AM ≥ GM for positive numbers: (a + b)/2 ≥ √(ab), equal only when a = b — used for max/min questions.',
            'Log rules: log(ab) = log a + log b, log(aⁿ) = n log a, logₐb = log b / log a.',
            'Arithmetic progression sum = n/2 × (2a + (n − 1)d); geometric sum = a(rⁿ − 1)/(r − 1).',
          ] },
          { title: 'Number system', points: [
            'Number of factors of p^a × q^b × r^c = (a + 1)(b + 1)(c + 1).',
            'Last digit of powers repeats in cycles of 4 (for example 7: 7, 9, 3, 1).',
            'Divisibility: by 3 or 9 → digit sum; by 11 → difference of alternate digit sums is 0 or a multiple of 11.',
            'HCF × LCM = product of the two numbers.',
          ] },
          { title: 'Geometry & mensuration', points: [
            'Triangle area = ½ × base × height = √(s(s−a)(s−b)(s−c)), s = half the perimeter.',
            'Right triangle triplets to remember: 3-4-5, 5-12-13, 8-15-17, 7-24-25.',
            'Angle in a semicircle is 90°. Equal chords are equally distant from the centre.',
            'Cylinder volume πr²h, cone ⅓πr²h, sphere ⁴⁄₃πr³; similar figures: areas scale by k², volumes by k³.',
          ] },
          { title: 'Modern maths', points: [
            'Permutations nPr = n!/(n−r)!; combinations nCr = n!/(r!(n−r)!).',
            'Arranging n people in a circle: (n − 1)! ways.',
            'Probability = favourable / total outcomes; P(not A) = 1 − P(A).',
          ] },
        ],
        strategy: [
          'Do two rounds: first solve every question you can do in under 2 minutes, then return to the rest.',
          'Use the options: plug them in or check divisibility and last digits before solving fully.',
          'TITA questions have no negative marking — always enter an answer.',
          'Accuracy matters more than attempts: 14–16 correct answers is a strong QA score in most years.',
        ],
        practice: [
          { q: 'A price is increased by 25% and then decreased by 20%. What is the net change?', options: ['+5%', '0%', '−5%', '+1%'], answer: '0%',
            solution: 'Net = 25 + (−20) + (25 × −20)/100 = 25 − 20 − 5 = 0%. Check: 100 → 125 → 100.' },
          { q: 'A car goes from A to B at 40 km/h and returns at 60 km/h. What is its average speed for the round trip?', options: ['50 km/h', '48 km/h', '45 km/h', '52 km/h'], answer: '48 km/h',
            solution: 'Equal distances: average speed = 2ab/(a + b) = 2 × 40 × 60 / 100 = 48 km/h.' },
          { q: 'A can finish a job in 12 days and B in 18 days. In how many days can they finish it together?', options: ['7.2 days', '7.5 days', '6 days', '15 days'], answer: '7.2 days',
            solution: 'Together = ab/(a + b) = 12 × 18 / 30 = 7.2 days.' },
          { q: 'How many factors does 360 have? (Type in the answer.)', answer: '24',
            solution: '360 = 2³ × 3² × 5¹, so factors = (3+1)(2+1)(1+1) = 4 × 3 × 2 = 24.' },
          { q: 'What is the last digit of 7^2026?', options: ['1', '3', '7', '9'], answer: '9',
            solution: 'Last digits of 7ⁿ repeat 7, 9, 3, 1 (cycle of 4). 2026 ÷ 4 leaves remainder 2, so the last digit is the 2nd in the cycle: 9.' },
          { q: 'Rice at ₹40/kg is mixed with rice at ₹60/kg so the mixture costs ₹45/kg. In what ratio are they mixed?', options: ['3 : 1', '1 : 3', '2 : 1', '3 : 2'], answer: '3 : 1',
            solution: 'Alligation: (60 − 45) : (45 − 40) = 15 : 5 = 3 : 1 (cheaper : dearer).' },
        ],
      },
      {
        name: 'Data Interpretation & Logical Reasoning', short: 'DILR',
        about: 'DILR comes in sets of about 4–6 questions built on one puzzle or data display. Choosing the right sets matters more than speed.',
        topics: [
          { title: 'Picking sets', points: [
            'Spend the first 4–5 minutes reading every set briefly and pick the 2–3 that look cleanest.',
            'Prefer sets with direct data (tables, few conditions) over sets with many "if … then" rules.',
            'If a set is not opening up in 3–4 minutes, leave it — one fully solved set beats two half-solved ones.',
          ] },
          { title: 'Arrangements & grids', points: [
            'Draw the grid or seating plan first; fill fixed facts, then the "not" conditions.',
            'Write each rule in short form (A ≠ 2, B left of C) so you can scan them quickly.',
            'When two cases remain, draw both — most questions are answerable from either.',
          ] },
          { title: 'Data interpretation', points: [
            'Approximate: 49.7% ≈ 50%, 1/7 ≈ 14.3%, 1/9 ≈ 11.1% — CAT options are usually far enough apart.',
            'Growth rate = (new − old) / old. Share = part / total. Check the units and the base year.',
            'For "how many items satisfy…" questions, make a quick tally table instead of re-reading the chart.',
          ] },
          { title: 'Games, tournaments, routes', points: [
            'In a round-robin of n teams, each team plays n − 1 matches and there are n(n − 1)/2 matches in total.',
            'Total points given out are fixed (for example 3 per win, 1 each per draw) — use the total to find unknowns.',
            'For route/network sets, list all possible paths once and reuse the list.',
          ] },
        ],
        strategy: [
          'Aim to solve 2–3 sets fully with high accuracy rather than touching all of them.',
          'Use TITA questions inside a solved set — no negative marking.',
          'Practise one new set every day; DILR improves with variety, not theory.',
        ],
        practice: [
          { q: '8 teams play a round-robin (each plays every other team once). How many matches are played?', answer: '28',
            solution: 'n(n − 1)/2 = 8 × 7 / 2 = 28.' },
          { q: 'Sales were 240 units in 2024 and 300 units in 2025. What is the growth rate?', options: ['20%', '25%', '60%', '80%'], answer: '25%',
            solution: '(300 − 240)/240 = 60/240 = 25%. (Using 300 as the base would give 20% — a common trap.)' },
          { q: 'Five people A–E sit in a row. A is at one end, B is next to A, and C is in the middle. Who can be at the other end?', options: ['D or E', 'Only D', 'Only E', 'B'], answer: 'D or E',
            solution: 'A at seat 1, B at seat 2, C at seat 3. Seats 4 and 5 are D and E in either order, so the other end can be D or E.' },
          { q: 'In a league, a win gives 3 points, a draw 1 point to each team, and a loss 0. Six matches were played and 16 points were given out in total. How many matches were drawn?', options: ['1', '2', '3', '4'], answer: '2',
            solution: 'Each decided match gives 3 points, each draw gives 2. With d draws: 3(6 − d) + 2d = 16 → 18 − d = 16 → d = 2.' },
        ],
      },
      {
        name: 'Verbal Ability & Reading Comprehension', short: 'VARC',
        about: 'About 16 of the 24 VARC questions come from reading passages, so reading speed and understanding decide this section.',
        topics: [
          { title: 'Reading comprehension', points: [
            'Read for the main idea and the author\'s tone first; details can be looked up later.',
            'After each paragraph, say its point to yourself in five words — it keeps you from re-reading.',
            'Correct options are usually a fair paraphrase; wrong ones are too extreme, out of scope or reverse the meaning.',
            'For "the author would agree" questions, pick the option the passage supports, not the one you agree with.',
          ] },
          { title: 'Para-jumbles (TITA)', points: [
            'Find the opening sentence: it introduces the topic and does not start with "This", "However" or a pronoun.',
            'Find pairs that must go together (a term and its explanation, an example after its idea).',
            'Linking words (therefore, but, for instance) show the order between two sentences.',
          ] },
          { title: 'Para-summary & odd sentence out', points: [
            'A summary keeps the main point and the author\'s view and leaves out examples.',
            'The odd sentence is usually on the same topic but breaks the flow or adds a new idea.',
          ] },
        ],
        strategy: [
          'Read 30–45 minutes every day: editorials and long-form articles on economics, science, philosophy, culture.',
          'In the exam, attempt passages before verbal-ability questions — they carry most marks.',
          'For TITA para-jumbles, there is no negative mark, so always give an answer.',
        ],
        practice: [
          { q: 'Arrange into a paragraph: (1) This is why cities with good public transport often see fewer cars on the road. (2) People choose the quickest and cheapest way to travel. (3) When buses and trains are frequent and cheap, they win on both counts. (4) Transport planners therefore focus on frequency more than on new roads.', answer: '2314',
            solution: '2 states the general idea, 3 applies it to buses and trains, 1 gives the result ("This is why"), and 4 draws the conclusion ("therefore").' },
          { q: 'A passage argues that remote work raises productivity for focused tasks but weakens the informal learning that happens in offices. Which summary is best?', options: [
            'Remote work is better than office work.',
            'Remote work helps focused work but costs some of the learning that offices provide.',
            'Offices should be closed to raise productivity.',
            'Informal learning is the most important part of any job.'], answer: 'Remote work helps focused work but costs some of the learning that offices provide.',
            solution: 'It keeps both sides of the argument. Options 1 and 3 are too one-sided; option 4 is too extreme and not claimed.' },
        ],
      },
    ],
    plan: [
      { week: 'Weeks 1–4', focus: 'Arithmetic and number system basics; read daily; one DILR set a day.' },
      { week: 'Weeks 5–8', focus: 'Algebra, geometry, modern maths; RC practice 2 passages a day; timed DILR sets.' },
      { week: 'Weeks 9–12', focus: 'Sectional tests twice a week; revise weak topics from your test analysis.' },
      { week: 'Last 6–8 weeks', focus: 'One full mock a week (then two), each followed by a full analysis; the official mock on iimcat.ac.in.' },
    ],
    free: [
      { label: 'Official CAT mock test (IIMs)', href: 'https://iimcat.ac.in/', note: 'The IIMs release a free mock on the official website before the exam.' },
      { label: 'Collegeolo CAT mock tests', href: '/mock-tests', note: 'Free timed practice on Collegeolo.' },
      { label: 'CAT exam page', href: '/exams/cat', note: 'Dates, notices and previous papers from official sources.' },
    ],
    checked: '28 November 2026',
  },

  gmat: {
    slug: 'gmat', exam: 'GMAT', title: 'GMAT free study material',
    intro: 'Notes, formulas, strategy and solved questions for the GMAT Focus Edition — the test business schools worldwide use for MBA and business master’s admissions. Start with the free GMAT Official Starter Kit from GMAC, then use these notes to fix your weak areas.',
    pattern: {
      rows: [
        ['Quantitative Reasoning', '21', '45 min', 'Problem solving: arithmetic and algebra (no geometry, no calculator)'],
        ['Verbal Reasoning', '23', '45 min', 'Reading comprehension and critical reasoning'],
        ['Data Insights', '20', '45 min', 'Data sufficiency, table and graph analysis, two-part analysis, multi-source reasoning (calculator allowed)'],
      ],
      notes: [
        '64 questions in 2 hours 15 minutes, plus one optional 10-minute break. You choose the order of the sections.',
        'The test is computer-adaptive. You can bookmark questions and change up to three answers per section.',
        'Total score 205–805; each section is scored 60–90 and counts equally. Check mba.com for the latest rules.',
      ],
      source: { label: 'GMAC — exam structure', href: 'https://www.gmac.com/gmat-other-assessments/about-the-gmat-focus-edition/exam-overview' },
    },
    sections: [
      {
        name: 'Quantitative Reasoning', short: 'Quant',
        about: 'Only arithmetic and algebra, no calculator. Speed with fractions, percentages and equations matters most.',
        topics: [
          { title: 'Arithmetic', points: [
            'Percent change = (new − old) / old × 100. Successive changes multiply: ×1.1 then ×0.9 = ×0.99.',
            'Learn fraction ↔ percent pairs: 1/8 = 12.5%, 1/6 ≈ 16.7%, 3/8 = 37.5%, 5/8 = 62.5%.',
            'Weighted average = Σ(value × weight) / Σ weights.',
            'Simple interest = PRT; compound amount = P(1 + r)ⁿ.',
          ] },
          { title: 'Number properties', points: [
            'Odd × odd = odd; anything × even = even. Odd ± odd = even.',
            'A prime has exactly two factors; 2 is the only even prime; 1 is not prime.',
            'Remainders: if n leaves remainder r when divided by d, then n = dq + r.',
            'Consecutive integers: product of k consecutive integers is divisible by k!.',
          ] },
          { title: 'Algebra', points: [
            '(a + b)² = a² + 2ab + b²; (a − b)² = a² − 2ab + b²; a² − b² = (a + b)(a − b).',
            'Exponents: aᵐ × aⁿ = aᵐ⁺ⁿ; (aᵐ)ⁿ = aᵐⁿ; a⁻ⁿ = 1/aⁿ; a⁰ = 1.',
            'Inequalities: multiplying or dividing by a negative number reverses the sign.',
            '|x − a| < b means a − b < x < a + b.',
          ] },
          { title: 'Word problems', points: [
            'Rate × time = work (or distance). Combined rate = sum of rates.',
            'Overlapping sets: total = A + B − both + neither.',
            'Counting: n items in order n!; choosing r from n: nCr.',
          ] },
        ],
        strategy: [
          'About 2 minutes per question. If you are stuck at 3 minutes, guess and move on — unfinished questions cost more.',
          'Test the answer choices or pick easy numbers (like 100 for percentages) instead of heavy algebra.',
          'Keep a list of your mistakes by type and revise it weekly.',
        ],
        practice: [
          { q: 'A shirt’s price rises by 10% and then falls by 10%. What is the net change?', options: ['0%', '−1%', '+1%', '−10%'], answer: '−1%',
            solution: '1.1 × 0.9 = 0.99, so the price ends 1% lower.' },
          { q: 'If 3x − 7 = 2x + 5, what is x?', options: ['2', '12', '−2', '−12'], answer: '12',
            solution: 'Subtract 2x from both sides and add 7: x = 12.' },
          { q: 'In a class of 40, 22 study French, 18 study Spanish and 7 study both. How many study neither?', options: ['7', '5', '0', '3'], answer: '7',
            solution: 'Studying at least one = 22 + 18 − 7 = 33. Neither = 40 − 33 = 7.' },
          { q: 'If x is an odd integer, which must be even?', options: ['x + 2', '3x', 'x² + 1', 'x²'], answer: 'x² + 1',
            solution: 'Odd × odd = odd, so x² is odd and x² + 1 is even. The other options are all odd.' },
        ],
      },
      {
        name: 'Verbal Reasoning', short: 'Verbal',
        about: 'Reading comprehension and critical reasoning only — no grammar questions. It tests how well you follow and judge an argument.',
        topics: [
          { title: 'Critical reasoning', points: [
            'Find the conclusion first (often after "therefore", "so", "thus"), then the evidence.',
            'Assumption: the unstated link the argument needs. Test it by negating — if the argument falls apart, it is the assumption.',
            'Strengthen/weaken: choose the option that most changes how well the evidence supports the conclusion.',
            'Watch for gaps: correlation treated as cause, a small sample, or a changed meaning of a word.',
          ] },
          { title: 'Reading comprehension', points: [
            'Map each paragraph in a few words and note the author’s view.',
            'Inference answers must be supported by the text — avoid options that go beyond it.',
            'For "primary purpose" questions, the answer covers the whole passage, not one paragraph.',
          ] },
        ],
        strategy: [
          'Read the question stem before the argument in critical reasoning, so you know what to look for.',
          'Eliminate options with extreme words (always, never, only) unless the passage is equally strong.',
          'Read business and science articles in English daily to build speed.',
        ],
        practice: [
          { q: 'Sales of umbrellas rose in the month the company started advertising on radio. The manager concludes that the radio ads caused the rise. Which, if true, most weakens this?', options: [
            'The company plans more radio ads.',
            'That month had the highest rainfall in ten years.',
            'Radio ads are cheaper than TV ads.',
            'Some customers do not listen to the radio.'], answer: 'That month had the highest rainfall in ten years.',
            solution: 'Heavy rain is another cause of higher umbrella sales, so the ads may not explain the rise.' },
          { q: 'A city cut bus fares and bus use rose 30%. The council concludes that lower fares will also reduce car traffic. Which assumption does this need?', options: [
            'Some new bus riders used to travel by car.',
            'Bus fares will never rise again.',
            'Car owners prefer driving.',
            'The city has many buses.'], answer: 'Some new bus riders used to travel by car.',
            solution: 'Negate it: if no new bus riders came from cars, car traffic would not fall — so the argument needs this.' },
        ],
      },
      {
        name: 'Data Insights', short: 'DI',
        about: 'Mixes data sufficiency with real-world tables, graphs and multi-part questions. A calculator is available here.',
        topics: [
          { title: 'Data sufficiency', points: [
            'You decide whether the statements give enough information — you usually do not need the final number.',
            'Fixed answer order: (A) statement 1 alone, (B) statement 2 alone, (C) both together, (D) each alone, (E) not enough.',
            'Judge statement 1 alone, then statement 2 alone, and only then together.',
            'For yes/no questions, a statement is sufficient if it always gives the same answer — "always no" is sufficient too.',
          ] },
          { title: 'Tables, graphs, multi-source', points: [
            'Read titles, units and footnotes before the numbers.',
            'Sort tables (the on-screen table can be sorted) instead of scanning by eye.',
            'In multi-source questions, note which tab holds which fact before answering.',
          ] },
        ],
        strategy: [
          'Every part of a multi-part question must be right to score it — slow down slightly here.',
          'Use the calculator for heavy arithmetic, but estimate first to catch typing mistakes.',
        ],
        practice: [
          { q: 'Is x > 0?  (1) x² = 9.  (2) x³ = 27.', options: ['A — (1) alone is enough', 'B — (2) alone is enough', 'C — both together', 'D — each alone is enough', 'E — not enough'], answer: 'B — (2) alone is enough',
            solution: '(1): x could be 3 or −3 — not sufficient. (2): x³ = 27 means x = 3 only — sufficient.' },
          { q: 'What is the value of n?  (1) n is a prime less than 5.  (2) n is even.', options: ['A — (1) alone is enough', 'B — (2) alone is enough', 'C — both together', 'D — each alone is enough', 'E — not enough'], answer: 'C — both together',
            solution: '(1): n = 2 or 3. (2): many even numbers. Together: the only even prime below 5 is 2.' },
        ],
      },
    ],
    plan: [
      { week: 'Week 1', focus: 'Take GMAT Official Practice Exam 1 (free) to find your baseline; read the section notes above.' },
      { week: 'Weeks 2–5', focus: 'Quant basics and critical reasoning daily; 20–30 practice questions a day with error log.' },
      { week: 'Weeks 6–8', focus: 'Data Insights: data sufficiency and tables; timed mixed sets; revise your error log.' },
      { week: 'Weeks 9–10', focus: 'Official Practice Exam 2 (free); fix weak areas; plan section order and timing.' },
    ],
    free: [
      { label: 'GMAT Official Starter Kit + Practice Exams 1 & 2 (free, GMAC)', href: 'https://www.mba.com/exams-and-exam-prep/gmat-exam-prep/gmat-official-practice-exams-and-questions', note: 'Two full-length official practice exams and about 70 real sample questions.' },
      { label: 'GMAT exam structure (GMAC)', href: 'https://www.gmac.com/gmat-other-assessments/about-the-gmat-focus-edition/exam-overview', note: 'Official sections, timing and features.' },
      { label: 'Study abroad guides', href: '/study-abroad/usa', note: 'How to apply to business schools in the USA, UK and more.' },
    ],
    checked: '28 November 2026',
  },
};

export const prepFor = (slug: string) => PREP[slug.toLowerCase()] || null;
