'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
global.window = {};
const THREE = require('./vendor/three.min.js');
require('./world.js');
require('./world3d-model.js');
const model = window.ArcadiaWorldModel.build(THREE, window.ARCADIA);
assert.equal(model.places.size, 15);
assert.deepEqual([...model.places.keys()], window.ARCADIA.locations.map(place => place.id));
assert.ok(model.instances > 5000);
assert.ok(model.pickables.length < 20, 'Repeated objects must remain batched');
for (const mesh of model.pickables) {
  assert.equal(mesh.count, mesh.userData.items.length);
  for (const value of mesh.instanceMatrix.array) assert.ok(Number.isFinite(value));
  for (const value of mesh.instanceColor.array) assert.ok(Number.isFinite(value));
  assert.equal(mesh.geometry.attributes.surfaceKind.count, mesh.count);
  for (const item of mesh.userData.items) assert.ok(item.w>0 && item.h>0 && item.d>0, 'Model dimensions must remain positive');
}
const houseDoors = id => model.pickables.find(mesh => mesh.name.startsWith('box ')).userData.items
  .filter(item => item.place === id && item.color === '#554332' && item.h === 2.4);
assert.equal(houseDoors('sadland').length, 8, 'Four houses each have two modeled doors');
assert.equal(houseDoors('rainbow').length, 40, 'Twenty shops each have two modeled doors');
const center = id => model.places.get(id);
const distance = (a, b) => Math.hypot(a.x-b.x, a.z-b.z);
assert.ok(distance(center('rainbow'), center('residential')) < 130);
assert.ok(distance(center('cab'), center('goblin')) > 2000, 'The goblin valley requires a long southwestern journey');
assert.ok(distance(center('winery'), center('temple')) > 1800, 'The temple lies in the distant northeastern highlands');
assert.ok(center('temple').z < center('winery').z && center('temple').x > center('winery').x);
assert.ok(center('goblin').z > center('cab').z && center('goblin').x < center('cab').x);
assert.ok(center('desert-fort').x < center('plains-fort').x);
assert.ok(distance(center('desert-fort'), center('plains-fort')) < 170);
for (const id of ['sadland', 'oasis', 'winery', 'temple']) {
  const p = center(id);
  assert.ok(Math.abs(model.terrainHeight(p.x,p.z)-p.y) < .1, id+' requires a grounded foundation');
}
assert.ok(model.terrainHeight(730,430) < 0, 'The fortresses share a real river');
assert.ok(model.terrainHeight(-727,-162) < 0, 'The quarry is excavated below grade');
assert.ok(model.terrainHeight(910,-420) > 90, 'The western Plain ridge blocks sightlines');
assert.ok(model.terrainHeight(center('fishing').x-33,center('fishing').z-33) < 0, 'Fishing piers extend into the bay');
assert.ok(model.terrainHeight(492,71) < 0, 'The mill wheel enters the freshwater river');
assert.ok(model.terrainHeight(-780,694) < 0, 'Cab docks stand above water');
assert.equal(model.features.find(feature => feature.id==='goblin-tunnel').place, 'goblin');
assert.ok(model.features.some(feature => feature.id.startsWith('route-bridge-')), 'Tributary crossings have deliberate bridges');
assert.ok(model.mainland.length > 200, 'The mainland has a smooth irregular coastline');
const bounds=model.bounds;
for (const x of [bounds.minX,bounds.maxX]) for (let z=bounds.minZ;z<=bounds.maxZ;z+=100) {
  assert.ok(model.terrainHeight(x,z)<0, 'The rectangular terrain mesh edge is below the sea');
}
for (const z of [bounds.minZ,bounds.maxZ]) for (let x=bounds.minX;x<=bounds.maxX;x+=100) {
  assert.ok(model.terrainHeight(x,z)<0, 'The rectangular terrain mesh edge is below the sea');
}
for(const id of ['temple','goblin']) {
  const p=center(id);
  assert.ok(p.x>bounds.minX && p.x<bounds.maxX && p.z>bounds.minZ && p.z<bounds.maxZ);
  assert.ok(Math.abs(model.groundHeight(p.x,p.z)-p.y)<.1, 'Remote destinations sit on the rendered ground');
  const trees=model.pickables.find(mesh=>mesh.name.startsWith('leaf ')).userData.items
    .filter(item=>item.place===null && Math.hypot(item.x-p.x,item.z-p.z)<450 && item.h>2);
  assert.ok(trees.length>150, id+' has surrounding woodland');
}
const arches=model.pickables.find(mesh=>mesh.name.startsWith('arch '));
assert.ok(arches.userData.items.filter(item=>item.place==='capital').length>=96, 'The arena has two tiers of hollow arches');
const roundDoors=model.pickables.find(mesh=>mesh.name.startsWith('disk ')).userData.items
  .filter(item=>item.place==='goblin' && item.color==='#995a38');
assert.equal(roundDoors.length,4, 'Four turf cottages have round timber doors');
assert.ok(model.root.children.some(mesh=>mesh.name==='Ground-following overland paths'));
model.animated.forEach(update => update(10));
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('data-view="world3d"'));
assert.ok(html.includes('id="world3dStage"'));
assert.ok(fs.readFileSync('app.js','utf8').includes('在 3D 世界中查看此地'));
assert.ok(fs.existsSync('vendor/three-LICENSE.txt'));
assert.ok(!html.includes('右键平移') && !html.includes('右键拖动平移'));
assert.ok(html.includes('WASD / 方向键平移'));
console.log(`Verified 3D: 15 destinations, ${model.instances} finite instances, 20 shops, 4 starter houses, natural coast, remote woodland, detailed arches and cottages, grounded terrain, local dependencies.`);
