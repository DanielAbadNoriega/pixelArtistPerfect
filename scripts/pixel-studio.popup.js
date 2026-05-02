/* pixel-studio.popup.js
 * by: D.Carter
 */
$(function() {

    var COLOR_VERSION = 4;
    var DEFAULT_GUIDE_COLOR = 'rgb(197, 10, 235)';
    var LEGACY_DEFAULT_COLORS = [
        '#84cc16'
        , 'rgb(132, 204, 22)'
        , '#ef4444'
        , 'rgb(239, 68, 68)'
    ];
    var presetColors = [
        { name: 'Violeta', value: DEFAULT_GUIDE_COLOR }
        , { name: 'Rojo', value: '#ef4444' }
        , { name: 'Verde', value: '#84cc16' }
        , { name: 'Amarillo', value: '#facc15' }
        , { name: 'Azul', value: '#60a5fa' }
    ];

    var DEFAULT_SETTINGS = {
        showDistances: true
        , doContextMenu: true
        , snapToPx: ''
        , snapToEls: ''
        , selectedColor: DEFAULT_GUIDE_COLOR
        , selectedColorVersion: COLOR_VERSION
    };

    var isMac = /Mac/i.test( navigator.platform || '' );
    var commandRecommendations = {
        'clear-vertical-guides': isMac ? 'Option+Shift+I' : 'Alt+Shift+I'
        , 'clear-horizontal-guides': isMac ? 'Option+Shift+L' : 'Alt+Shift+L'
        , 'toggle-delete-mode': isMac ? 'Option+Shift+D' : 'Alt+Shift+D'
    };

    var commandOrder = [
        'add-horizontal-guide'
        , 'add-vertical-guide'
        , 'toggle-settings-panel'
        , 'clear-all-guides'
        , 'clear-vertical-guides'
        , 'clear-horizontal-guides'
        , 'toggle-delete-mode'
    ];

    var commandLabels = {
        'add-horizontal-guide': 'Crear guía horizontal'
        , 'add-vertical-guide': 'Crear guía vertical'
        , 'toggle-settings-panel': 'Mostrar u ocultar la rueda flotante'
        , 'clear-all-guides': 'Limpiar toda la página'
        , 'clear-vertical-guides': 'Limpiar todas las verticales'
        , 'clear-horizontal-guides': 'Limpiar todas las horizontales'
        , 'toggle-delete-mode': 'Activar borrado múltiple'
    };

    var isValidCssColor = function( value ) {
        var style = document.createElement('span').style;
        style.color = '';
        style.color = $.trim( value || '' );
        return !!style.color;
    };

    var normalizeCssColor = function( value ) {
        var style = document.createElement('span').style
            , nextValue = $.trim( value || '' );

        if ( !nextValue )
            return DEFAULT_SETTINGS.selectedColor;

        style.color = '';
        style.color = nextValue;
        return style.color || DEFAULT_SETTINGS.selectedColor;
    };

    var colorToHex = function( value ) {
        var canvas = document.createElement('canvas').getContext('2d');
        canvas.fillStyle = normalizeCssColor( value );
        return canvas.fillStyle || DEFAULT_SETTINGS.selectedColor;
    };

    var normalizeColorString = function( value ) {
        return String( value || '' ).toLowerCase().replace( /\s+/g, '' );
    };

    var shouldMigrateDefaultColor = function( value ) {
        if ( !value )
            return true;

        var normalized = normalizeColorString( value );
        for ( var i = 0, len = LEGACY_DEFAULT_COLORS.length; i < len; i++ ) {
            if ( normalized == normalizeColorString( LEGACY_DEFAULT_COLORS[i] ) )
                return true;
        }

        return false;
    };

    ({
        init: async function() {
            this.cacheDom();
            this.buildSwatches();
            this.bindEvents();
            this.settings = await this.getSettings();
            this.render();
            this.renderCommands();
            this.syncUiState();
        }
        , cacheDom: function() {
            this.$addGuideLineVert = $('#addGuideLineVert');
            this.$addGuideLineHorz = $('#addGuideLineHorz');
            this.$clearGuideLines = $('#clearGuideLines');
            this.$clearGuideLinesVert = $('#clearGuideLinesVert');
            this.$clearGuideLinesHorz = $('#clearGuideLinesHorz');
            this.$toggleDeleteMode = $('#toggleDeleteMode');
            this.$openFloatingControls = $('#openFloatingControls');
            this.$showDistances = $('#show_distances');
            this.$contextMenu = $('#context_menu');
            this.$snapToPx = $('#snap_to_px');
            this.$snapToEls = $('#snap_to_els');
            this.$colorPicker = $('#guide_color_picker');
            this.$colorText = $('#guide_color_text');
            this.$colorPreview = $('.color_preview');
            this.$colorSwatches = $('#colorSwatches');
            this.$toggleInfo = $('#toggleInfo');
            this.$infoPanel = $('#infoPanel');
            this.$commandList = $('#commandList');
            this.$actionsAccordion = $('#actionsAccordion');
        }
        , buildSwatches: function() {
            this.$colorSwatches.empty();
            $.each( presetColors, function( i, preset ) {
                $('<button type="button">')
                    .addClass('popup-swatch')
                    .attr({
                        title: preset.name + ' · ' + preset.value
                        , 'data-color': preset.value
                    })
                    .css( 'background-color', preset.value )
                    .appendTo( this.$colorSwatches );
            }.bind(this));
        }
        , bindEvents: function() {
            this.$addGuideLineVert.on( 'click', function() {
                this.addGuideDir( 'vert' );
            }.bind(this) );

            this.$addGuideLineHorz.on( 'click', function() {
                this.addGuideDir( 'horz' );
            }.bind(this) );

            this.$clearGuideLines.on( 'click', this.clearGuides.bind(this) );
            this.$clearGuideLinesVert.on( 'click', this.clearVerticalGuides.bind(this) );
            this.$clearGuideLinesHorz.on( 'click', this.clearHorizontalGuides.bind(this) );
            this.$toggleDeleteMode.on( 'click', this.toggleDeleteMode.bind(this) );
            this.$openFloatingControls.on( 'click', this.toggleFloatingControls.bind(this) );
            this.$showDistances.on( 'change', this.distancesChange.bind(this) );
            this.$contextMenu.on( 'change', this.contextMenuChange.bind(this) );
            this.$snapToPx.on( 'change', this.snapChange.bind(this) );
            this.$snapToEls.on( 'change', this.snapElsChange.bind(this) );
            this.$colorPicker.on( 'input change', this.colorPickerChange.bind(this) );
            this.$colorText
                .on( 'input', this.colorTextInput.bind(this) )
                .on( 'change blur', this.colorTextCommit.bind(this) )
                .on( 'keydown', function( ev ) {
                    if ( ev.keyCode == 13 ) {
                        ev.preventDefault();
                        this.colorTextCommit( ev );
                    }
                }.bind(this));
            this.$colorSwatches.on( 'click', '.popup-swatch', this.swatchClick.bind(this) );
            this.$toggleInfo.on( 'click', function() {
                this.$infoPanel.toggleClass('hidden');
            }.bind(this) );
        }
        , getSettings: async function() {
            var settings = await chrome.storage.local.get( Object.keys( DEFAULT_SETTINGS ) )
                , payload = {};

            if ( settings.selectedColorVersion !== COLOR_VERSION ) {
                payload.selectedColorVersion = COLOR_VERSION;
                if ( shouldMigrateDefaultColor( settings.selectedColor ) )
                    payload.selectedColor = DEFAULT_SETTINGS.selectedColor;

                await chrome.storage.local.set( payload );
                settings = $.extend( {}, settings, payload );
            }

            return $.extend( {}, DEFAULT_SETTINGS, settings );
        }
        , saveSetting: async function( key, value ) {
            var payload = {};
            payload[key] = value;
            this.settings[key] = value;
            await chrome.storage.local.set( payload );
        }
        , render: function() {
            this.$showDistances.prop( 'checked', this.settings.showDistances !== false );
            this.$contextMenu.prop( 'checked', this.settings.doContextMenu !== false );
            this.$snapToPx.val( this.settings.snapToPx || '' );
            this.$snapToEls.val( this.settings.snapToEls || '' );
            this.renderColor( this.settings.selectedColor, true );
        }
        , renderColor: function( color, isValid ) {
            var normalized = normalizeCssColor( color );
            this.$colorPicker.val( colorToHex( normalized ) );
            this.$colorText
                .val( color )
                .toggleClass( 'invalid', !isValid );
            this.$colorPreview.css( 'background-color', isValid ? normalized : 'transparent' );

            this.$colorSwatches.find('.popup-swatch').removeClass('active').filter(function() {
                return colorToHex( $(this).data('color') ) == colorToHex( normalized );
            }).addClass('active');
        }
        , renderCommands: function() {
            chrome.commands.getAll(function( commands ) {
                var byName = {};
                $.each( commands, function( i, command ) {
                    byName[command.name] = command;
                });

                this.$commandList.empty();
                $.each( commandOrder, function( i, name ) {
                    var command = byName[name] || { name: name, shortcut: '' }
                        , label = commandLabels[name] || command.description || name
                        , shortcut = command.shortcut || ''
                        , recommended = commandRecommendations[name]
                        , text = shortcut || ( recommended ? 'Sin asignar · recomendado: ' + recommended : 'Sin asignar' );

                    $('<li>')
                        .append(
                            $('<strong>').text( label )
                            , $('<span>')
                                .addClass('command-shortcut' + ( shortcut ? '' : ' unbound' ))
                                .text( text )
                        )
                        .appendTo( this.$commandList );
                }.bind(this));
            }.bind(this));
        }
        , messageAllTabs: function( message ) {
            chrome.tabs.query( {}, function(tabs) {
                for ( var i = 0, len = tabs.length; i < len; i++ ) {
                    if ( /^https?:/.test( tabs[i].url || '' ) )
                        chrome.tabs.sendMessage( tabs[i].id, message, function() {
                            void chrome.runtime.lastError;
                        });
                }
            });
        }
        , sendMessageCurrentTab: function( message ) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if ( tabs[0] )
                    chrome.tabs.sendMessage( tabs[0].id, message, function() {
                        void chrome.runtime.lastError;
                    });
            });
        }
        , requestCurrentTabState: function( callback ) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if ( !tabs[0] || !/^https?:/.test( tabs[0].url || '' ) ) {
                    callback && callback({});
                    return;
                }

                chrome.tabs.sendMessage( tabs[0].id, { method: 'getUiState' }, function(response) {
                    if ( chrome.runtime.lastError ) {
                        callback && callback({});
                        return;
                    }
                    callback && callback(response || {});
                });
            });
        }
        , syncUiState: function() {
            this.requestCurrentTabState(function( state ) {
                this.renderDeleteModeState( !!state.deleteModeActive );
            }.bind(this));
        }
        , renderDeleteModeState: function( isActive ) {
            this.$toggleDeleteMode
                .toggleClass( 'active', !!isActive )
                .text( isActive ? 'Cancelar borrado múltiple' : 'Borrado múltiple' );

            if ( isActive )
                this.$actionsAccordion.prop( 'open', true );
        }
        , persistSelectedColor: function( color ) {
            var normalized = normalizeCssColor( color );
            this.saveSetting( 'selectedColor', normalized );
            this.renderColor( normalized, true );
        }
        , snapChange: function( ev ) {
            var value = $(ev.target).val();
            this.saveSetting( 'snapToPx', value );
            this.messageAllTabs({
                method: 'setSnapToPx'
                , snapToPx: value
            });
        }
        , snapElsChange: function( ev ) {
            var value = $(ev.target).val();
            this.saveSetting( 'snapToEls', value );
            this.messageAllTabs({
                method: 'setSnapToEls'
                , snapToEls: value
            });
        }
        , contextMenuChange: function( ev ) {
            var checked = !!ev.target.checked;
            this.saveSetting( 'doContextMenu', checked );
            this.messageAllTabs({
                method: checked ? 'activateContextMenu' : 'deactivateContextMenu'
            });
        }
        , distancesChange: function( ev ) {
            var checked = !!ev.target.checked;
            this.saveSetting( 'showDistances', checked );
            this.messageAllTabs({
                method: checked ? 'activateDistances' : 'deactivateDistances'
            });
        }
        , addGuideDir: function( dir ) {
            this.sendMessageCurrentTab({
                method: 'injectGuide'
                , color: this.settings.selectedColor
                , dir: dir
            });
        }
        , clearGuides: function() {
            this.sendMessageCurrentTab({
                method: 'clearAllGuides'
            });
        }
        , clearVerticalGuides: function() {
            this.sendMessageCurrentTab({
                method: 'clearVerticalGuides'
            });
        }
        , clearHorizontalGuides: function() {
            this.sendMessageCurrentTab({
                method: 'clearHorizontalGuides'
            });
        }
        , toggleDeleteMode: function() {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if ( !tabs[0] || !/^https?:/.test( tabs[0].url || '' ) )
                    return;

                chrome.tabs.sendMessage( tabs[0].id, {
                    method: 'toggleDeleteMode'
                }, function(response) {
                    if ( chrome.runtime.lastError )
                        return;

                    var isActive = !!( response && response.deleteModeActive );
                    this.renderDeleteModeState( isActive );

                    if ( isActive )
                        window.close();
                }.bind(this));
            }.bind(this));
        }
        , toggleFloatingControls: function() {
            this.sendMessageCurrentTab({
                method: 'toggleSettingsPanel'
            });
        }
        , swatchClick: function( ev ) {
            this.persistSelectedColor( $(ev.currentTarget).data('color') );
        }
        , colorPickerChange: function( ev ) {
            this.persistSelectedColor( ev.target.value );
        }
        , colorTextInput: function( ev ) {
            var value = $(ev.target).val();
            this.$colorText.toggleClass( 'invalid', !isValidCssColor( value ) );
            this.$colorPreview.css( 'background-color', isValidCssColor( value ) ? normalizeCssColor( value ) : 'transparent' );
        }
        , colorTextCommit: function( ev ) {
            var value = $.trim( $(ev.target).val() || '' );
            if ( !value )
                value = DEFAULT_SETTINGS.selectedColor;

            if ( !isValidCssColor( value ) ) {
                this.renderColor( this.settings.selectedColor, true );
                return;
            }

            this.persistSelectedColor( value );
        }
    }).init();
});
