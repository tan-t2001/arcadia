#!/usr/bin/env python3
"""Verify deliverable completeness and important world-data invariants."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
raw = subprocess.check_output(['node','-e',"global.window={};require('./world.js');process.stdout.write(JSON.stringify(window.ARCADIA))"],cwd=root,text=True,encoding='utf-8')
world = json.loads(raw)
places = world['locations']
assert len(places) == 15
ids = {p['id'] for p in places}
assert len(ids) == len(places)
images = []
for place in places:
    assert len(place['description']) >= 2, place['id']
    assert place['sightline']['camera'] and place['sightline']['background'], place['id']
    assert all(0 <= value <= 100 for value in place['pin']), place['id']
    assert set(place['neighbors']) <= ids, place['id']
    for item in place['plan']['items']:
        assert len(item) == 7, (place['id'],item)
        assert item[3] > 0 and item[4] > 0, item
    for image in place['images']:
        version = world['imageVersions'].get(image['id'],1)
        for folder,ext in [('concepts','png'),('previews','jpg'),('thumbs','jpg')]:
            path = root/'assets'/folder/f"{image['id']}-v{version}.{ext}"
            assert path.exists() and path.stat().st_size > 1000, str(path)
        images.append(image['id'])
assert len(images) == len(set(images)) == 19
assert len(world['shops']) == 20
assert len({row[0] for row in world['shops']}) == 16
by_id = {p['id']:p for p in places}
assert len(by_id['capital']['images']) >= 4
assert len(by_id['temple']['images']) == 2
assert by_id['desert-fort']['pin'][0] < by_id['plains-fort']['pin'][0]
assert abs(by_id['rainbow']['pin'][1]-by_id['residential']['pin'][1]) < 4
assert (root/'assets/map-v3.png').exists()
assert (root.parent/'refs/设定-补充版.md').exists()
print('Verified: 15 locations; 19 active concepts; map V3; full previews; 20 shops / 16 colors; sightlines and linked layouts.')
subprocess.run(['node', 'verify3d.js'], cwd=root, check=True)
