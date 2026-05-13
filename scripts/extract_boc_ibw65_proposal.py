#!/usr/bin/env python3
import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


def to_int(value: str) -> int:
    return int(value.replace(",", "").strip())


@dataclass
class BaseRow:
    paid: int
    cash_guaranteed: int
    cash_non_guaranteed_accum: int
    cash_non_guaranteed_terminal: int
    cash_total: int
    death_guaranteed: int
    death_non_guaranteed_accum: int
    death_non_guaranteed_terminal: int
    death_total: int


@dataclass
class ScenarioRow:
    paid: int
    guaranteed: int
    pessimistic_non_guaranteed_accum: int
    pessimistic_non_guaranteed_terminal: int
    pessimistic_total: int
    optimistic_non_guaranteed_accum: int
    optimistic_non_guaranteed_terminal: int
    optimistic_total: int


BASE_ROW_RE = re.compile(
    r"^(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$"
)
SCENARIO_ROW_RE = re.compile(
    r"^(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$"
)


def extract_table_rows(page_text: str, row_re):
    year_rows = {}
    age_rows = {}
    in_age = False
    for raw_line in page_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == "年齡":
            in_age = True
            continue
        match = row_re.match(line)
        if not match:
            continue
        key = int(match.group(1))
        values = [to_int(match.group(i)) for i in range(2, match.lastindex + 1)]
        if in_age:
            age_rows[key] = values
        else:
            year_rows[key] = values
    return year_rows, age_rows


def find_summary_page(pages):
    for page in pages:
        if "計劃摘要" in page and "擬受保人" in page and "保費繳費年期" in page:
            return page
    raise ValueError("Cannot find summary page")


def parse_policy_rows(pages):
    year_rows = {}
    age_rows = {}
    for page in pages:
        if "基本計劃–說明摘要–保單年度展示" in page and "保證現金" in page:
            y, a = extract_table_rows(page, BASE_ROW_RE)
            year_rows.update(y)
            age_rows.update(a)
    if not year_rows:
        raise ValueError("Cannot parse base policy rows")
    mapped_year = {
        k: BaseRow(
            paid=v[0],
            cash_guaranteed=v[1],
            cash_non_guaranteed_accum=v[2],
            cash_non_guaranteed_terminal=v[3],
            cash_total=v[4],
            death_guaranteed=v[5],
            death_non_guaranteed_accum=v[6],
            death_non_guaranteed_terminal=v[7],
            death_total=v[8],
        )
        for k, v in year_rows.items()
    }
    mapped_age = {
        k: BaseRow(
            paid=v[0],
            cash_guaranteed=v[1],
            cash_non_guaranteed_accum=v[2],
            cash_non_guaranteed_terminal=v[3],
            cash_total=v[4],
            death_guaranteed=v[5],
            death_non_guaranteed_accum=v[6],
            death_non_guaranteed_terminal=v[7],
            death_total=v[8],
        )
        for k, v in age_rows.items()
    }
    return mapped_year, mapped_age


def parse_scenario_rows(pages, keyword):
    year_rows = {}
    age_rows = {}
    for page in pages:
        if keyword in page:
            y, a = extract_table_rows(page, SCENARIO_ROW_RE)
            year_rows.update(y)
            age_rows.update(a)
    if not year_rows:
        raise ValueError(f"Cannot parse scenario rows for {keyword}")
    mapped_year = {
        k: ScenarioRow(
            paid=v[0],
            guaranteed=v[1],
            pessimistic_non_guaranteed_accum=v[2],
            pessimistic_non_guaranteed_terminal=v[3],
            pessimistic_total=v[4],
            optimistic_non_guaranteed_accum=v[5],
            optimistic_non_guaranteed_terminal=v[6],
            optimistic_total=v[7],
        )
        for k, v in year_rows.items()
    }
    mapped_age = {
        k: ScenarioRow(
            paid=v[0],
            guaranteed=v[1],
            pessimistic_non_guaranteed_accum=v[2],
            pessimistic_non_guaranteed_terminal=v[3],
            pessimistic_total=v[4],
            optimistic_non_guaranteed_accum=v[5],
            optimistic_non_guaranteed_terminal=v[6],
            optimistic_total=v[7],
        )
        for k, v in age_rows.items()
    }
    return mapped_year, mapped_age


def base_row_to_milestone(row: BaseRow):
    return {
        "paidPremium": row.paid,
        "cashValue": {
            "guaranteed": row.cash_guaranteed,
            "nonGuaranteedAccumulatedAnnualBonusAndInterest": row.cash_non_guaranteed_accum,
            "nonGuaranteedTerminalBonus": row.cash_non_guaranteed_terminal,
            "total": row.cash_total,
        },
        "deathBenefit": {
            "guaranteed": row.death_guaranteed,
            "nonGuaranteedAccumulatedAnnualBonusAndInterest": row.death_non_guaranteed_accum,
            "nonGuaranteedTerminalBonus": row.death_non_guaranteed_terminal,
            "total": row.death_total,
        },
    }


def base_row_to_age_milestone(row: BaseRow):
    return {
        "cashValue": {
            "guaranteed": row.cash_guaranteed,
            "nonGuaranteedAccumulatedAnnualBonusAndInterest": row.cash_non_guaranteed_accum,
            "nonGuaranteedTerminalBonus": row.cash_non_guaranteed_terminal,
            "total": row.cash_total,
        },
        "deathBenefit": {
            "guaranteed": row.death_guaranteed,
            "nonGuaranteedAccumulatedAnnualBonusAndInterest": row.death_non_guaranteed_accum,
            "nonGuaranteedTerminalBonus": row.death_non_guaranteed_terminal,
            "total": row.death_total,
        },
    }


def build_output(args):
    pdf_path = Path(args.pdf).expanduser().resolve()
    reader = PdfReader(str(pdf_path))
    pages = [(page.extract_text() or "") for page in reader.pages]
    full_text = "\n".join(pages)
    summary_page = find_summary_page(pages)

    proposal_no = re.search(r"建議書編號\s*:\s*([A-Z0-9]+)", full_text)
    sum_assured = re.search(r"名義金額\s*:\s*([\d,]+)", full_text)
    insured_age = re.search(r"年齡\s*:\s*(\d+)", summary_page)
    premium_line = re.search(r"投保時之(每月保費|每年保費|躉繳保費|一次性供款|一次性繳付)\s*:\s*([\d,]+\.\d{2})", summary_page)
    pay_term = re.search(r"保費繳費年期\s*:\s*(\d+)\s*年", summary_page)
    currency_line = re.search(r"保單貨幣\s*:\s*([^\n]+)", summary_page)
    product_line = re.search(r"保障項目[\s\S]*?\n([^\n]+?計劃)[\s]+[^\n]+?投保時之", full_text)

    if not premium_line:
        raise ValueError("Cannot parse premium line from summary page")

    premium_label = premium_line.group(1)
    actual_premium = float(premium_line.group(2).replace(",", ""))
    payment_mode = args.payment_mode
    payment_mode_label = {"MONTHLY": "月繳", "ANNUAL": "年繳", "SINGLE": "一次性供款"}[payment_mode]
    currency_zh = (currency_line.group(1).strip() if currency_line else "美元")
    currency_code_map = {"美元": "USD", "港幣": "HKD", "人民幣": "RMB", "英鎊": "GBP", "新加坡元": "SGD", "加元": "CAD", "澳元": "AUD", "歐羅": "EUR"}
    currency_code = currency_code_map.get(currency_zh, args.target_premium_currency)

    product_code = args.product_code or "IBW65"
    product_name_zh = args.product_name_zh or (product_line.group(1).strip() if product_line else "薪火傳承環球終身壽險計劃")

    base_year_rows, base_age_rows = parse_policy_rows(pages)
    cash_scenario_year, cash_scenario_age = parse_scenario_rows(pages, "基本計劃–現金價值總額–不同投資回報下的說明摘要")
    death_scenario_year, death_scenario_age = parse_scenario_rows(pages, "基本計劃–身故賠償總額–不同投資回報下的說明摘要")

    if args.payment_term_years:
        pay_term_years = args.payment_term_years
    elif pay_term:
        pay_term_years = int(pay_term.group(1))
    else:
        pay_term_years = 1

    sorted_years = sorted(base_year_rows.keys())
    break_even_year = None
    for year in sorted_years:
        row = base_year_rows[year]
        if row.cash_total >= row.paid:
            break_even_year = year
            break
    if break_even_year is None:
        break_even_year = sorted_years[-1]

    prev_candidates = [y for y in sorted_years if y < break_even_year]
    prev_year = max(prev_candidates) if prev_candidates else break_even_year
    prev_row = base_year_rows[prev_year]
    curr_row = base_year_rows[break_even_year]

    scenario_fields = {}
    for year in [10, 20, 30]:
        scenario_fields[f"policyYear{year}"] = {
            "pessimisticTotal": cash_scenario_year[year].pessimistic_total,
            "currentIllustrationTotal": base_year_rows[year].cash_total,
            "optimisticTotal": cash_scenario_year[year].optimistic_total,
        }

    death_scenario_fields = {}
    for year in [10, 20, 30]:
        death_scenario_fields[f"policyYear{year}"] = {
            "pessimisticTotal": death_scenario_year[year].pessimistic_total,
            "currentIllustrationTotal": base_year_rows[year].death_total,
            "optimisticTotal": death_scenario_year[year].optimistic_total,
        }

    for age in [65, 100]:
        scenario_fields[f"age{age}"] = {
            "pessimisticTotal": cash_scenario_age[age].pessimistic_total,
            "currentIllustrationTotal": base_age_rows[age].cash_total,
            "optimisticTotal": cash_scenario_age[age].optimistic_total,
        }
        death_scenario_fields[f"age{age}"] = {
            "pessimisticTotal": death_scenario_age[age].pessimistic_total,
            "currentIllustrationTotal": base_age_rows[age].death_total,
            "optimisticTotal": death_scenario_age[age].optimistic_total,
        }

    output = {
        "capturedAt": args.captured_at,
        "insurer": "BOC Life",
        "source": {
            "portal": "BOC Life proposal portal",
            "portalFirst": True,
            "pdfFallbackUsed": True,
            "downloadedPdfFile": pdf_path.name,
        },
        "quoteProfile": {
            "productCode": product_code,
            "productNameZh": product_name_zh,
            "comparisonBucket": args.bucket,
            "insuredNameZh": "測試",
            "insuredAge": int(insured_age.group(1)) if insured_age else 46,
            "gender": "男",
            "smoking": "不吸煙",
            "staff": "否",
            "currency": currency_code,
            "paymentMode": payment_mode,
            "paymentModeLabel": payment_mode_label,
            "paymentModeSourceLabel": premium_label,
            "paymentTermYears": pay_term_years,
            "coverageTermLabel": "終身",
            "targetPremium": args.target_premium,
            "targetPremiumCurrency": args.target_premium_currency,
            "actualPremium": actual_premium,
            "actualPremiumCurrency": currency_code,
            "sumAssured": to_int(sum_assured.group(1)) if sum_assured else None,
            "sumAssuredCurrency": currency_code,
            "proposalPages": len(reader.pages),
            "proposalNumber": proposal_no.group(1) if proposal_no else None,
        },
        "breakEven": {
            "policyYear": break_even_year,
            "basis": "First policy year where projected total cash value exceeds total paid premium.",
            "comparison": {
                f"year{prev_year}": {
                    "paidPremium": prev_row.paid,
                    "cashValueTotal": prev_row.cash_total,
                },
                f"year{break_even_year}": {
                    "paidPremium": curr_row.paid,
                    "cashValueTotal": curr_row.cash_total,
                },
            },
        },
        "milestones": {
            "policyYear10": base_row_to_milestone(base_year_rows[10]),
            "policyYear20": base_row_to_milestone(base_year_rows[20]),
            "policyYear30": base_row_to_milestone(base_year_rows[30]),
        },
        "ageMilestones": {
            "age65": base_row_to_age_milestone(base_age_rows[65]),
            "age100": base_row_to_age_milestone(base_age_rows[100]),
        },
        "scenarioSensitivity": {
            "cashValueTotal": scenario_fields,
            "deathBenefitTotal": death_scenario_fields,
        },
        "yearlyValues": [
            {
                "year": year,
                "totalPaid": row.paid,
                "guaranteedCashValue": row.cash_guaranteed,
                "nonGuaranteedAccumulatedAnnualBonusAndInterest": row.cash_non_guaranteed_accum,
                "nonGuaranteedTerminalBonus": row.cash_non_guaranteed_terminal,
                "totalSurrenderValue": row.cash_total,
                "guaranteedDeathBenefit": row.death_guaranteed,
                "nonGuaranteedDeathAccumulatedAnnualBonusAndInterest": row.death_non_guaranteed_accum,
                "nonGuaranteedDeathTerminalBonus": row.death_non_guaranteed_terminal,
                "totalDeathBenefit": row.death_total,
            }
            for year, row in sorted(base_year_rows.items(), key=lambda item: item[0])
        ],
        "notes": [
            args.note,
            "Break-even is inferred from the first policy-year row where 現金價值總額 exceeds 已繳總保費.",
        ],
    }

    if args.discount_code or args.discounted_premium is not None:
        discounted_premium = args.discounted_premium if args.discounted_premium is not None else actual_premium
        discount_amount = round(actual_premium - discounted_premium, 2)
        discount_rate = round((discount_amount / actual_premium) * 100, 6) if actual_premium else 0
        output["discountInfo"] = {
            "discountAvailable": discount_amount > 0,
            "discountCode": args.discount_code,
            "discountDescription": args.discount_description,
            "discountScope": args.discount_scope,
            "premiumBeforeDiscount": actual_premium,
            "premiumAfterDiscount": discounted_premium,
            "discountAmount": discount_amount,
            "discountRatePct": discount_rate,
            "discountCurrency": args.discount_currency,
        }

    if args.output:
        out_path = Path(args.output).resolve()
        out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        print(json.dumps(output, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--payment-mode", choices=["MONTHLY", "ANNUAL", "SINGLE"], required=True)
    parser.add_argument("--payment-term-years", type=int)
    parser.add_argument("--target-premium", type=float, required=True)
    parser.add_argument("--target-premium-currency", default="USD")
    parser.add_argument("--product-code")
    parser.add_argument("--product-name-zh")
    parser.add_argument("--captured-at", default="2026-05-12")
    parser.add_argument("--note", required=True)
    parser.add_argument("--output")
    parser.add_argument("--discount-code")
    parser.add_argument("--discount-description")
    parser.add_argument("--discounted-premium", type=float)
    parser.add_argument("--discount-scope", default="FIRST_YEAR_PREMIUM")
    parser.add_argument("--discount-currency", default="USD")
    args = parser.parse_args()
    build_output(args)


if __name__ == "__main__":
    main()
