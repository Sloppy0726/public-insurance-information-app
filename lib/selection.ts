type ComparisonRow = {
  year: number;
  total_paid: number;
  total_surrender: number;
};

export type ComparisonPlanLike = {
  company: string;
  category: string;
  product_name_zh: string;
  source_kind?: string;
  surrender_value_table: ComparisonRow[];
};

type SelectionOptions = {
  limitPerGroup?: number;
};

function normalizeProductName(name: string) {
  return name
    .toLowerCase()
    .replace(/[·‧．・\s()[\]（）【】「」,，.。:：-]/g, '')
    .replace(/保險計劃$/g, '');
}

function ratioAt(plan: ComparisonPlanLike, year: number) {
  const row = plan.surrender_value_table.find(item => item.year === year);
  if (!row || row.total_paid <= 0) return null;
  return row.total_surrender / row.total_paid;
}

export function comparisonScore(plan: ComparisonPlanLike) {
  return ratioAt(plan, 20)
    ?? ratioAt(plan, 30)
    ?? ratioAt(plan, 10)
    ?? ratioAt(plan, 5)
    ?? -Infinity;
}

function shouldReplaceDuplicate(current: ComparisonPlanLike, candidate: ComparisonPlanLike) {
  const scoreDiff = comparisonScore(candidate) - comparisonScore(current);
  if (scoreDiff !== 0) return scoreDiff > 0;
  if (candidate.source_kind === 'pdf-proposal' && current.source_kind !== 'pdf-proposal') return true;
  return candidate.product_name_zh.localeCompare(current.product_name_zh, 'zh-Hant') < 0;
}

export function selectTopComparisonPlans<T extends ComparisonPlanLike>(
  plans: T[],
  { limitPerGroup = 3 }: SelectionOptions = {}
) {
  const deduped = new Map<string, T>();

  for (const plan of plans) {
    const key = [
      plan.company,
      plan.category,
      normalizeProductName(plan.product_name_zh),
    ].join('|');
    const current = deduped.get(key);
    if (!current || shouldReplaceDuplicate(current, plan)) {
      deduped.set(key, plan);
    }
  }

  const groups = new Map<string, T[]>();
  for (const plan of deduped.values()) {
    const key = `${plan.company}|${plan.category}`;
    groups.set(key, [...(groups.get(key) ?? []), plan]);
  }

  return [...groups.values()].flatMap(group => group
    .sort((a, b) => {
      const scoreDiff = comparisonScore(b) - comparisonScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.product_name_zh.localeCompare(b.product_name_zh, 'zh-Hant');
    })
    .slice(0, limitPerGroup));
}
