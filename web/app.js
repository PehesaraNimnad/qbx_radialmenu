'use strict';

/* qbx_radialmenu NUI: draws the ring, handles hover / click / keys and reports back to client/radial.lua */

const IS_BROWSER = typeof GetParentResourceName !== 'function';
const RESOURCE = IS_BROWSER ? 'qbx_radialmenu' : GetParentResourceName();
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CX = 300;
const R_OUT = 252;
const R_IN = 104;
const R_ICON = 178;
const GAP = 1.6; // degrees between slices

const opts = { perPage: 8, scale: 1, sounds: true, accent: '#f4f4f5', hints: true, hold: false, key: 'Z' };
const state = { open: false, items: [], sub: false, title: '', page: 0, hover: -1, slots: [] };

function post(name, data = {}) {
    if (IS_BROWSER) return Promise.resolve(Demo.nui(name, data));
    return fetch(`https://${RESOURCE}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data),
    }).then((r) => r.json()).catch(() => null);
}

/* ---------- sound ---------- */
let audio;
function tick(freq = 1800, len = 0.025, vol = 0.12) {
    if (!opts.sounds) return;
    try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended') audio.resume();
        const t = audio.currentTime;
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + len);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + len + 0.02);
    } catch { /* no audio */ }
}

/* ---------- icons ---------- */
const FA_PREFIX = { fas: 'fa-solid', far: 'fa-regular', fab: 'fa-brands', fal: 'fa-solid', fat: 'fa-solid', fad: 'fa-solid' };

function iconHtml(icon) {
    if (Array.isArray(icon)) return `<i class="${FA_PREFIX[icon[0]] || 'fa-solid'} fa-${esc(icon[1])}"></i>`;
    const s = String(icon || 'circle');
    if (/^(https?:|nui:|data:image)/.test(s) || /\.(png|jpe?g|webp|svg|gif)$/i.test(s)) return `<img src="${esc(s)}" alt="">`;
    if (s.includes('fa-')) return `<i class="${esc(s.includes(' ') ? s : `fa-solid ${s}`)}"></i>`;
    return `<i class="fa-solid fa-${esc(s)}"></i>`;
}

/* ---------- geometry ---------- */
const rad = (d) => (d * Math.PI) / 180;
const pt = (r, a) => [CX + r * Math.cos(rad(a)), CX + r * Math.sin(rad(a))];

function slicePath(a0, a1, rOut = R_OUT, rIn = R_IN) {
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = pt(rOut, a0);
    const [x1, y1] = pt(rOut, a1);
    const [x2, y2] = pt(rIn, a1);
    const [x3, y3] = pt(rIn, a0);
    return `M${x0} ${y0} A${rOut} ${rOut} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${rIn} ${rIn} 0 ${large} 0 ${x3} ${y3} Z`;
}

function arc(r, a0, a1) {
    const [x0, y0] = pt(r, a0);
    const [x1, y1] = pt(r, a1);
    return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/* ---------- pages: more items than fit become pages with a "More" slot ---------- */
function buildSlots() {
    const n = state.items.length;
    const per = opts.perPage;
    if (n <= per) return state.items.map((it, i) => ({ item: it, index: i }));
    const size = per - 1;
    const pages = Math.ceil(n / size);
    state.page = ((state.page % pages) + pages) % pages;
    const start = state.page * size;
    const slots = state.items.slice(start, start + size).map((it, i) => ({ item: it, index: start + i }));
    slots.push({ more: true, pages });
    return slots;
}

function render() {
    const slots = (state.slots = buildSlots());
    const n = slots.length;
    const step = 360 / n;
    const segs = [];
    const lbls = [];
    slots.forEach((slot, i) => {
        const mid = -90 + i * step;
        const a0 = mid - step / 2 + GAP / 2;
        const a1 = mid + step / 2 - GAP / 2;
        const isSub = slot.item && slot.item.menu;
        const delay = `${i * 22}ms`;
        segs.push(`<g class="seg ${slot.more ? 'more' : ''}" data-slot="${i}" style="animation-delay:${delay}">
            <path class="body" d="${slicePath(a0, a1)}"/>
            <path class="shine" d="${arc(R_OUT - 6, a0 + 2, a1 - 2)}"/>
            ${isSub ? `<path class="sub-mark" d="${arc(R_OUT - 14, mid - 7, mid + 7)}"/>` : ''}
        </g>`);
        const [x, y] = pt(R_ICON, mid);
        const label = slot.more ? `More ${state.page + 1}/${slot.pages}` : String(slot.item.label ?? '').split('\n').map(esc).join('<br>');
        const icon = slot.more ? '<i class="fa-solid fa-ellipsis"></i>' : iconHtml(slot.item.icon);
        lbls.push(`<div class="lbl ${slot.more ? 'more' : ''}" data-slot="${i}" style="left:${(x / 600) * 100}%;top:${(y / 600) * 100}%;animation-delay:${delay}">
            <span class="ic">${icon}</span><b>${label}</b></div>`);
    });
    $('#segments').innerHTML = segs.join('');
    $('#labels').innerHTML = lbls.join('');

    const pages = slots.length && slots[slots.length - 1].more ? slots[slots.length - 1].pages : 0;
    $('#pages').innerHTML = pages ? Array.from({ length: pages }, (_, i) => `<i class="${i === state.page ? 'on' : ''}"></i>`).join('') : '';
    setHover(state.hover < n ? state.hover : -1, true);
}

function setCenter() {
    const slot = state.slots[state.hover];
    const centerHover = state.hover === -2;
    $('#radial').classList.toggle('center-hover', centerHover);
    let title = state.title || 'Menu';
    let sub = state.sub ? 'Back' : 'Close';
    let icon = state.sub ? 'fa-arrow-left' : 'fa-xmark';
    if (slot) {
        title = slot.more ? 'More options' : String(slot.item.label ?? '').replace(/\n/g, ' ');
        sub = slot.more ? `Page ${state.page + 1} of ${slot.pages}` : slot.item.menu ? 'Open' : 'Select';
        icon = slot.more ? 'fa-ellipsis' : slot.item.menu ? 'fa-chevron-right' : 'fa-check';
    }
    $('.c-title').textContent = title;
    $('.c-sub').textContent = sub;
    $('.c-icon').innerHTML = `<i class="fa-solid ${icon}"></i>`;
}

function setHover(i, silent = false) {
    if (i === state.hover && !silent) return;
    const changed = i !== state.hover;
    state.hover = i;
    document.querySelectorAll('.seg, .lbl').forEach((el) => el.classList.toggle('hover', Number(el.dataset.slot) === i));
    setCenter();
    if (changed && !silent && i >= 0) tick(1900, 0.02, 0.08);
}

/* ---------- open / close ---------- */
function open(data) {
    state.items = Array.isArray(data.items) ? data.items : [];
    state.sub = !!data.sub;
    state.title = data.title || (data.sub ? 'Back' : 'Menu');
    state.page = 0;
    state.hover = -1;
    if (data.option) {
        const idx = state.items.findIndex((it) => it.menu === data.option);
        if (idx >= 0) {
            const size = state.items.length > opts.perPage ? opts.perPage - 1 : opts.perPage;
            state.page = Math.floor(idx / size);
            state.hover = idx - state.page * size;
        }
    }
    state.open = true;
    document.body.classList.add('open');
    const r = $('#radial');
    r.hidden = false;
    render();
    requestAnimationFrame(() => r.classList.add('in'));
    $('#hints').hidden = !opts.hints;
}

function hide() {
    state.open = false;
    document.body.classList.remove('open');
    const r = $('#radial');
    r.classList.remove('in');
    setTimeout(() => { if (!state.open) r.hidden = true; }, 160);
}

/* ---------- actions ---------- */
function choose(i) {
    const slot = state.slots[i];
    if (!slot) return;
    if (slot.more) {
        state.page += 1;
        state.hover = state.slots.length - 1;
        tick(1400, 0.04, 0.12);
        return render();
    }
    tick(1200, 0.05, 0.14);
    post('select', { index: slot.index });
}

function back() {
    tick(900, 0.04, 0.1);
    if (state.sub) return post('back');
    post('close');
}

function hoverFromPointer(e) {
    const rect = $('#radial').getBoundingClientRect();
    const scale = rect.width / 600;
    const dx = (e.clientX - (rect.left + rect.width / 2)) / scale;
    const dy = (e.clientY - (rect.top + rect.height / 2)) / scale;
    const dist = Math.hypot(dx, dy);
    if (dist < R_IN * 0.92) return -2; // centre = back / close
    if (dist < 40) return -1;
    const n = state.slots.length;
    const step = 360 / n;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90 + step / 2;
    ang = ((ang % 360) + 360) % 360;
    return Math.floor(ang / step) % n;
}

document.addEventListener('mousemove', (e) => { if (state.open) setHover(hoverFromPointer(e)); });

document.addEventListener('mousedown', (e) => {
    if (!state.open) return;
    if (e.button === 2) return back();
    if (e.button !== 0) return;
    const h = hoverFromPointer(e);
    if (h === -2) return back();
    if (h >= 0) choose(h);
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('wheel', (e) => {
    if (!state.open || !state.slots.length) return;
    const n = state.slots.length;
    const cur = state.hover < 0 ? 0 : state.hover;
    setHover((cur + (e.deltaY > 0 ? 1 : -1) + n) % n);
}, { passive: true });

document.addEventListener('keydown', (e) => {
    if (!state.open) return;
    if (e.key === 'Escape') return post('close');
    if (e.key === 'Backspace') return back();
    if (e.key === 'Enter' && state.hover >= 0) return choose(state.hover);
    const num = Number(e.key);
    if (num >= 1 && num <= state.slots.length) choose(num - 1);
});

window.addEventListener('message', ({ data: msg }) => {
    if (!msg || !msg.action) return;
    if (msg.action === 'radial') return msg.data ? open(msg.data) : hide();
    // hold-to-open: key released → pick what is under the cursor
    if (msg.action === 'release' && state.open) {
        if (state.hover >= 0) choose(state.hover);
        else post('close');
    }
});

function applyOptions(o) {
    Object.assign(opts, o || {});
    const root = document.documentElement.style;
    root.setProperty('--scale', opts.scale);
    root.setProperty('--accent', opts.accent);
    $('#hints').innerHTML = opts.hold
        ? `<span>Release <kbd>${esc(opts.key)}</kbd> to pick</span><span><kbd>Right click</kbd> back</span><span><kbd>Esc</kbd> close</span>`
        : `<span><kbd>Click</kbd> select</span><span><kbd>1</kbd>–<kbd>${opts.perPage}</kbd> quick pick</span><span><kbd>Right click</kbd> back</span><span><kbd>Esc</kbd> close</span>`;
}

/* ---------- browser preview: open web/index.html ---------- */
const Demo = {
    menus: {
        root: [
            { label: 'Citizen', icon: 'user', menu: 'citizen' },
            { label: 'Vehicle', icon: 'car', menu: 'vehicle' },
            { label: 'Clothing', icon: 'shirt', menu: 'clothing' },
            { label: 'Emotes', icon: 'masks-theater', menu: 'emotes' },
            { label: 'Job\nInteractions', icon: 'briefcase', menu: 'job' },
            { label: 'Gang', icon: 'skull-crossbones', menu: 'gang' },
            { label: 'Walk style', icon: 'person-walking' },
            { label: 'Invoices', icon: 'receipt' },
            { label: 'Hotdog stand', icon: 'hotdog' },
            { label: 'GPS', icon: 'location-dot' },
        ],
        vehicle: [
            { label: 'Flip vehicle', icon: 'car-burst' },
            { label: 'Doors', icon: 'car-side', menu: 'doors' },
            { label: 'Windows', icon: 'window-maximize', menu: 'windows' },
            { label: 'Extras', icon: 'plus', menu: 'extras' },
            { label: 'Seats', icon: 'chair', menu: 'seats' },
        ],
    },
    nui(name, data) {
        if (name === 'select') {
            const item = state.items[data.index];
            if (item && item.menu && this.menus[item.menu]) setTimeout(() => open({ items: this.menus[item.menu], sub: true, title: item.label.replace('\n', ' ') }), 120);
        }
        if (name === 'back') setTimeout(() => open({ items: this.menus.root, option: 'vehicle' }), 120);
        return true;
    },
};

if (IS_BROWSER) {
    document.body.style.background = "#222 url('https://i.imgur.com/3pzRj9n.png') center / cover no-repeat";
    const q = new URLSearchParams(location.search);
    applyOptions({ perPage: Number(q.get('per')) || 8, hold: q.has('hold') });
    const sub = q.get('menu');
    open(sub && Demo.menus[sub] ? { items: Demo.menus[sub], sub: true, title: 'Vehicle' } : { items: Demo.menus.root });
    const hov = Number(q.get('hover'));
    if (!Number.isNaN(hov) && q.has('hover')) setTimeout(() => setHover(hov, true), 600);
} else {
    applyOptions();
    (function ready() {
        post('ready').then((res) => { if (res) applyOptions(res); else setTimeout(ready, 1000); });
    })();
}
