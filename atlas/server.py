#!/usr/bin/env python3
"""Arcadia local preview and durable feedback. Python standard library only."""
import argparse
import json
import os
import re
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
STORE = ROOT / 'feedback' / 'revisions.json'
LOCK = threading.Lock()

def read_records():
    if not STORE.exists():
        return []
    data = json.loads(STORE.read_text(encoding='utf-8'))
    if not isinstance(data, list):
        raise ValueError('Invalid feedback store; original file preserved')
    return data

def validate(record):
    if not isinstance(record, dict):
        raise ValueError('Expected a JSON object')
    limits = {'id':100, 'location':100, 'image':100, 'imageTitle':200, 'version':30,
              'category':30, 'priority':20, 'message':4000, 'createdAt':40, 'updatedAt':40,
              'action':20, 'status':20}
    result = {}
    for key, limit in limits.items():
        value = record.get(key)
        if not isinstance(value, str) or not value or len(value) > limit:
            raise ValueError('Invalid field: ' + key)
        result[key] = value
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', result['id']):
        raise ValueError('Invalid record id')
    if result['status'] not in ('open', 'done') or result['action'] not in ('note', 'approve', 'reopen'):
        raise ValueError('Invalid record state')
    if result['category'] not in ('geography','geometry','materials','mood','story','other','approval'):
        raise ValueError('Invalid category')
    if result['priority'] not in ('normal','high','idea'):
        raise ValueError('Invalid priority')
    for key in ('createdAt','updatedAt'):
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z', result[key]):
            raise ValueError('Invalid timestamp')
    version = record.get('imageVersion', 0)
    if not isinstance(version, int) or isinstance(version, bool) or not 0 <= version <= 1000:
        raise ValueError('Invalid image version')
    result['imageVersion'] = version
    point = record.get('point')
    if point is not None:
        if not isinstance(point, dict) or any(not isinstance(point.get(k), (int,float)) or isinstance(point.get(k),bool) or not 0 <= point[k] <= 1 for k in ('x','y')):
            raise ValueError('Invalid annotation point')
        point = {k:round(point[k], 6) for k in ('x','y')}
    result['point'] = point
    return result

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        super().end_headers()

    def json_response(self, code, data):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def local_request(self):
        allowed = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if self.headers.get('Host') not in allowed:
            self.json_response(403, {'error':'Local host only'})
            return False
        origin = self.headers.get('Origin')
        if origin and origin not in {f'http://{host}' for host in allowed}:
            self.json_response(403, {'error':'Same origin required'})
            return False
        return True

    def do_GET(self):
        if not self.local_request():
            return
        path = urlsplit(self.path).path
        if path == '/api/feedback':
            try:
                with LOCK:
                    records = read_records()
                self.json_response(200, {'records':records})
            except (OSError, ValueError):
                self.json_response(500, {'error':'Cannot read feedback; original store preserved'})
        elif path.startswith('/api/'):
            self.json_response(404, {'error':'Unknown endpoint'})
        else:
            super().do_GET()

    def do_POST(self):
        if not self.local_request():
            return
        if urlsplit(self.path).path != '/api/feedback':
            self.json_response(404, {'error':'Unknown endpoint'})
            return
        try:
            if self.headers.get('Content-Type','').split(';')[0].strip() != 'application/json':
                self.json_response(415, {'error':'application/json required'})
                return
            length = int(self.headers.get('Content-Length','0'))
            if not 0 < length <= 24000:
                self.json_response(413, {'error':'Request too large or empty'})
                return
            record = validate(json.loads(self.rfile.read(length).decode('utf-8')))
            with LOCK:
                records = read_records()
                index = next((i for i,n in enumerate(records) if n['id'] == record['id']), None)
                if index is None:
                    records.append(record)
                elif record['updatedAt'] >= records[index]['updatedAt']:
                    records[index] = record
                STORE.parent.mkdir(parents=True, exist_ok=True)
                temporary = STORE.with_suffix('.json.tmp')
                temporary.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
                os.replace(temporary, STORE)
            self.json_response(200, {'saved':True,'id':record['id']})
        except (ValueError, UnicodeError) as exc:
            self.json_response(400, {'error':str(exc)})
        except OSError:
            self.json_response(500, {'error':'Cannot write feedback; try exporting from browser'})

    def list_directory(self, path):
        self.send_error(404, 'No directory listing')
        return None

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Open the Arcadia atlas locally')
    parser.add_argument('--port',type=int,default=4173)
    parser.add_argument('--store',type=Path,default=STORE,help='Optional feedback file; useful for an isolated review session')
    parser.add_argument('--open',action='store_true',help='Open the atlas after the local server is bound')
    parser.add_argument('--view',choices=['map','world3d'],default='map',help='Initial view when opening the browser')
    args = parser.parse_args()
    STORE = args.store.resolve()
    server = ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'Arcadia Atlas: http://127.0.0.1:{args.port}',flush=True)
    print('Feedback is saved to atlas/feedback/revisions.json',flush=True)
    if args.open:
        webbrowser.open(f'http://127.0.0.1:{args.port}/#{args.view}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
