"""Build tenor/data/cases.json. Every value is wrapped with its data-quality label:
S = sourced (stated in a source that was opened and checked),
D = derived (calculated from sourced values, method in note),
A = assumed (no source found; reason in note)."""
import json, sys

def S(v, src, note=None):
    d = {"value": v, "quality": "sourced", "source": src}
    if note: d["note"] = note
    return d

def D(v, note, src=None):
    d = {"value": v, "quality": "derived", "note": note}
    if src: d["source"] = src
    return d

def A(v, note):
    return {"value": v, "quality": "assumed", "note": note}

WB_API = "https://search.worldbank.org/api/v3/projects?id={}&format=json"
cases = []

# 1 ---------------------------------------------------------------- TRIMING
cases.append({
  "id": "ng-triming-irrigation",
  "name": "Transforming Irrigation Management in Nigeria (TRIMING)",
  "sponsor": "Federal Government of Nigeria",
  "country": "Nigeria",
  "sector": "irrigation",
  "sub_sector": "Rehabilitation of large public irrigation schemes (rice and other crops)",
  "stage": "new",
  "concept": "Rehabilitate dams and canals in four large public irrigation schemes in northern Nigeria, set up water users' associations and help farmers raise yields.",
  "revenue_model": "Public project. Benefits are the extra crop farmers grow with reliable water, plus any irrigation service fees. The scheme owner does not sell the crop.",
  "currency": "USD",
  "fx": None,
  "revenue_split": {"domestic_pct": A(100, "Rice from these schemes is sold in Nigeria. No export share was found.")},
  "drivers": {
    "hectares": S(43400, "s2", "World Bank: the project 'modernized 43,400 hectares of farmland'."),
    "crop": A("Rice", "Rice is the main crop farmers describe in the World Bank feature. Other crops are grown but not quantified."),
    "harvests_per_year": A(2, "Assumes a wet and a dry season crop once water is reliable."),
    "yield_without": D(2.2, "From a farmer's account of 15 to 20 bags per acre before the project (mid-point 17.5), assuming 50 kg bags of paddy and 2.471 acres per hectare.", "s2"),
    "yield_per_ha": D(4.0, "From the same farmer's 30 to 35 bags per acre after the project (mid-point 32.5), assuming 50 kg bags. One farmer's account, not a project-wide average.", "s2"),
    "price_per_tonne": A(350, "Illustrative paddy price in USD. Nigerian paddy prices vary widely with the exchange rate. Replace with a current local price."),
    "losses_pct": A(10, "Typical allowance for post-harvest losses in smallholder rice."),
    "water_fee_per_ha": A(0, "No irrigation service fee figure was found, so fees are left out.")
  },
  "capex": [
    {"label": "Total project cost (all components)", "class": "irrigation", "amount": S(560300030, "s1", "World Bank Projects API field 'lendprojectcost'.")}
  ],
  "capex_split_note": "The split between dam safety, scheme rehabilitation, farmer support and management was not found in the sources opened, so the whole cost is treated as irrigation infrastructure.",
  "opex": {
    "fixed": [{"label": "Operation and maintenance", "amount": A("2% of capex a year", "Common planning allowance for canal and pump maintenance.")}],
    "variable": [{"label": "Extra growing costs per hectare per harvest", "amount": A(250, "Illustrative cost of extra seed, fertiliser and labour for a second crop.")}]
  },
  "historicals": None,
  "financing": {
    "structure": "DFI loan with government counterpart funding",
    "instruments": [
      {"type": "loan", "provider": "International Development Association (World Bank)", "provider_type": "dfi",
       "amount": S(504250816, "s1", "World Bank Projects API field 'idacommamt' (total IDA commitment)."),
       "currency": "USD",
       "tenor_years": A(30, "IDA credit terms were not in the sources opened. Assumes long concessional terms."),
       "grace_years": A(5, "Assumed concessional grace period."),
       "interest_rate_pct": A(2.0, "Assumed all-in concessional rate including service charge. Not confirmed."),
       "repayment_type": A("equal_principal", "Assumed.")},
      {"type": "equity", "provider": "Federal Government of Nigeria (counterpart funding)", "provider_type": "sovereign",
       "amount": D(56049214, "Total project cost less IDA commitment (560,300,030 minus 504,250,816).", "s1"), "currency": "USD"}
    ]
  },
  "timeline": {
    "approval_date": S("2014-06-19", "s1"),
    "closing_date": S("2025-06-30", "s1"),
    "construction_years": A(3, "Assumes three years of works before full benefits.")
  },
  "outcomes": {
    "schemes": S(["Kano River", "Hadejia Valley", "Bakolori", "Dadin Kowa"], "s2"),
    "water_users_associations": S("Over 800 established or strengthened", "s2"),
    "people_fed": S("Enough food to feed a million people", "s2")
  },
  "sources": [
    {"id": "s1", "title": "Transforming Irrigation Management in Nigeria Project (P123112), project record", "url": WB_API.format("P123112"), "publisher": "World Bank", "date": "accessed 2026-11-13", "supports": "Approval and closing dates, total project cost, IDA commitment"},
    {"id": "s2", "title": "How smarter irrigation is changing Nigerian farming", "url": "https://www.worldbank.org/en/news/feature/2025/10/15/how-smarter-irrigation-is-changing-nigerian-farming", "publisher": "World Bank", "date": "2025-10-15", "supports": "Hectares, schemes, water users' associations, farmer yield account"}
  ],
  "caveats": ["The World Bank feature gives two different areas for one community (6,000 and over 15,000 hectares). Only the project-wide 43,400 hectares is used.", "Yields come from one farmer's account and are illustrative."]
})

# 2 ---------------------------------------------------------------- Rwanda Exim irrigation
cases.append({
  "id": "rw-exim-india-irrigation",
  "name": "Mugesera and Rweru irrigation schemes (Exim Bank of India line of credit)",
  "sponsor": "Government of Rwanda, through the Rwanda Agriculture and Animal Resources Development Board",
  "country": "Rwanda",
  "sector": "irrigation",
  "sub_sector": "New irrigation schemes for high-value crops",
  "stage": "new",
  "concept": "Build irrigation schemes in Eastern Province so farmers can grow high-value crops in three seasons a year, financed by a US$100 million Government of India line of credit through Exim Bank of India.",
  "revenue_model": "Public project. Benefits are the extra crop value farmers earn. The loan is repaid by the Government of Rwanda.",
  "currency": "USD",
  "fx": None,
  "revenue_split": {"domestic_pct": A(100, "No export share was found. High-value crops could be exported, so this is conservative.")},
  "drivers": {
    "hectares": D(6500, "Mugesera target of 3,500 hectares plus Rweru target of 3,000 hectares, as reported in 2021.", "s2"),
    "crop": A("High-value horticulture", "The source says 'high value crops' without naming them."),
    "harvests_per_year": S(3, "s2", "'three seasons a year with high value crops'."),
    "yield_without": A(1.5, "Assumed rain-fed baseline, in tonnes per hectare per season."),
    "yield_per_ha": A(10, "Assumed irrigated vegetable yield in tonnes per hectare per season. Replace with crop-specific data."),
    "price_per_tonne": A(250, "Illustrative farm-gate price in USD for mixed vegetables."),
    "losses_pct": A(15, "Higher loss allowance for perishable horticulture."),
    "water_fee_per_ha": A(0, "No water fee figure found.")
  },
  "capex": [
    {"label": "Irrigation works and equipment (loan-financed)", "class": "irrigation", "amount": S(100000000, "s1", "Line of credit amount.")},
    {"label": "Government contribution (land, studies, supervision)", "class": "other", "amount": A(10000000, "Assumes the government funds about 10% on top of the loan. Not found in sources.")}
  ],
  "opex": {
    "fixed": [{"label": "Operation and maintenance", "amount": A("2% of capex a year", "Planning allowance.")}],
    "variable": [{"label": "Extra growing costs per hectare per season", "amount": A(600, "Illustrative cost for irrigated horticulture.")}]
  },
  "historicals": None,
  "financing": {
    "structure": "Exim Bank line of credit (tied to Indian goods and services) plus government funds",
    "instruments": [
      {"type": "loan", "provider": "Exim Bank of India (Government of India supported line of credit)", "provider_type": "exim",
       "amount": S(100000000, "s1"), "currency": "USD",
       "tenor_years": A(25, "Category I terms under India's IDEAS scheme are 25 years including a 5-year moratorium (s3). Which category applied to this 2018 agreement was not found, so this is an assumption."),
       "grace_years": A(5, "IDEAS terms include a 5-year moratorium for all categories (s3)."),
       "interest_rate_pct": A(1.5, "IDEAS Category I fixed rate is 1.5% a year (s3). Category II is 1.75%. Not confirmed for this loan."),
       "repayment_type": A("equal_principal", "Assumed."),
       "conditions": S("At least 75% of the contract value must be supplied from India", "s1")}
    ]
  },
  "timeline": {
    "agreement_date": S("2018-07-23", "s1"),
    "effective_date": S("2019-04-02", "s1"),
    "planned_duration_years": S(4, "s2", "'supposed to be complete in four years'."),
    "status_2021": S("Not started by August 2021. Rweru proposed to replace Warufu and Nyamukana, pending lender approval.", "s2")
  },
  "outcomes": {"farmers": S("About 6,000 farmers in Bugesera and Ngoma", "s2")},
  "sources": [
    {"id": "s1", "title": "Exim Bank's Government of India supported Line of Credit of USD 100 million to the Government of the Republic of Rwanda (A.P. (DIR Series) Circular No. 30)", "url": "https://www.rbi.org.in/Scripts/NotificationUser.aspx?ID=11539", "publisher": "Reserve Bank of India", "date": "2019-04-18", "supports": "Loan amount, agreement and effective dates, projects, 75% Indian content rule"},
    {"id": "s2", "title": "$100m irrigation schemes face financing setback", "url": "https://www.newtimes.co.rw/article/188199/News/100m-irrigation-schemes-face-financing-setback/amp", "publisher": "The New Times", "date": "2021-08-03", "supports": "Hectares, seasons per year, status, farmers, duration"},
    {"id": "s3", "title": "Government of India supported Lines of Credit Programme under IDEAS", "url": "https://events.development.asia/sites/default/files/materials/2024/09/202409-government-india-supported-lines-credit-programme-under-ideas.pdf", "publisher": "Exim Bank of India (presentation at an ADB seminar)", "date": "2024-09-27", "supports": "Standard LOC tenor, moratorium and interest rate by country category"}
  ],
  "caveats": ["The brief asked for an Exim irrigation case with about a 10-year tenor. Real Government of India lines of credit run 15 to 25 years including a 5-year moratorium, so the real structure is used.", "Original scope covered Warufu, Nyamukana and Mugesera. The 2021 report says the scope was being changed to Mugesera and Rweru."]
})

# 3 ---------------------------------------------------------------- Olam
cases.append({
  "id": "ng-olam-rukubi-rice",
  "name": "Olam integrated rice farm and mill, Rukubi",
  "sponsor": "Olam (Nigeria)",
  "country": "Nigeria",
  "sector": "crops",
  "sub_sector": "Irrigated rice farm with integrated mill and outgrower scheme",
  "stage": "new",
  "concept": "A large mechanised and irrigated paddy farm with its own parboiling and milling plant, plus support for surrounding smallholder outgrowers, selling rice into Nigeria's domestic market.",
  "revenue_model": "Sales of milled rice to the domestic market, from own paddy and paddy bought from outgrowers.",
  "currency": "NGN",
  "fx": {"usd_rate": A(160, "Assumed naira per US dollar around 2014, when the investment figure was reported. Used only to show USD equivalents."), "revenue_currency": "NGN", "debt_currency": None},
  "revenue_split": {"domestic_pct": S(100, "s1", "Mill output is for 'the domestic market'.")},
  "drivers": {
    "hectares": S(10000, "s1", "Full planned farm area. Tenor models the farm at full size with a ramp-up."),
    "hectares_cultivated_2014": S(3000, "s1", "'3,000 hectares are already under cultivation'."),
    "crop": S("Rice", "s1"),
    "harvests_per_year": S(2, "s1", "'over two annual crop cycles'."),
    "yield_per_ha": D(5, "Factsheet expects 10 tonnes per hectare a year over two crop cycles, so 5 tonnes per harvest.", "s1"),
    "milled_output_tpy": S(36000, "s1", "'36,000 metric tonnes (MT) of milled rice per annum'."),
    "price_per_tonne": A(70000, "Illustrative paddy value in naira per tonne at 2014 prices (about US$440 at the assumed rate). Not from the source. Milling margin is not modelled separately."),
    "losses_pct": A(8, "Lower loss allowance for a mechanised farm with on-site drying."),
    "employees_farm": S(1044, "s1"),
    "employees_mill": S(959, "s1"),
    "outgrowers": S(3000, "s1", "Target of 16,000 by 2018, then 20,000.")
  },
  "capex": [
    {"label": "Farm development, irrigation and mill (investment to date)", "class": "irrigation", "amount": S(18000000000, "s1", "'Over Naira 18 billion' invested to date. Treated as the full capex.")}
  ],
  "capex_split_note": "The factsheet gives only the total. It lists 375.9 km of irrigation canals, 372.5 km of drains and 269.6 km of roads, which suggests most of the cost is land and water infrastructure.",
  "opex": {
    "fixed": [{"label": "Farm and mill overheads", "amount": A(900000000, "Illustrative naira overheads for about 2,000 staff. Not from the source.")}],
    "variable": [{"label": "Growing costs per hectare per harvest", "amount": A(90000, "Illustrative naira cost. Not from the source.")}]
  },
  "historicals": None,
  "financing": {
    "structure": "Own money (company balance sheet)",
    "instruments": [
      {"type": "equity", "provider": "Olam", "provider_type": "own",
       "amount": S(18000000000, "s1"), "currency": "NGN",
       "note": "No outside lender is named in the source. Treated as funded from Olam's own balance sheet, which is an assumption."}
    ]
  },
  "timeline": {
    "project_start": S("2011-10-21", "s1"),
    "land_development_start": S("2012-01", "s1"),
    "first_crop": S("2012-11", "s1", "First crop cycle, 952 hectares.")
  },
  "outcomes": {"canals_km": S(375.9, "s1"), "drains_km": S(372.5, "s1"), "roads_km": S(269.6, "s1")},
  "sources": [
    {"id": "s1", "title": "Olam integrated rice farm and mill factsheet", "url": "https://ipar.sn/wp-content/uploads/2024/08/OLAM-INTEGRATED-RICE-FARM-MILL-FACTSHEET-Key-Facts-Location-Rukubi-Doma-LGA-Nasarawa-State.pdf", "publisher": "Olam (hosted by IPAR)", "date": "about 2014 (fourth crop cycle in progress, June 2014)", "supports": "Hectares, crop cycles, yield, mill output, investment, staff, outgrowers, dates"}
  ],
  "caveats": ["The factsheet is from about 2014. Later press reports give different farm and mill figures, which were not used.", "Financing structure is assumed. Treat this as the self-funded example."]
})

# 4 ---------------------------------------------------------------- Babban Gona
cases.append({
  "id": "ng-babban-gona-maize",
  "name": "Babban Gona farmer franchise",
  "sponsor": "Babban Gona Farmer Services Nigeria",
  "country": "Nigeria",
  "sector": "crops",
  "sub_sector": "Smallholder maize: inputs on credit, training and marketing",
  "stage": "trading",
  "concept": "A franchise model that gives smallholder maize farmers inputs on credit, training and help selling their crop, funded by development and impact lenders.",
  "revenue_model": "Margin on aggregated maize sales and service charges to member farmers. Lenders are repaid from farmers' loan repayments.",
  "currency": "NGN",
  "fx": {"usd_rate": A(1500, "Assumed naira per US dollar for illustration. Debt is in US dollars and revenue in naira, so a weaker naira raises the cost of repayment."), "revenue_currency": "NGN", "debt_currency": "USD"},
  "revenue_split": {"domestic_pct": A(100, "Maize is sold in Nigeria.")},
  "drivers": {
    "farmers": S(37000, "s1", "'37,000 Smallholder farmers supported in 2020 alone'."),
    "hectares": D(37000, "Assumes about 1 hectare per member farmer.", "s1"),
    "crop": S("Maize", "s2", "'the premier maize producer in Nigeria'."),
    "harvests_per_year": A(1, "One rain-fed maize season assumed."),
    "yield_per_ha": A(4, "The FMO page says yields reach up to 2 times the national average. Assumes about 4 tonnes per hectare."),
    "price_per_tonne": A(100000, "Babban Gona's own income per tonne of member maize it handles (recovery of input loans plus a service margin), not the market price of maize. Illustrative, set so the model is consistent with the 99.9% loan repayment rate the source reports."),
    "market_price_per_tonne": A(450000, "Illustrative naira maize market price, for context only."),
    "losses_pct": A(8, "Assumed."),
    "loan_repayment_rate_pct": S(99.9, "s2", "'a 99.9% loan repayment rate'."),
    "income_uplift": S("Up to 3.5 times the national average", "s2")
  },
  "capex": [
    {"label": "Warehouses and aggregation centres", "class": "civil_works", "amount": A(2500000000, "Illustrative naira figure. Not from sources.")}
  ],
  "opex": {
    "fixed": [{"label": "Field staff and overheads", "amount": A(1200000000, "Illustrative naira figure.")}],
    "variable": [{"label": "Inputs supplied on credit per hectare", "amount": A(250000, "Illustrative naira input package per hectare.")}]
  },
  "historicals": None,
  "financing": {
    "structure": "Development and impact debt",
    "instruments": [
      {"type": "loan", "provider": "FMO (MASSIF fund)", "provider_type": "dfi", "amount": S(4000000, "s2"), "currency": "USD",
       "tenor_years": D(4, "FMO lists the investment as effective 27 June 2017 and ending 15 April 2021, just under four years.", "s2"),
       "grace_years": A(1, "Assumed."), "interest_rate_pct": A(9, "Assumed USD rate for a DFI loan to an agribusiness. Not found."),
       "repayment_type": A("equal_principal", "Assumed.")},
      {"type": "subordinated_loan", "provider": "Global Innovation Fund", "provider_type": "impact_debt", "amount": S(2500000, "s1"), "currency": "USD",
       "tenor_years": A(4, "GIF lists the investment period as 2017 to 2021."), "grace_years": A(2, "Assumed."),
       "interest_rate_pct": A(6, "Assumed. The source says the agreement included a financial incentive linked to farmer impact."),
       "repayment_type": A("bullet", "Assumed for subordinated debt.")}
    ]
  },
  "timeline": {"fmo_effective": S("2017-06-27", "s2"), "fmo_end": S("2021-04-15", "s2"), "gif_agreement_year": S(2017, "s1")},
  "outcomes": {"people_impacted": S("550,000 individuals impacted to date", "s1"), "goal": S("Scale and impact one million smallholder farmers by 2025", "s2")},
  "sources": [
    {"id": "s1", "title": "Babban Gona (investment profile)", "url": "https://www.globalinnovation.fund/investments/babban-gona", "publisher": "Global Innovation Fund", "date": "investment period 2017 to 2021", "supports": "US$2.5m subordinated debt, farmers supported in 2020, people impacted"},
    {"id": "s2", "title": "Babban Gona Farmer Services Nigeria (project detail 51738)", "url": "https://www.fmo.nl/project-detail/51738", "publisher": "FMO", "date": "effective 2017-06-27", "supports": "US$4m loan, dates, yield and income uplift, repayment rate, maize focus"}
  ],
  "caveats": ["A 2025 British International Investment debt commitment was reported in the press, but its page could not be opened, so it is left out.", "Farm economics are illustrative. Only the financing and impact figures are sourced."]
})

# 5 ---------------------------------------------------------------- Kagera
cases.append({
  "id": "tz-kagera-sugar-equipment",
  "name": "Kagera Sugar farm equipment purchase",
  "sponsor": "Kagera Sugar Limited",
  "country": "Tanzania",
  "sector": "crops",
  "sub_sector": "Sugarcane estate mechanisation",
  "stage": "trading",
  "concept": "A sugar estate buys US-made agricultural equipment, financed by a loan guaranteed by the Export-Import Bank of the United States.",
  "revenue_model": "Sugarcane grown on the estate and sold to the company's own mill. The equipment is meant to raise output and cut field costs.",
  "currency": "USD",
  "fx": {"usd_rate": A(2600, "Assumed Tanzanian shillings per US dollar. Revenue is in shillings and the loan in dollars."), "revenue_currency": "TZS", "debt_currency": "USD"},
  "revenue_split": {"domestic_pct": A(100, "Sugar sold in Tanzania assumed.")},
  "drivers": {
    "hectares": A(1500, "Illustrative area served by the new equipment. Not from the source."),
    "crop": A("Sugarcane", "Implied by the buyer, a sugar company."),
    "harvests_per_year": A(1, "Sugarcane is harvested about once a year."),
    "yield_per_ha": A(90, "Illustrative cane yield in tonnes per hectare."),
    "price_per_tonne": A(35, "Illustrative cane value in USD per tonne."),
    "losses_pct": A(5, "Assumed.")
  },
  "capex": [
    {"label": "Agricultural equipment from Rome Plow Company", "class": "equipment", "amount": D(6940000, "Guaranteed loan of US$5.9m plus an assumed 15% buyer deposit. The deposit is an assumption, common in export credit deals.", "s1")}
  ],
  "opex": {
    "fixed": [{"label": "Equipment operators and maintenance", "amount": A(400000, "Illustrative.")}],
    "variable": [{"label": "Field costs per hectare", "amount": A(1100, "Illustrative.")}]
  },
  "historicals": None,
  "financing": {
    "structure": "Equipment financing guaranteed by an export credit agency",
    "instruments": [
      {"type": "equipment_loan", "provider": "Commercial lender with a US EXIM guarantee", "provider_type": "exim", "amount": S(5900000, "s1"), "currency": "USD",
       "tenor_years": A(5, "Assumed medium-term tenor for agricultural equipment. Not stated."), "grace_years": A(1, "Assumed six months before the first repayment, rounded up to one year because Tenor's model is annual."),
       "interest_rate_pct": A(7.5, "Assumed USD rate including the guarantee fee. Not stated."), "repayment_type": A("annuity", "Assumed.")},
      {"type": "equity", "provider": "Kagera Sugar (deposit)", "provider_type": "own", "amount": D(1040000, "Assumed 15% deposit on the equipment cost."), "currency": "USD"}
    ]
  },
  "timeline": {"date": A("not stated", "The EXIM page lists the deal without a date.")},
  "outcomes": {},
  "sources": [
    {"id": "s1", "title": "Sub-Saharan Africa (EXIM special initiatives, Tanzania success story)", "url": "https://www.exim.gov/about/special-initiatives/africa", "publisher": "Export-Import Bank of the United States", "date": "undated page, accessed 2026-11-13", "supports": "US$5.9m loan guarantee, supplier and buyer"}
  ],
  "caveats": ["Only the guarantee amount, supplier and buyer are sourced. Everything else is illustrative, so this case mainly shows the equipment-financing structure."]
})

# 6 ---------------------------------------------------------------- Zambeef
zk = "s1"
cases.append({
  "id": "zm-zambeef-integrated",
  "name": "Zambeef Products (integrated meat, dairy and cropping)",
  "sponsor": "Zambeef Products plc (listed in Lusaka and London)",
  "country": "Zambia",
  "sector": "livestock",
  "sub_sector": "Integrated beef, chicken, pork, dairy, stockfeed, cropping and retail",
  "stage": "trading",
  "concept": "An already-trading, vertically integrated food company that grows grain, feeds and processes animals and sells through its own shops. It is expanding capacity with a US$100 million medium-term plan.",
  "revenue_model": "Sales of meat, dairy, flour, stockfeed and crops through its own outlets and wholesale.",
  "currency": "ZMW",
  "fx": {"usd_rate": D(24.73, "Implied average rate: operating profit of ZMW 487.2m reported as USD 19.7m.", zk), "revenue_currency": "ZMW", "debt_currency": "ZMW",
         "depreciation_pct_year": S(26, zk, "Kwacha depreciated 26% against the US dollar in the year.")},
  "revenue_split": {"domestic_pct": A(95, "The company operates mainly in Zambia, with some West African retail. No export split was given.")},
  "drivers": {
    "cattle_slaughter_capacity": S(230000, zk, "Cattle a year."),
    "broiler_capacity": S(10600000, zk, "Broilers a year."),
    "pig_slaughter_capacity": S(75000, zk),
    "dairy_litres_per_day": S(120000, zk),
    "irrigated_crop_hectares": S(7787, zk, "Planted twice a year."),
    "rainfed_crop_hectares": S(8694, zk),
    "retail_outlets": S(236, zk),
    "inflation_pct": S(15.6, zk, "Inflation at the end of the period.")
  },
  "capex": [
    {"label": "Medium-term expansion plan (cropping, milling, stockfeed, dairy, poultry)", "class": "plant", "currency": "USD", "amount": S(100000000, zk, "'our $100 million medium-term expansion plans', in USD.")}
  ],
  "opex": {"note": "Use the historical income statement below as the cost base."},
  "historicals": {
    "units": "ZMW thousands, years ended 30 September, audited (group)",
    "source": zk,
    "FY2023": {"revenue": 6046157, "fair_value_biological_assets": 643197, "cost_of_sales": -4846092, "gross_profit": 1843262, "administrative_expenses": -1336486, "distribution_expenses": -96287, "operating_profit": 361357, "net_finance_costs": -155089, "profit_before_tax": 203673, "tax": -72851, "profit_continuing": 130822, "property_plant_equipment": 4818533, "cash": 271222, "long_term_debt": 687679, "short_term_debt": 972827, "equity": 4677126, "total_assets": 7704368, "operating_cash_flow": 177691, "investing_cash_flow": -813270, "financing_cash_flow": 382820},
    "FY2024": {"revenue": 7315845, "fair_value_biological_assets": 1040358, "cost_of_sales": -5881085, "gross_profit": 2475118, "administrative_expenses": -1682765, "distribution_expenses": -208395, "operating_profit": 487192, "net_finance_costs": -294531, "profit_before_tax": 192661, "tax": -12565, "profit_continuing": 180096, "property_plant_equipment": 5577265, "cash": 334415, "long_term_debt": 856362, "short_term_debt": 1525671, "equity": 4957940, "total_assets": 8812498, "operating_cash_flow": 171351, "investing_cash_flow": -805971, "financing_cash_flow": 622097}
  },
  "financing": {
    "structure": "Bank borrowings plus retained earnings",
    "instruments": [
      {"type": "loan", "provider": "Banks (long-term interest-bearing liabilities)", "provider_type": "commercial_bank", "amount": S(856362000, zk, "Long-term interest-bearing liabilities at 30 Sept 2024, in ZMW."), "currency": "ZMW",
       "tenor_years": A(5, "Not disclosed in the results announcement."), "grace_years": A(1, "Assumed."),
       "interest_rate_pct": D(14.6, "Net finance costs of ZMW 294.5m divided by average total interest-bearing debt over the year (about ZMW 2,021m). Rough, because finance costs include other items.", zk),
       "repayment_type": A("equal_principal", "Assumed.")},
      {"type": "loan", "provider": "Banks (short-term interest-bearing liabilities)", "provider_type": "commercial_bank", "amount": S(1525671000, zk, "Short-term interest-bearing liabilities, in ZMW."), "currency": "ZMW",
       "tenor_years": A(3, "Short-term facilities are rolled over in practice. Tenor spreads repayment over 3 years rather than assuming all of it is repaid in one year."), "grace_years": A(0, "Assumed."), "interest_rate_pct": D(14.6, "Same derived average rate.", zk), "repayment_type": A("equal_principal", "Assumed.")}
    ]
  },
  "timeline": {"results_date": S("2024-12-10", zk)},
  "outcomes": {"note": S("Interest expenses doubled, mainly from more debt to fund expansion and higher rates.", zk)},
  "sources": [
    {"id": "s1", "title": "Zambeef Products plc full year 2024 financial results (SENS announcement)", "url": "https://luse.co.zm/wp-content/uploads/2024/12/SENS-Announcement-Zambeef-Products-Plc-FY-Results-2024-10.12.2024-FINAL.pdf", "publisher": "Zambeef Products plc, via the Lusaka Securities Exchange", "date": "2024-12-10", "supports": "Audited income statement, balance sheet and cash flow for FY2023 and FY2024, capacities, expansion plan, inflation and currency movement"}
  ],
  "caveats": ["Revenue includes fair value changes in biological assets as a separate line. Tenor treats it as part of gross profit, as the company does."]
})

# 7 ---------------------------------------------------------------- Sierra Leone RAIC
sl = "s1"
UA = 1.44467
cases.append({
  "id": "sl-rice-agro-industrial-cluster",
  "name": "Sierra Leone Rice Agro-Industrial Cluster (SL RAIC)",
  "sponsor": "Government of Sierra Leone, Ministry of Agriculture and Forestry",
  "country": "Sierra Leone",
  "sector": "agro_processing",
  "sub_sector": "Rice milling cluster with irrigated paddy supply",
  "stage": "new",
  "concept": "Build a cluster of privately operated rice mills with parboiling, destoning and packaging, supplied by smallholders on about 5,000 hectares of new irrigation, funded mainly by African Development Fund grants.",
  "revenue_model": "Private mill operators earn from milling and selling rice. Mill owners pay a lump sum and repay the non-grant part of their equipment.",
  "currency": "USD",
  "fx": {"ua_to_usd": S(UA, sl, "1 UA = USD 1.44467."), "revenue_currency": "SLE", "debt_currency": None},
  "revenue_split": {"domestic_pct": S(100, sl, "The project aims at rice self-sufficiency in Sierra Leone.")},
  "drivers": {
    "milling_units": S(7, sl, "Cluster to house 7 milling units of 2.5 to 5 tonnes per hour."),
    "capacity_tpy": D(26250, "7 units at an average 3.75 tonnes of paddy per hour, assuming 1,000 operating hours a year in a seasonal supply area.", sl),
    "utilisation_pct": A(60, "Assumed for a new cluster dependent on smallholder supply."),
    "conversion_pct": A(62, "Typical paddy to milled rice recovery for rubber-roll mills with parboiling."),
    "product_price": A(800, "Illustrative milled rice price in USD per tonne."),
    "input_price": A(380, "Illustrative paddy price in USD per tonne."),
    "byproduct_revenue_pct": A(3, "Bran and husk briquettes. The project includes briquetting equipment."),
    "irrigated_hectares": S(5000, sl, "'Development of irrigation schemes for about 5000 ha of land'."),
    "paddy_yield_before": S(2.8, sl, "Results framework baseline, tonnes per hectare."),
    "paddy_yield_target": S(3.5, sl, "Results framework target, tonnes per hectare."),
    "beneficiaries": S(35000, sl, "Active smallholder farmers.")
  },
  "capex": [
    {"label": "Enhancement of agricultural production systems", "class": "irrigation", "amount": S(13620000, sl, "US$ thousands 13,620 (Table 2.4a).")},
    {"label": "Green industrial (milling) cluster", "class": "plant", "amount": S(14862000, sl, "US$ thousands 14,862.")},
    {"label": "Capacity building and institutional strengthening", "class": "other", "amount": S(2736000, sl, "US$ thousands 2,736.")},
    {"label": "Project management", "class": "other", "amount": S(3442000, sl, "US$ thousands 3,442.")},
    {"label": "Physical and price contingencies", "class": "other", "amount": S(2126000, sl, "US$ thousands 1,026 plus 1,100.")}
  ],
  "opex": {
    "fixed": [{"label": "Cluster operations and maintenance", "amount": A(450000, "Illustrative USD a year for the cluster.")}],
    "variable": [{"label": "Energy and consumables per tonne of paddy", "amount": A(30, "Illustrative.")}]
  },
  "historicals": None,
  "financing": {
    "structure": "DFI grants with government and beneficiary in-kind contributions",
    "instruments": [
      {"type": "grant", "provider": "African Development Fund (ADF-15 and Transition Support Facility)", "provider_type": "dfi", "amount": S(30591000, sl, "UA 21.17 million, US$ thousands 30,591 (Table 2.4b)."), "currency": "USD"},
      {"type": "equity", "provider": "Government of Sierra Leone (in kind)", "provider_type": "sovereign", "amount": S(4799000, sl, "UA 3.32 million."), "currency": "USD"},
      {"type": "equity", "provider": "Beneficiaries (in kind)", "provider_type": "own", "amount": S(1396000, sl, "UA 0.97 million."), "currency": "USD"}
    ]
  },
  "timeline": {"appraisal_date": S("2021-08", sl)},
  "outcomes": {
    "firr_pct": S(21, sl), "npv_usd": S(13764912, sl, "Financial NPV, base case."),
    "eirr_pct": S(23, sl), "economic_npv_usd": S(16523827, sl),
    "discount_rate_pct": S(12, sl, "'opportunity cost of capital (12%)'.")
  },
  "sources": [
    {"id": "s1", "title": "Rice Agro Industrial Cluster (SL RAIC) Project, Sierra Leone: Project Appraisal Report", "url": "https://ewsdata.rightsindevelopment.org/files/documents/21/AFDB-P-SL-AA0-021.pdf", "publisher": "African Development Bank Group (copy hosted by the Early Warning System)", "date": "2021-08", "supports": "Costs by component, financing plan, exchange rate, hectares, yields, mills, FIRR, EIRR, NPV, discount rate, beneficiaries"}
  ],
  "caveats": ["The project is grant-funded, so it is the grant example in the library.", "Mill throughput hours, prices and recovery rate are assumptions. The appraisal's financial NPV is shown as the published benchmark, not recalculated.", "Tenor models only the mill cluster's own sales, so its returns come out far below the appraisal's 21% FIRR, which also counts farmers' extra paddy. This is a known limit of a single-business view of a public programme."]
})

# 8 ---------------------------------------------------------------- NEP
nep1, nep2 = "s1", "s2"
cases.append({
  "id": "ng-electrification-minigrids",
  "name": "Nigeria Electrification Project: solar hybrid mini-grids",
  "sponsor": "Rural Electrification Agency, Federal Government of Nigeria",
  "country": "Nigeria",
  "sector": "energy",
  "sub_sector": "Private solar hybrid mini-grids with capital subsidies",
  "stage": "new",
  "concept": "Private developers build and run about 850 solar hybrid mini-grids in unserved areas. IDA funds capital subsidies through a minimum-subsidy tender and per-connection performance grants, and developers bring private capital for the rest.",
  "revenue_model": "Developers sell power to homes and businesses through prepaid meters. Grants reduce upfront cost so tariffs can stay below full cost recovery.",
  "currency": "USD",
  "fx": {"usd_rate": A(1500, "Assumed naira per US dollar. Tariffs are collected in naira while much equipment is imported in dollars."), "revenue_currency": "NGN", "debt_currency": "USD"},
  "revenue_split": {"domestic_pct": S(100, nep1)},
  "drivers": {
    "mini_grids": S(850, nep1, "'It is expected that about 850 mini grids will be built by private firms'."),
    "connections": A(340000, "Assumes about 400 connections per mini-grid. Not stated in the document opened."),
    "kwh_per_connection_month": A(25, "Illustrative mix of homes and small businesses."),
    "tariff_per_kwh": A(0.5, "Illustrative tariff in USD. The document says rural tariffs must be cost-reflective, with NERC ceilings for systems over 100 kW."),
    "collection_pct": A(97, "Prepaid meters are required, so collection is assumed to be high."),
    "connection_grant": A(350, "The performance-based grant is paid per new connection, but the amount was not in the document opened.")
  },
  "capex": [
    {"label": "Mini-grid component total (all mini-grids)", "class": "solar", "amount": S(330000000, nep1, "'is about US$330 million, of which about US$150 million will be provided by IDA'.")}
  ],
  "opex": {
    "fixed": [{"label": "Operation and maintenance", "amount": A("3% of capex a year", "Planning allowance.")}],
    "variable": [{"label": "Diesel backup fuel per kWh", "amount": A(0.03, "Illustrative, in USD.")}]
  },
  "historicals": None,
  "financing": {
    "structure": "Blended: IDA-funded grants plus private developer capital",
    "instruments": [
      {"type": "grant", "provider": "IDA via the Rural Electrification Agency: minimum subsidy tender", "provider_type": "dfi", "amount": S(70000000, nep1), "currency": "USD"},
      {"type": "grant", "provider": "IDA via the Rural Electrification Agency: performance-based grants", "provider_type": "dfi", "amount": S(80000000, nep1), "currency": "USD"},
      {"type": "mixed", "provider": "Private developers (equity and commercial debt)", "provider_type": "commercial_bank", "amount": S(180000000, nep1, "'US$180 million of private capital will be leveraged'."), "currency": "USD",
       "split_note": "Assumes 40% developer equity and 60% commercial debt.",
       "tenor_years": A(7, "Assumed for commercial mini-grid debt."), "grace_years": A(1, "Assumed."), "interest_rate_pct": A(11, "Assumed USD rate."), "repayment_type": A("annuity", "Assumed.")}
    ],
    "programme_level": {
      "total_project_cost": S(765000000, nep1, "Total Project Cost 765.00 (US$ millions)."),
      "ida_credit": S(350000000, nep1),
      "commercial_financing": S(410000000, nep1),
      "borrower_contribution": S(5000000, nep1)
    }
  },
  "timeline": {"approval_date": S("2018-06-27", nep2), "closing_date": S("2024-12-31", nep2)},
  "outcomes": {"components": S({"mini_grids": 150, "standalone_solar": 75, "energizing_education": 105, "technical_assistance": 20}, nep1, "IDA allocation by component, US$ millions.")},
  "sources": [
    {"id": "s1", "title": "Nigeria Electrification Project (P161885): Combined Project Information Documents / Integrated Safeguards Data Sheet", "url": "https://documents1.worldbank.org/curated/en/493201525197708435/pdf/Project-Information-Document-Integrated-Safeguards-Data-Sheet-Nigeria-Electrification-Project-P161885.pdf", "publisher": "World Bank", "date": "2017-11-12 (approved for disclosure May 2018)", "supports": "Total cost and financing, component amounts, number of mini-grids, private capital, tariff rules"},
    {"id": "s2", "title": "Nigeria Electrification Project (P161885), project record", "url": WB_API.format("P161885"), "publisher": "World Bank", "date": "accessed 2026-11-13", "supports": "Approval and closing dates, total cost, IDA commitment"}
  ],
  "caveats": ["The document opened is the pre-appraisal information document. Allocations were later restructured, so figures reflect the original design.", "Per-mini-grid economics (connections, tariff, grant per connection) are assumptions."]
})

# 9 ---------------------------------------------------------------- Waltersmith
w1, w2, w3 = "s1", "s2", "s3"
cases.append({
  "id": "ng-waltersmith-modular-refinery",
  "name": "Waltersmith modular refinery, Ibigwe (phase 1)",
  "sponsor": "Waltersmith Petroman Oil (70%) and the Nigerian Content Development and Monitoring Board (30%)",
  "country": "Nigeria",
  "sector": "petroleum",
  "sub_sector": "Modular crude oil refinery",
  "stage": "new",
  "concept": "A 5,000 barrel-a-day modular refinery next to the company's own Ibigwe oil field, producing diesel, naphtha, kerosene and fuel oil for the Nigerian market.",
  "revenue_model": "Sales of refined products. Margin is the gap between product value and the cost of crude from the adjacent field.",
  "currency": "USD",
  "fx": {"usd_rate": A(1500, "Assumed naira per US dollar. Products may be priced in naira while crude and debt are in dollars."), "revenue_currency": "NGN", "debt_currency": "USD"},
  "revenue_split": {"domestic_pct": A(100, "Sources describe supply to the Nigerian market.")},
  "drivers": {
    "capacity_bpd": S(5000, w3, "First phase of 5,000 barrels a day."),
    "crude_throughput_bbl_year": S(1800000, w3, "'process about 1.8 million bbl crude and condensate annually'."),
    "utilisation_pct": D(99, "1.8 million barrels a year divided by 5,000 barrels a day times 365 days (1.825 million).", w3),
    "operating_days": A(330, "Allows for maintenance shutdowns."),
    "product_output_litres_year": S(271000000, w2, "'will produce 271 million liters of petroleum product annually'."),
    "products": S(["Diesel", "Naphtha", "Kerosene", "High-pour fuel oil"], w3),
    "product_value_per_bbl": A(90, "Illustrative weighted product value in USD per barrel processed."),
    "crude_cost_per_bbl": A(75, "Illustrative crude cost in USD per barrel, assuming a discount for crude from the adjacent field.")
  },
  "capex": [
    {"label": "Refinery phase 1 (implied total funding)", "class": "plant", "amount": D(68333333, "AFC debt of US$35m plus implied total equity of US$33.3m. Equity is derived from NCDMB's US$10m for 30%, assuming both shareholders paid the same price per share. Total cost was not found.", w1)}
  ],
  "opex": {
    "fixed": [{"label": "Staff, insurance and overheads", "amount": A(3000000, "Illustrative USD a year.")}],
    "variable": [{"label": "Processing cost per barrel", "amount": A(4, "Illustrative USD per barrel.")}]
  },
  "historicals": None,
  "financing": {
    "structure": "Sponsor equity, government agency equity and DFI debt",
    "instruments": [
      {"type": "loan", "provider": "Africa Finance Corporation", "provider_type": "dfi", "amount": S(35000000, w1), "currency": "USD",
       "tenor_years": A(7, "Terms not disclosed."), "grace_years": A(2, "Assumed to cover construction."), "interest_rate_pct": A(10, "Assumed USD rate."), "repayment_type": A("annuity", "Assumed.")},
      {"type": "equity", "provider": "Nigerian Content Development and Monitoring Board", "provider_type": "sovereign", "amount": S(10000000, w1, "US$10m equity investment agreement (2018)."), "currency": "USD", "stake_pct": S(30, w2)},
      {"type": "equity", "provider": "Waltersmith Petroman Oil", "provider_type": "own", "amount": D(23333333, "70% stake priced at the same rate as NCDMB's US$10m for 30%.", w2), "currency": "USD", "stake_pct": S(70, w2)}
    ]
  },
  "timeline": {"debt_signed": S("2018-07", w1), "commissioned": S("2020-11-24", w3), "next_phase": S("A further 45,000 barrels a day planned, 24 to 30 months", w2)},
  "outcomes": {"early_output": S("5 million litres delivered to the market soon after start-up", w2)},
  "sources": [
    {"id": "s1", "title": "AFC signs $35 million debt facility for Waltersmith refinery", "url": "https://nairametrics.com/2018/07/19/afc-35-million-debt-facility-for-waltersmith-refinery", "publisher": "Nairametrics", "date": "2018-07-19", "supports": "AFC debt amount, NCDMB US$10m equity, planned capacity"},
    {"id": "s2", "title": "Nigeria's 5,000 bpd refinery will produce 271 million litres of petroleum product every year", "url": "https://nairametrics.com/2020/11/24/nigerias-5000-bpd-refinery-will-produce-271-million-liters-of-petrol-every-year/", "publisher": "Nairametrics", "date": "2020-11-24", "supports": "Output, ownership split, next phase"},
    {"id": "s3", "title": "Waltersmith commissions phase 1 of grassroots Nigerian refinery", "url": "https://www.ogj.com/general-interest/article/14189111/waltersmith-commissions-phase-1-of-grassroots-nigerian-refinery", "publisher": "Oil & Gas Journal", "date": "2020-12-14", "supports": "Location, start-up date, products, crude throughput, crude source"}
  ],
  "caveats": ["Total project cost was not found. The capex figure is derived from the financing and should be treated as an estimate.", "No source confirms how much of the AFC facility was drawn."]
})

# 10 ---------------------------------------------------------------- Mailchimp
cases.append({
  "id": "us-mailchimp-selffunded",
  "name": "Mailchimp (self-funded software company)",
  "sponsor": "Mailchimp (privately held until its sale to Intuit)",
  "country": "United States",
  "sector": "tech",
  "sub_sector": "Subscription marketing software for small businesses",
  "stage": "trading",
  "concept": "Email and marketing software for small businesses that grew to 800,000 paid customers while privately held, then sold to Intuit for about US$12 billion.",
  "revenue_model": "Monthly subscriptions, with a free tier converting to paid plans.",
  "currency": "USD",
  "fx": None,
  "revenue_split": {"domestic_pct": S(50, "s1", "'50 percent of customers outside of the U.S.' Used as a proxy for revenue split.")},
  "drivers": {
    "total_users": S(13000000, "s1"),
    "monthly_active_users": S(2400000, "s1"),
    "starting_customers": S(800000, "s1", "Paid customers at the time of the deal (2021)."),
    "price_per_month": A(85, "Illustrative average revenue per paid customer a month. Mailchimp's revenue was not in the source opened."),
    "churn_pct_month": A(2, "Illustrative churn for small-business software."),
    "new_customers_month": A(25000, "Illustrative."),
    "cac": A(150, "Illustrative. Much growth came from the free tier."),
    "growth_pct_year": A(10, "Illustrative.")
  },
  "capex": [{"label": "Product and infrastructure (annual)", "class": "it", "amount": A(30000000, "Illustrative.")}],
  "opex": {"fixed": [{"label": "Team and overheads", "amount": A(240000000, "Illustrative: about 1,200 employees (sourced, s1) at an assumed US$200,000 fully loaded cost each.")}]},
  "historicals": None,
  "financing": {
    "structure": "Own money (no outside investors)",
    "instruments": [{"type": "equity", "provider": "Founders and retained earnings", "provider_type": "own", "amount": A(0, "No outside funding round was found. The source says the company is privately held, which is consistent with self-funding but does not prove it."), "currency": "USD"}]
  },
  "timeline": {"founded": S(2001, "s1"), "acquisition_announced": S("2021-09-13", "s1")},
  "outcomes": {"exit_value_usd": S(12000000000, "s1", "'total consideration of approximately $12 billion'."), "employees": S("1,200+", "s1")},
  "sources": [
    {"id": "s1", "title": "Intuit to acquire Mailchimp (press release, Exhibit 99.1 to Form 8-K)", "url": "https://www.sec.gov/Archives/edgar/data/896878/000119312521271682/d226456dex991.htm", "publisher": "Intuit Inc. via SEC EDGAR", "date": "2021-09-13", "supports": "Deal value, users, paid customers, employees, international share, founding year, private status"}
  ],
  "caveats": ["Revenue and costs are illustrative because the filing opened does not state them. The case shows how a self-funded subscription business grows, not Mailchimp's actual accounts."]
})

# 11 ---------------------------------------------------------------- uLesson
cases.append({
  "id": "ng-ulesson-seed",
  "name": "uLesson (seed-funded edtech)",
  "sponsor": "uLesson",
  "country": "Nigeria",
  "sector": "tech",
  "sub_sector": "Subscription learning app for secondary school students",
  "stage": "pre-revenue",
  "concept": "An app-based home learning kit with animated lessons for secondary school students in Anglophone West Africa, raising a seed round before launch.",
  "revenue_model": "Yearly subscription of about US$70 up front, or pay as you go.",
  "currency": "USD",
  "fx": {"usd_rate": A(1500, "Assumed naira per US dollar. Students pay in local currency."), "revenue_currency": "NGN", "debt_currency": None},
  "revenue_split": {"domestic_pct": A(70, "Launch planned in Nigeria, Ghana, Sierra Leone and Gambia. Assumes most early customers are in Nigeria. Sales to the other three are counted as export.")},
  "drivers": {
    "starting_customers": A(0, "Pre-launch at the time of the round."),
    "price_per_month": D(5.83, "About US$70 a year divided by 12.", "s1"),
    "new_customers_month": A(1500, "Illustrative early growth."),
    "churn_pct_month": A(3, "Illustrative, given yearly subscriptions."),
    "cac": A(25, "Illustrative, including counsellor network costs."),
    "growth_pct_year": A(60, "Illustrative."),
    "lesson_videos": S(3000, "s1", "'already created 3000 animated videos'."),
    "addressable_market": S("About 300 million people in Anglophone West Africa", "s1")
  },
  "capex": [{"label": "Content studio and product build", "class": "it", "amount": A(800000, "Illustrative share of the seed round spent on content and product.")}],
  "opex": {"fixed": [{"label": "Team and studio", "amount": A(1200000, "Illustrative yearly cost.")}]},
  "historicals": None,
  "financing": {
    "structure": "Seed round",
    "instruments": [{"type": "equity", "provider": "TLcom Capital (lead) and the founder", "provider_type": "angel_seed", "amount": S(3100000, "s1"), "currency": "USD",
                     "pre_money_valuation": A(9000000, "Not disclosed. Illustrative only, used to show dilution.")}]
  },
  "timeline": {"round_announced": S("2019-11-26", "s1"), "planned_launch": S("2020-02", "s1")},
  "outcomes": {},
  "sources": [
    {"id": "s1", "title": "uLesson African edtech startup raises $3.1M", "url": "https://techcrunch.com/2019/11/26/sim-shagayas-ulesson-african-edtech-startup-raises-3-1m/", "publisher": "TechCrunch", "date": "2019-11-26", "supports": "Round size, lead investor, price, product, markets, launch plan, content"}
  ],
  "caveats": ["No user numbers were in the source, so growth figures are illustrative."]
})

# 12 ---------------------------------------------------------------- Flutterwave
cases.append({
  "id": "ng-flutterwave-series-b",
  "name": "Flutterwave (venture-funded payments)",
  "sponsor": "Flutterwave",
  "country": "Nigeria and United States",
  "sector": "fintech",
  "sub_sector": "Payments infrastructure for businesses",
  "stage": "trading",
  "concept": "A payments platform that lets businesses accept and send payments across Africa, raising a venture Series B to expand into Francophone and North Africa.",
  "revenue_model": "A fee on each transaction processed.",
  "currency": "USD",
  "fx": {"usd_rate": A(1500, "Assumed naira per US dollar. Fees are earned in several currencies."), "revenue_currency": "multiple", "debt_currency": None},
  "revenue_split": {"domestic_pct": A(50, "Assumes half of revenue from Nigeria. Not stated.")},
  "drivers": {
    "transactions_processed": S(107000000, "s1", "Cumulative to January 2020."),
    "value_processed_usd": S(5400000000, "s1", "Cumulative value to January 2020."),
    "transactions_2017": S(14000000, "s1"),
    "value_2017_usd": S(1500000000, "s1"),
    "active_customers": A(10000, "Illustrative number of merchant customers."),
    "volume_per_customer": A(250000, "Illustrative annual payment volume per merchant."),
    "take_rate_pct": A(1.2, "Illustrative net fee. Not stated."),
    "loss_rate_pct": A(0.05, "Illustrative fraud and chargeback losses for a payment processor."),
    "customer_growth_pct": A(60, "Illustrative.")
  },
  "capex": [{"label": "Platform build", "class": "it", "amount": A(3000000, "Illustrative.")}],
  "opex": {"fixed": [{"label": "Team, compliance and overheads", "amount": A(12000000, "Illustrative.")}]},
  "historicals": None,
  "financing": {
    "structure": "Venture capital (Series B)",
    "instruments": [{"type": "equity", "provider": "Greycroft and eVentures (co-leads), with Green Visor and CRE Venture Capital", "provider_type": "venture", "amount": S(35000000, "s1"), "currency": "USD",
                     "pre_money_valuation": A(150000000, "Not disclosed. Illustrative only, used to show dilution.")}]
  },
  "timeline": {"round_announced": S("2020-01-21", "s1"), "founded": S(2016, "s1")},
  "outcomes": {"partners": S("Worldpay and Visa partnerships announced with the round", "s1")},
  "sources": [
    {"id": "s1", "title": "Flutterwave raises $35 million in Series B funding", "url": "https://nairametrics.com/2020/01/21/flutterwave-raises-35-million-in-series-b-funding/", "publisher": "Nairametrics", "date": "2020-01-21", "supports": "Round size, investors, transactions and value processed, expansion plans, founding year"}
  ],
  "caveats": ["Revenue drivers are illustrative. Reports differ on the transaction count (100 million or 107 million). The source opened says 107 million."]
})

# 13 ---------------------------------------------------------------- M-KOPA
m1, m2 = "s1", "s2"
cases.append({
  "id": "ke-mkopa-paygo",
  "name": "M-KOPA (pay-as-you-go asset finance)",
  "sponsor": "M-KOPA",
  "country": "Kenya, Uganda, Nigeria and Ghana",
  "sector": "fintech",
  "sub_sector": "Pay-as-you-go financing for smartphones, solar and motorbikes",
  "stage": "trading",
  "concept": "Customers pay a deposit, take a smartphone, solar kit or electric motorbike, and pay small daily amounts until they own it. Growth is funded by equity and a large sustainability-linked debt facility.",
  "revenue_model": "Financing income built into daily payments on assets sold on credit.",
  "currency": "USD",
  "fx": {"usd_rate": A(130, "Assumed Kenyan shillings per US dollar. Debt is mainly in dollars and repayments in local currencies."), "revenue_currency": "multiple", "debt_currency": "USD"},
  "revenue_split": {"domestic_pct": A(60, "Assumes Kenya is about 60% of business. Not stated.")},
  "drivers": {
    "active_customers": S(3000000, m1, "'reached three million customers'."),
    "cumulative_financing_usd": S(1000000000, m1, "'$1 billion in cumulative financing'."),
    "volume_per_customer": D(333, "US$1bn cumulative financing divided by 3 million customers, used as an average amount financed per customer.", m1),
    "take_rate_pct": A(35, "Illustrative financing margin over the life of a pay-as-you-go contract."),
    "loss_rate_pct": A(8, "Illustrative credit loss rate."),
    "customer_growth_pct": D(85, "Compound annual growth in new customer acquisition 2020 to 2022, used as a growth proxy.", m2),
    "cac": A(20, "Illustrative.")
  },
  "capex": [{"label": "Platform and devices management", "class": "it", "amount": A(10000000, "Illustrative.")}],
  "opex": {"fixed": [{"label": "Team, field agents and overheads", "amount": A(60000000, "Illustrative.")}]},
  "historicals": None,
  "financing": {
    "structure": "Equity plus sustainability-linked debt",
    "instruments": [
      {"type": "loan", "provider": "Standard Bank Group (lead), with IFC, Mirova SunFunder, Nithio and others", "provider_type": "commercial_bank", "amount": S(200000000, m1, "'over $200 million in debt financing'."), "currency": "USD",
       "tenor_years": A(4, "Not disclosed."), "grace_years": A(1, "Assumed."), "interest_rate_pct": A(11, "Not disclosed. Pricing is linked to environmental and social targets (s2)."), "repayment_type": A("annuity", "Assumed. Borrowing-base facility in reality.")},
      {"type": "equity", "provider": "Sumitomo Corporation (lead, US$36.5m) and others", "provider_type": "venture", "amount": S(55000000, m1), "currency": "USD"}
    ]
  },
  "timeline": {"round_announced": S("2023-05-15", m1), "previous_round": S("US$75m growth equity, March 2022", m1)},
  "outcomes": {},
  "sources": [
    {"id": "s1", "title": "M-KOPA raises $250 million in equity and debt", "url": "https://techpoint.africa/news/m-kopa-25o-million-fundraise/", "publisher": "Techpoint Africa", "date": "2023-05-15", "supports": "Debt and equity amounts, lenders and investors, customers, cumulative financing, products, countries, previous round"},
    {"id": "s2", "title": "M-KOPA raises $250m to scale consumer fintech across Africa", "url": "https://businessday.ng/technology/article/m-kopa-raises-250m-to-scale-consumer-fintech-across-africa/", "publisher": "BusinessDay", "date": "2023-05-15", "supports": "Sustainability-linked debt pricing, customer acquisition growth rate, lender list"}
  ],
  "caveats": ["The two sources list slightly different lenders and equity investors."]
})

# 14 ---------------------------------------------------------------- IBBI quarry
cases.append({
  "id": "ug-ibbi-quarry-asphalt",
  "name": "IBBI granite quarry and asphalt plant",
  "sponsor": "IBBI (Ugandan construction and consultancy firm)",
  "country": "Uganda",
  "sector": "manufacturing",
  "sub_sector": "Crushed aggregates and asphalt for road building",
  "stage": "new",
  "concept": "Set up a granite quarry and an asphalt production plant using UK-made machinery, financed by a buyer loan guaranteed by UK Export Finance.",
  "revenue_model": "Sales of crushed stone and asphalt to road and construction projects.",
  "currency": "GBP",
  "fx": {"usd_rate": A(0.79, "Assumed pounds per US dollar."), "revenue_currency": "UGX", "debt_currency": "GBP"},
  "revenue_split": {"domestic_pct": A(100, "Uganda construction market assumed.")},
  "drivers": {
    "units_per_month": A(20000, "Illustrative tonnes of asphalt and aggregate a month, about a 100 tonne-an-hour plant running 200 hours a month. Plant capacity was not stated."),
    "utilisation_pct": A(55, "Illustrative, given lumpy demand from road contracts."),
    "price_per_unit": A(45, "Illustrative blended price in GBP per tonne."),
    "materials_per_unit": A(22, "Illustrative cost of bitumen, fuel and blasting per tonne.")
  },
  "capex": [{"label": "Asphalt plant, granite crusher, vehicles and logistics from Rainbo", "class": "plant", "amount": D(6220000, "UKEF-guaranteed loan of £5.29m plus an assumed 15% buyer deposit.", "s1")}],
  "opex": {"fixed": [{"label": "Staff, maintenance and site costs", "amount": A(600000, "Illustrative GBP a year.")}]},
  "historicals": None,
  "financing": {
    "structure": "Export credit buyer loan (UK Export Finance Standard Buyer Loan Guarantee)",
    "instruments": [
      {"type": "equipment_loan", "provider": "London Forfaiting Company, guaranteed by UK Export Finance", "provider_type": "exim", "amount": S(5290000, "s1"), "currency": "GBP",
       "tenor_years": A(5, "Not stated."), "grace_years": A(1, "Assumed six months, rounded up to one year because Tenor's model is annual."), "interest_rate_pct": A(8.5, "Assumed GBP rate including the guarantee premium."), "repayment_type": A("equal_principal", "Assumed. Export credit loans usually repay in equal instalments.")},
      {"type": "equity", "provider": "IBBI (deposit)", "provider_type": "own", "amount": D(930000, "Assumed 15% deposit."), "currency": "GBP"}
    ]
  },
  "timeline": {"announced": S("2025-08-12", "s1")},
  "outcomes": {},
  "sources": [
    {"id": "s1", "title": "From Crawley to Kampala: multimillion pound UKEF deal seals export win", "url": "https://www.gov.uk/government/news/from-crawley-to-kampala-multimillion-pound-ukef-deal-seals-export-win", "publisher": "UK Export Finance", "date": "2025-08-12", "supports": "Loan amount, lender, product, what the machinery is for, supplier"}
  ],
  "caveats": ["Only the financing and purpose are sourced. Output, prices and costs are illustrative."]
})

# 15 ---------------------------------------------------------------- ColdHubs
cases.append({
  "id": "ng-coldhubs-solar-cold-rooms",
  "name": "ColdHubs solar-powered cold rooms",
  "sponsor": "ColdHubs",
  "country": "Nigeria",
  "sector": "logistics",
  "sub_sector": "Pay-per-crate solar cold storage at markets and farms",
  "stage": "trading",
  "concept": "Walk-in solar-powered cold rooms at markets where farmers and traders pay a small daily fee per crate to keep produce fresh for much longer.",
  "revenue_model": "Daily flat fee per crate stored.",
  "currency": "NGN",
  "fx": {"usd_rate": A(370, "Assumed naira per US dollar around 2019, matching the source's fee conversion of about US$0.27 for 100 naira."), "revenue_currency": "NGN", "debt_currency": None},
  "revenue_split": {"domestic_pct": S(100, "s1")},
  "drivers": {
    "capacity_units": S(150, "s1", "'approximately 2 tons of perishable food (150 crates)' per hub."),
    "hubs": S(19, "s1", "'In 2019, 19 ColdHubs have been installed', with 40 planned."),
    "periods_per_year": A(365, "Daily fee."),
    "utilisation_pct": S(110, "s1", "Utilisation rate used in the ownership model. Above 100% because crates turn over during the day."),
    "rate_per_unit": S(100, "s1", "'cooling fee of 100 N/crate'."),
    "shelf_life_days": S("From 2 days to 21", "s2")
  },
  "capex": [{"label": "One solar cold hub", "class": "solar", "amount": D(11470000, "Mid-point of US$28,500 to US$33,500 installation cost (s1), at an assumed 370 naira per dollar.", "s1")}],
  "opex": {"fixed": [{"label": "Hub attendant and maintenance", "amount": A(1200000, "Illustrative naira a year per hub.")}]},
  "historicals": None,
  "financing": {
    "structure": "Grant",
    "instruments": [{"type": "grant", "provider": "Grant funders (pilot under Powering Agriculture: An Energy Grand Challenge)", "provider_type": "grant_funder", "amount": D(11470000, "Assumes one hub is fully grant-funded. Grant amounts were not stated.", "s1"), "currency": "NGN"}]
  },
  "timeline": {"data_year": S(2019, "s1")},
  "outcomes": {"published_model_irr_pct": S(48, "s1", "Ownership model over 20 years."), "published_model_dscr": S(1.36, "s1"),
               "household_income": S("612 users' household income rose from US$60 to US$120 a month", "s1")},
  "sources": [
    {"id": "s1", "title": "ColdHubs: Solar Cold Rooms in Nigeria", "url": "https://energypedia.info/wiki/ColdHubs_-_Solar_Cold_Rooms_in_Nigeria", "publisher": "energypedia", "date": "last edited 2019-12-05", "supports": "Hub capacity, installation cost, fee, utilisation, number of hubs, published IRR and DSCR, income uplift"},
    {"id": "s2", "title": "Our solution", "url": "https://coldhubs.com/our-solution/", "publisher": "ColdHubs", "date": "undated, accessed 2026-11-13", "supports": "Shelf-life extension, daily flat fee per crate"}
  ],
  "caveats": ["Figures are from 2019 and may be out of date.", "The wiki gives two inconsistent hub counts (5 and 19) and a food-saved figure that looks too high for five 2-tonne hubs. Neither of those questionable figures is used."]
})

# 16 ---------------------------------------------------------------- Lekki
l1, l2, l3 = "s1", "s2", "s3"
cases.append({
  "id": "ng-lekki-deep-sea-port",
  "name": "Lekki Deep Sea Port, phase 1",
  "sponsor": "Lekki Port LFTZ Enterprise (China Harbour Engineering Company, Tolaram, Lagos State and Nigerian Ports Authority)",
  "country": "Nigeria",
  "sector": "logistics",
  "sub_sector": "Container port under a 45-year concession",
  "stage": "new",
  "concept": "A deep-water container port near Lagos, built and run by a private consortium under a 45-year build, own, operate and transfer concession, financed with a large China Development Bank loan and sponsor equity.",
  "revenue_model": "Container handling and port charges per TEU (twenty-foot equivalent unit).",
  "currency": "USD",
  "fx": {"usd_rate": A(1500, "Assumed naira per US dollar. Port tariffs are usually set in dollars, which reduces currency risk on the dollar loan."), "revenue_currency": "USD", "debt_currency": "USD"},
  "revenue_split": {"domestic_pct": A(100, "Port services in Nigeria.")},
  "drivers": {
    "capacity_units": S(1200000, l1, "Phase 1 adds 1.2 million TEU of handling capacity (AidData). Templars gives 2.7 million TEU, which likely refers to the full port."),
    "periods_per_year": A(1, "Annual throughput."),
    "utilisation_pct": A(70, "Illustrative steady-state utilisation."),
    "rate_per_unit": A(250, "Illustrative average revenue per TEU in USD."),
    "variable_pct": A(10, "Illustrative variable cost share for a container terminal, which has high fixed and low variable costs."),
    "berths": S("Two 680-metre container berths, 16.5 metres deep", l2),
    "concession_years": S(45, l1)
  },
  "capex": [{"label": "Phase 1 total cost", "class": "civil_works", "amount": S(1043000000, l1, "'The total cost of Phase 1 is $1.043 billion'.")}],
  "opex": {"fixed": [{"label": "Port operations and maintenance", "amount": A(40000000, "Illustrative USD a year.")}]},
  "historicals": None,
  "financing": {
    "structure": "China Development Bank loan plus sponsor equity",
    "instruments": [
      {"type": "loan", "provider": "China Development Bank", "provider_type": "exim", "amount": S(629000000, l1), "currency": "USD",
       "tenor_years": A(16, "AidData says 'The borrowing terms of the loan are unknown.' Assumed long tenor for port infrastructure."),
       "grace_years": A(4, "Assumed to cover construction and ramp-up."), "interest_rate_pct": A(6, "Assumed."), "repayment_type": A("equal_principal", "Assumed."),
       "drawdowns": S("First tranche of US$60m received 29 April 2021", l3)},
      {"type": "equity", "provider": "China Harbour Engineering Company", "provider_type": "own", "amount": S(221047248, l1, "Direct equity investment, 30 March 2020."), "currency": "USD", "stake_pct": S(52.5, l1, "Indirect stake.")},
      {"type": "equity", "provider": "Other shareholders and other funding (Tolaram, Lagos State, Nigerian Ports Authority, other lenders)", "provider_type": "mixed", "amount": D(192952752, "Phase 1 cost less the CDB loan and CHEC's equity. AidData mentions other lenders without amounts, so this balancing figure is not split.", l1), "currency": "USD"}
    ]
  },
  "timeline": {"loan_signed": S("2019-10-23", l1), "handover": S("2022-10-24", l1)},
  "outcomes": {"shareholding": S({"CHEC": 52.5, "Tolaram": 22.5, "Lagos State": 20, "Nigerian Ports Authority": 5}, l1), "operator": S("CMA CGM subsidiary", l1)},
  "sources": [
    {"id": "s1", "title": "China Development Bank provides $629 million loan for Phase 1 of Lekki Deep Water Port Project", "url": "https://china.aiddata.org/projects/85628", "publisher": "AidData, William & Mary", "date": "accessed 2026-11-13", "supports": "Loan, total cost, equity, shareholding, concession, capacity, dates, operator, unknown loan terms"},
    {"id": "s2", "title": "Templars advises project sponsors on a US$629 million project financing for the Lekki Deep Sea Port project", "url": "https://www.templars-law.com/news/templars-advises-project-sponsors-on-a-us629-million-project-financing-for-the-lekki-deep-sea-port-project/", "publisher": "TEMPLARS", "date": "2019-10-28", "supports": "Berths and water depth, concession, sponsors"},
    {"id": "s3", "title": "Lekki port receives 1st tranche of $629 million loan from China Dev Bank", "url": "https://nairametrics.com/2021/05/04/lekki-port-receives-1st-tranche-of-629-million-loan-from-china-dev-bank/", "publisher": "Nairametrics", "date": "2021-05-04", "supports": "First drawdown"}
  ],
  "caveats": ["Capacity figures conflict between sources (1.2 million TEU for phase 1 versus 2.7 million TEU). The phase 1 figure is used.", "Loan terms are not public."]
})

# 17 ---------------------------------------------------------------- Lesotho
cases.append({
  "id": "ls-qmmh-health-ppp",
  "name": "Queen 'Mamohato Memorial Hospital and clinics PPP",
  "sponsor": "Tsepong consortium (led by Netcare with local investors), under contract to the Government of Lesotho",
  "country": "Lesotho",
  "sector": "health",
  "sub_sector": "National referral hospital and clinics under a public-private partnership",
  "stage": "new",
  "ramp_up": A([1], "Paid an annual fee for contracted patient volumes from opening, so there is no ramp-up in income."),
  "concept": "A private consortium designed, built, part-financed and now runs a 425-bed national referral hospital and three clinics, paid an annual fee by the government for up to 20,000 inpatients and 310,000 outpatients a year.",
  "revenue_model": "An annual payment from the government covering an agreed volume of patients.",
  "currency": "USD",
  "fx": {"usd_rate": A(18, "Assumed maloti per US dollar. Payments are in local currency."), "revenue_currency": "LSL", "debt_currency": "ZAR"},
  "revenue_split": {"domestic_pct": S(100, "s1")},
  "drivers": {
    "beds": S(425, "s1"),
    "contracted_inpatients": S(20000, "s1", "'up to 20,000 inpatients and 310,000 outpatients per year in exchange for a lump sum payment'."),
    "outpatient_visits": S(310000, "s1"),
    "actual_inpatients_2015": S(27000, "s1", "More than 27,000 in 2015."),
    "actual_outpatients_2015": S(350000, "s1", "Nearly 350,000 in 2015."),
    "occupancy_pct": A(75, "Illustrative."),
    "avg_stay_days": D(5.8, "425 beds at 75% occupancy for 365 days, divided by 20,000 contracted inpatients.", "s1"),
    "fee_per_admission": A(2300, "The annual unitary payment was not in the sources opened. Illustrative fee in USD, set so that total income roughly covers running costs and debt service."),
    "fee_per_visit": A(25, "Illustrative."),
    "public_payer_pct": S(100, "s1", "Paid by the government.")
  },
  "capex": [{"label": "Hospital and clinics", "class": "civil_works", "amount": S(100000000, "s2", "'The project cost approximately US $100 million'.")}],
  "opex": {"fixed": [{"label": "Clinical staff and operations", "amount": A(30000000, "Illustrative USD a year.")}]},
  "historicals": None,
  "financing": {
    "structure": "Public-private partnership: DBSA commercial loan, government capital contribution and private equity",
    "instruments": [
      {"type": "loan", "provider": "Development Bank of Southern Africa", "provider_type": "dfi", "amount": A(65000000, "The source names DBSA commercial financing without an amount. Assumes 65% of cost."), "currency": "USD",
       "tenor_years": A(15, "Assumed within the 18-year contract."), "grace_years": A(3, "Assumed to cover construction."), "interest_rate_pct": A(10, "Assumed."), "repayment_type": A("annuity", "Assumed.")},
      {"type": "grant", "provider": "Government of Lesotho capital contribution", "provider_type": "sovereign", "amount": A(25000000, "The source names a government capital contribution without an amount. Assumed 25%."), "currency": "USD"},
      {"type": "equity", "provider": "Tsepong consortium (private equity)", "provider_type": "own", "amount": A(10000000, "Assumed 10%."), "currency": "USD"}
    ]
  },
  "timeline": {"contract_years": S(18, "s1"), "construction_start": S("2009-03", "s2"), "clinics_opened": S("2010-05", "s1"), "hospital_opened": S("2011-10", "s1")},
  "outcomes": {"health_budget_share": S("34.8% of the government's recurrent health budget on average, 2012 to 2015", "s1"),
               "results": S("Overall death rate down 41%, patient satisfaction up 22%", "s2"),
               "gpoba_grant_usd": S(6250000, "s1", "Grant supporting initial primary care delivery.")},
  "sources": [
    {"id": "s1", "title": "Lesotho Health Network PPP", "url": "https://www.worldbank.org/en/country/lesotho/brief/lesotho-health-network-ppp", "publisher": "World Bank", "date": "2016-02-19", "supports": "Beds, contract length, patient volumes, budget share, dates, grant"},
    {"id": "s2", "title": "Public-Private Partnership Impact Stories: Lesotho Public Health Network", "url": "https://documents1.worldbank.org/curated/en/167751542053203697/pdf/96911-BRI-PUBLIC-PPPImpactStories-Lesotho-PublicHealthNetwork.pdf", "publisher": "IFC / World Bank", "date": "updated 2013-12", "supports": "Project cost, financing sources, construction start, outcomes"},
    {"id": "s3", "title": "A Dangerous Diversion: will the IFC's flagship health PPP bankrupt Lesotho's Ministry of Health?", "url": "https://policy-practice.oxfam.org/resources/a-dangerous-diversion-will-the-ifcs-flagship-health-ppp-bankrupt-lesothos-minis-315183/", "publisher": "Oxfam", "date": "2014-04-07", "supports": "Critical view: says the contract consumes more than half of the health budget"}
  ],
  "caveats": ["Sources disagree on affordability: the World Bank gives 34.8% of the recurrent health budget, and Oxfam says more than half. Both are shown as a key risk.", "The financing split and annual payment are assumptions."]
})

# ------------------------------------------------------------------ stats
def walk(o, acc):
    if isinstance(o, dict):
        if "quality" in o and "value" in o:
            acc[o["quality"]] = acc.get(o["quality"], 0) + 1
            return
        for v in o.values(): walk(v, acc)
    elif isinstance(o, list):
        for v in o: walk(v, acc)

src_ids_ok = True
for c in cases:
    acc = {}; walk(c, acc)
    tot = sum(acc.values())
    c["data_quality_summary"] = {"fields": tot, "sourced": acc.get("sourced", 0), "derived": acc.get("derived", 0), "assumed": acc.get("assumed", 0),
                                 "pct_sourced": round(100 * acc.get("sourced", 0) / tot), "pct_sourced_or_derived": round(100 * (acc.get("sourced", 0) + acc.get("derived", 0)) / tot)}
    # check every referenced source id exists
    ids = {s["id"] for s in c["sources"]}
    refs = set()
    def refwalk(o):
        if isinstance(o, dict):
            if "source" in o and isinstance(o["source"], str) and o.get("quality") in ("sourced", "derived"): refs.add(o["source"])
            for v in o.values(): refwalk(v)
        elif isinstance(o, list):
            for v in o: refwalk(v)
    refwalk(c)
    missing = refs - ids
    if missing:
        print("MISSING SOURCE IDS", c["id"], missing); src_ids_ok = False
    for k in ("id","name","sponsor","country","sector","sub_sector","stage","concept","revenue_model","drivers","capex","financing","sources"):
        assert k in c, (c["id"], k)

out = {"version": 1, "generated": "2026-11-13",
       "notes": "Case library for Tenor. Every number carries a quality label: sourced (stated in a source opened and checked on the date shown), derived (calculated from sourced figures, method in the note) or assumed (no source found; reason in the note). Assumed values are illustrative and must not be read as facts about the project.",
       "cases": cases}
json.dump(out, open(sys.argv[1], "w"), indent=2, ensure_ascii=False)
print("cases:", len(cases), "source ids ok:", src_ids_ok)
for c in cases:
    q = c["data_quality_summary"]
    print(f'{c["id"]:36} {c["sector"]:15} src {q["sourced"]:>2} der {q["derived"]:>2} ass {q["assumed"]:>2}  {q["pct_sourced"]}% / {q["pct_sourced_or_derived"]}%')
