/**
 * ASX Desktop — Three.js universe purple background
 * CDN: three.js r128 (cdnjs). Patterns from Claude extract_00 / extract_03 gates.
 */
export function initThreeBg(canvasId = "three-bg") {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof THREE === "undefined") return null;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0809, 0.012);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 42;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0a0809, 1);

  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const purple = new THREE.PointLight(0x8b5cf6, 2.2, 220);
  purple.position.set(12, 8, 20);
  scene.add(purple);

  const gold = new THREE.PointLight(0xc8a35a, 0.9, 180);
  gold.position.set(-18, -6, 14);
  scene.add(gold);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5.5, 2),
    new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      emissive: 0x4c1d95,
      metalness: 0.55,
      roughness: 0.35,
      wireframe: false,
      transparent: true,
      opacity: 0.85,
    })
  );
  scene.add(core);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5.8, 1),
    new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    })
  );
  scene.add(wire);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(11 + i * 4.2, 0.08, 12, 100),
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0x5b21b6,
        metalness: 0.4,
        roughness: 0.5,
        transparent: true,
        opacity: 0.45 - i * 0.08,
      })
    );
    ring.rotation.x = Math.PI / 2.4 + i * 0.2;
    ring.rotation.y = i * 0.4;
    scene.add(ring);
    rings.push(ring);
  }

  const starGeo = new THREE.BufferGeometry();
  const n = 1400;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 220;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xf5edd8,
      size: 0.18,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    })
  );
  scene.add(stars);

  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const t = performance.now() * 0.00035;
    core.rotation.x = t * 0.6;
    core.rotation.y = t * 0.9;
    wire.rotation.x = -t * 0.4;
    wire.rotation.y = t * 0.5;
    rings.forEach((r, i) => {
      r.rotation.z = t * (0.3 + i * 0.12);
      r.rotation.y = t * (0.15 + i * 0.05);
    });
    stars.rotation.y = t * 0.08;
    purple.position.x = Math.sin(t) * 14;
    purple.position.y = Math.cos(t * 0.7) * 8;
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", onResize);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    },
  };
}
