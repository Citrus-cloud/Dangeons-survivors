'use strict';
/* ============================================================
   monetization.js — Система монетизации (AdMob + IAP заглушка).
   
   Использует Capacitor + @capacitor-community/admob для показа
   рекламы в нативной обёртке. В браузере работает в режиме
   эмуляции (console.log вместо реальных вызовов).
   
   API:
   • Monetization.initialize()        — инициализация AdMob
   • Monetization.showBanner()        — показать баннер (меню/результаты)
   • Monetization.hideBanner()        — скрыть баннер (во время боя)
   • Monetization.showInterstitial(placement) — межстраничное (частота: 3 мин)
   • Monetization.showRewarded(placement, rewardCb) — rewarded video
   • Monetization.purchaseNoAds()     — заглушка IAP «убрать рекламу»
   • Monetization.restorePurchases()  — проверка покупки в safeStorage
   • Monetization.isPremium()         — проверка флага premium
   
   Зависимости: SafeStorage (должен быть загружен ранее)
   
   Экспорт: window.Monetization
   ============================================================ */

const Monetization = (function() {

  // ===== Конфигурация рекламных ID (тестовые Google) =====
  const AD_CONFIG = {
    banner: {
      android: 'ca-app-pub-3940256099942544/6300978111',
      ios:     'ca-app-pub-3940256099942544/2934735716',
    },
    interstitial: {
      android: 'ca-app-pub-3940256099942544/1033173712',
      ios:     'ca-app-pub-3940256099942544/4411468910',
    },
    rewarded: {
      android: 'ca-app-pub-3940256099942544/5224354917',
      ios:     'ca-app-pub-3940256099942544/1712485313',
    },
  };

  // ===== Константы =====
  const STORAGE_KEY_PREMIUM       = 'd20_premium';
  const STORAGE_KEY_LAST_INTERST  = 'd20_last_interstitial';
  const INTERSTITIAL_COOLDOWN_MS  = 3 * 60 * 1000; // 3 минуты

  // ===== Внутреннее состояние =====
  let _initialized = false;
  let _isNative = false;       // true если запущено в Capacitor
  let _admob = null;           // ссылка на плагин AdMob
  let _bannerVisible = false;
  let _platform = 'android';   // 'android' | 'ios'

  // ===== Вспомогательные функции =====

  /** Проверяет, является ли приложение нативным (Capacitor). */
  function _detectNative() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (e) {
      console.warn('[Monetization] _detectNative error:', e);
      return false;
    }
  }

  /** Определяет платформу (android/ios). */
  function _detectPlatform() {
    try {
      if (window.Capacitor && window.Capacitor.getPlatform) {
        const p = window.Capacitor.getPlatform();
        if (p === 'ios') return 'ios';
      }
    } catch (e) {
      // Ignore errors from broken Capacitor
    }
    return 'android';
  }

  /** Получить AdMob-плагин из Capacitor. */
  function _getAdMobPlugin() {
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
        return window.Capacitor.Plugins.AdMob;
      }
    } catch (e) {
      // Ignore errors from broken Capacitor
    }
    // Попытка через глобальный AdMob (если подключен через CDN)
    if (window.AdMob) return window.AdMob;
    return null;
  }

  /** Получить рекламный ID для текущей платформы. */
  function _getAdId(type) {
    return AD_CONFIG[type][_platform] || AD_CONFIG[type].android;
  }

  /** Проверить, прошло ли достаточно времени с последнего interstitial. */
  function _canShowInterstitial() {
    const last = SafeStorage.getItem(STORAGE_KEY_LAST_INTERST);
    if (!last) return true;
    const elapsed = Date.now() - parseInt(last, 10);
    return elapsed >= INTERSTITIAL_COOLDOWN_MS;
  }

  /** Сохранить время последнего показа interstitial. */
  function _markInterstitialShown() {
    SafeStorage.setItem(STORAGE_KEY_LAST_INTERST, String(Date.now()));
  }

  // ===== Публичный API =====

  return {

    /**
     * Инициализация системы монетизации.
     * Вызывать при старте приложения (из state-machine.js / BOOT).
     */
    async initialize() {
      if (_initialized) return;
      _initialized = true;

      _isNative = _detectNative();
      _platform = _detectPlatform();

      // Если пользователь — premium, реклама не нужна
      if (this.isPremium()) {
        console.log('[Monetization] Premium user — ads disabled.');
        this._updateUI();
        return;
      }

      if (!_isNative) {
        console.log('[Monetization] Running in browser (emulation mode). Ads will be logged only.');
        this._updateUI();
        return;
      }

      // Нативный режим — инициализируем AdMob
      _admob = _getAdMobPlugin();
      if (!_admob) {
        console.warn('[Monetization] AdMob plugin not found. Falling back to emulation.');
        _isNative = false;
        this._updateUI();
        return;
      }

      try {
        await _admob.initialize({
          requestTrackingAuthorization: true,
          testingDevices: [],
          initializeForTesting: true,
        });
        console.log('[Monetization] AdMob initialized successfully.');
      } catch (err) {
        console.error('[Monetization] AdMob init failed:', err);
        _isNative = false; // fallback to emulation
      }

      this._updateUI();
    },

    /**
     * Показать адаптивный баннер внизу экрана.
     * Вызывать на экранах меню, лагеря, результатов.
     */
    async showBanner() {
      if (this.isPremium() || _bannerVisible) return;

      if (!_isNative || !_admob) {
        console.log('[Monetization][Emu] showBanner()');
        _bannerVisible = true;
        this._showEmulatedBanner(true);
        return;
      }

      try {
        await _admob.showBanner({
          adId: _getAdId('banner'),
          adSize: 'ADAPTIVE_BANNER',
          position: 'BOTTOM_CENTER',
          margin: 0,
          isTesting: true,
        });
        _bannerVisible = true;
        console.log('[Monetization] Banner shown.');
      } catch (err) {
        console.warn('[Monetization] Banner show failed:', err);
      }
    },

    /**
     * Скрыть баннер (во время активной игры).
     */
    async hideBanner() {
      if (!_bannerVisible) return;

      if (!_isNative || !_admob) {
        console.log('[Monetization][Emu] hideBanner()');
        _bannerVisible = false;
        this._showEmulatedBanner(false);
        return;
      }

      try {
        await _admob.hideBanner();
        _bannerVisible = false;
        console.log('[Monetization] Banner hidden.');
      } catch (err) {
        console.warn('[Monetization] Banner hide failed:', err);
      }
    },

    /**
     * Показать межстраничное объявление.
     * Частотный контроль: не чаще 1 раза в 3 минуты.
     * 
     * @param {string} placement — 'death' | 'menu_return'
     */
    async showInterstitial(placement) {
      if (this.isPremium()) return;
      if (!_canShowInterstitial()) {
        console.log(`[Monetization] Interstitial cooldown active (placement: ${placement}).`);
        return;
      }

      if (!_isNative) {
        console.log(`[Monetization][Emu] showInterstitial(${placement})`);
        _markInterstitialShown();
        return;
      }

      try {
        await _admob.prepareInterstitial({
          adId: _getAdId('interstitial'),
          isTesting: true,
        });
        await _admob.showInterstitial();
        _markInterstitialShown();
        console.log(`[Monetization] Interstitial shown (placement: ${placement}).`);
      } catch (err) {
        console.warn('[Monetization] Interstitial failed:', err);
      }
    },

    /**
     * Показать rewarded video.
     * 
     * @param {string} placement — 'death_revive' | 'bonus_gold'
     * @param {function} rewardCallback — вызывается при успешном просмотре
     * @returns {Promise<boolean>} — true если награда получена
     */
    async showRewarded(placement, rewardCallback) {
      if (!_isNative) {
        console.log(`[Monetization][Emu] showRewarded(${placement}) — auto-success`);
        if (typeof rewardCallback === 'function') rewardCallback();
        return true;
      }

      try {
        await _admob.prepareRewardVideoAd({
          adId: _getAdId('rewarded'),
          isTesting: true,
        });

        // Слушаем событие награды
        const rewardPromise = new Promise((resolve) => {
          const handler = _admob.addListener('onRewardedVideoAdReward', () => {
            handler.remove();
            resolve(true);
          });
          // Таймаут на случай если событие не придёт (закрытие без просмотра)
          setTimeout(() => resolve(false), 60000);
        });

        await _admob.showRewardVideoAd();
        const rewarded = await rewardPromise;

        if (rewarded) {
          console.log(`[Monetization] Rewarded complete (placement: ${placement}).`);
          if (typeof rewardCallback === 'function') rewardCallback();
          return true;
        } else {
          console.log(`[Monetization] Rewarded dismissed without reward (placement: ${placement}).`);
          return false;
        }
      } catch (err) {
        console.warn('[Monetization] Rewarded failed:', err);
        return false;
      }
    },

    /**
     * Заглушка покупки «Убрать рекламу».
     * Записывает premium=true в SafeStorage, скрывает баннер,
     * обновляет UI.
     * 
     * В будущем заменить на реальный IAP (Capacitor In-App Purchase).
     */
    async purchaseNoAds() {
      console.log('[Monetization] Purchase "No Ads" initiated.');
      SafeStorage.setItem(STORAGE_KEY_PREMIUM, 'true');
      
      // Скрыть текущую рекламу
      await this.hideBanner();
      
      // Обновить кнопки
      this._updateUI();
      
      console.log('[Monetization] Premium activated! Ads disabled.');
      return true;
    },

    /**
     * Восстановление покупок — проверяет SafeStorage.
     * В будущем заменить на проверку через IAP store.
     * 
     * @returns {boolean} true если premium
     */
    restorePurchases() {
      const isPremium = this.isPremium();
      console.log(`[Monetization] Restore purchases: premium=${isPremium}`);
      this._updateUI();
      return isPremium;
    },

    /**
     * Проверка флага premium.
     * @returns {boolean}
     */
    isPremium() {
      return SafeStorage.getItem(STORAGE_KEY_PREMIUM) === 'true';
    },

    // ===== UI-методы (управление DOM-элементами монетизации) =====

    /**
     * Обновить видимость кнопок монетизации.
     * Скрыть «Убрать рекламу» если уже premium.
     */
    _updateUI() {
      const noAdsBtn = document.getElementById('noAdsBtn');
      if (noAdsBtn) {
        noAdsBtn.style.display = this.isPremium() ? 'none' : '';
      }
      // Скрыть кнопки rewarded если premium (они и так не показываются,
      // но для надёжности)
      const reviveBtn = document.getElementById('adReviveBtn');
      const doubleBtn = document.getElementById('adDoubleGoldBtn');
      if (this.isPremium()) {
        if (reviveBtn) reviveBtn.style.display = 'none';
        if (doubleBtn) doubleBtn.style.display = 'none';
      }
    },

    /**
     * Показать кнопки rewarded на экране смерти.
     * Вызывается при отображении Game Over / Run Stats.
     * 
     * @param {object} options — { canRevive: boolean, canDoubleGold: boolean }
     */
    showDeathAdButtons(options) {
      const container = document.getElementById('monetization-ui');
      if (!container) return;

      const reviveBtn = document.getElementById('adReviveBtn');
      const doubleBtn = document.getElementById('adDoubleGoldBtn');

      if (this.isPremium()) {
        if (reviveBtn) reviveBtn.style.display = 'none';
        if (doubleBtn) doubleBtn.style.display = 'none';
        return;
      }

      if (reviveBtn && options && options.canRevive) {
        reviveBtn.style.display = 'inline-flex';
      }
      if (doubleBtn && options && options.canDoubleGold) {
        doubleBtn.style.display = 'inline-flex';
      }

      container.style.display = 'flex';
    },

    /**
     * Скрыть все кнопки монетизации.
     */
    hideDeathAdButtons() {
      const container = document.getElementById('monetization-ui');
      if (container) container.style.display = 'none';
      const reviveBtn = document.getElementById('adReviveBtn');
      const doubleBtn = document.getElementById('adDoubleGoldBtn');
      if (reviveBtn) reviveBtn.style.display = 'none';
      if (doubleBtn) doubleBtn.style.display = 'none';
    },

    /**
     * Эмуляция баннера в браузере (полоска внизу экрана для наглядности).
     * @param {boolean} show
     */
    _showEmulatedBanner(show) {
      let banner = document.getElementById('emuBanner');
      if (show) {
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'emuBanner';
          banner.style.cssText =
            'position:fixed;bottom:0;left:0;right:0;height:50px;' +
            'background:rgba(0,0,0,0.85);color:#aaa;font-size:12px;' +
            'display:flex;align-items:center;justify-content:center;' +
            'z-index:9999;border-top:1px solid #444;font-family:monospace;' +
            'pointer-events:none;';
          banner.textContent = '[AdMob Banner — Test Mode]';
          document.body.appendChild(banner);
        }
        banner.style.display = 'flex';
      } else {
        if (banner) banner.style.display = 'none';
      }
    },

    // ===== Обработчики для интеграции с игрой =====

    /**
     * Обработчик кнопки «Воскреснуть (реклама)».
     * Показывает rewarded video, при успехе воскрешает игрока.
     */
    async handleRevive() {
      const btn = document.getElementById('adReviveBtn');
      if (btn) btn.disabled = true;

      const success = await this.showRewarded('death_revive', () => {
        // Callback награды: воскресить игрока
        if (window.Game && Game.player) {
          Game.player.hp = Math.floor(Game.player.maxHp * 0.5);
          Game.player._iFrameTimer = 2.0; // I-frames после воскрешения
          Game.state = 'playing';
          // Скрыть overlay
          if (window.UI) UI.hideAll();
          // Скрыть кнопки рекламы
          Monetization.hideDeathAdButtons();
          // Скрыть баннер во время боя
          Monetization.hideBanner();
          console.log('[Monetization] Player revived via rewarded ad!');
        }
      });

      if (!success && btn) btn.disabled = false;
    },

    /**
     * Обработчик кнопки «Удвоить золото (реклама)».
     * Показывает rewarded video, при успехе удваивает золото забега.
     */
    async handleDoubleGold() {
      const btn = document.getElementById('adDoubleGoldBtn');
      if (btn) btn.disabled = true;

      await this.showRewarded('bonus_gold', () => {
        // Callback награды: удвоить золото
        if (window.Game) {
          const bonus = Game.runGold || 0;
          Game.runGold = bonus * 2;
          // Обновить MetaProgress
          if (window.MetaProgress && MetaProgress.data) {
            MetaProgress.addGold(bonus); // добавить вторую порцию
          }
          console.log(`[Monetization] Gold doubled! ${bonus} → ${Game.runGold}`);
          // Обновить UI если есть отображение золота
          const goldEl = document.querySelector('.run-stats-value');
          if (goldEl && goldEl.textContent == bonus) {
            goldEl.textContent = Game.runGold;
          }
        }
        // Скрыть кнопку (одноразовая)
        if (btn) btn.style.display = 'none';
      });
    },

    /**
     * Событие: игрок перешёл в меню/лагерь.
     * Показать баннер + попытка interstitial.
     */
    onMenuEnter() {
      this.showBanner();
      this.showInterstitial('menu_return');
    },

    /**
     * Событие: начало нового забега.
     * Скрыть баннер.
     */
    onRunStart() {
      this.hideBanner();
      this.hideDeathAdButtons();
    },

    /**
     * Событие: смерть игрока / конец забега.
     * Показать баннер + interstitial + кнопки rewarded.
     */
    onRunEnd() {
      this.showBanner();
      this.showInterstitial('death');
      // Показать кнопки rewarded (revive доступен только если не было уже revive)
      this.showDeathAdButtons({
        canRevive: true,
        canDoubleGold: true,
      });
    },
  };

})();

window.Monetization = Monetization;
