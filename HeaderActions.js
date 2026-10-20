"use strict";

(function () {
  'use strict';

  if (window.headeractions_plugin_ready) return;
  window.headeractions_plugin_ready = true;

  var started = false;
  var componentName = 'headeractions';
  var pluginScriptUrl = document.currentScript && document.currentScript.src || '';
  var historyIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.5 8.5"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/></svg>';
  var movieIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 17-4 1 4-17 4-1-4Z"/><path d="m7 6 3 3m3-4 3 3M4 11v9a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V10"/><path d="m12 12 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4Z"/></svg>';
  var tvIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="15" rx="2"/><path d="m8 2 4 4 4-4"/><path d="m12 9 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4Z"/></svg>';

  function normalize_plugin_url(url) {
    var link = document.createElement('a');

    link.href = url || '';

    return link.href.split('#')[0].split('?')[0].replace(/\/$/, '');
  }

  function register_plugin_metadata() {
    if (!pluginScriptUrl || !Lampa.Plugins || !Lampa.Plugins.get || !Lampa.Plugins.save) return;

    var currentUrl = normalize_plugin_url(pluginScriptUrl);
    var changed = false;
    var metadata = {
      name: 'HeaderActions',
      author: '@XEGARE',
      descr: Lampa.Lang.translate('headeractions_description')
    };

    Lampa.Plugins.get().forEach(function (plugin) {
      if (normalize_plugin_url(plugin.url) == currentUrl) {
        Object.keys(metadata).forEach(function (key) {
          if (!plugin[key]) {
            plugin[key] = metadata[key];
            changed = true;
          }
        });
      }
    });

    if (changed) Lampa.Plugins.save();
  }

  function start() {
    if (started) return;
    started = true;

    Lampa.Lang.add({
      headeractions_title: {
        ru: 'Быстрые действия',
        en: 'Quick actions'
      },
      headeractions_description: {
        ru: 'Быстрый доступ к топам фильмов, сериалов и истории просмотров прямо из шапки',
        en: 'Quick access to top movies, top TV shows and watch history from the header'
      },
      headeractions_movie: {
        ru: 'Топ фильмы',
        en: 'Top movies'
      },
      headeractions_tv: {
        ru: 'Топ сериалы',
        en: 'Top TV shows'
      },
      headeractions_history: {
        ru: 'История просмотров',
        en: 'Watch history'
      },
      headeractions_notice: {
        ru: 'Уведомления',
        en: 'Notifications'
      },
      headeractions_search: {
        ru: 'Поиск',
        en: 'Search'
      },
      headeractions_settings: {
        ru: 'Настройки',
        en: 'Settings'
      },
      headeractions_show_button: {
        ru: 'Показывать кнопку в шапке',
        en: 'Show button in header'
      }
    });

    register_plugin_metadata();

    Lampa.SettingsApi.addComponent({
      component: componentName,
      icon: movieIcon,
      name: Lampa.Lang.translate('headeractions_title')
    });

    var actions = [
      { name: 'movie', icon: movieIcon, url: 'movie/top_rated' },
      { name: 'tv', icon: tvIcon, url: 'tv/top_rated' },
      { name: 'history', icon: historyIcon }
    ];

    // Head.addIcon prepends elements; reverse insertion preserves intended order.
    actions.slice().reverse().forEach(function (action) {
      var titleKey = 'headeractions_' + action.name;
      var title = Lampa.Lang.translate(titleKey);

      action.button = Lampa.Head.addIcon(action.icon, function () {
        if (action.name == 'history') {
          Lampa.Router.call('favorite', {
            title: Lampa.Lang.translate(titleKey),
            type: 'history'
          });
        } else {
          var source = Lampa.Storage.field('source') == 'cub' ? 'cub' : 'tmdb';

          Lampa.Router.call('category_full', {
            url: source == 'cub' ? 'top/hundred/' + action.name : action.url,
            title: Lampa.Lang.translate(titleKey),
            source: source,
            page: 1
          });
        }
      });

      action.button.addClass('head--headeractions-' + action.name).attr({
        title: title,
        'aria-label': title,
        role: 'button'
      });
    });

    actions.concat([
      { name: 'notice', button: Lampa.Head.render().find('.notice--icon') },
      { name: 'search', button: Lampa.Head.render().find('.open--search') },
      { name: 'settings', button: Lampa.Head.render().find('.open--settings') }
    ]).forEach(function (action) {
      var key = 'headeractions_' + action.name;

      function update_button() {
        action.button.toggle(!!Lampa.Storage.field(key));
      }

      Lampa.SettingsApi.addParam({
        component: componentName,
        param: {
          name: key,
          type: 'trigger',
          "default": action.name != 'notice'
        },
        field: {
          name: Lampa.Lang.translate(key),
          description: Lampa.Lang.translate('headeractions_show_button')
        },
        onChange: update_button
      });

      update_button();
    });
  }

  if (window.appready) start();else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type == 'ready') start();
    });
  }
})();
