"""Production browser checks. Run npm start first, then python tests/e2e.py."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('MINDSENSEI_URL', 'http://127.0.0.1:3000')
OUTPUT = Path('test-results')
OUTPUT.mkdir(exist_ok=True)

def db(page):
    return page.evaluate('''async () => {
      const database = await new Promise((resolve, reject) => { const r = indexedDB.open('mindsensei-db', 2); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const read = (name) => new Promise((resolve, reject) => { const r = database.transaction(name).objectStore(name).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const [sessions, state, achievements, daily] = await Promise.all(['sessions','state','achievements','dailyAggregates'].map(read));
      database.close(); return {sessions, profile: state.find(s => s.id === 'profile')?.value, achievements, daily};
    }''')

def goto(page, route):
    page.goto(BASE + route)
    page.wait_for_load_state('networkidle')

def begin(page, engine):
    goto(page, '/train/' + engine)
    page.get_by_role('button', name='Quick · 8 rounds').click()
    page.get_by_role('button', name='Begin Session').click()
    page.clock.run_for(2200)

def complete(page, engine, pause_test=False, early_test=False, retry_test=False):
    begin(page, engine)
    if pause_test:
        page.get_by_role('button', name='Pause', exact=True).click()
        hud = page.locator('.game-hud').inner_text()
        page.clock.run_for(20000)
        assert page.locator('.game-hud').inner_text() == hud
        expect(page.get_by_role('heading', name='Take a breath.')).to_be_visible()
        page.get_by_role('button', name='Resume session').click()
    digits=[]
    last_digit=None
    sent_early=False
    injected=False
    for _ in range(1600):
        if page.get_by_role('heading', name='Session complete.').count():
            break
        if engine == 'focus' and page.get_by_role('button', name='Circle target', exact=True).count():
            page.get_by_role('button', name='Circle target', exact=True).click()
        elif engine == 'memory':
            if page.locator('.memory-digit').count():
                digit=page.locator('.memory-digit').inner_text()
                if digit != '·' and last_digit is None: digits.append(digit)
                last_digit = None if digit == '·' else digit
            elif page.locator('.number-pad').count():
                assert digits, 'No sequence captured'
                for digit in digits: page.keyboard.press(digit)
                digits=[]
                last_digit=None
            elif page.locator('.round-feedback').count():
                assert 'Perfect recall.' in page.locator('.round-feedback').inner_text()
        elif engine == 'reaction':
            if early_test and not sent_early and page.locator('.signal-waiting').count():
                page.keyboard.press('Space')
                page.keyboard.press('Space')
                sent_early=True
                expect(page.get_by_role('heading', name='Too early. Wait for GO.')).to_be_visible()
            elif page.locator('.signal-go').count(): page.keyboard.press('Space')
        elif engine == 'logic' and page.locator('.option-btn').count():
            if retry_test and not injected and 'Round 8 of 8' in page.locator('.game-hud').inner_text():
                page.evaluate('''() => {
                    const original = IDBDatabase.prototype.transaction;
                    let failed = false;
                    IDBDatabase.prototype.transaction = function(...args) {
                        if (!failed && args[1] === 'readwrite') { failed = true; throw new DOMException('Simulated full storage', 'QuotaExceededError'); }
                        return original.apply(this, args);
                    };
                }''')
                injected=True
            sequence=[int(s.replace(',','')) for s in page.locator('.seq-num:not(.seq-mystery)').all_text_contents()]
            options=[int(s.replace(',','')) for s in page.locator('.option-btn').evaluate_all('(buttons) => buttons.map(b => b.lastChild.textContent)')]
            candidates=[]
            if all(sequence[i]-sequence[i-1] == sequence[1]-sequence[0] for i in range(1,len(sequence))): candidates.append(sequence[-1]+sequence[1]-sequence[0])
            if all(sequence[i]*sequence[0] == sequence[i-1]*sequence[1] for i in range(1,len(sequence))): candidates.append(sequence[-1]*sequence[1]//sequence[0])
            if all(sequence[i] == sequence[i-1]+sequence[i-2] for i in range(2,len(sequence))): candidates.append(sequence[-1]+sequence[-2])
            if all(sequence[i]-2*sequence[i-1] == sequence[1]-2*sequence[0] for i in range(1,len(sequence))): candidates.append(sequence[-1]*2+sequence[1]-2*sequence[0])
            candidates.append(sequence[-2]+sequence[-2]-sequence[-4])
            choice=next((v for v in candidates if v in options),options[0])
            page.keyboard.press(str(options.index(choice)+1))
        page.clock.run_for(100)
    else: raise AssertionError(f'{engine} did not finish: {page.locator("main").inner_text()}')
    if retry_test:
        expect(page.get_by_role('button',name='Retry saving')).to_be_visible()
        assert len(db(page)['sessions']) == 3, 'A failed transaction changed history'
        page.get_by_role('button',name='Retry saving').click()
    expect(page.get_by_text('Progress saved on this device',exact=False)).to_be_visible(timeout=10000)
    assert page.locator('.result-score').inner_text().strip() != 'NaN/100'
    if engine == 'memory': assert int(page.locator('.result-score').inner_text().split('/')[0]) >= 80
    page.screenshot(path=str(OUTPUT / f'{engine}-results.png'), full_page=True)
    print(f'PASS complete {engine} session', flush=True)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000}, timezone_id='Asia/Kolkata', accept_downloads=True)
    page=context.new_page()
    errors=[]
    external=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.on('request',lambda request: external.append(request.url) if not request.url.startswith(BASE) and request.url.startswith('http') else None)
    page.clock.install()
    goto(page,'/dashboard')
    expect(page.get_by_role('heading',name='Your sharper self starts here.')).to_be_visible()
    page.clock.pause_at(page.evaluate('new Date(Date.now() + 100).toISOString()'))
    for engine in ['focus','memory','reaction','logic']:
        complete(page,engine,pause_test=engine=='focus',early_test=engine=='reaction',retry_test=engine=='logic')
    saved=db(page)
    assert len(saved['sessions']) == 4
    assert len(saved['daily']) == 4
    assert saved['profile']['xp']['totalXp'] > 0
    assert saved['profile']['streak']['currentStreak'] == 1
    assert any(a['id']=='first-session' for a in saved['achievements'])
    goto(page,'/dashboard')
    expect(page.locator('.sessions-table tbody tr')).to_have_count(4)
    page.reload(); page.wait_for_load_state('networkidle')
    assert db(page)['profile']['xp'] == saved['profile']['xp']
    page.locator('#history-filter').select_option('focus')
    expect(page.locator('.sessions-table tbody tr')).to_have_count(1)
    page.locator('#history-filter').select_option('all')
    page.get_by_role('button',name='See all',exact=True).click()
    expect(page.locator('.achievement-item')).to_have_count(14)
    page.screenshot(path=str(OUTPUT/'dashboard-populated.png'),full_page=True)
    print('PASS persistence, aggregates, dashboard filters, achievements',flush=True)

    goto(page,'/settings')
    page.get_by_role('switch',name='Reduced motion').click()
    expect(page.get_by_role('switch',name='Reduced motion')).to_have_attribute('aria-checked','true')
    assert page.locator('html').get_attribute('data-reduced-motion') == 'true'
    page.get_by_role('switch',name='Sound effects').click()
    expect(page.get_by_role('switch',name='Sound effects')).to_have_attribute('aria-checked','false')
    page.locator('#session-length').select_option('16')
    expect(page.get_by_role('status')).to_contain_text('Session preference saved.')
    page.reload(); page.wait_for_load_state('networkidle')
    expect(page.get_by_role('switch',name='Reduced motion')).to_have_attribute('aria-checked','true')
    expect(page.locator('#session-length')).to_have_value('16')
    goto(page,'/train/memory')
    expect(page.get_by_role('button',name='Standard · 16 rounds')).to_have_attribute('aria-pressed','true')
    goto(page,'/settings')
    with page.expect_download() as download_info: page.get_by_role('button',name='Export backup').click()
    download=download_info.value
    backup_path=OUTPUT/'test-backup.json'
    download.save_as(str(backup_path))
    backup=json.loads(backup_path.read_text())
    assert len(backup['sessions']) == 4 and len(backup['dailyAggregates']) == 4
    page.locator('input[type=file]').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps({'version':1,'sessions':[]}).encode()})
    expect(page.get_by_role('alert')).to_be_visible()
    assert len(db(page)['sessions']) == 4
    page.locator('input[type=file]').set_input_files(str(backup_path))
    expect(page.get_by_role('dialog')).to_be_visible()
    page.get_by_role('button',name='Cancel',exact=True).click()
    assert len(db(page)['sessions']) == 4
    page.get_by_role('button',name='Clear training data',exact=True).click()
    page.get_by_role('dialog').get_by_role('button',name='Clear training data').click()
    expect(page.get_by_role('status')).to_contain_text('Training data cleared.')
    assert len(db(page)['sessions']) == 0
    expect(page.get_by_role('switch',name='Reduced motion')).to_have_attribute('aria-checked','true')
    page.locator('input[type=file]').set_input_files(str(backup_path))
    page.get_by_role('button',name='Restore backup',exact=True).click()
    expect(page.get_by_role('status')).to_contain_text('Imported 4 sessions.')
    assert db(page)['profile']['xp'] == saved['profile']['xp']
    print('PASS settings persistence, backup export, invalid import, clear and restore',flush=True)

    other=context.new_page()
    goto(other,'/settings')
    other.get_by_role('switch',name='Reduced motion').click()
    expect(page.get_by_role('switch',name='Reduced motion')).to_have_attribute('aria-checked','false')
    other.close()
    print('PASS shared progress across tabs',flush=True)

    page.set_viewport_size({'width':390,'height':844})
    goto(page,'/train')
    page.get_by_role('button',name='Open navigation',exact=True).click()
    expect(page.locator('.sidebar-logo')).to_be_focused()
    page.keyboard.press('Escape')
    expect(page.get_by_role('button',name='Open navigation',exact=True)).to_be_focused()
    for width in [320,390,768,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for route in ['/','/dashboard','/train','/settings','/train/focus','/train/memory','/train/reaction','/train/logic']:
            goto(page,route)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Overflow {width}: {route}'
    page.set_viewport_size({'width':390,'height':844})
    goto(page,'/dashboard')
    page.screenshot(path=str(OUTPUT/'mobile-dashboard.png'),full_page=True)
    goto(page,'/settings')
    page.screenshot(path=str(OUTPUT/'mobile-settings.png'),full_page=True)
    print('PASS mobile menu, keyboard focus and responsive routes at four widths',flush=True)

    page.set_viewport_size({'width':1440,'height':1000})
    page.evaluate('() => navigator.serviceWorker.ready.then(() => true)')
    # Start from a new page so offline routes cannot rely on the old page DOM.
    offline=context.new_page()
    context.set_offline(True)
    for route in ['/dashboard','/train','/train/focus','/train/memory','/train/reaction','/train/logic','/settings','/']:
        offline.goto(BASE+route)
        offline.wait_for_load_state('networkidle')
        expect(offline.locator('h1')).to_be_visible()
    goto(offline,'/train')
    offline.locator('.studio-card').filter(has=offline.get_by_role('heading',name='Focus',exact=True)).click()
    expect(offline.get_by_role('heading',name='Find your focus.')).to_be_visible(timeout=15000)
    complete(offline,'focus')
    assert len(db(offline)['sessions']) == 5
    context.set_offline(False)
    offline.close()
    print('PASS offline launch, every route, internal navigation and completed session',flush=True)

    assert not errors, errors
    assert not external, external
    print('PASS no uncaught browser errors or external requests',flush=True)
    browser.close()
