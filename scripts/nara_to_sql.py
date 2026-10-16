#!/usr/bin/env python3
"""Turn a Nara Baby CSV export into SQL files for the Supabase SQL editor.

    python3 scripts/nara_to_sql.py export.csv out_dir <erik_profile_id> <angel_profile_id>

Run supabase/migrations/0009_import_keys.sql first. Then run the generated files in order.
Re-running a file is safe (rows carry an import_key), and anything already logged by hand in
Nestlog within two minutes of an imported row is skipped. Don't commit the CSV or the output.
"""
import csv, datetime as D, os, sys

CSV_PATH, OUT, ERIK, ANGEL = sys.argv[1:5]
CAREGIVER = {'Erik Aakre': ERIK, 'Angel': ANGEL}
OZ_ML, LB_G, IN_CM = 29.5735295625, 453.59237, 2.54
CHUNK = 1500

R = list(csv.DictReader(open(CSV_PATH, newline='', encoding='utf-8-sig')))
by = lambda t: [r for r in R if r['Type'] == t]

def q(v):
    if v is None: return 'null'
    return "'" + str(v).replace("'", "''") + "'"
def ts(ms): return D.datetime.fromtimestamp(int(ms) / 1000, D.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
def note(*parts):
    s = ' · '.join(p.replace('￼', '').strip() for p in parts if p and p.replace('￼', '').strip())
    return s or None
def num(x): return float(x) if x not in ('', None) else None
def r1(x): return None if x is None else round(x, 1)
def who(r): return CAREGIVER[r['Created By Caregiver']]

CHECK = f"""do $$ begin
  if (select count(*) from (select child_id from child_members where user_id in ('{ERIK}','{ANGEL}') group by child_id having count(*) = 2) x) <> 1 then
    raise exception 'Expected exactly one child shared by both parents';
  end if;
end $$;
"""
CHILD = f"c as (select child_id as id from child_members where user_id in ('{ERIK}','{ANGEL}') group by child_id having count(*) = 2)"

def emit(name, table, cols, casts, rows, near=None, near_col=None, append=False):
    """rows: list of tuples matching cols (first item is the import key)."""
    files, n = [], 0
    for i in range(0, len(rows), CHUNK):
        part = rows[i:i + CHUNK]
        vals = ',\n'.join('(' + ', '.join(q(x) for x in row) + ')' for row in part)
        guard = ''
        if near and near_col:
            guard = f"where not exists (select 1 from {table} x where x.child_id = c.id and x.import_key is null{near[0]} and abs(extract(epoch from x.{near_col} - v.{near[1]}::timestamptz)) < 120)\n"
        # build select separately to keep order explicit
        ins_cols = [c for c in cols if c != 'by']
        sel = ', '.join(f'v.{c}{casts.get(c, "")}' for c in ins_cols)
        sql = CHECK + f"with {CHILD},\nv({', '.join(cols)}) as (values\n{vals}\n)\ninsert into {table} (child_id, {', '.join('import_key' if c == 'k' else c for c in ins_cols)}, logged_by)\nselect c.id, {sel}, v.by::uuid from v cross join c\n{guard}on conflict (import_key) do nothing;\n"
        fn = f'{name}_{i // CHUNK + 1:02d}.sql' if len(rows) > CHUNK else f'{name}.sql'
        open(os.path.join(OUT, fn), 'a' if append else 'w').write(('\n' if append else '') + sql)
        files.append(fn); n += len(part)
    print(f'{name}: {n} rows -> {len(files)} file(s)')
    return files

os.makedirs(OUT, exist_ok=True)

# ── sleep
rows = []
for r in by('Sleep'):
    s, e = int(r['Start Date/time (Epoch)']), int(r['[Sleep] End Date/time (Epoch)'])
    if e <= s: continue
    rows.append((r['_activityKey'], ts(s), ts(e), note(r['Note']), who(r)))
emit('1_sleep', 'sleep_sessions', ['k', 'start_time', 'end_time', 'notes', 'by'], {'start_time': '::timestamptz', 'end_time': '::timestamptz'}, rows, near=('', 'start_time'), near_col='start_time')

# ── feedings: breast (+ the one combo feed) and bottle
rows = []
for r in by('Breastfeed') + by('Combo Feed'):
    p = '[Breastfeed] ' if r['Type'] == 'Breastfeed' else '[Combo Feed] '
    l, rt = num(r[p + 'Left Duration (Seconds)']) or 0, num(r[p + 'Right Duration (Seconds)']) or 0
    end = (r[p + 'End Side'] or r[p + 'Begin Side']).split('.')[0].lower() or None
    s = int(r['Start Date/time (Epoch)'])
    rows.append((r['_activityKey'], 'breast', end, None, round((l + rt) / 60, 2), round(l / 60, 2), round(rt / 60, 2), ts(s), ts(s + (l + rt) * 1000), note(r['Note']), who(r)))
for r in by('Bottle Feed'):
    bm, fm, tot = num(r['[Bottle Feed] Breast Milk Volume']), num(r['[Bottle Feed] Formula Volume']), num(r['[Bottle Feed] Volume'])
    oz = tot if tot is not None else ((bm or 0) + (fm or 0) or None)
    formula = r['[Bottle Feed] Type'] == 'Formula' or r['[Bottle Feed] Formula Name']
    fnote = ('Formula' + (f" ({r['[Bottle Feed] Formula Name']}" + (f", {fm:g} fl oz" if fm else '') + ')' if r['[Bottle Feed] Formula Name'] else '')) if formula else None
    s = int(r['Start Date/time (Epoch)'])
    rows.append((r['_activityKey'], 'bottle', None, r1(oz * OZ_ML) if oz else None, None, None, None, ts(s), ts(s), note(fnote, r['Note']), who(r)))
cols = ['k', 'type', 'side', 'amount_ml', 'duration_minutes', 'duration_left_minutes', 'duration_right_minutes', 'start_time', 'end_time', 'notes', 'by']
emit('2_feedings', 'feedings', cols, {'amount_ml': '::numeric', 'duration_minutes': '::numeric', 'duration_left_minutes': '::numeric', 'duration_right_minutes': '::numeric', 'start_time': '::timestamptz', 'end_time': '::timestamptz'}, rows, near=(' and x.type = v.type', 'start_time'), near_col='start_time')

# ── diapers
TEX = {'RUN': 'runny', 'MUSH': 'mushy', 'SOLID': 'solid', 'PEBBLE': 'pebbles', 'MUCOUS': 'mucousy'}
COL = {'YELLOW': 'yellow', 'BROWN': 'brown', 'GREEN': 'green', 'BLACK': 'black', 'RED': 'red', 'GRAY': 'gray'}
arr = lambda xs: '{' + ','.join(xs) + '}'
rows = []
for r in by('Diaper'):
    t = r['[Diaper] Type']; dirty = 'Dirty' in t; wet = 'Wet' in t
    tx = [TEX[w] for w in r['[Diaper] Dirty Texture'].split() if w in TEX] if dirty else []
    co = [COL[w] for w in r['[Diaper] Dirty Color'].split() if w in COL] if dirty else []
    rows.append((r['_activityKey'], str(wet).lower(), str(dirty).lower(), tx[0] if tx else None, co[0] if co else None, arr(tx), arr(co),
                 str(r['[Diaper] Detail'] == 'Blowout').lower(), str(r['[Diaper] Detail'] == 'Rash').lower(), ts(r['Start Date/time (Epoch)']), note(r['Note']), who(r)))
cols = ['k', 'wet', 'dirty', 'texture', 'color', 'textures', 'colors', 'blowout', 'diaper_rash', 'time', 'notes', 'by']
emit('3_diapers', 'diapers', cols, {'wet': '::boolean', 'dirty': '::boolean', 'textures': '::text[]', 'colors': '::text[]', 'blowout': '::boolean', 'diaper_rash': '::boolean', 'time': '::timestamptz'}, rows, near=('', 'time'), near_col='time')

# ── pumping (child_id set so you both can see it; logged_by is whoever pumped)
rows = []
for r in by('Pump'):
    l, rt = num(r['[Pump] Left Volume']), num(r['[Pump] Right Volume'])
    lm, rm = (r1(l * OZ_ML) if l else None), (r1(rt * OZ_ML) if rt else None)
    tot = r1((l or 0) * OZ_ML + (rt or 0) * OZ_ML) if (l or rt) else None
    side = 'both' if lm and rm else 'left' if lm else 'right' if rm else None
    rows.append((r['_activityKey'], side, tot, lm, rm, ts(r['Start Date/time (Epoch)']), ts(r['[Pump] End Date/time (Epoch)']), note(r['Note']), who(r)))
cols = ['k', 'side', 'amount_ml', 'amount_left_ml', 'amount_right_ml', 'start_time', 'end_time', 'notes', 'by']
emit('4_pumping', 'pumping_sessions', cols, {'amount_ml': '::numeric', 'amount_left_ml': '::numeric', 'amount_right_ml': '::numeric', 'start_time': '::timestamptz', 'end_time': '::timestamptz'}, rows, near=('', 'start_time'), near_col='start_time')

# ── baby firsts, milestones, growth
rows = []
for r in by('Baby First') + by('Milestone'):
    title = (r['[Baby First] Baby First'] or r['[Milestone] Milestone']).strip()
    rows.append((r['_activityKey'], title, note(r['Note']), r['Start Date/time'][:10], who(r)))
emit('5_firsts_growth', 'milestones', ['k', 'title', 'notes', 'happened_on', 'by'], {'happened_on': '::date'}, rows)
rows = []
for r in by('Growth'):
    d = r['Start Date/time'][:10]
    for kind, col, unit_mul in (('weight', 'Weight', LB_G), ('height', 'Height', IN_CM), ('head', 'Head Size', IN_CM)):
        v = num(r[f'[Growth] {col}'])
        if v: rows.append((f"{r['_activityKey']}:{kind}", kind, round(v * unit_mul, 1), d, note(r['Note']), who(r)))
emit('5_firsts_growth', 'growth_measurements', ['k', 'kind', 'value', 'measured_on', 'notes', 'by'], {'value': '::numeric', 'measured_on': '::date'}, rows, append=True)
