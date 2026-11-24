/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let isInitialized = false;

/**
 * Drives subtle, GPU-friendly liquid glass specular glint & rim shimmer
 * in response to page scroll and touch/pointer movement.
 */
export function initGlassScrollGlint(): void {
  if (isInitialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  isInitialized = true;

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return;
  }

  const root = document.documentElement;
  let rafId = 0;
  let decayTimer = 0;
  let lastScrollSum = window.scrollY || 0;
  let accumulatedDistance = 0;
  let pointerOffset = 0;
  let targetBoost = 0;
  let currentBoost = 0;

  const getScrollSum = (target?: EventTarget | null): number => {
    const winY = window.scrollY || window.pageYOffset || 0;
    let extra = 0;
    if (target && target instanceof HTMLElement && target !== document.documentElement && target !== document.body) {
      extra = target.scrollTop || 0;
    }
    return winY + extra;
  };

  const renderFrame = () => {
    rafId = 0;
    currentBoost += (targetBoost - currentBoost) * 0.22;

    const phase = (accumulatedDistance * 0.0085) + pointerOffset;
    // Smooth back-and-forth sweep across 12%..88% so glint glides seamlessly on long pages
    const wave = (Math.sin(phase) + 1) * 0.5;
    const glintPos = 12 + wave * 76;
    const glintAngle = 118 + Math.cos(phase * 0.8) * 26;
    const glintOpacity = 0.22 + currentBoost * 0.68;

    root.style.setProperty('--mp-glint-pos', `${glintPos.toFixed(2)}%`);
    root.style.setProperty('--mp-glint-angle', `${glintAngle.toFixed(1)}deg`);
    root.style.setProperty('--mp-glint-opacity', glintOpacity.toFixed(3));

    if (Math.abs(targetBoost - currentBoost) > 0.015 || targetBoost > 0.01) {
      rafId = window.requestAnimationFrame(renderFrame);
    }
  };

  const scheduleFrame = () => {
    if (!rafId) {
      rafId = window.requestAnimationFrame(renderFrame);
    }
  };

  const triggerMotion = (delta: number) => {
    const absDelta = Math.min(180, Math.abs(delta));
    accumulatedDistance += delta;
    targetBoost = Math.min(1, Math.max(targetBoost, 0.42 + absDelta / 90));
    scheduleFrame();

    if (decayTimer) {
      window.clearTimeout(decayTimer);
    }
    decayTimer = window.setTimeout(() => {
      targetBoost = 0;
      scheduleFrame();
    }, 180);
  };

  const onScroll = (ev: Event) => {
    const nextSum = getScrollSum(ev.target);
    const delta = nextSum - lastScrollSum;
    lastScrollSum = nextSum;
    triggerMotion(Math.abs(delta) < 1 ? 14 : delta);
  };

  let lastTouchY: number | null = null;
  const onTouchMove = (ev: TouchEvent) => {
    const y = ev.touches?.[0]?.clientY;
    if (typeof y !== 'number') return;
    if (lastTouchY !== null) {
      const delta = lastTouchY - y;
      if (Math.abs(delta) > 1) {
        triggerMotion(delta * 1.15);
      }
    }
    lastTouchY = y;
  };

  const onTouchEnd = () => {
    lastTouchY = null;
  };

  let lastPointerTs = 0;
  const onPointerMove = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') return;
    const now = performance.now();
    if (now - lastPointerTs < 32) return;
    lastPointerTs = now;
    const nx = window.innerWidth > 0 ? ev.clientX / window.innerWidth : 0.5;
    const ny = window.innerHeight > 0 ? ev.clientY / window.innerHeight : 0.5;
    pointerOffset = (nx - 0.5) * 1.4 + (ny - 0.5) * 0.9;
    targetBoost = Math.max(targetBoost, 0.28);
    scheduleFrame();

    if (decayTimer) {
      window.clearTimeout(decayTimer);
    }
    decayTimer = window.setTimeout(() => {
      targetBoost = 0;
      scheduleFrame();
    }, 240);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
}
