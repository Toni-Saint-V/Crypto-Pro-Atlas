let camera, scene, renderer, sphere;

function initSphere() {
  const container = document.getElementById("ai-sphere");
  if (!container) {
    console.error("❌ No #ai-sphere container found in DOM");
    return;
  }

  // Scene and camera setup
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  // Sphere object
  const geometry = new THREE.SphereGeometry(1, 32, 32);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ffcc });
  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // Lights
  const light = new THREE.PointLight(0xffffff, 1);
  light.position.set(5, 5, 5);
  scene.add(light);

  camera.position.z = 4;
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  if (!sphere || !renderer || !camera) return;
  sphere.rotation.x += 0.01;
  sphere.rotation.y += 0.02;
  renderer.render(scene, camera);
}

function updateSphere(conf) {
  const el = document.getElementById("ai-confidence");
  if (el) el.innerText = `Confidence: ${conf}%`;
  if (sphere && sphere.material) {
    sphere.material.color.setHSL(conf / 100, 1, 0.5);
  }
}

function connectAI() {
  const ws = new WebSocket("ws://127.0.0.1:8000/ws/ai");
  ws.onopen = () => console.log("🟢 /ws/ai connected");
  ws.onmessage = (e) => {
  try {
    const data = JSON.parse(e.data);
    if (!data || !data.payload) return;
    const { confidence, risk, pnl } = data.payload;
    updateSphere(confidence);
    document.getElementById("confidence").innerText = confidence.toFixed(2) + "%";
    document.getElementById("risk").innerText = risk.toFixed(3);
    document.getElementById("pnl").innerText = pnl.toFixed(2) + "%";
  } catch (err) {
    console.warn("WS parse error:", err, e.data);
  }
};
  ws.onclose = () => {
    console.warn("🔴 /ws/ai disconnected — reconnecting...");
    setTimeout(connectAI, 3000);
  };
}

window.addEventListener("resize", () => {
  if (!camera || !renderer) return;
  const container = document.getElementById("ai-sphere");
  if (!container) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

window.onload = () => {
  initSphere();
  connectAI();
};
