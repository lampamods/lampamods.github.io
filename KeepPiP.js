"use strict";

(function () {
  'use strict';

  if (window.keeppip_plugin_ready) return;
  window.keeppip_plugin_ready = true;

  var started = false;
  var pluginScriptUrl = document.currentScript && document.currentScript.src || '';
  var pluginMetadata = {
    name: 'KeepPiP',
    author: '@XEGARE',
    descr: 'Сохраняет режим «картинка в картинке» при переходе к следующей серии'
  };

  function normalize_plugin_url(url) {
    var link = document.createElement('a');
    link.href = url || '';
    return link.href.split('#')[0].split('?')[0].replace(/\/$/, '');
  }

  function register_plugin_metadata() {
    if (!pluginScriptUrl || !Lampa.Plugins || !Lampa.Plugins.get || !Lampa.Plugins.save) return;

    var currentUrl = normalize_plugin_url(pluginScriptUrl);
    var plugins = Lampa.Plugins.get();
    var changed = false;

    plugins.forEach(function (plugin) {
      if (normalize_plugin_url(plugin.url) == currentUrl) {
        if (!plugin.name) { plugin.name = pluginMetadata.name; changed = true; }
        if (!plugin.author) { plugin.author = pluginMetadata.author; changed = true; }
        if (!plugin.descr) { plugin.descr = pluginMetadata.descr; changed = true; }
      }
    });

    if (changed) Lampa.Plugins.save();
  }

  function start() {
    if (started) return;
    started = true;
    register_plugin_metadata();

    var playlist = Lampa.PlayerPlaylist;
    var player = Lampa.Player;
    var video = Lampa.PlayerVideo;
    if (!playlist || !playlist.listener || !player || !player.listener || !video || !video.listener ||
        !video.video || !video.destroy || !video.url || !$.fn || !$.fn.init) return;

    var originalSelect = playlist.listener.send;
    var originalDestroy = video.destroy;
    var originalUrl = video.url;
    var transfer = null;

    function finish(reused) {
      if (!transfer) return;
      clearTimeout(transfer.timer);
      if (transfer.restoreDetach) transfer.restoreDetach();
      if (!reused && transfer.oldVideo.parentNode) transfer.oldVideo.parentNode.removeChild(transfer.oldVideo);
      transfer = null;
    }

    playlist.listener.send = function (type, event) {
      if (type == 'select' && event && event.item && document.pictureInPictureElement === video.video()) {
        finish();
        var oldVideo = video.video();
        var playerNode = $(oldVideo).closest('.player')[0];
        if (playerNode) {
          transfer = { oldVideo: oldVideo, playerNode: playerNode, timer: null, restoreDetach: null, destroyed: false };
          transfer.timer = setTimeout(finish, 30000);
        }
      }
      return originalSelect.apply(this, arguments);
    };

    video.destroy = function () {
      var handoff = transfer;
      if (!handoff || handoff.destroyed || document.pictureInPictureElement !== handoff.oldVideo) {
        return originalDestroy.apply(this, arguments);
      }
      handoff.destroyed = true;

      var oldVideo = handoff.oldVideo;
      var display = oldVideo.parentNode;
      var originalExit = document.exitPictureInPicture;
      var originalRemoveAttribute = oldVideo.removeAttribute;
      var originalLoad = oldVideo.load;
      var originalEmpty = $.fn.empty;
      var originalDetach = $.fn.detach;

      // Keep the PiP video attached while Lampa resets its player state.
      document.exitPictureInPicture = function () { return Promise.resolve(); };
      oldVideo.removeAttribute = function (name) {
        if (name !== 'src') return originalRemoveAttribute.apply(this, arguments);
      };
      oldVideo.load = function () {};
      $.fn.empty = function () {
        if (this[0] === display) return this;
        return originalEmpty.apply(this, arguments);
      };
      $.fn.detach = function () {
        if (this[0] === handoff.playerNode) return this;
        return originalDetach.apply(this, arguments);
      };
      handoff.restoreDetach = function () {
        $.fn.detach = originalDetach;
        handoff.restoreDetach = null;
      };

      try {
        return originalDestroy.apply(this, arguments);
      } finally {
        document.exitPictureInPicture = originalExit;
        oldVideo.removeAttribute = originalRemoveAttribute;
        oldVideo.load = originalLoad;
        $.fn.empty = originalEmpty;
      }
    };

    video.url = function (src) {
      var handoff = transfer;
      if (!handoff || !handoff.destroyed || document.pictureInPictureElement !== handoff.oldVideo ||
          typeof src !== 'string' || (video.verifyTube && video.verifyTube(src))) {
        return originalUrl.apply(this, arguments);
      }

      var oldVideo = handoff.oldVideo;
      var display = oldVideo.parentNode;
      var videoBox = $(oldVideo);
      var originalInit = $.fn.init;
      var originalAppend = $.fn.append;
      var originalAddEventListener = oldVideo.addEventListener;
      var binding = false;

      // Lampa's next create() receives the existing element instead of a new one.
      $.fn.init = function (selector) {
        if (typeof selector === 'string' && selector.indexOf('<video class="player-video__video"') === 0) return videoBox;
        return new originalInit(selector, arguments[1], arguments[2]);
      };
      $.fn.init.prototype = originalInit.prototype;
      $.fn.append = function (content) {
        if (this[0] === display && content && content[0] === oldVideo) return this;
        return originalAppend.apply(this, arguments);
      };
      oldVideo.addEventListener = function (type) {
        if (type === 'waiting') binding = true;
        if (binding && /^(waiting|playing|ended|webkitendfullscreen|error|progress|canplay|timeupdate|loadeddata)$/.test(type)) {
          if (type === 'loadeddata') binding = false;
          return;
        }
        return originalAddEventListener.apply(this, arguments);
      };

      try {
        var result = originalUrl.apply(this, arguments);
        if (video.video() === oldVideo) finish(true);
        return result;
      } finally {
        $.fn.init = originalInit;
        $.fn.append = originalAppend;
        oldVideo.addEventListener = originalAddEventListener;
      }
    };

    player.listener.follow('start', function () {
      if (transfer && transfer.restoreDetach) transfer.restoreDetach();
    });

    video.listener.follow('loadeddata', function () {
      if (!transfer) return;
      var nextVideo = video.video();
      if (!nextVideo || nextVideo === transfer.oldVideo || document.pictureInPictureElement !== transfer.oldVideo) {
        finish();
        return;
      }
      if (typeof nextVideo.requestPictureInPicture !== 'function') {
        finish();
        return;
      }

      try {
        Promise.resolve(nextVideo.requestPictureInPicture()).then(finish, finish);
      } catch (error) {
        finish();
      }
    });
  }

  if (window.appready) start();
  else Lampa.Listener.follow('app', function (event) {
    if (event.type == 'ready') start();
  });
})();
