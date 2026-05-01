# Heavily used AI for this preprocessing, as noted in my documentation
import pandas as pd

POVERTY_CSV = "data/raw/distribution-of-population-poverty-thresholds.csv"
LITERACY_CSV = "data/raw/cross-country-literacy-rates.csv"
ENROL_CSV = "data/raw/share-of-children-enrolled-in-school-by-education-level.csv"
OUT_CSV = "data/country_data.csv"

poverty = pd.read_csv(POVERTY_CSV)
literacy = pd.read_csv(LITERACY_CSV)
enrol = pd.read_csv(ENROL_CSV)

merged = pd.merge(poverty, literacy, on=["Code", "Year"], suffixes=("_poverty", "_lit"))

merged = pd.merge(
    merged,
    enrol[["Code", "Year", "Primary"]],
    on=["Code", "Year"],
    how="left",
)

poverty_cols = [
    "Above $10 a day",
    "$8.30-$10 a day",
    "$4.20-$8.30 a day",
    "$3-$4.20 a day",
    "Below $3 a day",
]

merged["poverty_total"] = merged[poverty_cols].sum(axis=1)

for col in poverty_cols:
    merged[col + "_pct"] = (merged[col] / merged["poverty_total"]) * 100

def pct_below_threshold(row, t):
    below3 = row["Below $3 a day_pct"]
    bin3_4 = row["$3-$4.20 a day_pct"]
    bin4_8 = row["$4.20-$8.30 a day_pct"]
    bin8_10 = row["$8.30-$10 a day_pct"]
    above10 = row["Above $10 a day_pct"]

    if t <= 3:
        return below3

    if t < 4.2:
        frac = (t - 3) / (4.2 - 3)
        return below3 + frac * bin3_4

    if t <= 8.3:
        frac = (t - 4.2) / (8.3 - 4.2)
        return below3 + bin3_4 + frac * bin4_8

    if t < 10:
        frac = (t - 8.3) / (10 - 8.3)
        return below3 + bin3_4 + bin4_8 + frac * bin8_10

    return 100 - above10

thresholds = [3, 4, 5, 6, 7, 8, 9, 10]

for t in thresholds:
    merged[f"pct_below_{t}_per_day"] = merged.apply(lambda r: pct_below_threshold(r, t), axis=1)

latest_per_country = merged.sort_values("Year").groupby("Code", as_index=False).tail(1)

out = pd.DataFrame({
    "country": latest_per_country["Entity_poverty"],
    "iso_code": latest_per_country["Code"],
    "year": latest_per_country["Year"],
    "literacy_rate": latest_per_country["Literacy rate"].round(4),
    "primary_enrolment": latest_per_country["Primary"].round(4),
})

for t in thresholds:
    out[f"pct_below_{t}_per_day"] = latest_per_country[f"pct_below_{t}_per_day"].round(4)

out.to_csv(OUT_CSV, index=False)
print(f"Wrote {len(out)} rows to {OUT_CSV}")