"use strict";

(function () {
  'use strict';

  if (window.fastview_plugin_ready) return;
  window.fastview_plugin_ready = true;

  var started = false;
  var componentName = 'fastview';
  var torrentSource = 'fastview_torrents';
  var pluginScriptUrl = document.currentScript && document.currentScript.src || '';
  var pluginMetadata = {
    name: 'FastView',
    author: '@XEGARE',
    descr: 'Быстрый переход к выбранному источнику просмотра'
  };
  var settingsIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="currentColor" d="M29 4 10 35h16l-3 25 22-34H30L29 4Z"/><path fill="currentColor" d="m41 15 15 17-15 17V15Z"/></svg>';
  var watchIcon = settingsIcon;

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

    var network = new Lampa.Reguest();

    function add(u, params) {
      return u + (/\?/.test(u) ? '&' : '?') + params;
    }

    function url(u) {
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var ln = [Lampa.Storage.field('tmdb_lang')];

      if (params.langs) ln = typeof params.langs == 'string' ? [params.langs] : ln.concat(params.langs.filter(function (n) {
        return n !== ln[0];
      }));

      u = add(u, 'api_key=' + Lampa.TMDB.key());
      u = add(u, 'language=' + ln.join(','));
      if (params.genres && u.indexOf('with_genres') == -1) u = add(u, 'with_genres=' + params.genres);
      if (params.page) u = add(u, 'page=' + params.page);
      if (params.query) u = add(u, 'query=' + params.query);
      if (params.keywords) u = add(u, 'with_keywords=' + params.keywords);
      if (params.watch_region) u = add(u, 'watch_region=' + params.watch_region);
      if (params.watch_providers) u = add(u, 'with_watch_providers=' + params.watch_providers);
      if (params.networks) u = add(u, 'with_networks=' + params.networks);
      if (params.sort_by) u = add(u, 'sort_by=' + params.sort_by);

      if (params.filter) {
        for (var i in params.filter) {
          u = add(u, i + '=' + params.filter[i]);
        }
      }

      if (params.genres && u.indexOf('discover/') !== 0) u = 'discover/' + u;

      return Lampa.TMDB.api(u);
    }

    function get(method) {
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var oncomplite = arguments.length > 2 ? arguments[2] : undefined;
      var onerror = arguments.length > 3 ? arguments[3] : undefined;
      var u = url(method, params);

      network.silent(u, function (json) {
        json.url = method;
        oncomplite(json);
      }, onerror);
    }

    function external_imdb_id() {
      var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var oncomplite = arguments.length > 1 ? arguments[1] : undefined;

      get(params.type + '/' + params.id + '/external_ids', params, function (ids) {
        oncomplite(ids.imdb_id || '');
      }, function () {
        oncomplite('');
      });
    }

    function open_torrents(data, replaceCurrent) {
      var title = data.title || data.name || '';
      var originalTitle = data.original_title || data.original_name || title;
      var year = ((data.first_air_date || data.release_date || '0000') + '').slice(0, 4);
      var combinations = {
        df: originalTitle,
        df_year: originalTitle + ' ' + year,
        df_lg: originalTitle + ' ' + title,
        df_lg_year: originalTitle + ' ' + title + ' ' + year,
        lg: title,
        lg_year: title + ' ' + year,
        lg_df: title + ' ' + originalTitle,
        lg_df_year: title + ' ' + originalTitle + ' ' + year
      };
      var activity = {
        url: '',
        title: Lampa.Lang.translate('title_torrents'),
        component: 'torrents',
        search: combinations[Lampa.Storage.field('parse_lang')] || originalTitle || title,
        search_one: title,
        search_two: originalTitle,
        movie: data,
        page: 1
      };
      var current = Lampa.Activity.active();

      if (replaceCurrent && current && current.component == 'full') Lampa.Activity.replace(activity, true);else Lampa.Activity.push(activity);
    }

    function get_sources() {
      var sources = {};
      var sourceValues = {};
      var defaultSource;

      if (window.lampa_settings.torrents_use) {
        var torrentTitle = Lampa.Lang.translate('title_torrents');

        sourceValues[torrentSource] = torrentTitle;
        sources[torrentSource] = {
          title: torrentTitle,
          component: 'torrents',
          onSelect: open_torrents
        };
        defaultSource = torrentSource;
      }

      Lampa.Manifest.plugins.forEach(function (plugin) {
        if (plugin.type == 'video' && plugin.onContextMenu && plugin.onContextLauch) {
          if (!defaultSource) defaultSource = plugin.name;

          sourceValues[plugin.name] = plugin.name;
          sources[plugin.name] = {
            title: plugin.name,
            component: plugin.component,
            subtitle: plugin.subtitle || plugin.description,
            onSelect: function onSelect(data, replaceCurrent) {
              function launch() {
                var current = Lampa.Activity.active();

                if (replaceCurrent && current && current.component == 'full') Lampa.Activity.backward();

                plugin.onContextLauch(data);
              }

              if (document.body.classList.contains('search--open')) Lampa.Search.close();

              if (!data.imdb_id && data.source == 'tmdb') {
                external_imdb_id({
                  type: data.name ? 'tv' : 'movie',
                  id: data.id
                }, function (imdb_id) {
                  data.imdb_id = imdb_id;
                  launch();
                });
              } else launch();
            }
          };
        }
      });

      return {
        sources: sources,
        sourceValues: sourceValues,
        defaultSource: defaultSource
      };
    }

    function register_settings() {
      var sourceData = get_sources();
      var selectedSource = Lampa.Storage.field('fastview_default_source');

      if (sourceData.defaultSource != undefined && sourceData.sources[selectedSource] == undefined) {
        Lampa.Storage.set('fastview_default_source', sourceData.defaultSource);
      }

      if (Lampa.SettingsApi.removeComponent) Lampa.SettingsApi.removeComponent(componentName);

      Lampa.SettingsApi.addComponent({
        component: componentName,
        icon: settingsIcon,
        name: 'FastView'
      });

      Lampa.SettingsApi.addParam({
        component: componentName,
        param: {
          name: 'fastview_default_source',
          type: 'select',
          values: sourceData.sourceValues,
          "default": sourceData.defaultSource != undefined ? sourceData.defaultSource : ''
        },
        field: {
          name: Lampa.Lang.translate('fastview_default_source')
        },
        onChange: function onChange() {}
      });

      Lampa.SettingsApi.addParam({
        component: componentName,
        param: {
          name: 'fastview_open_immediately',
          type: 'trigger',
          "default": true
        },
        field: {
          name: Lampa.Lang.translate('fastview_open_immediately'),
          description: Lampa.Lang.translate('fastview_open_immediately_descr')
        },
        onChange: function onChange() {}
      });

      Lampa.SettingsApi.addParam({
        component: componentName,
        param: {
          name: 'fastview_direct_back',
          type: 'trigger',
          "default": true
        },
        field: {
          name: Lampa.Lang.translate('fastview_direct_back'),
          description: Lampa.Lang.translate('fastview_direct_back_descr')
        },
        onChange: function onChange() {}
      });
    }

    function open_source(card, replaceCurrent) {
      var sourceData = get_sources();
      var sourceName = Lampa.Storage.field('fastview_default_source') || sourceData.defaultSource;
      var source = sourceData.sources[sourceName];

      if (source) source.onSelect(card, replaceCurrent);else Lampa.Noty.show(Lampa.Lang.translate('fastview_source_not_loaded'));
    }

    Lampa.Lang.add({
      fastview_default_source: {
        ru: 'Источник по умолчанию',
        en: 'Default source'
      },
      fastview_open_immediately: {
        ru: 'Сразу открывать источник',
        en: 'Open source immediately'
      },
      fastview_open_immediately_descr: {
        ru: 'После выбора постера автоматически открывать источник по умолчанию',
        en: 'Automatically open default source after selecting a poster'
      },
      fastview_direct_back: {
        ru: 'Возврат сразу к списку',
        en: 'Return directly to list'
      },
      fastview_direct_back_descr: {
        ru: 'После автоматического открытия источника кнопка «Назад» вернёт туда, где была выбрана карточка',
        en: 'After opening a source automatically, Back returns to the page where the card was selected'
      },
      fastview_source_not_loaded: {
        ru: 'Источник по умолчанию ещё не загружен',
        en: 'Default source is not loaded yet'
      }
    });

    setTimeout(register_settings, 3000);

    Lampa.Listener.follow('full', function (e) {
      if (e.data && e.type == 'complite' && e.subtype !== 'load_buttons') {
        var cardData = e.object;
        var buttons = $('.activity--active .full-start-new__buttons');

        buttons.find('.button--fastview-watch').remove();
        buttons.prepend('<div class="full-start__button selector button--fastview-watch">' + watchIcon + '<span>' + Lampa.Lang.translate('title_watch') + '</span></div>');
        buttons.find('.button--fastview-watch').on('hover:enter', function () {
          open_source(cardData.card, false);
        });

        if (Lampa.Storage.field('fastview_open_immediately')) {
          open_source(cardData.card, Lampa.Storage.field('fastview_direct_back'));
        }
      }
    });

    Lampa.Listener.follow('activity', function (e) {
      if (e.type == 'start' && (e.component == 'lampac' || e.component == 'showy' || e.component == 'online_mod' || e.component == 'modss_online')) {
        if ($('.activity--active .explorer-card__head').next('.full-start-new__buttons').length == 0) {
          $('.activity--active .explorer-card__head').after('<div class="full-start-new__buttons" style="margin-bottom: 1em"></div>');
          $('.activity--active .explorer-card__head').css('margin-bottom', '1.3em');
          $('.activity--active .explorer-card__descr').css('overflow-y', 'auto');
          Lampa.Listener.send('full', {
            type: 'complite',
            subtype: 'load_buttons',
            object: {
              activity: Lampa.Activity.active().activity,
              method: Lampa.Activity.active().movie.first_air_date ? 'tv' : 'movie'
            },
            data: Lampa.Activity.active()
          });
        }
      }
    }, false);
  }

  if (window.appready) start();else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type == 'ready') start();
    });
  }
})();
