import * as THREE from 'three';

// The ship: a sharp delta silhouette with glowing edges, a magenta cockpit and twin engine flares.
export function createShip(scene, glowTex) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.7);
  shape.lineTo(1.6, -1.05);
  shape.lineTo(0.55, -0.7);
  shape.lineTo(0, -1.25);
  shape.lineTo(-0.55, -0.7);
  shape.lineTo(-1.6, -1.05);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geo.rotateX(Math.PI / 2); // nose (+y) becomes +z, so the ship flies forward
  geo.translate(0, 0.11, 0);

  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0d0b18,
    metalness: 0.9,
    roughness: 0.25,
    emissive: 0x12002a,
    emissiveIntensity: 1,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, toneMapped: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xff2bd6, toneMapped: false });
  const body = new THREE.Mesh(geo, bodyMat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), coreMat);
  core.position.set(0, 0.42, 0.7);

  const engMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0x00f0ff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const engines = [-0.75, 0.75].map((x) => {
    const s = new THREE.Sprite(engMat);
    s.position.set(x, 0, -1.25);
    s.scale.setScalar(1.8);
    return s;
  });

  const light = new THREE.PointLight(0x00f0ff, 4, 16, 1.6);
  light.position.set(0, 1.5, 0);

  root.add(body, edges, core, light, ...engines);
  root.scale.setScalar(1.2);
  scene.add(root);

  return {
    root,
    edgeMat,
    setTheme(p) {
      coreMat.color.set(p.b);
      engMat.color.set(p.a);
      light.color.set(p.a);
    },
  };
}
