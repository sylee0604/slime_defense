import * as THREE from 'three';
import type { Game } from '../game/Game';
import { TARGET_LABEL } from '../game/Game';
import { MAPS, FIELD } from '../game/data/maps';
import { SLIMES } from '../game/data/slimes';
import { TOWERS, canUpgrade, type TowerKind } from '../game/data/towers';
import { buildHuman } from '../game/models';

type Screen = 'menu' | 'pause' | 'won' | 'lost' | null;

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const ICON_COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/><text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="900" fill="rgba(0,0,0,.45)">$</text></svg>';
const ICON_WAVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c3.6 0 7 2.6 7 7.4 0 4.3-2.8 6.6-7 6.6s-7-2.3-7-6.6C5 5.6 8.4 3 12 3zm-2.6 6.2a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zm5.2 0a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zM4 19.5h16v1.7H4z"/></svg>';

export class Ui {
  private readonly portraits = new Map<TowerKind, string>();
  private readonly els: Record<string, HTMLElement> = {};
  private last = { money: -1, lives: -1, wave: -1, active: false, speed: 0, auto: false, sel: -1 };
  private bannerTimer = 0;
  private toastTimer = 0;

  constructor(private readonly game: Game) {
    this.renderPortraits();
    this.build();
    this.showScreen('menu');
  }

  private renderPortraits(): void {
    const size = 128;
    const canvas = document.createElement('canvas');
    let r: THREE.WebGLRenderer | null = null;
    try {
      r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      return;
    }
    r.setSize(size, size, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x554433, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 2.2);
    d.position.set(2, 4, 4);
    scene.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 1.45, 3.4);
    cam.lookAt(0, 1.05, 0);
    TOWERS.forEach((def, i) => {
      const m = buildHuman(def, i + 1);
      m.root.rotation.y = -0.45;
      m.armR.rotation.x = def.kind === 'sniper' ? -1.45 : -0.5;
      scene.add(m.root);
      r!.render(scene, cam);
      this.portraits.set(def.kind, canvas.toDataURL());
      scene.remove(m.root);
    });
    r.dispose();
    r.forceContextLoss();
  }

  private build(): void {
    const g = this.game;
    const stage = $('#stage');
    const side = $('#sidebar');

    // 상단 상태바
    const top = h('div', 'topbar');
    top.innerHTML = `
      <div class="stat lives" title="생명"><span class="ico">${ICON_HEART}</span><b id="lives">0</b></div>
      <div class="stat money" title="돈"><span class="ico">${ICON_COIN}</span><b id="money">0</b></div>
      <div class="stat wave" title="웨이브"><span class="ico">${ICON_WAVE}</span><b><span id="wave">0</span><small>/<span id="wave-total">30</span></small></b></div>
      <button class="icon-btn" id="btn-pause" aria-label="일시정지" title="일시정지 (Esc)"><svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg></button>`;
    stage.append(top);
    stage.append(h('div', 'banner', ''), h('div', 'toast', ''), h('div', 'floaters', ''), h('div', 'rotate-hint', '가로 화면으로 돌리면 더 넓게 보여요'));

    // 사이드바
    side.innerHTML = `
      <div class="brand"><span class="logo-dot"></span>슬라임 러시 <em>디펜스</em></div>
      <div class="shop" id="shop"></div>
      <div class="info" id="info"></div>
      <div class="controls">
        <button class="btn primary big" id="btn-start"><span id="start-label">웨이브 시작</span><small>Space</small></button>
        <div class="row">
          <button class="btn" id="btn-speed" title="게임 속도 (F)">▶ 1x</button>
          <button class="btn toggle" id="btn-auto" title="웨이브 자동 시작">자동 진행</button>
        </div>
      </div>`;

    const shop = $('#shop');
    for (const def of TOWERS) {
      const b = h('button', 'shop-item') as HTMLButtonElement;
      b.dataset.kind = def.kind;
      b.title = `${def.name} — ${def.role} (단축키 ${def.hotkey})`;
      const img = this.portraits.get(def.kind);
      b.innerHTML = `
        <span class="portrait" style="--c:#${def.color.toString(16).padStart(6, '0')}">${img ? `<img src="${img}" alt="">` : ''}</span>
        <span class="name">${def.name}</span>
        <span class="cost">$${def.cost}</span>
        <span class="key">${def.hotkey}</span>`;
      b.addEventListener('click', () => {
        g.sfx('click');
        if (g.placing === def.kind) g.cancelPlacing();
        else g.beginPlacing(def.kind);
      });
      shop.append(b);
    }

    $('#btn-start').addEventListener('click', () => { g.audio.unlock(); g.startWave(); });
    $('#btn-speed').addEventListener('click', () => { g.sfx('click'); g.cycleSpeed(); });
    $('#btn-auto').addEventListener('click', () => {
      g.autoStart = !g.autoStart;
      g.sfx('click');
      if (g.autoStart && !g.waveActive) g.startWave();
      this.refreshAll();
    });
    $('#btn-pause').addEventListener('click', () => g.setPaused(true));

    this.els.lives = $('#lives');
    this.els.money = $('#money');
    this.els.wave = $('#wave');
    this.els.info = $('#info');
    this.els.banner = $('.banner');
    this.els.toast = $('.toast');
    this.els.floaters = $('.floaters');

    this.buildScreens();
  }

  private buildScreens(): void {
    const g = this.game;
    const app = $('#app');

    // 메인 메뉴
    const menu = h('div', 'screen menu-screen');
    menu.id = 'screen-menu';
    const cards = MAPS.map((m, i) => {
      const lines = m.paths.map((pp) => pp.map(([x, z]) => `${x},${z}`).join(' '));
      const ponds = m.ponds.map((p) => `<circle cx="${p.x}" cy="${p.z}" r="${p.r}" class="pond"/>`).join('');
      return `
        <button class="map-card theme-${m.theme}" data-map="${i}">
          <svg viewBox="${FIELD.minX - 1} ${FIELD.minZ - 1} ${FIELD.maxX - FIELD.minX + 2} ${FIELD.maxZ - FIELD.minZ + 2}" class="map-thumb" aria-hidden="true">
            <rect x="${FIELD.minX}" y="${FIELD.minZ}" width="${FIELD.maxX - FIELD.minX}" height="${FIELD.maxZ - FIELD.minZ}" rx="1.5" class="ground"/>
            ${ponds}
            ${lines.map((pts) => `<polyline points="${pts}" class="road-edge"/>`).join('')}${lines.map((pts) => `<polyline points="${pts}" class="road"/>`).join('')}
          </svg>
          <span class="map-title">${m.name}<span class="diff d${m.tier}">${m.difficulty}</span></span>
          <span class="map-desc">${m.desc}</span>
          <span class="map-meta"><span>♥ ${m.lives}</span><span class="waves">${m.waves}웨이브</span>${m.paths.length > 1 ? '<span class="tag">두 갈래</span>' : ''}${m.hpMul > 1 ? `<span class="tag">체력 ×${m.hpMul}</span>` : ''}${m.speedMul > 1 ? `<span class="tag">속도 ×${m.speedMul}</span>` : ''}${m.crowd > 1 ? `<span class="tag">물량 ×${m.crowd}</span>` : ''}<span class="best" data-best="${m.id}"></span></span>
        </button>`;
    }).join('');
    menu.innerHTML = `
      <div class="menu-inner">
        <div class="title-block">
          <div class="title-slimes"><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>
          <h1>슬라임 러시 <span>디펜스</span></h1>
          <p>마을로 몰려오는 슬라임을 막아라! 사람 영웅 8명을 배치하고 업그레이드해서 마지막 웨이브까지 버티세요. 맵 8개, 쉬움부터 지옥까지.</p>
        </div>
        <div class="map-grid">${cards}</div>
        <details class="bestiary"><summary>슬라임 도감 (${Object.keys(SLIMES).length}종)</summary><div class="bestiary-grid">${Object.values(SLIMES).map((d) => `
          <div class="beast${d.boss ? ' boss' : ''}"><i style="--c:#${d.color.toString(16).padStart(6, '0')};--c2:#${(d.color2 ?? d.color).toString(16).padStart(6, '0')}"></i><b>${d.name}</b><span>${d.desc}${d.hp > 1 ? ` · 체력 ${d.hp}` : ''}</span></div>`).join('')}</div></details>
        <div class="help">
          <span><kbd>1</kbd>~<kbd>8</kbd> 유닛 선택</span><span><kbd>클릭</kbd> 배치·선택</span><span><kbd>Shift</kbd>+클릭 연속 배치</span>
          <span><kbd>Z</kbd>/<kbd>X</kbd> 업그레이드</span><span><kbd>Tab</kbd> 공격 대상</span><span><kbd>Space</kbd> 웨이브 시작</span><span><kbd>F</kbd> 배속</span>
        </div>
      </div>`;
    menu.querySelectorAll<HTMLButtonElement>('.map-card').forEach((b) =>
      b.addEventListener('click', () => g.startMap(Number(b.dataset.map))),
    );
    app.append(menu);

    // 일시정지
    const pause = h('div', 'screen modal-screen');
    pause.id = 'screen-pause';
    pause.innerHTML = `
      <div class="modal">
        <h2>일시정지</h2>
        <button class="btn primary big" data-act="resume">계속하기</button>
        <button class="btn big" data-act="restart">처음부터 다시</button>
        <button class="btn big" data-act="sound">효과음: 켜짐</button>
        <button class="btn big ghost" data-act="menu">맵 선택으로</button>
      </div>`;
    app.append(pause);

    // 결과
    const end = h('div', 'screen modal-screen');
    end.id = 'screen-end';
    end.innerHTML = `
      <div class="modal end">
        <div class="end-emblem"></div>
        <h2 id="end-title"></h2>
        <p id="end-sub"></p>
        <div class="end-stats" id="end-stats"></div>
        <button class="btn primary big" data-act="restart">다시 도전</button>
        <button class="btn big ghost" data-act="menu">맵 선택으로</button>
      </div>`;
    app.append(end);

    for (const root of [pause, end]) {
      root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
        b.addEventListener('click', () => {
          g.sfx('click');
          const act = b.dataset.act;
          if (act === 'resume') g.setPaused(false);
          else if (act === 'restart') g.restart();
          else if (act === 'menu') g.toMenu();
          else if (act === 'sound') {
            g.audio.setMuted(!g.audio.muted);
            b.textContent = `효과음: ${g.audio.muted ? '꺼짐' : '켜짐'}`;
          }
        }),
      );
    }
  }

  showScreen(s: Screen): void {
    const app = $('#app');
    app.dataset.screen = s ?? 'game';
    $('#screen-menu').classList.toggle('open', s === 'menu');
    $('#screen-pause').classList.toggle('open', s === 'pause');
    $('#screen-end').classList.toggle('open', s === 'won' || s === 'lost');
    if (s === 'menu') {
      document.querySelectorAll<HTMLElement>('[data-best]').forEach((el) => {
        const b = this.game.bestFor(el.dataset.best!);
        el.textContent = b.cleared ? '★ 클리어' : b.wave > 0 ? `최고 ${b.wave}웨이브` : '';
      });
    }
    if (s === 'won' || s === 'lost') {
      const g = this.game;
      const end = $('#screen-end');
      end.dataset.result = s;
      $('#end-title').textContent = s === 'won' ? '마을을 지켜냈어요!' : '마을이 함락됐어요';
      $('#end-sub').textContent = s === 'won' ? `${g.map.name} 클리어! 마지막 보스까지 물리쳤습니다.` : `${g.map.name}에서 웨이브 ${g.wave}까지 버텼어요.`;
      $('#end-stats').innerHTML = `
        <div><b>${g.wave}</b><span>웨이브</span></div>
        <div><b>${g.totalPops.toLocaleString()}</b><span>터뜨린 슬라임</span></div>
        <div><b>${g.towers.length}</b><span>배치한 유닛</span></div>`;
    }
  }

  banner(text: string, boss: boolean): void {
    const b = this.els.banner;
    b.textContent = text;
    b.classList.toggle('boss', boss);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove('show'), text.length > 30 ? 3600 : 1800);
  }

  toast(text: string): void {
    const t = this.els.toast;
    t.textContent = text;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 1100);
  }

  flashLives(): void {
    const el = this.els.lives.parentElement!;
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }

  floatText(text: string, x: number, y: number, z: number, color: string): void {
    const p = this.game.worldToScreen(x, y, z);
    const stage = $('#stage').getBoundingClientRect();
    const el = h('div', 'floater', text);
    el.style.left = `${p.x - stage.left}px`;
    el.style.top = `${p.y - stage.top}px`;
    el.style.color = color;
    this.els.floaters.append(el);
    window.setTimeout(() => el.remove(), 1200);
  }

  /** 매 프레임: 바뀐 값만 반영 */
  tick(): void {
    const g = this.game;
    const L = this.last;
    if (g.money !== L.money) {
      L.money = g.money;
      this.els.money.textContent = g.money.toLocaleString();
      this.updateAffordability();
    }
    if (g.lives !== L.lives) {
      L.lives = g.lives;
      this.els.lives.textContent = String(Math.max(0, g.lives));
      this.els.lives.parentElement!.classList.toggle('low', g.lives <= 20);
    }
    if (g.wave !== L.wave || g.waveActive !== L.active || g.speed !== L.speed || g.autoStart !== L.auto) {
      L.wave = g.wave;
      L.active = g.waveActive;
      L.speed = g.speed;
      L.auto = g.autoStart;
      this.els.wave.textContent = String(g.wave);
      $('#wave-total').textContent = String(g.map.waves);
      const start = $<HTMLButtonElement>('#btn-start');
      start.disabled = g.waveActive || g.wave >= g.map.waves || g.state !== 'playing';
      $('#start-label').textContent = g.waveActive ? `웨이브 ${g.wave} 진행 중` : `웨이브 ${g.wave + 1} 시작`;
      $('#btn-speed').textContent = `${'▶'.repeat(g.speed)} ${g.speed}x`;
      $('#btn-speed').classList.toggle('on', g.speed > 1);
      $('#btn-auto').classList.toggle('on', g.autoStart);
    }
    if (g.selected && this.els.pops) {
      this.els.pops.textContent = g.selected.pops.toLocaleString();
    }
  }

  private updateAffordability(): void {
    const g = this.game;
    document.querySelectorAll<HTMLButtonElement>('.shop-item').forEach((b) => {
      const def = TOWERS.find((t) => t.kind === b.dataset.kind)!;
      b.classList.toggle('poor', g.money < def.cost);
      b.classList.toggle('active', g.placing === def.kind);
    });
    document.querySelectorAll<HTMLButtonElement>('.up-btn').forEach((b) => {
      const cost = Number(b.dataset.cost);
      b.classList.toggle('poor', g.money < cost);
    });
  }

  refreshAll(): void {
    this.last.money = -1;
    this.last.wave = -1;
    this.renderInfo();
    this.tick();
  }

  private renderInfo(): void {
    const g = this.game;
    const info = this.els.info;
    if (!info) return;
    const t = g.selected;
    this.els.pops = undefined as unknown as HTMLElement;
    if (!t) {
      if (g.placing) {
        const def = TOWERS.find((d) => d.kind === g.placing)!;
        info.innerHTML = `
          <div class="info-card hint">
            <b>${def.name}</b><p>${def.role}</p>
            <p class="muted">길과 장애물을 피해 클릭해서 배치하세요. <kbd>Shift</kbd>를 누르면 연속 배치, 우클릭·<kbd>Esc</kbd>로 취소.</p>
          </div>`;
      } else {
        info.innerHTML = `
          <div class="info-card hint">
            <p class="muted">위에서 유닛을 골라 맵에 배치하세요. 배치한 유닛을 클릭하면 업그레이드할 수 있어요.</p>
            <p class="muted small">그림자는 폭발, 서리·번개는 냉기, 보라는 마법·화염, 강철은 날붙이에 면역! 갑옷 슬라임은 피해 1짜리 공격을 막으니 '갑옷 무시' 업그레이드를 준비하세요.</p>
          </div>`;
      }
      return;
    }
    const img = this.portraits.get(t.def.kind);
    const col = (p: 0 | 1) => {
      const lvl = t.levels[p];
      const next = t.def.paths[p][lvl];
      const pips = [0, 1, 2].map((i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      const done = t.def.paths[p].slice(0, lvl).map((u) => u.name).join(' · ');
      if (!next) {
        return `<div class="up-col p${p}"><div class="pips">${pips}</div><div class="up-btn maxed"><b>최대 업그레이드</b><span>${done}</span></div></div>`;
      }
      const ok = canUpgrade(t.levels, p);
      if (!ok) {
        return `<div class="up-col p${p}"><div class="pips">${pips}</div><div class="up-btn locked"><b>잠김</b><span>다른 경로가 3단계예요</span></div></div>`;
      }
      return `<div class="up-col p${p}"><div class="pips">${pips}</div>
        <button class="up-btn" data-path="${p}" data-cost="${next.cost}"><b>${next.name}</b><span>${next.desc}</span><em>$${next.cost}</em><kbd>${p === 0 ? 'Z' : 'X'}</kbd></button></div>`;
    };
    const st = t.stats;
    const statLine = t.def.kind === 'merchant'
      ? `웨이브당 <b>$${st.income}</b>${st.livesPerWave ? ` · 생명 <b>+${st.livesPerWave}</b>` : ''}`
      : `사거리 <b>${st.range > 50 ? '무한' : st.range.toFixed(1)}</b> · 피해 <b>${st.damage || '-'}</b> · 관통 <b>${st.pierce}</b>`;
    info.innerHTML = `
      <div class="info-card sel">
        <div class="sel-head">
          <span class="portrait sm" style="--c:#${t.def.color.toString(16).padStart(6, '0')}">${img ? `<img src="${img}" alt="">` : ''}</span>
          <div><b>${t.def.name}</b><div class="muted small">처치 <span id="sel-pops">${t.pops}</span></div></div>
          <button class="icon-btn close" aria-label="선택 해제">✕</button>
        </div>
        <div class="statline">${statLine}</div>
        ${t.def.kind !== 'merchant' ? `<button class="btn target" title="공격 대상 (Tab)">대상: <b>${TARGET_LABEL[t.target]}</b></button>` : ''}
        <div class="ups">${col(0)}${col(1)}</div>
        <button class="btn sell">판매 <b>$${g.sellValue(t)}</b></button>
      </div>`;
    this.els.pops = $('#sel-pops', info);
    info.querySelectorAll<HTMLButtonElement>('.up-btn[data-path]').forEach((b) =>
      b.addEventListener('click', () => {
        if (!g.upgrade(t, Number(b.dataset.path) as 0 | 1)) this.toast('돈이 부족해요');
      }),
    );
    $('.close', info)?.addEventListener('click', () => g.select(null));
    $('.target', info)?.addEventListener('click', () => g.cycleTarget(t));
    $('.sell', info)?.addEventListener('click', () => g.sell(t));
  }
}
