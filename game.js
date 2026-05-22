/* ===================================================
   ANTIGRAVITY MICROBE NINJA - GAME ENGINE (JS)
   Vanilla JS Canvas, Zero-G Physics, Multi-Touch
   =================================================== */

// Global State
let gameStarted = false;
let leftGameArea = null;
let rightGameArea = null;
let currentLevel = 1;
let levelIntervalId = null;

// Konfigurasi Game Umum
const GAME_CONFIG = {
    maxMicrobes: 6,           // Maksimum mikroba per area canvas
    spawnInterval: 1400,      // Pemunculan objek (ms)
    microbeLifespan: 12000,   // Waktu hidup mikroba sebelum dissolve (ms)
    minSpeed: 1.5,
    maxSpeed: 3.5,
    baseScore: 10,
    maxLives: 3
};

// Helper untuk Level Perkembangan Permainan
function getSpawnInterval() {
    // Mengurangi interval pemunculan setiap level (lebih cepat muncul)
    return Math.max(450, GAME_CONFIG.spawnInterval - (currentLevel - 1) * 160);
}

function getMaxMicrobes() {
    // Meningkatkan jumlah mikroba maksimum di layar seiring naiknya level
    return GAME_CONFIG.maxMicrobes + Math.floor((currentLevel - 1) / 2);
}

function getMicrobeSpeedRange() {
    // Meningkatkan kecepatan mikroba
    const speedMultiplier = 1 + (currentLevel - 1) * 0.15;
    return {
        min: GAME_CONFIG.minSpeed * speedMultiplier,
        max: GAME_CONFIG.maxSpeed * speedMultiplier
    };
}

function getBombProbability() {
    // Meningkatkan probabilitas kemunculan bom (lawan) seiring naiknya level
    // Level 1: 25%, Level 2: 30%, Level 3: 35%, Level 4: 40%, dst. Maksimum 55%
    return Math.min(0.55, 0.25 + (currentLevel - 1) * 0.05);
}

// --- CLASS UTAMA: PARTIKEL CIPRATAN & SPARKS ---
class Particle {
    constructor(x, y, color, isSplatter = false) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isSplatter = isSplatter; // Splash cairan vs spark garis tebasan
        
        if (isSplatter) {
            this.radius = Math.random() * 8 + 3;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.gravity = 0.05; // Sedikit meluncur ke bawah
        } else {
            this.radius = Math.random() * 3 + 1;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.gravity = 0; // Tanpa gravitasi untuk spark
        }
        
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.015;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        // Pendaran partikel
        ctx.shadowBlur = this.isSplatter ? 4 : 8;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// --- CLASS UTAMA: BELAHAN MIKROBA (SLICED HALF) ---
class SlicedHalf {
    constructor(x, y, radius, type, angle, sideOffset, initialVelocityX, initialVelocityY) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.type = type;
        this.angle = angle; // Sudut tebasan jari
        this.sideOffset = sideOffset; // 1 untuk setengah kanan, -1 untuk setengah kiri
        
        // Impuls terpental ke arah luar (tegak lurus dengan sudut tebasan)
        const pushAngle = this.angle + (Math.PI / 2) * this.sideOffset;
        const impulseForce = Math.random() * 3 + 3;
        
        this.vx = initialVelocityX + Math.cos(pushAngle) * impulseForce;
        this.vy = initialVelocityY + Math.sin(pushAngle) * impulseForce;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() * 0.1 + 0.05) * this.sideOffset;
        this.alpha = 1;
        this.color = type === 'bacteria' ? '#00f5d4' : '#f500d4';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;
        this.alpha -= 0.03; // Cepat menghilang
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        if (this.type === 'bacteria') {
            // Gambar kapsul terbelah setengah
            // Menggambar kapsul secara horizontal lalu memotongnya di tengah
            if (this.sideOffset === -1) {
                // Setengah atas/kiri kapsul
                ctx.arc(-this.radius * 0.5, 0, this.radius * 0.8, Math.PI / 2, (Math.PI * 3) / 2);
                ctx.lineTo(0, -this.radius * 0.8);
                ctx.lineTo(0, this.radius * 0.8);
            } else {
                // Setengah bawah/kanan kapsul
                ctx.arc(this.radius * 0.5, 0, this.radius * 0.8, (Math.PI * 3) / 2, Math.PI / 2);
                ctx.lineTo(0, this.radius * 0.8);
                ctx.lineTo(0, -this.radius * 0.8);
            }
        } else {
            // Virus terbelah setengah
            if (this.sideOffset === -1) {
                ctx.arc(0, 0, this.radius, Math.PI / 2, (Math.PI * 3) / 2);
            } else {
                ctx.arc(0, 0, this.radius, (Math.PI * 3) / 2, Math.PI / 2);
            }
            ctx.closePath();
        }
        
        ctx.fill();
        ctx.stroke();

        // Menggambar garis potong yang rata dengan warna putih
        ctx.beginPath();
        if (this.type === 'bacteria') {
            ctx.moveTo(0, -this.radius * 0.8);
            ctx.lineTo(0, this.radius * 0.8);
        } else {
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(0, this.radius);
        }
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }
}

// --- CLASS UTAMA: MIKROBA (BAKTERI / VIRUS) ---
class Microbe {
    constructor(canvasWidth, canvasHeight, type, speedRange) {
        this.type = type; // 'bacteria' atau 'virus'
        this.radius = type === 'bacteria' ? 38 : 34;
        
        // Spawn dari pinggir layar acak (kiri, kanan, atas, bawah)
        const edge = Math.floor(Math.random() * 4);
        const margin = 50;
        
        if (edge === 0) { // Atas
            this.x = Math.random() * (canvasWidth - 2 * margin) + margin;
            this.y = -this.radius;
        } else if (edge === 1) { // Kanan
            this.x = canvasWidth + this.radius;
            this.y = Math.random() * (canvasHeight - 2 * margin) + margin;
        } else if (edge === 2) { // Bawah
            this.x = Math.random() * (canvasWidth - 2 * margin) + margin;
            this.y = canvasHeight + this.radius;
        } else { // Kiri
            this.x = -this.radius;
            this.y = Math.random() * (canvasHeight - 2 * margin) + margin;
        }

        // Kecepatan melayang konstan (Zero Gravity)
        const angle = Math.random() * Math.PI * 2;
        const minSp = speedRange ? speedRange.min : GAME_CONFIG.minSpeed;
        const maxSp = speedRange ? speedRange.max : GAME_CONFIG.maxSpeed;
        const speed = Math.random() * (maxSp - minSp) + minSp;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        // Sudut visual & rotasi
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.03;
        
        // Parameter bio-animasi (denyut organel)
        this.pulseTime = Math.random() * 100;
        this.pulseSpeed = 0.05 + Math.random() * 0.05;

        // Waktu hidup & status memudar (dissolve)
        this.spawnTime = Date.now();
        this.opacity = 0; // Fade-in di awal
        this.isDissolving = false;
        
        this.color = type === 'bacteria' ? '#00f5d4' : '#f500d4';
    }

    update(canvasWidth, canvasHeight) {
        // Logika Fisika: Pergerakan lurus konstan (g = 0)
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;
        this.pulseTime += this.pulseSpeed;

        const age = Date.now() - this.spawnTime;
        
        // Fade in di awal
        if (age < 500) {
            this.opacity = age / 500;
        } else if (age > GAME_CONFIG.microbeLifespan - 1500) {
            // Mulai dissolve di ujung batas waktu hidup
            this.isDissolving = true;
            this.opacity = Math.max(0, 1 - (age - (GAME_CONFIG.microbeLifespan - 1500)) / 1500);
        } else {
            this.opacity = 1;
        }

        // Pantulan Dinding Elastis (Elastic Collision)
        // Dinding Kiri & Kanan
        if (this.x - this.radius <= 0 && this.vx < 0) {
            this.vx = -this.vx;
            this.x = this.radius;
        } else if (this.x + this.radius >= canvasWidth && this.vx > 0) {
            this.vx = -this.vx;
            this.x = canvasWidth - this.radius;
        }
        
        // Dinding Atas & Bawah
        if (this.y - this.radius <= 0 && this.vy < 0) {
            this.vy = -this.vy;
            this.y = this.radius;
        } else if (this.y + this.radius >= canvasHeight && this.vy > 0) {
            this.vy = -this.vy;
            this.y = canvasHeight - this.radius;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Efek Neon Glow Organik
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.color;
        
        // Animasi Denyut Organik
        const pulse = Math.sin(this.pulseTime) * 0.06 + 1.0;

        if (this.type === 'bacteria') {
            this.drawBacteria(ctx, pulse);
        } else {
            this.drawVirus(ctx, pulse);
        }

        ctx.restore();
    }

    drawBacteria(ctx, pulse) {
        // Gambarkan Bakteri (Organik Kapsul Berpori)
        const w = this.radius * 1.3 * pulse;
        const h = this.radius * 0.75 * pulse;

        // Ekor Cambuk (Flagella) - Melambai dinamis
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.4)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0; // Kurangi blur di cambuk
        
        const waveX = Math.sin(this.pulseTime * 2) * 8;
        ctx.moveTo(-w/2, 0);
        ctx.bezierCurveTo(-w/2 - 20, waveX, -w/2 - 35, -waveX, -w/2 - 50, waveX);
        ctx.stroke();
        ctx.restore();

        // 1. Dinding Sel Terluar (Glowing Capsule)
        ctx.beginPath();
        ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 245, 212, 0.16)';
        ctx.strokeStyle = '#00f5d4';
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        // 2. Membran Sel Dalam
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.85, h * 0.85, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 245, 212, 0.08)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 3. Inti Sel & Ribosom Organik
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-w * 0.3, -h * 0.1, 4, 0, Math.PI * 2);
        ctx.arc(w * 0.2, h * 0.25, 3, 0, Math.PI * 2);
        ctx.arc(-w * 0.1, h * 0.1, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00b89c';
        ctx.beginPath();
        ctx.arc(w * 0.35, -h * 0.2, 5, 0, Math.PI * 2);
        ctx.arc(-w * 0.25, h * 0.3, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawVirus(ctx, pulse) {
        // Gambarkan Virus (Spikey Sphere / Corona-like)
        const baseRadius = this.radius * 0.78 * pulse;
        const spikeLength = this.radius * 0.35 * pulse;
        const spikeCount = 10;

        // 1. Protein Duri (Spikes Radial)
        for (let i = 0; i < spikeCount; i++) {
            const angle = (i * Math.PI * 2) / spikeCount;
            const xEnd = Math.cos(angle) * (baseRadius + spikeLength);
            const yEnd = Math.sin(angle) * (baseRadius + spikeLength);
            
            // Batang Spike
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(xEnd, yEnd);
            ctx.strokeStyle = '#f500d4';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Kepala Spike (Segitiga / Bulat di Ujung)
            ctx.beginPath();
            ctx.arc(xEnd, yEnd, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ff2244';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // 2. Kapsul Inti Bulat
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 0, 212, 0.2)';
        ctx.strokeStyle = '#f500d4';
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        // 3. Inti Genom Glowing
        const rGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, baseRadius * 0.8);
        rGrad.addColorStop(0, '#ffffff');
        rGrad.addColorStop(0.4, '#ff2244');
        rGrad.addColorStop(1, 'rgba(245, 0, 212, 0)');
        
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = rGrad;
        ctx.fill();
    }
}

// --- CLASS UTAMA: JEJAK TEBASAN (SLASH TRAIL) ---
class SlashTrail {
    constructor(color) {
        this.points = []; // Menyimpan koordinat {x, y, time}
        this.color = color;
        this.maxPoints = 12; // Panjang jejak tebasan
    }

    addPoint(x, y) {
        this.points.push({ x, y, time: Date.now() });
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
    }

    clear() {
        this.points = [];
    }

    draw(ctx) {
        if (this.points.length < 2) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        // Gambar jejak memudar dari ekor ke ujung tebasan
        for (let i = 1; i < this.points.length; i++) {
            const p1 = this.points[i - 1];
            const p2 = this.points[i];
            
            const pct = i / this.points.length;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 8 * pct; // Mengecil ke arah ekor tebasan
            ctx.globalAlpha = pct * 0.9;
            ctx.stroke();

            // Lapisan Inti Putih di Tengah Tebasan (Biar Terlihat Tajam)
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5 * pct;
            ctx.globalAlpha = pct;
            ctx.stroke();
        }

        ctx.restore();
    }
}

// --- CLASS UTAMA: AREA PERMAINAN (GAME AREA) ---
class GameArea {
    constructor(canvas, side) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.side = side; // 'left' atau 'right'
        
        // Setup Tim: Sisi kiri = Tim Bakteri (Target), Sisi kanan = Tim Virus (Target)
        this.team = side === 'left' ? 'Bacteria' : 'Virus';
        this.targetType = side === 'left' ? 'bacteria' : 'virus';
        this.bombType = side === 'left' ? 'virus' : 'bacteria';
        
        this.score = 0;
        this.lives = GAME_CONFIG.maxLives;
        
        this.microbes = [];
        this.particles = [];
        this.slicedHalves = [];
        
        // Multi-touch tracking
        this.activeSlashes = {}; // key: touch.identifier atau 'mouse'
        
        this.damageFlashTimer = 0;
        this.scorePopups = []; // {x, y, text, color, timer}
        
        // Banner Level Up Visuals
        this.levelUpBannerText = "";
        this.levelUpBannerTimer = 0;
        
        this.resize();
        this.setupEvents();
    }

    triggerLevelUp(level) {
        this.levelUpBannerText = `LEVEL ${level}`;
        this.levelUpBannerTimer = 2.2; // Waktu visual effect (detik)
        
        // Efek visual cepat kedipan layar tipis
        const sideElement = document.getElementById(`side-${this.side}`);
        const flashOverlay = document.createElement('div');
        flashOverlay.className = 'damage-flash active';
        flashOverlay.style.background = this.side === 'left' ? 'rgba(0, 245, 212, 0.15)' : 'rgba(245, 0, 212, 0.15)';
        sideElement.appendChild(flashOverlay);
        setTimeout(() => flashOverlay.remove(), 450);
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    }

    setupEvents() {
        // --- INPUT SENTUH (MULTI-TOUCH API) ---
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!gameStarted) return;
            
            const rect = this.canvas.getBoundingClientRect();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                const trailColor = this.side === 'left' ? '#00f5d4' : '#f500d4';
                const newSlash = new SlashTrail(trailColor);
                newSlash.addPoint(x, y);
                this.activeSlashes[touch.identifier] = newSlash;
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!gameStarted) return;
            
            const rect = this.canvas.getBoundingClientRect();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const slash = this.activeSlashes[touch.identifier];
                
                if (slash) {
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;
                    
                    const prevPoint = slash.points[slash.points.length - 1];
                    slash.addPoint(x, y);
                    
                    // Deteksi Tabrakan Tebasan (Slicing Collision)
                    if (prevPoint) {
                        this.checkSliceCollision(prevPoint.x, prevPoint.y, x, y);
                    }
                }
            }
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                delete this.activeSlashes[touch.identifier];
            }
        });

        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                delete this.activeSlashes[touch.identifier];
            }
        });

        // --- FALLBACK INPUT MOUSE (BUAT TESTING DESKTOP) ---
        let isMouseDown = false;
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (!gameStarted) return;
            isMouseDown = true;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const trailColor = this.side === 'left' ? '#00f5d4' : '#f500d4';
            const newSlash = new SlashTrail(trailColor);
            newSlash.addPoint(x, y);
            this.activeSlashes['mouse'] = newSlash;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!gameStarted || !isMouseDown) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const slash = this.activeSlashes['mouse'];
            if (slash) {
                const prevPoint = slash.points[slash.points.length - 1];
                slash.addPoint(x, y);
                
                if (prevPoint) {
                    this.checkSliceCollision(prevPoint.x, prevPoint.y, x, y);
                }
            }
        });

        window.addEventListener('mouseup', () => {
            isMouseDown = false;
            delete this.activeSlashes['mouse'];
        });
    }

    // --- DETEKSI SLICE: SEGMENT KE LINGKARAN (MATH VEKTOR) ---
    checkSliceCollision(x1, y1, x2, y2) {
        // Vektor segmen tebasan AB
        const abX = x2 - x1;
        const abY = y2 - y1;
        const abLenSq = abX * abX + abY * abY;
        
        if (abLenSq === 0) return;

        // Cari sudut tebasan untuk efek visual belahan terpisah
        const slashAngle = Math.atan2(abY, abX);

        for (let i = this.microbes.length - 1; i >= 0; i--) {
            const m = this.microbes[i];
            
            // Hiraukan objek yang sedang dissolve atau di ujung frame spawn
            if (m.opacity < 0.3 || m.isDissolving) continue;

            // Vektor AC (A ke pusat microbe C)
            const acX = m.x - x1;
            const acY = m.y - y1;
            
            // Proyeksi titik C pada garis AB
            let t = (acX * abX + acY * abY) / abLenSq;
            t = Math.max(0, Math.min(1, t)); // Batasi di dalam segmen
            
            // Titik terdekat P di segmen AB ke pusat C
            const px = x1 + t * abX;
            const py = y1 + t * abY;
            
            // Jarak dari P ke pusat microbe
            const distSq = (m.x - px) * (m.x - px) + (m.y - py) * (m.y - py);
            
            // Berikan sedikit padding area toleransi hit sentuhan jari (+15px)
            const collisionRadius = m.radius + 15;
            
            if (distSq <= collisionRadius * collisionRadius) {
                // Kena slice!
                this.handleMicrobeSliced(m, i, slashAngle);
            }
        }
    }

    handleMicrobeSliced(microbe, index, angle) {
        // Hapus microbe dari daftar aktif
        this.microbes.splice(index, 1);
        
        const sideColor = this.side === 'left' ? '#00f5d4' : '#f500d4';
        
        if (microbe.type === this.targetType) {
            // 1. Tebas Objek BENAR: Skor Bertambah +10
            this.score += GAME_CONFIG.baseScore;
            this.updateScoreUI();
            
            // Tambahkan Pop-up Skor Visual
            this.scorePopups.push({
                x: microbe.x,
                y: microbe.y,
                text: `+${GAME_CONFIG.baseScore}`,
                color: sideColor,
                timer: 1.0
            });
            
            // Buat efek terbelah dua yang melayang menjauh (Vektor Impuls)
            this.slicedHalves.push(new SlicedHalf(microbe.x, microbe.y, microbe.radius, microbe.type, angle, -1, microbe.vx, microbe.vy));
            this.slicedHalves.push(new SlicedHalf(microbe.x, microbe.y, microbe.radius, microbe.type, angle, 1, microbe.vx, microbe.vy));
            
            // Efek percikan bio-cairan (Splatter) & Spark garis potong
            this.createSplatter(microbe.x, microbe.y, sideColor);
            
        } else {
            // 2. Tebas BOMB (Salah Objek): Kurangi nyawa
            this.lives--;
            this.updateLivesUI();
            this.triggerScreenShakeAndFlash();
            
            // Pop-up Penurunan Nyawa
            this.scorePopups.push({
                x: microbe.x,
                y: microbe.y,
                text: "BAHAYA!",
                color: '#ff2244',
                timer: 1.0
            });
            
            // Efek peledakan partikel bomb yang dahsyat
            this.createExplosion(microbe.x, microbe.y, '#ff2244');
            
            // Cek kondisi kekalahan
            if (this.lives <= 0) {
                endGame();
            }
        }
    }

    createSplatter(x, y, color) {
        // Partikel kecil tebasan
        for (let i = 0; i < 18; i++) {
            this.particles.push(new Particle(x, y, color, false));
        }
        // Splash cairan lab besar
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(x, y, color, true));
        }
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 35; i++) {
            this.particles.push(new Particle(x, y, color, false));
        }
    }

    triggerScreenShakeAndFlash() {
        const sideElement = document.getElementById(`side-${this.side}`);
        
        // Aktifkan class goyangan layar di CSS
        sideElement.classList.add('shake');
        setTimeout(() => sideElement.classList.remove('shake'), 400);

        // Aktifkan efek damage flash (merah)
        const flashOverlay = document.createElement('div');
        flashOverlay.className = 'damage-flash active';
        sideElement.appendChild(flashOverlay);
        setTimeout(() => flashOverlay.remove(), 500);
    }

    spawnMicrobe() {
        if (this.microbes.length >= getMaxMicrobes()) return;
        
        // Tentukan jenis microbe dengan rasio bom yang meningkat seiring level
        const isBomb = Math.random() < getBombProbability();
        const spawnedType = isBomb ? this.bombType : this.targetType;
        
        const speedRange = getMicrobeSpeedRange();
        this.microbes.push(new Microbe(this.canvas.width, this.canvas.height, spawnedType, speedRange));
    }

    updateScoreUI() {
        document.getElementById(`score-${this.side}`).innerText = this.score;
    }

    updateLivesUI() {
        const hearts = document.querySelectorAll(`#lives-${this.side} .heart`);
        for (let i = 0; i < hearts.length; i++) {
            if (i >= this.lives) {
                hearts[i].classList.add('lost');
            } else {
                hearts[i].classList.remove('lost');
            }
        }
    }

    reset() {
        this.score = 0;
        this.lives = GAME_CONFIG.maxLives;
        this.microbes = [];
        this.particles = [];
        this.slicedHalves = [];
        this.activeSlashes = {};
        this.scorePopups = [];
        
        this.updateScoreUI();
        this.updateLivesUI();
    }

    update() {
        // Update level up timer banner
        if (this.levelUpBannerTimer > 0) {
            this.levelUpBannerTimer -= 0.016;
        }

        // Update Microbes
        for (let i = this.microbes.length - 1; i >= 0; i--) {
            const m = this.microbes[i];
            m.update(this.canvas.width, this.canvas.height);
            
            // Hapus microbe jika sudah habis waktu hidupnya (fully dissolved)
            if (m.isDissolving && m.opacity <= 0) {
                this.microbes.splice(i, 1);
            }
        }

        // Update Partikel
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update Belahan Sliced
        for (let i = this.slicedHalves.length - 1; i >= 0; i--) {
            const sh = this.slicedHalves[i];
            sh.update();
            if (sh.alpha <= 0) {
                this.slicedHalves.splice(i, 1);
            }
        }

        // Update Pop-up skor
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            const pop = this.scorePopups[i];
            pop.timer -= 0.02;
            if (pop.timer <= 0) {
                this.scorePopups.splice(i, 1);
            }
        }
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Gambar Belahan Microbe Sliced (Agar di belakang microbe utuh)
        this.slicedHalves.forEach(sh => sh.draw(this.ctx));

        // 2. Gambar Microbe Aktif
        this.microbes.forEach(m => m.draw(this.ctx));

        // 3. Gambar Partikel Cipratan & Tebasan
        this.particles.forEach(p => p.draw(this.ctx));

        // 4. Gambar Jejak Slicing
        for (const key in this.activeSlashes) {
            this.activeSlashes[key].draw(this.ctx);
        }

        // 5. Gambar Pop-up skor melayang
        this.ctx.save();
        this.scorePopups.forEach(pop => {
            this.ctx.font = 'bold 24px Orbitron';
            this.ctx.fillStyle = pop.color;
            this.ctx.globalAlpha = pop.timer;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = pop.color;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(pop.text, pop.x, pop.y - (1 - pop.timer) * 40);
        });
        this.ctx.restore();

        // 6. Gambar Banner Level Up
        if (this.levelUpBannerTimer > 0) {
            this.ctx.save();
            this.ctx.font = '900 48px Orbitron';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.globalAlpha = Math.min(1.0, this.levelUpBannerTimer);
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = this.side === 'left' ? '#00f5d4' : '#f500d4';
            
            // Latar belakang banner semitransparan
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(0, this.canvas.height / 2 - 50, this.canvas.width, 100);
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(this.levelUpBannerText, this.canvas.width / 2, this.canvas.height / 2 - 10);
            
            // Subteks
            this.ctx.font = '700 16px Orbitron';
            this.ctx.fillStyle = this.side === 'left' ? '#00f5d4' : '#f500d4';
            this.ctx.fillText("MUTASI MIKROBA MENINGKAT!", this.canvas.width / 2, this.canvas.height / 2 + 25);
            
            this.ctx.restore();
        }
    }
}

// --- GLOBAL GAME FLOW CONTROLS ---

function initGame() {
    const canvasLeft = document.getElementById('canvas-left');
    const canvasRight = document.getElementById('canvas-right');
    
    leftGameArea = new GameArea(canvasLeft, 'left');
    rightGameArea = new GameArea(canvasRight, 'right');
    
    // Resize listener
    window.addEventListener('resize', () => {
        if (leftGameArea) leftGameArea.resize();
        if (rightGameArea) rightGameArea.resize();
    });

    // Setup tombol menu utama
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-restart').addEventListener('click', startGame);
}

function startGame() {
    gameStarted = true;
    currentLevel = 1;
    
    // Hide UI Overlay
    document.getElementById('ui-overlay').classList.remove('active');
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-over-screen').classList.remove('active');

    // Reset tampilan Level di HUD
    document.getElementById('level-left').innerText = currentLevel;
    document.getElementById('level-right').innerText = currentLevel;
    
    // Reset kedua area game
    leftGameArea.reset();
    rightGameArea.reset();
    
    // Mulai spawn loop
    startSpawning();

    // Atur timer kenaikan level setiap 15 detik
    if (levelIntervalId) clearInterval(levelIntervalId);
    levelIntervalId = setInterval(() => {
        if (!gameStarted) return;
        currentLevel++;

        // Update teks level di HUD
        document.getElementById('level-left').innerText = currentLevel;
        document.getElementById('level-right').innerText = currentLevel;

        // Trigger efek teks Level Up pada canvas
        leftGameArea.triggerLevelUp(currentLevel);
        rightGameArea.triggerLevelUp(currentLevel);

        // Restart spawn timer dengan interval baru yang lebih cepat
        startSpawning();
    }, 15000);
    
    // Mulai animasi loop global
    requestAnimationFrame(gameLoop);
}

let spawnIntervalId = null;
function startSpawning() {
    if (spawnIntervalId) clearInterval(spawnIntervalId);
    
    const currentInterval = getSpawnInterval();
    
    spawnIntervalId = setInterval(() => {
        if (!gameStarted) return;
        
        // Spawn di kiri & kanan secara berkala
        leftGameArea.spawnMicrobe();
        rightGameArea.spawnMicrobe();
        
    }, currentInterval);
}

function endGame() {
    if (!gameStarted) return;
    gameStarted = false;
    
    clearInterval(spawnIntervalId);
    if (levelIntervalId) clearInterval(levelIntervalId);

    // Tampilkan screen game over
    document.getElementById('ui-overlay').classList.add('active');
    document.getElementById('game-over-screen').classList.add('active');
    
    // Update data skor akhir
    document.getElementById('final-score-left').innerText = leftGameArea.score;
    document.getElementById('final-score-right').innerText = rightGameArea.score;
    
    // Tentukan Pemenang
    const winnerText = document.getElementById('winner-text');
    if (leftGameArea.lives <= 0 && rightGameArea.lives <= 0) {
        winnerText.innerText = "KEDUA TIM GUGUR!";
        winnerText.className = "subtitle text-red";
    } else if (leftGameArea.lives <= 0) {
        winnerText.innerText = "TIM VIRUS (KANAN) MENANG SIMULASI!";
        winnerText.className = "subtitle text-magenta";
    } else if (rightGameArea.lives <= 0) {
        winnerText.innerText = "TIM BAKTERI (KIRI) MENANG SIMULASI!";
        winnerText.className = "subtitle text-cyan";
    } else {
        // Jika karena alasan lain simulasi disetop, bandingkan skor
        if (leftGameArea.score > rightGameArea.score) {
            winnerText.innerText = "TIM BAKTERI (KIRI) MENANG SKOR!";
            winnerText.className = "subtitle text-cyan";
        } else if (rightGameArea.score > leftGameArea.score) {
            winnerText.innerText = "TIM VIRUS (KANAN) MENANG SKOR!";
            winnerText.className = "subtitle text-magenta";
        } else {
            winnerText.innerText = "HASIL SERI!";
            winnerText.className = "subtitle";
        }
    }
}

function gameLoop() {
    if (!gameStarted) return;
    
    // Update game states
    leftGameArea.update();
    rightGameArea.update();
    
    // Render canvases
    leftGameArea.draw();
    rightGameArea.draw();
    
    requestAnimationFrame(gameLoop);
}

// Jalankan inisialisasi setelah window dimuat
window.addEventListener('DOMContentLoaded', initGame);
