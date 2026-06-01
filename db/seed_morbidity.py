import json
import os
import psycopg2

DSN = os.environ.get(
    "DATABASE_URL",
    "postgres://kirill@localhost:5432/zdravmonitor"
)
JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend-next", "public", "morbidity.json")

def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    try:
        for idx, d in enumerate(data["meta"]["diseases"]):
            cur.execute(
                "INSERT INTO morbidity_diseases (key, label, order_idx) VALUES (%s, %s, %s) ON CONFLICT (key) DO NOTHING",
                (d["key"], d["label"], idx),
            )

        cur.execute(
            "INSERT INTO morbidity_regions (code, name) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING",
            ("RF", "Российская Федерация"),
        )

        for year, diseases in data["rf"]["morbidity"].items():
            for dkey, val in diseases.items():
                cur.execute(
                    "INSERT INTO morbidity (region_code, year, disease_key, absolute_numbers, per_100000) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (region_code, year, disease_key) DO NOTHING",
                    ("RF", year, dkey, val["absolute_numbers"], val["per_100000"]),
                )

        for r in data["regions"]:
            code = r["code"]
            cur.execute(
                "INSERT INTO morbidity_regions (code, name) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING",
                (code, r["name"]),
            )
            for year, diseases in r.get("morbidity", {}).items():
                for dkey, val in diseases.items():
                    cur.execute(
                        "INSERT INTO morbidity (region_code, year, disease_key, absolute_numbers, per_100000) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (region_code, year, disease_key) DO NOTHING",
                        (code, year, dkey, val["absolute_numbers"], val["per_100000"]),
                    )
            for year, val in r.get("water_quality", {}).items():
                if not isinstance(val, dict) or "safe_water_pct" not in val:
                    continue
                cur.execute(
                    "INSERT INTO water_quality_data (region_code, year, safe_water_pct, chem_violation_pct, micro_violation_pct, pipe_violation_pct) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (region_code, year) DO NOTHING",
                    (code, year, val["safe_water_pct"], val["chem_violation_pct"], val["micro_violation_pct"], val["pipe_violation_pct"]),
                )
            for year, val in r.get("emissions", {}).items():
                cur.execute(
                    "INSERT INTO emissions_data (region_code, year, total_kt, per_capita_kg, stationary_kt, mobile_kt) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (region_code, year) DO NOTHING",
                    (code, year, val["total_kt"], val["per_capita_kg"], val["stationary_kt"], val["mobile_kt"]),
                )
            for year, count in r.get("births", {}).items():
                cur.execute(
                    "INSERT INTO births_data (region_code, year, count) VALUES (%s, %s, %s) ON CONFLICT (region_code, year) DO NOTHING",
                    (code, year, count),
                )

        conn.commit()
        print("Seed complete.")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
