// SOLAR BAY renderer: canvas top-down city, cars, people, HUD, minimap, screens.
// Day/night lighting, building shadows, headlights and muzzle flashes are all drawn.
import { BLOCK, CITY, MISSIONS, ROAD, STORY_INTRO } from './config.js';
import { CITY_EDGE, GRID, PITCH, roadCenter } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';

const MINIMAP = 176;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car, night) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 6);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRect(ctx, -8, -car.width / 2 + 3, 16, car.width - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(car.length / 2 - 9, -car.width / 2 + 4, 3, car.width - 8);
  // Headlights at night.
  if (night) {
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.length / 2 - 2, -car.width / 2 + 2, 4, 4);
    ctx.fillRect(car.length / 2 - 2, car.width / 2 - 6, 4, 4);
    const grad = ctx.createRadialGradient(car.length / 2, 0, 4, car.length / 2, 0, 120);
    grad.addColorStop(0, 'rgba(255,233,168,0.20)');
    grad.addColorStop(1, 'rgba(255,233,168,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(car.length / 2, -10);
    ctx.lineTo(car.length / 2 + 120, -34);
    ctx.lineTo(car.length / 2 + 120, 34);
    ctx.lineTo(car.length / 2, 10);
    ctx.closePath();
    ctx.fill();
  }
  // Police light bar (red/blue) — the siren colour reads at a glance.
  if (car.kind === 'police') {
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-6, -car.width / 2 + 2, 8, 5);
    ctx.fillStyle = '#2f7bff';
    ctx.fillRect(-6, car.width / 2 - 7, 8, 5);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, night) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick.
  ctx.fillStyle = '#20242e';
  ctx.fillRect(6, -3, 7, 6);
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 0;
  let viewH = 0;
  let camX = 0;
  let camY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawWorld(state, night) {
    const p = state.player;
    camX = Math.max(viewW / 2 - 40, Math.min(CITY_EDGE - viewW / 2 + 40, p.x));
    camY = Math.max(viewH / 2 - 40, Math.min(CITY_EDGE - viewH / 2 + 40, p.y));
    const x0 = camX - viewW / 2;
    const y0 = camY - viewH / 2;
    const city = state.city;

    // Ground: sun-baked grass with a sandy marina strip at the south edge.
    ctx.fillStyle = night ? '#2a3324' : '#7fae62';
    ctx.fillRect(0, 0, viewW, viewH);
    const beachY = roadCenter(GRID) + ROAD;
    ctx.fillStyle = night ? '#6b5f45' : '#e8d39a';
    ctx.fillRect(0, beachY - y0, viewW, viewH - (beachY - y0));

    // Parks and lots.
    for (const park of city.parks) {
      const sx = park.x - x0;
      const sy = park.y - y0;
      if (sx > viewW || sy > viewH || sx + park.w < 0 || sy + park.h < 0) continue;
      ctx.fillStyle = park.kind === 'beach' ? (night ? '#6b5f45' : '#e8d39a') : park.kind === 'park' ? (night ? '#3d5230' : '#5f9e4e') : (night ? '#4a4a4d' : '#9a9aa0');
      ctx.fillRect(sx, sy, park.w, park.h);
    }

    // Roads: asphalt bands with dashed centre lines.
    ctx.fillStyle = night ? '#33363d' : '#4a4d55';
    for (let i = 0; i <= GRID; i += 1) {
      const c = roadCenter(i);
      ctx.fillRect(0, c - ROAD / 2 - y0, viewW, ROAD);
      ctx.fillRect(c - ROAD / 2 - x0, 0, ROAD, viewH);
    }
    ctx.strokeStyle = night ? '#8a7f4a' : '#e8d24a';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (let i = 0; i <= GRID; i += 1) {
      const c = roadCenter(i);
      ctx.moveTo(0, c - y0);
      ctx.lineTo(viewW, c - y0);
      ctx.moveTo(c - x0, 0);
      ctx.lineTo(c - x0, viewH);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Trees and lamps.
    for (const t of city.trees) {
      const sx = t.x - x0;
      const sy = t.y - y0;
      if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(sx + 3, sy + 4, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = night ? '#2f4a26' : '#3f7a34';
      ctx.beginPath();
      ctx.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = night ? '#3d5c30' : '#57a047';
      ctx.beginPath();
      ctx.arc(sx - 3, sy - 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#20242e';
    for (const l of city.lamps) {
      const sx = l.x - x0;
      const sy = l.y - y0;
      if (sx < -10 || sx > viewW + 10 || sy < -10 || sy > viewH + 10) continue;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
      if (night) {
        ctx.fillStyle = 'rgba(255,220,130,0.9)';
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#20242e';
      }
    }

    // Buildings: wall face + roof + lit windows at night.
    for (const b of city.buildings) {
      const sx = b.x - x0;
      const sy = b.y - y0;
      if (sx > viewW || sy > viewH || sx + b.w < 0 || sy + b.h < 0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(sx + 6, sy + 8, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(sx, sy + b.height * 0.4, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(sx, sy, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, b.w - 2, b.h - 2);
      // Windows.
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const wx = sx + 10 + c * ((b.w - 20) / cols);
          const wy = sy + 10 + r * ((b.h - 20) / rows);
          ctx.fillStyle = night ? ((r * cols + c) % 3 === 0 ? '#ffd97a' : '#2c3a55') : '#2c3a55';
          ctx.fillRect(wx, wy, 10, 12);
        }
      }
    }

    // Landmark labels and markers.
    const mission = state.missionTarget;
    const drawMarker = (x, y, label, color) => {
      const sx = x - x0;
      const sy = y - y0;
      if (sx < -60 || sx > viewW + 60 || sy < -60 || sy > viewH + 60) return;
      const bob = Math.sin(state.time * 3) * 5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 46 + bob);
      ctx.lineTo(sx + 10, sy - 26 + bob);
      ctx.lineTo(sx - 10, sy - 26 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, sx, sy - 52 + bob);
      ctx.fillText(label, sx, sy - 52 + bob);
    };
    drawMarker(city.garage.x, city.garage.y, 'MARA\u2019S GARAGE', '#f2c230');
    drawMarker(city.depot.x, city.depot.y, 'OLD DEPOT', '#e07a2e');
    drawMarker(city.pier.x, city.pier.y, 'SOLAR PIER', '#4fc3d9');
    drawMarker(city.hospital.x, city.hospital.y, 'BAY CLINIC', '#e05a6a');
    if (mission) drawMarker(mission.x, mission.y, mission.name.toUpperCase(), '#ffd94a');

    // Pickups.
    for (const pk of state.pickups) {
      const sx = pk.x - x0;
      const sy = pk.y - y0;
      ctx.fillStyle = pk.kind === 'cash' ? '#2fbf5a' : '#ff5a6a';
      ctx.beginPath();
      ctx.arc(sx, sy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'cash' ? '$' : '+', sx, sy + 5);
    }

    // Cars, people, enemies, particles (cars need screen coords, like people).
    for (const car of state.cars) {
      if (car.x < x0 - 80 || car.x > x0 + viewW + 80 || car.y < y0 - 80 || car.y > y0 + viewH + 80) continue;
      drawCar(ctx, { ...car, x: car.x - x0, y: car.y - y0 }, night);
    }
    for (const car of state.police) drawCar(ctx, { ...car, x: car.x - x0, y: car.y - y0 }, night);
    for (const ped of state.peds) {
      if (ped.x < x0 - 30 || ped.x > x0 + viewW + 30 || ped.y < y0 - 30 || ped.y > y0 + viewH + 30) continue;
      drawPerson(ctx, ped.x - x0, ped.y - y0, ped.angle, ped.shirt, night);
    }
    for (const cop of state.cops) drawPerson(ctx, cop.x - x0, cop.y - y0, cop.angle, cop.shirt, night);
    for (const e of state.enemies) {
      drawPerson(ctx, e.x - x0, e.y - y0, e.angle, e.shirt, night);
      // Health bar.
      ctx.fillStyle = '#20242e';
      ctx.fillRect(e.x - x0 - 14, e.y - y0 - 20, 28, 5);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(e.x - x0 - 14, e.y - y0 - 20, 28 * Math.max(0, e.health / 60), 5);
    }
    // Player (p is already state.player from the top of drawWorld).
    if (!p.inCar) {
      drawPerson(ctx, p.x - x0, p.y - y0, p.angle, '#e8e8e8', night);
      // Player marker ring.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x - x0, p.y - y0, 15, 0, Math.PI * 2);
      ctx.stroke();
      if (p.punchTimer > 0.2) {
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath();
        ctx.arc(p.x - x0 + Math.cos(p.angle) * 26, p.y - y0 + Math.sin(p.angle) * 26, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Aim line from the car.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - x0, p.y - y0);
      ctx.lineTo(p.x - x0 + Math.cos(p.angle) * 40, p.y - y0 + Math.sin(p.angle) * 40);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.beginPath();
      ctx.arc(pt.x - x0, pt.y - y0, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Night overlay.
    if (night) {
      ctx.fillStyle = 'rgba(8,12,34,0.42)';
      ctx.fillRect(0, 0, viewW, viewH);
    }
    return { x0, y0 };
  }

  function drawMinimap(state, x0, y0) {
    const s = MINIMAP / CITY_EDGE;
    const mx = viewW - MINIMAP - 14;
    const my = viewH - MINIMAP - 14;
    ctx.fillStyle = 'rgba(10,14,22,0.82)';
    roundRect(ctx, mx - 6, my - 6, MINIMAP + 12, MINIMAP + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, MINIMAP, MINIMAP);
    ctx.clip();
    ctx.fillStyle = '#2c3a2a';
    ctx.fillRect(mx, my, MINIMAP, MINIMAP);
    ctx.fillStyle = '#5a5e66';
    for (let i = 0; i <= GRID; i += 1) {
      const c = roadCenter(i) * s;
      ctx.fillRect(mx, my + c - (ROAD / 2) * s, MINIMAP, ROAD * s);
      ctx.fillRect(mx + c - (ROAD / 2) * s, my, ROAD * s, MINIMAP);
    }
    ctx.fillStyle = '#7a6a4a';
    for (const b of state.city.buildings) {
      ctx.fillRect(mx + b.x * s, my + b.y * s, Math.max(1, b.w * s), Math.max(1, b.h * s));
    }
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + x * s, my + y * s, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (state.missionTarget) dot(state.missionTarget.x, state.missionTarget.y, '#ffd94a', 5);
    dot(state.city.garage.x, state.city.garage.y, '#f2c230', 3);
    for (const car of state.police) dot(car.x, car.y, '#2f7bff', 3);
    for (const e of state.enemies) dot(e.x, e.y, '#ff3b30', 3);
    const p = state.player;
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(mx + p.x * s, my + p.y * s);
    ctx.rotate(p.angle);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLAR BAY', mx, my - 10);
  }

  function drawHUD(state) {
    const p = state.player;
    // Top-left: cash + health.
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    roundRect(ctx, 12, 12, 220, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#2fbf5a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${state.cash}`, 24, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`BEST $${state.bestCash}`, 24, 58);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(120, 26, 96, 10);
    ctx.fillStyle = p.health > 40 ? '#2fbf5a' : '#ff3b30';
    ctx.fillRect(120, 26, 96 * Math.max(0, p.health / 100), 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('HEALTH', 120, 52);

    // Top-right: wanted stars.
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    roundRect(ctx, viewW - 218, 12, 206, 44, 8);
    ctx.fill();
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? '#ffd94a' : 'rgba(255,255,255,0.25)';
      ctx.fillText('\u2605', viewW - 206 + i * 30, 42);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('WANTED', viewW - 206, 20);

    // Bottom-left: mission objective.
    const m = MISSIONS[state.missionIndex];
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    roundRect(ctx, 12, viewH - 86, 420, 74, 8);
    ctx.fill();
    if (m) {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`JOB: ${m.name}  —  $${m.pay}`, 24, viewH - 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px sans-serif';
      const stage = state.missionStage === 'deliver' ? 'Deliver the crate to Solar Pier' : m.objective;
      ctx.fillText(stage, 24, viewH - 38);
      if (m.id === 'm3' && state.missionStage === 'survive') {
        ctx.fillStyle = '#ff8a7a';
        ctx.fillText(`Survive: ${Math.ceil(state.missionTimer)}s left at 2+ stars`, 24, viewH - 20);
      } else if (state.missionTarget) {
        const d = Math.hypot(p.x - state.missionTarget.x, p.y - state.missionTarget.y);
        ctx.fillStyle = '#c9d4e8';
        ctx.fillText(`${Math.round(d)}m to ${state.missionTarget.name}`, 24, viewH - 20);
      }
    } else {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('FREE ROAM — all jobs done. The Bay is yours, Riko.', 24, viewH - 48);
    }

    // Driving speed.
    if (p.inCar) {
      ctx.fillStyle = 'rgba(10,14,22,0.75)';
      roundRect(ctx, viewW - 150, viewH - 90, 136, 48, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.32)}`, viewW - 40, viewH - 58);
      ctx.font = '11px sans-serif';
      ctx.fillText('km/h', viewW - 24, viewH - 58);
      ctx.textAlign = 'left';
    }

    // Message feed (centre top).
    if (state.messageTimer > 0) {
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(state.message).width + 28;
      ctx.fillStyle = 'rgba(10,14,22,0.8)';
      roundRect(ctx, viewW / 2 - w / 2, 64, w, 32, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(state.message, viewW / 2, 85);
    }

    // Controls hint.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD move/drive  •  E steal/exit car  •  Click shoot  •  Space/F punch  •  Shift run  •  P pause  •  M job brief', viewW / 2, viewH - 8);

    drawMinimap(state);
  }

  function drawTitle(state, best) {
    const night = false;
    drawWorld(state, night);
    ctx.fillStyle = 'rgba(8,10,20,0.62)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLAR BAY', viewW / 2, viewH / 2 - 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    ctx.fillText('an open-world crime story', viewW / 2, viewH / 2 - 112);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#d9e2f2';
    STORY_INTRO.forEach((line, i) => {
      ctx.fillText(line, viewW / 2, viewH / 2 - 66 + i * 24);
    });
    ctx.fillStyle = '#2fbf5a';
    roundRect(ctx, viewW / 2 - 130, viewH / 2 + 66, 260, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('START ENGINE  (Enter)', viewW / 2, viewH / 2 + 99);
    ctx.fillStyle = '#c9d4e8';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move / drive  •  E steal a car  •  Click to shoot  •  Space to punch  •  P pause', viewW / 2, viewH / 2 + 148);
    if (best > 0) {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Saved progress: $${best} best cash — jobs resume where you left off`, viewW / 2, viewH / 2 + 176);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px sans-serif';
    ctx.fillText('A wholly original game. No part of it copies any commercial game.', viewW / 2, viewH - 20);
  }

  function drawPaused(state) {
    drawWorld(state, state.hour >= 19.5 || state.hour < 6);
    ctx.fillStyle = 'rgba(8,10,20,0.6)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 20);
    ctx.font = '16px sans-serif';
    ctx.fillText('Press P or Enter to keep driving. Progress auto-saves after every job.', viewW / 2, viewH / 2 + 16);
  }

  function drawBusted(state) {
    drawWorld(state, state.hour >= 19.5 || state.hour < 6);
    ctx.fillStyle = 'rgba(8,10,20,0.66)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('BUSTED', viewW / 2, viewH / 2 - 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px sans-serif';
    ctx.fillText(state.message || 'The Bay Patrol caught up with you.', viewW / 2, viewH / 2 + 8);
    ctx.fillStyle = '#c9d4e8';
    ctx.font = '14px sans-serif';
    ctx.fillText('You wake up at Bay Clinic. Press Enter to get back out there.', viewW / 2, viewH / 2 + 40);
  }

  function draw(state, screen, best) {
    if (viewW === 0) resize();
    ctx.clearRect(0, 0, viewW, viewH);
    const night = state.hour >= 19.5 || state.hour < 6;
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused(state);
    else if (screen === SCREEN_BUSTED) drawBusted(state);
    else {
      drawWorld(state, night);
      drawHUD(state);
    }
  }

  return { draw, resize, get view() { return { w: viewW, h: viewH }; }, get cam() { return { x: camX, y: camY }; } };
}
