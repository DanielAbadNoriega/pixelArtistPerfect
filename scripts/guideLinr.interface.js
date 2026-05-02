/* guideLinr.js
 * by: D.Carter
 */
$(function() {

    var log = function() {
        console.log.apply( console, arguments );
    };

    var store = 'localStorage' in window && window['localStorage'] !== null ? window.localStorage : {};

    if ( !store.showDistances )
        store.showDistances = 'true';

    ({
        init: function() {
            var showDistancesChecked = store.showDistances != 'false';

            log('init');
            $('#addGuideLineVert').on( 'click', function() {
                this.addGuideDir( 'vert' );
            }.bind(this) );
            $('#addGuideLineHorz').on( 'click', function() {
                this.addGuideDir( 'horz' );
            }.bind(this) );
            $('#clearGuideLines').on( 'click', this.clearGuides.bind(this) );
            $('#guide_color')
                .on( 'change', this.colorChange )
                .val( store.selectedColor ? store.selectedColor : 'lime' )
                .trigger('change');
            $('#show_distances')
                .on( 'change', this.distancesChange.bind(this) )
                .prop( 'checked', showDistancesChecked );
            $('#context_menu')
                .on( 'change', this.contextMenuChange.bind(this) )
                [store.doContextMenu == 'true' ? 'attr' : 'removeAttr']( 'checked', 'checked' );
            $('#snap_to_px')
                .on( 'change', this.snapChange.bind(this) )
                .val( store.snapToPx || '' );
            $('#snap_to_els')
                .on( 'change', this.snapElsChange.bind(this) )
                .val( store.snapToEls || '' );

            this.distancesChange({
                target: {
                    checked: showDistancesChecked
                }
            });
        }
        , messageAllTabs: function( message ) {
            chrome.tabs.query( {}, function(tabs) { // all opened tabs
                for ( var i = 0, ilen = tabs.length; i < ilen; ++i ) {
                    chrome.tabs.sendMessage( tabs[i].id, message);
                }
            });
        }
        , snapChange: function( ev ) {
            this.messageAllTabs({
                method: 'setSnapToPx'
                , snapToPx: (store.snapToPx = $(ev.target).val())
            });
        }
        , snapElsChange: function( ev ) {
            this.messageAllTabs({
                method: 'setSnapToEls'
                , snapToEls: (store.snapToEls = $(ev.target).val())
            });
        }
        , contextMenuChange: function( ev ) {
            store.doContextMenu = ev.target.checked ? 'true' : 'false';
            var bg = chrome.extension.getBackgroundPage();
            if ( ev.target.checked ) {
                bg.contextMenu.activate();
                this.messageAllTabs({
                    method: "activateContextMenu"
                });
            } else {
                bg.contextMenu.deactivate();
                this.messageAllTabs({
                    method: "deactivateContextMenu"
                });
            }
        }
        , distancesChange: function( ev ) {
            store.showDistances = ev.target.checked ? 'true' : 'false';
            if ( ev.target.checked )
                this.messageAllTabs({
                    method: "activateDistances"
                });
            else
                this.messageAllTabs({
                    method: "deactivateDistances"
                });
        }
        , sendMessageCurrentTab: function( message ) {
            console.log('About to send message: ', message );
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                chrome.tabs.sendMessage( tabs[0].id, message);
            });
        }
        , addGuideDir: function( dir ) {
            log('add guide ' + dir + '!');
            var color = $('#guide_color').val();
            
            this.sendMessageCurrentTab({
                method: "injectGuide"
                , color: color
                , dir: dir
            });
        }
        , clearGuides: function() {
            this.sendMessageCurrentTab({
                method: "clearAllGuides"
            });
        }
        , colorChange: function() {
            var val = $(this).val();
            store.selectedColor = val;
            $('.color_preview')
                .removeClass( 'aqua blue green yellow orange red pink' )
                .addClass( val );
        }
    }).init();
});
