export type SurrenderRow = {
  year: number;
  total_paid: number;
  guaranteed: number;
  total_surrender: number;
  non_guaranteed_terminal_bonus?: number;
  non_guaranteed_reversionary?: number;
  non_guaranteed_special?: number;
  non_guaranteed_terminal?: number;
};

export type Plan = {
  id?: string;
  company: string;
  company_zh: string;
  product_name: string;
  product_name_zh: string;
  category: string;
  category_label?: string;
  currency: string;
  quote_profile: { age: number; gender: string; smoker: boolean };
  premium: {
    payment_mode?: string;
    monthly: number;
    monthly_with_levy?: number;
    annual_equivalent: number;
    payment_term_years: number;
    total_premium_paid: number;
  };
  policy_term: string;
  surrender_value_table: SurrenderRow[];
  xray: {
    breakeven_year_guaranteed: string;
    breakeven_year_projected: string;
    year3_surrender_loss_pct: number;
    year3_surrender_loss_usd: number;
    year5_surrender_loss_pct: number;
    year5_surrender_loss_usd: number;
    guaranteed_irr_20y: string;
    projected_irr_20y: string;
    total_non_guaranteed_ratio_20y: number;
  };
  source_pdf?: string;
  quote_date?: string;
  source_kind?: 'sample-json' | 'pdf-proposal';
  comparison_basis?: string;
};

export type MedicalPlan = {
  company: string;
  company_zh: string;
  product_name: string;
  product_name_zh: string;
  category: 'medical';
  currency: 'HKD';
  plan_type: 'VHIS Standard' | 'VHIS Flexi';
  certification_no: string;
  quote_profile: { age: number; gender: string; smoker: boolean };
  annual_premium_by_age: Record<string, number>;
  annual_premium_by_age_female_non_smoker?: Record<string, number>;
  annual_limit: number | null;
  lifetime_limit: number | null;
  deductible: number;
  room_class: string;
  outpatient: boolean;
  guaranteed_renewal_age: number;
  overseas_coverage: boolean;
  vhis_certified: boolean;
  tax_deductible: boolean;
  source_dataset: {
    name: string;
    url: string;
    last_updated: string;
    premium_effective_date: string;
    main_premium_code: string;
  };
  notes?: string[];
};

export type ProductValuePoint = {
  year: number;
  age?: number | null;
  total_paid: number;
  guaranteed: number;
  total_surrender: number;
  death_benefit?: number | null;
};

export type ProductPremium = {
  payment_mode?: string;
  portal_premium?: number | null;
  input_amount_type?: string;
  input_amount?: number | null;
  monthly?: number;
  monthly_with_levy?: number;
  annual_equivalent?: number;
  total_premium_paid?: number;
  payment_term_years?: number | null;
  levy?: number | null;
};

export type ProductMetrics = {
  issue_surrender_value?: number | null;
  issue_surrender_loss?: number | null;
  issue_surrender_loss_pct?: number | null;
  annuity_monthly_guaranteed?: number | null;
  annuity_monthly_non_guaranteed?: number | null;
  annuity_monthly_total?: number | null;
  guaranteed_irr?: string | null;
  projected_irr?: string | null;
  year3_surrender_loss_pct?: number;
  year3_surrender_loss_usd?: number;
  year5_surrender_loss_pct?: number;
  year5_surrender_loss_usd?: number;
  value_point_count?: number;
  comparison_value_point_count?: number;
};

export type ProductSource = {
  kind: 'pdf-proposal' | 'sample-json' | 'official-public-dataset';
  batch?: string;
  filename?: string;
  absolute_path?: string;
  pages?: number | null;
  notes?: string;
  download_date?: string;
  text_extractable?: boolean;
  name?: string;
  url?: string;
  last_updated?: string;
  quote_date?: string;
};

export type ProductDataQuality = {
  level: 'raw-pdf-extract' | 'sample-proposal' | 'official-public-data';
  summary: string;
  warnings?: string[];
};

export type ProductSummary = {
  id: string;
  company: string;
  company_zh: string;
  product_name: string;
  product_name_zh: string;
  category: string;
  category_label: string;
  source_category?: string;
  currency: string;
  quote_profile?: { age: number; gender: string; smoker: boolean };
  premium?: ProductPremium;
  sum_insured?: number | null;
  annual_limit?: number | null;
  lifetime_limit?: number | null;
  deductible?: number | null;
  room_class?: string;
  plan_type?: string;
  policy_term?: string | null;
  metrics?: ProductMetrics;
  value_points?: ProductValuePoint[];
  comparison_value_points?: ProductValuePoint[];
  source: ProductSource;
  data_quality: ProductDataQuality;
};

export type ProductBatch = {
  batch_id: string;
  generated_at: string;
  source_root: string;
  product_count: number;
  products: ProductSummary[];
};

export type ProductCatalog = {
  products: ProductSummary[];
  batches: ProductBatch[];
  stats: {
    total: number;
    fwdProposalCount: number;
    savingsSeedCount: number;
    medicalSeedCount: number;
    byCategory: Record<string, number>;
  };
};
