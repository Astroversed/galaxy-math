const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const STATES = { MENU: 0, PLAYING: 1, GAMEOVER: 2 };
const STORAGE_KEYS = { bestScore: "galaxyMathBest" };
const ULTIMATE_MAX_CHARGE = 7;
const ULTIMATE_ACTIVE_TIME = 450;
const MAX_CHANCES = 2;
const GAME_FONT_FAMILY = '"Joystix", "Courier New", monospace';
const AUDIO_PATHS = {
    mainOst: "assets/Sounds ( SFX )/Main OST.mp3",
    enemyDeath: "assets/Sounds ( SFX )/Enemies Death.mp3",
    gameOver: "assets/Sounds ( SFX )/Game Over Screen.mp3",
    button: "assets/Sounds ( SFX )/Buttons Sound.mp3",
    ultimate: "assets/Sounds ( SFX )/Ultimate sound.mp3",
    laser: "assets/Sounds ( SFX )/Regular Laser Beam.mp3",
    glitch: "assets/Sounds ( SFX )/Glitch SFX.mp3"
};
const AUDIO_VOLUMES = {
    ostNormal: 0.35,
    ostUltimate: 0.14,
    ultimateLoop: 0.7
};
const QR_MODAL_CLOSE_MS = 180;
const ENEMY_VARIANT_KEYS = [
    "enemyVariant1",
    "enemyVariant2",
    "enemyVariant3",
    "enemyVariant4",
    "enemyVariant5",
    "enemyVariant6",
    "enemyVariant7",
    "enemyVariant8"
];

const CONFIG = {
    canvas: { width: 600, height: 800 },
    player: {
        width: 60,
        height: 40,
        speed: 4.4,
        startYOffset: 220,
        lives: 3
    },
    token: {
        width: 25,
        height: 25,
        fallSpeed: 3.15,
        dropChance: 0.02
    },
    bullet: {
        width: 6,
        height: 12,
        speed: 12
    },
    enemyBullet: {
        width: 8,
        height: 8
    },
    enemy: {
        width: 130,
        height: 65,
        spawnXMin: 40,
        spawnXRange: 420,
        spawnOffsetY: 180,
        baseSpeed: 2.05,

    },
    menuButtons: {
        primary: { x: 153, y: 378, w: 294, h: 94 },
        secondary: { x: 153, y: 478, w: 294, h: 94 }
    },
    hud: {
        panelHeight: 140,
        optionRowY: 693,
        optionWidth: 170,
        optionHeight: 75,
        optionXPositions: [20, 215, 410],
        optionLabelOffsetX: 8,
        optionLabelY: 711,
        optionValueY: 741,
        footerTopBorderY: 660
    },
    ultimate: {
        segments: 7,
        x: 0,
        y: 624,
        width: 600,
        height: 28,
        gap: 12
    }
};

canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

const dom = {
    outerFrameLayer: document.getElementById("game-outer-frame"),
    gameShell: document.getElementById("game-container"),
    qrTrigger: document.getElementById("projectQrTrigger"),
    qrModal: document.getElementById("projectQrModal"),
    qrClose: document.getElementById("projectQrClose"),
    qrBackdrop: document.querySelector(".pixel-qr-modal__backdrop"),
    qrImage: document.getElementById("projectQrImage"),
    touchControls: document.getElementById("touchControls"),
    touchJoystick: document.getElementById("touchJoystick"),
    touchJoystickStick: document.getElementById("touchJoystickStick"),
    touchUltimateButton: document.getElementById("touchUltimateButton"),
    assetNodes: Object.fromEntries(
        Array.from(document.querySelectorAll("[data-asset-key]")).map((node) => [node.dataset.assetKey, node])
    )
};

const audio = {
    backgroundMusic: null,
    ultimateLoop: null,
    gameOverLoop: null,
    unlocked: false,
    gameOverPlayed: false,
    ultimatePlayed: false
};

const keys = {};
let bestScore = Number(localStorage.getItem(STORAGE_KEYS.bestScore) || 0);
const ui = {
    mouseX: -9999,
    mouseY: -9999,
    hoveredButton: null,
    buttonFx: {},
    qrCloseTimer: null,
    qrCodeInstance: null,
    joystickPointerId: null,
    joystickOffsetX: 0,
    joystickOffsetY: 0
};

const game = {
    currentState: STATES.MENU,
    player: null,
    enemies: [],
    tokens: [],
    enemyBullets: [],
    currentOptions: [],
    score: 0,
    comboStreak: 0,
    isLaserActive: false,
    laserTimer: 0,
    isGlitching: false,
    isTakingDamage: false,
    canAttempt: true,
    attemptsLeft: 1,
    backgroundScroll: 0,
    enemyVariantBag: []
};

syncLayoutFromCss();
registerAssetListeners();
setupAudio();
setupProjectQrModal();
setupTouchControls();
updateResponsiveLayout();

function syncLayoutFromCss() {
    const rootStyles = getComputedStyle(document.documentElement);
    const readPx = (name, fallback) => {
        const value = parseFloat(rootStyles.getPropertyValue(name));
        return Number.isFinite(value) ? value : fallback;
    };

    CONFIG.ultimate.x = readPx("--ultimate-meter-x", CONFIG.ultimate.x);
    CONFIG.ultimate.y = readPx("--ultimate-meter-y", CONFIG.ultimate.y);
    CONFIG.ultimate.width = readPx("--ultimate-meter-width", CONFIG.ultimate.width);
    CONFIG.ultimate.height = readPx("--ultimate-meter-height", CONFIG.ultimate.height);
    CONFIG.ultimate.gap = readPx("--ultimate-meter-segment-gap", CONFIG.ultimate.gap);
}

function updateResponsiveLayout() {
    const horizontalPadding = 24;
    const verticalPadding = 24;
    const controlsVisible = Boolean(dom.touchControls && window.getComputedStyle(dom.touchControls).display !== "none");
    const reservedBottom = controlsVisible && isMobilePhoneLayout() ? 196 : 24;
    const reservedSide = controlsVisible && !isMobilePhoneLayout() ? 190 : 0;
    const availableWidth = Math.max(320, window.innerWidth - horizontalPadding - reservedSide);
    const availableHeight = Math.max(360, window.innerHeight - verticalPadding - reservedBottom);
    const baseScale = Math.min(availableWidth / CONFIG.canvas.width, availableHeight / CONFIG.canvas.height, 1);
    const scale = isMobilePhoneLayout() ? Math.min(baseScale, 0.84) : baseScale;
    document.documentElement.style.setProperty("--game-scale", String(scale));
    syncQrAvailability();
}

function isMobilePhoneLayout() {
    return window.matchMedia("(max-width: 820px)").matches;
}

function syncQrAvailability() {
    const qrEnabled = !isMobilePhoneLayout();

    if (dom.qrTrigger) {
        dom.qrTrigger.hidden = !qrEnabled;
        dom.qrTrigger.setAttribute("aria-hidden", String(!qrEnabled));
    }

    if (!qrEnabled && dom.qrModal) {
        if (ui.qrCloseTimer) {
            window.clearTimeout(ui.qrCloseTimer);
            ui.qrCloseTimer = null;
        }

        dom.qrModal.hidden = true;
        dom.qrModal.classList.remove("is-closing");
        dom.qrModal.setAttribute("aria-hidden", "true");
        dom.qrTrigger?.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
    }
}

function readCssColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function readCssPx(name, fallback) {
    const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
}

function renderProjectQrCode() {
    if (!dom.qrImage) return;

    dom.qrImage.classList.remove("is-fallback");
    dom.qrImage.replaceChildren();

    const qrUrl = window.location.href.split("#")[0];

    if (typeof window.QRCodeStyling !== "function") {
        dom.qrImage.classList.add("is-fallback");
        dom.qrImage.textContent = "QR no disponible.\nAbre esta URL:\n" + qrUrl;
        return;
    }

    if (!ui.qrCodeInstance) {
        ui.qrCodeInstance = new window.QRCodeStyling({
            width: 256,
            height: 256,
            type: "canvas",
            data: qrUrl,
            margin: 10,
            qrOptions: { errorCorrectionLevel: "Q" },
            dotsOptions: {
                type: "square",
                color: "#111111"
            },
            cornersSquareOptions: {
                type: "square",
                color: "#111111"
            },
            cornersDotOptions: {
                type: "square",
                color: "#111111"
            },
            backgroundOptions: {
                color: "#ffffff"
            }
        });
    } else {
        ui.qrCodeInstance.update({ data: qrUrl });
    }

    ui.qrCodeInstance.append(dom.qrImage);
}

function openProjectQrModal() {
    if (!dom.qrModal || isMobilePhoneLayout()) return;

    if (ui.qrCloseTimer) {
        window.clearTimeout(ui.qrCloseTimer);
        ui.qrCloseTimer = null;
    }

    renderProjectQrCode();
    dom.qrModal.hidden = false;
    dom.qrModal.classList.remove("is-closing");
    dom.qrModal.setAttribute("aria-hidden", "false");
    dom.qrTrigger?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
}

function closeProjectQrModal() {
    if (!dom.qrModal) return;

    if (ui.qrCloseTimer) {
        window.clearTimeout(ui.qrCloseTimer);
        ui.qrCloseTimer = null;
    }

    dom.qrModal.classList.add("is-closing");
    dom.qrTrigger?.setAttribute("aria-expanded", "false");
    ui.qrCloseTimer = window.setTimeout(() => {
        dom.qrModal.hidden = true;
        dom.qrModal.classList.remove("is-closing");
        dom.qrModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        ui.qrCloseTimer = null;
    }, QR_MODAL_CLOSE_MS);
}

function setupProjectQrModal() {
    dom.qrTrigger?.addEventListener("click", (event) => {
        event.preventDefault();
        openProjectQrModal();
    });

    dom.qrClose?.addEventListener("click", (event) => {
        event.preventDefault();
        closeProjectQrModal();
    });

    dom.qrBackdrop?.addEventListener("click", () => {
        closeProjectQrModal();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && dom.qrModal && !dom.qrModal.hidden) {
            closeProjectQrModal();
        }
    });
}

function getCanvasPointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

function getOptionIndexAt(x, y) {
    if (game.currentState !== STATES.PLAYING) return -1;

    for (let index = 0; index < CONFIG.hud.optionXPositions.length; index++) {
        const rect = {
            x: CONFIG.hud.optionXPositions[index],
            y: CONFIG.hud.optionRowY,
            w: CONFIG.hud.optionWidth,
            h: CONFIG.hud.optionHeight
        };

        if (isInsideRect(x, y, rect)) return index;
    }

    return -1;
}

function isUltimateReady() {
    return game.currentState === STATES.PLAYING && !game.isGlitching && !game.isLaserActive && game.comboStreak >= ULTIMATE_MAX_CHARGE;
}

function triggerUltimate() {
    if (!isUltimateReady()) return false;
    game.isLaserActive = true;
    game.laserTimer = ULTIMATE_ACTIVE_TIME;
    game.comboStreak = 0;
    updateAudioMix();
    refreshTouchUltimateButton();
    return true;
}

function handleCanvasPress(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    unlockAudio();
    event.preventDefault();

    const { x, y } = getCanvasPointerPosition(event);
    ui.mouseX = x;
    ui.mouseY = y;

    if (game.currentState === STATES.MENU && isInsideRect(x, y, CONFIG.menuButtons.primary)) {
        playSfx("button", { volume: 0.65 });
        initGame();
        refreshButtonHover();
        return;
    }

    if (game.currentState === STATES.GAMEOVER) {
        if (isInsideRect(x, y, CONFIG.menuButtons.primary)) {
            playSfx("button", { volume: 0.65 });
            initGame();
            refreshButtonHover();
            return;
        }

        if (isInsideRect(x, y, CONFIG.menuButtons.secondary)) {
            playSfx("button", { volume: 0.65 });
            game.currentState = STATES.MENU;
            audio.gameOverPlayed = false;
            updateAudioMix();
            refreshButtonHover();
            return;
        }
    }

    handleAnswerSelection(getOptionIndexAt(x, y));
    refreshButtonHover();
}

function setDirectionalKeyState(control, isPressed) {
    keys[control] = isPressed;
}

function resetDirectionalKeys() {
    setDirectionalKeyState("ArrowLeft", false);
    setDirectionalKeyState("ArrowRight", false);
    setDirectionalKeyState("ArrowUp", false);
    setDirectionalKeyState("ArrowDown", false);
}

function updateJoystickVisual() {
    if (!dom.touchJoystickStick) return;

    dom.touchJoystickStick.style.transform = `translate(calc(-50% + ${ui.joystickOffsetX}px), calc(-50% + ${ui.joystickOffsetY}px))`;
    dom.touchJoystickStick.classList.toggle("is-active", ui.joystickPointerId !== null);
}

function updateJoystickState(clientX, clientY) {
    if (!dom.touchJoystick) return;

    const rect = dom.touchJoystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = Math.min(rect.width, rect.height) * 0.28;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    ui.joystickOffsetX = distance > 0 ? Math.cos(angle) * clampedDistance : 0;
    ui.joystickOffsetY = distance > 0 ? Math.sin(angle) * clampedDistance : 0;
    updateJoystickVisual();

    const threshold = maxDistance * 0.38;
    setDirectionalKeyState("ArrowLeft", ui.joystickOffsetX <= -threshold);
    setDirectionalKeyState("ArrowRight", ui.joystickOffsetX >= threshold);
    setDirectionalKeyState("ArrowUp", ui.joystickOffsetY <= -threshold);
    setDirectionalKeyState("ArrowDown", ui.joystickOffsetY >= threshold);
}

function releaseJoystick() {
    ui.joystickPointerId = null;
    ui.joystickOffsetX = 0;
    ui.joystickOffsetY = 0;
    resetDirectionalKeys();
    updateJoystickVisual();
}

function refreshTouchUltimateButton() {
    if (!dom.touchUltimateButton) return;
    dom.touchUltimateButton.classList.toggle("is-ready", isUltimateReady());
}

function setupTouchControls() {
    dom.touchJoystick?.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        unlockAudio();
        ui.joystickPointerId = event.pointerId;
        dom.touchJoystick.setPointerCapture?.(event.pointerId);
        updateJoystickState(event.clientX, event.clientY);
    });

    dom.touchJoystick?.addEventListener("pointermove", (event) => {
        if (ui.joystickPointerId !== event.pointerId) return;
        event.preventDefault();
        updateJoystickState(event.clientX, event.clientY);
    });

    const endJoystick = (event) => {
        if (ui.joystickPointerId !== event.pointerId) return;
        event.preventDefault();
        releaseJoystick();
    };

    dom.touchJoystick?.addEventListener("pointerup", endJoystick);
    dom.touchJoystick?.addEventListener("pointercancel", endJoystick);
    dom.touchJoystick?.addEventListener("pointerleave", endJoystick);

    dom.touchUltimateButton?.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        unlockAudio();
        dom.touchUltimateButton.classList.add("is-pressed");
        triggerUltimate();
        refreshTouchUltimateButton();
    });

    const releaseUltimateButton = (event) => {
        event.preventDefault();
        dom.touchUltimateButton?.classList.remove("is-pressed");
    };

    dom.touchUltimateButton?.addEventListener("pointerup", releaseUltimateButton);
    dom.touchUltimateButton?.addEventListener("pointercancel", releaseUltimateButton);
    dom.touchUltimateButton?.addEventListener("pointerleave", releaseUltimateButton);
    refreshTouchUltimateButton();
}

function getWaveBand(score) {
    if (score < 300) return 0;
    if (score < 500) return 1;
    if (score < 800) return 2;
    if (score < 1200) return 3;
    return 4;
}

function getWaveEnemyCount(score) {
    if (score < 100) return 1;
    if (score < 500) return 2;
    return 3;
}

function setupAudio() {
    audio.backgroundMusic = new Audio(AUDIO_PATHS.mainOst);
    audio.backgroundMusic.loop = true;
    audio.backgroundMusic.volume = AUDIO_VOLUMES.ostNormal;
    audio.backgroundMusic.preload = "auto";

    audio.ultimateLoop = new Audio(AUDIO_PATHS.ultimate);
    audio.ultimateLoop.loop = false;
    audio.ultimateLoop.volume = AUDIO_VOLUMES.ultimateLoop;
    audio.ultimateLoop.preload = "auto";

    audio.gameOverLoop = new Audio(AUDIO_PATHS.gameOver);
    audio.gameOverLoop.loop = true;
    audio.gameOverLoop.volume = 0.75;
    audio.gameOverLoop.preload = "auto";
}

function ensureBackgroundMusic() {
    if (!audio.backgroundMusic || !audio.unlocked) return;
    if (!audio.backgroundMusic.paused) return;
    audio.backgroundMusic.play().catch(() => {});
}

function updateAudioMix() {
    if (!audio.unlocked) return;

    if (audio.backgroundMusic) {
        if (game.currentState === STATES.GAMEOVER) {
            audio.backgroundMusic.pause();
        } else {
            audio.backgroundMusic.volume = game.isLaserActive ? AUDIO_VOLUMES.ostUltimate : AUDIO_VOLUMES.ostNormal;
            if (audio.backgroundMusic.paused) {
                audio.backgroundMusic.play().catch(() => {});
            }
        }
    }

    if (audio.ultimateLoop) {
        if (game.currentState === STATES.PLAYING && game.isLaserActive) {
            if (!audio.ultimatePlayed) {
                audio.ultimatePlayed = true;
                audio.ultimateLoop.currentTime = 0;
                audio.ultimateLoop.play().catch(() => {});
            }
        } else {
            audio.ultimatePlayed = false;
            if (!audio.ultimateLoop.paused) {
                audio.ultimateLoop.pause();
                audio.ultimateLoop.currentTime = 0;
            }
        }
    }

    if (audio.gameOverLoop) {
        if (game.currentState === STATES.GAMEOVER) {
            if (audio.gameOverLoop.paused) {
                audio.gameOverLoop.currentTime = 0;
                audio.gameOverLoop.play().catch(() => {});
            }
        } else if (!audio.gameOverLoop.paused) {
            audio.gameOverLoop.pause();
            audio.gameOverLoop.currentTime = 0;
        }
    }
}

function unlockAudio() {
    if (!audio.unlocked) audio.unlocked = true;
    ensureBackgroundMusic();
    updateAudioMix();
}

function playSfx(key, options = {}) {
    if (!audio.unlocked || !AUDIO_PATHS[key]) return;
    if (game.isLaserActive && !options.allowDuringUltimate) return;
    const sound = new Audio(AUDIO_PATHS[key]);
    sound.volume = options.volume ?? 0.6;
    sound.currentTime = key === "button" ? 2 : 0;
    sound.play().catch(() => {});
}

function registerAssetListeners() {
    Object.values(dom.assetNodes).forEach((img) => {
        if (!img) return;
        if (img.complete && img.naturalWidth > 0) img.dataset.loaded = "true";
        img.addEventListener("load", () => {
            img.dataset.loaded = "true";
            syncOuterFrameAsset();
        });
        img.addEventListener("error", () => {
            img.dataset.loaded = "false";
            syncOuterFrameAsset();
        });
    });

    syncOuterFrameAsset();
}

function hasAsset(key) {
    const asset = dom.assetNodes[key];
    return Boolean(asset && asset.dataset.loaded === "true" && asset.naturalWidth > 0);
}

function syncOuterFrameAsset() {
    if (!dom.outerFrameLayer) return;

    if (hasAsset("gameOuterFrame")) {
        const asset = dom.assetNodes.gameOuterFrame;
        dom.outerFrameLayer.style.backgroundImage = `url("${asset.currentSrc || asset.src}")`;
        dom.outerFrameLayer.dataset.loaded = "true";
        return;
    }

    dom.outerFrameLayer.style.backgroundImage = "";
    dom.outerFrameLayer.dataset.loaded = "false";
}

function drawAssetOrFallback(key, x, y, w, h, fallback, options = {}) {
    if (hasAsset(key)) {
        const asset = dom.assetNodes[key];
        ctx.save();
        if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
        if (options.fit === "contain") {
            const sourceWidth = asset.naturalWidth || w;
            const sourceHeight = asset.naturalHeight || h;
            const scale = Math.min(w / sourceWidth, h / sourceHeight);
            const drawWidth = sourceWidth * scale;
            const drawHeight = sourceHeight * scale;
            const drawX = x + (w - drawWidth) / 2;
            const drawY = y + (h - drawHeight) / 2;
            ctx.drawImage(asset, drawX, drawY, drawWidth, drawHeight);
        } else {
            ctx.drawImage(asset, x, y, w, h);
        }
        ctx.restore();
        return;
    }
    fallback();
}

function initGame() {
    game.player = {
        x: canvas.width / 2 - (CONFIG.player.width / 2),
        y: canvas.height - CONFIG.player.startYOffset,
        w: CONFIG.player.width,
        h: CONFIG.player.height,
        speed: CONFIG.player.speed,
        lives: CONFIG.player.lives,
        bullets: []
    };

    game.enemies = [];
    game.tokens = [];
    game.enemyBullets = [];
    game.currentOptions = [];
    game.score = 0;
    game.comboStreak = 0;
    game.isLaserActive = false;
    game.laserTimer = 0;
    game.isGlitching = false;
    game.isTakingDamage = false;
    game.canAttempt = true;
    game.attemptsLeft = 1;
    game.backgroundScroll = 0;
    game.enemyVariantBag = [];
    game.currentState = STATES.PLAYING;
    audio.gameOverPlayed = false;
    releaseJoystick();
    updateAudioMix();
    refreshTouchUltimateButton();
}

function shuffleArray(array) {
    for (let index = array.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
    }
    return array;
}

function getAvailableEnemyVariantKeys() {
    const loadedVariants = ENEMY_VARIANT_KEYS.filter((key) => hasAsset(key));
    return loadedVariants.length > 0 ? loadedVariants : ENEMY_VARIANT_KEYS;
}

function getNextEnemyVariantKey() {
    if (game.enemyVariantBag.length === 0) {
        game.enemyVariantBag = shuffleArray([...getAvailableEnemyVariantKeys()]);
    }
    return game.enemyVariantBag.shift();
}

function createEquation() {
    let a;
    let b;
    let result;
    let text;

    if (game.score < 300) {
        const intensity = Math.floor(game.score / 60);
        a = Math.floor(Math.random() * (10 + intensity * 8)) + 2;
        b = Math.floor(Math.random() * (10 + intensity * 8)) + 2;
        result = a + b;
        text = `${a} + ${b}`;
    } else if (game.score < 500) {
        const intensity = Math.floor((game.score - 300) / 40);
        a = Math.floor(Math.random() * (20 + intensity * 15)) + 15;
        b = Math.floor(Math.random() * a) + 1;
        result = a - b;
        text = `${a} - ${b}`;
    } else if (game.score < 800) {
        const intensity = Math.floor((game.score - 500) / 60);
        a = Math.floor(Math.random() * (4 + intensity)) + 2;
        b = Math.floor(Math.random() * (10 + intensity)) + 2;
        result = a * b;
        text = `${a} x ${b}`;
    } else if (game.score < 1200) {
        const intensity = Math.floor((game.score - 800) / 80);
        result = Math.floor(Math.random() * (8 + intensity * 2)) + 2;
        b = Math.floor(Math.random() * (6 + intensity * 2)) + 2;
        a = b * result;
        text = `${a} ÷ ${b}`;
    } else {
        const type = Math.floor(Math.random() * 4);
        a = Math.floor(Math.random() * 50) + 20;
        b = Math.floor(Math.random() * 50) + 20;

        if (type === 0) {
            result = a + b;
            text = `${a} + ${b}`;
        } else if (type === 1) {
            result = b;
            text = `${a + b} - ${a}`;
        } else if (type === 2) {
            a = Math.floor(Math.random() * 12) + 2;
            b = Math.floor(Math.random() * 15) + 5;
            result = a * b;
            text = `${a} x ${b}`;
        } else {
            b = Math.floor(Math.random() * 12) + 2;
            result = Math.floor(Math.random() * 12) + 2;
            a = b * result;
            text = `${a} ÷ ${b}`;
        }
    }

    return { text, result };
}

function getTargetEnemy() {
    if (game.enemies.length === 0) return null;
    return [...game.enemies].sort((a, b) => b.y - a.y)[0];
}

function updateTargetOptions() {
    const targetEnemy = getTargetEnemy();
    if (!targetEnemy) return;
    game.currentOptions = generateOptions(targetEnemy.answer);
    game.canAttempt = true;
}

function generateOptions(correct) {
    const options = new Set([correct]);
    while (options.size < 3) {
        const variance = Math.floor(Math.random() * 5) + 1;
        const wrong = correct + variance * (Math.random() < 0.5 ? 1 : -1);
        if (wrong >= 0) options.add(wrong);
    }
    return Array.from(options).sort(() => Math.random() - 0.5);
}

function spawnDrop(x, y) {
    if (game.attemptsLeft < MAX_CHANCES && Math.random() < CONFIG.token.dropChance) {
        game.tokens.push({ x, y, w: CONFIG.token.width, h: CONFIG.token.height });
    }
}

function isInsideRect(mouseX, mouseY, rect) {
    return mouseX > rect.x && mouseX < rect.x + rect.w && mouseY > rect.y && mouseY < rect.y + rect.h;
}

function getButtonFxState(key) {
    if (!ui.buttonFx[key]) {
        ui.buttonFx[key] = { progress: 0 };
    }
    return ui.buttonFx[key];
}

function getHoveredButtonKey() {
    if (game.currentState === STATES.MENU) {
        return isInsideRect(ui.mouseX, ui.mouseY, CONFIG.menuButtons.primary) ? "menuStartButton" : null;
    }

    if (game.currentState === STATES.GAMEOVER) {
        if (isInsideRect(ui.mouseX, ui.mouseY, CONFIG.menuButtons.primary)) return "retryButton";
        if (isInsideRect(ui.mouseX, ui.mouseY, CONFIG.menuButtons.secondary)) return "homeButton";
    }

    return null;
}

function refreshButtonHover() {
    ui.hoveredButton = getHoveredButtonKey();
    canvas.style.cursor = ui.hoveredButton ? "pointer" : "default";
}

function drawPixelButtonLine(rect, progress, colorPrimary, colorSecondary, textWidth) {
    if (progress <= 0.03) return;

    const blockSize = readCssPx("--button-line-block-size", 8);
    const gap = readCssPx("--button-line-gap", 4);
    const centerX = rect.x + rect.w / 2;
    const lineY = rect.y + rect.h / 2 + 20;
    const step = blockSize + gap;
    const halfTextWidth = Math.max(blockSize / 2, textWidth / 2);
    const maxHalfWidth = halfTextWidth + blockSize;
    const visibleHalfWidth = maxHalfWidth * progress;
    const pairCount = Math.max(1, Math.floor(visibleHalfWidth / step));

    ctx.save();
    ctx.globalAlpha = 0.65 + progress * 0.25;

    for (let index = 0; index < pairCount; index++) {
        const offset = index * step;
        const drawColor = index % 2 === 0 ? colorPrimary : colorSecondary;
        ctx.fillStyle = drawColor;

        if (index === 0) {
            ctx.fillRect(centerX - blockSize / 2, lineY, blockSize, blockSize);
            continue;
        }

        ctx.fillRect(centerX - blockSize / 2 - offset, lineY, blockSize, blockSize);
        ctx.fillRect(centerX - blockSize / 2 + offset, lineY, blockSize, blockSize);
    }

    ctx.restore();
}

function activateUltimateIfReady() {
    if (game.comboStreak >= ULTIMATE_MAX_CHARGE && !game.isLaserActive) {
        return true;
    }
    return false;
}

function handleAnswerSelection(selectedIndex) {
    if (selectedIndex === -1 || game.currentState !== STATES.PLAYING || game.isGlitching || !game.canAttempt || game.attemptsLeft <= 0) {
        return;
    }

    const targetEnemy = getTargetEnemy();
    if (!targetEnemy) return;

    if (game.currentOptions[selectedIndex] === targetEnemy.answer) {
        game.comboStreak++;
        activateUltimateIfReady();
        playSfx("laser", { volume: 0.45 });
        game.player.bullets.push({
            x: game.player.x + game.player.w / 2 - (CONFIG.bullet.width / 2),
            y: game.player.y,
            w: CONFIG.bullet.width,
            h: CONFIG.bullet.height,
            speed: CONFIG.bullet.speed,
            targetId: targetEnemy.id,
            vx: 0,
            vy: -CONFIG.bullet.speed
        });
        game.canAttempt = false;
        return;
    }

    game.comboStreak = 0;
    game.attemptsLeft--;
    game.isGlitching = true;
    game.canAttempt = false;
    playSfx("glitch", { volume: 0.55 });

    const reducedPenalty = game.attemptsLeft === 0 ? 650 : 210;
    setTimeout(() => {
        game.isGlitching = false;
        if (game.attemptsLeft === 0) game.attemptsLeft = 1;
        game.canAttempt = true;
        refreshTouchUltimateButton();
    }, reducedPenalty);
}

window.addEventListener("keydown", (event) => {
    unlockAudio();
    keys[event.code] = true;
    const selectedIndex = event.key === "1" ? 0 : event.key === "2" ? 1 : event.key === "3" ? 2 : -1;
    handleAnswerSelection(selectedIndex);

    if (event.code === "KeyG") triggerUltimate();
    refreshTouchUltimateButton();
});

window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
    refreshTouchUltimateButton();
});

window.addEventListener("resize", () => {
    syncLayoutFromCss();
    updateResponsiveLayout();
});

canvas.addEventListener("mousemove", (event) => {
    const { x, y } = getCanvasPointerPosition(event);
    ui.mouseX = x;
    ui.mouseY = y;
    refreshButtonHover();
});

canvas.addEventListener("mouseleave", () => {
    ui.mouseX = -9999;
    ui.mouseY = -9999;
    refreshButtonHover();
});

canvas.addEventListener("pointerdown", handleCanvasPress);

function updateBackgroundScroll() {
    if (game.currentState !== STATES.PLAYING) return;
    game.backgroundScroll -= 1.35;
}

function getPlayerBottomLimit() {
    const ultimateFrameY = readCssPx("--ultimate-frame-y", 616);
    return ultimateFrameY - game.player.h;
}

function updatePlayerMovement() {
    if (keys.ArrowLeft && game.player.x > 0) game.player.x -= game.player.speed;
    if (keys.ArrowRight && game.player.x < canvas.width - game.player.w) game.player.x += game.player.speed;
    if (keys.ArrowUp && game.player.y > 0) game.player.y -= game.player.speed;
    const bottomLimit = getPlayerBottomLimit();
    if (keys.ArrowDown && game.player.y < bottomLimit) game.player.y += game.player.speed;
    if (game.player.y > bottomLimit) game.player.y = bottomLimit;
}

function updateUltimateState() {
    if (!game.isLaserActive) return;
    game.laserTimer--;
    if (game.laserTimer <= 0) {
        game.isLaserActive = false;
        updateAudioMix();
        refreshTouchUltimateButton();
    }
}

function updatePlayerBullets() {
    for (let i = game.player.bullets.length - 1; i >= 0; i--) {
        const bullet = game.player.bullets[i];
        const target = game.enemies.find((enemy) => enemy.id === bullet.targetId);

        if (target) {
            const dx = target.x + target.w / 2 - bullet.x;
            const dy = target.y + target.h / 2 - bullet.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            bullet.vx = (dx / distance) * bullet.speed;
            bullet.vy = (dy / distance) * bullet.speed;
        } else {
            bullet.vx = 0;
            bullet.vy = -bullet.speed;
        }

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        if (bullet.y < -20 || bullet.y > canvas.height || bullet.x < -20 || bullet.x > canvas.width) {
            game.player.bullets.splice(i, 1);
            game.canAttempt = true;
        }
    }
}

function applyDamageToPlayer() {
    game.player.lives--;
    game.comboStreak = 0;
    game.isTakingDamage = true;
    setTimeout(() => {
        game.isTakingDamage = false;
    }, 300);
}

function updateEnemyBullets() {
    for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = game.enemyBullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        if (
            game.isLaserActive &&
            bullet.x > game.player.x - 110 &&
            bullet.x < game.player.x + game.player.w + 110 &&
            bullet.y < game.player.y
        ) {
            game.enemyBullets.splice(i, 1);
            continue;
        }

        if (isColliding(bullet, game.player)) {
            game.enemyBullets.splice(i, 1);
            applyDamageToPlayer();
            continue;
        }

        if (bullet.y > canvas.height) game.enemyBullets.splice(i, 1);
    }
}

function updateTokens() {
    for (let i = game.tokens.length - 1; i >= 0; i--) {
        const token = game.tokens[i];
        token.y += CONFIG.token.fallSpeed;

        if (isColliding(token, game.player)) {
            if (game.attemptsLeft < MAX_CHANCES) game.attemptsLeft++;
            game.tokens.splice(i, 1);
            continue;
        }

        if (token.y > canvas.height) game.tokens.splice(i, 1);
    }
}

function getOptionPanelHitY() {
    return readCssPx("--option-panel-y", canvas.height - CONFIG.hud.panelHeight);
}

function getCurrentEnemySpeed() {
    return CONFIG.enemy.baseSpeed;
}

function updateEnemies() {
    const currentSpeed = getCurrentEnemySpeed();
    const optionPanelHitY = getOptionPanelHitY();

    for (let enemyIndex = game.enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
        const enemy = game.enemies[enemyIndex];
        enemy.y += currentSpeed;

        if (
            game.isLaserActive &&
            enemy.x < game.player.x + game.player.w + 110 &&
            enemy.x + enemy.w > game.player.x - 110 &&
            enemy.y < game.player.y
        ) {
            playSfx("enemyDeath", { volume: 0.5 });
            spawnDrop(enemy.x + enemy.w / 2 - 12, enemy.y);
            game.enemies.splice(enemyIndex, 1);
            game.score += 2;
            updateTargetOptions();
            continue;
        }

        if (enemy.shootCooldown > 0) enemy.shootCooldown--;

        if (enemy.y > 0 && enemy.y < canvas.height - 350 && enemy.shootCooldown === 0 && game.enemyBullets.length < 3) {
            if (Math.random() < 0.01) {
                const dx = game.player.x + game.player.w / 2 - (enemy.x + enemy.w / 2);
                const dy = game.player.y + game.player.h / 2 - (enemy.y + enemy.h);
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                game.enemyBullets.push({
                    x: enemy.x + enemy.w / 2 - 4,
                    y: enemy.y + enemy.h,
                    w: CONFIG.enemyBullet.width,
                    h: CONFIG.enemyBullet.height,
                    vx: (dx / distance) * (currentSpeed + 2.2),
                    vy: (dy / distance) * (currentSpeed + 2.2)
                });

                enemy.shootCooldown = 200;
            }
        }

        for (let bulletIndex = game.player.bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
            const bullet = game.player.bullets[bulletIndex];
            if (!isColliding(bullet, enemy)) continue;

            if (bullet.targetId === enemy.id) {
                playSfx("enemyDeath", { volume: 0.5 });
                spawnDrop(enemy.x + enemy.w / 2 - 12, enemy.y);
                game.enemies.splice(enemyIndex, 1);
                game.player.bullets.splice(bulletIndex, 1);
                game.score += 2;
                updateTargetOptions();
                break;
            }
        }

        if (enemy && (isColliding(enemy, game.player) || enemy.y + enemy.h >= optionPanelHitY)) {
            game.enemies.splice(enemyIndex, 1);
            applyDamageToPlayer();
            updateTargetOptions();
        }

        if (game.player.lives <= 0) {
            game.currentState = STATES.GAMEOVER;
            game.isLaserActive = false;
            updateAudioMix();
            audio.gameOverPlayed = true;
            if (game.score > bestScore) {
                bestScore = game.score;
                localStorage.setItem(STORAGE_KEYS.bestScore, String(game.score));
            }
        }
    }

    updateEnemyBullets();
}

function spawnEnemiesIfNeeded() {
    if (game.enemies.length > 0) return;

    const count = getWaveEnemyCount(game.score);
    for (let i = 0; i < count; i++) {
        const equation = createEquation();
        game.enemies.push({
            id: Math.random(),
            x: Math.random() * CONFIG.enemy.spawnXRange + CONFIG.enemy.spawnXMin,
            y: -100 - (i * CONFIG.enemy.spawnOffsetY),
            w: CONFIG.enemy.width,
            h: CONFIG.enemy.height,
            assetKey: getNextEnemyVariantKey(),
            equation: equation.text,
            answer: equation.result,
            shootCooldown: Math.floor(Math.random() * 120)
        });
    }

    updateTargetOptions();
}

function isColliding(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update() {
    if (game.currentState !== STATES.PLAYING) return;
    updateBackgroundScroll();
    updatePlayerMovement();
    updateUltimateState();
    updatePlayerBullets();
    updateTokens();
    updateEnemies();
    spawnEnemiesIfNeeded();
    refreshTouchUltimateButton();
}

function drawButton(assetKey, rect, strokeColor, label) {
    const buttonFx = getButtonFxState(assetKey);
    const hovered = ui.hoveredButton === assetKey;
    buttonFx.progress += ((hovered ? 1 : 0) - buttonFx.progress) * 0.2;

    ctx.save();
    const hoverLift = -Math.round(buttonFx.progress * 5);
    const textY = rect.y + rect.h / 2 + 10 + hoverLift;
    const primaryTextColor = readCssColor("--text-button", "#ffffff");
    const buttonAccent = assetKey === "menuStartButton"
        ? readCssColor("--button-start-color", "#72ffd2")
        : assetKey === "retryButton"
            ? readCssColor("--button-retry-color", "#ffae57")
            : assetKey === "homeButton"
                ? readCssColor("--button-home-color", "#00E5FF")
                : readCssColor("--button-line-color", strokeColor);
    const shadowColor = buttonAccent;
    const linePrimary = buttonAccent;
    const lineSecondary = readCssColor("--button-line-color-soft", "#ffffff");

    ctx.textAlign = "center";
    ctx.font = `bold 32px ${GAME_FONT_FAMILY}`;
    const textWidth = ctx.measureText(label).width;
    ctx.shadowBlur = buttonFx.progress > 0.02 ? 18 + buttonFx.progress * 18 : 0;
    ctx.shadowColor = buttonFx.progress > 0.02 ? shadowColor : "transparent";

    if (hovered) {
        ctx.fillStyle = shadowColor;
        ctx.globalAlpha = 0.18;
        ctx.fillText(label, rect.x + rect.w / 2 + 1, textY + 1);
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = primaryTextColor;
    ctx.fillText(label, rect.x + rect.w / 2, textY);
    ctx.restore();

    drawPixelButtonLine(rect, buttonFx.progress, linePrimary, lineSecondary, textWidth);
}

function drawOptionAssetLayer(key, x, y, width, height, flipVertical = false, alpha = 1) {
    if (!hasAsset(key)) return false;

    const asset = dom.assetNodes[key];
    ctx.save();
    ctx.globalAlpha = alpha;

    if (flipVertical) {
        ctx.translate(x + width / 2, y + height / 2);
        ctx.scale(1, -1);
        ctx.drawImage(asset, -width / 2, -height / 2, width, height);
        ctx.restore();
        return true;
    }

    ctx.drawImage(asset, x, y, width, height);
    ctx.restore();
    return true;
}

function drawMenuBackground() {
    drawAssetOrFallback(
        "menuBackground",
        0,
        0,
        canvas.width,
        canvas.height,
        () => {
            ctx.fillStyle = "rgba(6, 16, 26, 0.18)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    );
}

function drawGameOverBackground() {
    drawAssetOrFallback(
        "gameOverBackground",
        0,
        0,
        canvas.width,
        canvas.height,
        () => {
            ctx.fillStyle = "rgba(12, 7, 18, 0.96)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    );
}

function drawLoopingBackgroundAsset(key) {
    if (!hasAsset(key)) {
        ctx.fillStyle = "rgba(6, 16, 26, 0.10)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const image = dom.assetNodes[key];
    const tileHeight = canvas.height;
    const normalizedOffset = ((game.backgroundScroll % tileHeight) + tileHeight) % tileHeight;
    const baseTileIndex = Math.floor(game.backgroundScroll / tileHeight);
    const firstTileY = -normalizedOffset - tileHeight;
    const visibleTileCount = Math.ceil(canvas.height / tileHeight) + 3;

    for (let index = 0; index < visibleTileCount; index++) {
        const tileIndex = baseTileIndex + index - 1;
        const y = firstTileY + index * tileHeight;
        const rotated = Math.abs(tileIndex) % 2 === 1;

        if (rotated) {
            ctx.save();
            ctx.translate(canvas.width / 2, y + tileHeight / 2);
            ctx.rotate(Math.PI);
            ctx.drawImage(image, -canvas.width / 2, -tileHeight / 2, canvas.width, tileHeight);
            ctx.restore();
            continue;
        }

        ctx.drawImage(image, 0, y, canvas.width, tileHeight);
    }
}

function drawMenuScreen() {
    drawAssetOrFallback(
        "menuTitle",
        -5,
        40,
        610,
        305,
        () => {
            ctx.fillStyle = readCssColor("--text-menu-title", "#ffffff");
            ctx.textAlign = "center";
            ctx.font = `bold 50px ${GAME_FONT_FAMILY}`;
            ctx.fillText("*GALAXY MATH*", canvas.width / 2, 250);
        },
        { fit: "contain" }
    );

    ctx.font = `bold 20px ${GAME_FONT_FAMILY}`;
    ctx.fillStyle = readCssColor("--text-menu-best", "#7cdfff");
    ctx.textAlign = "center";
    ctx.fillText(`|MEJOR PUNTUACION: ${bestScore}|`, canvas.width / 2, readCssPx("--menu-best-y", 320));

    drawButton("menuStartButton", CONFIG.menuButtons.primary, "#63d8ff", "[INICIAR]");
}

function drawGameOverScreen() {
    drawAssetOrFallback(
        "gameOverTitle",
        110,
        170,
        380,
        90,
        () => {
            ctx.fillStyle = readCssColor("--text-gameover-title", "#ff8a8a");
            ctx.textAlign = "center";
            ctx.font = `bold 45px ${GAME_FONT_FAMILY}`;
            ctx.fillText("*SISTEMA CAÍDO*", canvas.width / 2, 220);
        }
    );

    ctx.font = `bold 22px ${GAME_FONT_FAMILY}`;
    ctx.fillStyle = readCssColor("--text-gameover-score", "#ffffff");
    ctx.fillText(`|PUNTUACIÓN: ${game.score}|`, canvas.width / 2, 290);

    ctx.fillStyle = readCssColor("--text-gameover-best", "#7cdfff");
    ctx.fillText(`|RÉCORD: ${bestScore}|`, canvas.width / 2, 320);

    drawButton("retryButton", CONFIG.menuButtons.primary, "#63d8ff", "[REINTENTAR]");
    drawButton("homeButton", CONFIG.menuButtons.secondary, "#ff7eb6", "[INICIO]");
}

function drawGameplayEffects() {
    if (game.isTakingDamage) {
        ctx.translate(Math.random() * 28 - 14, Math.random() * 28 - 14);
        ctx.filter = "invert(12%) saturate(250%) contrast(145%)";
    }

    if (!game.isGlitching) return;

    ctx.translate(Math.random() * 110 - 55, Math.random() * 70 - 35);
    ctx.filter = `blur(${Math.random() * 4}px) saturate(240%) contrast(210%)`;
    ctx.globalCompositeOperation = "screen";

    ctx.fillStyle = "rgba(255, 126, 182, 0.25)";
    ctx.fillRect(Math.random() * 20 - 10, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(99, 216, 255, 0.18)";
    ctx.fillRect(Math.random() * 20 - 10, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = "source-over";
}

function drawUltimateBeam() {
    if (!game.isLaserActive) return;

    const beamWidth = 220 + Math.random() * 36;
    const beamX = game.player.x + game.player.w / 2 - beamWidth / 2;
    const beamHeight = game.player.y + 24;

    drawAssetOrFallback(
        "ultimateBeam",
        beamX,
        0,
        beamWidth,
        beamHeight,
        () => {
            const gradient = ctx.createLinearGradient(beamX, 0, beamX + beamWidth, 0);
            gradient.addColorStop(0, "rgba(141, 245, 255, 0)");
            gradient.addColorStop(0.16, "rgba(141, 245, 255, 0.35)");
            gradient.addColorStop(0.50, "rgba(255, 255, 255, 0.98)");
            gradient.addColorStop(0.84, "rgba(141, 245, 255, 0.35)");
            gradient.addColorStop(1, "rgba(141, 245, 255, 0)");

            ctx.fillStyle = gradient;
            ctx.fillRect(beamX, 0, beamWidth, beamHeight);

            ctx.fillStyle = "rgba(141, 245, 255, 0.18)";
            ctx.fillRect(beamX - 28, 0, beamWidth + 56, beamHeight);
        }
    );

    ctx.save();
    ctx.filter = "none";
    ctx.restore();
}

function drawUltimateHud() {
    const rootStyles = getComputedStyle(document.documentElement);
    const readPx = (name, fallback) => {
        const value = parseFloat(rootStyles.getPropertyValue(name));
        return Number.isFinite(value) ? value : fallback;
    };
    const nameX = readPx("--ultimate-name-x", 120);
    const nameY = readPx("--ultimate-name-y", 586);
    const nameWidth = readPx("--ultimate-name-width", 360);
    const nameHeight = readPx("--ultimate-name-height", 24);
    const promptX = readPx("--ultimate-prompt-x", 0);
    const promptY = readPx("--ultimate-prompt-y", 606);
    const promptWidth = readPx("--ultimate-prompt-width", 600);
    const promptHeight = readPx("--ultimate-prompt-height", 18);

    const titleText = "MATERAYO";
    ctx.textAlign = "center";
    ctx.font = `bold 20px ${GAME_FONT_FAMILY}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(titleText, nameX + nameWidth / 2, nameY + 19);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(titleText, nameX + nameWidth / 2, nameY + 19);

}

function drawBottomPanel() {
    const panelX = readCssPx("--option-panel-x", 0);
    const panelY = readCssPx("--option-panel-y", canvas.height - CONFIG.hud.panelHeight);
    const panelWidth = readCssPx("--option-panel-width", canvas.width);
    const panelHeight = readCssPx("--option-panel-height", CONFIG.hud.panelHeight);

    drawAssetOrFallback(
        "optionPanelBackground",
        panelX,
        panelY,
        panelWidth,
        panelHeight,
        () => {
            ctx.fillStyle = "rgba(15, 27, 42, 0.92)";
            ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(panelX, CONFIG.hud.footerTopBorderY, panelWidth, 4);
        }
    );

    if (!game.isGlitching) return;

    ctx.save();
    ctx.filter = "none";
    ctx.fillStyle = Math.floor(Date.now() / 200) % 2 === 0
        ? readCssColor("--text-system-warning-primary", "#ff7eb6")
        : readCssColor("--text-system-warning-secondary", "#ffffff");
    ctx.textAlign = "center";
    ctx.font = `bold 20px ${GAME_FONT_FAMILY}`;
    ctx.fillText("ERROR DE CÁLCULO...", canvas.width / 2, canvas.height - 115);
    ctx.restore();
}

function drawUltimateMeter() {
    const frameX = readCssPx("--ultimate-frame-x", 0);
    const frameY = readCssPx("--ultimate-frame-y", 616);
    const frameWidth = readCssPx("--ultimate-frame-width", canvas.width);
    const frameHeight = readCssPx("--ultimate-frame-height", 44);
    const totalCharge = game.isLaserActive
        ? (game.laserTimer / ULTIMATE_ACTIVE_TIME) * ULTIMATE_MAX_CHARGE
        : game.comboStreak;

    const filledSegments = game.isLaserActive
        ? Math.ceil((totalCharge / ULTIMATE_MAX_CHARGE) * CONFIG.ultimate.segments)
        : Math.floor((totalCharge / ULTIMATE_MAX_CHARGE) * CONFIG.ultimate.segments);

    const segmentWidth = (CONFIG.ultimate.width - CONFIG.ultimate.gap * (CONFIG.ultimate.segments + 1)) / CONFIG.ultimate.segments;

    drawAssetOrFallback(
        "ultimateMeterFrame",
        frameX,
        frameY,
        frameWidth,
        frameHeight,
        () => {
            ctx.fillStyle = "rgba(207, 239, 255, 0.16)";
            ctx.fillRect(frameX, frameY, frameWidth, frameHeight);
            ctx.strokeStyle = "#63d8ff";
            ctx.lineWidth = 2;
            ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);
        }
    );

    for (let index = 0; index < CONFIG.ultimate.segments; index++) {
        const x = CONFIG.ultimate.x + CONFIG.ultimate.gap + index * (segmentWidth + CONFIG.ultimate.gap);
        const y = CONFIG.ultimate.y;
        const isFilled = index < filledSegments;

        drawAssetOrFallback(
            isFilled ? "ultimateSegmentActive" : "ultimateSegment",
            x,
            y,
            segmentWidth,
            CONFIG.ultimate.height,
            () => {
                ctx.fillStyle = isFilled ? (game.isLaserActive ? "#8df5ff" : "#ffe680") : "rgba(17, 34, 52, 0.78)";
                ctx.fillRect(x, y, segmentWidth, CONFIG.ultimate.height);
                ctx.strokeStyle = game.isGlitching ? "#ff7eb6" : "#63d8ff";
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, segmentWidth, CONFIG.ultimate.height);
            }
        );
    }

    if (!game.isLaserActive && game.comboStreak >= ULTIMATE_MAX_CHARGE) {
        const promptText = ">> PRESIONA G PARA ACTIVAR <<";
        const promptCenterX = frameX + frameWidth / 2;
        const promptCenterY = frameY + frameHeight / 2 + 1;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold 16px ${GAME_FONT_FAMILY}`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#000000";
        ctx.strokeText(promptText, promptCenterX, promptCenterY);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(promptText, promptCenterX, promptCenterY);
        ctx.restore();
    }
}

function drawOptions() {
    const optionNumberOffsetX = readCssPx("--option-number-x", 10);
    const optionNumberY = readCssPx("--option-number-y", CONFIG.hud.optionLabelY);
    const optionNumberSize = readCssPx("--option-number-size", 11);

    game.currentOptions.forEach((option, index) => {
        const x = CONFIG.hud.optionXPositions[index];
        const y = CONFIG.hud.optionRowY;
        const flipVertical = index === 1;

        const drewFrameAsset = drawOptionAssetLayer(
            "optionFrame",
            x,
            y,
            CONFIG.hud.optionWidth,
            CONFIG.hud.optionHeight,
            flipVertical
        );

        if (!drewFrameAsset) {
            ctx.fillStyle = readCssColor("--option-fill", "rgba(207, 239, 255, 0.11)");
            ctx.fillRect(x, y, CONFIG.hud.optionWidth, CONFIG.hud.optionHeight);
            ctx.strokeStyle = game.attemptsLeft === 0
                ? readCssColor("--option-border-disabled", "#7f405e")
                : (game.isGlitching
                    ? readCssColor("--option-border-glitch", "#ff7eb6")
                    : readCssColor("--option-border", "#63d8ff"));
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, CONFIG.hud.optionWidth, CONFIG.hud.optionHeight);
        }

        drawOptionAssetLayer("option", x, y, CONFIG.hud.optionWidth, CONFIG.hud.optionHeight, flipVertical, 0.30);

        ctx.fillStyle = readCssColor("--text-option-index", "#83e6ff");
        ctx.font = `bold ${optionNumberSize}px ${GAME_FONT_FAMILY}`;
        ctx.textAlign = "right";
        ctx.fillText(`${index + 1}`, x + CONFIG.hud.optionWidth - optionNumberOffsetX, optionNumberY);

        ctx.fillStyle = readCssColor("--text-option-value", "#ffffff");
        ctx.textAlign = "center";
        ctx.font = `bold 30px ${GAME_FONT_FAMILY}`;
        ctx.fillText(option, x + CONFIG.hud.optionWidth / 2, CONFIG.hud.optionValueY);
    });
}

function drawPlayer() {
    drawAssetOrFallback(
        "player",
        game.player.x,
        game.player.y,
        game.player.w,
        game.player.h,
        () => {
            ctx.fillStyle = game.isTakingDamage ? "white" : "#83e6ff";
            ctx.fillRect(game.player.x, game.player.y, game.player.w, game.player.h);
        }
    );
}

function drawBullets() {
    game.player.bullets.forEach((bullet) => {
        drawAssetOrFallback(
            "playerBullet",
            bullet.x,
            bullet.y,
            bullet.w,
            bullet.h,
            () => {
                ctx.fillStyle = "#ffe680";
                ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
            }
        );
    });

    game.enemyBullets.forEach((bullet) => {
        drawAssetOrFallback(
            "enemyBullet",
            bullet.x,
            bullet.y,
            bullet.w,
            bullet.h,
            () => {
                ctx.fillStyle = "#ff7ed9";
                ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
            }
        );
    });
}

function drawTokens() {
    game.tokens.forEach((token) => {
        drawAssetOrFallback(
            "token",
            token.x,
            token.y,
            token.w,
            token.h,
            () => {
                ctx.fillStyle = Math.floor(Date.now() / 150) % 2 === 0 ? "#ffe680" : "#ffffff";
                ctx.fillRect(token.x, token.y, token.w, token.h);
                ctx.strokeStyle = "#63d8ff";
                ctx.strokeRect(token.x, token.y, token.w, token.h);
            }
        );
    });
}

function drawEnemies() {
    const targetEnemy = getTargetEnemy();

    game.enemies.forEach((enemy) => {
        const isTarget = enemy === targetEnemy;

        drawAssetOrFallback(
            enemy.assetKey || "enemy",
            enemy.x,
            enemy.y,
            enemy.w,
            enemy.h,
            () => {
                drawAssetOrFallback(
                    "enemy",
                    enemy.x,
                    enemy.y,
                    enemy.w,
                    enemy.h,
                    () => {
                        ctx.fillStyle = isTarget ? "#9c79ff" : "#4e7ca3";
                        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
                        ctx.strokeStyle = isTarget ? "#d8c6ff" : "#63d8ff";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(enemy.x, enemy.y, enemy.w, enemy.h);
                    }
                );
            }
        );

        ctx.fillStyle = readCssColor("--text-enemy-equation", "#ffffff");
        ctx.font = `bold 20px ${GAME_FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.fillText(enemy.equation, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2 + 8);
    });
}

function drawHudText() {
    ctx.textAlign = "left";
    ctx.font = `bold 18px ${GAME_FONT_FAMILY}`;

    ctx.fillStyle = readCssColor("--text-hud-score", "#ffffff");
    ctx.fillText(`PUNTAJE: ${game.score}`, 20, 35);

    ctx.fillStyle = readCssColor("--text-hud-best", "#ffffff");
    ctx.fillText(`RECORD: ${bestScore}`, 20, 55);

    ctx.fillStyle = game.attemptsLeft === 0
        ? readCssColor("--text-hud-chances-empty", "#ff7eb6")
        : readCssColor("--text-hud-chances", "#ffffff");
    ctx.fillText(`TOKENS: ${"I ".repeat(game.attemptsLeft)}`, 20, 75);
}

function drawLives() {
    for (let i = 0; i < game.player.lives; i++) {
        const x = canvas.width - 38 - (i * 30);
        const y = 27;

        drawAssetOrFallback(
            "life",
            x,
            y,
            16,
            16,
            () => {
                ctx.fillStyle = "#ff9090";
                ctx.beginPath();
                ctx.arc(x + 8, y + 8, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        );
    }
}

function drawPlayingScreen() {
    drawGameplayEffects();
    drawUltimateBeam();
    drawBullets();
    drawTokens();
    drawEnemies();
    drawPlayer();
    drawBottomPanel();
    drawUltimateHud();
    drawUltimateMeter();
    drawOptions();
    drawHudText();
    drawLives();
}

function draw() {
    refreshButtonHover();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    if (game.currentState === STATES.MENU) {
        drawMenuBackground();
        drawMenuScreen();
    } else if (game.currentState === STATES.GAMEOVER) {
        drawGameOverBackground();
        drawGameOverScreen();
    } else if (game.currentState === STATES.PLAYING) {
        drawLoopingBackgroundAsset("gameBackground");
        drawPlayingScreen();
    }

    ctx.restore();
    update();
    requestAnimationFrame(draw);
}

draw();
