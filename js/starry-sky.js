import * as THREE from './three.standard.module.js';

/**
 * 🌌 Starry Sky & Shooting Stars Background Module
 * Extracted and optimized from BACKGROUND_STARS_CODE.md (FinalGiftBirthday3)
 */

function createCircleTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createStarLayer({ count, radius, colors, minSize, maxSize, opacity = 1.0 }, circleTexture) {
  const positions = new Float32Array(3 * count);
  const colorsBuf = new Float32Array(3 * count);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const phase = new Float32Array(count);
  const twinkleSpeed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const idx = 3 * i;
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;

    positions[idx] = radius * Math.cos(phi) * Math.sin(theta);
    positions[idx + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[idx + 2] = radius * Math.cos(theta);

    const col = colors[Math.floor(Math.random() * colors.length)];
    colorsBuf[idx] = col.r;
    colorsBuf[idx + 1] = col.g;
    colorsBuf[idx + 2] = col.b;

    sizes[i] = Math.random() * (maxSize - minSize) + minSize;
    alphas[i] = 1;
    phase[i] = Math.random() * Math.PI * 2;
    twinkleSpeed[i] = 0.5 + 1.5 * Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colorsBuf, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geo.userData.phase = phase;
  geo.userData.twinkleSpeed = twinkleSpeed;

  const mat = new THREE.PointsMaterial({
    map: circleTexture,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true,
    opacity,
    sizeAttenuation: false,
  });

  mat.onBeforeCompile = function (shader) {
    shader.vertexShader = shader.vertexShader.replace(
      'uniform float size;',
      'attribute float size; attribute float alpha; varying float vAlpha;'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vAlpha = alpha;'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      'varying float vAlpha;\nvoid main(){'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
      'gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );'
    );
  };

  return new THREE.Points(geo, mat);
}

function createCosmicDust() {
  const DUST_COUNT = 50;
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustColors = new Float32Array(DUST_COUNT * 3);
  const dustBaseColor = new THREE.Color(0xffffff);

  for (let i = 0; i < DUST_COUNT; i++) {
    const idx = 3 * i;
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    const r = 200 * Math.random() + 50;

    dustPositions[idx] = r * Math.cos(phi) * Math.sin(theta);
    dustPositions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
    dustPositions[idx + 2] = r * Math.cos(theta);

    const brightness = 0.5 * Math.random() + 0.5;
    dustColors[idx] = dustBaseColor.r * brightness;
    dustColors[idx + 1] = dustBaseColor.g * brightness;
    dustColors[idx + 2] = dustBaseColor.b * brightness;
  }

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

  const dustMat = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.7,
  });
  return new THREE.Points(dustGeo, dustMat);
}

export function initStarryBackground(canvasId = 'starry-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`Canvas #${canvasId} not found`);
    return;
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  const clock = new THREE.Clock();
  const circleTexture = createCircleTexture(64);

  const starColors = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xaabbff),
    new THREE.Color(0xffffb0),
    new THREE.Color(0xffcce1),
  ];

  const farStars = createStarLayer({
    count: 6000,
    radius: 250,
    colors: [new THREE.Color(0xaabbff), new THREE.Color(0xffffff)],
    minSize: 0.5,
    maxSize: 1.5,
    opacity: 0.8,
  }, circleTexture);

  const midStars = createStarLayer({
    count: 3000,
    radius: 180,
    colors: starColors,
    minSize: 1,
    maxSize: 2.5,
    opacity: 1.0,
  }, circleTexture);

  const nearStars = createStarLayer({
    count: 1000,
    radius: 120,
    colors: starColors,
    minSize: 1.5,
    maxSize: 4.0,
    opacity: 1.2,
  }, circleTexture);

  const starLayers = [farStars, midStars, nearStars];
  starLayers.forEach((layer) => scene.add(layer));

  const cosmicDust = createCosmicDust();
  scene.add(cosmicDust);

  function twinkleStars(t) {
    starLayers.forEach((points) => {
      const geo = points.geometry;
      const alpha = geo.attributes.alpha.array;
      const phase = geo.userData.phase;
      const speed = geo.userData.twinkleSpeed;
      for (let i = 0; i < alpha.length; i++) {
        alpha[i] = 0.65 + 0.35 * Math.sin(t * speed[i] + phase[i]);
      }
      geo.attributes.alpha.needsUpdate = true;
    });
  }

  let animationFrameId;
  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    twinkleStars(t);

    // Subtle celestial rotation for depth and liveliness
    scene.rotation.y = t * 0.015;
    scene.rotation.x = Math.sin(t * 0.005) * 0.03;

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  return { scene, camera, renderer, starLayers, stop: () => cancelAnimationFrame(animationFrameId) };
}

export function createShootingStars(count = 20, containerId = 'shooting-stars') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'shooting-star';

    const startX = Math.random() * (window.innerWidth * 0.8) + (window.innerWidth * 0.2);
    const startY = Math.random() * (window.innerHeight * 0.35);

    star.style.left = startX + 'px';
    star.style.top = startY + 'px';
    star.style.animationDelay = (Math.random() * 9) + 's';
    star.style.animationDuration = (5 + Math.random() * 3) + 's';

    const size = 3 + Math.random() * 3;
    star.style.width = size + 'px';
    star.style.height = size + 'px';

    container.appendChild(star);
  }
}

// Auto-initialize when DOM is ready
function autoInitStars() {
  initStarryBackground('starry-canvas');
  const targetId = document.getElementById('shooting-stars-rain') ? 'shooting-stars-rain' : 'shooting-stars';
  createShootingStars(22, targetId);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInitStars);
} else {
  autoInitStars();
}
