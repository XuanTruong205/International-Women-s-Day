import * as t from "https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js";
let e, n, o;
setTimeout(() => {
    P();
}, 100);
let a,
    i,
    r,
    s = [],
    l = [],
    d = [],
    c = !1,
    f = 1,
    m = 0;
const u = 500,
    p = window.innerWidth < 768,
    w = {
        particleCount: /Zalo|FBAN|FBAV|Instagram|Line|MicroMessenger/i.test(
            navigator.userAgent || "",
        )
            ? p
                ? 3.5e4
                : 5e4
            : p
                ? 4.5e4
                : 10e4,
        particleSize: p ? 0.18 : 0.15,
        explosionPower: 150,
        gatherSpeed: p ? 0.08 : 0.05,
        depthThickness: p ? 1 : 1.5,
        colorStart: "#ff1493",
        colorEnd: "#ff69b4",
    };
let M, g;
const y = new Float32Array(3 * w.particleCount),
    b = new Float32Array(3 * w.particleCount);
let x = [],
    C = 0,
    A = 0,
    v = !1,
    B = !1,
    S = 0;
function checkIsIPad() {
    const ua = navigator.userAgent || "";
    if (/iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
        return true;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const minDim = Math.min(w, h);
    const maxDim = Math.max(w, h);
    if (w < h && minDim >= 700 && minDim <= 1024 && maxDim <= 1366) {
        return true;
    }
    if (navigator.maxTouchPoints > 1 && minDim >= 700 && minDim <= 1024 && maxDim <= 1366) {
        return true;
    }
    return false;
}
const T = (p || checkIsIPad()) ? 4e3 : 3500;
function P() {
    if (c) return;
    c = !0;
    const h = document.createElement("canvas");
    ((h.id = "effects-overlay"),
        (h.style.cssText =
            "\n        position: fixed;\n        top: 0;\n        left: 0;\n        width: 100%;\n        height: 100%;\n        pointer-events: none;\n        z-index: 2;\n    "),
        document.body.appendChild(h),
        (e = new t.Scene()),
        (n = new t.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            2e3,
        )),
        n.position.set(0, 25, 65),
        n.lookAt(0, 0, 0),
        (o = new t.WebGLRenderer({ canvas: h, alpha: !0, antialias: !0 })),
        o.setSize(window.innerWidth, window.innerHeight),
        o.setPixelRatio(Math.min(window.devicePixelRatio, 2)),
        o.setClearColor(0, 0),
        (function () {
            const n = [];
            for (let t = 0; t < 8e3; t++) {
                const t = 2e3 * (Math.random() - 0.5),
                    e = 2e3 * (Math.random() - 0.5),
                    o = 2e3 * (Math.random() - 0.5);
                n.push(t, e, o);
            }
            const o = new t.BufferGeometry();
            o.setAttribute("position", new t.Float32BufferAttribute(n, 3));
            const a = new t.PointsMaterial({
                color: 16777215,
                size: 0.5,
                transparent: !0,
                opacity: 0.6,
            });
            ((r = new t.Points(o, a)), e.add(r));
        })(),
        (function () {
            const n = [],
                o = [],
                a = new t.Color(16618901),
                r = new t.Color(16758968),
                s = new t.Color(10053324);
            for (let t = 0; t < 3e4; t++) {
                const t = 80 * Math.pow(Math.random(), 1.5),
                    e = Math.random() * Math.PI * 2,
                    i = 1 * t * 0.05,
                    l = Math.cos(e + i) * t,
                    d = 1.5 * (Math.random() - 0.5),
                    h = Math.sin(e + i) * t;
                n.push(l, d, h);
                const c = t / 80;
                let f;
                f =
                    c < 0.5 ? a.clone().lerp(r, 2 * c) : r.clone().lerp(s, 2 * (c - 0.5));
                const m = 0.1;
                ((f.r += (Math.random() - 0.5) * m),
                    (f.g += (Math.random() - 0.5) * m),
                    (f.b += (Math.random() - 0.5) * m),
                    o.push(f.r, f.g, f.b));
            }
            const l = new t.BufferGeometry();
            (l.setAttribute("position", new t.Float32BufferAttribute(n, 3)),
                l.setAttribute("color", new t.Float32BufferAttribute(o, 3)));
            const d = new t.PointsMaterial({
                size: 0.12,
                sizeAttenuation: !0,
                transparent: !0,
                opacity: 0.5,
                vertexColors: !0,
                blending: t.AdditiveBlending,
                depthWrite: !1,
            });
            ((i = new t.Points(l, d)), (i.position.y = -20), e.add(i));
        })(),
        (function () {
            const n = [];
            l = [];
            for (let t = 0; t < 8e3; t++) {
                const t = 200 * (Math.random() - 0.5),
                    e = 200 * Math.random() - 50,
                    o = 200 * (Math.random() - 0.5);
                (n.push(t, e, o),
                    l.push({
                        y: 0.02 * Math.random() + 0.01,
                        swayX: 0.1 * (Math.random() - 0.5),
                        swayZ: 0.1 * (Math.random() - 0.5),
                        freq: 0.5 * Math.random() + 0.2,
                    }));
            }
            const o = new t.BufferGeometry();
            o.setAttribute("position", new t.Float32BufferAttribute(n, 3));
            const i = new t.PointsMaterial({
                color: 16777215,
                size: 0.15,
                transparent: !0,
                opacity: 0.7,
                blending: t.AdditiveBlending,
                depthWrite: !1,
            });
            ((a = new t.Points(o, i)), e.add(a));
        })(),
        (function () {
            g = new t.BufferGeometry();
            const n = new Float32Array(3 * w.particleCount);
            for (let t = 0; t < w.particleCount; t++) {
                const _r = 20 + 40 * Math.random(),
                    _th = Math.random() * Math.PI * 2,
                    _ph = Math.acos(2 * Math.random() - 1);
                ((y[3 * t] = _r * Math.sin(_ph) * Math.cos(_th)),
                    (y[3 * t + 1] = _r * Math.sin(_ph) * Math.sin(_th)),
                    (y[3 * t + 2] = _r * Math.cos(_ph)),
                    (b[3 * t] = y[3 * t]),
                    (b[3 * t + 1] = y[3 * t + 1]),
                    (b[3 * t + 2] = y[3 * t + 2]),
                    (n[3 * t] = 0.78 + 0.15 * Math.random()),
                    (n[3 * t + 1] = 0.1 + 0.15 * Math.random()),
                    (n[3 * t + 2] = 0.35 + 0.15 * Math.random()));
            }
            (g.setAttribute("position", new t.BufferAttribute(y, 3)),
                g.setAttribute("color", new t.BufferAttribute(n, 3)));
            const o = new t.PointsMaterial({
                size: w.particleSize,
                map: D(),
                vertexColors: !0,
                transparent: !0,
                opacity: 1,
                depthWrite: !1,
                blending: t.AdditiveBlending,
            });
            ((M = new t.Points(g, o)), M.position.set(0, 8, 0), e.add(M));
        })(),
        window.addEventListener(
            "__textStart",
            function () {
                ((window.__textStarted = !0), z());
            },
            { once: !0 },
        ),
        window.addEventListener("configLoaded", function () {
            window.__textStarted && z();
        }),
        (m = Date.now()),
        W(1),
        H(),
        window.addEventListener("resize", L),
        console.log("Enhanced effects initialized with particle text"));
}
function z() {
    if (M && n) {
        M.quaternion.copy(n.quaternion);
    }
    (window.Heartlove && window.Heartlove.data && window.Heartlove.data.messages
        ? (x = window.Heartlove.data.messages)
        : window.dataChristmasTree &&
        window.dataChristmasTree.data &&
        window.dataChristmasTree.data.messages &&
        (x = window.dataChristmasTree.data.messages),
        (x && 0 !== x.length) ||
        (x = [
            "Chúc Mừng 20/10 💐",
            "Gửi Đến Chi Re ✨",
            "Chúc Chi Luôn Xinh Đẹp ✨",
            "Rạng Rỡ & Hạnh Phúc ✨"
        ]));
    const t = () => {
        (F(x[0]), (A = Date.now()));
    };
    document.fonts && document.fonts.check("48px Pacifico")
        ? setTimeout(t, 100)
        : document.fonts && document.fonts.ready
            ? document.fonts.ready.then(() => setTimeout(t, 200))
            : setTimeout(t, 500);
}
function D() {
    const e = document.createElement("canvas");
    ((e.width = 64), (e.height = 64));
    const n = e.getContext("2d"),
        o = n.createRadialGradient(32, 32, 0, 32, 32, 32);
    return (
        o.addColorStop(0, "rgba(255,255,255,1)"),
        o.addColorStop(0.3, "rgba(255,255,255,0.95)"),
        o.addColorStop(0.5, "rgba(255,255,255,0.6)"),
        o.addColorStop(0.7, "rgba(255,200,220,0.15)"),
        o.addColorStop(1, "rgba(0,0,0,0)"),
        (n.fillStyle = o),
        n.fillRect(0, 0, 64, 64),
        new t.CanvasTexture(e)
    );
}
function E(ctx, text, centerX, centerY, spacing, renderType) {
    if (spacing <= 0) {
        return void (renderType === "fill" ? ctx.fillText(text, centerX, centerY) : ctx.strokeText(text, centerX, centerY));
    }
    const chars = Array.from(text);
    const totalWidth = chars.reduce((acc, ch) => acc + ctx.measureText(ch).width + spacing, -spacing);
    let currentX = centerX - totalWidth / 2;
    for (const ch of chars) {
        const charW = ctx.measureText(ch).width;
        if (renderType === "fill") {
            ctx.fillText(ch, currentX + charW / 2, centerY);
        } else {
            ctx.strokeText(ch, currentX + charW / 2, centerY);
        }
        currentX += charW + spacing;
    }
}
function F(e) {
    if (C > 0)
        for (let t = 0; t < w.particleCount; t++) {
            const e = w.explosionPower;
            ((y[3 * t] += (Math.random() - 0.5) * e),
                (y[3 * t + 1] += (Math.random() - 0.5) * e),
                (y[3 * t + 2] += (Math.random() - 0.5) * e));
        }
    !(function (textStr) {
        const isMob = window.innerWidth < 768;
        const nCanvas = isMob ? 600 : 1200;
        const oCanvas = 500;
        let fontSize = isMob ? 85 : 150;
        const depth = w.depthThickness;
        const rCanvas = document.createElement("canvas");
        rCanvas.width = nCanvas;
        rCanvas.height = oCanvas;
        const sCtx = rCanvas.getContext("2d");
        const fontFam = '"Mali", "Pacifico", "Dancing Script", cursive';
        const letterSpacing = isMob ? 2 : 4;
        const maxLineWidth = 0.85 * nCanvas;

        function wrapText(size) {
            sCtx.font = `${size}px ${fontFam}`;
            const lines = [];
            const words = textStr.split(" ");
            let currentLine = words[0] || "";
            for (let t = 1; t < words.length; t++) {
                const testLine = currentLine + " " + words[t];
                sCtx.measureText(testLine).width + testLine.length * letterSpacing > maxLineWidth
                    ? (lines.push(currentLine), (currentLine = words[t]))
                    : (currentLine = testLine);
            }
            lines.push(currentLine);
            return lines;
        }

        let lines = wrapText(fontSize);
        for (let t = 0; t < 5; t++) {
            const lineHeight = 1.6 * fontSize;
            if (lines.length * lineHeight > 425) {
                fontSize = Math.floor(0.85 * fontSize);
                lines = wrapText(fontSize);
                continue;
            }
            sCtx.font = `${fontSize}px ${fontFam}`;
            let tooWide = false;
            for (const line of lines) {
                if (sCtx.measureText(line).width + line.length * letterSpacing > maxLineWidth) {
                    tooWide = true;
                    break;
                }
            }
            if (!tooWide) break;
            fontSize = Math.floor(0.85 * fontSize);
            lines = wrapText(fontSize);
        }

        sCtx.fillStyle = "#000";
        sCtx.fillRect(0, 0, nCanvas, oCanvas);
        sCtx.font = `${fontSize}px ${fontFam}`;
        sCtx.textAlign = "center";
        sCtx.textBaseline = "middle";
        sCtx.lineJoin = "round";

        const lineHeight = 1.6 * fontSize;
        const startY = 250 - ((lines.length - 1) * lineHeight) / 2;
        sCtx.strokeStyle = "#ffffff";
        sCtx.lineWidth = isMob ? 6 : 8;
        for (let t = 0; t < lines.length; t++) {
            const lineY = startY + t * lineHeight;
            E(sCtx, lines[t], nCanvas / 2, lineY, letterSpacing, "stroke");
        }
        sCtx.fillStyle = "#ffffff";
        for (let t = 0; t < lines.length; t++) {
            const lineY = startY + t * lineHeight;
            E(sCtx, lines[t], nCanvas / 2, lineY, letterSpacing, "fill");
        }

        const imgData = sCtx.getImageData(0, 0, nCanvas, oCanvas).data;
        const points = [];
        for (let yPixel = 0; yPixel < oCanvas; yPixel++) {
            for (let xPixel = 0; xPixel < nCanvas; xPixel++) {
                const brightness = imgData[4 * (yPixel * nCanvas + xPixel)];
                if (brightness > 100) points.push({ x: xPixel, y: yPixel, b: brightness });
            }
        }

        // Căn chỉnh tỉ lệ 3D theo khung nhìn thực tế: không bị tràn lề hay méo viền trên màn hình hẹp
        const aspect = window.innerWidth / window.innerHeight;
        const camDist = 69.64;
        const vFOV = (75 * Math.PI) / 180;
        const visibleHeight = 2 * camDist * Math.tan(vFOV / 2);
        const visibleWidth = visibleHeight * aspect;

        let textScale;
        if (aspect < 1) {
            const targetWidth3D = visibleWidth * 0.78;
            textScale = Math.min(0.08, targetWidth3D / (0.85 * nCanvas));
        } else {
            textScale = 0.1;
        }

        const offsetX = (-nCanvas * textScale) / 2;

        // Đẩy chữ intro lên trên ~6% chiều cao khung nhìn trên iPad để tạo bố cục thoáng và cách xa nút bấm bên dưới
        const offsetY = checkIsIPad() ? visibleHeight * 0.06 : 0;
        const colorStart = new t.Color(w.colorStart);
        const colorEnd = new t.Color(w.colorEnd);
        const colorAttr = g.attributes.color;

        for (let t = 0; t < w.particleCount; t++) {
            if (points.length > 0) {
                const pt = points[Math.floor(Math.random() * points.length)];
                b[3 * t]     = pt.x * textScale + offsetX;
                b[3 * t + 1] = -pt.y * textScale + (oCanvas * textScale) / 2 + offsetY;
                b[3 * t + 2] = (Math.random() - 0.5) * depth;

                const normB = pt.b / 255;
                const ptColor = colorStart.clone().lerp(colorEnd, 1 - normB);
                ptColor.r = Math.min(1, 1.15 * ptColor.r);
                colorAttr.setXYZ(t, ptColor.r, ptColor.g, ptColor.b);
            } else {
                b[3 * t]     = 40 * (Math.random() - 0.5);
                b[3 * t + 1] = 15 * (Math.random() - 0.5) + offsetY;
                b[3 * t + 2] = 2 * (Math.random() - 0.5);
                colorAttr.setXYZ(t, 1, 0.08, 0.58);
            }
        }
        colorAttr.needsUpdate = true;
    })(e);
}
function H() {
    requestAnimationFrame(H);
    const t = 5e-4 * Date.now(),
        r = Date.now();
    if (f < 1 && m > 0) {
        const t = r - m;
        ((f = Math.min(1, t / u)), W(f));
    }
    if (M && !x.length) {
        for (let i = 0; i < w.particleCount; i++) {
            const n = 3 * i,
                o = 3 * i + 1,
                a = 3 * i + 2;
            ((y[n] = b[n] + Math.sin(t * 0.6 + i * 0.013) * 1.5),
                (y[o] = b[o] + Math.cos(t * 0.5 + i * 0.017) * 1.5),
                (y[a] = b[a] + Math.sin(t * 0.7 + i * 0.011) * 1.2));
        }
        ((g.attributes.position.needsUpdate = !0),
            (M.position.y = 8 + 0.6 * Math.sin(0.8 * t)),
            (M.rotation.y += 3e-4));
    } else if (M && x.length > 0) {
        // Căn chỉnh chữ thẳng tuyệt đối chính diện mắt người dùng (billboard theo camera)
        // Loại bỏ hoàn toàn góc nghiêng Y bị tích lũy lúc chờ và góc chúc xuống của camera
        M.quaternion.copy(n.quaternion);

        // Đưa tâm chữ về đúng chính diện mắt (Y = 0) với dao động thở siêu nhẹ nhàng
        if (!B) {
            const targetY = 0.35 * Math.sin(1.2 * t);
            M.position.x += (0 - M.position.x) * 0.08;
            M.position.y += (targetY - M.position.y) * 0.08;
            M.position.z += (0 - M.position.z) * 0.08;
        }

        const e = B ? 0.008 : w.gatherSpeed;
        for (let t = 0; t < w.particleCount; t++) {
            const n = 3 * t,
                o = 3 * t + 1,
                a = 3 * t + 2;
            ((y[n] += (b[n] - y[n]) * e),
                (y[o] += (b[o] - y[o]) * e),
                (y[a] += (b[a] - y[a]) * e));
        }
        if (
            ((g.attributes.position.needsUpdate = !0),
                B && S > 0)
        ) {
            const t = r - S;
            if (t > 100) {
                const e = Math.min(1, (t - 100) / 300);
                M.material.opacity = 1 - e;
            }
            t > 300 &&
                B &&
                ((B = !1),
                    (M.visible = !1),
                    window.dispatchEvent(new CustomEvent("textMessagesComplete")),
                    console.log("Particle explosion done - showing sphere"));
        }
        if (A > 0 && !v && r - A > T)
            if ((C++, C < x.length)) (F(x[C]), (A = r));
            else {
                ((v = !0), (B = !0), (S = r));
                for (let t = 0; t < w.particleCount; t++)
                    ((b[3 * t] = 300 * (Math.random() - 0.5)),
                        (b[3 * t + 1] = 300 * (Math.random() - 0.5)),
                        (b[3 * t + 2] = 300 * (Math.random() - 0.5)));
                console.log("All text messages displayed - exploding particles");
            }
    }
    if (a) {
        const e = a.geometry.attributes.position.array;
        for (let n = 0; n < e.length; n += 3) {
            const o = n / 3;
            if (l[o]) {
                const a = l[o];
                ((e[n + 1] -= a.y),
                    (e[n] += Math.sin(t * a.freq + n) * a.swayX * 0.1),
                    (e[n + 2] += Math.cos(t * a.freq + n) * a.swayZ * 0.1),
                    e[n + 1] < -60 && (e[n + 1] = 100));
            }
        }
        a.geometry.attributes.position.needsUpdate = !0;
    }
    let c = 0;
    (s.forEach((e) => {
        if (!e || !e.geometry) return;
        const n = e.geometry.attributes.position.array;
        for (let e = 0; e < n.length; e += 3) {
            if (d[c]) {
                const o = d[c];
                ((n[e + 1] -= o.y),
                    (n[e] += Math.sin(t * o.freq + e) * o.swayX * 0.1),
                    (n[e + 2] += Math.cos(t * o.freq + e) * o.swayZ * 0.1),
                    n[e + 1] < -60 && (n[e + 1] = 100));
            }
            c++;
        }
        ((e.geometry.attributes.position.needsUpdate = !0), (e.rotation.y += 5e-4));
    }),
        i && (i.rotation.y += 3e-4));
    o && o.render(e, n);
}
function L() {
    n &&
        o &&
        ((n.aspect = window.innerWidth / window.innerHeight),
            n.updateProjectionMatrix(),
            o.setSize(window.innerWidth, window.innerHeight));
}
function W(t) {
    (a && a.material && (a.material.opacity = 0.7 * t),
        r && r.material && (r.material.opacity = 0.6 * t),
        i && i.material && (i.material.opacity = 0.35 * t),
        s.forEach((e) => {
            e && e.material && (e.material.opacity = 0.75 * t);
        }));
}
export { P as initStandaloneEffects };
