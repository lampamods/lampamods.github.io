"use strict";

(function () {
  'use strict';

  if (window.historyshortcut_plugin_ready) return;
  window.historyshortcut_plugin_ready = true;

  var started = false;
  var pluginScriptUrl = document.currentScript && document.currentScript.src || '';
  var pluginMetadata = {
    name: 'HistoryShortcut',
    author: '@XEGARE',
    descr: 'Открывает историю просмотров кнопкой в шапке'
  };
  var historyIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.5 8.5"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/></svg>';

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
        if (!plugin.name) {
          plugin.name = pluginMetadata.name;
          changed = true;
        }
        if (!plugin.author) {
          plugin.author = pluginMetadata.author;
          changed = true;
        }
        if (!plugin.descr) {
          plugin.descr = pluginMetadata.descr;
          changed = true;
        }
      }
    });

    if (changed) Lampa.Plugins.save();
  }

  function start() {
    if (started) return;
    started = true;

    register_plugin_metadata();

    var title = Lampa.Lang.translate('title_history');
    var button = Lampa.Head.addIcon(historyIcon, function () {
      Lampa.Router.call('favorite', {
        title: Lampa.Lang.translate('title_history'),
        type: 'history'
      });
    });

    button.addClass('head--historyshortcut').attr({
      title: title,
      'aria-label': title,
      role: 'button'
    });
  }

  if (window.appready) start();else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type == 'ready') start();
    });
  }
})();
