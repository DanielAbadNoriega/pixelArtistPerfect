(function() {
    "use strict";

    var COLOR_VERSION = 2;
    var LEGACY_DEFAULT_COLOR = '#84cc16';
    var DEFAULT_SETTINGS = {
        doContextMenu: true
        , showDistances: true
        , snapToPx: ''
        , snapToEls: ''
        , selectedColor: '#ef4444'
        , selectedColorVersion: COLOR_VERSION
        , settingsLauncherPosition: null
    };
    var SETTINGS_KEYS = Object.keys( DEFAULT_SETTINGS );
    var GUIDES_KEY = 'guidesByUrl';
    var MENU_PREFIX = 'pixelfromen-studio-menu';
    var MENU_ENTRIES = {
        addvert: 'Create Vertical Guide'
        , addhorz: 'Create Horizontal Guide'
        , surround: 'Element: All Sides'
        , top: 'Element Top'
        , right: 'Element Right'
        , bottom: 'Element Bottom'
        , left: 'Element Left'
    };

    var normalizeUrl = function( url ) {
        return url ? url.replace( /\#.*/, '' ) : '';
    };

    var ensureDefaults = async function() {
        var current = await chrome.storage.local.get( SETTINGS_KEYS )
            , missing = {};

        SETTINGS_KEYS.forEach(function( key ) {
            if ( typeof(current[key]) == 'undefined' )
                missing[key] = DEFAULT_SETTINGS[key];
        });

        if ( Object.keys( missing ).length )
            await chrome.storage.local.set( missing );
    };

    var getSettings = async function() {
        await ensureDefaults();
        var current = await chrome.storage.local.get( SETTINGS_KEYS )
            , payload = {};

        if ( current.selectedColorVersion !== COLOR_VERSION ) {
            payload.selectedColorVersion = COLOR_VERSION;
            if (
                !current.selectedColor
                || String(current.selectedColor).toLowerCase() == LEGACY_DEFAULT_COLOR
                || String(current.selectedColor).toLowerCase() == 'rgb(132, 204, 22)'
            )
                payload.selectedColor = DEFAULT_SETTINGS.selectedColor;

            await chrome.storage.local.set( payload );
            current = Object.assign( {}, current, payload );
        }

        return Object.assign( {}, DEFAULT_SETTINGS, current );
    };

    var getGuidesStore = async function() {
        var result = await chrome.storage.local.get( GUIDES_KEY );
        return result[GUIDES_KEY] || {};
    };

    var setGuidesStore = async function( guidesStore ) {
        var payload = {};
        payload[GUIDES_KEY] = guidesStore;
        await chrome.storage.local.set( payload );
    };

    var saveGuide = async function( url, guideData ) {
        var normalizedUrl = normalizeUrl( url );
        if ( !normalizedUrl )
            throw new Error('Unable to save guide without a valid url');

        var guidesStore = await getGuidesStore();
        if ( !guidesStore[normalizedUrl] )
            guidesStore[normalizedUrl] = {};

        guidesStore[normalizedUrl][guideData.id] = guideData;
        await setGuidesStore( guidesStore );
    };

    var removeGuide = async function( url, guideId ) {
        var normalizedUrl = normalizeUrl( url );
        if ( !normalizedUrl )
            return false;

        var guidesStore = await getGuidesStore()
            , pageGuides = guidesStore[normalizedUrl];

        if ( pageGuides && pageGuides[guideId] ) {
            delete pageGuides[guideId];
            guidesStore[normalizedUrl] = pageGuides;
            await setGuidesStore( guidesStore );
            return true;
        }

        return false;
    };

    var clearGuides = async function( url ) {
        var normalizedUrl = normalizeUrl( url );
        if ( !normalizedUrl )
            return;

        var guidesStore = await getGuidesStore();
        guidesStore[normalizedUrl] = {};
        await setGuidesStore( guidesStore );
    };

    var sendMessageToTab = async function( tabId, message ) {
        if ( !tabId )
            return false;

        try {
            await chrome.tabs.sendMessage( tabId, message );
            return true;
        } catch ( error ) {
            console.debug( 'Unable to send message to tab', tabId, message, error );
            return false;
        }
    };

    var getTargetTab = async function( tab ) {
        if ( tab && tab.id )
            return tab;

        var tabs = await chrome.tabs.query({
            active: true
            , lastFocusedWindow: true
        });

        return tabs[0];
    };

    var sendMessageToActiveTab = async function( message, tab ) {
        var targetTab = await getTargetTab( tab );
        if ( !targetTab || !targetTab.id || !/^https?:/.test( targetTab.url || '' ) )
            return false;
        return sendMessageToTab( targetTab.id, message );
    };

    var removeAllContextMenus = function() {
        return new Promise(function( resolve ) {
            chrome.contextMenus.removeAll(function() {
                resolve();
            });
        });
    };

    var rebuildContextMenus = async function() {
        await removeAllContextMenus();

        var settings = await getSettings();
        if ( !settings.doContextMenu )
            return;

        Object.keys( MENU_ENTRIES ).forEach(function( key ) {
            chrome.contextMenus.create({
                id: MENU_PREFIX + ':' + key
                , title: MENU_ENTRIES[key]
                , contexts: [ 'all' ]
            });
        });
    };

    var syncTab = async function( tabId, tabUrl ) {
        var normalizedUrl = normalizeUrl( tabUrl );
        if ( !normalizedUrl )
            return;

        var guidesStore = await getGuidesStore()
            , settings = await getSettings()
            , guides = guidesStore[normalizedUrl] || {};

        await sendMessageToTab( tabId, {
            method: 'injectGuide'
            , guides: guides
        });

        await sendMessageToTab( tabId, {
            method: settings.showDistances ? 'activateDistances' : 'deactivateDistances'
        });
        await sendMessageToTab( tabId, {
            method: settings.doContextMenu ? 'activateContextMenu' : 'deactivateContextMenu'
        });
        await sendMessageToTab( tabId, {
            method: 'setSnapToPx'
            , snapToPx: settings.snapToPx
        });
        await sendMessageToTab( tabId, {
            method: 'setSnapToEls'
            , snapToEls: settings.snapToEls
        });
    };

    chrome.runtime.onInstalled.addListener(function() {
        ensureDefaults().then( rebuildContextMenus );
    });

    chrome.runtime.onStartup.addListener(function() {
        ensureDefaults().then( rebuildContextMenus );
    });

    chrome.storage.onChanged.addListener(function( changes, areaName ) {
        if ( areaName != 'local' )
            return;

        if ( changes.doContextMenu )
            rebuildContextMenus();
    });

    chrome.contextMenus.onClicked.addListener(function( info, tab ) {
        if ( typeof(info.menuItemId) != 'string' || info.menuItemId.indexOf( MENU_PREFIX + ':' ) !== 0 )
            return;

        var action = info.menuItemId.replace( MENU_PREFIX + ':', '' );

        getSettings().then(function( settings ) {
            return sendMessageToActiveTab({
                method: 'contextmenu' + action
                , color: settings.selectedColor
            }, tab);
        });
    });

    chrome.tabs.onUpdated.addListener(function( tabId, changeInfo, tab ) {
        if ( changeInfo.status == 'complete' && /^https?:/.test( tab.url || '' ) )
            syncTab( tabId, tab.url );
    });

    chrome.commands.onCommand.addListener(function( command, tab ) {
        getSettings().then(function( settings ) {
            if ( command == 'add-horizontal-guide' )
                return sendMessageToActiveTab({
                    method: 'injectGuide'
                    , color: settings.selectedColor
                    , dir: 'horz'
                }, tab);

            if ( command == 'add-vertical-guide' )
                return sendMessageToActiveTab({
                    method: 'injectGuide'
                    , color: settings.selectedColor
                    , dir: 'vert'
                }, tab);

            if ( command == 'toggle-settings-panel' )
                return sendMessageToActiveTab({
                    method: 'toggleSettingsPanel'
                }, tab);

            if ( command == 'clear-all-guides' )
                return sendMessageToActiveTab({
                    method: 'clearAllGuides'
                }, tab);

            if ( command == 'clear-vertical-guides' )
                return sendMessageToActiveTab({
                    method: 'clearVerticalGuides'
                }, tab);

            if ( command == 'clear-horizontal-guides' )
                return sendMessageToActiveTab({
                    method: 'clearHorizontalGuides'
                }, tab);

            if ( command == 'toggle-delete-mode' )
                return sendMessageToActiveTab({
                    method: 'toggleDeleteMode'
                }, tab);
        });
    });

    chrome.runtime.onMessage.addListener(function( request, sender, sendResponse ) {
        (async function() {
            console.log( 'REQUEST RECEIVED (background): ', request );

            if ( request.method == 'saveGuide' ) {
                await saveGuide( request.url, request.guideData );
                sendResponse({
                    id: request.guideData.id
                });
                return;
            }

            if ( request.method == 'removeGuide' ) {
                sendResponse({
                    success: await removeGuide( request.url, request.id )
                });
                return;
            }

            if ( request.method == 'clearGuides' ) {
                await clearGuides( request.url );
                sendResponse({});
                return;
            }

            sendResponse({});
        })().catch(function( error ) {
            console.error( 'Background request failed', error );
            sendResponse({
                error: error && error.message ? error.message : String(error)
            });
        });

        return true;
    });

    ensureDefaults().then( rebuildContextMenus );
})();
