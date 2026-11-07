#!/usr/bin/env python3
"""SMPA major demonstration notices -> validated JSON. No geocoding or route invention."""
import argparse
import datetime as dt
import io
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

import fitz
import requests
from bs4 import BeautifulSoup

BASE = 'https://www.smpa.go.kr'
BOARD = BASE + '/user/nd54882.do'
DOWNLOAD = BASE + '/common/attachfile/attachfileDownload.do'
BOARD_RE = re.compile(r"goBoardView\(['\"]([^'\"]+)['\"],\s*['\"]View['\"],\s*['\"](\d+)['\"]\)")
ATTACH_RE = re.compile(r"attachfileDownload\(['\"][^'\"]+['\"],\s*['\"](\d+)['\"]\)")
DATE_RE = re.compile(r'(20\d\d)\.\s*(\d{1,2})\.\s*(\d{1,2})\.')
TIME_RE = re.compile(r'^(\d{1,2}:\d{2})\s*[~〜–-]\s*(\d{1,2}:\d{2})$')
COUNT_RE = re.compile(r'^([\d,]+)\s*명$')


def get(session, url, **kwargs):
    r = session.get(url, timeout=35, **kwargs)
    r.raise_for_status()
    return r


def discover(session, max_posts=12):
    soup = BeautifulSoup(get(session, BOARD).content, 'html.parser')
    out = []
    for a in soup.find_all('a'):
        m = BOARD_RE.search((a.get('href') or '') + ' ' + (a.get('onclick') or ''))
        title = a.get_text(' ', strip=True)
        if m and ('집회' in title or '시위' in title) and not any(x['board_id'] == m.group(2) for x in out):
            out.append({'board_id': m.group(2), 'title': title})
    return out[:max_posts]


def attachments(session, board_id):
    # Exact GET parameter shape confirmed by the user's successful Colab test.
    params = {'View': '', 'uQ': '', 'pageST': 'SUBJECT', 'pageSV': '',
              'imsi': 'imsi', 'page': '1', 'pageSC': 'SORT_ORDER',
              'pageSO': 'DESC', 'dmlType': '', 'boardNo': board_id,
              'returnUrl': BASE + ':443/user/nd54882.do'}
    soup = BeautifulSoup(get(session, BOARD, params=params).content, 'html.parser')
    found = []
    for a in soup.find_all('a'):
        m = ATTACH_RE.search((a.get('onclick') or '') + ' ' + (a.get('href') or ''))
        if m:
            found.append({'name': a.get_text(' ', strip=True), 'attach_id': m.group(1)})
    return found


def download_pdf(session, attach_id):
    r = get(session, DOWNLOAD, params={'attachNo': attach_id})
    if not r.content.startswith(b'%PDF'):
        raise ValueError(f'attachment {attach_id}: not PDF (bytes={len(r.content)})')
    if len(r.content) > 10_000_000:
        raise ValueError('PDF exceeds size limit')
    return r.content


def extract(pdf_bytes, board_id, title, attach_id):
    with fitz.open(stream=pdf_bytes, filetype='pdf') as doc:
        raw = '\n'.join(page.get_text() for page in doc)
    lines = [re.sub(r'\s+', ' ', s).strip() for s in raw.splitlines() if s.strip()]
    # Date is in the document header, NOT the publication date.
    date_matches = DATE_RE.findall(raw)
    if not date_matches:
        raise ValueError('no event date in PDF header')
    # In this PDF, the publication timestamp precedes the event date.
    dates = [dt.date(*map(int, m)) for m in date_matches]
    event_date = dates[-1].isoformat()
    events = []
    positions = [(i, TIME_RE.match(line)) for i, line in enumerate(lines)]
    positions = [(i, m) for i, m in positions if m]
    for j, (i, m) in enumerate(positions):
        stop = positions[j+1][0] if j+1 < len(positions) else len(lines)
        section = lines[i+1:stop]
        count_idx = next((k for k, s in enumerate(section) if COUNT_RE.match(s)), None)
        if count_idx is None or count_idx == 0:
            raise ValueError(f'cannot parse event row {j+1}: {section}')
        location = ' '.join(section[:count_idx]).strip()
        count = int(COUNT_RE.match(section[count_idx]).group(1).replace(',', ''))
        police = ' '.join(section[count_idx+1:]).strip()
        if not location:
            raise ValueError('empty event location')
        events.append({
            'date': event_date, 'start_time': m.group(1), 'end_time': m.group(2),
            'location_text': location, 'reported_participants': count,
            'police_jurisdiction_text': police,
            'latitude': None, 'longitude': None, 'geometry_status': 'unverified',
            'source_board_id': board_id, 'source_attachment_id': attach_id,
            'source_title': title,
            'source_url': BOARD + '?View&boardNo=' + board_id,
            'note_en': 'Reported demonstration; location/route not geocoded. Attendance is reported, not observed.'
        })
    if not events:
        raise ValueError('no event rows found (PDF format may have changed)')
    return events


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--local-pdf', help='Validate parsing against a local PDF without network')
    ap.add_argument('--output', default='demonstrations.json')
    ap.add_argument('--max-posts', type=int, default=12)
    ap.add_argument('--lookahead-days', type=int, default=7)
    args = ap.parse_args()
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=9)))
    issues, events = [], []
    if args.local_pdf:
        events = extract(Path(args.local_pdf).read_bytes(), '00342438', '2026-11-09 주요집회 PDF (로컬 검증)', '00275563')
    else:
        session = requests.Session()
        session.headers.update({'User-Agent': 'SeoulTravelSafetyMap/0.1 (public data research)', 'Referer': BOARD})
        posts = discover(session, args.max_posts)
        if not posts:
            raise RuntimeError('no SMPA board posts discovered; refusing to overwrite existing data')
        for post in posts:
            try:
                pdfs = [a for a in attachments(session, post['board_id']) if a['name'].lower().endswith('.pdf')]
                if not pdfs:
                    issues.append({'board_id': post['board_id'], 'reason': 'no PDF attachment'})
                    continue
                # Most notices have one PDF; avoid accidental duplicates.
                for pdf in pdfs[:1]:
                    events.extend(extract(download_pdf(session, pdf['attach_id']),
                                          post['board_id'], post['title'], pdf['attach_id']))
            except Exception as exc:
                issues.append({'board_id': post['board_id'], 'reason': str(exc)[:200]})
        if not events:
            raise RuntimeError('no valid events extracted; refusing to overwrite existing data')
    dedup = {(e['date'], e['start_time'], e['location_text'], e['source_board_id']): e for e in events}
    events = sorted(dedup.values(), key=lambda e: (e['date'], e['start_time'], e['location_text']))
    if not args.local_pdf:
        start = now.date()
        end = start + dt.timedelta(days=args.lookahead_days)
        events = [e for e in events if start <= dt.date.fromisoformat(e['date']) <= end]
    payload = {'schema_version': 1, 'generated_at_kst': now.isoformat(timespec='seconds'),
               'source': 'Seoul Metropolitan Police Agency - Today’s Demonstrations',
               'source_url': BOARD, 'events': events, 'issues': issues,
               'notice': 'Only major reported demonstrations. Not a safety score or complete list. Coordinates intentionally omitted.'}
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {args.output}: {len(events)} events, {len(issues)} issues')
    for e in events[:8]:
        print(e['date'], e['start_time'], e['location_text'], e['reported_participants'])
    if issues:
        print('WARNINGS:', json.dumps(issues, ensure_ascii=False)[:1000], file=sys.stderr)

if __name__ == '__main__':
    main()
