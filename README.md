# Last Chance

Last Chance is a minimal, evidence-based fat-loss planner built as a GitHub Pages PWA.

It calculates calorie targets, protein, fat, carbohydrates, and weekly structure based on sex, body data, activity level, training frequency, and target fat-loss speed.

## Protocols

### Male

1. Standard Deficit: calorie deficit + high-protein diet.
2. Carb Cycling: weekly calorie deficit is held constant while carbohydrates are shifted toward the hardest training days.

### Female

1. Standard Deficit: calorie deficit + high-protein diet.

## Core formulas

RMR uses the Mifflin-St Jeor equation.

Male:

```text
RMR = 10 × weight_kg + 6.25 × height_cm − 5 × age + 5
```

Female:

```text
RMR = 10 × weight_kg + 6.25 × height_cm − 5 × age − 161
```

TDEE:

```text
TDEE = RMR × activity_factor
```

Weekly target loss:

```text
weekly_loss_kg = weight_kg × goal_rate_pct_per_week
weekly_deficit_kcal = weekly_loss_kg × 7700
daily_deficit_kcal = weekly_deficit_kcal ÷ 7
average_cut_calories = TDEE − daily_deficit_kcal
```

## Carb cycling logic

The app does not treat carb cycling as a separate fat-loss mechanism. It preserves the same weekly deficit and changes daily carbohydrate allocation.

```text
E_week = average_cut_calories × 7
E_H = TDEE × 0.98
E_M = average_cut_calories
E_L = (E_week − nH × E_H − nM × E_M) ÷ nL
```

Protein is fixed daily. Fat is lower on high-carb days and higher on low-carb days. Carbs are calculated from remaining calories.

```text
carbs_g = (calories − protein_g × 4 − fat_g × 9) ÷ 4
```

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

## Deploy

The repository includes a GitHub Actions workflow for GitHub Pages deployment.

In the repository settings, use:

```text
Settings → Pages → Build and deployment → Source: GitHub Actions
```

The expected project URL is:

```text
https://AmineSeRaFimmm.github.io/last-chance-professionalized/
```

## PWA note

The current icon is SVG because this implementation was committed through a text-file GitHub connector. For the strongest iOS and Chromium install experience, replace it later with PNG files:

```text
public/icon-192.png
public/icon-512.png
public/apple-touch-icon.png
```

Then update `vite.config.ts` and `index.html` to reference the PNG icons.

## Medical disclaimer

Last Chance is not medical advice. It is not a substitute for a doctor, registered dietitian, or qualified health professional. If pregnant, breastfeeding, under 18, diagnosed with diabetes, kidney disease, eating disorder, or using medication affecting appetite or blood glucose, seek professional guidance first.
