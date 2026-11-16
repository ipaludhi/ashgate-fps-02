import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const outDir = '/root/makefun/fps/race-20261116/entry/screenshots';
mkdirSync(outDir, { recursive: true });

async function run() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox']
  });  
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  
  await page.goto('http://127.0.0.1:8768/?shot=wide&seed=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ashgate && window.__ashgate.frames > 5 && window.game, null, { timeout: 30000 });
  
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0; // Kill loop
    if (window.game) window.game.setPaused(true);
  });

  const shots = [
    { 
      name: 'final_1_combat.jpg', 
      pos: [-10, 1.8, 15], look: [5, 1.8, -10], 
      radio: 'SQUAD: CONTACT! ENEMY AT YARD',
      flash: true
    },
    { 
      name: 'final_2_economy.jpg', 
      pos: [0, 5, 20], look: [0, 1.8, 0], 
      buy: true,
      radio: 'COMMAND: BUY PHASE — PREPARE'
    },
    { 
      name: 'final_3_tactics.jpg', 
      pos: [18, 1.8, 18], look: [22, 1.2, 22], 
      radio: 'SQUAD: PLANTING CHARGE AT SITE B'
    },
    { 
      name: 'final_4_map.jpg', 
      pos: [-35, 12, 35], look: [0, 2, 0], 
      radio: 'SQUAD: COVERING WIDE FLANK'
    }
  ];

  for (const shot of shots) {
    await page.evaluate((s) => {
      const g = window.game;
      g.camera.position.set(s.pos[0], s.pos[1], s.pos[2]);
      g.camera.lookAt(s.look[0], s.look[1], s.look[2]);
      
      const radioEl = document.getElementById('radio');
      if (radioEl) {
        radioEl.style.display = 'block';
        radioEl.innerHTML = `<div style="background: rgba(0,0,0,0.7); color: #00ff00; padding: 10px; font-weight: bold; border-left: 4px solid #00ff00;">${s.radio}</div>`;
      }

      const buyEl = document.getElementById('buy-menu');
      if (buyEl) {
        if (s.buy) {
          buyEl.style.display = 'block';
          buyEl.classList.remove('gone');
          buyEl.removeAttribute('hidden');
        } else {
          buyEl.style.display = 'none';
        }
      }

      if (s.flash && g.viewmodel && g.viewmodel.flash) {
        g.viewmodel.flash.visible = true;
        g.viewmodel.flash.scale.set(4, 4, 4);
      }
      
      g.renderer.render(g.scene, g.camera);
    }, shot);
    
    await page.waitForTimeout(500);
    const buffer = await page.screenshot({ type: 'jpeg', quality: 90 });
    writeFileSync(join(outDir, shot.name), buffer);
    console.log('Saved ' + shot.name);
  }

  await browser.close();
}

run().catch(console.error);
