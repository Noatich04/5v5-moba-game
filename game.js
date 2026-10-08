// Game State & Settings
const CONFIG = {
    MAX_HP: 100,
    DAMAGE: 20,
    HEAL_AMT: 50,
    HEAL_CD: 10,
    WIN_KILLS: 30,
    GAME_TIME: 300
};

let scene, camera, renderer, raycaster, mouse;
let player, playerHand;
let entities = []; // Tướng, lính, trụ
let kills = { blue: 0, red: 0 };
let gameTime = CONFIG.GAME_TIME;
let targetEntity = null;
let healCD = 0;

// Khởi tạo Three.js Scene 3D
function init() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c);
    scene.fog = new THREE.FogExp2(0x1a202c, 0.015);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Ánh sáng
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Bản đồ Arena
    createMap();

    // Tạo Player (Đội Xanh)
    player = {
        mesh: new THREE.Group(),
        hp: CONFIG.MAX_HP,
        team: 'blue',
        speed: 0.15,
        attackRange: 2.5
    };
    player.mesh.position.set(0, 1.6, 25);
    scene.add(player.mesh);

    // Bàn tay cận chiến góc nhìn thứ nhất (FPS Hands)
    const handGeo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
    const handMat = new THREE.MeshLambertMaterial({ color: 0x2196f3 });
    playerHand = new THREE.Mesh(handGeo, handMat);
    playerHand.position.set(0.4, -0.3, -0.6);
    camera.add(playerHand);
    player.mesh.add(camera);

    // Thêm Trụ & Lính
    spawnTowers();
    spawnBotsAndMinions();

    // Lắng nghe sự kiện
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onClickTarget);
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'e') useHeal();
    });

    // Vòng lặp đếm ngược
    setInterval(updateTimer, 1000);

    // Animation Loop
    animate();
}

function createMap() {
    // Sàn nhà
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Đường Làn (Lane)
    const laneGeo = new THREE.PlaneGeometry(16, 100);
    const laneMat = new THREE.MeshStandardMaterial({ color: 0x4a5568 });
    const lane = new THREE.Mesh(laneGeo, laneMat);
    lane.rotation.x = -Math.PI / 2;
    lane.position.y = 0.01;
    scene.add(lane);
}

function spawnTowers() {
    // Trụ Xanh
    createTower(0, -15, 'blue');
    // Trụ Đỏ
    createTower(0, 15, 'red');
}

function createTower(x, z, team) {
    const group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(1.2, 1.5, 6, 16);
    const mat = new THREE.MeshStandardMaterial({ color: team === 'blue' ? 0x1e88e5 : 0xe53935 });
    const towerMesh = new THREE.Mesh(geo, mat);
    towerMesh.position.y = 3;
    group.add(towerMesh);
    group.position.set(x, 0, z);
    
    group.userData = { hp: 300, maxHp: 300, team: team, type: 'tower', radius: 2 };
    scene.add(group);
    entities.push(group);
}

function spawnBotsAndMinions() {
    // Tạo 4 đồng đội Xanh + 5 Kẻ địch Đỏ
    for (let i = 0; i < 4; i++) createCharacter('blue', -10 + i * 5, 20);
    for (let i = 0; i < 5; i++) createCharacter('red', -10 + i * 5, -20);
}

function createCharacter(team, x, z) {
    const group = new THREE.Group();
    const geo = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: team === 'blue' ? 0x42a5f5 : 0xef5350 });
    const charMesh = new THREE.Mesh(geo, mat);
    charMesh.position.y = 1;
    group.add(charMesh);
    group.position.set(x, 0, z);

    group.userData = { hp: 100, maxHp: 100, team: team, type: 'hero', radius: 1 };
    scene.add(group);
    entities.push(group);
}

// Click chọn mục tiêu -> Tự xoay người & lao đến đánh
function onClickTarget(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    for (let hit of intersects) {
        let obj = hit.object;
        while (obj.parent && obj.parent !== scene) obj = obj.parent;
        
        if (obj.userData && obj.userData.team && obj.userData.team !== player.team) {
            targetEntity = obj;
            document.getElementById('target-info').style.display = 'block';
            break;
        }
    }
}

function useHeal() {
    if (healCD > 0) return;
    player.hp = Math.min(CONFIG.MAX_HP, player.hp + CONFIG.HEAL_AMT);
    updatePlayerHUD();
    
    healCD = CONFIG.HEAL_CD;
    const cdEl = document.getElementById('cd-heal');
    cdEl.style.display = 'flex';
    
    const timer = setInterval(() => {
        healCD--;
        cdEl.innerText = healCD;
        if (healCD <= 0) {
            clearInterval(timer);
            cdEl.style.display = 'none';
        }
    }, 1000);
}

function updatePlayerHUD() {
    const fill = document.getElementById('player-hp');
    fill.style.width = (player.hp / CONFIG.MAX_HP * 100) + '%';
}

function updateTimer() {
    if (gameTime <= 0) return;
    gameTime--;
    const m = String(Math.floor(gameTime / 60)).padStart(2, '0');
    const s = String(gameTime % 60).padStart(2, '0');
    document.getElementById('timer').innerText = `${m}:${s}`;
}

function animate() {
    requestAnimationFrame(animate);

    // Tự động xoay & tiến về phía mục tiêu đã chọn
    if (targetEntity && targetEntity.userData.hp > 0) {
        const pPos = player.mesh.position;
        const tPos = targetEntity.position;
        const dist = pPos.distanceTo(tPos);

        // Hướng camera về phía kẻ địch
        player.mesh.lookAt(tPos.x, pPos.y, tPos.z);

        if (dist > player.attackRange) {
            // Tự di chuyển lại gần
            const dir = new THREE.Vector3().subVectors(tPos, pPos).normalize();
            pPos.addScaledVector(dir, player.speed);
        } else {
            // Đã vào tầm đánh cận chiến -> Vung tay đấm
            playerHand.position.z = -0.3; // Animation nhô nắm đấm ra
            setTimeout(() => playerHand.position.z = -0.6, 150);

            targetEntity.userData.hp -= CONFIG.DAMAGE;
            if (targetEntity.userData.hp <= 0) {
                scene.remove(targetEntity);
                kills.blue++;
                document.getElementById('blue-kills').innerText = kills.blue;
                targetEntity = null;
                document.getElementById('target-info').style.display = 'none';
            }
        }
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;