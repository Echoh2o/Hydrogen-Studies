-- Wave 4 launch (2026-09-29, AFTER the PR with migration 024 has deployed).
-- Approved by Josh 2026-09-29: "set up the sleep hub for wave 4" + "New condition hub + 301".
-- Run: railway run -- sh -c 'psql "$DATABASE_PUBLIC_URL" -X -f scripts/content/launch-sleep-hub.sql'
\set ON_ERROR_STOP on
begin;
-- 1. One sleep hub: the benefit hub that went live 2026-09-28 (no traffic) 301s to the condition hub.
insert into redirects (from_path, to_path, status_code, is_active, note)
  select '/explore-by-benefit/sleep', '/explore-by-condition/sleep-quality', 301, true, 'wave 4 2026-09-29: single sleep hub (Josh approved 2026-09-29)'
  where not exists (select 1 from redirects where lower(from_path) = '/explore-by-benefit/sleep');
update redirects set to_path = '/explore-by-condition/sleep-quality', status_code = 301, is_active = true where lower(from_path) = '/explore-by-benefit/sleep';
insert into redirect_actions_log (action, from_path, to_path, status_code, actor, note) values ('hub-301', '/explore-by-benefit/sleep', '/explore-by-condition/sleep-quality', 301, 'claude-code (approved: josh 2026-09-29 ''New condition hub + 301'')', 'wave 4 launch');
-- 2. Tag the human trials the intro cites whose titles don't mention sleep, so the hub's study list includes them
--    (the hub query also matches the 'Sleep Quality' name in studies.health_conditions).
update studies set health_conditions = array_append(coalesce(health_conditions, '{}'), 'Sleep Quality')
  where slug in ('the-effects-of-drinking-hydrogen-rich-water-for-six-weeks-on-exercise-related-biomarkers-in-exercise-naive-men-and-women-over-50-years-following-resistance-training-program-a-randomized-controlled-pilot-trial-1775650467178', 'the-effects-of-6-month-hydrogen-rich-water-intake-on-molecular-and-phenotypic-biomarkers-of-aging-in-older-adults-aged-70-years-and-over-a-randomized-controlled-pilot-trial-1775650467164', 'hydrogen-rich-water-for-improvements-of-mood-anxiety-and-autonomic-nerve-function-in-daily-life-1775650467142', 'the-effect-of-14-day-consumption-of-hydrogen-rich-water-alleviates-fatigue-but-does-not-ameliorate-dyspnea-in-long-covid-patients-a-pilot-single-blind-and-randomized-controlled-trial-1775650467172', 'effects-of-perioperative-hydrogen-inhalation-on-brain-edema-and-prognosis-in-patients-with-glioma-a-single-center-randomized-controlled-study-1775650467174', 'hydrogen-gas-treatment-improves-postoperative-delirium-and-cognitive-dysfunction-in-elderly-noncardiac-patients-1775650467169')
    and not ('Sleep Quality' = any(coalesce(health_conditions, '{}')));
select count(*) as tagged from studies where 'Sleep Quality' = any(health_conditions);
commit;
